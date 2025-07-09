/**
 * Regions are visual overlays on the waveform that can be used to mark segments of audio.
 * Regions can be clicked on, dragged and resized.
 * You can set the color and content of each region, as well as their HTML content.
 */

import BasePlugin, { type BasePluginEvents } from '../base-plugin.js'
import { makeDraggable } from '../draggable.js'
import EventEmitter from '../event-emitter.js'
import createElement from '../dom.js'
import renderer from "../renderer";

export type RegionsPluginOptions = undefined

export type RegionsPluginEvents = BasePluginEvents & {
  /** When a new region is initialized but not rendered yet */
  'region-initialized': [region: Region]
  /** When a region is created */
  'region-created': [region: Region]
  /** When a region is being updated */
  'region-update': [region: Region, side?: 'start' | 'end']
  /** When a region is done updating */
  'region-updated': [region: Region]
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
  update: [side?: 'start' | 'end']
  /** When dragging or resizing is finished */
  'update-end': []
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
  public subscriptions: (() => void)[] = []
  private isRemoved = false

  constructor(
    params: RegionParams,
    private totalDuration: number,
    private numberOfChannels = 0,
  ) {
    super()

    this.subscriptions = []
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
    this.subscriptions.push(
      makeDraggable(
        leftHandle,
        (dx) => this.onResize(dx, 'start'),
        () => null,
        () => this.onEndResizing(),
        resizeThreshold,
      ),
      makeDraggable(
        rightHandle,
        (dx) => this.onResize(dx, 'end'),
        () => null,
        () => this.onEndResizing(),
        resizeThreshold,
      ),
    )
  }

  private removeResizeHandles(element: HTMLElement) {
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

    if (this.channelIdx >= 0 && this.channelIdx < this.numberOfChannels) {
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

  private initMouseEvents() {
    const { element } = this
    if (!element) return

    element.addEventListener('click', (e) => this.emit('click', e))
    element.addEventListener('mouseenter', (e) => this.emit('over', e))
    element.addEventListener('mouseleave', (e) => this.emit('leave', e))
    element.addEventListener('dblclick', (e) => this.emit('dblclick', e))
    element.addEventListener('pointerdown', () => this.toggleCursor(true))
    element.addEventListener('pointerup', () => this.toggleCursor(false))

    // Drag
    this.subscriptions.push(
      makeDraggable(
        element,
        (dx) => this.onMove(dx),
        () => this.toggleCursor(true),
        () => {
          this.toggleCursor(false)
          if (this.drag) this.emit('update-end')
        },
      ),
    )

    if (this.contentEditable && this.content) {
      this.content.addEventListener('click', (e) => this.onContentClick(e))
      this.content.addEventListener('blur', () => this.onContentBlur())
    }
  }

  public _onUpdate(dx: number, side?: 'start' | 'end') {
    if (!this.element?.parentElement) return
    const { width } = this.element.parentElement.getBoundingClientRect()
    const deltaSeconds = (dx / width) * this.totalDuration
    const newStart = !side || side === 'start' ? this.start + deltaSeconds : this.start
    const newEnd = !side || side === 'end' ? this.end + deltaSeconds : this.end
    const length = newEnd - newStart

    if (
      newStart >= 0 &&
      newEnd <= this.totalDuration &&
      newStart <= newEnd &&
      length >= this.minLength &&
      length <= this.maxLength
    ) {
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

  private onResize(dx: number, side: 'start' | 'end') {
    if (!this.resize) return
    if (!this.resizeStart && side === 'start') return
    if (!this.resizeEnd && side === 'end') return
    this._onUpdate(dx, side)
  }

  private onEndResizing() {
    if (!this.resize) return
    this.emit('update-end')
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
    this.subscriptions.forEach((unsubscribe) => unsubscribe())
    if (this.element) {
      this.element.remove()
      this.element = null
    }
  }
}

class RegionsPlugin extends BasePlugin<RegionsPluginEvents, RegionsPluginOptions> {
  private regions: Region[] = []
  private regionsContainer: HTMLElement

  /** Create an instance of RegionsPlugin */
  constructor(options?: RegionsPluginOptions) {
    super(options)
    this.regionsContainer = this.initRegionsContainer()
  }

  /** Create an instance of RegionsPlugin */
  public static create(options?: RegionsPluginOptions) {
    return new RegionsPlugin(options)
  }

  /** Called by wavesurfer, don't call manually */
  onInit() {
    if (!this.wavesurfer) {
      throw Error('WaveSurfer is not initialized')
    }
    this.wavesurfer.getWrapper().appendChild(this.regionsContainer)

    let activeRegions: Region[] = []
    this.subscriptions.push(
      this.wavesurfer.on('timeupdate', (currentTime) => {
        // Detect when regions are being played
        const playedRegions = this.regions.filter(
          (region) =>
            region.start <= currentTime &&
            (region.end === region.start ? region.start + 0.05 : region.end) >= currentTime,
        )

        // Trigger region-in when activeRegions doesn't include a played regions
        playedRegions.forEach((region) => {
          if (!activeRegions.includes(region)) {
            this.emit('region-in', region)
          }
        })

        // Trigger region-out when activeRegions include a un-played regions
        activeRegions.forEach((region) => {
          if (!playedRegions.includes(region)) {
            this.emit('region-out', region)
          }
        })

        // Update activeRegions only played regions
        activeRegions = playedRegions
      }),
    )
  }

  private initRegionsContainer(): HTMLElement {
    return createElement('div', {
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
  }

  /** Get all created regions */
  public getRegions(): Region[] {
    return this.regions
  }

  private avoidOverlapping(region: Region) {
    if (!region.content) return

    setTimeout(() => {
      // Check that the label doesn't overlap with other labels
      // If it does, push it down until it doesn't
      const div = region.content as HTMLElement
      const box = div.getBoundingClientRect()

      const overlap = this.regions
        .map((reg) => {
          if (reg === region || !reg.content) return 0

          const otherBox = reg.content.getBoundingClientRect()
          if (box.left < otherBox.left + otherBox.width && otherBox.left < box.left + box.width) {
            return otherBox.height
          }
          return 0
        })
        .reduce((sum, val) => sum + val, 0)

      div.style.marginTop = `${overlap}px`
    }, 10)
  }

  private adjustScroll(region: Region) {
    if (!region.element) return
    const scrollContainer = this.wavesurfer?.getWrapper()?.parentElement
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

  private virtualAppend(region: Region, container: HTMLElement, element: HTMLElement) {
    const renderIfVisible = () => {
      if (!this.wavesurfer) return
      const clientWidth = this.wavesurfer.getWidth()
      const scrollLeft = this.wavesurfer.getScroll()
      const scrollWidth = container.clientWidth
      const duration = this.wavesurfer.getDuration()
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

    setTimeout(() => {
      if (!this.wavesurfer) return
      renderIfVisible()

      const unsubscribeScroll = this.wavesurfer.on('scroll', renderIfVisible)
      const unsubscribeZoom = this.wavesurfer.on('zoom', renderIfVisible)

      this.subscriptions.push(region.once('remove', unsubscribeScroll), unsubscribeScroll)
      this.subscriptions.push(region.once('remove', unsubscribeZoom), unsubscribeZoom)
    }, 0)
  }

  private saveRegion(region: Region) {
    if (!region.element) return
    this.virtualAppend(region, this.regionsContainer, region.element)
    this.avoidOverlapping(region)
    this.regions.push(region)

    const regionSubscriptions = [
      region.on('update', (side) => {
        // Undefined side indicates that we are dragging not resizing
        if (!side) {
          this.adjustScroll(region)
        }
        this.emit('region-update', region, side)
      }),

      region.on('update-end', () => {
        this.avoidOverlapping(region)
        this.emit('region-updated', region)
      }),

      region.on('play', (end?: number) => {
        this.wavesurfer?.play(region.start, end)
      }),

      region.on('click', (e) => {
        this.emit('region-clicked', region, e)
      }),

      region.on('dblclick', (e) => {
        this.emit('region-double-clicked', region, e)
      }),
      region.on('content-changed', () => {
        this.emit('region-content-changed', region)
      }),

      // Remove the region from the list when it's removed
      region.once('remove', () => {
        regionSubscriptions.forEach((unsubscribe) => unsubscribe())
        this.regions = this.regions.filter((reg) => reg !== region)
        this.emit('region-removed', region)
      }),
    ]

    this.subscriptions.push(...regionSubscriptions)

    this.emit('region-created', region)
  }

  /** Create a region with given parameters */
  public addRegion(options: RegionParams): Region {
    if (!this.wavesurfer) {
      throw Error('WaveSurfer is not initialized')
    }

    const duration = this.wavesurfer.getDuration()
    const numberOfChannels = this.wavesurfer?.getDecodedData()?.numberOfChannels
    const region = new SingleRegion(options, duration, numberOfChannels)
    this.emit('region-initialized', region)

    if (!duration) {
      this.subscriptions.push(
        this.wavesurfer.once('ready', (duration) => {
          region._setTotalDuration(duration)
          this.saveRegion(region)
        }),
      )
    } else {
      this.saveRegion(region)
    }

    return region
  }

  /**
   * Enable creation of regions by dragging on an empty space on the waveform.
   * Returns a function to disable the drag selection.
   */
  public enableDragSelection(options: Omit<RegionParams, 'start' | 'end'>, threshold = 3): () => void {
    const wrapper = this.wavesurfer?.getWrapper()
    if (!wrapper || !(wrapper instanceof HTMLElement)) return () => undefined

    const initialSize = 5
    let region: Region | null = null
    let startX = 0

    return makeDraggable(
      wrapper,

      // On drag move
      (dx, _dy, x) => {
        if (region) {
          // Update the end position of the region
          // If we're dragging to the left, we need to update the start instead
          region._onUpdate(dx, x > startX ? 'end' : 'start')
        }
      },

      // On drag start
      (x) => {
        startX = x
        if (!this.wavesurfer) return
        const duration = this.wavesurfer.getDuration()
        const numberOfChannels = this.wavesurfer?.getDecodedData()?.numberOfChannels
        const { width } = this.wavesurfer.getWrapper().getBoundingClientRect()
        // Calculate the start time of the region
        const start = (x / width) * duration
        // Give the region a small initial size
        const end = ((x + initialSize) / width) * duration

        // Create a region but don't save it until the drag ends
        region = new SingleRegion(
          {
            ...options,
            start,
            end,
          },
          duration,
          numberOfChannels,
        )

        this.emit('region-initialized', region)

        // Just add it to the DOM for now
        if (region.element) {
          this.regionsContainer.appendChild(region.element)
        }
      },

      // On drag end
      () => {
        if (region) {
          this.saveRegion(region)
          region = null
        }
      },

      threshold,
    )
  }

  /** Remove all regions */
  public clearRegions() {
    const regions = this.regions.slice()
    regions.forEach((region) => region.remove())
    this.regions = []
  }

  /** Destroy the plugin and clean up */
  public destroy() {
    this.clearRegions()
    super.destroy()
    this.regionsContainer.remove()
  }
}

export default RegionsPlugin
export type Region = SingleRegion
