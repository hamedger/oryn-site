"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminGuard } from "@/components/AdminGuard";
import { ContractDetail } from "@/components/ContractDetail";
import { PdfViewer } from "@/components/PdfViewer";
import { api } from "@/lib/api";
import { formatCallableError } from "@/lib/apiErrors";
import { useAuthReady } from "@/lib/auth-context";
import { useContractId } from "@/lib/useResolvedRouteParam";
import type {
  Contract,
  ContractAcceptance,
  AuditLog,
  EmailRecord,
} from "@/lib/types";

export default function ContractDetailPage() {
  const params = useParams();
  const authReady = useAuthReady();
  const contractId = useContractId(params.contractId);
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
      setError(formatCallableError(err));
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    if (!authReady || !contractId || contractId === "_") return;
    load();
  }, [authReady, contractId, load]);

  async function handleAction(action: string) {
    setBusy(true);
    try {
      if (action === "send") {
        await api.sendContractEmail(contractId);
        await load();
        return;
      }
      if (action === "resend") {
        await api.resendContractEmail(contractId);
        await load();
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
        return;
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (!authReady || loading) {
    return (
      <AdminGuard>
        <main className="container page-center">
          <p className="muted">Loading…</p>
        </main>
      </AdminGuard>
    );
  }

  if (error || !contract) {
    return (
      <AdminGuard>
        <main className="container">
          <div className="alert alert-error">
            {error || "Could not load contract details."}
          </div>
          <p className="muted">
            Contract ID: {contractId || "unknown"}
          </p>
          <Link href="/admin/contracts" className="btn btn-secondary">
            Back
          </Link>
        </main>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <header className="site-header">
        <div className="header-inner">
          <Link href="/admin/contracts" className="brand">
            Oryn Contracts
          </Link>
        </div>
      </header>
      <main className="container">
        <div className="page-header">
          <Link href="/admin/contracts" className="btn btn-ghost">
            ← Back to list
          </Link>
        </div>
        <ContractDetail
          contract={contract}
          acceptance={acceptance}
          auditLogs={auditLogs}
          emails={emails}
          signatureImageUrl={signatureImageUrl}
          onAction={handleAction}
          busy={busy}
        />
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
      </main>
    </AdminGuard>
  );
}
