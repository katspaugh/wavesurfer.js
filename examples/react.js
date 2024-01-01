// React example
// See https://github.com/katspaugh/wavesurfer-react

import * as React from 'react'
const { useMemo, useState, useCallback, useRef } = React
import { createRoot } from 'react-dom/client'
import { useWavesurfer } from '@wavesurfer/react'
import Timeline from 'wavesurfer.js/dist/plugins/timeline.esm.js'

const audioUrls = [
  '/examples/audio/audio.wav',
  '/examples/audio/stereo.mp3',
  '/examples/audio/mono.mp3',
  '/examples/audio/librivox.mp3',
]

const formatTime = (seconds) => [seconds / 60, seconds % 60].map((v) => `0${Math.floor(v)}`.slice(-2)).join(':')

// A React component that will render wavesurfer
const App = () => {
  const containerRef = useRef(null)
  const [urlIndex, setUrlIndex] = useState(0)

  const { wavesurfer, isPlaying, currentTime } = useWavesurfer({
    container: containerRef,
    height: 100,
    waveColor: 'rgb(200, 0, 200)',
    progressColor: 'rgb(100, 0, 100)',
    url: audioUrls[urlIndex],
    plugins: useMemo(() => [Timeline.create()], []),
  })

  const onUrlChange = useCallback(() => {
    setUrlIndex((index) => (index + 1) % audioUrls.length)
  }, [])

  const onPlayPause = useCallback(() => {
    wavesurfer && wavesurfer.playPause()
  }, [wavesurfer])

  return (
    <>
      <div ref={containerRef} />

      <p>Current audio: {audioUrls[urlIndex]}</p>

      <p>Current time: {formatTime(currentTime)}</p>

      <div style={{ margin: '1em 0', display: 'flex', gap: '1em' }}>
        <button onClick={onUrlChange}>Change audio</button>

        <button onClick={onPlayPause} style={{ minWidth: '5em' }}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
      </div>
    </>
  )
}

// Create a React root and render the app
const root = createRoot(document.body)
root.render(<App />)

/*
  <html>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

    <script type="importmap">
      {
        "imports": {
          "react": "https://esm.sh/react",
          "react/jsx-runtime": "https://esm.sh/react/jsx-runtime",
          "react-dom/client": "https://esm.sh/react-dom/client",
          "wavesurfer.js": "../dist/wavesurfer.esm.js",
          "wavesurfer.js/dist": "../dist",
          "@wavesurfer/react": "https://unpkg.com/@wavesurfer/react"
        }
      }
    </script>
  </html>
*/
