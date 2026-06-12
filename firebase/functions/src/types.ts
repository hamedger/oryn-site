export type ContractStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "signed"
  | "expired"
  | "cancelled";

export interface ContractDoc {
  id: string;
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  projectDescription: string;
  onboardingFee: number;
  monthlyFee: number;
  termMonths: number | null;
  startDate: string;
  customTerms: string;
  onboardingFeePaymentLink: string | null;
  contractText: string;
  contractVersion: string;
  tokenHash: string | null;
  tokenExpiresAt: FirebaseFirestore.Timestamp | null;
  status: ContractStatus;
  unsignedPdfPath: string | null;
  signedPdfPath: string | null;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  sentAt: FirebaseFirestore.Timestamp | null;
  viewedAt: FirebaseFirestore.Timestamp | null;
  signedAt: FirebaseFirestore.Timestamp | null;
  cancelledAt: FirebaseFirestore.Timestamp | null;
  createdBy: string;
  originalContractId: string | null;
  adminOverrideAllowDifferentSignerEmail: boolean;
}

export interface ContractFormInput {
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  projectDescription: string;
  onboardingFee: number;
  monthlyFee: number;
  termMonths: number | null;
  startDate: string;
  customTerms: string;
  onboardingFeePaymentLink?: string;
  adminOverrideAllowDifferentSignerEmail?: boolean;
}
