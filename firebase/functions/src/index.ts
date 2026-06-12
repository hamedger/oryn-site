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
  handlePdfDownloadUrl,
  handleEmailSignedCopy,
  handleRenewContract,
  handleCancelContract,
  handlePreviewContract,
} from "./contracts/handlers";
import { getClientIp, getUserAgent } from "./utils/auth";

initializeApp();
setGlobalOptions({ region: process.env.FUNCTIONS_REGION || "us-central1" });

export const createContract = onCall(async (request) => {
  const admin = await requireAdmin(request);
  return handleCreateContract((request.data as Record<string, unknown>) || {}, admin);
});

export const updateDraftContract = onCall(async (request) => {
  const admin = await requireAdmin(request);
  const data = (request.data as Record<string, unknown>) || {};
  const contractId = String(data.contractId || "");
  if (!contractId) throw new Error("contractId required");
  return handleUpdateDraft(contractId, data, admin);
});

export const sendContractEmail = onCall(async (request) => {
  const admin = await requireAdmin(request);
  const contractId = String((request.data as { contractId?: string })?.contractId || "");
  if (!contractId) throw new Error("contractId required");
  return handleSendContract(contractId, admin, false);
});

export const resendContractEmail = onCall(async (request) => {
  const admin = await requireAdmin(request);
  const contractId = String((request.data as { contractId?: string })?.contractId || "");
  if (!contractId) throw new Error("contractId required");
  return handleSendContract(contractId, admin, true);
});

export const getContractByToken = onCall(async (request) => {
  const token = String((request.data as { token?: string })?.token || "");
  return handleGetContractByToken(token);
});

export const acceptContract = onCall(async (request) => {
  const ip = getClientIp(request);
  const userAgent = getUserAgent(request);
  return handleAcceptContract(
    (request.data as Record<string, unknown>) || {},
    ip,
    userAgent
  );
});

export const listContracts = onCall(async (request) => {
  await requireAdmin(request);
  const filters = (request.data as { status?: string; search?: string }) || {};
  return handleListContracts(filters);
});

export const getContractDetail = onCall(async (request) => {
  await requireAdmin(request);
  const contractId = String((request.data as { contractId?: string })?.contractId || "");
  if (!contractId) throw new Error("contractId required");
  return handleGetContractDetail(contractId);
});

export const getSignedPdfDownloadUrl = onCall(async (request) => {
  await requireAdmin(request);
  const data = request.data as { contractId?: string; type?: "unsigned" | "signed" };
  const contractId = String(data?.contractId || "");
  const type = data?.type || "signed";
  if (!contractId) throw new Error("contractId required");
  return handlePdfDownloadUrl(contractId, type);
});

export const emailSignedCopy = onCall(async (request) => {
  const admin = await requireAdmin(request);
  const data = request.data as { contractId?: string; recipient?: "client" | "admin" };
  const contractId = String(data?.contractId || "");
  const recipient = data?.recipient || "client";
  if (!contractId) throw new Error("contractId required");
  return handleEmailSignedCopy(contractId, recipient, admin);
});

export const renewContract = onCall(async (request) => {
  const admin = await requireAdmin(request);
  const data = (request.data as Record<string, unknown>) || {};
  const contractId = String(data.contractId || "");
  if (!contractId) throw new Error("contractId required");
  return handleRenewContract(contractId, data, admin);
});

export const cancelContract = onCall(async (request) => {
  const admin = await requireAdmin(request);
  const contractId = String((request.data as { contractId?: string })?.contractId || "");
  if (!contractId) throw new Error("contractId required");
  return handleCancelContract(contractId, admin);
});

export const previewContract = onCall(async (request) => {
  await requireAdmin(request);
  return handlePreviewContract((request.data as Record<string, unknown>) || {});
});

// Aliases matching spec function names
export const generateUnsignedPdf = sendContractEmail;
export const generateSignedPdf = acceptContract;
