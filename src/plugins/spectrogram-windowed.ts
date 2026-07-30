/**
 * Windowed Spectrogram plugin - Optimized for very long audio files
 *
 * @deprecated Use `SpectrogramPlugin.create({ rendering: 'windowed', ... })` instead. This
 * plugin is now a thin, option-name-mapping shim over the merged `spectrogram.ts` plugin's
 * `rendering: 'windowed'` strategy - it delegates straight into `spectrogramSetup()`, forcing
 * `rendering: 'windowed'` and mapping this plugin's (identical, historical) option names onto
 * `SpectrogramPluginOptions`. It is kept only so existing
 * `import WindowedSpectrogramPlugin from 'wavesurfer.js/plugins/spectrogram-windowed'`
 * call sites keep working; the actual windowed rendering strategy - the segment map, eviction,
 * uncovered-range detection, and progressive loading - lives in exactly one place now:
 * `spectrogram-windowing.ts`, shared by both entry points. See spectrogram.ts's own
 * `spectrogramSetup` doc comment for the delegation. This "delegate at the setup-function level"
 * form was chosen over either a pure `SpectrogramPlugin.create({...})`-returning factory (can't
 * satisfy this plugin's pre-`_init()` option-validation-throws-synchronously contract on its own
 * - see the validateOptions wrapper below) or a `class WindowedSpectrogramPlugin extends
 * SpectrogramPlugin` (same `_init()` gating problem, plus a second, redundant plugin instance).
 *
 * Only renders frequency data in a sliding window around the current viewport, keeping memory
 * usage constant regardless of audio length.
 */

import { type BasePluginEvents } from '../base-plugin.js'
import { definePlugin } from '../define-plugin.js'
import { spectrogramSetup, validateOptions, type SpectrogramPluginOptions, type Api } from '../spectrogram-setup.js'

// Imported here (not in spectrogram-setup.ts) so the worker constructor can be injected into
// spectrogramSetup - see spectrogram-setup.ts's own comment on the WorkerCtor param for why.
import SpectrogramWorker from 'web-worker:./spectrogram-worker.ts'

/**
 * Identical shape to `SpectrogramPluginOptions` minus the fields that only make sense in
 * 'full' mode ('rendering' itself is forced to 'windowed' below; frequenciesDataUrl/autoGain
 * have no windowed equivalent - see their doc comments on SpectrogramPluginOptions;
 * maxCanvasWidth only applies to full mode's fixed-size canvas pagination). Field names and
 * semantics are otherwise byte-for-byte what the pre-unification WindowedSpectrogramPlugin
 * accepted.
 */
export type WindowedSpectrogramPluginOptions = Omit<
  SpectrogramPluginOptions,
  'rendering' | 'frequenciesDataUrl' | 'autoGain' | 'maxCanvasWidth'
>

export type WindowedSpectrogramPluginEvents = BasePluginEvents & {
  ready: []
  click: [relativeX: number]
  /** Progress from 0 to 1 */
  progress: [progress: number]
  error: [error: Error]
}

/**
 * Every check that must fail synchronously at construction time - see spectrogram.ts's
 * `validateOptions` for why. WindowedSpectrogramPluginOptions and SpectrogramPluginOptions
 * share every validated field's name and semantics 1:1, so no option mapping is needed here.
 */
function validateWindowedOptions(options: WindowedSpectrogramPluginOptions): void {
  validateOptions(options as SpectrogramPluginOptions)
}

const WindowedDefined = definePlugin<WindowedSpectrogramPluginOptions, WindowedSpectrogramPluginEvents, Api>(
  'WindowedSpectrogramPlugin',
  (ctx, rawOptions) => spectrogramSetup(ctx, { ...(rawOptions ?? {}), rendering: 'windowed' }, SpectrogramWorker),
)

/**
 * Thin wrapper mirroring spectrogram.ts's own `SpectrogramPlugin` class - see its doc comment
 * for why create-time validation needs a constructor, not just a check inside setup().
 */
class WindowedSpectrogramPlugin extends WindowedDefined {
  constructor(options?: WindowedSpectrogramPluginOptions) {
    super(options)
    validateWindowedOptions(options ?? {})
  }

  static create(options?: WindowedSpectrogramPluginOptions) {
    return new WindowedSpectrogramPlugin(options)
  }
}

export default WindowedSpectrogramPlugin
