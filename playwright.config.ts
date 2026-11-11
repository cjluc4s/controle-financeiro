import { defineConfig, devices } from '@playwright/test'

const port = 4173

// Localmente usa o Chrome instalado no computador (não precisa baixar navegador); no CI, o Chromium do Playwright.
const channel = process.env.CI ? undefined : 'chrome'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  projects: [
    { name: 'celular', use: { ...devices['Pixel 7'], channel } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel } },
  ],
  // Testa o app já compilado (o mesmo que vai para a Vercel), inclusive o carregamento sob demanda das telas.
  webServer: {
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
