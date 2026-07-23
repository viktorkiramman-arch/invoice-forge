import { Ban, BadgeCheck, CircleDollarSign, Clock3, FilePenLine, XCircle } from "lucide-react";

const labels: Record<string, string> = {
  DRAFT: "Draft",
  FINALIZED: "Finalized",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
  VOID: "Void",
};

export function StatusBadge({ status }: { status: string }) {
  const Icon =
    {
      DRAFT: FilePenLine,
      FINALIZED: BadgeCheck,
      PAID: CircleDollarSign,
      OVERDUE: Clock3,
      CANCELLED: XCircle,
      VOID: Ban,
    }[status] ?? FilePenLine;
  const label = labels[status] ?? status;

  return (
    <span className={`status-badge status-${status.toLowerCase()}`} aria-label={`Status: ${label}`}>
      <Icon size={12} aria-hidden="true" />
      {label}
    </span>
  );
}
