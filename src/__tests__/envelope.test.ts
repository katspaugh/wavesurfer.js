import EnvelopePlugin from '../plugins/envelope.js'
import { createEmitter } from './helpers/create-emitter.js'
import { installMatchMediaStub } from './helpers/match-media.js'
import { mockSvgGeometry } from './helpers/svg-geometry.js'

// Only the slice of WaveSurfer that EnvelopePlugin's volume path reads. The polyline is never
// built here (that needs 'decode' plus the SVG geometry jsdom lacks — see envelope-leaks.test.ts);
// onTimeUpdate works off the points array alone, which is what these tests drive.
const createWaveSurfer = (duration: number, currentTime = 0) => {
  const wrapper = document.createElement('div')
  document.body.appendChild(wrapper)

  return {
    ...createEmitter(),
    getWrapper: () => wrapper,
    getDuration: () => duration,
    getDecodedData: () => null,
    getVolume: () => 1,
    getCurrentTime: () => currentTime,
    setVolume: jest.fn(),
  }
}

describe('EnvelopePlugin volume interpolation', () => {
  beforeAll(() => {
    installMatchMediaStub()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('interpolates linearly between two points', () => {
    const ws = createWaveSurfer(10)
    const plugin = EnvelopePlugin.create({
      points: [
        { time: 0, volume: 0.2 },
        { time: 10, volume: 1 },
      ],
    })
    plugin._init(ws as any)

    ws.emit('timeupdate', 5)

    expect(plugin.getCurrentVolume()).toBe(0.6)
  })

  // A point at the very end of the track makes the synthesized end point coincide with it, so the
  // interpolation divided by a zero time difference. NaN survived the 0..1 clamp and reached
  // setVolume(), where both backends reject it: HTMLMediaElement.volume and AudioParam.value are
  // restricted doubles, so assigning NaN throws a TypeError out of the 'timeupdate' emit.
  it('holds the last point volume when it sits at the end of the track', () => {
    const ws = createWaveSurfer(10)
    const plugin = EnvelopePlugin.create({
      points: [
        { time: 0, volume: 1 },
        { time: 10, volume: 0 },
      ],
    })
    plugin._init(ws as any)

    const emitted: number[] = []
    plugin.on('volume-change', (volume) => emitted.push(volume))

    ws.emit('timeupdate', 10)

    expect(plugin.getCurrentVolume()).toBe(0)
    expect(emitted).toEqual([0])
    expect(ws.setVolume).not.toHaveBeenCalledWith(NaN)
  })

  it('keeps the volume finite across the whole timeline', () => {
    const ws = createWaveSurfer(10)
    const plugin = EnvelopePlugin.create({
      points: [
        { time: 0, volume: 1 },
        { time: 4, volume: 0.5 },
        { time: 10, volume: 0 },
      ],
    })
    plugin._init(ws as any)

    for (let time = 0; time <= 10; time += 0.25) {
      ws.emit('timeupdate', time)
    }

    const volumes = ws.setVolume.mock.calls.map(([volume]) => volume)
    expect(volumes.every(Number.isFinite)).toBe(true)
  })

  it('does not set a NaN volume when the duration is not known yet', () => {
    const ws = createWaveSurfer(0)
    const plugin = EnvelopePlugin.create({ points: [] })
    plugin._init(ws as any)

    ws.emit('timeupdate', 0)

    expect(ws.setVolume).not.toHaveBeenCalledWith(NaN)
  })
})

describe('EnvelopePlugin initialization and options', () => {
  beforeAll(() => {
    installMatchMediaStub()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  // A plugin registered AFTER the audio has already been decoded never gets a
  // 'decode' event, so without an "already decoded" init path (like the one
  // minimap/timeline have) its UI never rendered.
  it('renders its UI on init when the audio is already decoded', () => {
    const ws = {
      ...createWaveSurfer(10),
      getDecodedData: () => ({ duration: 10 }),
    }
    const plugin = EnvelopePlugin.create({ points: [] })
    plugin._init(ws as any)

    expect(ws.getWrapper().querySelector('[part="envelope"]')).not.toBeNull()
  })

  it('does not render the polyline UI before the audio is decoded', () => {
    const ws = createWaveSurfer(0)
    const plugin = EnvelopePlugin.create({ points: [] })
    plugin._init(ws as any)

    expect(ws.getWrapper().querySelector('[part="envelope"]')).toBeNull()
  })

  // `||` option fallbacks made falsy option values unusable: dragPointSize: 0
  // (hidden drag points) silently fell back to the default of 10.
  it('respects dragPointSize: 0 instead of falling back to the default', () => {
    const ws = createWaveSurfer(10)
    const plugin = EnvelopePlugin.create({ points: [], dragPointSize: 0 })
    plugin._init(ws as any)
    ws.emit('decode', 10)

    const svg = ws.getWrapper().querySelector('svg') as SVGSVGElement
    mockSvgGeometry(svg)

    plugin.addPoint({ time: 5, volume: 0.5 })

    const circle = svg.querySelector('ellipse') as SVGEllipseElement
    expect(circle).toBeTruthy()
    expect(circle.getAttribute('rx')).toBe('0')
  })

  // Post-destroy contract (matches core WaveSurfer): public mutators silently
  // no-op after destroy instead of still mutating closure state.
  it('makes public mutators silent no-ops after destroy', () => {
    const ws = createWaveSurfer(10)
    const plugin = EnvelopePlugin.create({ points: [] })
    plugin._init(ws as any)
    ws.emit('decode', 10)

    const svg = ws.getWrapper().querySelector('svg') as SVGSVGElement
    mockSvgGeometry(svg)

    const point = { time: 2, volume: 0.4 }
    plugin.addPoint(point)
    expect(plugin.getPoints()).toHaveLength(1)
    expect(plugin.getCurrentVolume()).toBe(1)

    plugin.destroy()

    plugin.addPoint({ time: 5, volume: 0.5 })
    expect(plugin.getPoints()).toHaveLength(1)

    plugin.removePoint(point)
    expect(plugin.getPoints()).toHaveLength(1)

    plugin.setPoints([{ time: 1, volume: 0.1 }])
    expect(plugin.getPoints()).toHaveLength(1)
    expect(plugin.getPoints()[0]).toBe(point)

    plugin.setVolume(0.3)
    expect(plugin.getCurrentVolume()).toBe(1)
  })
})
