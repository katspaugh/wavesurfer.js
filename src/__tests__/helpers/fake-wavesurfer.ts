import type WaveSurfer from '../../wavesurfer.js'

/**
 * The slice of WaveSurfer's public surface the spectrogram plugin's `setup()` actually reads
 * before a real render happens (these fakes never trigger one): `options`, `getWrapper()`,
 * `getDecodedData()`, and `on()`. Six spectrogram suites (spectrogram-destroy,
 * spectrogram-windowed-destroy, spectrogram-fft-size, spectrogram-rendering-mode,
 * spectrogram-praat-options, spectrogram-worker-errors) each hand-rolled a near-identical
 * `createFakeWaveSurfer` returning an object shaped like this and then cast it `as any` at every
 * `plugin._init(...)` call site. This is deliberately narrow -- it is NOT a general-purpose
 * WaveSurfer stand-in for other plugins' tests (hover.test.ts/zoom.test.ts/etc. need a
 * differently-shaped fake and keep their own local ones).
 */
export interface FakeWaveSurfer {
  options: Record<string, unknown>
  getWrapper: () => HTMLElement
  getDecodedData: () => AudioBuffer | null
  on: (...args: any[]) => () => void
}

/**
 * Builds a fake wavesurfer good enough for a spectrogram plugin's `_init()` + `setup()`, with a
 * 600px-wide wrapper (offsetWidth/clientWidth both stubbed, matching every one of the suites this
 * was consolidated from). Pass `overrides` to replace individual fields (e.g. `getDecodedData` to
 * hand the plugin a decoded buffer, or `getWrapper` for a custom wrapper element).
 *
 * Returns `WaveSurfer` (not `FakeWaveSurfer`) so call sites can write `plugin._init(
 * createFakeWaveSurfer())` directly instead of `plugin._init(createFakeWaveSurfer() as any)` --
 * the cast from the narrower fake shape is made once, centrally, here, instead of at every call
 * site across six files.
 */
export function createFakeWaveSurfer(overrides: Partial<FakeWaveSurfer> & Record<string, unknown> = {}): WaveSurfer {
  const wrapper = document.createElement('div')
  Object.defineProperty(wrapper, 'offsetWidth', { value: 600, configurable: true })
  Object.defineProperty(wrapper, 'clientWidth', { value: 600, configurable: true })

  const fake: FakeWaveSurfer = {
    options: {},
    getWrapper: () => wrapper,
    getDecodedData: () => null,
    on: () => () => undefined,
    ...overrides,
  }

  return fake as unknown as WaveSurfer
}
