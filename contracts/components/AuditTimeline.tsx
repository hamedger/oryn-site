"use client";

import type { AuditLog } from "@/lib/types";

const EVENT_LABELS: Record<string, string> = {
  contract_created: "Contract Created",
  contract_updated: "Contract Updated",
  contract_sent: "Contract Sent",
  signing_link_resent: "Signing Link Resent",
  email_sent: "Email Sent",
  customer_viewed: "Customer Viewed",
  customer_signed: "Customer Signed",
  signed_pdf_generated: "Signed PDF Generated",
  signed_pdf_emailed: "Signed PDF Emailed",
  contract_renewed: "Contract Renewed",
  contract_cancelled: "Contract Cancelled",
};

interface Props {
  logs: AuditLog[];
}

export function AuditTimeline({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <section className="card">
        <h2>Audit Timeline</h2>
        <p className="muted">No audit events yet.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Audit Timeline</h2>
      <ol className="audit-timeline">
        {logs.map((log) => (
          <li key={log.id}>
            <div className="audit-dot" />
            <div className="audit-content">
              <strong>{EVENT_LABELS[log.eventType] || log.eventType}</strong>
              <p>{log.message}</p>
              <span className="audit-meta">
                {new Date(log.createdAt).toLocaleString()} · {log.actorType}
                {log.actorEmail ? ` · ${log.actorEmail}` : ""}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
