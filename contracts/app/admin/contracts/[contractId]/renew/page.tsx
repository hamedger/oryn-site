"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminGuard } from "@/components/AdminGuard";
import { ContractForm } from "@/components/ContractForm";
import { api } from "@/lib/api";
import { resolveRouteParam } from "@/lib/routeParams";
import type { Contract, ContractFormData } from "@/lib/types";

export default function RenewContractPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = resolveRouteParam(params.contractId, 2);
  const [original, setOriginal] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getContractDetail(contractId).then((res) => {
      setOriginal(res.contract as Contract);
      setLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load");
      setLoading(false);
    });
  }, [contractId]);

  async function handleRenew(data: ContractFormData) {
    setSaving(true);
    setError("");
    try {
      const res = await api.renewContract(contractId, {
        onboardingFee: data.onboardingFee,
        monthlyFee: data.monthlyFee,
        termMonths: data.termMonths,
        startDate: data.startDate,
        onboardingFeePaymentLink: data.onboardingFeePaymentLink,
      });
      router.push(`/admin/contracts/${res.contractId}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Renewal failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminGuard>
        <main className="container page-center"><p className="muted">Loading…</p></main>
      </AdminGuard>
    );
  }

  if (!original) {
    return (
      <AdminGuard>
        <main className="container"><div className="alert alert-error">{error}</div></main>
      </AdminGuard>
    );
  }

  const renewInitial: Partial<ContractFormData> = {
    clientName: original.clientName,
    clientAddress: original.clientAddress,
    clientEmail: original.clientEmail,
    projectDescription: original.projectDescription,
    customTerms: original.customTerms,
    onboardingFee: original.onboardingFee,
    monthlyFee: original.monthlyFee,
    termMonths: original.termMonths,
    startDate: new Date().toISOString().slice(0, 10),
    onboardingFeePaymentLink: original.onboardingFeePaymentLink || "",
    adminOverrideAllowDifferentSignerEmail: original.adminOverrideAllowDifferentSignerEmail,
  };

  return (
    <AdminGuard>
      <header className="site-header">
        <div className="header-inner">
          <Link href={`/admin/contracts/${contractId}`} className="brand">
            Oryn Contracts
          </Link>
        </div>
      </header>
      <main className="container">
        <div className="page-header">
          <h1>Renew Contract</h1>
          <Link href={`/admin/contracts/${contractId}`} className="btn btn-ghost">
            Cancel
          </Link>
        </div>
        <p className="muted">
          Creating a new draft from contract {contractId}. Client details and custom terms are carried over.
          Update fees, term, start date, and payment link as needed.
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <section className="card">
          <ContractForm
            initial={renewInitial}
            onSubmit={handleRenew}
            loading={saving}
            submitLabel="Create Renewal Draft"
          />
        </section>
      </main>
    </AdminGuard>
  );
}
