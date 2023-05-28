// React example

/*
  <html>
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  </html>
*/

// Import React hooks
const { useRef, useState, useEffect, useCallback } = React

// Import WaveSurfer
import WaveSurfer from 'https://unpkg.com/wavesurfer.js@beta'
import Timeline from 'https://unpkg.com/wavesurfer.js@beta/dist/plugins/timeline.js'

// WaveSurfer hook
const useWavesurfer = (containerRef, options) => {
  const [wavesurfer, setWavesurfer] = useState(null)

  // Initialize wavesurfer when the container mounts
  // or any of the props change
  useEffect(() => {
    if (!containerRef.current) return

    const ws = WaveSurfer.create({
      ...options,
      container: containerRef.current,
    })

    setWavesurfer(ws)

    return () => {
      ws.destroy()
    }
  }, [options, containerRef])

  return wavesurfer
}

// Create a React component that will render wavesurfer.
// Props are wavesurfer options.
const WaveSurferPlayer = (props) => {
  const containerRef = useRef()
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const wavesurfer = useWavesurfer(containerRef, props)

  // On play button click
  const onPlayClick = useCallback(() => {
    wavesurfer.isPlaying() ? wavesurfer.pause() : wavesurfer.play()
  }, [wavesurfer])

  // Initialize wavesurfer when the container mounts
  // or any of the props change
  useEffect(() => {
    if (!wavesurfer) return

    setCurrentTime(0)
    setIsPlaying(false)

    const subscriptions = [
      wavesurfer.on('play', () => setIsPlaying(true)),
      wavesurfer.on('pause', () => setIsPlaying(false)),
      wavesurfer.on('timeupdate', (currentTime) => setCurrentTime(currentTime)),
    ]

    return () => {
      subscriptions.forEach((unsub) => unsub())
    }
  }, [wavesurfer])

  return (
    <>
      <div ref={containerRef} style={{ minHeight: '120px' }} />

      <button onClick={onPlayClick} style={{ marginTop: '1em' }}>
        {isPlaying ? 'Pause' : 'Play'}
      </button>

      <p>Seconds played: {currentTime}</p>
    </>
  )
}

// Another React component that will render two wavesurfers
const App = () => {
  const urls = ['/examples/audio/audio.wav', '/examples/audio/stereo.mp3']
  const [audioUrl, setAudioUrl] = useState(urls[0])

  // Swap the audio URL
  const onUrlChange = useCallback(() => {
    urls.reverse()
    setAudioUrl(urls[0])
  }, [])

  // Render the wavesurfer component
  // and a button to load a different audio file
  return (
    <>
      <WaveSurferPlayer
        height={100}
        waveColor="rgb(200, 0, 200)"
        progressColor="rgb(100, 0, 100)"
        url={audioUrl}
        plugins={[Timeline.create()]}
      />

      <button onClick={onUrlChange}>Change audio</button>
    </>
  )
}

// Create a React root and render the app
const root = ReactDOM.createRoot(document.body)
root.render(<App />)
