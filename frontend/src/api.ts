import type {
  Customer,
  Order,
  RefundRequestCreate,
  RefundRequestResponse,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(`API error ${status}: ${detail}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch (err) {
    // Network-level failure (backend down, CORS, DNS)
    throw new ApiError(0, err instanceof Error ? err.message : "Network error");
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // non-JSON error body — keep statusText
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export async function getHealth(): Promise<{ status: string; provider: string }> {
  return request("/api/health");
}

export async function listCustomers(): Promise<Customer[]> {
  return request("/api/customers");
}

export async function getCustomer(id: number): Promise<Customer> {
  return request(`/api/customers/${id}`);
}

export async function listOrdersForCustomer(customerId: number): Promise<Order[]> {
  return request(`/api/customers/${customerId}/orders`);
}

export async function submitRefundRequest(
  body: RefundRequestCreate,
): Promise<RefundRequestResponse> {
  return request("/api/refund-requests", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
