/**
 * A disposal tree: the single ownership primitive for listeners, timers,
 * observers, signals subscriptions and child lifetimes. destroy() anywhere
 * in wavesurfer is expressed as disposing a scope.
 */
export class Scope {
  private disposers: Array<() => void> = []
  private children = new Set<Scope>()
  private parent: Scope | null = null
  private _disposed = false
  private abortController: AbortController | null = null

  get disposed(): boolean {
    return this._disposed
  }

  /** Register a disposer. Returns a function that runs it early and deregisters it. */
  add(dispose: () => void): () => void {
    if (this._disposed) {
      // Late registration: dispose immediately so nothing can leak past dispose()
      this.safeRun(dispose)
      return () => undefined
    }
    this.disposers.push(dispose)
    return () => {
      const index = this.disposers.indexOf(dispose)
      if (index !== -1) {
        this.disposers.splice(index, 1)
        this.safeRun(dispose)
      }
    }
  }

  child(): Scope {
    const child = new Scope()
    if (this._disposed) {
      child.dispose()
      return child
    }
    child.parent = this
    this.children.add(child)
    return child
  }

  listen(
    target: EventTarget,
    type: string,
    fn: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): () => void {
    target.addEventListener(type, fn, options)
    return this.add(() => target.removeEventListener(type, fn, options))
  }

  timeout(fn: () => void, ms: number): () => void {
    const id = setTimeout(() => {
      remove()
      fn()
    }, ms)
    const remove = this.add(() => clearTimeout(id))
    return remove
  }

  interval(fn: () => void, ms: number): () => void {
    const id = setInterval(fn, ms)
    return this.add(() => clearInterval(id))
  }

  raf(fn: FrameRequestCallback): () => void {
    const id = requestAnimationFrame((time) => {
      remove()
      fn(time)
    })
    const remove = this.add(() => cancelAnimationFrame(id))
    return remove
  }

  /** Observe element for resize. On dispose, unobserves only this element (safe if observer is shared). */
  observeResize(observer: ResizeObserver, el: Element): void {
    observer.observe(el)
    this.add(() => observer.unobserve(el))
  }

  /**
   * Creates a ResizeObserver scoped to this Scope: observes `el` immediately
   * and disconnects the observer entirely on dispose. Use this instead of a
   * bare `new ResizeObserver(...)` when the observer is owned exclusively by
   * this Scope (i.e. it isn't shared across elements/scopes via
   * observeResize()).
   */
  createResizeObserver(el: Element, fn: ResizeObserverCallback): ResizeObserver {
    const observer = new ResizeObserver(fn)
    observer.observe(el)
    this.add(() => observer.disconnect())
    return observer
  }

  abortSignal(): AbortSignal {
    if (!this.abortController) {
      this.abortController = new AbortController()
      if (this._disposed) this.abortController.abort()
    }
    return this.abortController.signal
  }

  dispose(): void {
    if (this._disposed) return
    this._disposed = true

    if (this.parent) {
      this.parent.children.delete(this)
      this.parent = null
    }

    // Children first
    for (const child of [...this.children]) {
      child.dispose()
    }
    this.children.clear()

    // Own disposers, LIFO
    const disposers = this.disposers
    this.disposers = []
    for (let i = disposers.length - 1; i >= 0; i--) {
      this.safeRun(disposers[i])
    }

    this.abortController?.abort()
  }

  private safeRun(fn: () => void): void {
    try {
      fn()
    } catch (err) {
      console.error('Scope disposer error:', err)
    }
  }
}
