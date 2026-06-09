async function watchProgress(response: Response, progressCallback: (percentage: number) => void, signal?: AbortSignal) {
  if (!response.body || !response.headers) return
  const reader = response.body.getReader()

  const contentLength = Number(response.headers.get('Content-Length')) || 0
  let receivedLength = 0

  // Abort the reader when the signal fires
  const onAbort = () => {
    reader.cancel()
  }

  if (signal) {
    if (signal.aborted) {
      reader.cancel()
      return
    }
    signal.addEventListener('abort', onAbort, { once: true })
  }

  // Use iteration instead of recursion to avoid stack issues
  try {
    while (true) {
      const data = await reader.read()

      if (data.done) {
        break
      }

      receivedLength += data.value?.length || 0

      // Only report progress if Content-Length is available and non-zero
      if (contentLength > 0) {
        const percentage = Math.round((receivedLength / contentLength) * 100)
        progressCallback(percentage)
      }
    }
  } catch (err) {
    // Ignore abort errors from reader cancellation
    if (err instanceof DOMException && err.name === 'AbortError') return
    // Ignore other errors because we can only handle the main response
    console.warn('Progress tracking error:', err)
  } finally {
    // Remove the abort listener to prevent leaks
    if (signal) {
      signal.removeEventListener('abort', onAbort)
    }
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
  // Pass the abort signal so the progress reader can be cancelled
  watchProgress(response.clone(), progressCallback, requestInit?.signal ?? undefined)

  return response.blob()
}

const Fetcher = {
  fetchBlob,
}

export default Fetcher
