"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminGuard } from "@/components/AdminGuard";
import { AdminContractList } from "@/components/AdminContractList";
import { ContractPreview } from "@/components/ContractPreview";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { Contract, ContractListFilter } from "@/lib/types";
import { renderContractText, contractTextToHtml } from "@/lib/contractTemplate";

function AdminHeader() {
  const { logout, user } = useAuth();
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/admin/contracts" className="brand">
          Oryn Contracts
        </Link>
        <nav style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <span className="muted" style={{ fontSize: "0.85rem" }}>{user?.email}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => logout()}>
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}

export default function AdminContractsPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [filter, setFilter] = useState<ContractListFilter>("awaiting_signature");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      const res = await api.listContracts({
        status: filter === "all" ? undefined : filter,
        search: search || undefined,
      });
      setContracts(res.contracts as Contract[]);
    } catch (err) {
      console.error(err);
      setListError(err instanceof Error ? err.message : "Failed to load contracts");
      setContracts([]);
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  async function handleAction(action: string, contractId: string) {
    try {
      if (action === "send" || action === "resend") {
        if (action === "resend") {
          await api.resendContractEmail(contractId);
        } else {
          await api.sendContractEmail(contractId);
        }
        await load();
        return;
      }
      if (action === "unsigned-pdf" || action === "signed-pdf") {
        const type = action === "signed-pdf" ? "signed" : "unsigned";
        const { url } = await api.getPdfDownloadUrl(contractId, type);
        window.open(url, "_blank");
        return;
      }
      if (action === "email-copy") {
        await api.emailSignedCopy(contractId, "client");
        alert("Signed copy emailed to client.");
        return;
      }
      if (action === "renew") {
        router.push(`/admin/contracts/${contractId}/renew`);
        return;
      }
      if (action === "cancel") {
        if (!confirm("Cancel this contract?")) return;
        await api.cancelContract(contractId);
        await load();
        return;
      }
      if (action === "preview") {
        const c = contracts.find((x) => x.id === contractId);
        if (c) {
          const text = renderContractText({
            clientName: c.clientName,
            clientAddress: c.clientAddress,
            projectDescription: c.projectDescription,
            onboardingFee: c.onboardingFee,
            monthlyFee: c.monthlyFee,
            termMonths: c.termMonths,
            startDate: c.startDate,
            customTerms: c.customTerms,
          });
          setPreviewHtml(contractTextToHtml(text));
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    }
  }

  return (
    <AdminGuard>
      <AdminHeader />
      <main className="container">
        <div className="page-header">
          <h1>Contracts</h1>
          <Link href="/admin/contracts/new" className="btn btn-primary">
            New Contract
          </Link>
        </div>
        <AdminContractList
          contracts={contracts}
          filter={filter}
          search={search}
          onFilterChange={setFilter}
          onSearchChange={setSearch}
          onAction={handleAction}
          loading={loading}
          error={listError}
        />
        {previewHtml && (
          <ContractPreview html={previewHtml} onClose={() => setPreviewHtml(null)} />
        )}
      </main>
    </AdminGuard>
  );
}
