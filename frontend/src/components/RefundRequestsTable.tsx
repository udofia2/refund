import type { RefundRequestResponse } from "../types";
import DecisionBadge from "./DecisionBadge";
import EmptyState from "./EmptyState";
import { canParseDate, formatRelativeTime } from "../utils/time";

interface Props {
  requests: RefundRequestResponse[];
  onSelect: (id: number) => void;
  selectedId: number | null;
  loading: boolean;
  viewButtonRef?: (id: number) => (el: HTMLButtonElement | null) => void;
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `$${value.toFixed(2)}`;
}

export default function RefundRequestsTable({
  requests,
  onSelect,
  selectedId,
  loading,
  viewButtonRef,
}: Props) {
  const columns = ["ID", "Created", "Customer", "Order", "Amount", "Decision", "Provider", ""];

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50">
          <tr>
            {columns.map((col, i) => (
              <th
                key={col || i}
                scope="col"
                className={`px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500 ${
                  col === "Created" || col === "Order" || col === "Amount"
                    ? "hidden md:table-cell"
                    : col === "Provider"
                      ? "hidden lg:table-cell"
                      : ""
                } ${col === "" ? "text-right" : ""}`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <>
              {[0, 1, 2, 3, 4].map((i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td colSpan={8} className="px-3 py-3">
                    <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
                  </td>
                </tr>
              ))}
            </>
          )}

          {!loading && requests.length === 0 && (
            <tr>
              <td colSpan={8} className="p-4">
                <EmptyState message="No refund requests yet. Submit one from the customer view to see it here." />
              </td>
            </tr>
          )}

          {!loading &&
            requests.map((request) => {
              const amount = request.order
                ? request.order.total_amount
                : request.extracted_data?.requested_amount ?? null;
              const createdTitle = canParseDate(request.created_at)
                ? request.created_at
                : "unparsed";
              return (
                <tr
                  key={request.id}
                  onClick={() => onSelect(request.id)}
                  className={`cursor-pointer border-b border-gray-100 hover:bg-gray-50 ${
                    selectedId === request.id ? "bg-gray-100" : ""
                  }`}
                >
                  <td className="px-3 py-3 font-mono text-xs text-slate-600">#{request.id}</td>
                  <td className="hidden px-3 py-3 text-xs text-slate-500 md:table-cell" title={createdTitle}>
                    {formatRelativeTime(request.created_at)}
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-medium text-slate-900">{request.customer.name}</span>
                    <small className="block text-xs text-slate-400">{request.customer.email}</small>
                  </td>
                  <td className="hidden px-3 py-3 font-mono text-xs text-slate-600 md:table-cell">
                    {request.order ? `#${request.order.id}` : "—"}
                  </td>
                  <td className="hidden px-3 py-3 text-slate-700 md:table-cell">{formatMoney(amount)}</td>
                  <td className="px-3 py-3">
                    <DecisionBadge decision={request.decision} />
                  </td>
                  <td className="hidden px-3 py-3 font-mono text-xs text-slate-400 lg:table-cell">
                    {request.ai_provider ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      ref={viewButtonRef?.(request.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(request.id);
                      }}
                      aria-label={`View request #${request.id}`}
                      className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-gray-50"
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
