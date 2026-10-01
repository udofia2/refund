import { useEffect, useRef } from "react";
import type { RefundRequestResponse } from "../types";
import DecisionBadge from "./DecisionBadge";
import { formatAbsoluteTime } from "../utils/time";

interface Props {
  request: RefundRequestResponse | null;
  onClose: () => void;
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `$${value.toFixed(2)}`;
}

export default function RefundRequestDetail({ request, onClose }: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const requestId = request?.id ?? null;

  useEffect(() => {
    if (requestId != null) closeButtonRef.current?.focus();
  }, [requestId]);

  useEffect(() => {
    if (!request) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [request, onClose]);

  if (!request) return null;

  function handleOverlayMouseDown() {
    // Click-outside closes on desktop only; on mobile the close button is the path.
    if (window.innerWidth >= 768) onClose();
  }

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onMouseDown={handleOverlayMouseDown}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-labelledby="drawer-title"
        className="absolute right-0 top-0 flex h-full w-full max-w-lg flex-col bg-white shadow-xl"
      >
        {request && (
          <>
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <div className="flex items-center gap-3">
                  <h2 id="drawer-title" className="font-mono text-lg font-semibold text-slate-900">
                    #{request.id}
                  </h2>
                  <DecisionBadge decision={request.decision} />
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Close request details"
                  className="rounded-md p-1.5 text-slate-400 hover:bg-gray-100 hover:text-slate-600"
                >
                  <span aria-hidden="true" className="text-lg leading-none">
                    ×
                  </span>
                </button>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
                <section aria-label="Customer">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Customer
                  </h3>
                  <p className="mt-1 font-medium text-slate-900">{request.customer.name}</p>
                  <p className="text-sm text-slate-500">{request.customer.email}</p>
                  <p className="font-mono text-xs text-slate-400">ID {request.customer.id}</p>
                </section>

                {request.order && (
                  <section aria-label="Order">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Order
                    </h3>
                    <div className="mt-1 text-sm text-slate-700">
                      <p>
                        <span className="font-mono">#{request.order.id}</span> · {request.order.status} ·{" "}
                        {new Date(request.order.order_date).toLocaleDateString()}
                      </p>
                      <p className="font-medium">Total {formatMoney(request.order.total_amount)}</p>
                    </div>
                    <ul className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-200">
                      {request.order.items.map((item) => (
                        <li key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span className="text-slate-700">
                            {item.product_name}
                            <span className="text-slate-400"> ×{item.quantity}</span>
                            {item.is_final_sale && (
                              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                                Final sale
                              </span>
                            )}
                          </span>
                          <span className="text-slate-500">{formatMoney(item.price)}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section aria-label="Original request">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Original request
                  </h3>
                  <blockquote className="mt-2 whitespace-pre-wrap border-l-4 border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm text-slate-700">
                    {request.request_text}
                  </blockquote>
                </section>

                <section aria-label="AI extraction">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    AI extraction
                  </h3>
                  {request.extracted_data ? (
                    <dl className="mt-2 space-y-1 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-400">Reason</dt>
                        <dd className="text-right text-slate-800">{request.extracted_data.reason}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-400">Requested amount</dt>
                        <dd className="text-right text-slate-800">
                          {formatMoney(request.extracted_data.requested_amount)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-400">Order ID</dt>
                        <dd className="text-right font-mono text-slate-800">
                          {request.extracted_data.order_id ?? "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-400">Item condition</dt>
                        <dd className="text-right text-slate-800">
                          {request.extracted_data.item_condition ?? "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-400">Confidence</dt>
                        <dd className="text-right text-slate-800">
                          {Math.round(request.extracted_data.confidence * 100)}%
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-400">Suspicious indicators</dt>
                        <dd className="flex flex-wrap justify-end gap-1">
                          {request.extracted_data.suspicious_indicators.length > 0 ? (
                            request.extracted_data.suspicious_indicators.map((indicator) => (
                              <span
                                key={indicator}
                                className="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700"
                              >
                                {indicator}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-600">none</span>
                          )}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500">No extraction data.</p>
                  )}
                </section>

                <section aria-label="Decision reasoning">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Decision reasoning
                  </h3>
                  <p className="mt-1 border-l-4 border-slate-800 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900">
                    {request.decision_reason ?? "—"}
                  </p>
                </section>

                <section aria-label="AI response">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    AI response
                  </h3>
                  <p className="mt-1 rounded-md bg-gray-100 px-3 py-2 text-sm italic text-slate-600">
                    {request.ai_response ?? "—"}
                  </p>
                </section>

                <section aria-label="Metadata" className="pb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Metadata
                  </h3>
                  <dl className="mt-1 space-y-0.5 font-mono text-xs text-slate-400">
                    <div className="flex justify-between">
                      <dt>ai_provider</dt>
                      <dd>{request.ai_provider ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>created_at</dt>
                      <dd>{formatAbsoluteTime(request.created_at)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>updated_at</dt>
                      <dd>{formatAbsoluteTime(request.updated_at)}</dd>
                    </div>
                  </dl>
                </section>
              </div>
          </>
        )}
      </div>
    </div>
  );
}
