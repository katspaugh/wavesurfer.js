/**
 * Multitrack isn't a plugin, but rather a helper class for creating a multitrack audio player.
 * Individual tracks are synced and played together. They can be dragged to set their start position.
 */

import EventEmitter from '../event-emitter.js'
import WaveSurfer, { type WaveSurferOptions } from '../wavesurfer.js'
import EnvelopePlugin, { type EnvelopePluginOptions } from './envelope.js'
import RegionsPlugin from './regions.js'
import TimelinePlugin, { type TimelinePluginOptions } from './timeline.js'

export type TrackId = string | number

export type TrackOptions = {
  id: TrackId
  container?: HTMLElement
  url?: string
  peaks?: WaveSurferOptions['peaks']
  hideScrollbar: boolean
  draggable?: boolean
  startPosition: number
  startCue?: number
  endCue?: number
  fadeInEnd?: number
  fadeOutStart?: number
  volume?: number
  markers?: Array<{
    time: number
    label?: string
    color?: string
  }>
  intro?: {
    endTime: number
    label?: string
    color?: string
  }
  options?: WaveSurferOptions
}

export type MultitrackOptions = {
  container?: HTMLElement
  minPxPerSec?: number
  cursorColor?: string
  cursorWidth?: number
  trackBackground?: string
  trackBorderColor?: string
  rightButtonDrag?: boolean
  envelopeOptions?: EnvelopePluginOptions
}

export type MultitrackEvents = {
  canplay: []
  'start-position-change': [{ id: TrackId; startPosition: number }]
  'start-cue-change': [{ id: TrackId; startCue: number }]
  'end-cue-change': [{ id: TrackId; endCue: number }]
  'fade-in-change': [{ id: TrackId; fadeInEnd: number }]
  'fade-out-change': [{ id: TrackId; fadeOutStart: number }]
  'volume-change': [{ id: TrackId; volume: number }]
  'intro-end-change': [{ id: TrackId; endTime: number }]
  drop: [{ id: TrackId }]
}

export type MultitrackTracks = Array<TrackOptions>

type MultiTrackContainer = {container: HTMLElement, scroll: HTMLElement, cursor: HTMLElement, wrapper: HTMLElement}

class MultiTrack extends EventEmitter<MultitrackEvents> {
  private tracks: MultitrackTracks
  private options: MultitrackOptions
  private audios: Array<HTMLAudioElement> = []
  private wavesurfers: Array<WaveSurfer> = []
  private durations: Array<number> = []
  private currentTime = 0
  private maxDuration = 0
  private rendering: ReturnType<typeof initRendering>
  private isDragging = false
  private frameRequest: number | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private subscriptions: Array<() => void> = []
  private timeline: TimelinePlugin | null = null

  static create(tracks: MultitrackTracks, options: MultitrackOptions): MultiTrack {
    return new MultiTrack(tracks, options)
  }

  constructor(tracks: MultitrackTracks, options: MultitrackOptions) {
    super()

    this.tracks = tracks.map((track) => ({
      ...track,
      startPosition: track.startPosition || 0,
      peaks: track.peaks || (track.url ? undefined : [new Float32Array()]),
    }))
    this.options = options

    this.rendering = initRendering(this.tracks, this.options)

    this.rendering.addDropHandler((trackId: TrackId) => {
      this.emit('drop', { id: trackId })
    })

    this.initAllAudios().then((durations) => {
      this.initDurations(durations)

      this.initAllWavesurfers()

      this.rendering.containers.forEach(({container, wrapper}, index) => {
        const drag = initDragging(wrapper, (delta: number) => this.onDrag(index, delta), options.rightButtonDrag)
        this.wavesurfers[index].once('destroy', () => drag?.destroy())

        // Click to seek
        container.addEventListener('click', (e) => {
          if (this.isDragging) return

          // determine poisition for current track
          const rect = container.getBoundingClientRect()
          const x = e.clientX - rect.left
          const position = x / container.offsetWidth
          const time = (position * durations[index]) + tracks[index].startPosition

          this.seekTo(time)
        })
      })

      this.emit('canplay')
    })
  }

  private initDurations(durations: number[]) {
    this.durations = durations

    this.maxDuration = this.tracks.reduce((max, track, index) => {
      return Math.max(max, track.startPosition + durations[index])
    }, 0)

    this.rendering.setMainWidth(durations, this.maxDuration)
  }

  private initAudio(track: TrackOptions): Promise<HTMLAudioElement> {
    const audio = new Audio(track.url)

    return new Promise<typeof audio>((resolve) => {
      if (!audio.src) return resolve(audio)

      audio.addEventListener('loadedmetadata', () => resolve(audio), { once: true })
    })
  }

  private async initAllAudios(): Promise<number[]> {
    this.audios = await Promise.all(this.tracks.map((track) => this.initAudio(track)))
    return this.audios.map((a) => (a.src ? a.duration : 0))
  }

  private initWavesurfer(track: TrackOptions, index: number): WaveSurfer {
    const {container} = this.rendering.containers[index]

    // Create a wavesurfer instance
    const ws = WaveSurfer.create({
      ...track.options,
      container,
      minPxPerSec: 0,
      media: this.audios[index],
      peaks: track.peaks,
      cursorColor: 'transparent',
      cursorWidth: 0,
      interact: false
    })

    // Regions and markers
    const wsRegions = RegionsPlugin.create()
    ws.registerPlugin(wsRegions)

    this.subscriptions.push(
      ws.once('decode', () => {
        // Start and end cues
        if (track.startCue != null || track.endCue != null) {
          const { startCue = 0, endCue = this.durations[index] } = track
          const startCueRegion = wsRegions.addRegion({
            start: 0,
            end: startCue,
            color: 'rgba(0, 0, 0, 0.7)',
            drag: false,
          })
          const endCueRegion = wsRegions.addRegion({
            start: endCue,
            end: endCue + this.durations[index],
            color: 'rgba(0, 0, 0, 0.7)',
            drag: false,
          })

          // Allow resizing only from one side
          startCueRegion.element.firstElementChild?.remove()
          endCueRegion.element.lastChild?.remove()

          // Prevent clicks when dragging
          // Update the start and end cues on resize
          this.subscriptions.push(
            startCueRegion.on('update-end', () => {
              track.startCue = startCueRegion.end
              this.emit('start-cue-change', { id: track.id, startCue: track.startCue as number })
            }),

            endCueRegion.on('update-end', () => {
              track.endCue = endCueRegion.start
              this.emit('end-cue-change', { id: track.id, endCue: track.endCue as number })
            }),
          )
        }

        // Intro
        if (track.intro) {
          const introRegion = wsRegions.addRegion({
            start: 0,
            end: track.intro.endTime,
            content: track.intro.label,
            color: this.options.trackBackground,
            drag: false,
          })
          introRegion.element.querySelector('[data-resize="left"]')?.remove()
          ;(introRegion.element.parentElement as HTMLElement).style.mixBlendMode = 'plus-lighter'
          if (track.intro.color) {
            ;(introRegion.element.querySelector('[data-resize="right"]') as HTMLElement).style.borderColor =
              track.intro.color
          }

          this.subscriptions.push(
            introRegion.on('update-end', () => {
              this.emit('intro-end-change', { id: track.id, endTime: introRegion.end })
            }),
          )
        }

        // Render markers
        if (track.markers) {
          track.markers.forEach((marker) => {
            wsRegions.addRegion({
              start: marker.time,
              content: marker.label,
              color: marker.color,
              resize: false,
            })
          })
        }
      }),
    )

    // Envelope
    const envelope = ws.registerPlugin(
      EnvelopePlugin.create({
        ...this.options.envelopeOptions,
        fadeInStart: track.startCue,
        fadeInEnd: track.fadeInEnd,
        fadeOutStart: track.fadeOutStart,
        fadeOutEnd: track.endCue,
        volume: track.volume,
      } as EnvelopePluginOptions),
    )

    this.subscriptions.push(
      envelope.on('volume-change', (volume) => {
        this.setIsDragging()
        this.emit('volume-change', { id: track.id, volume })
      }),

      envelope.on('fade-in-change', (time) => {
        this.setIsDragging()
        this.emit('fade-in-change', { id: track.id, fadeInEnd: time })
      }),

      envelope.on('fade-out-change', (time) => {
        this.setIsDragging()
        this.emit('fade-out-change', { id: track.id, fadeOutStart: time })
      }),

      this.on('start-cue-change', ({ id, startCue }) => {
        if (id === track.id) {
          envelope.setStartTime(startCue)
        }
      }),

      this.on('end-cue-change', ({ id, endCue }) => {
        if (id === track.id) {
          envelope.setEndTime(endCue)
        }
      }),
    )

    return ws
  }

  private initAllWavesurfers() {
    const wavesurfers = this.tracks.map((track, index) => {
      return this.initWavesurfer(track, index)
    })

    this.wavesurfers = wavesurfers
    this.initTimeline()
  }

  private initTimeline() {
    if (this.timeline) this.timeline.destroy()

    this.timeline = this.wavesurfers[0].registerPlugin(
      
      TimelinePlugin.create({
        duration: this.maxDuration,
        container: this.rendering.containers[0].container.parentElement,
      } as TimelinePluginOptions),
    )
  }

  private updatePosition(time: number, autoCenter = false) {
    const precisionSeconds = 0.3
    const isPaused = !this.isPlaying()

    if (time !== this.currentTime) {
      this.currentTime = time
      this.rendering.containers.forEach((container, i) => {
        this.rendering.updateCursor(container, (time - this.tracks[i].startPosition) / this.durations[i], autoCenter)
      })
    }

    // Update the current time of each audio
    this.tracks.forEach((track, index) => {
      const audio = this.audios[index]
      const duration = this.durations[index]
      const newTime = time - track.startPosition

      if (Math.abs(audio.currentTime - newTime) > precisionSeconds) {
        audio.currentTime = newTime
      }

      // If the position is out of the track bounds, pause it
      if (isPaused || newTime < 0 || newTime > duration) {
        !audio.paused && audio.pause()
      } else if (!isPaused) {
        // If the position is in the track bounds, play it
        audio.paused && audio.play()
      }

      // Unmute if cue is reached
      const newVolume = newTime >= (track.startCue || 0) && newTime < (track.endCue || Infinity) ? 1 : 0
      if (newVolume !== audio.volume) audio.volume = newVolume
    })
  }

  private setIsDragging() {
    // Prevent click events when dragging
    this.isDragging = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => (this.isDragging = false), 300)
  }

  private onDrag(index: number, delta: number) {
    this.setIsDragging()

    const track = this.tracks[index]
    if (!track.draggable) return

    const newStartPosition = track.startPosition + delta * this.maxDuration
    const mainIndex = this.tracks.findIndex((item) => item.url && !item.draggable)
    const mainTrack = this.tracks[mainIndex]
    const minStart = (mainTrack ? mainTrack.startPosition : 0) - this.durations[index]
    const maxStart = mainTrack ? mainTrack.startPosition + this.durations[mainIndex] : this.maxDuration

    if (newStartPosition >= minStart && newStartPosition <= maxStart) {
      track.startPosition = newStartPosition
      this.initDurations(this.durations)
      this.rendering.setContainerOffsets()
      this.updatePosition(this.currentTime)
      this.emit('start-position-change', { id: track.id, startPosition: newStartPosition })
    }
  }

  private findCurrentTracks(): number[] {
    // Find the audios at the current time
    const indexes: number[] = []

    this.tracks.forEach((track, index) => {
      if (
        track.url &&
        this.currentTime >= track.startPosition &&
        this.currentTime < track.startPosition + this.durations[index]
      ) {
        indexes.push(index)
      }
    })

    if (indexes.length === 0) {
      const minStartTime = Math.min(...this.tracks.filter((t) => t.url).map((track) => track.startPosition))
      indexes.push(this.tracks.findIndex((track) => track.startPosition === minStartTime))
    }

    return indexes
  }

  private startSync() {
    const onFrame = () => {
      const syncTime = this.audios.reduce<number>((pos, audio, index) => {
        if (!audio.paused) {
          pos = Math.max(pos, audio.currentTime + this.tracks[index].startPosition)
        }
        return pos
      }, this.currentTime)

      if (syncTime > this.currentTime) {
        this.updatePosition(syncTime, true)
      }

      this.frameRequest = requestAnimationFrame(onFrame)
    }

    onFrame()
  }

  public play() {
    this.startSync()

    const indexes = this.findCurrentTracks()
    indexes.forEach((index) => {
      this.audios[index]?.play()
    })
  }

  public pause() {
    this.audios.forEach((audio) => audio.pause())
  }

  public isPlaying() {
    return this.audios.some((audio) => !audio.paused)
  }

  public getCurrentTime() {
    return this.currentTime
  }

  // Seek to absolute time for other tracks based on position of clicked track
  public seekTo(time: number) {
    const wasPlaying = this.isPlaying()
    this.wavesurfers.forEach(() => this.updatePosition(time))
    if (wasPlaying) this.play()
  }

  /** Set time in seconds */
  public setTime(time: number) {
    const wasPlaying = this.isPlaying()
    this.updatePosition(time)
    if (wasPlaying) this.play()
  }

  public zoom(pxPerSec: number) {
    this.options.minPxPerSec = pxPerSec
    this.wavesurfers.forEach((ws, index) => this.tracks[index].url && ws.zoom(pxPerSec))
    this.rendering.setMainWidth(this.durations, this.maxDuration)
  }

  public addTrack(track: TrackOptions) {
    const index = this.tracks.findIndex((t) => t.id === track.id)
    if (index !== -1) {
      this.tracks[index] = track

      this.initAudio(track).then((audio) => {
        this.audios[index] = audio
        this.durations[index] = audio.duration
        this.initDurations(this.durations)

        const {container} = this.rendering.containers[index]
        container.innerHTML = ''

        this.wavesurfers[index].destroy()
        this.wavesurfers[index] = this.initWavesurfer(track, index)

        const drag = initDragging(container, (delta: number) => this.onDrag(index, delta), this.options.rightButtonDrag)
        this.wavesurfers[index].once('destroy', () => drag?.destroy())

        this.initTimeline()

        this.emit('canplay')
      })
    }
  }

  public destroy() {
    if (this.frameRequest) cancelAnimationFrame(this.frameRequest)

    this.rendering.destroy()

    this.audios.forEach((audio) => {
      audio.pause()
      audio.src = ''
    })

    this.wavesurfers.forEach((ws) => {
      ws.destroy()
    })
  }

  // See https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/setSinkId
  public setSinkId(sinkId: string) {
    return Promise.all(this.wavesurfers.map((ws) => ws.setSinkId(sinkId)))
  }
}

function initRendering(tracks: MultitrackTracks, options: MultitrackOptions) {
  let pxPerSec = 0
  let durations: number[] = []
  let mainWidth = 0

  const multiWrapper = options.container || document.body

  // Create containers for each track
  const containers = tracks.map((track, index) => {
    const container = track.container || document.createElement('div')

    // Create the scrollbar for each track
    const scroll = document.createElement('div')
    scroll.setAttribute('style', `width: 100%; overflow-x: ${track.hideScrollbar ? 'hidden' : 'scroll'}; overflow-y: hidden; user-select: none; position: relative;`)
    
    const wrapper = document.createElement('div')
    wrapper.style.position = 'relative'

    scroll.appendChild(wrapper)
    container.appendChild(scroll)

    // Create a cursor for each track
    const cursor = document.createElement('div')
    cursor.setAttribute('style', 'height: 100%; position: absolute; z-index: 10; top: 0; left: 0')
    cursor.style.backgroundColor = options.cursorColor || '#000'
    cursor.style.width = `${options.cursorWidth ?? 1}px`
    container.appendChild(cursor)

    if (options.trackBorderColor && index > 0) {
      const borderDiv = document.createElement('div')
      borderDiv.setAttribute('style', `width: 100%; height: 2px; background-color: ${options.trackBorderColor}`)
      wrapper.appendChild(borderDiv)
    }

    if (options.trackBackground && track.url) {
      container.style.background = options.trackBackground
    }

    // No audio on this track, so make it droppable
    if (!track.url) {
      const dropArea = document.createElement('div')
      dropArea.setAttribute(
        'style',
        `position: absolute; z-index: 10; left: 10px; top: 10px; right: 10px; bottom: 10px; border: 2px dashed ${options.trackBorderColor};`,
      )
      dropArea.addEventListener('dragover', (e) => {
        e.preventDefault()
        dropArea.style.background = options.trackBackground || ''
      })
      dropArea.addEventListener('dragleave', (e) => {
        e.preventDefault()
        dropArea.style.background = ''
      })
      dropArea.addEventListener('drop', (e) => {
        e.preventDefault()
        dropArea.style.background = ''
      })
      container.appendChild(dropArea)
    }

    if (multiWrapper) multiWrapper.appendChild(container)

    return {container, scroll, cursor, wrapper}
  })

  // Set the positions of each container
  const setContainerOffsets = () => {
    containers.forEach(({container}, i) => {
      const offset = tracks[i].startPosition * pxPerSec
      if (durations[i]) {
        container.style.width = `${durations[i] * pxPerSec}px`
      }
      container.style.transform = `translateX(${offset}px)`
    })
  }

  return {
    containers,

    // Set the start offset
    setContainerOffsets,

    // Set the container width
    setMainWidth: (trackDurations: number[], maxDuration: number) => {
      durations = trackDurations
      durations.forEach((_, i) => {
        pxPerSec = Math.max(options.minPxPerSec || 0, containers[i].wrapper.clientWidth / maxDuration)
        mainWidth = pxPerSec * maxDuration
        containers[i].container.style.width = `${mainWidth}px`
      })
      
      setContainerOffsets()
    },

    // Update cursor position
    updateCursor: ({ cursor, scroll }: MultiTrackContainer, position: number, autoCenter: boolean) => {
      cursor.style.left = `${Math.min(100, position * 100)}%`

      // Update scroll
      const { clientWidth, scrollLeft } = scroll
      const center = clientWidth / 2
      const minScroll = autoCenter ? center : clientWidth
      const pos = position * mainWidth

      if (pos > scrollLeft + minScroll || pos < scrollLeft) {
        scroll.scrollLeft = pos - center
      }
    },

    // Destroy the container
    destroy: () => {
      containers.forEach(({scroll}) => scroll.remove())
    },

    // Do something on drop
    addDropHandler: (onDrop: (trackId: TrackId) => void) => {
      tracks.forEach((track, index) => {
        if (!track.url) {
          const droppable = containers[index].wrapper.querySelector('div')
          droppable?.addEventListener('drop', (e) => {
            e.preventDefault()
            onDrop(track.id)
          })
        }
      })
    },
  }
}

function initDragging(container: HTMLElement, onDrag: (delta: number) => void, rightButtonDrag = false) {
  const wrapper = container.parentElement
  if (!wrapper) return

  // Dragging tracks to set position
  let dragStart: number | null = null

  container.addEventListener('contextmenu', (e) => {
    rightButtonDrag && e.preventDefault()
  })

  // Drag start
  container.addEventListener('mousedown', (e) => {
    if (rightButtonDrag && e.button !== 2) return
    const rect = wrapper.getBoundingClientRect()
    dragStart = e.clientX - rect.left
    container.style.cursor = 'grabbing'
  })

  // Drag end
  const onMouseUp = (e: MouseEvent) => {
    if (dragStart != null) {
      e.stopPropagation()
      dragStart = null
      container.style.cursor = ''
    }
  }

  // Drag move
  const onMouseMove = (e: MouseEvent) => {
    if (dragStart == null) return
    const rect = wrapper.getBoundingClientRect()
    const x = e.clientX - rect.left
    const diff = x - dragStart
    if (diff > 1 || diff < -1) {
      dragStart = x
      onDrag(diff / wrapper.offsetWidth)
    }
  }

  document.body.addEventListener('mouseup', onMouseUp)
  document.body.addEventListener('mousemove', onMouseMove)

  return {
    destroy: () => {
      document.body.removeEventListener('mouseup', onMouseUp)
      document.body.removeEventListener('mousemove', onMouseMove)
    },
  }
}

export default MultiTrack
