"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SignaturePad } from "@/components/SignaturePad";
import { api } from "@/lib/api";
import { resolveRouteParam } from "@/lib/routeParams";
import type { PublicContractView } from "@/lib/types";

export default function SignContractPage() {
  const params = useParams();
  const token = resolveRouteParam(params.token, 1);
  const [contract, setContract] = useState<PublicContractView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [agreement, setAgreement] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.getContractByToken(token)
      .then((data) => {
        setContract(data as PublicContractView);
        setSignerEmail(data.clientEmail);
      })
      .catch((err) => {
        setError(
          err?.message ||
            "This signing link is invalid, expired, or no longer available."
        );
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signature) {
      setError("Please draw your signature.");
      return;
    }
    if (!agreement) {
      setError("You must agree to the terms.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await api.acceptContract({
        token,
        signerName,
        signerEmail,
        signatureDataUrl: signature,
        agreementCheckbox: agreement,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signing failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="container page-center">
        <p className="muted">Loading agreement…</p>
      </main>
    );
  }

  if (success) {
    return (
      <main className="container sign-page">
        <div className="alert alert-success">
          <h2>Thank you!</h2>
          <p>
            Your agreement has been signed successfully. A copy will be emailed to you shortly.
          </p>
        </div>
      </main>
    );
  }

  if (error && !contract) {
    return (
      <main className="container sign-page">
        <div className="alert alert-error">{error}</div>
      </main>
    );
  }

  if (!contract) return null;

  return (
    <main className="container sign-page">
      <header style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1 style={{ color: "var(--color-primary)" }}>Oryn Inc.</h1>
        <p className="muted">Service Agreement for {contract.clientName}</p>
      </header>

      {contract.onboardingFeePaymentLink && (
        <div className="payment-banner">
          <strong>Onboarding Fee Payment</strong>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            You can pay the one-time onboarding fee securely via Stripe before or after signing.
          </p>
          <a
            href={contract.onboardingFeePaymentLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            Pay Onboarding Fee
          </a>
        </div>
      )}

      <div
        className="sign-contract-body"
        dangerouslySetInnerHTML={{ __html: contract.contractTextHtml }}
      />

      {error && <div className="alert alert-error">{error}</div>}

      <form className="card" onSubmit={handleSubmit}>
        <h2>Electronic Signature</h2>
        <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
          <label>
            Full Legal Name *
            <input
              required
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
            />
          </label>
          <label>
            Email Address *
            <input
              type="email"
              required
              value={signerEmail}
              onChange={(e) => setSignerEmail(e.target.value)}
              readOnly={!contract.adminOverrideAllowDifferentSignerEmail}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              required
              checked={agreement}
              onChange={(e) => setAgreement(e.target.checked)}
            />
            I have read and agree to the terms of this Service Agreement. I understand that my
            electronic signature is legally binding.
          </label>
          <div>
            <span className="label" style={{ fontWeight: 500, fontSize: "0.9rem" }}>
              Draw your signature *
            </span>
            <SignaturePad onChange={setSignature} />
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Submitting…" : "Sign Agreement"}
          </button>
        </div>
      </form>
    </main>
  );
}
