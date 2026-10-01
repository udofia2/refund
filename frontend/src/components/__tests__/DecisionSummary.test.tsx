import { render, screen, within } from "@testing-library/react";
import DecisionSummary from "../DecisionSummary";
import { makeRefundRequest } from "../../test/utils";

function valueOf(label: string): string | null | undefined {
  const summary = screen.getByLabelText("Decision summary");
  return within(summary).getByText(label).previousElementSibling?.textContent;
}

describe("DecisionSummary", () => {
  const mixed = [
    makeRefundRequest({ id: 1, decision: "approved" }),
    makeRefundRequest({ id: 2, decision: "approved" }),
    makeRefundRequest({ id: 3, decision: "denied" }),
    makeRefundRequest({ id: 4, decision: "escalated" }),
  ];

  it("counts each decision and the total", () => {
    render(<DecisionSummary requests={mixed} />);
    expect(valueOf("Total")).toBe("4");
    expect(valueOf("Approved")).toBe("2");
    expect(valueOf("Denied")).toBe("1");
    expect(valueOf("Escalated")).toBe("1");
  });

  it("renders zeros for an empty list", () => {
    render(<DecisionSummary requests={[]} />);
    expect(valueOf("Total")).toBe("0");
    expect(valueOf("Approved")).toBe("0");
    expect(valueOf("Denied")).toBe("0");
    expect(valueOf("Escalated")).toBe("0");
  });

  it("re-renders purely when props change", () => {
    const { rerender } = render(<DecisionSummary requests={mixed} />);
    expect(valueOf("Total")).toBe("4");
    rerender(<DecisionSummary requests={mixed.slice(0, 2)} />);
    expect(valueOf("Total")).toBe("2");
    expect(valueOf("Approved")).toBe("2");
    expect(valueOf("Denied")).toBe("0");
  });
});
