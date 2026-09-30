import { useState } from "react";
import type { Customer, RefundRequestCreate } from "../types";
import CustomerSelector from "./CustomerSelector";

interface Props {
  customers: Customer[];
  selectedCustomerId: number | null;
  onCustomerChange: (id: number) => void;
  orderIds: number[] | null; // null until fetched; [] for customers with no orders
  onSubmit: (body: RefundRequestCreate) => Promise<void>;
  submitting: boolean;
}

export default function RequestForm({
  customers,
  selectedCustomerId,
  onCustomerChange,
  orderIds,
  onSubmit,
  submitting,
}: Props) {
  const [text, setText] = useState("");
  const [orderId, setOrderId] = useState<number | null>(null);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextCustomerError = selectedCustomerId === null ? "Please select a customer." : null;
    const nextTextError = text.trim().length === 0 ? "Please describe the issue." : null;
    setCustomerError(nextCustomerError);
    setTextError(nextTextError);
    if (nextCustomerError || nextTextError || selectedCustomerId === null) return;

    onSubmit({
      customer_id: selectedCustomerId,
      request_text: text.trim(),
      order_id: orderId,
    });
  };

  const invalid = selectedCustomerId === null || text.trim().length === 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <CustomerSelector
        customers={customers}
        value={selectedCustomerId}
        onChange={onCustomerChange}
        disabled={submitting}
      />
      {customerError && (
        <p role="alert" className="text-sm text-red-600">
          {customerError}
        </p>
      )}

      <div>
        <label htmlFor="request-text" className="mb-1 block text-sm font-medium text-slate-700">
          What went wrong with your order?
        </label>
        <textarea
          id="request-text"
          rows={4}
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe the issue with your order…"
          disabled={submitting}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
        />
        <div className="mt-1 flex items-center justify-between">
          {textError ? (
            <p role="alert" className="text-sm text-red-600">
              {textError}
            </p>
          ) : (
            <span />
          )}
          <span className="text-xs text-slate-400">{text.length}/2000</span>
        </div>
      </div>

      <div>
        <label htmlFor="order-id" className="mb-1 block text-sm font-medium text-slate-700">
          Order (optional)
        </label>
        <select
          id="order-id"
          value={orderId ?? ""}
          onChange={(e) => setOrderId(e.target.value === "" ? null : Number(e.target.value))}
          disabled={submitting || orderIds === null}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
        >
          {orderIds === null ? (
            <option value="">Loading orders…</option>
          ) : (
            <>
              <option value="">Not sure</option>
              {orderIds.map((id) => (
                <option key={id} value={id}>
                  Order #{id}
                </option>
              ))}
            </>
          )}
        </select>
      </div>

      <button
        type="submit"
        disabled={submitting || invalid}
        aria-busy={submitting}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit refund request"}
      </button>
    </form>
  );
}
