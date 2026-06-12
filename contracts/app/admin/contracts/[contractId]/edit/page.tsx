"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminGuard } from "@/components/AdminGuard";
import { ContractForm } from "@/components/ContractForm";
import { ContractPreview } from "@/components/ContractPreview";
import { api } from "@/lib/api";
import type { Contract, ContractFormData } from "@/lib/types";

export default function EditContractPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = String(params.contractId);
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getContractDetail(contractId).then((res) => {
      const c = res.contract as Contract;
      if (c.status !== "draft") {
        router.replace(`/admin/contracts/${contractId}`);
        return;
      }
      setContract(c);
      setLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load");
      setLoading(false);
    });
  }, [contractId, router]);

  async function handleSave(data: ContractFormData) {
    setSaving(true);
    setError("");
    try {
      await api.updateDraftContract(contractId, data);
      router.push(`/admin/contracts/${contractId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview(data: ContractFormData) {
    try {
      const res = await api.previewContract(data);
      setPreviewHtml(res.contractTextHtml);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    }
  }

  if (loading) {
    return (
      <AdminGuard>
        <main className="container page-center"><p className="muted">Loading…</p></main>
      </AdminGuard>
    );
  }

  if (!contract) {
    return (
      <AdminGuard>
        <main className="container"><div className="alert alert-error">{error}</div></main>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <header className="site-header">
        <div className="header-inner">
          <Link href={`/admin/contracts/${contractId}`} className="brand">
            Oryn Contracts
          </Link>
        </div>
      </header>
      <main className="container">
        <div className="page-header">
          <h1>Edit Draft</h1>
          <Link href={`/admin/contracts/${contractId}`} className="btn btn-ghost">
            Cancel
          </Link>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <section className="card">
          <ContractForm
            initial={{
              ...contract,
              onboardingFeePaymentLink: contract.onboardingFeePaymentLink || "",
            }}
            onSubmit={handleSave}
            onPreview={handlePreview}
            loading={saving}
            submitLabel="Save Changes"
          />
        </section>
        {previewHtml && (
          <ContractPreview html={previewHtml} onClose={() => setPreviewHtml(null)} />
        )}
      </main>
    </AdminGuard>
  );
}
