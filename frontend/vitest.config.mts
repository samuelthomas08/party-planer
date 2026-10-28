import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    css: false,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // Thin route files only wire components together; the components themselves are tested.
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/app/**", "src/i18n/request.ts", "src/messages/**"],
      reporter: ["text-summary", "text", "html"],
    },
  },
});
