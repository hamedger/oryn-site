"use client";

import { useState } from "react";
import type { ContractFormData } from "@/lib/types";
import {
  TERM_PRESET_MONTHS,
  termMonthsToSelectValue,
  selectValueToTermMonths,
} from "@/lib/termUtils";

const emptyForm: ContractFormData = {
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

interface Props {
  initial?: Partial<ContractFormData>;
  onChange?: (data: ContractFormData) => void;
  onSubmit?: (data: ContractFormData) => void;
  onPreview?: (data: ContractFormData) => void;
  onGenerateSend?: (data: ContractFormData) => void;
  readOnly?: boolean;
  showActions?: boolean;
  submitLabel?: string;
  loading?: boolean;
}

export function ContractForm({
  initial,
  onChange,
  onSubmit,
  onPreview,
  onGenerateSend,
  readOnly = false,
  showActions = true,
  submitLabel = "Save Draft",
  loading = false,
}: Props) {
  const [form, setForm] = useState<ContractFormData>({
    ...emptyForm,
    ...initial,
  });
  const [termSelect, setTermSelect] = useState(() =>
    termMonthsToSelectValue(initial?.termMonths ?? emptyForm.termMonths)
  );
  const [customTermMonths, setCustomTermMonths] = useState(() => {
    const t = initial?.termMonths;
    if (t && t > 0) return t;
    return 12;
  });

  function emitChange(
    next: ContractFormData,
    nextTermSelect = termSelect,
    nextCustomMonths = customTermMonths
  ) {
    onChange?.({
      ...next,
      termMonths: selectValueToTermMonths(nextTermSelect, nextCustomMonths),
    });
  }

  function update(field: keyof ContractFormData, value: string | number | boolean | null) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      emitChange(next);
      return next;
    });
  }

  function updateTermSelect(value: string) {
    setTermSelect(value);
    setForm((prev) => {
      const next = {
        ...prev,
        termMonths: selectValueToTermMonths(value, customTermMonths),
      };
      emitChange(next, value);
      return next;
    });
  }

  function updateCustomTermMonths(months: number) {
    setCustomTermMonths(months);
    if (termSelect === "custom") {
      setForm((prev) => {
        const next = { ...prev, termMonths: months >= 1 ? months : 1 };
        emitChange(next, termSelect, months);
        return next;
      });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit?.({
      ...form,
      termMonths: selectValueToTermMonths(termSelect, customTermMonths),
    });
  }

  function formWithTerm(): ContractFormData {
    return {
      ...form,
      termMonths: selectValueToTermMonths(termSelect, customTermMonths),
    };
  }

  return (
    <form className="contract-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          Client Name *
          <input
            required
            disabled={readOnly}
            value={form.clientName}
            onChange={(e) => update("clientName", e.target.value)}
          />
        </label>
        <label>
          Client Email *
          <input
            type="email"
            required
            disabled={readOnly}
            value={form.clientEmail}
            onChange={(e) => update("clientEmail", e.target.value)}
          />
        </label>
        <label className="full-width">
          Client Address
          <input
            disabled={readOnly}
            value={form.clientAddress}
            onChange={(e) => update("clientAddress", e.target.value)}
          />
        </label>
        <label className="full-width">
          Project Description *
          <textarea
            required
            rows={6}
            disabled={readOnly}
            value={form.projectDescription}
            onChange={(e) => update("projectDescription", e.target.value)}
          />
        </label>
        <label>
          Onboarding Fee ($) *
          <input
            type="number"
            min={0}
            step="0.01"
            required
            disabled={readOnly}
            value={form.onboardingFee}
            onChange={(e) => update("onboardingFee", parseFloat(e.target.value) || 0)}
          />
        </label>
        <label>
          Monthly Fee ($) *
          <input
            type="number"
            min={0}
            step="0.01"
            required
            disabled={readOnly}
            value={form.monthlyFee}
            onChange={(e) => update("monthlyFee", parseFloat(e.target.value) || 0)}
          />
        </label>
        <label>
          Term *
          <select
            required
            disabled={readOnly}
            value={termSelect}
            onChange={(e) => updateTermSelect(e.target.value)}
          >
            <option value="no-end">No End</option>
            {TERM_PRESET_MONTHS.map((m) => (
              <option key={m} value={String(m)}>
                {m === 1 ? "1 month" : `${m} months`}
              </option>
            ))}
            <option value="custom">Other (custom months)</option>
          </select>
          {termSelect === "custom" && (
            <input
              type="number"
              min={1}
              disabled={readOnly}
              value={customTermMonths}
              onChange={(e) => updateCustomTermMonths(parseInt(e.target.value, 10) || 1)}
              style={{ marginTop: "0.5rem" }}
              placeholder="Enter months"
            />
          )}
        </label>
        <label>
          Start Date *
          <input
            type="date"
            required
            disabled={readOnly}
            value={form.startDate}
            onChange={(e) => update("startDate", e.target.value)}
          />
        </label>
        <label className="full-width">
          Stripe Onboarding Fee Payment Link
          <input
            type="url"
            placeholder="https://buy.stripe.com/..."
            disabled={readOnly}
            value={form.onboardingFeePaymentLink}
            onChange={(e) => update("onboardingFeePaymentLink", e.target.value)}
          />
          <span className="field-hint">
            Paste a Stripe Payment Link for the one-time onboarding fee.
          </span>
        </label>
        <label className="full-width">
          Stripe Monthly Fee Payment Link
          <input
            type="url"
            placeholder="https://buy.stripe.com/..."
            disabled={readOnly}
            value={form.monthlyFeePaymentLink}
            onChange={(e) => update("monthlyFeePaymentLink", e.target.value)}
          />
          <span className="field-hint">
            Paste a Stripe Payment Link for the recurring monthly fee.
          </span>
        </label>
        <label className="full-width">
          Custom Terms (optional)
          <textarea
            rows={3}
            disabled={readOnly}
            value={form.customTerms}
            onChange={(e) => update("customTerms", e.target.value)}
          />
        </label>
        <label className="checkbox-label full-width">
          <input
            type="checkbox"
            disabled={readOnly}
            checked={form.adminOverrideAllowDifferentSignerEmail ?? false}
            onChange={(e) =>
              update("adminOverrideAllowDifferentSignerEmail", e.target.checked)
            }
          />
          Allow signer email to differ from client email
        </label>
      </div>

      {showActions && !readOnly && (
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading}
            onClick={() => onPreview?.(formWithTerm())}
          >
            Preview Contract
          </button>
          {onSubmit && (
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Saving…" : submitLabel}
            </button>
          )}
          {onGenerateSend && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={loading}
              onClick={() => onGenerateSend(formWithTerm())}
            >
              Generate &amp; Send Contract
            </button>
          )}
        </div>
      )}
    </form>
  );
}
