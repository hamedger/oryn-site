export type ContractStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "signed"
  | "expired"
  | "cancelled";

export type AuditActorType = "admin" | "customer" | "system";

export type EmailType =
  | "signing_link"
  | "signed_copy"
  | "admin_notification"
  | "resend_signing_link";

export type EmailStatus = "pending" | "sent" | "failed";

export type ContractListFilter = ContractStatus | "all" | "awaiting_signature";

export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  projectDescription: string;
  onboardingFee: number;
  monthlyFee: number;
  termMonths: number | null;
  customTerms: string;
  onboardingFeePaymentLink: string;
  adminOverrideAllowDifferentSignerEmail: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export type ContractTemplateFormData = Omit<
  ContractTemplate,
  "id" | "createdAt" | "updatedAt" | "createdBy"
>;

export interface Contract {
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
  /** Stripe Payment Link URL for onboarding fee — pasted by admin, shown to customer */
  onboardingFeePaymentLink: string | null;
  contractText: string;
  contractVersion: string;
  tokenHash: string | null;
  tokenExpiresAt: string | null;
  status: ContractStatus;
  unsignedPdfPath: string | null;
  signedPdfPath: string | null;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  cancelledAt: string | null;
  createdBy: string;
  originalContractId: string | null;
  adminOverrideAllowDifferentSignerEmail: boolean;
}

export interface ContractFormData {
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  projectDescription: string;
  onboardingFee: number;
  monthlyFee: number;
  termMonths: number | null;
  startDate: string;
  customTerms: string;
  onboardingFeePaymentLink: string;
  adminOverrideAllowDifferentSignerEmail?: boolean;
}

export interface ContractAcceptance {
  id: string;
  contractId: string;
  signerName: string;
  signerEmail: string;
  signatureImagePath: string;
  ipAddress: string;
  userAgent: string;
  acceptedAt: string;
  agreementCheckbox: true;
  contractVersion: string;
  signedPdfPath: string;
}

export interface AuditLog {
  id: string;
  contractId: string;
  eventType: string;
  actorType: AuditActorType;
  actorEmail: string | null;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface EmailRecord {
  id: string;
  contractId: string;
  recipientEmail: string;
  emailType: EmailType;
  providerMessageId: string | null;
  status: EmailStatus;
  errorMessage: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface PublicContractView {
  contractId: string;
  clientName: string;
  contractTextHtml: string;
  status: ContractStatus;
  clientEmail: string;
  onboardingFeePaymentLink: string | null;
  adminOverrideAllowDifferentSignerEmail: boolean;
}

export interface SignedContractSummaryData {
  signerName: string;
  signerEmail: string;
  acceptedAt: string;
  ipAddress: string;
  userAgent: string;
  signatureImageUrl: string | null;
}
