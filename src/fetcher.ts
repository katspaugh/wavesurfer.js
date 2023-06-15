async function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  return fetch(url).then((response) => response.arrayBuffer())
}

async function fetchBlob(url: string): Promise<Blob> {
  return fetch(url).then((response) => response.blob())
}

const Fetcher = {
  fetchArrayBuffer,
  fetchBlob,
}

export default Fetcher
