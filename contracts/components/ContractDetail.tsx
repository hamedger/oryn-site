"use client";

import Link from "next/link";
import { useState } from "react";
import type {
  Contract,
  ContractAcceptance,
  AuditLog,
  EmailRecord,
} from "@/lib/types";
import { contractTextToHtml } from "@/lib/contractTemplate";
import { formatTermLabel } from "@/lib/termUtils";
import { ContractStatusBadge } from "./ContractStatusBadge";
import { ContractPreview } from "./ContractPreview";
import { SignedContractSummary } from "./SignedContractSummary";
import { AuditTimeline } from "./AuditTimeline";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

interface Props {
  contract: Contract;
  acceptance: ContractAcceptance | null;
  auditLogs: AuditLog[];
  emails: EmailRecord[];
  signatureImageUrl: string | null;
  onAction: (action: string) => void;
  busy?: boolean;
}

export function ContractDetail({
  contract,
  acceptance,
  auditLogs,
  emails,
  signatureImageUrl,
  onAction,
  busy,
}: Props) {
  const [showContractText, setShowContractText] = useState(false);
  const isSigned = contract.status === "signed";
  const isDraft = contract.status === "draft";
  const canCancel = !isSigned && contract.status !== "cancelled";

  return (
    <div className="contract-detail">
      <div className="detail-header">
        <div>
          <h1>{contract.clientName}</h1>
          <p className="muted">Contract ID: {contract.id}</p>
        </div>
        <ContractStatusBadge status={contract.status} />
      </div>

      <section className="card">
        <h2>Contract Details</h2>
        <dl className="detail-grid">
          <div><dt>Client name</dt><dd>{contract.clientName}</dd></div>
          <div><dt>Client email</dt><dd>{contract.clientEmail}</dd></div>
          <div className="full-width"><dt>Client address</dt><dd>{contract.clientAddress || "—"}</dd></div>
          <div className="full-width"><dt>Project description</dt><dd>{contract.projectDescription}</dd></div>
          <div><dt>Onboarding fee</dt><dd>{fmtMoney(contract.onboardingFee)}</dd></div>
          <div><dt>Monthly fee</dt><dd>{fmtMoney(contract.monthlyFee)}</dd></div>
          <div><dt>Term</dt><dd>{formatTermLabel(contract.termMonths)}</dd></div>
          <div><dt>Start date</dt><dd>{contract.startDate}</dd></div>
          {contract.onboardingFeePaymentLink && (
            <div className="full-width">
              <dt>Stripe payment link</dt>
              <dd>
                <a href={contract.onboardingFeePaymentLink} target="_blank" rel="noopener noreferrer">
                  {contract.onboardingFeePaymentLink}
                </a>
              </dd>
            </div>
          )}
          {contract.customTerms && (
            <div className="full-width"><dt>Custom terms</dt><dd>{contract.customTerms}</dd></div>
          )}
          <div><dt>Created</dt><dd>{fmtDate(contract.createdAt)}</dd></div>
          <div><dt>Sent</dt><dd>{fmtDate(contract.sentAt)}</dd></div>
          <div><dt>Viewed</dt><dd>{fmtDate(contract.viewedAt)}</dd></div>
          <div><dt>Signed</dt><dd>{fmtDate(contract.signedAt)}</dd></div>
          {contract.originalContractId && (
            <div className="full-width">
              <dt>Renewed from</dt>
              <dd>
                <Link href={`/admin/contracts/${contract.originalContractId}`}>
                  {contract.originalContractId}
                </Link>
              </dd>
            </div>
          )}
        </dl>
      </section>

      {contract.contractText && (
        <section className="card">
          <h2>Statement of Work</h2>
          <p className="muted">Full contract text sent to the client.</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowContractText(true)}
          >
            View Contract Text
          </button>
        </section>
      )}

      {showContractText && (
        <ContractPreview
          html={contractTextToHtml(contract.contractText)}
          onClose={() => setShowContractText(false)}
        />
      )}

      {isSigned && acceptance && (
        <SignedContractSummary
          acceptance={acceptance}
          signatureImageUrl={signatureImageUrl}
        />
      )}

      <section className="card">
        <h2>Actions</h2>
        <div className="action-bar">
          {contract.unsignedPdfPath && (
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => onAction("unsigned-pdf")}>
              View Unsigned PDF
            </button>
          )}
          {isSigned && (
            <>
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => onAction("signed-pdf")}>
                View Signed PDF
              </button>
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => onAction("download-signed")}>
                Download Signed PDF
              </button>
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => onAction("email-client")}>
                Email Copy to Client
              </button>
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => onAction("email-admin")}>
                Email Copy to Admin
              </button>
              <Link href={`/admin/contracts/${contract.id}/renew`} className="btn btn-secondary">
                Renew Contract
              </Link>
            </>
          )}
          {!isSigned && contract.status !== "cancelled" && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => onAction(contract.sentAt ? "resend" : "send")}
            >
              {contract.sentAt ? "Resend Signing Link" : "Send Contract"}
            </button>
          )}
          {isDraft && (
            <Link href={`/admin/contracts/${contract.id}/edit`} className="btn btn-secondary">
              Edit Draft
            </Link>
          )}
          {canCancel && (
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => onAction("cancel")}>
              Cancel Contract
            </button>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Email History</h2>
        {emails.length === 0 ? (
          <p className="muted">No emails sent yet.</p>
        ) : (
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Type</th>
                <th>Recipient</th>
                <th>Status</th>
                <th>Sent</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((e) => (
                <tr key={e.id}>
                  <td>{e.emailType}</td>
                  <td>{e.recipientEmail}</td>
                  <td>{e.status}</td>
                  <td>{fmtDate(e.sentAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <AuditTimeline logs={auditLogs} />
    </div>
  );
}
