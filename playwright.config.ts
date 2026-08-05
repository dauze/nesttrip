import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

// Identifiants du compte de test (E2E_TEST_EMAIL / E2E_TEST_PASSWORD) — jamais commités,
// voir .env.e2e.example.
loadEnv({ path: '.env.e2e' });

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx ng serve',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
