"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatCallableError } from "@/lib/apiErrors";
import { buildSigningSmsMessage, copyText } from "@/lib/signingLink";

interface Props {
  contractId: string;
  clientName: string;
  /** Show when contract is out for signature (sent/viewed, not signed/cancelled). */
  active: boolean;
}

export function SigningLinkPanel({ contractId, clientName, active }: Props) {
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"link" | "sms" | null>(null);

  const load = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    setError("");
    try {
      const { signingUrl: url } = await api.getContractSigningLink(contractId);
      setSigningUrl(url);
    } catch (err) {
      setSigningUrl(null);
      setError(formatCallableError(err));
    } finally {
      setLoading(false);
    }
  }, [active, contractId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCopyLink() {
    if (!signingUrl) return;
    const ok = await copyText(signingUrl);
    if (ok) {
      setCopied("link");
      setTimeout(() => setCopied(null), 2000);
    }
  }

  async function handleCopySms() {
    if (!signingUrl) return;
    const ok = await copyText(buildSigningSmsMessage(clientName, signingUrl));
    if (ok) {
      setCopied("sms");
      setTimeout(() => setCopied(null), 2000);
    }
  }

  if (!active) return null;

  return (
    <section className="card signing-link-panel">
      <h2>Client Signing Link</h2>
      <p className="muted">
        Send this link by text or email. Your client can review and sign on their phone.
      </p>

      {loading && <p className="muted">Loading signing link…</p>}

      {error && (
        <div className="alert alert-error">
          {error}
          <div style={{ marginTop: "0.5rem" }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
              Retry
            </button>
          </div>
        </div>
      )}

      {signingUrl && (
        <>
          <div className="signing-link-box">
            <input type="text" readOnly value={signingUrl} className="signing-link-input" />
          </div>
          <div className="action-bar">
            <button type="button" className="btn btn-primary btn-sm" onClick={handleCopyLink}>
              {copied === "link" ? "Copied!" : "Copy Link"}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopySms}>
              {copied === "sms" ? "Copied!" : "Copy Text Message"}
            </button>
            <a
              href={signingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm"
            >
              Preview on Phone
            </a>
          </div>
          <p className="muted" style={{ fontSize: "0.85rem", marginTop: "0.75rem" }}>
            Text message preview: &ldquo;{buildSigningSmsMessage(clientName, signingUrl)}&rdquo;
          </p>
        </>
      )}
    </section>
  );
}
