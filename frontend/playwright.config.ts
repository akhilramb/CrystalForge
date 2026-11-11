import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:8000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000",
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    url: "http://127.0.0.1:8000/api/health",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
