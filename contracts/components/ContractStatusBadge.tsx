import type { ContractStatus } from "@/lib/types";

const STATUS_STYLES: Record<ContractStatus, string> = {
  draft: "badge-draft",
  sent: "badge-sent",
  viewed: "badge-viewed",
  signed: "badge-signed",
  expired: "badge-expired",
  cancelled: "badge-cancelled",
};

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return (
    <span className={`badge ${STATUS_STYLES[status] || ""}`}>
      {status}
    </span>
  );
}
