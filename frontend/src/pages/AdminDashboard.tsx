import { useEffect, useRef, useState } from "react";
import { listRefundRequests } from "../api";
import type { Decision, RefundRequestResponse } from "../types";
import DecisionSummary from "../components/DecisionSummary";
import RefundRequestFilters from "../components/RefundRequestFilters";
import RefundRequestDetail from "../components/RefundRequestDetail";
import RefundRequestsTable from "../components/RefundRequestsTable";

interface Fetched {
  all: RefundRequestResponse[];
  visible: RefundRequestResponse[];
}

type EventLoadMode = "retry" | "refresh" | "filter";

export default function AdminDashboard() {
  const [allRequests, setAllRequests] = useState<RefundRequestResponse[]>([]);
  const [visibleRequests, setVisibleRequests] = useState<RefundRequestResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decisionFilter, setDecisionFilter] = useState<Decision | "all">("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const requestSeq = useRef(0);
  const viewButtonRefs = useRef(new Map<number, HTMLButtonElement>());
  const pillsRef = useRef<HTMLDivElement>(null);
  const refreshRef = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<"vanished" | "view" | null>(null);
  const pendingViewId = useRef<number | null>(null);

  async function fetchRequests(filter: Decision | "all"): Promise<Fetched> {
    const all = await listRefundRequests({ limit: 100 });
    const visible =
      filter === "all" ? all : await listRefundRequests({ limit: 100, decision: filter });
    return { all, visible };
  }

  function restoreToPills() {
    const pill = pillsRef.current?.querySelector("button");
    if (pill) {
      pill.focus();
      return;
    }
    refreshRef.current?.focus();
  }

  function applyResult(fetched: Fetched, seq: number, closedRowId: number | null) {
    if (seq !== requestSeq.current) return;
    setAllRequests(fetched.all);
    setVisibleRequests(fetched.visible);
    setError(null);
    if (closedRowId != null && !fetched.visible.some((r) => r.id === closedRowId)) {
      pendingFocus.current = "vanished";
      setSelectedId(null);
    }
  }

  function applyError(err: unknown, seq: number) {
    if (seq !== requestSeq.current) return;
    setError(err instanceof Error ? err.message : "Failed to load refund requests");
  }

  // detail renders from the list row; getRefundRequest kept for a future deep-link route
  useEffect(() => {
    const seq = ++requestSeq.current;
    fetchRequests("all")
      .then((fetched) => applyResult(fetched, seq, null))
      .catch((err) => applyError(err, seq))
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false);
      });
  }, []);

  function runEventLoad(mode: EventLoadMode, filter: Decision | "all") {
    const seq = ++requestSeq.current;
    if (mode === "retry") {
      setLoading(true);
      setError(null);
    }
    if (mode === "refresh") {
      setRefreshing(true);
      setError(null);
    }
    fetchRequests(filter)
      .then((fetched) => applyResult(fetched, seq, selectedId))
      .catch((err) => applyError(err, seq))
      .finally(() => {
        if (seq !== requestSeq.current) return;
        setLoading(false);
        setRefreshing(false);
      });
  }

  function closeDrawer() {
    const id = selectedId;
    if (id == null) return;
    pendingFocus.current = "view";
    pendingViewId.current = id;
    setSelectedId(null);
  }

  // Focus restore runs after the commit that unmounted the drawer, so
  // document.activeElement reflects the post-unmount state reliably for both
  // event-driven closes (Escape) and fetch-driven closes (row vanished).
  useEffect(() => {
    if (selectedId !== null) return;
    const kind = pendingFocus.current;
    if (!kind) return;
    pendingFocus.current = null;
    if (kind === "vanished") {
      const active = document.activeElement;
      if (!active || active === document.body) restoreToPills();
      return;
    }
    const btn =
      pendingViewId.current != null
        ? viewButtonRefs.current.get(pendingViewId.current)
        : undefined;
    if (btn && btn.isConnected) btn.focus();
    else restoreToPills();
  }, [selectedId]);

  function handleFilterChange(filter: Decision | "all") {
    setDecisionFilter(filter);
    runEventLoad("filter", filter);
  }

  function registerViewButton(id: number) {
    return (el: HTMLButtonElement | null) => {
      if (el) viewButtonRefs.current.set(id, el);
      else viewButtonRefs.current.delete(id);
    };
  }

  const selectedRequest = visibleRequests.find((r) => r.id === selectedId) ?? null;
  const hasContent = !loading && (!error || allRequests.length > 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Admin dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Recent refund requests with decisions and full audit trail — read-only support view.
        </p>
      </div>

      {error && !loading && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">Could not load refund requests. Please try again.</p>
          <p className="mt-1 text-xs text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => runEventLoad("retry", decisionFilter)}
            className="mt-2 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {hasContent && (
        <>
          <DecisionSummary requests={allRequests} />
          <RefundRequestFilters
            decision={decisionFilter}
            onDecisionChange={handleFilterChange}
            onRefresh={() => runEventLoad("refresh", decisionFilter)}
            refreshing={refreshing}
            pillsRef={pillsRef}
            refreshRef={refreshRef}
          />
          <RefundRequestsTable
            requests={visibleRequests}
            onSelect={setSelectedId}
            selectedId={selectedId}
            loading={loading}
            viewButtonRef={registerViewButton}
          />
        </>
      )}

      {!hasContent && !error && (
        <RefundRequestsTable
          requests={[]}
          onSelect={setSelectedId}
          selectedId={selectedId}
          loading={loading}
          viewButtonRef={registerViewButton}
        />
      )}

      <RefundRequestDetail request={selectedRequest} onClose={closeDrawer} loading={false} />
    </div>
  );
}
