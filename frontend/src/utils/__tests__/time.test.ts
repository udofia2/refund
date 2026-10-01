import { canParseDate, formatAbsoluteTime, formatRelativeTime } from "../time";

const NOW = new Date("2026-10-01T12:00:00.000Z");

function isoAgo(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("formatRelativeTime", () => {
  it("renders 'just now' under a minute", () => {
    expect(formatRelativeTime(isoAgo(30_000))).toBe("just now");
  });

  it("renders minutes under an hour", () => {
    expect(formatRelativeTime(isoAgo(3 * 60_000))).toBe("3m ago");
  });

  it("renders hours under a day", () => {
    expect(formatRelativeTime(isoAgo(2 * 3_600_000))).toBe("2h ago");
  });

  it("renders 'yesterday' at exactly one day", () => {
    expect(formatRelativeTime(isoAgo(26 * 3_600_000))).toBe("yesterday");
  });

  it("renders day counts under a week", () => {
    expect(formatRelativeTime(isoAgo(3 * 86_400_000))).toBe("3d ago");
  });

  it("renders an ISO date at a week or more", () => {
    expect(formatRelativeTime(isoAgo(7 * 86_400_000))).toBe("2026-09-24");
  });

  it("returns the raw string when the input is unparseable", () => {
    expect(formatRelativeTime("not-a-date")).toBe("not-a-date");
  });
});

describe("formatAbsoluteTime", () => {
  it("renders a localized string for a valid timestamp", () => {
    const iso = "2026-09-25T15:52:02.356877";
    expect(formatAbsoluteTime(iso)).toBe(new Date(iso).toLocaleString());
  });

  it("parses 6-digit fractional seconds (backend order_date format)", () => {
    const iso = "2026-09-25T15:52:02.356877";
    expect(canParseDate(iso)).toBe(true);
    expect(formatAbsoluteTime(iso)).not.toBe(iso);
  });

  it("renders an em dash for null, undefined, and empty string", () => {
    expect(formatAbsoluteTime(null)).toBe("—");
    expect(formatAbsoluteTime(undefined)).toBe("—");
    expect(formatAbsoluteTime("")).toBe("—");
  });

  it("returns the raw string when the input is unparseable (no marker language)", () => {
    expect(formatAbsoluteTime("not-a-date")).toBe("not-a-date");
  });
});

describe("canParseDate", () => {
  it("is truthy for a valid ISO timestamp", () => {
    expect(canParseDate("2026-10-01T12:00:00Z")).toBe(true);
  });

  it("is falsy for garbage", () => {
    expect(canParseDate("garbage")).toBe(false);
  });
});
