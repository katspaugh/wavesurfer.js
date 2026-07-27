/**
 * Regions are visual overlays on the waveform that can be used to mark segments of audio.
 * Regions can be clicked on, dragged and resized.
 * You can set the color and content of each region, as well as their HTML content.
 */

import { type BasePluginEvents } from '../base-plugin.js'
import { definePlugin } from '../define-plugin.js'
import EventEmitter from '../event-emitter.js'
import createElement from '../dom.js'
import { Scope } from '../scope.js'
import { createDragStream } from '../reactive/drag-stream.js'
import { effect } from '../reactive/store.js'
import { fromEvent, cleanup as cleanupStream } from '../reactive/event-streams.js'

// The pre-port class took no options at all (`constructor(options?: undefined)`).
// A literal `undefined` Options type does not fit definePlugin's PluginCtorArgs
// contract (`Record<string, never> extends Options ? [options?: Options] : ...`):
// `Record<string, never> extends undefined` is false, which would make the
// generated `create()`/constructor take a REQUIRED `undefined` argument and break
// every existing zero-arg `RegionsPlugin.create()` call site. `Record<string,
// never>` (an object with no properties) is the all-optional-fields shape the
// contract expects, and keeps `create()`/`create({})`/`create(undefined)` all
// callable, same as before.
export type RegionsPluginOptions = Record<string, never>
export type UpdateSide = 'start' | 'end'
export type RegionsPluginEvents = BasePluginEvents & {
  /** When a new region is initialized but not rendered yet */
  'region-initialized': [region: Region]
  /** When a region is created */
  'region-created': [region: Region]
  /** When a region is being updated */
  'region-update': [region: Region, side?: UpdateSide]
  /** When a region is done updating */
  'region-updated': [region: Region, side?: UpdateSide]
  /** When a region is removed */
  'region-removed': [region: Region]
  /** When a region is clicked */
  'region-clicked': [region: Region, e: MouseEvent]
  /** When a region is double-clicked */
  'region-double-clicked': [region: Region, e: MouseEvent]
  /** When playback enters a region */
  'region-in': [region: Region]
  /** When playback leaves a region */
  'region-out': [region: Region]
  /** When region content is changed */
  'region-content-changed': [region: Region]
}

export type RegionEvents = {
  /** Before the region is removed */
  remove: []
  /** When the region's parameters are being updated */
  update: [side?: UpdateSide]
  /** When dragging or resizing is finished */
  'update-end': [side?: UpdateSide]
  /** When the region needs to be re-rendered */
  render: []
  /** On play */
  play: [end?: number]
  /** On mouse click */
  click: [event: MouseEvent]
  /** Double click */
  dblclick: [event: MouseEvent]
  /** Mouse over */
  over: [event: MouseEvent]
  /** Mouse leave */
  leave: [event: MouseEvent]
  /** content changed */
  'content-changed': []
}

export type RegionParams = {
  /** The id of the region, any string */
  id?: string
  /** The start position of the region (in seconds) */
  start: number
  /** The end position of the region (in seconds) */
  end?: number
  /** Allow/dissallow dragging the region */
  drag?: boolean
  /** Allow/dissallow resizing the region */
  resize?: boolean
  /** Allow/dissallow resizing the start of the region */
  resizeStart?: boolean
  /** Allow/dissallow resizing the end of the region */
  resizeEnd?: boolean
  /** The color of the region (CSS color) */
  color?: string
  /** Content string or HTML element */
  content?: string | HTMLElement
  /** Min length when resizing (in seconds) */
  minLength?: number
  /** Max length when resizing (in seconds) */
  maxLength?: number
  /** The index of the channel */
  channelIdx?: number
  /** Allow/Disallow contenteditable property for content */
  contentEditable?: boolean
}

class SingleRegion extends EventEmitter<RegionEvents> implements Region {
  public element: HTMLElement | null = null // Element is created on init
  public id: string
  public start: number
  public end: number
  public drag: boolean
  public resize: boolean
  public resizeStart: boolean
  public resizeEnd: boolean
  public color: string
  public content?: HTMLElement
  public minLength = 0
  public maxLength = Infinity
  public channelIdx: number
  public contentEditable = false
  public updatingSide?: UpdateSide = undefined
  public isRemoved = false
  private resizeHandleCleanup: (() => void) | null = null
  private contentListenersCleanup: (() => void) | null = null
  /** True once initMouseEvents has run; controls whether setContent must (re)attach listeners itself */
  private mouseEventsInitialized = false

  constructor(
    params: RegionParams,
    private totalDuration: number,
    /**
     * A scope private to this region, owned by RegionsPlugin (`ctx.scope.child()`).
     * All of this region's own listener bookkeeping (mouse events, drag/resize
     * streams, content listeners) lives here instead of a hand-rolled
     * `subscriptions` array; `remove()` disposes it in one shot.
     */
    private scope: Scope,
    private numberOfChannels = 0,
  ) {
    super()

    this.id = params.id || `region-${Math.random().toString(32).slice(2)}`
    this.start = this.clampPosition(params.start)
    this.end = this.clampPosition(params.end ?? params.start)
    this.drag = params.drag ?? true
    this.resize = params.resize ?? true
    this.resizeStart = params.resizeStart ?? true
    this.resizeEnd = params.resizeEnd ?? true
    this.color = params.color ?? 'rgba(0, 0, 0, 0.1)'
    this.minLength = params.minLength ?? this.minLength
    this.maxLength = params.maxLength ?? this.maxLength
    this.channelIdx = params.channelIdx ?? -1
    this.contentEditable = params.contentEditable ?? this.contentEditable
    this.element = this.initElement()
    this.setContent(params.content)
    this.setPart()

    this.renderPosition()
    this.initMouseEvents()
  }

  private clampPosition(time: number): number {
    return Math.max(0, Math.min(this.totalDuration, time))
  }

  private setPart() {
    const isMarker = this.start === this.end
    this.element?.setAttribute('part', `${isMarker ? 'marker' : 'region'} ${this.id}`)
  }

  private addResizeHandles(element: HTMLElement) {
    const handleStyle = {
      position: 'absolute',
      zIndex: '2',
      width: '6px',
      height: '100%',
      top: '0',
      cursor: 'ew-resize',
      wordBreak: 'keep-all',
    }

    const leftHandle = createElement(
      'div',
      {
        part: 'region-handle region-handle-left',
        style: {
          ...handleStyle,
          left: '0',
          borderLeft: '2px solid rgba(0, 0, 0, 0.5)',
          borderRadius: '2px 0 0 2px',
        },
      },
      element,
    )

    const rightHandle = createElement(
      'div',
      {
        part: 'region-handle region-handle-right',
        style: {
          ...handleStyle,
          right: '0',
          borderRight: '2px solid rgba(0, 0, 0, 0.5)',
          borderRadius: '0 2px 2px 0',
        },
      },
      element,
    )

    // Resize
    const resizeThreshold = 1
    const leftDragStream = createDragStream(leftHandle, { threshold: resizeThreshold })
    const rightDragStream = createDragStream(rightHandle, { threshold: resizeThreshold })

    const removeLeftEffect = this.scope.add(
      effect(() => {
        const drag = leftDragStream.signal.value
        if (!drag) return
        if (drag.type === 'move' && drag.deltaX !== undefined) {
          this.onResize(drag.deltaX, 'start')
        } else if (drag.type === 'end') {
          this.onEndResizing('start')
        }
      }, [leftDragStream.signal]),
    )

    const removeRightEffect = this.scope.add(
      effect(() => {
        const drag = rightDragStream.signal.value
        if (!drag) return
        if (drag.type === 'move' && drag.deltaX !== undefined) {
          this.onResize(drag.deltaX, 'end')
        } else if (drag.type === 'end') {
          this.onEndResizing('end')
        }
      }, [rightDragStream.signal]),
    )

    const removeStreamCleanup = this.scope.add(() => {
      leftDragStream.cleanup()
      rightDragStream.cleanup()
    })

    // A single handle bundling all three scope registrations above, so
    // removeResizeHandles() can tear down just the resize-handle listeners
    // (and deregister them from `scope`) without disposing the whole region.
    this.resizeHandleCleanup = () => {
      removeLeftEffect()
      removeRightEffect()
      removeStreamCleanup()
    }
  }

  private removeResizeHandles(element: HTMLElement) {
    if (this.resizeHandleCleanup) {
      this.resizeHandleCleanup()
      this.resizeHandleCleanup = null
    }

    const leftHandle = element.querySelector('[part*="region-handle-left"]')
    const rightHandle = element.querySelector('[part*="region-handle-right"]')
    if (leftHandle) {
      element.removeChild(leftHandle)
    }
    if (rightHandle) {
      element.removeChild(rightHandle)
    }
  }

  private initElement(): HTMLElement | null {
    if (this.isRemoved) return null

    const isMarker = this.start === this.end

    let elementTop = 0
    let elementHeight = 100

    if (this.channelIdx >= 0 && this.numberOfChannels > 0 && this.channelIdx < this.numberOfChannels) {
      elementHeight = 100 / this.numberOfChannels
      elementTop = elementHeight * this.channelIdx
    }

    const element = createElement('div', {
      style: {
        position: 'absolute',
        top: `${elementTop}%`,
        height: `${elementHeight}%`,
        backgroundColor: isMarker ? 'none' : this.color,
        borderLeft: isMarker ? '2px solid ' + this.color : 'none',
        borderRadius: '2px',
        boxSizing: 'border-box',
        transition: 'background-color 0.2s ease',
        cursor: this.drag ? 'grab' : 'default',
        pointerEvents: 'all',
      },
    })

    // Add resize handles
    if (!isMarker && this.resize) {
      this.addResizeHandles(element)
    }

    return element
  }

  private renderPosition() {
    if (!this.element) return
    const start = this.start / this.totalDuration
    const end = (this.totalDuration - this.end) / this.totalDuration
    this.element.style.left = `${start * 100}%`
    this.element.style.right = `${end * 100}%`
  }

  private toggleCursor(toggle: boolean) {
    if (!this.drag || !this.element?.style) return
    this.element.style.cursor = toggle ? 'grabbing' : 'grab'
  }

  /** Attach the content click/blur listeners, first removing any existing pair */
  private attachContentListeners() {
    this.detachContentListeners()

    if (!this.contentEditable || !this.content) return

    const content = this.content
    const removeClick = this.scope.listen(content, 'click', (e) => this.onContentClick(e as MouseEvent))
    const removeBlur = this.scope.listen(content, 'blur', () => this.onContentBlur())

    this.contentListenersCleanup = () => {
      removeClick()
      removeBlur()
    }
  }

  /** Remove the content click/blur listeners, if attached */
  private detachContentListeners() {
    if (this.contentListenersCleanup) {
      this.contentListenersCleanup()
      this.contentListenersCleanup = null
    }
  }

  private initMouseEvents() {
    const { element } = this
    if (!element) return

    // Create event streams
    const clicks = fromEvent(element, 'click')
    const mouseenters = fromEvent(element, 'mouseenter')
    const mouseleaves = fromEvent(element, 'mouseleave')
    const dblclicks = fromEvent(element, 'dblclick')
    const pointerdowns = fromEvent(element, 'pointerdown')
    const pointerups = fromEvent(element, 'pointerup')

    // Subscribe to streams
    const unsubscribeClick = clicks.subscribe((e) => e && this.emit('click', e))
    const unsubscribeMouseenter = mouseenters.subscribe((e) => e && this.emit('over', e))
    const unsubscribeMouseleave = mouseleaves.subscribe((e) => e && this.emit('leave', e))
    const unsubscribeDblclick = dblclicks.subscribe((e) => e && this.emit('dblclick', e))
    const unsubscribePointerdown = pointerdowns.subscribe((e) => e && this.toggleCursor(true))
    const unsubscribePointerup = pointerups.subscribe((e) => e && this.toggleCursor(false))

    // Store cleanup
    this.scope.add(() => {
      unsubscribeClick()
      unsubscribeMouseenter()
      unsubscribeMouseleave()
      unsubscribeDblclick()
      unsubscribePointerdown()
      unsubscribePointerup()
      cleanupStream(clicks)
      cleanupStream(mouseenters)
      cleanupStream(mouseleaves)
      cleanupStream(dblclicks)
      cleanupStream(pointerdowns)
      cleanupStream(pointerups)
    })

    // Drag
    const dragStream = createDragStream(element)

    this.scope.add(
      effect(() => {
        const drag = dragStream.signal.value
        if (!drag) return

        if (drag.type === 'start') {
          this.toggleCursor(true)
        } else if (drag.type === 'move' && drag.deltaX !== undefined) {
          this.onMove(drag.deltaX)
        } else if (drag.type === 'end') {
          this.toggleCursor(false)
          if (this.drag) this.emit('update-end')
        }
      }, [dragStream.signal]),
    )
    this.scope.add(() => dragStream.cleanup())

    this.attachContentListeners()
    this.mouseEventsInitialized = true
  }

  public _onUpdate(dx: number, side?: UpdateSide, startTime?: number) {
    if (!this.element?.parentElement) return
    const { width } = this.element.parentElement.getBoundingClientRect()
    const deltaSeconds = (dx / width) * this.totalDuration
    let newStart = !side || side === 'start' ? this.start + deltaSeconds : this.start
    let newEnd = !side || side === 'end' ? this.end + deltaSeconds : this.end
    const isRegionCreating = startTime !== undefined // startTime is passed when the region is being created.
    if (isRegionCreating) {
      if (this.updatingSide && this.updatingSide !== side) {
        if (this.updatingSide === 'start') {
          newStart = startTime
        } else {
          newEnd = startTime
        }
      }
    }

    newStart = Math.max(0, newStart)
    newEnd = Math.min(this.totalDuration, newEnd)
    const length = newEnd - newStart

    this.updatingSide = side
    const resizeValid = length >= this.minLength && length <= this.maxLength
    if (newStart <= newEnd && (resizeValid || isRegionCreating)) {
      this.start = newStart
      this.end = newEnd

      this.renderPosition()
      this.emit('update', side)
    }
  }

  private onMove(dx: number) {
    if (!this.drag) return
    this._onUpdate(dx)
  }

  private onResize(dx: number, side: UpdateSide) {
    if (!this.resize) return
    if (!this.resizeStart && side === 'start') return
    if (!this.resizeEnd && side === 'end') return
    this._onUpdate(dx, side)
  }

  private onEndResizing(side: UpdateSide) {
    if (!this.resize) return
    this.emit('update-end', side)
    this.updatingSide = undefined
  }

  private onContentClick(event: MouseEvent) {
    event.stopPropagation()
    const contentContainer = event.target as HTMLDivElement
    contentContainer.focus()
    this.emit('click', event)
  }

  public onContentBlur() {
    this.emit('update-end')
  }

  public _setTotalDuration(totalDuration: number) {
    this.totalDuration = totalDuration
    this.renderPosition()
  }

  /** Play the region from the start, pass `true` to stop at region end */
  public play(stopAtEnd?: boolean) {
    this.emit('play', stopAtEnd && this.end !== this.start ? this.end : undefined)
  }

  /** Get Content as html or string */
  public getContent(asHTML: boolean = false): string | HTMLElement | undefined {
    if (asHTML) {
      return this.content || undefined
    }
    if (this.element instanceof HTMLElement) {
      return this.content?.innerHTML || undefined
    }
    return ''
  }

  /** Set the HTML content of the region */
  public setContent(content: RegionParams['content']) {
    if (!this.element) return

    // Remove event listeners from old content before removing it
    this.detachContentListeners()

    this.content?.remove()
    if (!content) {
      this.content = undefined
      return
    }
    if (typeof content === 'string') {
      const isMarker = this.start === this.end
      this.content = createElement('div', {
        style: {
          padding: `0.2em ${isMarker ? 0.2 : 0.4}em`,
          display: 'inline-block',
        },
        textContent: content,
      })
    } else {
      this.content = content
    }
    if (this.contentEditable) {
      this.content.contentEditable = 'true'
      // Only (re)attach here when replacing content at runtime -- during construction,
      // initMouseEvents() runs right after setContent() and is the single attachment point.
      if (this.mouseEventsInitialized) {
        this.attachContentListeners()
      }
    }
    this.content.setAttribute('part', 'region-content')
    this.element.appendChild(this.content)
    this.emit('content-changed')
  }

  /** Update the region's options */
  public setOptions(
    options: Partial<
      Pick<RegionParams, 'color' | 'start' | 'end' | 'drag' | 'content' | 'id' | 'resize' | 'resizeStart' | 'resizeEnd'>
    >,
  ) {
    if (!this.element) return

    if (options.color) {
      this.color = options.color
      this.element.style.backgroundColor = this.color
    }

    if (options.drag !== undefined) {
      this.drag = options.drag
      this.element.style.cursor = this.drag ? 'grab' : 'default'
    }

    if (options.start !== undefined || options.end !== undefined) {
      const isMarker = this.start === this.end
      this.start = this.clampPosition(options.start ?? this.start)
      this.end = this.clampPosition(options.end ?? (isMarker ? this.start : this.end))
      this.renderPosition()
      this.setPart()
      this.emit('render')
    }

    if (options.content) {
      this.setContent(options.content)
    }

    if (options.id) {
      this.id = options.id
      this.setPart()
    }

    if (options.resize !== undefined && options.resize !== this.resize) {
      const isMarker = this.start === this.end
      this.resize = options.resize
      if (this.resize && !isMarker) {
        this.addResizeHandles(this.element)
      } else {
        this.removeResizeHandles(this.element)
      }
    }

    if (options.resizeStart !== undefined) {
      this.resizeStart = options.resizeStart
    }

    if (options.resizeEnd !== undefined) {
      this.resizeEnd = options.resizeEnd
    }
  }

  /** Remove the region */
  public remove() {
    this.isRemoved = true
    this.emit('remove')

    // Clean up all of this region's listener bookkeeping in one shot: mouse
    // events, drag/resize streams, content listeners (and any plugin-level
    // per-region listeners registered onto this same scope, e.g. saveRegion's
    // region.on('update', ...) subscriptions).
    this.scope.dispose()

    // Belt-and-braces: detachContentListeners() is idempotent (a no-op once
    // scope.dispose() has already run the same removers).
    this.detachContentListeners()

    // Remove DOM element
    if (this.element) {
      this.element.remove()
      this.element = null
    }

    // Clear all event listeners from the EventEmitter
    this.unAll()
  }
}

// The public surface returned by setup() below — VERIFIED against the
// pre-port class: getRegions/addRegion/enableDragSelection/clearRegions were
// its only public methods (destroy is chassis-owned now, not part of the
// Api — see port-recipe.md).
type Api = {
  getRegions: () => Region[]
  addRegion: (options: RegionParams) => Region
  enableDragSelection: (options: Omit<RegionParams, 'start' | 'end'>, threshold?: number) => () => void
  clearRegions: () => void
}

const RegionsPlugin = definePlugin<RegionsPluginOptions, RegionsPluginEvents, Api>('regions', (ctx) => {
  // setup-closure state — replaces the pre-port instance fields `regions` and
  // the onInit()-local `activeRegions`.
  let regions: Region[] = []
  let activeRegions: Region[] = []

  const regionsContainer = createElement('div', {
    part: 'regions-container',
    style: {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: '5',
      pointerEvents: 'none',
    },
  })
  ctx.wavesurfer.getWrapper().appendChild(regionsContainer)
  // DESTROY-ORDER: the pre-port class removed regionsContainer AFTER
  // super.destroy() (so a 'destroy' listener could still observe it
  // attached). Neither regions.test.ts nor memory-leaks.test.ts's regions
  // cases (#4243) assert anything about post-destroy DOM attachment of the
  // regions container, so — per the chassis's per-port rule in
  // define-plugin.ts — this follows hover's precedent (Task 5) and moves
  // removal onto ctx.scope: a deliberate, documented behavior change
  // (removal now happens BEFORE the 'destroy' event, alongside every other
  // scope-owned teardown, instead of after).
  ctx.scope.add(() => regionsContainer.remove())

  // Update region durations when a new audio file is loaded
  ctx.scope.add(
    ctx.wavesurfer.on('ready', (duration) => {
      regions.forEach((region) => region._setTotalDuration(duration))
    }),
  )

  ctx.scope.add(
    ctx.wavesurfer.on('timeupdate', (currentTime) => {
      // Detect when regions are being played
      const playedRegions = regions.filter(
        (region) =>
          region.start <= currentTime &&
          (region.end === region.start ? region.start + 0.05 : region.end) >= currentTime,
      )

      // Trigger region-in when activeRegions doesn't include a played regions
      playedRegions.forEach((region) => {
        if (!activeRegions.includes(region)) {
          ctx.emit('region-in', region)
        }
      })

      // Trigger region-out when activeRegions include a un-played regions
      activeRegions.forEach((region) => {
        if (!playedRegions.includes(region)) {
          ctx.emit('region-out', region)
        }
      })

      // Update activeRegions only played regions
      activeRegions = playedRegions
    }),
  )

  function getRegions(): Region[] {
    return regions
  }

  function avoidOverlapping(region: Region) {
    if (!region.content || region.isRemoved) return

    ctx.scope.timeout(() => {
      if (!region.content) return

      // Check that the label doesn't overlap with other labels
      // If it does, push it down until it doesn't
      // only check regions that are before us in the list -- otherwise
      // both overlapping regions will try to move down away from each other.
      const div = region.content as HTMLElement
      div.style.marginTop = '0'
      const box = div.getBoundingClientRect()

      const regionIndex = regions.indexOf(region)
      if (regionIndex < 0) return

      const overlap = regions
        .slice(0, regionIndex)
        .filter((reg) => !reg.isRemoved)
        .reduce<DOMRect[]>((boxes, reg) => {
          if (reg === region || !reg.content) return boxes

          const otherBox = reg.content.getBoundingClientRect()
          if (box.left < otherBox.right && otherBox.left < box.right) {
            boxes.push(otherBox)
          }
          return boxes
        }, [])
        .sort((a, b) => a.top - b.top)
        .reduce((marginTop, otherBox) => {
          const top = box.top + marginTop
          const bottom = top + box.height
          if (top < otherBox.bottom && otherBox.top < bottom) {
            return otherBox.bottom - box.top + 2
          }
          return marginTop
        }, 0)

      div.style.marginTop = `${overlap}px`
    }, 10)
  }

  function avoidOverlappingAll() {
    regions.forEach((region) => avoidOverlapping(region))
  }

  function adjustScroll(region: Region) {
    if (!region.element) return
    const scrollContainer = ctx.wavesurfer?.getWrapper()?.parentElement
    if (!scrollContainer) return
    const { clientWidth, scrollWidth } = scrollContainer
    if (scrollWidth <= clientWidth) return
    const scrollBbox = scrollContainer.getBoundingClientRect()
    const bbox = region.element.getBoundingClientRect()
    const left = bbox.left - scrollBbox.left
    const right = bbox.right - scrollBbox.left
    if (left < 0) {
      scrollContainer.scrollLeft += left
    } else if (right > clientWidth) {
      scrollContainer.scrollLeft += right - clientWidth
    }
  }

  // `regionScope` is the same child scope SingleRegion itself owns (created
  // in addRegion/enableDragSelection and passed into its constructor). Once
  // ('remove'), the three previously hand-rolled `subscriptions`-array splice
  // sites (virtualAppend, saveRegion, addRegion's once('ready')) are gone:
  // everything below is torn down for free when region.remove() disposes
  // this same scope.
  function virtualAppend(region: Region, regionScope: Scope, container: HTMLElement, element: HTMLElement) {
    const renderIfVisible = () => {
      if (!ctx.wavesurfer) return
      const clientWidth = ctx.wavesurfer.getWidth()
      const scrollLeft = ctx.wavesurfer.getScroll()
      const scrollWidth = container.clientWidth
      const duration = ctx.wavesurfer.getDuration()
      const start = Math.round((region.start / duration) * scrollWidth)
      const width = Math.round(((region.end - region.start) / duration) * scrollWidth) || 1

      // Check if the region is between the scrollLeft and scrollLeft + clientWidth
      const isVisible = start + width > scrollLeft && start < scrollLeft + clientWidth

      if (isVisible && !element.parentElement) {
        container.appendChild(element)
      } else if (!isVisible && element.parentElement) {
        element.remove()
      }
    }

    regionScope.timeout(() => {
      // Check if region was removed before this timeout executed (defensive;
      // the timeout itself is cancelled by regionScope.dispose() when the
      // region is removed first, so this should already be unreachable then).
      if (!ctx.wavesurfer || !region.element) return
      renderIfVisible()

      regionScope.add(ctx.wavesurfer.on('scroll', renderIfVisible))
      regionScope.add(ctx.wavesurfer.on('zoom', renderIfVisible))
      regionScope.add(ctx.wavesurfer.on('resize', renderIfVisible))
      regionScope.add(region.on('render', renderIfVisible))
    }, 0)
  }

  function saveRegion(region: Region, regionScope: Scope) {
    if (!region.element) return
    virtualAppend(region, regionScope, regionsContainer, region.element)
    avoidOverlapping(region)
    regions.push(region)

    regionScope.add(
      region.on('update', (side) => {
        // Undefined side indicates that we are dragging not resizing
        if (!side) {
          adjustScroll(region)
        }
        ctx.emit('region-update', region, side)
      }),
    )

    regionScope.add(
      region.on('update-end', (side) => {
        avoidOverlappingAll()
        ctx.emit('region-updated', region, side)
      }),
    )

    regionScope.add(
      region.on('play', (end?: number) => {
        ctx.wavesurfer?.play(region.start, end)
      }),
    )

    regionScope.add(
      region.on('click', (e) => {
        ctx.emit('region-clicked', region, e)
      }),
    )

    regionScope.add(
      region.on('dblclick', (e) => {
        ctx.emit('region-double-clicked', region, e)
      }),
    )

    regionScope.add(
      region.on('content-changed', () => {
        ctx.emit('region-content-changed', region)
      }),
    )

    // Remove the region from the list when it's removed. This is the only
    // bookkeeping left that isn't scope-owned teardown (the six listeners
    // above die automatically with regionScope, disposed by region.remove());
    // pruning `regions` and emitting 'region-removed' are active side effects
    // that must run in response to the event itself.
    region.once('remove', () => {
      regions = regions.filter((reg) => reg !== region)
      ctx.emit('region-removed', region)
    })

    ctx.emit('region-created', region)
  }

  /** Create a region with given parameters */
  function addRegion(options: RegionParams): Region {
    if (!ctx.wavesurfer) {
      throw Error('WaveSurfer is not initialized')
    }

    const duration = ctx.wavesurfer.getDuration()
    const numberOfChannels = ctx.wavesurfer.getDecodedData()?.numberOfChannels
    const regionScope = ctx.scope.child()
    const region = new SingleRegion(options, duration, regionScope, numberOfChannels)
    ctx.emit('region-initialized', region)

    if (!duration) {
      // Registered on regionScope instead of a plugin-level subscriptions
      // array: if the region is removed before wavesurfer becomes ready,
      // regionScope.dispose() (via region.remove()) cancels this pending
      // listener along with everything else — no manual splice needed.
      regionScope.add(
        ctx.wavesurfer.once('ready', (readyDuration) => {
          region._setTotalDuration(readyDuration)
          saveRegion(region, regionScope)
        }),
      )
    } else {
      saveRegion(region, regionScope)
    }

    return region
  }

  /**
   * Enable creation of regions by dragging on an empty space on the waveform.
   * Returns a function to disable the drag selection.
   */
  function enableDragSelection(options: Omit<RegionParams, 'start' | 'end'>, threshold = 3): () => void {
    const wrapper = ctx.wavesurfer?.getWrapper()
    if (!wrapper || !(wrapper instanceof HTMLElement)) return () => undefined

    const initialSize = 5
    let region: Region | null = null
    let regionScope: Scope | null = null
    let startX = 0
    let startTime = 0

    const dragStream = createDragStream(wrapper, { threshold })

    const unsubscribe = effect(() => {
      const drag = dragStream.signal.value
      if (!drag) return

      if (drag.type === 'start') {
        // On drag start
        startX = drag.x
        if (!ctx.wavesurfer) return
        const duration = ctx.wavesurfer.getDuration()
        const numberOfChannels = ctx.wavesurfer?.getDecodedData()?.numberOfChannels
        const { width } = ctx.wavesurfer.getWrapper().getBoundingClientRect()
        startTime = (startX / width) * duration

        // Calculate the start time of the region
        const start = (drag.x / width) * duration
        // Give the region a small initial size
        const end = ((drag.x + initialSize) / width) * duration

        // Create a region but don't save it until the drag ends
        regionScope = ctx.scope.child()
        region = new SingleRegion(
          {
            ...options,
            start,
            end,
          },
          duration,
          regionScope,
          numberOfChannels,
        )

        ctx.emit('region-initialized', region)

        // Just add it to the DOM for now
        if (region.element) {
          regionsContainer.appendChild(region.element)
        }
      } else if (drag.type === 'move' && drag.deltaX !== undefined) {
        // On drag move
        if (region) {
          // Update the end position of the region
          // If we're dragging to the left, we need to update the start instead
          region._onUpdate(drag.deltaX, drag.x > startX ? 'end' : 'start', startTime)
        }
      } else if (drag.type === 'end') {
        // On drag end
        if (region && regionScope) {
          saveRegion(region, regionScope)
          region.updatingSide = undefined
          region = null
          regionScope = null
        }
      }
    }, [dragStream.signal])

    // The returned disposer IS the scope.add(...) remover — calling it both
    // runs the cleanup and deregisters it from ctx.scope, so a manual
    // splice-out of a plugin-level subscriptions array is no longer needed.
    return ctx.scope.add(() => {
      unsubscribe()
      dragStream.cleanup()
    })
  }

  /** Remove all regions */
  function clearRegions() {
    const regionsToRemove = regions.slice()
    regionsToRemove.forEach((region) => region.remove())
    regions = []
  }

  // Equivalent of the pre-port destroy() override's `this.clearRegions()`
  // call: explicitly remove()s every region (emitting 'remove'/'region-removed'
  // and clearing region.element) rather than relying solely on the implicit
  // ctx.scope -> regionScope cascade, which would dispose each region's raw
  // listeners but skip SingleRegion.remove()'s other side effects.
  ctx.scope.add(() => clearRegions())

  return {
    getRegions,
    addRegion,
    enableDragSelection,
    clearRegions,
  }
})

export default RegionsPlugin
export type Region = SingleRegion
