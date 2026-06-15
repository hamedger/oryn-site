import { getFirestore, FieldValue, Timestamp, DocumentData } from "firebase-admin/firestore";

export type AuditActorType = "admin" | "customer" | "system";

const db = () => getFirestore();

export async function createAuditLog(params: {
  contractId: string;
  eventType: string;
  actorType: AuditActorType;
  actorEmail?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const ref = db().collection("auditLogs").doc();
  await ref.set({
    id: ref.id,
    contractId: params.contractId,
    eventType: params.eventType,
    actorType: params.actorType,
    actorEmail: params.actorEmail ?? null,
    message: params.message,
    metadata: params.metadata ?? {},
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function createEmailRecord(params: {
  contractId: string;
  recipientEmail: string;
  emailType: string;
}): Promise<string> {
  const ref = db().collection("emails").doc();
  await ref.set({
    id: ref.id,
    contractId: params.contractId,
    recipientEmail: params.recipientEmail,
    emailType: params.emailType,
    providerMessageId: null,
    status: "pending",
    errorMessage: null,
    createdAt: FieldValue.serverTimestamp(),
    sentAt: null,
  });
  return ref.id;
}

export async function markEmailSent(
  emailId: string,
  providerMessageId: string | null
): Promise<void> {
  await db().collection("emails").doc(emailId).update({
    status: "sent",
    providerMessageId,
    sentAt: FieldValue.serverTimestamp(),
  });
}

export async function markEmailFailed(
  emailId: string,
  errorMessage: string
): Promise<void> {
  await db().collection("emails").doc(emailId).update({
    status: "failed",
    errorMessage,
  });
}

export function timestampToIso(
  ts: Timestamp | null | undefined
): string | null {
  if (!ts) return null;
  return ts.toDate().toISOString();
}

export function serializeContract(
  data: DocumentData,
  id: string
): Record<string, unknown> {
  const tsFields = [
    "createdAt",
    "updatedAt",
    "sentAt",
    "viewedAt",
    "signedAt",
    "cancelledAt",
    "tokenExpiresAt",
  ] as const;

  const out: Record<string, unknown> = { ...data, id };
  delete out.signingToken;
  delete out.tokenHash;
  for (const f of tsFields) {
    const val = data[f];
    out[f] = val?.toDate ? val.toDate().toISOString() : val ?? null;
  }
  return out;
}
