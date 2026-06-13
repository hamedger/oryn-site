"use client";

import { useCallback, useEffect, useState } from "react";
import { ContractDetail } from "@/components/ContractDetail";
import { ContractStatusBadge } from "@/components/ContractStatusBadge";
import { PdfViewer } from "@/components/PdfViewer";
import { api } from "@/lib/api";
import { formatCallableError } from "@/lib/apiErrors";
import { useAuthReady } from "@/lib/auth-context";
import type {
  Contract,
  ContractAcceptance,
  AuditLog,
  EmailRecord,
} from "@/lib/types";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

interface Props {
  contractId: string;
  listContract: Contract | null;
  onClose: () => void;
  onRefreshList: () => Promise<void>;
}

export function ContractDetailModal({
  contractId,
  listContract,
  onClose,
  onRefreshList,
}: Props) {
  const authReady = useAuthReady();
  const [contract, setContract] = useState<Contract | null>(null);
  const [acceptance, setAcceptance] = useState<ContractAcceptance | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [signatureImageUrl, setSignatureImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.getContractDetail(contractId);
      setContract(res.contract as Contract);
      setAcceptance(res.acceptance as ContractAcceptance | null);
      setAuditLogs(res.auditLogs as AuditLog[]);
      setEmails(res.emails as EmailRecord[]);
      setSignatureImageUrl(res.signatureImageUrl);
    } catch (err) {
      setContract(null);
      setError(formatCallableError(err));
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    if (!authReady || !contractId) return;
    load();
  }, [authReady, contractId, load]);

  async function handleAction(action: string) {
    setBusy(true);
    try {
      if (action === "send") {
        await api.sendContractEmail(contractId);
        await load();
        await onRefreshList();
        return;
      }
      if (action === "resend") {
        await api.resendContractEmail(contractId);
        await load();
        await onRefreshList();
        return;
      }
      if (action === "unsigned-pdf" || action === "signed-pdf") {
        const type = action === "signed-pdf" ? "signed" : "unsigned";
        const { url } = await api.getPdfDownloadUrl(contractId, type);
        setPdfUrl(url);
        return;
      }
      if (action === "download-signed") {
        const { url } = await api.getPdfDownloadUrl(contractId, "signed");
        const a = document.createElement("a");
        a.href = url;
        a.download = `oryn-contract-${contractId}.pdf`;
        a.click();
        return;
      }
      if (action === "email-client") {
        await api.emailSignedCopy(contractId, "client");
        alert("Signed copy emailed to client.");
        await load();
        return;
      }
      if (action === "email-admin") {
        await api.emailSignedCopy(contractId, "admin");
        alert("Signed copy emailed to admin.");
        await load();
        return;
      }
      if (action === "cancel") {
        if (!confirm("Cancel this contract?")) return;
        await api.cancelContract(contractId);
        await load();
        await onRefreshList();
      }
    } catch (err) {
      alert(formatCallableError(err));
    } finally {
      setBusy(false);
    }
  }

  const summary = listContract ?? contract;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-wide contract-detail-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>{summary?.clientName ?? "Contract details"}</h2>
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              ID: {contractId}
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="contract-detail-modal-body">
          {summary && (
            <div className="contract-list-summary">
              <div className="contract-list-summary-row">
                <ContractStatusBadge status={summary.status} />
                <span>{summary.clientEmail}</span>
              </div>
              <p className="muted" style={{ margin: "0.5rem 0 0" }}>
                {summary.sentAt
                  ? `Signing link sent ${fmtDate(summary.sentAt)} — this contract is on record.`
                  : summary.status === "draft"
                    ? "Draft — not sent to the client yet."
                    : "Contract is on record in your dashboard."}
                {summary.signedAt && ` Signed ${fmtDate(summary.signedAt)}.`}
              </p>
            </div>
          )}

          {loading && <p className="muted">Loading full details…</p>}

          {error && (
            <div className="alert alert-error">
              <strong>Could not load full details.</strong> {error}
              <div style={{ marginTop: "0.75rem" }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
                  Retry
                </button>
              </div>
            </div>
          )}

          {!loading && contract && (
            <ContractDetail
              contract={contract}
              acceptance={acceptance}
              auditLogs={auditLogs}
              emails={emails}
              signatureImageUrl={signatureImageUrl}
              onAction={handleAction}
              busy={busy}
            />
          )}

          {pdfUrl && (
            <section className="card">
              <div className="page-header">
                <h2>PDF Preview</h2>
                <button type="button" className="btn btn-ghost" onClick={() => setPdfUrl(null)}>
                  Close
                </button>
              </div>
              <PdfViewer url={pdfUrl} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
