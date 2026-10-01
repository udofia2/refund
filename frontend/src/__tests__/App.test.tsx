import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import App from "../App";

describe("App layout", () => {
  it("renders nav and outlet content", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<App />}>
            <Route path="/" element={<div>customer-home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("customer-home")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Customer" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Admin" })).toBeInTheDocument();
  });
});
