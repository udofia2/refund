import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RefundRequestDetail from "../RefundRequestDetail";
import { makeOrderItem, makeRefundRequest } from "../../test/utils";

function renderDetail(
  overrides: Partial<Parameters<typeof RefundRequestDetail>[0]> = {},
) {
  const onClose = vi.fn();
  const utils = render(
    <RefundRequestDetail request={null} onClose={onClose} {...overrides} />,
  );
  return { ...utils, onClose };
}

describe("RefundRequestDetail", () => {
  it("renders nothing for null + loading=false", () => {
    const { container } = renderDetail();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders every audit section for a full request", () => {
    renderDetail({
      request: makeRefundRequest({
        order: {
          id: 1,
          customer_id: 1,
          order_date: "2026-09-25T15:52:02.356877",
          total_amount: 142.98,
          status: "delivered",
          items: [makeOrderItem({ is_final_sale: true })],
        },
        extracted_data: {
          reason: "item arrived damaged",
          requested_amount: 120,
          order_id: 1,
          item_condition: "opened",
          suspicious_indicators: ["ignore previous"],
          confidence: 0.82,
        },
      }),
    });
    for (const name of [
      "Customer",
      "Order",
      "Original request",
      "AI extraction",
      "Decision reasoning",
      "AI response",
      "Metadata",
    ]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
    expect(screen.getByText("Final sale")).toBeInTheDocument();
    expect(screen.getByText("ignore previous")).toBeInTheDocument();
    expect(screen.getByText("82%")).toBeInTheDocument();
    expect(screen.getByText("My order arrived damaged")).toBeInTheDocument();
  });

  it("shows decision fields and falls back to an em dash when absent", () => {
    const first = renderDetail({ request: makeRefundRequest() });
    expect(screen.getByText(/sentinel-reason/)).toBeInTheDocument();
    expect(screen.getByText(/refund has been approved/)).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Metadata" })).getByText("mock"),
    ).toBeInTheDocument();
    first.unmount();

    renderDetail({
      request: makeRefundRequest({
        decision_reason: null,
        ai_response: null,
        ai_provider: null,
        updated_at: "2026-10-01T05:00:00",
      }),
    });
    expect(
      within(screen.getByRole("region", { name: "Decision reasoning" })).getByText("—"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "AI response" })).getByText("—"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Metadata" })).getByText("—"),
    ).toBeInTheDocument();
  });

  it("omits the Order section when there is no order", () => {
    renderDetail({ request: makeRefundRequest({ order: null }) });
    expect(screen.queryByRole("region", { name: "Order" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Customer" })).toBeInTheDocument();
  });

  it("never leaks the raw model output into the drawer", () => {
    renderDetail({ request: makeRefundRequest() });
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent ?? "").not.toContain("model_output");
  });

  it("focuses the close button when opened", () => {
    renderDetail({ request: makeRefundRequest() });
    expect(screen.getByRole("button", { name: "Close request details" })).toHaveFocus();
  });

  it("calls onClose on Escape", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDetail({ request: makeRefundRequest() });
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on overlay mousedown on desktop (>=768px)", () => {
    const { onClose } = renderDetail({ request: makeRefundRequest() });
    fireEvent.mouseDown(document.querySelector('[aria-hidden="true"]')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when the mousedown happens inside the dialog", () => {
    const { onClose } = renderDetail({ request: makeRefundRequest() });
    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not close on overlay mousedown on mobile (<768px)", () => {
    Object.defineProperty(window, "innerWidth", { value: 500, configurable: true });
    try {
      const { onClose } = renderDetail({ request: makeRefundRequest() });
      fireEvent.mouseDown(document.querySelector('[aria-hidden="true"]')!);
      expect(onClose).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
    }
  });

  it("shows an em dash for a null updated_at in Metadata", () => {
    renderDetail({ request: makeRefundRequest({ updated_at: null }) });
    const metadata = screen.getByRole("region", { name: "Metadata" });
    expect(within(metadata).getByText("—")).toBeInTheDocument();
  });

  it("renders 'No extraction data.' when extracted_data is null", () => {
    renderDetail({ request: makeRefundRequest({ extracted_data: null }) });
    expect(screen.getByText("No extraction data.")).toBeInTheDocument();
  });

  it("renders 'none' when there are no suspicious indicators", () => {
    renderDetail({ request: makeRefundRequest() });
    expect(screen.getByText("none")).toBeInTheDocument();
  });

  it("renders item prices from the order", () => {
    renderDetail({
      request: makeRefundRequest({
        order: {
          id: 5,
          customer_id: 1,
          order_date: "2026-09-25T15:52:02.356877",
          total_amount: 99.99,
          status: "delivered",
          items: [makeOrderItem({ product_name: "USB Cable", price: 9.99, quantity: 2, is_final_sale: false })],
        },
      }),
    });
    expect(screen.getByText("USB Cable")).toBeInTheDocument();
    expect(screen.getByText("$9.99")).toBeInTheDocument();
    expect(screen.getByText("Total $99.99")).toBeInTheDocument();
    expect(screen.queryByText("Final sale")).not.toBeInTheDocument();
  });
});
