import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import type { Customer, Order, OrderItem, RefundRequestResponse } from "../types";

export function renderWithRouter(ui: ReactElement, { route = "/" } = {}) {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
}

export function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 1,
    name: "Test Customer",
    email: "test.customer@example.com",
    created_at: "2026-09-30T10:00:00",
    ...overrides,
  };
}

export function makeOrderItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 1,
    product_name: "Wireless Headphones",
    price: 129.99,
    quantity: 1,
    is_final_sale: false,
    condition: "new",
    ...overrides,
  };
}

export function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 1,
    customer_id: 1,
    order_date: "2026-09-25T15:52:02.356877",
    total_amount: 142.98,
    status: "delivered",
    items: [makeOrderItem()],
    ...overrides,
  };
}

export function makeRefundRequest(
  overrides: Partial<RefundRequestResponse> = {},
): RefundRequestResponse {
  return {
    id: 1,
    customer_id: 1,
    order_id: 1,
    request_text: "My order arrived damaged",
    extracted_data: {
      // Disjoint sentinels: never shared with decision_reason (ResponseCard
      // asserts one is absent while the other is present).
      reason: "sentinel-extract",
      requested_amount: 120,
      order_id: 1,
      item_condition: null,
      suspicious_indicators: [],
      confidence: 0.6,
    },
    decision: "approved",
    decision_reason: "sentinel-reason: Customer reports damaged or incorrect item.",
    ai_response: "Hi, good news — your refund has been approved.",
    ai_provider: "mock",
    created_at: "2026-10-01T05:00:00",
    updated_at: null,
    customer: makeCustomer(),
    order: makeOrder(),
    ...overrides,
  };
}

// --- fetch mocking -----------------------------------------------------------

type FetchQueueEntry = () => Promise<Response>;

const queue: FetchQueueEntry[] = [];
let currentMock: ReturnType<typeof vi.fn> | null = null;

const STATUS_TEXT: Record<number, string> = {
  201: "Created",
  403: "Forbidden",
  404: "Not Found",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
};

function makeResponse(
  body: unknown,
  { status = 200, statusText, raw = false }: { status?: number; statusText?: string; raw?: boolean },
): Response {
  const payload = raw ? String(body) : JSON.stringify(body);
  return new Response(payload, {
    status,
    statusText: statusText ?? STATUS_TEXT[status] ?? "OK",
    headers: { "Content-Type": "application/json" },
  });
}

function ensureFetchMock() {
  if (currentMock && (globalThis.fetch as unknown) === (currentMock as unknown)) {
    return currentMock;
  }
  // Re-install (and drop stale queue entries) whenever the global was
  // unstubbed by the previous test's afterEach.
  queue.length = 0;
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL): Promise<Response> => {
      const next = queue.shift();
      if (!next) {
        throw new Error(
          `fetch(${String(input)}) called with no mocked response queued — ` +
            "a test made more network calls than it mocked",
        );
      }
      return next();
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  currentMock = fetchMock;
  return fetchMock;
}

/** Queue one JSON (or `raw`) response for the next fetch call. */
export function mockFetchOnce(
  body: unknown,
  {
    status = 200,
    statusText,
    raw = false,
  }: { status?: number; statusText?: string; raw?: boolean } = {},
): ReturnType<typeof vi.fn> {
  const fetchMock = ensureFetchMock();
  queue.push(() => Promise.resolve(makeResponse(body, { status, statusText, raw })));
  return fetchMock;
}

/** Queue a fetch that rejects (backend unreachable / network failure). */
export function mockFetchError(message = "Failed to fetch"): ReturnType<typeof vi.fn> {
  const fetchMock = ensureFetchMock();
  queue.push(() => Promise.reject(new TypeError(message)));
  return fetchMock;
}

/**
 * Queue a response whose promise stays pending until `resolve()` is called —
 * lets a test control which of two in-flight requests settles first
 * (late-resolve-clobber races).
 */
export function mockFetchDeferred(
  body: unknown,
  {
    status = 200,
    statusText,
    raw = false,
  }: { status?: number; statusText?: string; raw?: boolean } = {},
): { fetchMock: ReturnType<typeof vi.fn>; resolve: () => void } {
  const fetchMock = ensureFetchMock();
  let settle!: (r: Response) => void;
  const pending = new Promise<Response>((resolvePromise) => {
    settle = resolvePromise;
  });
  queue.push(() => pending);
  return { fetchMock, resolve: () => settle(makeResponse(body, { status, statusText, raw })) };
}

/** The active fetch mock (for call-count assertions). Installs one if needed. */
export function getFetchMock(): ReturnType<typeof vi.fn> {
  return ensureFetchMock();
}
