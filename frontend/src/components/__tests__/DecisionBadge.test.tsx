import { render, screen } from "@testing-library/react";
import DecisionBadge from "../DecisionBadge";

describe("DecisionBadge", () => {
  it("renders approved with green styling", () => {
    render(<DecisionBadge decision="approved" />);
    const badge = screen.getByText("Approved");
    expect(badge.className).toContain("bg-emerald-100");
    expect(badge.className).toContain("text-emerald-800");
  });

  it("renders denied with red styling", () => {
    render(<DecisionBadge decision="denied" />);
    const badge = screen.getByText("Denied");
    expect(badge.className).toContain("bg-red-100");
    expect(badge.className).toContain("text-red-800");
  });

  it("renders escalated with amber styling", () => {
    render(<DecisionBadge decision="escalated" />);
    const badge = screen.getByText("Escalated");
    expect(badge.className).toContain("bg-amber-100");
    expect(badge.className).toContain("text-amber-800");
  });

  it("renders nothing for a null decision", () => {
    const { container } = render(<DecisionBadge decision={null} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Approved")).not.toBeInTheDocument();
    expect(screen.queryByText("Denied")).not.toBeInTheDocument();
    expect(screen.queryByText("Escalated")).not.toBeInTheDocument();
  });
});
