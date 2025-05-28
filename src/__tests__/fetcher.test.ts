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
})
