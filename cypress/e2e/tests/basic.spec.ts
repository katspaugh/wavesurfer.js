import { test, expect } from '@stablyai/playwright-test';

test.describe('WaveSurfer basic tests', () => {
  /**
   * User Prompt:
   * - Create a basic test
   *
   * Clarifications:
   * - Target: wavesurfer.js demo (based on existing Cypress tests in this repo)
   */

  test.beforeEach(async ({ page }) => {
    // Navigate to the test HTML page that loads WaveSurfer
    await page.goto('/index.html');

    // Wait for WaveSurfer to be available on window
    await page.waitForFunction(() => (window as any).WaveSurfer !== undefined);

    // Create a WaveSurfer instance and wait for it to be ready
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const ws = (window as any).WaveSurfer.create({
          container: '#waveform',
          height: 200,
          waveColor: 'rgb(200, 200, 0)',
          progressColor: 'rgb(100, 100, 0)',
          url: '../../examples/audio/demo.wav',
        });
        (window as any).wavesurfer = ws;
        ws.once('ready', () => resolve());
      });
    });
  });

  test('should instantiate WaveSurfer without errors', async ({ page }) => {
    const isObject = await page.evaluate(() => {
      return typeof (window as any).wavesurfer === 'object';
    });
    expect(isObject).toBe(true);
  });

  test('should load an audio file and report correct duration', async ({ page }) => {
    const duration = await page.evaluate(() => {
      return (window as any).wavesurfer.getDuration().toFixed(2);
    });
    expect(duration).toBe('21.77');
  });

  test('should play and pause audio', async ({ page }) => {
    // Verify initial state
    const initialTime = await page.evaluate(() => {
      return (window as any).wavesurfer.getCurrentTime();
    });
    expect(initialTime).toBe(0);

    // Play and wait a moment
    await page.evaluate(() => {
      (window as any).wavesurfer.play();
    });
    await page.waitForTimeout(1000);

    // Verify playing state
    const isPlaying = await page.evaluate(() => {
      return (window as any).wavesurfer.isPlaying();
    });
    expect(isPlaying).toBe(true);

    // Pause and verify time advanced
    const timeAfterPlay = await page.evaluate(() => {
      const ws = (window as any).wavesurfer;
      ws.pause();
      return ws.getCurrentTime();
    });
    expect(timeAfterPlay).toBeGreaterThan(0);
  });

  test('should set and get volume', async ({ page }) => {
    const volume = await page.evaluate(() => {
      const ws = (window as any).wavesurfer;
      ws.setVolume(0.5);
      return ws.getVolume();
    });
    expect(volume).toBe(0.5);
  });

  test('should set and get muted state', async ({ page }) => {
    const isMuted = await page.evaluate(() => {
      const ws = (window as any).wavesurfer;
      ws.setMuted(true);
      return ws.getMuted();
    });
    expect(isMuted).toBe(true);
  });

  test('should seek to a specific time', async ({ page }) => {
    const currentTime = await page.evaluate(() => {
      const ws = (window as any).wavesurfer;
      ws.setTime(10.1);
      return ws.getCurrentTime();
    });
    expect(currentTime).toBe(10.1);
  });

  test('should destroy wavesurfer without errors', async ({ page }) => {
    const destroyed = await page.evaluate(() => {
      (window as any).wavesurfer.destroy();
      return true;
    });
    expect(destroyed).toBe(true);
  });
});
