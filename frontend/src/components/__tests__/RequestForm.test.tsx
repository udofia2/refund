import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RequestForm from "../RequestForm";
import { makeCustomer } from "../../test/utils";

const customers = [
  makeCustomer({ id: 1, name: "Alice Brown", email: "alice@example.com" }),
  makeCustomer({ id: 7, name: "Dana Lee", email: "dana@example.com" }),
];

function renderForm(overrides: Partial<Parameters<typeof RequestForm>[0]> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onCustomerChange = vi.fn();
  const utils = render(
    <RequestForm
      customers={customers}
      selectedCustomerId={null}
      onCustomerChange={onCustomerChange}
      orderIds={null}
      onSubmit={onSubmit}
      submitting={false}
      {...overrides}
    />,
  );
  return { ...utils, onSubmit, onCustomerChange };
}

describe("RequestForm", () => {
  it("shows both inline errors and does not submit when invalid", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    const submit = screen.getByRole("button", { name: "Submit refund request" });
    // Task 6 lock-in: the button is NOT disabled while invalid.
    expect(submit).toBeEnabled();
    await user.click(submit);
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toHaveTextContent("Please select a customer.");
    expect(alerts[1]).toHaveTextContent("Please describe the issue.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the trimmed body with order_id null when 'Not sure'", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ selectedCustomerId: 1, orderIds: [3, 4] });
    await user.type(
      screen.getByLabelText(/what went wrong/i),
      "  My item arrived broken  ",
    );
    await user.click(screen.getByRole("button", { name: "Submit refund request" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      customer_id: 1,
      request_text: "My item arrived broken",
      order_id: null,
    });
  });

  it("includes the chosen order id when one is selected", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ selectedCustomerId: 1, orderIds: [3, 4] });
    await user.type(screen.getByLabelText(/what went wrong/i), "Wrong item shipped");
    await user.selectOptions(screen.getByLabelText(/order \(optional\)/i), "4");
    await user.click(screen.getByRole("button", { name: "Submit refund request" }));
    expect(onSubmit).toHaveBeenCalledWith({
      customer_id: 1,
      request_text: "Wrong item shipped",
      order_id: 4,
    });
  });

  it("slices a 2500-char paste to 2000 and shows the counter", async () => {
    const user = userEvent.setup();
    renderForm();
    const textarea = screen.getByLabelText(/what went wrong/i);
    await user.click(textarea);
    await user.paste("a".repeat(2500));
    expect((textarea as HTMLTextAreaElement).value).toHaveLength(2000);
    expect(screen.getByText("2000/2000")).toBeInTheDocument();
  });

  it("disables the form and shows 'Submitting…' while submitting", () => {
    renderForm({ submitting: true, selectedCustomerId: 1, orderIds: [3] });
    const submit = screen.getByRole("button", { name: "Submitting…" });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute("aria-busy", "true");
    expect(screen.getByLabelText(/what went wrong/i)).toBeDisabled();
    expect(screen.getByLabelText("Customer")).toBeDisabled();
  });

  it("clears the text error once the user types", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "Submit refund request" }));
    expect(screen.getByText("Please describe the issue.")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/what went wrong/i), "x");
    expect(screen.queryByText("Please describe the issue.")).not.toBeInTheDocument();
    // the untouched customer error is still showing
    expect(screen.getByText("Please select a customer.")).toBeInTheDocument();
  });

  it("clears the customer error when a customer is chosen", async () => {
    const user = userEvent.setup();
    const { onCustomerChange } = renderForm();
    await user.click(screen.getByRole("button", { name: "Submit refund request" }));
    expect(screen.getByText("Please select a customer.")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Customer"), "1");
    expect(screen.queryByText("Please select a customer.")).not.toBeInTheDocument();
    expect(onCustomerChange).toHaveBeenCalledWith(1);
  });

  it("shows the loading-orders option while orderIds are null", () => {
    renderForm({ orderIds: null });
    expect(screen.getByRole("option", { name: "Loading orders…" })).toBeInTheDocument();
  });
});
