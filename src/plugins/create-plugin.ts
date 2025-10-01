/**
 * Helper for creating plugins
 * Provides utilities for plugin development
 */

import type { Plugin, PluginManifest, PluginContext, PluginInstance, PluginFactory } from './plugin.types.js'
import { Subject, BehaviorSubject, type Stream } from '../streams/index.js'

/**
 * Create a plugin with typed options
 */
export function createPlugin<TOptions = void, TInstance extends PluginInstance = PluginInstance>(
  manifest: PluginManifest,
  initializer: (context: PluginContext, options: TOptions) => TInstance | Promise<TInstance>
): PluginFactory<TOptions> {
  return (options?: TOptions) => ({
    manifest,
    initialize: (context: PluginContext) => initializer(context, options as TOptions),
  })
}

/**
 * Plugin builder for more complex plugins
 */
export class PluginBuilder<TOptions = void> {
  private manifest!: PluginManifest
  private streams: Record<string, Subject<unknown> | BehaviorSubject<unknown>> = {}
  private actions: Record<string, (...args: any[]) => any> = {}
  private customProps: Record<string, unknown> = {}
  private onInit?: (context: PluginContext, options: TOptions) => void | Promise<void>
  private onDestroy?: () => void | Promise<void>

  /**
   * Set plugin manifest
   */
  setManifest(manifest: PluginManifest): this {
    this.manifest = manifest
    return this
  }

  /**
   * Add a stream to the plugin
   */
  addStream<T>(name: string, initialValue?: T): this {
    if (initialValue !== undefined) {
      this.streams[name] = new BehaviorSubject(initialValue)
    } else {
      this.streams[name] = new Subject<T>()
    }
    return this
  }

  /**
   * Add an action to the plugin
   */
  addAction<TArgs extends any[] = any[], TReturn = any>(
    name: string,
    action: (...args: TArgs) => TReturn
  ): this {
    this.actions[name] = action
    return this
  }

  /**
   * Add a custom property
   */
  addProperty(name: string, value: unknown): this {
    this.customProps[name] = value
    return this
  }

  /**
   * Set initialization handler
   */
  onInitialize(handler: (context: PluginContext, options: TOptions) => void | Promise<void>): this {
    this.onInit = handler
    return this
  }

  /**
   * Set destroy handler
   */
  onDestroyHandler(handler: () => void | Promise<void>): this {
    this.onDestroy = handler
    return this
  }

  /**
   * Build the plugin factory
   */
  build(): PluginFactory<TOptions> {
    if (!this.manifest) {
      throw new Error('Plugin manifest is required')
    }

    const manifest = this.manifest
    const streams = this.streams
    const actions = this.actions
    const customProps = this.customProps
    const onInit = this.onInit
    const onDestroy = this.onDestroy

    return (options?: TOptions) => ({
      manifest,
      initialize: async (context: PluginContext) => {
        // Run initialization
        if (onInit) {
          await onInit(context, options as TOptions)
        }

        // Add cleanup if needed
        if (onDestroy) {
          context.resources.add({ dispose: onDestroy })
        }

        // Complete streams on cleanup
        context.resources.addCleanup(() => {
          Object.values(streams).forEach((stream) => {
            if (!stream.closed) {
              stream.complete()
            }
          })
        })

        return {
          streams,
          actions,
          ...customProps,
        }
      },
    })
  }
}

/**
 * Create a simple plugin with actions only
 */
export function createActionPlugin<TOptions = void>(
  manifest: PluginManifest,
  actions: (context: PluginContext, options: TOptions) => Record<string, (...args: any[]) => any>
): PluginFactory<TOptions> {
  return createPlugin(manifest, (context, options) => ({
    actions: actions(context, options),
  }))
}

/**
 * Create a plugin with streams only
 */
export function createStreamPlugin<TOptions = void>(
  manifest: PluginManifest,
  setup: (
    context: PluginContext,
    options: TOptions
  ) => Record<string, Subject<unknown> | BehaviorSubject<unknown>>
): PluginFactory<TOptions> {
  return createPlugin(manifest, (context, options) => {
    const streams = setup(context, options)

    // Complete streams on cleanup
    context.resources.addCleanup(() => {
      Object.values(streams).forEach((stream) => {
        if (!stream.closed) {
          stream.complete()
        }
      })
    })

    return { streams }
  })
}

/**
 * Combine multiple plugins into one
 */
export function combinePlugins(manifest: PluginManifest, plugins: Plugin[]): Plugin {
  return {
    manifest,
    initialize: async (context: PluginContext) => {
      const instances = await Promise.all(plugins.map((plugin) => plugin.initialize(context)))

      // Merge all streams and actions
      const combinedStreams: Record<string, Stream<unknown>> = {}
      const combinedActions: Record<string, (...args: any[]) => any> = {}

      for (const instance of instances) {
        if (instance.streams) {
          Object.assign(combinedStreams, instance.streams)
        }
        if (instance.actions) {
          Object.assign(combinedActions, instance.actions)
        }
      }

      return {
        streams: combinedStreams,
        actions: combinedActions,
      }
    },
  }
}
