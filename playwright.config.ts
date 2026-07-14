import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/web/e2e",
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:3000", headless: true },
  webServer: {
    command: "NEXT_PUBLIC_API_URL= npm run dev -w web",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
