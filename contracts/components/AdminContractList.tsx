"use client";

import Link from "next/link";
import type { Contract, ContractStatus } from "@/lib/types";
import { formatTermLabel } from "@/lib/termUtils";
import { ContractStatusBadge } from "./ContractStatusBadge";

const FILTERS: Array<{ label: string; value: ContractStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Sent", value: "sent" },
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

interface Props {
  contracts: Contract[];
  filter: ContractStatus | "all";
  search: string;
  onFilterChange: (v: ContractStatus | "all") => void;
  onSearchChange: (v: string) => void;
  onAction: (action: string, contractId: string) => void;
  loading?: boolean;
}

export function AdminContractList({
  contracts,
  filter,
  search,
  onFilterChange,
  onSearchChange,
  onAction,
  loading,
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

      {loading ? (
        <p className="muted">Loading contracts…</p>
      ) : contracts.length === 0 ? (
        <p className="muted">No contracts found.</p>
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
                      <Link href={`/admin/contracts/${c.id}`} className="btn btn-ghost btn-sm">
                        Details
                      </Link>
                      {c.status === "draft" && (
                        <Link href={`/admin/contracts/${c.id}/edit`} className="btn btn-ghost btn-sm">
                          Edit
                        </Link>
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
