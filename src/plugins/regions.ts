/**
 * Regions are visual overlays on the waveform that can be used to mark segments of audio.
 * Regions can be clicked on, dragged and resized.
 * You can set the color and content of each region, as well as their HTML content.
 */

import BasePlugin, { type BasePluginEvents } from '../base-plugin.js'
import { makeDraggable } from '../draggable.js'
import EventEmitter from '../event-emitter.js'

export type RegionsPluginOptions = undefined

export type RegionsPluginEvents = BasePluginEvents & {
  'region-created': [region: Region]
  'region-updated': [region: Region]
  'region-clicked': [region: Region, e: MouseEvent]
  'region-double-clicked': [region: Region, e: MouseEvent]
  'region-in': [region: Region]
  'region-out': [region: Region]
}

export type RegionEvents = {
  /** Before the region is removed */
  remove: []
  /** When the region's parameters are being updated */
  update: []
  /** When dragging or resizing is finished */
  'update-end': []
  /** On play */
  play: []
  /** On mouse click */
  click: [event: MouseEvent]
  /** Double click */
  dblclick: [event: MouseEvent]
  /** Mouse over */
  over: [event: MouseEvent]
  /** Mouse leave */
  leave: [event: MouseEvent]
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
  /** The color of the region (CSS color) */
  color?: string
  /** Content string or HTML element */
  content?: string | HTMLElement
  /** Min length when resizing (in seconds) */
  minLength?: number
  /** Max length when resizing (in seconds) */
  maxLength?: number
}

class SingleRegion extends EventEmitter<RegionEvents> {
  public element: HTMLElement
  public id: string
  public start: number
  public end: number
  public drag: boolean
  public resize: boolean
  public color: string
  public content?: HTMLElement
  public minLength = 0
  public maxLength = Infinity

  constructor(params: RegionParams, private totalDuration: number) {
    super()

    this.id = params.id || `region-${Math.random().toString(32).slice(2)}`
    this.start = params.start
    this.end = params.end ?? params.start
    this.drag = params.drag ?? true
    this.resize = params.resize ?? true
    this.color = params.color ?? 'rgba(0, 0, 0, 0.1)'
    this.minLength = params.minLength ?? this.minLength
    this.maxLength = params.maxLength ?? this.maxLength
    this.element = this.initElement()
    this.setContent(params.content)
    this.setPart()

    this.renderPosition()
    this.initMouseEvents()
  }

  private setPart() {
    const isMarker = this.start === this.end
    this.element.setAttribute('part', `${isMarker ? 'marker' : 'region'} ${this.id}`)
  }

  private initElement() {
    const element = document.createElement('div')
    const isMarker = this.start === this.end

    element.setAttribute(
      'style',
      `
      position: absolute;
      height: 100%;
      background-color: ${isMarker ? 'none' : this.color};
      border-left: ${isMarker ? '2px solid ' + this.color : 'none'};
      border-radius: 2px;
      box-sizing: border-box;
      transition: background-color 0.2s ease;
      cursor: ${this.drag ? 'grab' : 'default'};
      pointer-events: all;
    `,
    )

    // Add resize handles
    if (!isMarker && this.resize) {
      const leftHandle = document.createElement('div')
      leftHandle.setAttribute('data-resize', 'left')
      leftHandle.setAttribute(
        'style',
        `
        position: absolute;
        z-index: 2;
        width: 6px;
        height: 100%;
        top: 0;
        left: 0;
        border-left: 2px solid rgba(0, 0, 0, 0.5);
        border-radius: 2px 0 0 2px;
        cursor: ${this.resize ? 'ew-resize' : 'default'};
        word-break: keep-all;
      `,
      )
      leftHandle.setAttribute('part', 'region-handle region-handle-left')

      const rightHandle = leftHandle.cloneNode() as HTMLElement
      rightHandle.setAttribute('data-resize', 'right')
      rightHandle.style.left = ''
      rightHandle.style.right = '0'
      rightHandle.style.borderRight = rightHandle.style.borderLeft
      rightHandle.style.borderLeft = ''
      rightHandle.style.borderRadius = '0 2px 2px 0'
      rightHandle.setAttribute('part', 'region-handle region-handle-right')

      element.appendChild(leftHandle)
      element.appendChild(rightHandle)
    }

    return element
  }

  private renderPosition() {
    const start = this.start / this.totalDuration
    const end = (this.totalDuration - this.end) / this.totalDuration
    this.element.style.left = `${start * 100}%`
    this.element.style.right = `${end * 100}%`
  }

  private initMouseEvents() {
    const { element } = this
    if (!element) return

    element.addEventListener('click', (e) => this.emit('click', e))
    element.addEventListener('mouseenter', (e) => this.emit('over', e))
    element.addEventListener('mouseleave', (e) => this.emit('leave', e))
    element.addEventListener('dblclick', (e) => this.emit('dblclick', e))

    // Drag
    makeDraggable(
      element,
      (dx) => this.onMove(dx),
      () => this.onStartMoving(),
      () => this.onEndMoving(),
    )

    // Resize
    const resizeThreshold = 1
    makeDraggable(
      element.querySelector('[data-resize="left"]') as HTMLElement,
      (dx) => this.onResize(dx, 'start'),
      () => null,
      () => this.onEndResizing(),
      resizeThreshold,
    )
    makeDraggable(
      element.querySelector('[data-resize="right"]') as HTMLElement,
      (dx) => this.onResize(dx, 'end'),
      () => null,
      () => this.onEndResizing(),
      resizeThreshold,
    )
  }

  private onStartMoving() {
    if (!this.drag) return
    this.element.style.cursor = 'grabbing'
  }

  private onEndMoving() {
    if (!this.drag) return
    this.element.style.cursor = 'grab'
    this.emit('update-end')
  }

  public _onUpdate(dx: number, side?: 'start' | 'end') {
    if (!this.element.parentElement) return
    const deltaSeconds = (dx / this.element.parentElement.clientWidth) * this.totalDuration
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
      this.emit('update')
    }
  }

  private onMove(dx: number) {
    if (!this.drag) return
    this._onUpdate(dx)
  }

  private onResize(dx: number, side: 'start' | 'end') {
    if (!this.resize) return
    this._onUpdate(dx, side)
  }

  private onEndResizing() {
    if (!this.resize) return
    this.emit('update-end')
  }

  public _setTotalDuration(totalDuration: number) {
    this.totalDuration = totalDuration
    this.renderPosition()
  }

  /** Play the region from the start */
  public play() {
    this.emit('play')
  }

  /** Set the HTML content of the region */
  public setContent(content: RegionParams['content']) {
    this.content?.remove()
    if (!content) {
      this.content = undefined
      return
    }
    if (typeof content === 'string') {
      this.content = document.createElement('div')
      const isMarker = this.start === this.end
      this.content.style.padding = `0.2em ${isMarker ? 0.2 : 0.4}em`
      this.content.textContent = content
    } else {
      this.content = content
    }
    this.content.setAttribute('part', 'region-content')
    this.element.appendChild(this.content)
  }

  /** Update the region's options */
  public setOptions(options: Omit<RegionParams, 'minLength' | 'maxLength'>) {
    if (options.color) {
      this.color = options.color
      this.element.style.backgroundColor = this.color
    }
    if (options.drag !== undefined) {
      this.drag = options.drag
      this.element.style.cursor = this.drag ? 'grab' : 'default'
    }
    if (options.resize !== undefined) {
      this.resize = options.resize
      this.element.querySelectorAll('[data-resize]').forEach((handle) => {
        ;(handle as HTMLElement).style.cursor = this.resize ? 'ew-resize' : 'default'
      })
    }
    if (options.start !== undefined || options.end !== undefined) {
      const isMarker = this.start === this.end
      this.start = options.start ?? this.start
      this.end = options.end ?? (isMarker ? this.start : this.end)
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
  }

  /** Remove the region */
  public remove() {
    this.emit('remove')
    this.element.remove()
    // This violates the type but we want to clean up the DOM reference
    // w/o having to have a nullable type of the element
    this.element = null as unknown as HTMLElement
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
        const playedRegions = this.regions.filter((region) => region.start <= currentTime && region.end >= currentTime)

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
    const div = document.createElement('div')
    div.setAttribute(
      'style',
      `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 3;
      pointer-events: none;
    `,
    )
    return div
  }

  /** Get all created regions */
  public getRegions(): Region[] {
    return this.regions
  }

  private avoidOverlapping(region: Region) {
    if (!region.content) return

    // Check that the label doesn't overlap with other labels
    // If it does, push it down until it doesn't
    const div = region.content as HTMLElement
    const labelLeft = div.getBoundingClientRect().left
    const labelWidth = region.element.scrollWidth

    const overlap = this.regions
      .filter((reg) => {
        if (reg === region || !reg.content) return false
        const left = reg.content.getBoundingClientRect().left
        const width = reg.element.scrollWidth
        return labelLeft < left + width && left < labelLeft + labelWidth
      })
      .map((reg) => reg.content?.getBoundingClientRect().height || 0)
      .reduce((sum, val) => sum + val, 0)

    div.style.marginTop = `${overlap}px`
  }

  private saveRegion(region: Region) {
    this.regionsContainer.appendChild(region.element)
    this.avoidOverlapping(region)
    this.regions.push(region)

    const regionSubscriptions = [
      region.on('update-end', () => {
        this.avoidOverlapping(region)
        this.emit('region-updated', region)
      }),

      region.on('play', () => {
        this.wavesurfer?.play()
        this.wavesurfer?.setTime(region.start)
      }),

      region.on('click', (e) => {
        this.emit('region-clicked', region, e)
      }),

      region.on('dblclick', (e) => {
        this.emit('region-double-clicked', region, e)
      }),

      // Remove the region from the list when it's removed
      region.once('remove', () => {
        regionSubscriptions.forEach((unsubscribe) => unsubscribe())
        this.regions = this.regions.filter((reg) => reg !== region)
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
    const region = new SingleRegion(options, duration)

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
  public enableDragSelection(options: Omit<RegionParams, 'start' | 'end'>): () => void {
    const wrapper = this.wavesurfer?.getWrapper()?.querySelector('div')
    if (!wrapper) return () => undefined

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
        const width = this.wavesurfer.getWrapper().clientWidth
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
        )
        // Just add it to the DOM for now
        this.regionsContainer.appendChild(region.element)
      },

      // On drag end
      () => {
        if (region) {
          this.saveRegion(region)
          region = null
        }
      },
    )
  }

  /** Remove all regions */
  public clearRegions() {
    this.regions.forEach((region) => region.remove())
  }

  /** Destroy the plugin and clean up */
  public destroy() {
    this.clearRegions()
    super.destroy()
  }
}

export default RegionsPlugin
export type Region = SingleRegion
