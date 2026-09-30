import { useEffect, useRef, useState } from "react";
import {
  listCustomers,
  listOrdersForCustomer,
  submitRefundRequest,
} from "../api";
import type { Customer, RefundRequestCreate, RefundRequestResponse } from "../types";
import RequestForm from "../components/RequestForm";
import ResponseCard from "../components/ResponseCard";

export default function CustomerChat() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [orderIds, setOrderIds] = useState<number[] | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [response, setResponse] = useState<RefundRequestResponse | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const responseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    listCustomers()
      .then((cs) => {
        if (!cancelled) {
          setCustomers(cs);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load customers");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function retryLoadCustomers() {
    setLoading(true);
    setLoadError(null);
    listCustomers()
      .then((cs) => {
        setCustomers(cs);
        setLoading(false);
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Failed to load customers");
        setLoading(false);
      });
  }

  function handleCustomerChange(id: number) {
    setSelectedCustomerId(id);
    setOrderIds(null);
    setOrdersError(null);
    listOrdersForCustomer(id)
      .then((orders) => setOrderIds(orders.map((o) => o.id)))
      .catch((err) =>
        setOrdersError(err instanceof Error ? err.message : "Failed to load orders"),
      );
  }

  async function handleSubmit(body: RefundRequestCreate) {
    setSubmitting(true);
    setSubmitError(null);
    setResponse(null);
    try {
      const result = await submitRefundRequest(body);
      setResponse(result);
      requestAnimationFrame(() =>
        responseRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Could not submit your request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleNewRequest() {
    setResponse(null);
    setSubmitError(null);
    setResetToken((t) => t + 1);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Refund request
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Tell us what went wrong — our assistant will review it against the refund
          policy instantly.
        </p>
      </div>

      {loading && (
        <div className="animate-pulse rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="h-4 w-1/3 rounded bg-gray-200" />
          <div className="mt-3 h-10 rounded bg-gray-100" />
          <div className="mt-3 h-24 rounded bg-gray-100" />
        </div>
      )}

      {!loading && loadError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{loadError}</p>
          <button
            type="button"
            onClick={retryLoadCustomers}
            className="mt-2 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !loadError && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <RequestForm
            key={resetToken}
            customers={customers}
            selectedCustomerId={selectedCustomerId}
            onCustomerChange={handleCustomerChange}
            orderIds={orderIds}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
          {ordersError && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              Could not load orders: {ordersError}
            </p>
          )}
        </div>
      )}

      {submitError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">
            Could not submit your request. Please try again.
          </p>
          <p className="mt-1 text-xs text-red-400">{submitError}</p>
        </div>
      )}

      <div ref={responseRef}>
        {response && (
          <>
            <ResponseCard response={response} />
            <button
              type="button"
              onClick={handleNewRequest}
              className="mt-4 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-gray-50"
            >
              New request
            </button>
          </>
        )}
      </div>
    </div>
  );
}
