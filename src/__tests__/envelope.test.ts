import EnvelopePlugin from '../plugins/envelope.js'
import { createEmitter } from './helpers/create-emitter.js'
import { installMatchMediaStub } from './helpers/match-media.js'

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
