import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CustomerChat from "../CustomerChat";
import {
  makeCustomer,
  makeOrder,
  makeRefundRequest,
  mockFetchDeferred,
  mockFetchError,
  mockFetchOnce,
} from "../../test/utils";

const customers = [
  makeCustomer({ id: 1, name: "Alice Brown", email: "alice@example.com" }),
  makeCustomer({ id: 2, name: "Bob Ray", email: "bob@example.com" }),
];

async function renderLoadedChat() {
  mockFetchOnce(customers);
  const user = userEvent.setup();
  render(<CustomerChat />);
  await screen.findByLabelText("Customer");
  return user;
}

describe("CustomerChat", () => {
  it("loads customers once on mount and renders the selector", async () => {
    await renderLoadedChat();
    const fetchMock = vi.mocked(globalThis.fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/customers");
    expect(screen.getByLabelText("Customer")).toBeInTheDocument();
  });

  it("fetches orders for the selected customer and offers 'Not sure' + ids", async () => {
    const user = await renderLoadedChat();
    mockFetchOnce([makeOrder({ id: 10 }), makeOrder({ id: 11 })]);
    await user.selectOptions(screen.getByLabelText("Customer"), "1");
    await screen.findByLabelText(/order \(optional\)/i);
    expect(screen.getByRole("option", { name: "Not sure" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Order #10" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Order #11" })).toBeInTheDocument();
    expect(vi.mocked(globalThis.fetch).mock.calls[1][0]).toBe("/api/customers/1/orders");
  });

  it("late-resolve-clobber race: a slow A response cannot clobber B's orders", async () => {
    const user = await renderLoadedChat();
    const slowA = mockFetchDeferred([makeOrder({ id: 10 })]);
    const fastB = mockFetchDeferred([makeOrder({ id: 20 }), makeOrder({ id: 21 })]);

    await user.selectOptions(screen.getByLabelText("Customer"), "1"); // A — stays pending
    await user.selectOptions(screen.getByLabelText("Customer"), "2"); // B

    fastB.resolve();
    await screen.findByRole("option", { name: "Order #20" });

    // A resolves LAST — the sequence guard must ignore it.
    slowA.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.queryByRole("option", { name: "Order #10" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Order #20" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Order #21" })).toBeInTheDocument();
    expect((screen.getByLabelText("Customer") as HTMLSelectElement).value).toBe("2");
  });

  it("submits the POST body and renders the response card", async () => {
    const user = await renderLoadedChat();
    mockFetchOnce([makeOrder({ id: 10 })]);
    await user.selectOptions(screen.getByLabelText("Customer"), "1");
    await user.selectOptions(await screen.findByLabelText(/order \(optional\)/i), "10");
    await user.type(screen.getByLabelText(/what went wrong/i), "Headphones arrived cracked");

    const created = makeRefundRequest({ decision: "approved" });
    mockFetchOnce(created, { status: 201 });
    await user.click(screen.getByRole("button", { name: "Submit refund request" }));

    await screen.findByText("Hi, good news — your refund has been approved.");
    const post = vi
      .mocked(globalThis.fetch)
      .mock.calls.find(
        ([url, init]) =>
          String(url).endsWith("/api/refund-requests") &&
          (init as RequestInit | undefined)?.method === "POST",
      );
    expect(post).toBeDefined();
    expect(JSON.parse(String((post![1] as RequestInit).body))).toEqual({
      customer_id: 1,
      request_text: "Headphones arrived cracked",
      order_id: 10,
    });
    expect(screen.getByRole("button", { name: "New request" })).toBeInTheDocument();
  });

  it("shows a submit banner on 500, preserves the text, and renders no card", async () => {
    const user = await renderLoadedChat();
    mockFetchOnce([makeOrder({ id: 10 })]);
    await user.selectOptions(screen.getByLabelText("Customer"), "1");
    await user.type(screen.getByLabelText(/what went wrong/i), "My order is broken");

    mockFetchOnce({ detail: "AI provider exploded" }, { status: 500 });
    await user.click(screen.getByRole("button", { name: "Submit refund request" }));

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("Could not submit your request. Please try again.");
    expect(banner).toHaveTextContent("API error 500: AI provider exploded");
    expect(screen.getByLabelText(/what went wrong/i)).toHaveValue("My order is broken");
    expect(screen.queryByRole("region", { name: "Refund decision" })).not.toBeInTheDocument();
  });

  it("shows a load-error banner when customers fail, and Retry refetches", async () => {
    mockFetchError("Failed to fetch");
    const user = userEvent.setup();
    render(<CustomerChat />);
    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("Failed to fetch");

    mockFetchOnce(customers);
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByLabelText("Customer");
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Failed to fetch")).not.toBeInTheDocument();
  });

  it("keeps the load-error banner when Retry also fails", async () => {
    mockFetchError("Failed to fetch");
    const user = userEvent.setup();
    render(<CustomerChat />);
    await screen.findByRole("alert");

    mockFetchError("still down");
    await user.click(screen.getByRole("button", { name: "Retry" }));

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("API error 0: still down");
    expect(screen.queryByLabelText("Customer")).not.toBeInTheDocument();
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);
  });

  it("shows an inline orders error when the orders fetch fails", async () => {
    const user = await renderLoadedChat();
    mockFetchError("Failed to fetch");
    await user.selectOptions(screen.getByLabelText("Customer"), "1");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not load orders: API error 0: Failed to fetch");
  });

  it("'New request' clears the card and textarea but keeps the customer", async () => {
    const user = await renderLoadedChat();
    mockFetchOnce([makeOrder({ id: 10 })]);
    await user.selectOptions(screen.getByLabelText("Customer"), "1");
    await user.type(screen.getByLabelText(/what went wrong/i), "Cracked casing");
    mockFetchOnce(makeRefundRequest({ decision: "approved" }), { status: 201 });
    await user.click(screen.getByRole("button", { name: "Submit refund request" }));
    await screen.findByRole("region", { name: "Refund decision" });

    await user.click(screen.getByRole("button", { name: "New request" }));
    expect(screen.queryByRole("region", { name: "Refund decision" })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/what went wrong/i)).toHaveValue("");
    expect((screen.getByLabelText("Customer") as HTMLSelectElement).value).toBe("1");
  });
});
