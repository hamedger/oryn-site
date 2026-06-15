import { api } from "./api";
import type { ContractFormData } from "./types";

const COPY_STORAGE_KEY = "oryn-contract-copy";

export interface StashedContractCopy {
  fields: Partial<ContractFormData>;
  sourceContractId: string;
}

export function stashContractCopy(payload: StashedContractCopy): void {
  sessionStorage.setItem(COPY_STORAGE_KEY, JSON.stringify(payload));
}

export function consumeContractCopy(): StashedContractCopy | null {
  const raw = sessionStorage.getItem(COPY_STORAGE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(COPY_STORAGE_KEY);
  try {
    return JSON.parse(raw) as StashedContractCopy;
  } catch {
    return null;
  }
}

export async function startCopyContract(contractId: string): Promise<void> {
  const res = await api.copyContract(contractId);
  stashContractCopy({
    fields: res.fields as Partial<ContractFormData>,
    sourceContractId: res.sourceContractId,
  });
  window.location.href = "/admin/contracts/new/";
}
