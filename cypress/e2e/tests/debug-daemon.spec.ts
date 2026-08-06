import { test } from '@stablyai/playwright-test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

test('debug daemon session files', async () => {
  // Read the full session JSON
  const sessionPath = '/root/.cache/ms-playwright/daemon/467937613e6319fa/__sub__ac697d7a4eaa092b9.session';
  const content = fs.readFileSync(sessionPath, 'utf-8');
  const session = JSON.parse(content);
  console.log('Full session keys:', Object.keys(session));
  console.log('socketPath:', session.socketPath);
  console.log('resolvedConfig:', JSON.stringify(session.resolvedConfig, null, 2).slice(0, 1000));

  // Check if there's a wsEndpoint or cdpEndpoint
  console.log('wsEndpoint:', session.wsEndpoint);
  console.log('cdpEndpoint:', session.cdpEndpoint);
  console.log('browser:', JSON.stringify(session.browser, null, 2));

  // Check the cli config file
  if (session.cli?.config && fs.existsSync(session.cli.config)) {
    const cliConfig = fs.readFileSync(session.cli.config, 'utf-8');
    console.log('cli config:', cliConfig.slice(0, 500));
  }

  // Check /tmp/playwright-cli directory
  const tmpDir = '/tmp/playwright-cli/467937613e6319fa';
  if (fs.existsSync(tmpDir)) {
    console.log('tmp dir files:', fs.readdirSync(tmpDir));
  }
});
