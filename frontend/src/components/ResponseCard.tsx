import type { RefundRequestResponse } from "../types";
import DecisionBadge from "./DecisionBadge";

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function ResponseCard({ response }: { response: RefundRequestResponse }) {
  return (
    <section
      aria-label="Refund decision"
      className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between">
        <DecisionBadge decision={response.decision} />
        <span className="text-xs text-slate-400">
          {formatTimestamp(response.created_at)}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-slate-800">{response.ai_response}</p>

      <details className="mt-4 border-t border-gray-100 pt-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-500 hover:text-slate-700">
          Why this decision
        </summary>
        <p className="mt-2 text-sm text-slate-600">{response.decision_reason}</p>
        <p className="mt-1 text-xs text-slate-400">
          Decision engine: deterministic policy &middot; Message by: {response.ai_provider}{" "}
          provider
        </p>
      </details>
    </section>
  );
}
