import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// jsdom gaps: CustomerChat calls scrollIntoView inside requestAnimationFrame
// on every successful submit; jsdom does not implement it (TypeError otherwise).
Element.prototype.scrollIntoView = vi.fn();
window.scrollTo = vi.fn();
