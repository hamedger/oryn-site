"use client";

import type { ContractAcceptance } from "@/lib/types";

interface Props {
  acceptance: ContractAcceptance;
  signatureImageUrl: string | null;
}

export function SignedContractSummary({ acceptance, signatureImageUrl }: Props) {
  return (
    <section className="card signed-summary">
      <h2>Signed Contract Summary</h2>
      <dl className="detail-grid">
        <div>
          <dt>Signed by</dt>
          <dd>{acceptance.signerName}</dd>
        </div>
        <div>
          <dt>Signer email</dt>
          <dd>{acceptance.signerEmail}</dd>
        </div>
        <div>
          <dt>Signed timestamp</dt>
          <dd>{new Date(acceptance.acceptedAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt>IP address</dt>
          <dd>{acceptance.ipAddress}</dd>
        </div>
        <div className="full-width">
          <dt>User agent</dt>
          <dd className="mono">{acceptance.userAgent}</dd>
        </div>
      </dl>
      {signatureImageUrl && (
        <div className="signature-preview">
          <p className="label">Signature</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={signatureImageUrl} alt="Client signature" />
        </div>
      )}
    </section>
  );
}
