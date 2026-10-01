import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminDashboard from "../AdminDashboard";
import {
  makeCustomer,
  makeRefundRequest,
  mockFetchError,
  mockFetchOnce,
} from "../../test/utils";

function makeRows() {
  return [
    makeRefundRequest({
      id: 1,
      decision: "approved",
      order: null,
      request_text: "Damaged laptop received",
      customer: makeCustomer({ id: 1, name: "Alice Brown", email: "alice@example.com" }),
    }),
    makeRefundRequest({
      id: 2,
      decision: "denied",
      order: null,
      request_text: "Late delivery complaint",
      customer: makeCustomer({ id: 2, name: "Bob Ray", email: "bob@example.com" }),
    }),
    makeRefundRequest({
      id: 3,
      decision: "approved",
      order: null,
      request_text: "Wrong color shipped",
    }),
    makeRefundRequest({
      id: 4,
      decision: "escalated",
      order: null,
      request_text: "Chargeback threat",
    }),
  ];
}

function tileValue(label: string): string | null | undefined {
  const summary = screen.getByLabelText("Decision summary");
  return within(summary).getByText(label).previousElementSibling?.textContent;
}

async function renderLoaded() {
  mockFetchOnce(makeRows());
  const user = userEvent.setup();
  render(<AdminDashboard />);
  await screen.findByText("#1");
  return { user, fetchMock: vi.mocked(globalThis.fetch) };
}

describe("AdminDashboard", () => {
  it("mounts with ONE listRefundRequests({limit:100}) call and renders tiles + table", async () => {
    const { fetchMock } = await renderLoaded();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/refund-requests?limit=100");
    expect(screen.getByLabelText("Decision summary")).toBeInTheDocument();
    expect(tileValue("Total")).toBe("4");
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("filter change fires ZERO fetches, tiles unchanged, table filtered", async () => {
    const { user, fetchMock } = await renderLoaded();
    const before = fetchMock.mock.calls.length;

    await user.click(screen.getByRole("button", { name: "Denied" }));

    // The filter is client-side: zero network calls fired by the click.
    expect(fetchMock.mock.calls.length - before).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Tiles read `all` — unchanged by filtering.
    expect(tileValue("Total")).toBe("4");
    expect(tileValue("Approved")).toBe("2");
    // Table shows only the filtered subset.
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.queryByText("#1")).not.toBeInTheDocument();
    expect(screen.queryByText("#3")).not.toBeInTheDocument();
    expect(screen.queryByText("#4")).not.toBeInTheDocument();
  });

  it("shows the failure banner when the mount fetch fails (no tiles, no table)", async () => {
    mockFetchError("Failed to fetch");
    render(<AdminDashboard />);
    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("Could not load refund requests. Please try again.");
    expect(banner).toHaveTextContent("Failed to fetch");
    expect(screen.queryByLabelText("Decision summary")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("keeps stale tiles + rows when a refresh fails (hasContent logic)", async () => {
    const { user, fetchMock } = await renderLoaded();
    mockFetchError("Failed to fetch");

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("Failed to fetch");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Decision summary")).toBeInTheDocument();
    expect(tileValue("Total")).toBe("4");
    expect(screen.getByText("#1")).toBeInTheDocument();
  });

  it("opens the drawer from list data with zero additional fetches", async () => {
    const { user, fetchMock } = await renderLoaded();

    await user.click(screen.getByText("#1"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Damaged laptop received")).toBeInTheDocument();
    expect(within(dialog).getByText("Alice Brown")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("Escape closes the drawer and returns focus to that row's View button", async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole("button", { name: "View request #2" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close request details" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View request #2" })).toHaveFocus();
  });

  it("closes the drawer when a filter makes the selected row vanish, focus in pills", async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByText("#1"));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Denied" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const pills = screen.getByRole("group", { name: "Filter by decision" });
    expect(pills.contains(document.activeElement)).toBe(true);
  });

  it("refresh refetches once, keeps a surviving drawer, re-derives the filter", async () => {
    const { user, fetchMock } = await renderLoaded();
    await user.click(screen.getByRole("button", { name: "Approved" }));
    await user.click(screen.getByText("#1"));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    mockFetchOnce(makeRows());

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
    expect(screen.queryByText("#2")).not.toBeInTheDocument(); // still filtered client-side
  });

  it("recovers via the banner Retry after a mount failure", async () => {
    mockFetchError("Failed to fetch");
    const user = userEvent.setup();
    render(<AdminDashboard />);
    await screen.findByRole("alert");

    mockFetchOnce(makeRows());
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("#1")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);
  });

  it("falls back to the pills when the View button has disconnected", async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole("button", { name: "View request #1" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    // Simulate the View button having been removed from the DOM before close
    // (reparent/re-render case): focus restore must fall back to the pills.
    screen.getByRole("button", { name: "View request #1" }).remove();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const pills = screen.getByRole("group", { name: "Filter by decision" });
    expect(pills.contains(document.activeElement)).toBe(true);
  });

  it("restores pill focus on a vanished close when nothing else is focused", async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByText("#1"));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    // fireEvent.click does not move focus in jsdom, so the drawer close button
    // is the focused element when the row vanishes → activeElement becomes
    // body → restoreToPills must run.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Denied" }));
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const pills = screen.getByRole("group", { name: "Filter by decision" });
    expect(pills.contains(document.activeElement)).toBe(true);
  });

  it("renders the empty state with zero tiles for an empty list", async () => {
    mockFetchOnce([]);
    render(<AdminDashboard />);
    expect(
      await screen.findByText(
        "No refund requests yet. Submit one from the customer view to see it here.",
      ),
    ).toBeInTheDocument();
    expect(tileValue("Total")).toBe("0");
    expect(tileValue("Approved")).toBe("0");
  });
});
