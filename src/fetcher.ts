async function fetchBlob(url: string, init?: RequestInit): Promise<Blob> {
  return fetch(url, init).then((response) => response.blob())
}

const Fetcher = {
  fetchBlob,
}

export default Fetcher
