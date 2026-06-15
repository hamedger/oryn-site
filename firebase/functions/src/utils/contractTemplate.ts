export const CONTRACT_TEMPLATE = `SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into between {{CLIENT_NAME}} ("Client"), located at {{CLIENT_ADDRESS}}, and Oryn Inc. ("Oryn"), located at 27984 Hummingdale Cr, Novi, Michigan 48377.

1. SERVICES

Oryn will design, develop, host, maintain, and support the website, booking platform, and related digital services described as: {{PROJECT_DESCRIPTION}}. Client shall provide all required content, business information, approvals, and domain access necessary for project completion.

2. FEES AND TERM

{{FEES_AND_TERM_BODY}}

3. OWNERSHIP AND INTELLECTUAL PROPERTY

Unless otherwise agreed in writing, Oryn retains ownership of all software, source code, designs, templates, workflows, databases, systems, custom integrations, and related intellectual property developed or used under this Agreement.

If Client pays the one-time onboarding fee and maintains services for a continuous twelve (12) month maintenance period, Oryn will transfer ownership of the website files and domain, if managed by Oryn, to Client upon written request, provided all outstanding balances have been paid in full.

If no one-time onboarding fee is paid and services are provided solely under a maintenance subscription model, ownership of the website, software, source code, and related intellectual property remains exclusively with Oryn. Upon termination and payment of all outstanding balances, Client receives control of the domain name only, if managed by Oryn.

Any BookAPT software, mobile applications, booking systems, APIs, workflows, source code, and related intellectual property remain the exclusive property of Oryn Inc. and are licensed to Client solely for use during the term of this Agreement.

Third-party software, licenses, hosting services, and platforms remain subject to their respective provider terms.

4. LIMITATION OF LIABILITY

Oryn shall not be liable for indirect, incidental, special, consequential, lost profit, lost data, or business interruption damages. Oryn's total liability under this Agreement shall not exceed the total fees paid by Client during the six (6) months immediately preceding the claim.

5. GENERAL TERMS

This Agreement constitutes the entire agreement between the parties and supersedes all prior discussions. Any modification must be in writing and signed by both parties. This Agreement shall be governed by the laws of the State of Michigan. Any dispute arising from this Agreement shall be resolved in the state or federal courts located in Oakland County, Michigan.

{{CUSTOM_TERMS}}

AUTHORIZED SIGNATURES

Client: {{SIGNER_NAME}}
Date: {{SIGNED_DATE}}

Oryn Inc.: Hamed Mohammed
Date: {{ORYN_SIGNED_DATE}}`;

export const CONTRACT_VERSION = "1.0.0";

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
  monthlyFeePaymentLink?: string;
  adminOverrideAllowDifferentSignerEmail?: boolean;
}

export interface TemplateVars {
  clientName: string;
  clientAddress: string;
  projectDescription: string;
  onboardingFee: number;
  monthlyFee: number;
  termMonths: number | null;
  startDate: string;
  customTerms?: string;
  signerName?: string;
  signedDate?: string;
  orynSignedDate?: string;
}

function buildFeesAndTermBody(vars: TemplateVars): string {
  const fees = `Client agrees to pay a one-time onboarding fee of $${vars.onboardingFee.toFixed(2)}, due at project kickoff, and a monthly maintenance and support fee of $${vars.monthlyFee.toFixed(2)} per month.`;

  if (vars.termMonths === null) {
    return `${fees} Services begin on ${sanitizePlainText(vars.startDate)} and continue month-to-month with no fixed end date.

Monthly fees are due regardless of website usage. Either party may terminate this Agreement with thirty (30) days written notice.`;
  }

  const months = vars.termMonths;
  return `${fees} The initial term is ${months} month${months === 1 ? "" : "s"} beginning on ${sanitizePlainText(vars.startDate)}.

Monthly fees are due regardless of website usage. If Client terminates this Agreement before the end of the initial term, all remaining fees for the initial term become immediately due and payable. After the initial term, this Agreement continues month-to-month unless terminated by either party with thirty (30) days written notice.`;
}

export function renderContractText(vars: TemplateVars): string {
  const customBlock = vars.customTerms?.trim()
    ? `\n${vars.customTerms.trim()}\n`
    : "";

  return CONTRACT_TEMPLATE.replace(/\{\{CLIENT_NAME\}\}/g, sanitizePlainText(vars.clientName))
    .replace(/\{\{CLIENT_ADDRESS\}\}/g, sanitizePlainText(vars.clientAddress))
    .replace(/\{\{PROJECT_DESCRIPTION\}\}/g, sanitizePlainText(vars.projectDescription))
    .replace(/\{\{FEES_AND_TERM_BODY\}\}/g, buildFeesAndTermBody(vars))
    .replace(/\{\{CUSTOM_TERMS\}\}/g, customBlock ? sanitizePlainText(customBlock) : "")
    .replace(/\{\{SIGNER_NAME\}\}/g, vars.signerName ? sanitizePlainText(vars.signerName) : "_________________________")
    .replace(/\{\{SIGNED_DATE\}\}/g, vars.signedDate ? sanitizePlainText(vars.signedDate) : "_________________________")
    .replace(/\{\{ORYN_SIGNED_DATE\}\}/g, vars.orynSignedDate ? sanitizePlainText(vars.orynSignedDate) : "_________________________");
}

/** Strip HTML tags and control chars before rendering contract fields. */
export function sanitizePlainText(value: string): string {
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/<[^>]*>/g, "")
    .trim();
}

const CONTRACT_LOGO_HTML =
  '<div class="contract-logo"><img src="/oryn-logo.png" alt="Oryn Inc." width="96" height="96" /></div>';

export function contractTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const body = escaped
    .split("\n\n")
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  return `${CONTRACT_LOGO_HTML}${body}`;
}

export function validateContractInput(input: ContractFormInput | Record<string, unknown>): string | null {
  const email = String(input.clientEmail || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Invalid client email";

  const onboardingFee = Number(input.onboardingFee);
  const monthlyFee = Number(input.monthlyFee);
  const termRaw = input.termMonths;
  const termMonths =
    termRaw === null || termRaw === undefined || termRaw === "no-end"
      ? null
      : Number(termRaw);
  if (Number.isNaN(onboardingFee) || onboardingFee < 0) return "Invalid onboarding fee";
  if (Number.isNaN(monthlyFee) || monthlyFee < 0) return "Invalid monthly fee";
  if (termMonths !== null && (!Number.isInteger(termMonths) || termMonths < 1)) {
    return "Invalid term months";
  }

  const onboardingLink = input.onboardingFeePaymentLink
    ? String(input.onboardingFeePaymentLink)
    : "";
  if (onboardingLink && !/^https:\/\/[^\s]+$/i.test(onboardingLink)) {
    return "Onboarding fee payment link must be a valid HTTPS URL";
  }

  const monthlyLink = input.monthlyFeePaymentLink
    ? String(input.monthlyFeePaymentLink)
    : "";
  if (monthlyLink && !/^https:\/\/[^\s]+$/i.test(monthlyLink)) {
    return "Monthly fee payment link must be a valid HTTPS URL";
  }

  if (!String(input.clientName || "").trim()) return "Client name is required";
  if (!String(input.projectDescription || "").trim()) return "Project description is required";
  if (!String(input.startDate || "").trim()) return "Start date is required";

  return null;
}
