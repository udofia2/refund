interface Props {
  decision: "approved" | "denied" | "escalated" | null;
}

const STYLES: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-800",
  denied: "bg-red-100 text-red-800",
  escalated: "bg-amber-100 text-amber-800",
};

const LABELS: Record<string, string> = {
  approved: "Approved",
  denied: "Denied",
  escalated: "Escalated",
};

export default function DecisionBadge({ decision }: Props) {
  if (!decision) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STYLES[decision]}`}
    >
      {LABELS[decision]}
    </span>
  );
}
