/**
 * Spectrogram plugin
 *
 * Render a spectrogram visualisation of the audio.
 *
 * @author Pavel Denisov (https://github.com/akreal)
 * @see https://github.com/wavesurfer-js/wavesurfer.js/pull/337
 *
 * @example
 * // ... initialising wavesurfer with the plugin
 * var wavesurfer = WaveSurfer.create({
 *   // wavesurfer options ...
 *   plugins: [
 *     SpectrogramPlugin.create({
 *       // plugin options ...
 *     })
 *   ]
 * });
 */

// The actual implementation (option/event types, validation, and the definePlugin setup
// function) lives in ../spectrogram-setup.ts, OUTSIDE src/plugins/ - see that file's own doc
// comment for why: rollup.config.js builds every src/plugins/*.ts file as its own standalone
// dist entry with a single default export (CJS/UMD `output.exports: 'default'`), and
// spectrogramSetup/validateOptions need to be real named exports so the deprecated
// spectrogram-windowed.ts shim can delegate straight into them.
import { definePlugin } from '../define-plugin.js'
import {
  spectrogramSetup,
  validateOptions,
  type SpectrogramPluginOptions,
  type SpectrogramPluginEvents,
  type Api,
} from '../spectrogram-setup.js'

// Imported here (not in spectrogram-setup.ts) so the worker constructor can be injected into
// spectrogramSetup - see that file's own comment on the WorkerCtor param for why.
import SpectrogramWorker from 'web-worker:./spectrogram-worker.ts'

export type { SpectrogramPluginOptions, SpectrogramPluginEvents }

const Defined = definePlugin<SpectrogramPluginOptions, SpectrogramPluginEvents, Api>('SpectrogramPlugin', (ctx, options) =>
  spectrogramSetup(ctx, options, SpectrogramWorker),
)

/**
 * Thin wrapper around the definePlugin()-produced class, whose only job is to run
 * validateOptions() synchronously in the constructor - see validateOptions' own comment (in
 * ../spectrogram-setup.ts) for why this can't just live in setup(). Everything else (the
 * actual render/cache/worker behavior, the Api surface) is unchanged; TS structurally carries
 * `Defined`'s `BasePlugin<Events,Options> & Api` instance shape and `create()`/constructor
 * signature through the `extends`, so consumers see the same type as before.
 */
class SpectrogramPlugin extends Defined {
  constructor(options?: SpectrogramPluginOptions) {
    super(options)
    validateOptions(options ?? {})
  }

  static create(options?: SpectrogramPluginOptions) {
    return new SpectrogramPlugin(options)
  }
}

export default SpectrogramPlugin
