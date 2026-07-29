import { Scope } from '../scope.js'

describe('Scope', () => {
  it('runs added disposers on dispose, once, in reverse order', () => {
    const scope = new Scope()
    const order: number[] = []
    scope.add(() => order.push(1))
    scope.add(() => order.push(2))
    scope.dispose()
    scope.dispose()
    expect(order).toEqual([2, 1])
  })

  it('disposes children before own disposers', () => {
    const scope = new Scope()
    const order: string[] = []
    scope.add(() => order.push('parent'))
    scope.child().add(() => order.push('child'))
    scope.dispose()
    expect(order).toEqual(['child', 'parent'])
  })

  it('a directly-disposed child detaches from the parent', () => {
    const scope = new Scope()
    const child = scope.child()
    const spy = jest.fn()
    child.add(spy)
    child.dispose()
    scope.dispose()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('child() on an already-disposed parent returns an already-disposed, unattached child', () => {
    const parent = new Scope()
    parent.dispose()

    const child = parent.child()

    // Returned pre-disposed (not merely inert): a disposer added afterward must run immediately,
    // same as calling add() directly on a disposed scope.
    expect(child.disposed).toBe(true)
    const late = jest.fn()
    child.add(late)
    expect(late).toHaveBeenCalledTimes(1)

    // Never attached to the parent's children set (the early-return in Scope.child() skips
    // `this.children.add(child)`) - unlike a child created on a live parent (see "a
    // directly-disposed child detaches from the parent" above, which starts attached).
    expect((parent as any).children.has(child)).toBe(false)
  })

  it('isolates disposer errors', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const scope = new Scope()
    const second = jest.fn()
    scope.add(second)
    scope.add(() => {
      throw new Error('boom')
    })
    scope.dispose()
    expect(second).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('listen removes the DOM listener on dispose', () => {
    const scope = new Scope()
    const el = document.createElement('div')
    const fn = jest.fn()
    scope.listen(el, 'click', fn)
    scope.dispose()
    el.dispatchEvent(new Event('click'))
    expect(fn).not.toHaveBeenCalled()
  })

  it('timeout does not fire after dispose', () => {
    jest.useFakeTimers()
    const scope = new Scope()
    const fn = jest.fn()
    scope.timeout(fn, 100)
    scope.dispose()
    jest.advanceTimersByTime(200)
    expect(fn).not.toHaveBeenCalled()
    jest.useRealTimers()
  })

  it('abortSignal aborts on dispose', () => {
    const scope = new Scope()
    const signal = scope.abortSignal()
    expect(signal.aborted).toBe(false)
    scope.dispose()
    expect(signal.aborted).toBe(true)
  })

  it('refuses new registrations after dispose by running them immediately', () => {
    const scope = new Scope()
    scope.dispose()
    const spy = jest.fn()
    scope.add(spy)
    expect(spy).toHaveBeenCalledTimes(1) // late registration disposed immediately, never leaks
  })

  it('observeResize unobserves element without disconnecting observer', () => {
    const scope = new Scope()
    const el = document.createElement('div')
    const observer = {
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as ResizeObserver
    scope.observeResize(observer, el)
    expect(observer.observe).toHaveBeenCalledWith(el)
    scope.dispose()
    expect(observer.unobserve).toHaveBeenCalledWith(el)
    expect(observer.disconnect).not.toHaveBeenCalled()
  })
})
