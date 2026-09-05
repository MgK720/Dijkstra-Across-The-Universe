import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const localChrome =
  'C:/Users/Igor/AppData/Local/ms-playwright/chromium-1169/chrome-win/chrome.exe';
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 1536, height: 960 },
    headless: true,
    launchOptions: {
      ...(existsSync(localChrome) ? { executablePath: localChrome } : {}),
      args: ['--use-angle=swiftshader', '--enable-webgl', '--no-sandbox'],
    },
    screenshot: 'only-on-failure',
  },
  reporter: [['list'], ['json', { outputFile: 'tests/browser-results.json' }]],
});
