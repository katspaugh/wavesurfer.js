async function fetchBlob(
  url: string,
  progressCallback: (percentage: number) => void,
  requestInit?: RequestInit,
): Promise<Blob> {
  // Fetch the resource
  const response = await fetch(url, requestInit)

  // Read the data to track progress
  {
    const reader = response.clone().body?.getReader()
    const contentLength = Number(response.headers?.get('Content-Length'))
    let receivedLength = 0

    // Process the data
    const processChunk = async (done: boolean | undefined, value: Uint8Array | undefined): Promise<void> => {
      if (done) return

      // Add to the received length
      receivedLength += value?.length || 0

      const percentage = Math.round((receivedLength / contentLength) * 100)
      progressCallback(percentage)

      // Continue reading data
      return reader?.read().then(({ done, value }) => processChunk(done, value))
    }

    reader?.read().then(({ done, value }) => processChunk(done, value))
  }

  return response.blob()
}

const Fetcher = {
  fetchBlob,
}

export default Fetcher
