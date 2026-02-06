import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Sequencial para evitar race conditions no DB
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1, // Single worker para testes determinísticos
  reporter: [
    ['list'],
    ['html', { outputFolder: '/e2e-artifacts/report', open: 'never' }],
    ['json', { outputFile: '/e2e-artifacts/results.json' }]
  ],
  
  use: {
    baseURL: process.env.BASE_URL || 'http://guarda-app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  timeout: 60000,
  expect: {
    timeout: 10000,
  },

  outputDir: '/e2e-artifacts/test-results',

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
