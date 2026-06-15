"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminGuard } from "@/components/AdminGuard";
import { ContractForm } from "@/components/ContractForm";
import { ContractPreview } from "@/components/ContractPreview";
import { ContractTemplatePanel } from "@/components/ContractTemplatePanel";
import { api } from "@/lib/api";
import type { ContractFormData } from "@/lib/types";

const emptyClientFields: ContractFormData = {
  clientName: "",
  clientAddress: "",
  clientEmail: "",
  projectDescription: "",
  onboardingFee: 0,
  monthlyFee: 0,
  termMonths: 12,
  startDate: new Date().toISOString().slice(0, 10),
  customTerms: "",
  onboardingFeePaymentLink: "",
  monthlyFeePaymentLink: "",
  adminOverrideAllowDifferentSignerEmail: false,
};

export default function NewContractPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [formSeed, setFormSeed] = useState<ContractFormData>(emptyClientFields);
  const [formKey, setFormKey] = useState(0);
  const [draftForm, setDraftForm] = useState<ContractFormData>(emptyClientFields);

  function applyTemplate(fields: Partial<ContractFormData>) {
    const next = {
      ...emptyClientFields,
      ...fields,
      clientName: formSeed.clientName,
      clientAddress: formSeed.clientAddress,
      clientEmail: formSeed.clientEmail,
      startDate: new Date().toISOString().slice(0, 10),
    };
    setFormSeed(next);
    setDraftForm(next);
    setFormKey((k) => k + 1);
  }

  function syncDraftForm(data: ContractFormData) {
    setDraftForm(data);
    setFormSeed((prev) => ({
      ...data,
      clientName: data.clientName || prev.clientName,
      clientAddress: data.clientAddress || prev.clientAddress,
      clientEmail: data.clientEmail || prev.clientEmail,
    }));
  }

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
      router.push(`/admin/contracts/?detail=${encodeURIComponent(res.contractId)}`);
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
      router.push(`/admin/contracts/?detail=${encodeURIComponent(res.contractId)}`);
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
        <ContractTemplatePanel formData={draftForm} onApply={applyTemplate} />
        <section className="card">
          <ContractForm
            key={formKey}
            initial={formSeed}
            onChange={syncDraftForm}
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
