// With splitChannels off, the spectrogram should analyze every channel mixed down to one,
// not just the first channel (#4411).

import SpectrogramPlugin from '../plugins/spectrogram.js'
import { createFakeWaveSurfer } from './helpers/fake-wavesurfer.js'
import { mockWorkerInstances } from './helpers/spectrogram-worker-mock.js'

const SAMPLE_RATE = 8000

function makeSine(length: number, frequency = 1000): Float32Array {
  const signal = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    signal[i] = Math.sin((2 * Math.PI * frequency * i) / SAMPLE_RATE)
  }
  return signal
}

/** A stereo buffer with a silent left channel and a sine on the right */
function makeRightOnlyBuffer(): { buffer: AudioBuffer; left: Float32Array; right: Float32Array } {
  const left = new Float32Array(SAMPLE_RATE)
  const right = makeSine(SAMPLE_RATE)
  const buffer = {
    sampleRate: SAMPLE_RATE,
    length: SAMPLE_RATE,
    duration: 1,
    numberOfChannels: 2,
    getChannelData: (channel: number) => (channel === 0 ? left : right),
  } as unknown as AudioBuffer
  return { buffer, left, right }
}

const hasSignal = (frequencies: Uint8Array[][]) => frequencies[0].some((frame) => frame.some((value) => value > 0))

function createPlugin(options: Record<string, unknown>): any {
  const plugin: any = SpectrogramPlugin.create(options)
  plugin._init(createFakeWaveSurfer())
  return plugin.__spectrogramInternalsForTests()
}

beforeAll(() => {
  // jsdom has no Worker; the plugin only checks its existence before using the bundled constructor
  ;(globalThis as any).Worker = function Worker() {}
})

beforeEach(() => {
  mockWorkerInstances.length = 0
})

describe('SpectrogramPlugin with splitChannels: false mixes all channels', () => {
  it('full mode, main thread: shows a signal that is only on the right channel', async () => {
    const internals = createPlugin({ splitChannels: false, useWebWorker: false })
    const { buffer } = makeRightOnlyBuffer()

    const frequencies = await internals.getFrequencies(buffer)

    expect(frequencies.length).toBe(1)
    expect(hasSignal(frequencies)).toBe(true)
  })

  it('full mode, worker: posts one channel holding the average of all channels', () => {
    const internals = createPlugin({ splitChannels: false, useWebWorker: true })
    const { buffer, right } = makeRightOnlyBuffer()
    internals.getFrequencies(buffer).catch(() => undefined)

    const worker = mockWorkerInstances[mockWorkerInstances.length - 1]
    const { audioData } = worker.postMessage.mock.calls[0][0]

    expect(audioData.length).toBe(1)
    expect(Array.from(audioData[0])).toEqual(Array.from(right, (value) => value / 2))
  })

  it('windowed mode, main thread: shows a signal that is only on the right channel', async () => {
    const internals = createPlugin({ rendering: 'windowed', splitChannels: false, useWebWorker: false })
    internals.buffer = makeRightOnlyBuffer().buffer

    const frequencies = await internals.windowed.calculateFrequenciesMainThread(0, 0.5)

    expect(frequencies.length).toBe(1)
    expect(hasSignal(frequencies)).toBe(true)
  })

  it('windowed mode, worker: posts the mixed samples of the segment only', () => {
    const internals = createPlugin({ rendering: 'windowed', splitChannels: false, useWebWorker: true })
    const { buffer, right } = makeRightOnlyBuffer()
    internals.buffer = buffer
    internals.windowed.calculateFrequenciesWithWorker(0.25, 0.5).catch(() => undefined)

    const worker = mockWorkerInstances[mockWorkerInstances.length - 1]
    const { audioData } = worker.postMessage.mock.calls[0][0]

    expect(audioData.length).toBe(1)
    expect(Array.from(audioData[0])).toEqual(Array.from(right.subarray(2000, 4000), (value) => value / 2))
  })

  it('full mode, worker: averages every channel of a buffer with more than two', () => {
    const internals = createPlugin({ splitChannels: false, useWebWorker: true })
    const levels = [0.5, 0.25, -0.125]
    const channels = levels.map((level) => new Float32Array(SAMPLE_RATE).fill(level))
    const buffer = {
      sampleRate: SAMPLE_RATE,
      length: SAMPLE_RATE,
      duration: 1,
      numberOfChannels: channels.length,
      getChannelData: (channel: number) => channels[channel],
    } as unknown as AudioBuffer
    internals.getFrequencies(buffer).catch(() => undefined)

    const worker = mockWorkerInstances[mockWorkerInstances.length - 1]
    const { audioData } = worker.postMessage.mock.calls[0][0]

    expect(audioData.length).toBe(1)
    expect(audioData[0].length).toBe(SAMPLE_RATE)
    audioData[0].forEach((value: number) => expect(value).toBeCloseTo((0.5 + 0.25 - 0.125) / 3, 6))
  })

  it('windowed mode, worker: still posts a segment-sized copy of each channel with splitChannels: true', () => {
    const internals = createPlugin({ rendering: 'windowed', splitChannels: true, useWebWorker: true })
    const { buffer, left, right } = makeRightOnlyBuffer()
    internals.buffer = buffer
    internals.windowed.calculateFrequenciesWithWorker(0.25, 0.5).catch(() => undefined)

    const worker = mockWorkerInstances[mockWorkerInstances.length - 1]
    const { audioData } = worker.postMessage.mock.calls[0][0]

    expect(audioData.length).toBe(2)
    expect(Array.from(audioData[0])).toEqual(Array.from(left.subarray(2000, 4000)))
    expect(Array.from(audioData[1])).toEqual(Array.from(right.subarray(2000, 4000)))
    // A copy, not a view: postMessage clones the whole backing buffer of a view
    expect(audioData[1].buffer).not.toBe(right.buffer)
    expect(audioData[1].buffer.byteLength).toBe(2000 * Float32Array.BYTES_PER_ELEMENT)
  })

  it('still analyzes each channel separately with splitChannels: true', async () => {
    const internals = createPlugin({ splitChannels: true, useWebWorker: false })
    const { buffer } = makeRightOnlyBuffer()

    const frequencies = await internals.getFrequencies(buffer)

    expect(frequencies.length).toBe(2)
    expect(frequencies[0].every((frame: Uint8Array) => frame.every((value) => value === 0))).toBe(true)
    expect(frequencies[1].some((frame: Uint8Array) => frame.some((value) => value > 0))).toBe(true)
  })

  it('passes a mono channel through as is', () => {
    const internals = createPlugin({ splitChannels: false, useWebWorker: true })
    const signal = makeSine(SAMPLE_RATE)
    const buffer = {
      sampleRate: SAMPLE_RATE,
      length: SAMPLE_RATE,
      duration: 1,
      numberOfChannels: 1,
      getChannelData: () => signal,
    } as unknown as AudioBuffer
    internals.getFrequencies(buffer).catch(() => undefined)

    const worker = mockWorkerInstances[mockWorkerInstances.length - 1]
    const { audioData } = worker.postMessage.mock.calls[0][0]

    expect(audioData).toEqual([signal])
    expect(audioData[0].buffer).toBe(signal.buffer)
  })
})
