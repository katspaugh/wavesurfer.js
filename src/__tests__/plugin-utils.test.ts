import { Scope } from '../scope'
import EventEmitter from '../event-emitter'
import { resolveContainer, overlayElement, bridgeEvents } from '../plugin-utils'

describe('plugin-utils', () => {
  it('resolveContainer resolves selector, element, and fallback; throws with plugin name', () => {
    const el = document.createElement('div')
    el.id = 'host'
    document.body.appendChild(el)
    const fallback = document.createElement('div')

    expect(resolveContainer('#host', fallback, 'test')).toBe(el)
    expect(resolveContainer(el, fallback, 'test')).toBe(el)
    expect(resolveContainer(undefined, fallback, 'test')).toBe(fallback)
    expect(() => resolveContainer('#missing', fallback, 'test')).toThrow(/test/)

    el.remove()
  })

  it('overlayElement appends absolutely-positioned div and removes it on scope dispose', () => {
    const scope = new Scope()
    const parent = document.createElement('div')
    const overlay = overlayElement(scope, parent, { zIndex: '4' })

    expect(overlay.parentElement).toBe(parent)
    expect(overlay.style.position).toBe('absolute')
    expect(overlay.style.zIndex).toBe('4')

    scope.dispose()
    expect(overlay.parentElement).toBeNull()
  })

  it('bridgeEvents forwards named events and stops on dispose', () => {
    const scope = new Scope()

    class Src extends EventEmitter<{ a: [number]; b: [] }> {
      fire() {
        this.emit('a', 1)
      }
    }

    class Dst extends EventEmitter<{ a: [number]; b: [] }> {}

    const src = new Src()
    const dst = new Dst()
    const spy = jest.fn()

    dst.on('a', spy)

    // Bridge events from src to dst via a simple emit wrapper
    bridgeEvents(scope, src, { emit: (e, ...args) => (dst as any).emit(e, ...args) }, ['a'])

    src.fire()
    expect(spy).toHaveBeenCalledWith(1)

    scope.dispose()
    src.fire()
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
