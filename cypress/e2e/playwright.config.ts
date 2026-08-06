import { defineConfig, stablyReporter } from '@stablyai/playwright-test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Resolve the WebSocket endpoint from the stably-browser daemon.
 * When stably-browser manages a browser session, it stores session info
 * (including the CDP endpoint) in JSON files under the daemon cache directory.
 * This allows Playwright to connect via CDP instead of launching a new browser.
 */
function resolveWsEndpoint(): string | undefined {
  // Prefer explicit env var if set
  if (process.env.PW_TEST_CONNECT_WS_ENDPOINT) {
    return process.env.PW_TEST_CONNECT_WS_ENDPOINT;
  }

  try {
    const daemonBaseDir = path.join(
      process.env.HOME || '/root',
      '.cache',
      'ms-playwright',
      'daemon',
    );

    if (!fs.existsSync(daemonBaseDir)) return undefined;

    // Search all daemon directories for an active session with a cdpEndpoint
    const daemonDirs = fs.readdirSync(daemonBaseDir);
    for (const dir of daemonDirs) {
      const daemonDir = path.join(daemonBaseDir, dir);
      const stat = fs.statSync(daemonDir);
      if (!stat.isDirectory()) continue;

      const sessionFiles = fs.readdirSync(daemonDir).filter(f => f.endsWith('.session'));
      for (const file of sessionFiles) {
        try {
          const content = fs.readFileSync(path.join(daemonDir, file), 'utf-8');
          const session = JSON.parse(content);
          const cdpEndpoint = session?.resolvedConfig?.browser?.cdpEndpoint;
          if (cdpEndpoint) {
            return cdpEndpoint;
          }
        } catch {
          // Skip malformed session files
        }
      }
    }
  } catch {
    // Daemon not running or not accessible - fall back to normal launch
  }

  return undefined;
}

const wsEndpoint = resolveWsEndpoint();

export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  forbidOnly: process.env.CI ? true : false,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 5,
  reporter: [
    ['list'],
    stablyReporter({
      apiKey: process.env.STABLY_API_KEY,
      projectId: process.env.STABLY_PROJECT_ID,
    }),
  ],
  timeout: 1_200_000,
  use: {
    trace: 'on',
    baseURL: 'http://localhost:9090/cypress/e2e',
    ...(wsEndpoint ? { connectOptions: { wsEndpoint } } : {}),
  },
});
