import { Resend } from "resend";
import {
  createEmailRecord,
  markEmailSent,
  markEmailFailed,
} from "../utils/audit";
import { getSignedDownloadUrl } from "../pdf/generator";
import { getStorage } from "firebase-admin/storage";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const fromEmail = () =>
  process.env.EMAIL_FROM || "Oryn Inc. <contracts@orynsolutions.io>";

const adminNotifyEmail = () =>
  process.env.ADMIN_NOTIFY_EMAIL || "hamed@orynsolutions.io";

export async function sendSigningLinkEmail(params: {
  contractId: string;
  recipientEmail: string;
  clientName: string;
  signingUrl: string;
  onboardingFeePaymentLink?: string | null;
  isResend?: boolean;
}): Promise<void> {
  const emailType = params.isResend ? "resend_signing_link" : "signing_link";
  const emailId = await createEmailRecord({
    contractId: params.contractId,
    recipientEmail: params.recipientEmail,
    emailType,
  });

  const resend = getResend();
  if (!resend) {
    await markEmailFailed(emailId, "RESEND_API_KEY not configured");
    return;
  }

  const paymentSection = params.onboardingFeePaymentLink
    ? `<p>When you're ready, you can pay the onboarding fee securely here:<br/>
       <a href="${params.onboardingFeePaymentLink}">Pay Onboarding Fee</a></p>`
    : "";

  const html = `
    <p>Hello ${params.clientName},</p>
    <p>Your service agreement from Oryn Inc. is ready for review and electronic signature.</p>
    <p><a href="${params.signingUrl}" style="display:inline-block;padding:12px 24px;background:#1d3557;color:#fff;text-decoration:none;border-radius:6px;">Review &amp; Sign Agreement</a></p>
    ${paymentSection}
    <p>This link is secure and unique to you. If you have questions, reply to this email or contact us at support@orynsolutions.io.</p>
    <p>— Oryn Inc.</p>
  `;

  try {
    const result = await resend.emails.send({
      from: fromEmail(),
      to: params.recipientEmail,
      subject: "Your Oryn Service Agreement — Please Review & Sign",
      html,
    });
    await markEmailSent(emailId, result.data?.id ?? null);
  } catch (err) {
    await markEmailFailed(
      emailId,
      err instanceof Error ? err.message : "Send failed"
    );
    throw err;
  }
}

export async function sendSignedCopyEmails(params: {
  contractId: string;
  clientEmail: string;
  clientName: string;
  signedPdfPath: string;
  recipient?: "client" | "admin" | "both";
}): Promise<void> {
  const recipients: Array<{ email: string; type: "signed_copy" | "admin_notification" }> = [];

  if (!params.recipient || params.recipient === "client" || params.recipient === "both") {
    recipients.push({ email: params.clientEmail, type: "signed_copy" });
  }
  if (!params.recipient || params.recipient === "admin" || params.recipient === "both") {
    recipients.push({ email: adminNotifyEmail(), type: "admin_notification" });
  }

  const downloadUrl = await getSignedDownloadUrl(params.signedPdfPath, 60 * 24 * 7);
  const bucket = getStorage().bucket();
  const file = bucket.file(params.signedPdfPath);
  const [pdfBuffer] = await file.download();

  const resend = getResend();
  if (!resend) {
    for (const r of recipients) {
      const emailId = await createEmailRecord({
        contractId: params.contractId,
        recipientEmail: r.email,
        emailType: r.type,
      });
      await markEmailFailed(emailId, "RESEND_API_KEY not configured");
    }
    return;
  }

  for (const r of recipients) {
    const emailId = await createEmailRecord({
      contractId: params.contractId,
      recipientEmail: r.email,
      emailType: r.type,
    });

    const isAdmin = r.type === "admin_notification";
    const html = `
      <p>${isAdmin ? "A contract has been signed." : `Hello ${params.clientName},`}</p>
      <p>${isAdmin ? `Contract ${params.contractId} was electronically signed by ${params.clientName}.` : "Thank you for signing your Oryn service agreement. A copy is attached and available via the secure link below."}</p>
      <p><a href="${downloadUrl}">Download Signed Agreement (secure link, expires in 7 days)</a></p>
      <p>— Oryn Inc.</p>
    `;

    try {
      const result = await resend.emails.send({
        from: fromEmail(),
        to: r.email,
        subject: isAdmin
          ? `Contract Signed: ${params.clientName}`
          : "Your Signed Oryn Service Agreement",
        html,
        attachments: [
          {
            filename: `oryn-agreement-${params.contractId}.pdf`,
            content: pdfBuffer,
          },
        ],
      });
      await markEmailSent(emailId, result.data?.id ?? null);
    } catch (err) {
      await markEmailFailed(
        emailId,
        err instanceof Error ? err.message : "Send failed"
      );
      if (!isAdmin) throw err;
    }
  }
}
