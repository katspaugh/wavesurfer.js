/**
 * Builds a minimal AudioBuffer-shaped object backed by a single Float32Array channel. Every
 * spectrogram compute path exercised by this repo's tests only reads sampleRate/length/duration/
 * numberOfChannels/getChannelData(0) -- several spectrogram suites independently hand-rolled this
 * identical five-field object literal (defaulting to an 8kHz sample rate) before it was pulled
 * out here.
 */
export function createFakeAudioBuffer(signal: Float32Array, overrides: { sampleRate?: number } = {}): AudioBuffer {
  const sampleRate = overrides.sampleRate ?? 8000
  return {
    sampleRate,
    length: signal.length,
    duration: signal.length / sampleRate,
    numberOfChannels: 1,
    getChannelData: () => signal,
  } as unknown as AudioBuffer
}

/**
 * jsdom ships no Web Audio API at all (`typeof AudioBuffer === 'undefined'`), but decoder.ts's
 * real (unmocked) `Decoder.createBuffer()` reads `AudioBuffer.prototype.copyFromChannel`/
 * `copyToChannel` to populate its returned object. Installs a minimal global `AudioBuffer` stub,
 * idempotently, so that read doesn't throw. Call once from a suite that exercises the real decode
 * path without mocking AudioContext/AudioBuffer itself (memory-leaks.test.ts, gc-leaks.test.ts).
 */
export function ensureGlobalAudioBufferStub(): void {
  if (typeof (globalThis as { AudioBuffer?: unknown }).AudioBuffer === 'undefined') {
    class FakeAudioBuffer {
      copyFromChannel(): void {}
      copyToChannel(): void {}
    }
    ;(globalThis as { AudioBuffer?: unknown }).AudioBuffer = FakeAudioBuffer
  }
}
