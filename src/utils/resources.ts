/**
 * Resource management utilities for automatic cleanup
 * Prevents memory leaks by tracking and disposing resources
 */

export interface Resource {
  dispose(): void | Promise<void>
}

export class ResourcePool implements Resource {
  private resources: Resource[] = []
  private disposed = false

  /**
   * Add a resource to the pool
   * Returns the resource for convenience
   */
  add<T extends Resource>(resource: T): T {
    if (this.disposed) {
      throw new Error('Cannot add resource to disposed pool')
    }
    this.resources.push(resource)
    return resource
  }

  /**
   * Add a cleanup function as a resource
   */
  addCleanup(cleanup: () => void | Promise<void>): void {
    this.add({ dispose: cleanup })
  }

  /**
   * Remove a resource from the pool without disposing it
   */
  remove<T extends Resource>(resource: T): void {
    const index = this.resources.indexOf(resource)
    if (index > -1) {
      this.resources.splice(index, 1)
    }
  }

  /**
   * Dispose all resources in the pool
   * Resources are disposed in reverse order (LIFO)
   */
  async dispose(): Promise<void> {
    if (this.disposed) return

    this.disposed = true

    // Dispose in reverse order
    const resources = [...this.resources].reverse()
    this.resources = []

    const errors: Error[] = []

    for (const resource of resources) {
      try {
        await resource.dispose()
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)))
      }
    }

    // If there were errors, throw them
    if (errors.length > 0) {
      const message = `Failed to dispose ${errors.length} resource(s): ${errors.map((e) => e.message).join(', ')}`
      throw new Error(message)
    }
  }

  /**
   * Check if the pool has been disposed
   */
  get isDisposed(): boolean {
    return this.disposed
  }

  /**
   * Get the number of resources in the pool
   */
  get size(): number {
    return this.resources.length
  }
}

/**
 * Create a resource from a cleanup function
 */
export function createResource(cleanup: () => void | Promise<void>): Resource {
  return { dispose: cleanup }
}

/**
 * Create a scoped resource pool that automatically disposes
 * when the scope function completes
 */
export async function withResources<T>(
  fn: (pool: ResourcePool) => Promise<T> | T
): Promise<T> {
  const pool = new ResourcePool()
  try {
    return await fn(pool)
  } finally {
    await pool.dispose()
  }
}

/**
 * Combine multiple resources into a single resource
 */
export function combineResources(...resources: Resource[]): Resource {
  return {
    async dispose() {
      const errors: Error[] = []

      for (const resource of resources) {
        try {
          await resource.dispose()
        } catch (error) {
          errors.push(error instanceof Error ? error : new Error(String(error)))
        }
      }

      if (errors.length > 0) {
        throw new Error(
          `Failed to dispose ${errors.length} resource(s): ${errors.map((e) => e.message).join(', ')}`
        )
      }
    },
  }
}
