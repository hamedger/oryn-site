import { initializeApp } from "firebase-admin/app";
import { onCall } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { requireAdmin } from "./utils/auth";
import {
  handleCreateContract,
  handleUpdateDraft,
  handleSendContract,
  handleGetContractByToken,
  handleAcceptContract,
  handleListContracts,
  handleGetContractDetail,
  handleGetContractSigningLink,
  handlePdfDownloadUrl,
  handleEmailSignedCopy,
  handleRenewContract,
  handleCopyContract,
  handleCancelContract,
  handlePreviewContract,
  handleListContractTemplates,
  handleSaveContractTemplate,
  handleDeleteContractTemplate,
} from "./contracts/handlers";
import { getClientIp, getUserAgent } from "./utils/auth";

initializeApp();
setGlobalOptions({ region: process.env.FUNCTIONS_REGION || "us-central1" });

// Callable functions must allow public Cloud Run invocation; Firebase Auth is
// enforced inside each handler via requireAdmin / token validation.
const callableOptions = { invoker: "public" as const };

export const createContract = onCall(callableOptions, async (request) => {
  const admin = await requireAdmin(request);
  return handleCreateContract((request.data as Record<string, unknown>) || {}, admin);
});

export const updateDraftContract = onCall(callableOptions, async (request) => {
  const admin = await requireAdmin(request);
  const data = (request.data as Record<string, unknown>) || {};
  const contractId = String(data.contractId || "");
  if (!contractId) throw new Error("contractId required");
  return handleUpdateDraft(contractId, data, admin);
});

export const sendContractEmail = onCall(callableOptions, async (request) => {
  const admin = await requireAdmin(request);
  const contractId = String((request.data as { contractId?: string })?.contractId || "");
  if (!contractId) throw new Error("contractId required");
  return handleSendContract(contractId, admin, false);
});

export const resendContractEmail = onCall(callableOptions, async (request) => {
  const admin = await requireAdmin(request);
  const contractId = String((request.data as { contractId?: string })?.contractId || "");
  if (!contractId) throw new Error("contractId required");
  return handleSendContract(contractId, admin, true);
});

export const getContractByToken = onCall(callableOptions, async (request) => {
  const token = String((request.data as { token?: string })?.token || "");
  return handleGetContractByToken(token);
});

export const acceptContract = onCall(callableOptions, async (request) => {
  const ip = getClientIp(request);
  const userAgent = getUserAgent(request);
  return handleAcceptContract(
    (request.data as Record<string, unknown>) || {},
    ip,
    userAgent
  );
});

export const listContracts = onCall(callableOptions, async (request) => {
  await requireAdmin(request);
  const filters = (request.data as { status?: string; search?: string }) || {};
  return handleListContracts(filters);
});

export const getContractDetail = onCall(callableOptions, async (request) => {
  await requireAdmin(request);
  const contractId = String((request.data as { contractId?: string })?.contractId || "");
  if (!contractId) throw new Error("contractId required");
  return handleGetContractDetail(contractId);
});

export const getContractSigningLink = onCall(callableOptions, async (request) => {
  const admin = await requireAdmin(request);
  const contractId = String((request.data as { contractId?: string })?.contractId || "");
  if (!contractId) throw new Error("contractId required");
  return handleGetContractSigningLink(contractId, admin);
});

export const getSignedPdfDownloadUrl = onCall(callableOptions, async (request) => {
  await requireAdmin(request);
  const data = request.data as { contractId?: string; type?: "unsigned" | "signed" };
  const contractId = String(data?.contractId || "");
  const type = data?.type || "signed";
  if (!contractId) throw new Error("contractId required");
  return handlePdfDownloadUrl(contractId, type);
});

export const emailSignedCopy = onCall(callableOptions, async (request) => {
  const admin = await requireAdmin(request);
  const data = request.data as { contractId?: string; recipient?: "client" | "admin" };
  const contractId = String(data?.contractId || "");
  const recipient = data?.recipient || "client";
  if (!contractId) throw new Error("contractId required");
  return handleEmailSignedCopy(contractId, recipient, admin);
});

export const renewContract = onCall(callableOptions, async (request) => {
  const admin = await requireAdmin(request);
  const data = (request.data as Record<string, unknown>) || {};
  const contractId = String(data.contractId || "");
  if (!contractId) throw new Error("contractId required");
  return handleRenewContract(contractId, data, admin);
});

export const copyContract = onCall(callableOptions, async (request) => {
  await requireAdmin(request);
  const contractId = String((request.data as { contractId?: string })?.contractId || "");
  if (!contractId) throw new Error("contractId required");
  return handleCopyContract(contractId);
});

export const cancelContract = onCall(callableOptions, async (request) => {
  const admin = await requireAdmin(request);
  const contractId = String((request.data as { contractId?: string })?.contractId || "");
  if (!contractId) throw new Error("contractId required");
  return handleCancelContract(contractId, admin);
});

export const previewContract = onCall(callableOptions, async (request) => {
  await requireAdmin(request);
  return handlePreviewContract((request.data as Record<string, unknown>) || {});
});

export const listContractTemplates = onCall(callableOptions, async (request) => {
  await requireAdmin(request);
  return handleListContractTemplates();
});

export const saveContractTemplate = onCall(callableOptions, async (request) => {
  const admin = await requireAdmin(request);
  return handleSaveContractTemplate(
    (request.data as Record<string, unknown>) || {},
    admin
  );
});

export const deleteContractTemplate = onCall(callableOptions, async (request) => {
  await requireAdmin(request);
  const templateId = String(
    (request.data as { templateId?: string })?.templateId || ""
  );
  if (!templateId) throw new Error("templateId required");
  return handleDeleteContractTemplate(templateId);
});

// Aliases matching spec function names
export const generateUnsignedPdf = sendContractEmail;
export const generateSignedPdf = acceptContract;
