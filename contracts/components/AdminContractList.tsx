"use client";

import type { Contract, ContractListFilter } from "@/lib/types";
import { api } from "@/lib/api";
import { formatCallableError } from "@/lib/apiErrors";
import { buildSigningSmsMessage, copyText } from "@/lib/signingLink";
import { formatTermLabel } from "@/lib/termUtils";
import { ContractStatusBadge } from "./ContractStatusBadge";

const FILTERS: Array<{ label: string; value: ContractListFilter }> = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Awaiting Signature", value: "awaiting_signature" },
  { label: "Sent (unopened)", value: "sent" },
  { label: "Viewed", value: "viewed" },
  { label: "Signed", value: "signed" },
  { label: "Expired", value: "expired" },
  { label: "Cancelled", value: "cancelled" },
];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function canShareSigningLink(c: Contract): boolean {
  return c.status !== "signed" && c.status !== "cancelled" && c.status !== "draft";
}

async function copySigningLink(c: Contract) {
  try {
    const { signingUrl } = await api.getContractSigningLink(c.id);
    const ok = await copyText(buildSigningSmsMessage(c.clientName, signingUrl));
    if (ok) alert("Signing link copied — paste into a text message to your client.");
    else alert(`Copy this link:\n${signingUrl}`);
  } catch (err) {
    alert(formatCallableError(err));
  }
}

interface Props {
  contracts: Contract[];
  filter: ContractListFilter;
  search: string;
  onFilterChange: (v: ContractListFilter) => void;
  onSearchChange: (v: string) => void;
  onAction: (action: string, contractId: string) => void;
  loading?: boolean;
  error?: string;
}

export function AdminContractList({
  contracts,
  filter,
  search,
  onFilterChange,
  onSearchChange,
  onAction,
  loading,
  error,
}: Props) {
  return (
    <div className="admin-list">
      <div className="list-toolbar">
        <input
          type="search"
          placeholder="Search by name, email, or contract ID…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
        />
        <div className="filter-tabs">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`filter-tab ${filter === f.value ? "active" : ""}`}
              onClick={() => onFilterChange(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <p className="muted">Loading contracts…</p>
      ) : contracts.length === 0 ? (
        <p className="muted">
          {filter === "awaiting_signature"
            ? "No contracts awaiting signature. Sent contracts move to Viewed once the signing link is opened."
            : "No contracts found."}
        </p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Client</th>
                <th>Email</th>
                <th>Project</th>
                <th>Onboarding</th>
                <th>Monthly</th>
                <th>Term</th>
                <th>Created</th>
                <th>Sent</th>
                <th>Signed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id}>
                  <td>
                    <ContractStatusBadge status={c.status} />
                  </td>
                  <td>{c.clientName}</td>
                  <td>{c.clientEmail}</td>
                  <td className="truncate">{c.projectDescription}</td>
                  <td>{fmtMoney(c.onboardingFee)}</td>
                  <td>{fmtMoney(c.monthlyFee)}</td>
                  <td>{formatTermLabel(c.termMonths)}</td>
                  <td>{fmtDate(c.createdAt)}</td>
                  <td>{fmtDate(c.sentAt)}</td>
                  <td>{fmtDate(c.signedAt)}</td>
                  <td>
                    <div className="action-menu">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => onAction("details", c.id)}
                      >
                        Details
                      </button>
                      {canShareSigningLink(c) && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => copySigningLink(c)}
                        >
                          Copy Link
                        </button>
                      )}
                      {c.status === "draft" && (
                        <a
                          href={`/admin/contracts/_/edit/?id=${encodeURIComponent(c.id)}`}
                          className="btn btn-ghost btn-sm"
                        >
                          Edit
                        </a>
                      )}
                      {c.status !== "signed" && c.status !== "cancelled" && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => onAction(c.status === "draft" ? "send" : "resend", c.id)}
                        >
                          {c.status === "draft" ? "Send" : "Resend"}
                        </button>
                      )}
                      {c.unsignedPdfPath && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => onAction("unsigned-pdf", c.id)}
                        >
                          Unsigned PDF
                        </button>
                      )}
                      {c.status === "signed" && (
                        <>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => onAction("signed-pdf", c.id)}
                          >
                            Signed PDF
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => onAction("email-copy", c.id)}
                          >
                            Email Copy
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => onAction("renew", c.id)}
                          >
                            Renew
                          </button>
                        </>
                      )}
                      {c.status !== "signed" && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm btn-danger"
                          onClick={() => onAction("cancel", c.id)}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
