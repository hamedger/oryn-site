import { FirebaseError } from "firebase/app";
import { httpsCallable, HttpsCallableResult } from "firebase/functions";
import { getClientAuth, getFirebaseFunctions } from "./firebase";
import type {
  Contract,
  ContractFormData,
  ContractAcceptance,
  AuditLog,
  EmailRecord,
  PublicContractView,
  SignedContractSummaryData,
  ContractTemplate,
  ContractTemplateFormData,
} from "./types";

async function ensureAuthToken(forceRefresh = false): Promise<void> {
  const user = getClientAuth().currentUser;
  if (!user) {
    throw new Error("Authentication required. Please sign in again.");
  }
  await user.getIdToken(forceRefresh);
}

function isUnauthenticatedError(err: unknown): boolean {
  return (
    err instanceof FirebaseError &&
    (err.code === "functions/unauthenticated" || err.code === "unauthenticated")
  );
}

async function call<TReq, TRes>(
  name: string,
  data?: TReq,
  options?: { requireAuth?: boolean }
): Promise<TRes> {
  if (options?.requireAuth) {
    await ensureAuthToken();
  }

  const fn = httpsCallable<TReq, TRes>(getFirebaseFunctions(), name);
  try {
    const result: HttpsCallableResult<TRes> = await fn(data as TReq);
    return result.data;
  } catch (err) {
    if (options?.requireAuth && isUnauthenticatedError(err)) {
      await ensureAuthToken(true);
      const retry: HttpsCallableResult<TRes> = await fn(data as TReq);
      return retry.data;
    }
    throw err;
  }
}

async function adminCall<TReq, TRes>(name: string, data?: TReq): Promise<TRes> {
  return call<TReq, TRes>(name, data, { requireAuth: true });
}

export interface CreateContractResponse {
  contractId: string;
  contract: Contract;
}

export interface SendContractResponse {
  contractId: string;
  signingUrl: string;
}

export interface AcceptContractPayload {
  token: string;
  signerName: string;
  signerEmail: string;
  signatureDataUrl: string;
  agreementCheckbox: boolean;
}

export const api = {
  createContract: (data: ContractFormData & { send?: boolean }) =>
    adminCall<typeof data, CreateContractResponse>("createContract", data),

  updateDraftContract: (
    contractId: string,
    data: Partial<ContractFormData>
  ) =>
    adminCall("updateDraftContract", { contractId, ...data }),

  sendContractEmail: (contractId: string) =>
    adminCall<{ contractId: string }, SendContractResponse>("sendContractEmail", {
      contractId,
    }),

  resendContractEmail: (contractId: string) =>
    adminCall<{ contractId: string }, SendContractResponse>("resendContractEmail", {
      contractId,
    }),

  getContractByToken: (token: string) =>
    call<{ token: string }, PublicContractView>("getContractByToken", {
      token,
    }),

  acceptContract: (payload: AcceptContractPayload) =>
    call<AcceptContractPayload, { success: boolean; message: string }>(
      "acceptContract",
      payload
    ),

  listContracts: (filters?: { status?: string; search?: string }) =>
    adminCall<typeof filters, { contracts: Contract[] }>("listContracts", filters),

  getContractDetail: (contractId: string) =>
    adminCall<
      { contractId: string },
      {
        contract: Contract;
        acceptance: ContractAcceptance | null;
        auditLogs: AuditLog[];
        emails: EmailRecord[];
        signatureImageUrl: string | null;
      }
    >("getContractDetail", { contractId }),

  getContractSigningLink: (contractId: string) =>
    adminCall<{ contractId: string }, { signingUrl: string }>(
      "getContractSigningLink",
      { contractId }
    ),

  getPdfDownloadUrl: (
    contractId: string,
    type: "unsigned" | "signed"
  ) =>
    adminCall<
      { contractId: string; type: "unsigned" | "signed" },
      { url: string }
    >("getSignedPdfDownloadUrl", { contractId, type }),

  emailSignedCopy: (
    contractId: string,
    recipient: "client" | "admin"
  ) =>
    adminCall<
      { contractId: string; recipient: "client" | "admin" },
      { success: boolean }
    >("emailSignedCopy", { contractId, recipient }),

  renewContract: (
    contractId: string,
    updates: Partial<
      Pick<
        ContractFormData,
        "onboardingFee" | "monthlyFee" | "termMonths" | "startDate" | "onboardingFeePaymentLink" | "monthlyFeePaymentLink"
      >
    >
  ) =>
    adminCall<
      Record<string, unknown>,
      { contractId: string; contract: Contract }
    >("renewContract", { contractId, ...updates }),

  cancelContract: (contractId: string) =>
    adminCall<{ contractId: string }, { success: boolean }>("cancelContract", {
      contractId,
    }),

  previewContract: (data: ContractFormData) =>
    adminCall<ContractFormData, { contractText: string; contractTextHtml: string }>(
      "previewContract",
      data
    ),

  listContractTemplates: () =>
    adminCall<undefined, { templates: ContractTemplate[] }>("listContractTemplates"),

  saveContractTemplate: (data: ContractTemplateFormData & { templateId?: string }) =>
    adminCall<typeof data, { templateId: string; template: ContractTemplate }>(
      "saveContractTemplate",
      data
    ),

  deleteContractTemplate: (templateId: string) =>
    adminCall<{ templateId: string }, { success: boolean }>("deleteContractTemplate", {
      templateId,
    }),
};

export type { SignedContractSummaryData };
