"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ContractFormData, ContractTemplate } from "@/lib/types";

type TemplateFields = Pick<
  ContractFormData,
  | "projectDescription"
  | "onboardingFee"
  | "monthlyFee"
  | "termMonths"
  | "customTerms"
  | "onboardingFeePaymentLink"
  | "monthlyFeePaymentLink"
  | "adminOverrideAllowDifferentSignerEmail"
>;

interface Props {
  formData: ContractFormData;
  onApply: (fields: TemplateFields) => void;
}

export function ContractTemplatePanel({ formData, onApply }: Props) {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.listContractTemplates();
      setTemplates(res.templates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  function templateFields(data: ContractFormData): TemplateFields {
    return {
      projectDescription: data.projectDescription,
      onboardingFee: data.onboardingFee,
      monthlyFee: data.monthlyFee,
      termMonths: data.termMonths,
      customTerms: data.customTerms,
      onboardingFeePaymentLink: data.onboardingFeePaymentLink,
      monthlyFeePaymentLink: data.monthlyFeePaymentLink,
      adminOverrideAllowDifferentSignerEmail:
        data.adminOverrideAllowDifferentSignerEmail ?? false,
    };
  }

  async function handleApply() {
    const template = templates.find((t) => t.id === selectedId);
    if (!template) return;
    onApply({
      projectDescription: template.projectDescription,
      onboardingFee: template.onboardingFee,
      monthlyFee: template.monthlyFee,
      termMonths: template.termMonths,
      customTerms: template.customTerms,
      onboardingFeePaymentLink: template.onboardingFeePaymentLink,
      monthlyFeePaymentLink: template.monthlyFeePaymentLink ?? "",
      adminOverrideAllowDifferentSignerEmail:
        template.adminOverrideAllowDifferentSignerEmail,
    });
    setMessage(`Loaded template "${template.name}". Update client details and send.`);
    setError("");
  }

  async function handleSave() {
    const name = window.prompt("Template name (e.g. Standard website SOW):");
    if (!name?.trim()) return;

    setBusy(true);
    setMessage("");
    setError("");
    try {
      const res = await api.saveContractTemplate({
        templateId: selectedId || undefined,
        name: name.trim(),
        description: "",
        ...templateFields(formData),
        adminOverrideAllowDifferentSignerEmail:
          formData.adminOverrideAllowDifferentSignerEmail ?? false,
      });
      await loadTemplates();
      setSelectedId(res.templateId);
      setMessage(`Saved template "${res.template.name}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!selectedId) return;
    const template = templates.find((t) => t.id === selectedId);
    if (!template) return;
    if (!confirm(`Delete template "${template.name}"?`)) return;

    setBusy(true);
    setMessage("");
    setError("");
    try {
      await api.deleteContractTemplate(selectedId);
      setSelectedId("");
      await loadTemplates();
      setMessage(`Deleted template "${template.name}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card template-panel">
      <h2>Contract Templates</h2>
      <p className="muted">
        Save statement-of-work presets (project description, fees, terms) and reuse them for new clients.
      </p>

      {loading ? (
        <p className="muted">Loading templates…</p>
      ) : (
        <div className="template-toolbar">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="template-select"
          >
            <option value="">Select a template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!selectedId || busy}
            onClick={handleApply}
          >
            Load Template
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy || !formData.projectDescription.trim()}
            onClick={handleSave}
          >
            {selectedId ? "Update Template" : "Save as Template"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-danger"
            disabled={!selectedId || busy}
            onClick={handleDelete}
          >
            Delete
          </button>
        </div>
      )}

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}
    </section>
  );
}
