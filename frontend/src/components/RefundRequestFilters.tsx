import type { Ref } from "react";
import type { Decision } from "../types";

interface Props {
  decision: Decision | "all";
  onDecisionChange: (decision: Decision | "all") => void;
  onRefresh: () => void;
  refreshing: boolean;
  pillsRef?: Ref<HTMLDivElement>;
  refreshRef?: Ref<HTMLButtonElement>;
}

const FILTERS: Array<{ value: Decision | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
  { value: "escalated", label: "Escalated" },
];

export default function RefundRequestFilters({
  decision,
  onDecisionChange,
  onRefresh,
  refreshing,
  pillsRef,
  refreshRef,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div ref={pillsRef} className="flex flex-wrap gap-2" role="group" aria-label="Filter by decision">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            aria-pressed={decision === filter.value}
            onClick={() => onDecisionChange(filter.value)}
            className={
              decision === filter.value
                ? "rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white"
                : "rounded-full border border-gray-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-gray-50"
            }
          >
            {filter.label}
          </button>
        ))}
      </div>
      <button
        ref={refreshRef}
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        aria-busy={refreshing}
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-gray-50 disabled:opacity-60"
      >
        <span
          aria-hidden="true"
          className={refreshing ? "inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-slate-600" : "hidden"}
        />
        Refresh
      </button>
    </div>
  );
}
