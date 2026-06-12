"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminGuard } from "@/components/AdminGuard";
import { ContractForm } from "@/components/ContractForm";
import { ContractPreview } from "@/components/ContractPreview";
import { api } from "@/lib/api";
import type { ContractFormData } from "@/lib/types";

export default function NewContractPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handlePreview(data: ContractFormData) {
    try {
      const res = await api.previewContract(data);
      setPreviewHtml(res.contractTextHtml);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    }
  }

  async function saveDraft(data: ContractFormData) {
    setLoading(true);
    setError("");
    try {
      const res = await api.createContract(data);
      router.push(`/admin/contracts/${res.contractId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  async function generateAndSend(data: ContractFormData) {
    if (!confirm("Generate contract and email signing link to client?")) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.createContract({ ...data, send: true });
      router.push(`/admin/contracts/${res.contractId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setLoading(false);
    }
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
          <h1>New Contract</h1>
          <Link href="/admin/contracts" className="btn btn-ghost">
            Back
          </Link>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <section className="card">
          <ContractForm
            onPreview={handlePreview}
            onSubmit={saveDraft}
            onGenerateSend={generateAndSend}
            loading={loading}
            submitLabel="Save Draft"
          />
        </section>
        {previewHtml && (
          <ContractPreview html={previewHtml} onClose={() => setPreviewHtml(null)} />
        )}
      </main>
    </AdminGuard>
  );
}
