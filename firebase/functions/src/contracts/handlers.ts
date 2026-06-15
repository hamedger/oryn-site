import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import {
  renderContractText,
  contractTextToHtml,
  validateContractInput,
  CONTRACT_VERSION,
  sanitizePlainText,
} from "../utils/contractTemplate";
import {
  createAuditLog,
  serializeContract,
  timestampToIso,
} from "../utils/audit";
import {
  generateSigningToken,
  hashToken,
  getSigningUrl,
  tokenExpiresAt,
} from "../tokens";
import { generateUnsignedPdf, generateSignedPdf, getSignedDownloadUrl } from "../pdf/generator";
import { sendSigningLinkEmail, sendSignedCopyEmails } from "../email/send";
import type { ContractFormInput } from "../types";

const db = () => getFirestore();

function buildContractText(input: ContractFormInput): string {
  return renderContractText({
    clientName: input.clientName,
    clientAddress: input.clientAddress,
    projectDescription: input.projectDescription,
    onboardingFee: Number(input.onboardingFee),
    monthlyFee: Number(input.monthlyFee),
    termMonths: Number(input.termMonths),
    startDate: input.startDate,
    customTerms: input.customTerms,
  });
}

function parseTermMonths(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "no-end") return null;
  return Number(raw);
}

function normalizeInput(raw: Record<string, unknown>): ContractFormInput {
  return {
    clientName: sanitizePlainText(String(raw.clientName || "")),
    clientAddress: sanitizePlainText(String(raw.clientAddress || "")),
    clientEmail: String(raw.clientEmail || "").trim().toLowerCase(),
    projectDescription: sanitizePlainText(String(raw.projectDescription || "")),
    onboardingFee: Number(raw.onboardingFee),
    monthlyFee: Number(raw.monthlyFee),
    termMonths: parseTermMonths(raw.termMonths),
    startDate: sanitizePlainText(String(raw.startDate || "")),
    customTerms: sanitizePlainText(String(raw.customTerms || "")),
    onboardingFeePaymentLink: raw.onboardingFeePaymentLink
      ? String(raw.onboardingFeePaymentLink).trim()
      : undefined,
    monthlyFeePaymentLink: raw.monthlyFeePaymentLink
      ? String(raw.monthlyFeePaymentLink).trim()
      : undefined,
    adminOverrideAllowDifferentSignerEmail:
      Boolean(raw.adminOverrideAllowDifferentSignerEmail),
  };
}

export async function handleCreateContract(
  raw: Record<string, unknown>,
  admin: { uid: string; email: string }
): Promise<{ contractId: string; contract: Record<string, unknown>; signingUrl?: string }> {
  const input = normalizeInput(raw);
  const validationError = validateContractInput(input);
  if (validationError) throw new HttpsError("invalid-argument", validationError);

  const send = Boolean(raw.send);
  const contractText = buildContractText(input);
  const ref = db().collection("contracts").doc();
  const now = FieldValue.serverTimestamp();

  let tokenHash: string | null = null;
  let rawToken: string | null = null;
  let tokenExp: FirebaseFirestore.Timestamp | null = null;
  let unsignedPdfPath: string | null = null;
  let status: string = "draft";

  if (send) {
    rawToken = generateSigningToken();
    tokenHash = hashToken(rawToken);
    tokenExp = tokenExpiresAt();
    status = "sent";
    unsignedPdfPath = await generateUnsignedPdf(ref.id, contractText);
  }

  const doc = {
    id: ref.id,
    clientName: input.clientName,
    clientAddress: input.clientAddress,
    clientEmail: input.clientEmail,
    projectDescription: input.projectDescription,
    onboardingFee: input.onboardingFee,
    monthlyFee: input.monthlyFee,
    termMonths: input.termMonths,
    startDate: input.startDate,
    customTerms: input.customTerms,
    onboardingFeePaymentLink: input.onboardingFeePaymentLink || null,
    monthlyFeePaymentLink: input.monthlyFeePaymentLink || null,
    contractText,
    contractVersion: CONTRACT_VERSION,
    tokenHash,
    signingToken: rawToken,
    tokenExpiresAt: tokenExp,
    status,
    unsignedPdfPath,
    signedPdfPath: null,
    createdAt: now,
    updatedAt: now,
    sentAt: send ? now : null,
    viewedAt: null,
    signedAt: null,
    cancelledAt: null,
    createdBy: admin.email,
    originalContractId: null,
    adminOverrideAllowDifferentSignerEmail:
      input.adminOverrideAllowDifferentSignerEmail ?? false,
  };

  await ref.set(doc);

  await createAuditLog({
    contractId: ref.id,
    eventType: "contract_created",
    actorType: "admin",
    actorEmail: admin.email,
    message: "Contract created",
    metadata: { status },
  });

  if (send && rawToken) {
    const signingUrl = getSigningUrl(rawToken);
    await sendSigningLinkEmail({
      contractId: ref.id,
      recipientEmail: input.clientEmail,
      clientName: input.clientName,
      signingUrl,
      onboardingFeePaymentLink: input.onboardingFeePaymentLink || null,
      monthlyFeePaymentLink: input.monthlyFeePaymentLink || null,
    });

    await createAuditLog({
      contractId: ref.id,
      eventType: "contract_sent",
      actorType: "admin",
      actorEmail: admin.email,
      message: "Contract sent to client",
    });

    await createAuditLog({
      contractId: ref.id,
      eventType: "email_sent",
      actorType: "system",
      message: "Signing link email sent",
      metadata: { recipient: input.clientEmail },
    });

    const snap = await ref.get();
    return {
      contractId: ref.id,
      contract: serializeContract(snap.data()!, ref.id),
      signingUrl,
    };
  }

  const snap = await ref.get();
  return {
    contractId: ref.id,
    contract: serializeContract(snap.data()!, ref.id),
  };
}

export async function handleUpdateDraft(
  contractId: string,
  raw: Record<string, unknown>,
  admin: { email: string }
): Promise<{ contract: Record<string, unknown> }> {
  const ref = db().collection("contracts").doc(contractId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Contract not found.");

  const existing = snap.data()!;
  if (existing.status !== "draft") {
    throw new HttpsError(
      "failed-precondition",
      "Only draft contracts can be edited."
    );
  }

  const input = normalizeInput({ ...existing, ...raw });
  const validationError = validateContractInput(input);
  if (validationError) throw new HttpsError("invalid-argument", validationError);

  const contractText = buildContractText(input);

  await ref.update({
    ...input,
    onboardingFeePaymentLink: input.onboardingFeePaymentLink || null,
    monthlyFeePaymentLink: input.monthlyFeePaymentLink || null,
    contractText,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await createAuditLog({
    contractId,
    eventType: "contract_updated",
    actorType: "admin",
    actorEmail: admin.email,
    message: "Draft contract updated",
  });

  const updated = await ref.get();
  return { contract: serializeContract(updated.data()!, contractId) };
}

export async function handleSendContract(
  contractId: string,
  admin: { email: string },
  isResend = false
): Promise<{ contractId: string; signingUrl: string }> {
  const ref = db().collection("contracts").doc(contractId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Contract not found.");

  const data = snap.data()!;
  if (data.status === "signed") {
    throw new HttpsError("failed-precondition", "Contract is already signed.");
  }
  if (data.status === "cancelled") {
    throw new HttpsError("failed-precondition", "Contract is cancelled.");
  }

  const rawToken = generateSigningToken();
  const tokenHash = hashToken(rawToken);
  const tokenExp = tokenExpiresAt();

  let unsignedPdfPath = data.unsignedPdfPath as string | null;
  if (!unsignedPdfPath) {
    unsignedPdfPath = await generateUnsignedPdf(
      contractId,
      data.contractText as string
    );
  }

  await ref.update({
    tokenHash,
    signingToken: rawToken,
    tokenExpiresAt: tokenExp,
    status: "sent",
    unsignedPdfPath,
    sentAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    cancelledAt: null,
  });

  const signingUrl = getSigningUrl(rawToken);

  await sendSigningLinkEmail({
    contractId,
    recipientEmail: data.clientEmail as string,
    clientName: data.clientName as string,
    signingUrl,
    onboardingFeePaymentLink: (data.onboardingFeePaymentLink as string) || null,
    monthlyFeePaymentLink: (data.monthlyFeePaymentLink as string) || null,
    isResend,
  });

  await createAuditLog({
    contractId,
    eventType: isResend ? "signing_link_resent" : "contract_sent",
    actorType: "admin",
    actorEmail: admin.email,
    message: isResend ? "Signing link resent" : "Contract sent",
  });

  return { contractId, signingUrl };
}

export async function handleGetContractByToken(
  token: string
): Promise<Record<string, unknown>> {
  if (!token || token.length < 32) {
    throw new HttpsError("invalid-argument", "Invalid signing link.");
  }

  const tokenHash = hashToken(token);
  const q = await db()
    .collection("contracts")
    .where("tokenHash", "==", tokenHash)
    .limit(1)
    .get();

  if (q.empty) {
    throw new HttpsError("not-found", "This signing link is invalid or has expired.");
  }

  const doc = q.docs[0];
  const data = doc.data();
  const contractId = doc.id;

  if (data.status === "signed") {
    throw new HttpsError(
      "failed-precondition",
      "This agreement has already been signed. Contact Oryn if you need a copy."
    );
  }
  if (data.status === "cancelled") {
    throw new HttpsError("failed-precondition", "This agreement has been cancelled.");
  }
  if (data.status === "expired") {
    throw new HttpsError("failed-precondition", "This signing link has expired.");
  }

  const expiresAt = data.tokenExpiresAt?.toDate?.();
  if (expiresAt && expiresAt < new Date()) {
    await doc.ref.update({ status: "expired", updatedAt: FieldValue.serverTimestamp() });
    throw new HttpsError("failed-precondition", "This signing link has expired.");
  }

  if (data.status === "sent") {
    await doc.ref.update({
      status: "viewed",
      viewedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await createAuditLog({
      contractId,
      eventType: "customer_viewed",
      actorType: "customer",
      actorEmail: data.clientEmail as string,
      message: "Customer viewed contract",
    });
  }

  return {
    contractId,
    clientName: data.clientName,
    contractTextHtml: contractTextToHtml(data.contractText as string),
    status: data.status === "sent" ? "viewed" : data.status,
    clientEmail: data.clientEmail,
    onboardingFeePaymentLink: data.onboardingFeePaymentLink || null,
    monthlyFeePaymentLink: data.monthlyFeePaymentLink || null,
    adminOverrideAllowDifferentSignerEmail:
      data.adminOverrideAllowDifferentSignerEmail ?? false,
  };
}

export async function handleAcceptContract(
  payload: Record<string, unknown>,
  ip: string,
  userAgent: string
): Promise<{ success: boolean; message: string }> {
  const token = String(payload.token || "");
  const signerName = sanitizePlainText(String(payload.signerName || ""));
  const signerEmail = String(payload.signerEmail || "").trim().toLowerCase();
  const signatureDataUrl = String(payload.signatureDataUrl || "");
  const agreementCheckbox = Boolean(payload.agreementCheckbox);

  if (!token) throw new HttpsError("invalid-argument", "Invalid token.");
  if (!signerName) throw new HttpsError("invalid-argument", "Signer name is required.");
  if (!signerEmail) throw new HttpsError("invalid-argument", "Signer email is required.");
  if (!agreementCheckbox) {
    throw new HttpsError("invalid-argument", "You must agree to the terms.");
  }
  if (!signatureDataUrl.startsWith("data:image/png;base64,")) {
    throw new HttpsError("invalid-argument", "Valid signature is required.");
  }

  const tokenHash = hashToken(token);
  const q = await db()
    .collection("contracts")
    .where("tokenHash", "==", tokenHash)
    .limit(1)
    .get();

  if (q.empty) throw new HttpsError("not-found", "Invalid signing link.");

  const doc = q.docs[0];
  const data = doc.data();
  const contractId = doc.id;

  if (["signed", "cancelled", "expired"].includes(data.status as string)) {
    throw new HttpsError("failed-precondition", `Contract cannot be signed (status: ${data.status}).`);
  }

  const expiresAt = data.tokenExpiresAt?.toDate?.();
  if (expiresAt && expiresAt < new Date()) {
    throw new HttpsError("failed-precondition", "Signing link has expired.");
  }

  if (
    signerEmail !== (data.clientEmail as string).toLowerCase() &&
    !data.adminOverrideAllowDifferentSignerEmail
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Signer email must match the email on the contract."
    );
  }

  const signatureB64 = signatureDataUrl.replace("data:image/png;base64,", "");
  const signatureBuffer = Buffer.from(signatureB64, "base64");
  if (signatureBuffer.length < 100) {
    throw new HttpsError("invalid-argument", "Signature appears empty.");
  }

  const signedAt = new Date();
  const signedContractText = renderContractText({
    clientName: data.clientName as string,
    clientAddress: data.clientAddress as string,
    projectDescription: data.projectDescription as string,
    onboardingFee: data.onboardingFee as number,
    monthlyFee: data.monthlyFee as number,
    termMonths: data.termMonths as number,
    startDate: data.startDate as string,
    customTerms: data.customTerms as string,
    signerName,
    signedDate: signedAt.toLocaleDateString("en-US"),
    orynSignedDate: signedAt.toLocaleDateString("en-US"),
  });

  const { pdfPath, signaturePath } = await generateSignedPdf({
    contractId,
    contractText: signedContractText,
    signerName,
    signedAt,
    ipAddress: ip,
    userAgent,
    signaturePngBuffer: signatureBuffer,
  });

  const acceptanceRef = db().collection("contractAcceptances").doc();
  await acceptanceRef.set({
    id: acceptanceRef.id,
    contractId,
    signerName,
    signerEmail,
    signatureImagePath: signaturePath,
    ipAddress: ip,
    userAgent,
    acceptedAt: FieldValue.serverTimestamp(),
    agreementCheckbox: true,
    contractVersion: data.contractVersion,
    signedPdfPath: pdfPath,
  });

  await doc.ref.update({
    status: "signed",
    signedAt: FieldValue.serverTimestamp(),
    signedPdfPath: pdfPath,
    updatedAt: FieldValue.serverTimestamp(),
    contractText: signedContractText,
    signingToken: null,
    tokenHash: null,
    tokenExpiresAt: null,
  });

  await createAuditLog({
    contractId,
    eventType: "customer_signed",
    actorType: "customer",
    actorEmail: signerEmail,
    message: "Customer electronically signed contract",
    metadata: { ip, userAgent },
  });

  await createAuditLog({
    contractId,
    eventType: "signed_pdf_generated",
    actorType: "system",
    message: "Signed PDF generated and stored",
    metadata: { pdfPath },
  });

  await sendSignedCopyEmails({
    contractId,
    clientEmail: data.clientEmail as string,
    clientName: data.clientName as string,
    signedPdfPath: pdfPath,
    recipient: "both",
  });

  await createAuditLog({
    contractId,
    eventType: "signed_pdf_emailed",
    actorType: "system",
    message: "Signed PDF emailed to client and admin",
  });

  return { success: true, message: "Contract signed successfully." };
}

export async function handleListContracts(
  filters: { status?: string; search?: string } = {}
): Promise<{ contracts: Record<string, unknown>[] }> {
  const snap = await db()
    .collection("contracts")
    .orderBy("createdAt", "desc")
    .limit(200)
    .get();

  let contracts = snap.docs.map((d) => serializeContract(d.data(), d.id));

  if (filters.status && filters.status !== "all") {
    if (filters.status === "awaiting_signature") {
      contracts = contracts.filter((c) => {
        const status = String(c.status);
        return (
          Boolean(c.sentAt) &&
          status !== "signed" &&
          status !== "cancelled" &&
          status !== "draft"
        );
      });
    } else {
      contracts = contracts.filter((c) => c.status === filters.status);
    }
  }

  if (filters.search?.trim()) {
    const term = filters.search.trim().toLowerCase();
    contracts = contracts.filter((c) => {
      const id = String(c.id).toLowerCase();
      const name = String(c.clientName).toLowerCase();
      const email = String(c.clientEmail).toLowerCase();
      return id.includes(term) || name.includes(term) || email.includes(term);
    });
  }

  return { contracts };
}

export async function handleGetContractSigningLink(
  contractId: string,
  admin: { email: string }
): Promise<{ signingUrl: string }> {
  const ref = db().collection("contracts").doc(contractId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Contract not found.");

  const data = snap.data()!;
  if (data.status === "signed") {
    throw new HttpsError("failed-precondition", "Contract is already signed.");
  }
  if (data.status === "cancelled") {
    throw new HttpsError("failed-precondition", "Contract is cancelled.");
  }
  if (data.status === "draft") {
    throw new HttpsError(
      "failed-precondition",
      "Send the contract first to generate a client signing link."
    );
  }

  const expiresAt = data.tokenExpiresAt?.toDate?.();
  const expired = Boolean(expiresAt && expiresAt < new Date());
  let rawToken = data.signingToken as string | undefined;

  if (!rawToken || expired) {
    rawToken = generateSigningToken();
    await ref.update({
      signingToken: rawToken,
      tokenHash: hashToken(rawToken),
      tokenExpiresAt: tokenExpiresAt(),
      updatedAt: FieldValue.serverTimestamp(),
      status: data.status === "expired" ? "sent" : data.status,
    });

    await createAuditLog({
      contractId,
      eventType: "signing_link_resent",
      actorType: "admin",
      actorEmail: admin.email,
      message: "Signing link refreshed for admin copy/share",
    });
  }

  return { signingUrl: getSigningUrl(rawToken) };
}

export async function handleGetContractDetail(contractId: string): Promise<Record<string, unknown>> {
  const ref = db().collection("contracts").doc(contractId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Contract not found.");

  const acceptanceSnap = await db()
    .collection("contractAcceptances")
    .where("contractId", "==", contractId)
    .limit(1)
    .get();

  const auditSnap = await db()
    .collection("auditLogs")
    .where("contractId", "==", contractId)
    .orderBy("createdAt", "asc")
    .get();

  const emailsSnap = await db()
    .collection("emails")
    .where("contractId", "==", contractId)
    .orderBy("createdAt", "desc")
    .get();

  let signatureImageUrl: string | null = null;
  const acceptance = acceptanceSnap.empty
    ? null
    : acceptanceSnap.docs[0].data();

  if (acceptance?.signatureImagePath) {
    signatureImageUrl = await getSignedDownloadUrl(
      acceptance.signatureImagePath as string,
      30
    );
  }

  return {
    contract: serializeContract(snap.data()!, contractId),
    acceptance: acceptance
      ? {
          ...acceptance,
          acceptedAt: timestampToIso(acceptance.acceptedAt),
        }
      : null,
    auditLogs: auditSnap.docs.map((d) => ({
      ...d.data(),
      createdAt: timestampToIso(d.data().createdAt),
    })),
    emails: emailsSnap.docs.map((d) => ({
      ...d.data(),
      createdAt: timestampToIso(d.data().createdAt),
      sentAt: timestampToIso(d.data().sentAt),
    })),
    signatureImageUrl,
  };
}

export async function handlePdfDownloadUrl(
  contractId: string,
  type: "unsigned" | "signed"
): Promise<{ url: string }> {
  const snap = await db().collection("contracts").doc(contractId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Contract not found.");

  const data = snap.data()!;
  const path =
    type === "signed"
      ? (data.signedPdfPath as string)
      : (data.unsignedPdfPath as string);

  if (!path) {
    throw new HttpsError("not-found", `${type} PDF not available.`);
  }

  const url = await getSignedDownloadUrl(path, 15);
  return { url };
}

export async function handleEmailSignedCopy(
  contractId: string,
  recipient: "client" | "admin",
  admin: { email: string }
): Promise<{ success: boolean }> {
  const snap = await db().collection("contracts").doc(contractId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Contract not found.");

  const data = snap.data()!;
  if (data.status !== "signed" || !data.signedPdfPath) {
    throw new HttpsError("failed-precondition", "Contract is not signed.");
  }

  await sendSignedCopyEmails({
    contractId,
    clientEmail: data.clientEmail as string,
    clientName: data.clientName as string,
    signedPdfPath: data.signedPdfPath as string,
    recipient,
  });

  await createAuditLog({
    contractId,
    eventType: "signed_pdf_emailed",
    actorType: "admin",
    actorEmail: admin.email,
    message: `Signed PDF emailed to ${recipient}`,
  });

  return { success: true };
}

export async function handleRenewContract(
  contractId: string,
  raw: Record<string, unknown>,
  admin: { email: string }
): Promise<{ contractId: string; contract: Record<string, unknown> }> {
  const snap = await db().collection("contracts").doc(contractId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Contract not found.");

  const original = snap.data()!;
  const input = normalizeInput({
    clientName: original.clientName,
    clientAddress: original.clientAddress,
    clientEmail: original.clientEmail,
    projectDescription: original.projectDescription,
    customTerms: original.customTerms,
    onboardingFee: raw.onboardingFee ?? original.onboardingFee,
    monthlyFee: raw.monthlyFee ?? original.monthlyFee,
    termMonths: raw.termMonths ?? original.termMonths,
    startDate: raw.startDate ?? original.startDate,
    onboardingFeePaymentLink:
      raw.onboardingFeePaymentLink ?? original.onboardingFeePaymentLink,
    monthlyFeePaymentLink:
      raw.monthlyFeePaymentLink ?? original.monthlyFeePaymentLink,
    adminOverrideAllowDifferentSignerEmail:
      original.adminOverrideAllowDifferentSignerEmail,
  });

  const validationError = validateContractInput(input);
  if (validationError) throw new HttpsError("invalid-argument", validationError);

  const ref = db().collection("contracts").doc();
  const contractText = buildContractText(input);
  const now = FieldValue.serverTimestamp();

  await ref.set({
    id: ref.id,
    ...input,
    onboardingFeePaymentLink: input.onboardingFeePaymentLink || null,
    monthlyFeePaymentLink: input.monthlyFeePaymentLink || null,
    contractText,
    contractVersion: CONTRACT_VERSION,
    tokenHash: null,
    tokenExpiresAt: null,
    status: "draft",
    unsignedPdfPath: null,
    signedPdfPath: null,
    createdAt: now,
    updatedAt: now,
    sentAt: null,
    viewedAt: null,
    signedAt: null,
    cancelledAt: null,
    createdBy: admin.email,
    originalContractId: contractId,
    adminOverrideAllowDifferentSignerEmail:
      input.adminOverrideAllowDifferentSignerEmail ?? false,
  });

  await createAuditLog({
    contractId: ref.id,
    eventType: "contract_renewed",
    actorType: "admin",
    actorEmail: admin.email,
    message: `Renewal draft created from contract ${contractId}`,
    metadata: { originalContractId: contractId },
  });

  await createAuditLog({
    contractId,
    eventType: "contract_renewed",
    actorType: "admin",
    actorEmail: admin.email,
    message: `Renewed as new draft ${ref.id}`,
    metadata: { renewalContractId: ref.id },
  });

  const created = await ref.get();
  return {
    contractId: ref.id,
    contract: serializeContract(created.data()!, ref.id),
  };
}

export async function handleCancelContract(
  contractId: string,
  admin: { email: string }
): Promise<{ success: boolean }> {
  const ref = db().collection("contracts").doc(contractId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Contract not found.");

  const data = snap.data()!;
  if (data.status === "signed") {
    throw new HttpsError("failed-precondition", "Signed contracts cannot be cancelled.");
  }

  await ref.update({
    status: "cancelled",
    cancelledAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await createAuditLog({
    contractId,
    eventType: "contract_cancelled",
    actorType: "admin",
    actorEmail: admin.email,
    message: "Contract cancelled",
  });

  return { success: true };
}

export async function handlePreviewContract(
  raw: Record<string, unknown>
): Promise<{ contractText: string; contractTextHtml: string }> {
  const input = normalizeInput(raw);
  const validationError = validateContractInput(input);
  if (validationError) throw new HttpsError("invalid-argument", validationError);

  const contractText = buildContractText(input);
  return {
    contractText,
    contractTextHtml: contractTextToHtml(contractText),
  };
}

function serializeTemplate(
  data: FirebaseFirestore.DocumentData,
  id: string
): Record<string, unknown> {
  return {
    id,
    name: data.name,
    description: data.description || "",
    projectDescription: data.projectDescription || "",
    onboardingFee: data.onboardingFee ?? 0,
    monthlyFee: data.monthlyFee ?? 0,
    termMonths: data.termMonths ?? null,
    customTerms: data.customTerms || "",
    onboardingFeePaymentLink: data.onboardingFeePaymentLink || "",
    monthlyFeePaymentLink: data.monthlyFeePaymentLink || "",
    adminOverrideAllowDifferentSignerEmail:
      data.adminOverrideAllowDifferentSignerEmail ?? false,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
    createdBy: data.createdBy,
  };
}

function normalizeTemplateInput(raw: Record<string, unknown>) {
  const name = sanitizePlainText(String(raw.name || ""));
  if (!name) throw new HttpsError("invalid-argument", "Template name is required.");

  return {
    name,
    description: sanitizePlainText(String(raw.description || "")),
    projectDescription: sanitizePlainText(String(raw.projectDescription || "")),
    onboardingFee: Number(raw.onboardingFee) || 0,
    monthlyFee: Number(raw.monthlyFee) || 0,
    termMonths: parseTermMonths(raw.termMonths),
    customTerms: sanitizePlainText(String(raw.customTerms || "")),
    onboardingFeePaymentLink: String(raw.onboardingFeePaymentLink || "").trim(),
    monthlyFeePaymentLink: String(raw.monthlyFeePaymentLink || "").trim(),
    adminOverrideAllowDifferentSignerEmail: Boolean(
      raw.adminOverrideAllowDifferentSignerEmail
    ),
  };
}

export async function handleListContractTemplates(): Promise<{
  templates: Record<string, unknown>[];
}> {
  const snap = await db()
    .collection("contractTemplates")
    .orderBy("name", "asc")
    .get();
  return {
    templates: snap.docs.map((d) => serializeTemplate(d.data(), d.id)),
  };
}

export async function handleSaveContractTemplate(
  raw: Record<string, unknown>,
  admin: { email: string }
): Promise<{ templateId: string; template: Record<string, unknown> }> {
  const input = normalizeTemplateInput(raw);
  const templateId = raw.templateId
    ? String(raw.templateId)
    : db().collection("contractTemplates").doc().id;
  const ref = db().collection("contractTemplates").doc(templateId);
  const existing = await ref.get();
  const now = FieldValue.serverTimestamp();

  await ref.set(
    {
      ...input,
      createdAt: existing.exists ? existing.data()?.createdAt ?? now : now,
      updatedAt: now,
      createdBy: existing.exists
        ? existing.data()?.createdBy ?? admin.email
        : admin.email,
    },
    { merge: true }
  );

  const saved = await ref.get();
  return {
    templateId,
    template: serializeTemplate(saved.data()!, templateId),
  };
}

export async function handleDeleteContractTemplate(
  templateId: string
): Promise<{ success: boolean }> {
  if (!templateId) throw new HttpsError("invalid-argument", "templateId required");
  const ref = db().collection("contractTemplates").doc(templateId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Template not found.");
  await ref.delete();
  return { success: true };
}
