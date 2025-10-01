import { describe, it, expect, vi } from 'vitest'
import { ResourcePool, createResource, withResources } from '../../utils/resources'

describe('ResourcePool', () => {
  it('should add and dispose resources', async () => {
    const pool = new ResourcePool()
    const cleanup = vi.fn()

    pool.add({ dispose: cleanup })

    await pool.dispose()

    expect(cleanup).toHaveBeenCalledOnce()
    expect(pool.isDisposed).toBe(true)
  })

  it('should dispose resources in LIFO order', async () => {
    const pool = new ResourcePool()
    const order: number[] = []

    pool.add({ dispose: () => order.push(1) })
    pool.add({ dispose: () => order.push(2) })
    pool.add({ dispose: () => order.push(3) })

    await pool.dispose()

    expect(order).toEqual([3, 2, 1])
  })

  it('should support addCleanup', async () => {
    const pool = new ResourcePool()
    const cleanup = vi.fn()

    pool.addCleanup(cleanup)

    await pool.dispose()

    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('should handle async disposal', async () => {
    const pool = new ResourcePool()
    const cleanup = vi.fn()

    pool.add({
      dispose: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        cleanup()
      },
    })

    await pool.dispose()

    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('should remove resources', async () => {
    const pool = new ResourcePool()
    const cleanup = vi.fn()
    const resource = { dispose: cleanup }

    pool.add(resource)
    pool.remove(resource)

    await pool.dispose()

    expect(cleanup).not.toHaveBeenCalled()
  })

  it('should not allow adding resources after disposal', async () => {
    const pool = new ResourcePool()

    await pool.dispose()

    expect(() => {
      pool.add({ dispose: () => {} })
    }).toThrow()
  })

  it('should track resource count', () => {
    const pool = new ResourcePool()

    expect(pool.size).toBe(0)

    pool.add({ dispose: () => {} })
    expect(pool.size).toBe(1)

    pool.add({ dispose: () => {} })
    expect(pool.size).toBe(2)
  })

  it('should handle disposal errors gracefully', async () => {
    const pool = new ResourcePool()

    pool.add({
      dispose: () => {
        throw new Error('Disposal error')
      },
    })

    await expect(pool.dispose()).rejects.toThrow('Failed to dispose')
  })
})

describe('createResource', () => {
  it('should create a resource from cleanup function', async () => {
    const cleanup = vi.fn()
    const resource = createResource(cleanup)

    await resource.dispose()

    expect(cleanup).toHaveBeenCalledOnce()
  })
})

describe('withResources', () => {
  it('should auto-dispose resources', async () => {
    const cleanup = vi.fn()

    const result = await withResources(async (pool) => {
      pool.addCleanup(cleanup)
      return 42
    })

    expect(result).toBe(42)
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('should dispose even on errors', async () => {
    const cleanup = vi.fn()

    await expect(
      withResources(async (pool) => {
        pool.addCleanup(cleanup)
        throw new Error('Test error')
      })
    ).rejects.toThrow('Test error')

    expect(cleanup).toHaveBeenCalledOnce()
  })
})
