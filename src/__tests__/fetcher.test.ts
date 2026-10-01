import Fetcher from '../fetcher.js'
import { TextEncoder } from 'util'
import { Blob as NodeBlob } from 'buffer'

describe('Fetcher', () => {
  test('fetchBlob returns blob and reports progress', async () => {
    const data = 'hello'
    const reader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(data) })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    }
    const response = {
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'Content-Length': data.length.toString() }),
      body: { getReader: () => reader },
      clone() {
        return this
      },
      blob: async () => new NodeBlob([data]),
    } as unknown as Response

    global.fetch = jest.fn().mockResolvedValue(response)

    const progress = jest.fn()
    const blob = await Fetcher.fetchBlob('url', progress)
    expect(await blob.text()).toBe(data)

    // wait for watchProgress to process
    await new Promise(process.nextTick)
    expect(progress).toHaveBeenCalledWith(100)
  })

  test('fetchBlob reads the response as an array buffer when requested', async () => {
    const data = 'video data'
    const response = {
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'Content-Type': 'video/mp4' }),
      body: null,
      clone() {
        return this
      },
      blob: jest.fn().mockRejectedValue(new TypeError('Failed to fetch')),
      arrayBuffer: jest.fn().mockResolvedValue(new TextEncoder().encode(data).buffer),
    } as unknown as Response

    global.fetch = jest.fn().mockResolvedValue(response)

    const blob = await Fetcher.fetchBlob('url', jest.fn(), undefined, 'arrayBuffer')

    expect(response.arrayBuffer).toHaveBeenCalled()
    expect(response.blob).not.toHaveBeenCalled()
    expect(blob.size).toBe(data.length)
    expect(blob.type).toBe('video/mp4')
  })
})
