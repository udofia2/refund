import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RefundRequestsTable from "../RefundRequestsTable";
import { makeCustomer, makeOrder, makeRefundRequest } from "../../test/utils";

const three = makeRefundRequest({
  id: 3,
  created_at: new Date(Date.now() - 3 * 60_000).toISOString(), // 3 minutes ago
  decision: "approved",
  ai_provider: "mock",
  order: { ...makeOrder({ id: 99 }) },
});
const one = makeRefundRequest({
  id: 1,
  created_at: "not-a-date",
  decision: "denied",
  order: null,
  ai_provider: "policy-engine",
  customer: makeCustomer({ id: 9, name: "Dana Lee", email: "dana@example.com" }),
  extracted_data: {
    reason: "item never arrived",
    requested_amount: 55.5,
    order_id: null,
    item_condition: null,
    suspicious_indicators: [],
    confidence: 0.4,
  },
});

function renderTable(
  overrides: Partial<Parameters<typeof RefundRequestsTable>[0]> = {},
) {
  const onSelect = vi.fn();
  const utils = render(
    <RefundRequestsTable
      requests={[three, one]}
      onSelect={onSelect}
      selectedId={null}
      loading={false}
      {...overrides}
    />,
  );
  return { ...utils, onSelect };
}

describe("RefundRequestsTable", () => {
  it("renders row content from list data", () => {
    renderTable();
    expect(screen.getByText("#3")).toBeInTheDocument();
    expect(screen.getByText("Test Customer")).toBeInTheDocument();
    expect(screen.getByText("dana@example.com")).toBeInTheDocument();
    expect(screen.getByText("$142.98")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("Denied")).toBeInTheDocument();
    expect(screen.getByText("3m ago")).toBeInTheDocument();
    expect(screen.getByText("$55.50")).toBeInTheDocument(); // order-less row falls back to extraction
    expect(screen.getByText("mock")).toBeInTheDocument();
    expect(screen.getByText("policy-engine")).toBeInTheDocument();
  });

  it("preserves the input order (the sort is the backend's job)", () => {
    renderTable();
    const rows = screen.getAllByRole("row");
    // header row + 3 + 1
    expect(rows[1]).toHaveTextContent("#3");
    expect(rows[2]).toHaveTextContent("#1");
  });

  it("fires onSelect exactly once when the row is clicked", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderTable();
    await user.click(screen.getByText("#3"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it("fires onSelect exactly once when View is clicked (stopPropagation)", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderTable();
    await user.click(screen.getByRole("button", { name: "View request #1" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("fires onSelect when Enter is pressed on a focused View button", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderTable();
    screen.getByRole("button", { name: "View request #3" }).focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it("applies the selected styling to the selected row", () => {
    renderTable({ selectedId: 3 });
    const row = screen.getByText("#3").closest("tr");
    expect(row?.className).toContain("bg-gray-100");
    expect(screen.getByText("#1").closest("tr")?.className).not.toContain("bg-gray-100");
  });

  it("renders skeleton rows while loading", () => {
    const { container } = renderTable({ loading: true });
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(5);
    expect(screen.queryByText("#3")).not.toBeInTheDocument();
  });

  it("renders the empty state for an empty list", () => {
    renderTable({ requests: [] });
    expect(
      screen.getByText("No refund requests yet. Submit one from the customer view to see it here."),
    ).toBeInTheDocument();
  });

  it("titles unparsable created_at values as 'unparsed'", () => {
    renderTable({ requests: [one] });
    expect(screen.getByText("not-a-date").closest("td")).toHaveAttribute("title", "unparsed");
  });

  it("never leaks the raw model output into any cell", () => {
    const { container } = renderTable();
    expect(container.textContent ?? "").not.toContain("model_output");
  });
});
