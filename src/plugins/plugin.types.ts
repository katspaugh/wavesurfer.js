/**
 * Plugin system for WaveSurfer
 * Composition-based architecture instead of inheritance
 */

import type { Stream } from '../streams/index.js'
import type { StateStore } from '../state/store.js'
import type { WaveSurferState } from '../state/state.types.js'
import type { ResourcePool } from '../utils/resources.js'

/**
 * Plugin manifest - metadata about the plugin
 */
export interface PluginManifest {
  /** Unique plugin identifier */
  readonly id: string
  /** Plugin version (semver) */
  readonly version: string
  /** Plugin dependencies (other plugin IDs) */
  readonly dependencies?: string[]
  /** Plugin description */
  readonly description?: string
  /** Plugin author */
  readonly author?: string
}

/**
 * Plugin context - what the plugin has access to
 */
export interface PluginContext {
  /** WaveSurfer state store */
  readonly store: StateStore<WaveSurferState>
  /** Resource pool for cleanup */
  readonly resources: ResourcePool
  /** Container element for the plugin */
  readonly container: HTMLElement
  /** Get reference to the waveform wrapper */
  readonly getWrapper: () => HTMLElement
  /** Get current scroll position */
  readonly getScroll: () => number
  /** Set scroll position */
  readonly setScroll: (pixels: number) => void
  /** Get container width */
  readonly getWidth: () => number
  /** Get audio duration */
  readonly getDuration: () => number
  /** Get decoded audio data */
  readonly getDecodedData: () => AudioBuffer | null
  /** Get media element */
  readonly getMediaElement: () => HTMLMediaElement
}

/**
 * Action that a plugin can expose
 */
export interface PluginAction<TArgs extends any[] = any[], TReturn = any> {
  (...args: TArgs): TReturn
}

/**
 * Plugin instance - what the plugin returns
 */
export interface PluginInstance {
  /** Streams that the plugin exposes */
  readonly streams?: Record<string, Stream<unknown>>
  /** Actions that the plugin exposes */
  readonly actions?: Record<string, PluginAction>
  /** Custom properties */
  [key: string]: unknown
}

/**
 * Plugin factory - creates a plugin instance
 */
export interface Plugin {
  /** Plugin metadata */
  readonly manifest: PluginManifest
  /** Initialize the plugin */
  initialize(context: PluginContext): PluginInstance | Promise<PluginInstance>
}

/**
 * Plugin options type helper
 */
export type PluginOptions<T = unknown> = T

/**
 * Create a plugin factory with options
 */
export type PluginFactory<TOptions = unknown> = (options?: TOptions) => Plugin

/**
 * Type-safe plugin result
 */
export interface RegisteredPlugin<T extends PluginInstance = PluginInstance> {
  readonly manifest: PluginManifest
  readonly instance: T
}
