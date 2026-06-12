import { httpsCallable, HttpsCallableResult } from "firebase/functions";
import { getFirebaseFunctions } from "./firebase";
import type {
  Contract,
  ContractFormData,
  ContractAcceptance,
  AuditLog,
  EmailRecord,
  PublicContractView,
  SignedContractSummaryData,
} from "./types";

async function call<TReq, TRes>(
  name: string,
  data?: TReq
): Promise<TRes> {
  const fn = httpsCallable<TReq, TRes>(getFirebaseFunctions(), name);
  const result: HttpsCallableResult<TRes> = await fn(data as TReq);
  return result.data;
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
    call<typeof data, CreateContractResponse>("createContract", data),

  updateDraftContract: (
    contractId: string,
    data: Partial<ContractFormData>
  ) =>
    call("updateDraftContract", { contractId, ...data }),

  sendContractEmail: (contractId: string) =>
    call<{ contractId: string }, SendContractResponse>("sendContractEmail", {
      contractId,
    }),

  resendContractEmail: (contractId: string) =>
    call<{ contractId: string }, SendContractResponse>("resendContractEmail", {
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
    call<typeof filters, { contracts: Contract[] }>("listContracts", filters),

  getContractDetail: (contractId: string) =>
    call<
      { contractId: string },
      {
        contract: Contract;
        acceptance: ContractAcceptance | null;
        auditLogs: AuditLog[];
        emails: EmailRecord[];
        signatureImageUrl: string | null;
      }
    >("getContractDetail", { contractId }),

  getPdfDownloadUrl: (
    contractId: string,
    type: "unsigned" | "signed"
  ) =>
    call<
      { contractId: string; type: "unsigned" | "signed" },
      { url: string }
    >("getSignedPdfDownloadUrl", { contractId, type }),

  emailSignedCopy: (
    contractId: string,
    recipient: "client" | "admin"
  ) =>
    call<
      { contractId: string; recipient: "client" | "admin" },
      { success: boolean }
    >("emailSignedCopy", { contractId, recipient }),

  renewContract: (
    contractId: string,
    updates: Partial<
      Pick<
        ContractFormData,
        "onboardingFee" | "monthlyFee" | "termMonths" | "startDate" | "onboardingFeePaymentLink"
      >
    >
  ) =>
    call<
      Record<string, unknown>,
      { contractId: string; contract: Contract }
    >("renewContract", { contractId, ...updates }),

  cancelContract: (contractId: string) =>
    call<{ contractId: string }, { success: boolean }>("cancelContract", {
      contractId,
    }),

  previewContract: (data: ContractFormData) =>
    call<ContractFormData, { contractText: string; contractTextHtml: string }>(
      "previewContract",
      data
    ),
};

export type { SignedContractSummaryData };
