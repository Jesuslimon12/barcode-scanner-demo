import { defineConfig, devices } from '@playwright/test'

const PORT = 4174

export default defineConfig({
  testDir: 'tests',
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    {
      name: 'mobile',
      // iPhone 15 viewport and touch, on the locally installed Chrome (no browser download needed)
      use: { ...devices['iPhone 15'], browserName: 'chromium', channel: 'chrome' },
    },
  ],
  // Tests the production build, the same thing the tunnel serves
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
})
