import { render, screen } from "@testing-library/react";
import ResponseCard from "../ResponseCard";
import { makeRefundRequest } from "../../test/utils";

describe("ResponseCard", () => {
  it("renders the AI message, badge, and details disclosure", () => {
    const { container } = render(
      <ResponseCard
        response={makeRefundRequest({
          decision: "approved",
          decision_reason: "sentinel-reason: Customer reports damaged or incorrect item.",
          ai_provider: "mock",
        })}
      />,
    );
    expect(
      screen.getByText("Hi, good news — your refund has been approved."),
    ).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    // jsdom keeps closed <details> children in the DOM — query without expanding.
    expect(screen.getByText(/sentinel-reason/)).toBeInTheDocument();
    expect(container.textContent).toContain("Message by: mock provider");
  });

  it("never renders extracted_data or the raw model output key", () => {
    const { container } = render(
      <ResponseCard
        response={makeRefundRequest({
          decision_reason: "sentinel-reason: policy applied",
        })}
      />,
    );
    // Disjoint sentinels: extracted_data.reason must be absent while
    // decision_reason (which mentions the sentinel) is present.
    expect(screen.queryByText(/sentinel-extract/)).not.toBeInTheDocument();
    expect(screen.getByText(/sentinel-reason/)).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("model_output");
  });

  it("renders without crashing when the decision is null", () => {
    render(
      <ResponseCard
        response={makeRefundRequest({
          decision: null,
          decision_reason: null,
          ai_response: "We could not decide automatically.",
        })}
      />,
    );
    expect(screen.getByText("We could not decide automatically.")).toBeInTheDocument();
    expect(screen.queryByText(/^(Approved|Denied|Escalated)$/)).not.toBeInTheDocument();
  });
});
