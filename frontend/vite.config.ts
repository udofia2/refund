import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    css: false,
    pool: "vmThreads",
    isolate: false,
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/main.tsx", "src/**/*.d.ts", "src/test/**", "src/**/__tests__/**"],
      thresholds: {
        "src/components/**": { statements: 80, branches: 75 },
        "src/pages/**": { statements: 80, branches: 75 },
        "src/api.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
        "src/utils/time.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
      },
    },
  },
});
