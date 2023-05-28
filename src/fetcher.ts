async function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  return fetch(url).then((response) => response.arrayBuffer())
}

const Fetcher = {
  fetchArrayBuffer,
}

export default Fetcher
