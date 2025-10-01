/**
 * Plugin Manager for WaveSurfer
 * Manages plugin lifecycle and dependencies
 */

import type { Plugin, PluginInstance, PluginContext, RegisteredPlugin } from './plugin.types.js'
import { WaveSurferError, ErrorCode } from '../utils/errors.js'
import { ResourcePool } from '../utils/resources.js'

export class PluginManager {
  private plugins = new Map<string, RegisteredPlugin>()
  private pluginResources = new Map<string, ResourcePool>()

  /**
   * Register a plugin
   */
  async register(plugin: Plugin, context: PluginContext): Promise<RegisteredPlugin> {
    const { id } = plugin.manifest

    // Check if already registered
    if (this.plugins.has(id)) {
      throw new WaveSurferError(
        `Plugin "${id}" is already registered`,
        ErrorCode.PLUGIN_ERROR,
        { pluginId: id }
      )
    }

    // Check dependencies
    this.checkDependencies(plugin)

    // Create resource pool for this plugin
    const resources = new ResourcePool()
    this.pluginResources.set(id, resources)

    // Create plugin-specific context
    const pluginContext: PluginContext = {
      ...context,
      resources,
    }

    try {
      // Initialize the plugin
      const instance = await plugin.initialize(pluginContext)

      // Register the plugin
      const registered: RegisteredPlugin = {
        manifest: plugin.manifest,
        instance,
      }

      this.plugins.set(id, registered)

      return registered
    } catch (error) {
      // Clean up resources on error
      await resources.dispose()
      this.pluginResources.delete(id)

      throw new WaveSurferError(
        `Failed to initialize plugin "${id}": ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.PLUGIN_INIT_ERROR,
        { pluginId: id, originalError: error }
      )
    }
  }

  /**
   * Unregister a plugin
   */
  async unregister(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new WaveSurferError(
        `Plugin "${pluginId}" is not registered`,
        ErrorCode.PLUGIN_ERROR,
        { pluginId }
      )
    }

    // Dispose plugin resources
    const resources = this.pluginResources.get(pluginId)
    if (resources) {
      await resources.dispose()
      this.pluginResources.delete(pluginId)
    }

    this.plugins.delete(pluginId)
  }

  /**
   * Get a registered plugin
   */
  get<T extends PluginInstance = PluginInstance>(pluginId: string): RegisteredPlugin<T> | undefined {
    return this.plugins.get(pluginId) as RegisteredPlugin<T> | undefined
  }

  /**
   * Check if a plugin is registered
   */
  has(pluginId: string): boolean {
    return this.plugins.has(pluginId)
  }

  /**
   * Get all registered plugins
   */
  getAll(): RegisteredPlugin[] {
    return Array.from(this.plugins.values())
  }

  /**
   * Get plugin IDs
   */
  getPluginIds(): string[] {
    return Array.from(this.plugins.keys())
  }

  /**
   * Invoke a plugin action
   */
  invoke<TReturn = any>(pluginId: string, actionName: string, ...args: any[]): TReturn {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new WaveSurferError(
        `Plugin "${pluginId}" is not registered`,
        ErrorCode.PLUGIN_ERROR,
        { pluginId }
      )
    }

    const action = plugin.instance.actions?.[actionName]
    if (!action || typeof action !== 'function') {
      throw new WaveSurferError(
        `Action "${actionName}" not found in plugin "${pluginId}"`,
        ErrorCode.PLUGIN_ERROR,
        { pluginId, actionName }
      )
    }

    return action(...args)
  }

  /**
   * Get a plugin stream
   */
  getStream<T = unknown>(pluginId: string, streamName: string) {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new WaveSurferError(
        `Plugin "${pluginId}" is not registered`,
        ErrorCode.PLUGIN_ERROR,
        { pluginId }
      )
    }

    const stream = plugin.instance.streams?.[streamName]
    if (!stream) {
      throw new WaveSurferError(
        `Stream "${streamName}" not found in plugin "${pluginId}"`,
        ErrorCode.PLUGIN_ERROR,
        { pluginId, streamName }
      )
    }

    return stream as any
  }

  /**
   * Check plugin dependencies
   */
  private checkDependencies(plugin: Plugin): void {
    const { dependencies = [] } = plugin.manifest

    for (const depId of dependencies) {
      if (!this.plugins.has(depId)) {
        throw new WaveSurferError(
          `Plugin "${plugin.manifest.id}" depends on "${depId}", which is not registered`,
          ErrorCode.PLUGIN_ERROR,
          { pluginId: plugin.manifest.id, dependency: depId }
        )
      }
    }
  }

  /**
   * Unregister all plugins
   */
  async unregisterAll(): Promise<void> {
    const pluginIds = Array.from(this.plugins.keys())

    // Unregister in reverse order
    for (const pluginId of pluginIds.reverse()) {
      await this.unregister(pluginId)
    }
  }

  /**
   * Get plugin count
   */
  get count(): number {
    return this.plugins.size
  }
}
