import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CustomerSelector from "../CustomerSelector";
import { makeCustomer } from "../../test/utils";

const customers = [
  makeCustomer({ id: 1, name: "Alice Brown", email: "alice@example.com" }),
  makeCustomer({ id: 2, name: "Carlos Diaz", email: "carlos@example.com" }),
];

describe("CustomerSelector", () => {
  it("lists each customer as 'Name (email)'", () => {
    render(<CustomerSelector customers={customers} value={null} onChange={() => {}} />);
    expect(screen.getByRole("option", { name: "Alice Brown (alice@example.com)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Carlos Diaz (carlos@example.com)" })).toBeInTheDocument();
  });

  it("emits a numeric id on change", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CustomerSelector customers={customers} value={null} onChange={onChange} />);
    await user.selectOptions(screen.getByRole("combobox"), "2");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("honours the disabled prop", () => {
    render(<CustomerSelector customers={customers} value={1} onChange={() => {}} disabled />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("shows the placeholder as the initially selected option", () => {
    render(<CustomerSelector customers={customers} value={null} onChange={() => {}} />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    const placeholder = screen.getByRole("option", { name: "Select a customer…" });
    expect(placeholder).toBeDisabled();
    expect(select.value).toBe("");
    expect(placeholder).toHaveProperty("selected", true);
  });
});
