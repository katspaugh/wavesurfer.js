async function watchProgress(response: Response, progressCallback: (percentage: number) => void) {
  if (!response.body || !response.headers) return
  const reader = response.body.getReader()

  const contentLength = Number(response.headers.get('Content-Length')) || 0
  let receivedLength = 0

  // Process the data
  const processChunk = (value: Uint8Array | undefined) => {
    // Add to the received length
    receivedLength += value?.length || 0
    const percentage = Math.round((receivedLength / contentLength) * 100)
    progressCallback(percentage)
  }

  // Use iteration instead of recursion to avoid stack issues
  try {
    while (true) {
      const data = await reader.read()

      if (data.done) {
        break
      }

      processChunk(data.value)
    }
  } catch (err) {
    // Ignore errors because we can only handle the main response
    console.warn('Progress tracking error:', err)
  }
}

async function fetchBlob(
  url: string,
  progressCallback: (percentage: number) => void,
  requestInit?: RequestInit,
): Promise<Blob> {
  // Fetch the resource
  const response = await fetch(url, requestInit)

  if (response.status >= 400) {
    throw new Error(`Failed to fetch ${url}: ${response.status} (${response.statusText})`)
  }

  // Read the data to track progress
  watchProgress(response.clone(), progressCallback)

  return response.blob()
}

const Fetcher = {
  fetchBlob,
}

export default Fetcher
