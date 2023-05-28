// Silence detection example

import WaveSurfer from 'https://unpkg.com/wavesurfer.js@beta'
import RegionsPlugin from 'https://unpkg.com/wavesurfer.js@beta/dist/plugins/regions.js'

// Create an instance of WaveSurfer
const ws = WaveSurfer.create({
  container: document.body,
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  url: '/examples/audio/nasa.mp4',
  minPxPerSec: 50,
  interact: false,
})

// Initialize the Regions plugin
const wsRegions = ws.registerPlugin(RegionsPlugin.create())

// Find regions separated by silence
const extractRegions = (audioData, duration) => {
  const minValue = 0.01
  const minSilenceDuration = 0.1
  const mergeDuration = 0.2
  const scale = duration / audioData.length
  const silentRegions = []

  // Find all silent regions longer than minSilenceDuration
  let start = 0
  let end = 0
  let isSilent = false
  for (let i = 0; i < audioData.length; i++) {
    if (audioData[i] < minValue) {
      if (!isSilent) {
        start = i
        isSilent = true
      }
    } else if (isSilent) {
      end = i
      isSilent = false
      if (scale * (end - start) > minSilenceDuration) {
        silentRegions.push({
          start: scale * start,
          end: scale * end,
        })
      }
    }
  }

  // Merge silent regions that are close together
  const mergedRegions = []
  let lastRegion = null
  for (let i = 0; i < silentRegions.length; i++) {
    if (lastRegion && silentRegions[i].start - lastRegion.end < mergeDuration) {
      lastRegion.end = silentRegions[i].end
    } else {
      lastRegion = silentRegions[i]
      mergedRegions.push(lastRegion)
    }
  }

  // Find regions that are not silent
  const regions = []
  let lastEnd = 0
  for (let i = 0; i < mergedRegions.length; i++) {
    regions.push({
      start: lastEnd,
      end: mergedRegions[i].start,
    })
    lastEnd = mergedRegions[i].end
  }

  return regions
}

// Create regions for each non-silent part of the audio
ws.on('decode', (duration) => {
  const decodedData = ws.getDecodedData()
  if (decodedData) {
    const regions = extractRegions(decodedData.getChannelData(0), duration)

    // Add regions to the waveform
    regions.forEach((region, index) => {
      wsRegions.addRegion({
        start: region.start,
        end: region.end,
        content: index.toString(),
        drag: false,
        resize: false,
      })
    })
  }
})

// Play a region on click
let activeRegion = null
wsRegions.on('region-clicked', (region, e) => {
  e.stopPropagation()
  region.play()
  activeRegion = region
})
ws.on('timeupdate', (currentTime) => {
  // When the end of the region is reached
  if (activeRegion && currentTime >= activeRegion.end) {
    // Stop playing
    ws.pause()
    activeRegion = null
  }
})
