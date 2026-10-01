import {
  getCustomer,
  getHealth,
  getRefundRequest,
  ApiError,
  listCustomers,
  listRefundRequests,
  submitRefundRequest,
} from "../api";
import type { RefundRequestCreate } from "../types";
import {
  makeCustomer,
  makeRefundRequest,
  mockFetchError,
  mockFetchOnce,
} from "../test/utils";

describe("api request layer", () => {
  it("listCustomers returns the parsed array on 200", async () => {
    const customers = [makeCustomer()];
    mockFetchOnce(customers);
    await expect(listCustomers()).resolves.toEqual(customers);
  });

  it("listCustomers throws ApiError(404, parsed string detail)", async () => {
    mockFetchOnce({ detail: "Customer not found" }, { status: 404 });
    const err = await listCustomers().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ name: "ApiError", status: 404, detail: "Customer not found" });
  });

  it("submitRefundRequest returns the created body on 201", async () => {
    const created = makeRefundRequest();
    mockFetchOnce(created, { status: 201 });
    const body: RefundRequestCreate = { customer_id: 1, request_text: "broken", order_id: 1 };
    await expect(submitRefundRequest(body)).resolves.toEqual(created);
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toBe("/api/refund-requests");
    expect(init).toMatchObject({ method: "POST", body: JSON.stringify(body) });
  });

  it("submitRefundRequest throws ApiError(422, detail) on 422", async () => {
    mockFetchOnce({ detail: "Request text is required" }, { status: 422 });
    const err = await submitRefundRequest({ customer_id: 1, request_text: "" }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 422, detail: "Request text is required" });
  });

  it("falls back to statusText when the 500 body is not JSON", async () => {
    mockFetchOnce("<html>oops</html>", { status: 500, raw: true });
    const err = await listCustomers().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 500, detail: "Internal Server Error" });
  });

  it("wraps network failures in ApiError(0, message)", async () => {
    mockFetchError("Failed to fetch");
    const err = await listCustomers().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 0, detail: "Failed to fetch" });
  });

  it("maps a non-Error rejection to ApiError(0, 'Network error')", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject("socket hang up")),
    );
    const err = await listCustomers().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 0, detail: "Network error" });
  });

  it("uses string detail as-is", async () => {
    mockFetchOnce({ detail: "slow down" }, { status: 403 });
    const err = await listCustomers().catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 403, detail: "slow down" });
  });

  it("joins Pydantic array detail messages into one string", async () => {
    mockFetchOnce(
      {
        detail: [
          { loc: ["body", "customer_id"], msg: "Field required", type: "missing" },
          { loc: ["body", "request_text"], msg: "String should have at least 1 character", type: "string_too_short" },
        ],
      },
      { status: 422 },
    );
    const err = await submitRefundRequest({ customer_id: 1, request_text: "" }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 422,
      detail: "Field required; String should have at least 1 character",
    });
  });

  it("keeps statusText when detail is an array with no usable messages", async () => {
    mockFetchOnce({ detail: [{ loc: ["body"], type: "value_error" }] }, { status: 422 });
    const err = await listCustomers().catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 422, detail: "Unprocessable Entity" });
  });

  it("keeps statusText when detail is neither string nor array", async () => {
    mockFetchOnce({ detail: 123 }, { status: 500 });
    const err = await listCustomers().catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 500, detail: "Internal Server Error" });
  });

  it("listRefundRequests builds the query string (contract)", async () => {
    mockFetchOnce([]);
    await listRefundRequests({ limit: 100, offset: 20, decision: "approved" });
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      "/api/refund-requests?limit=100&offset=20&decision=approved",
    );
  });

  it("listRefundRequests omits the query string when no params are given", async () => {
    mockFetchOnce([]);
    await listRefundRequests();
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      "/api/refund-requests",
    );
  });

  it("getHealth returns the health payload (contract)", async () => {
    const health = { status: "ok", provider: "mock" };
    mockFetchOnce(health);
    await expect(getHealth()).resolves.toEqual(health);
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("/api/health");
  });

  it("getCustomer returns a single customer (contract)", async () => {
    const customer = makeCustomer({ id: 5 });
    mockFetchOnce(customer);
    await expect(getCustomer(5)).resolves.toEqual(customer);
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      "/api/customers/5",
    );
  });

  it("getRefundRequest returns one audit record (contract)", async () => {
    const request = makeRefundRequest({ id: 9 });
    mockFetchOnce(request);
    await expect(getRefundRequest(9)).resolves.toEqual(request);
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      "/api/refund-requests/9",
    );
  });
});
