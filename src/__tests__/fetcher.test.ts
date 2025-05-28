import Fetcher from '../fetcher.js'

describe('Fetcher', () => {
  test('fetchBlob returns blob and reports progress', async () => {
    const data = 'hello'
    const response = new Response(data, {
      headers: { 'Content-Length': data.length.toString() },
    })
    global.fetch = jest.fn().mockResolvedValue(response)

    const progress = jest.fn()
    const blob = await Fetcher.fetchBlob('url', progress)
    expect(await blob.text()).toBe(data)

    // wait for watchProgress to process
    await new Promise(process.nextTick)
    expect(progress).toHaveBeenCalledWith(100)
  })
})
