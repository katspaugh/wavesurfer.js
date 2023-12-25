// React example

/*
  <html>
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  </html>
*/

// Import React hooks
const { useRef, useState, useEffect, useCallback, memo } = React

// Import WaveSurfer
import WaveSurfer from 'wavesurfer.js'

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
const WaveSurferPlayer = memo((props) => {
  const containerRef = useRef()
  const [isPlaying, setIsPlaying] = useState(false)
  const wavesurfer = useWavesurfer(containerRef, props)
  const { onPlay, onReady } = props

  // On play button click
  const onPlayClick = useCallback(() => {
    wavesurfer.playPause()
  }, [wavesurfer])

  // Initialize wavesurfer when the container mounts
  // or any of the props change
  useEffect(() => {
    if (!wavesurfer) return

    const getPlayerParams = () => ({
      media: wavesurfer.getMediaElement(),
      peaks: wavesurfer.exportPeaks(),
    })

    const subscriptions = [
      wavesurfer.on('ready', () => {
        onReady && onReady(getPlayerParams())

        setIsPlaying(wavesurfer.isPlaying())
      }),
      wavesurfer.on('play', () => {
        onPlay &&
          onPlay((prev) => {
            const newParams = getPlayerParams()
            if (!prev || prev.media !== newParams.media) {
              if (prev) {
                prev.media.pause()
                prev.media.currentTime = 0
              }
              return newParams
            }
            return prev
          })

        setIsPlaying(true)
      }),
      wavesurfer.on('pause', () => setIsPlaying(false)),
    ]

    return () => {
      subscriptions.forEach((unsub) => unsub())
    }
  }, [wavesurfer, onPlay, onReady])

  return (
    <div style={{ display: 'flex', gap: '1em', marginBottom: '1em' }}>
      <button onClick={onPlayClick}>{isPlaying ? '⏸️' : '▶️'}</button>

      <div ref={containerRef} style={{ minWidth: '200px' }} />
    </div>
  )
})

const Playlist = memo(({ urls, setCurrentPlayer }) => {
  return urls.map((url, index) => (
    <WaveSurferPlayer
      key={url}
      height={100}
      waveColor="rgb(200, 0, 200)"
      progressColor="rgb(100, 0, 100)"
      url={url}
      onPlay={setCurrentPlayer}
      onReady={index === 0 ? setCurrentPlayer : undefined}
    />
  ))
})

const audioUrls = ['/examples/audio/audio.wav', '/examples/audio/demo.wav', '/examples/audio/stereo.mp3']

const App = () => {
  const [currentPlayer, setCurrentPlayer] = useState()

  return (
    <>
      <p>Playlist</p>
      <Playlist urls={audioUrls} setCurrentPlayer={setCurrentPlayer} />

      <p>Global player</p>
      {currentPlayer && (
        <WaveSurferPlayer
          height={50}
          waveColor="blue"
          progressColor="purple"
          media={currentPlayer.media}
          peaks={currentPlayer.peaks}
        />
      )}
    </>
  )
}

// Create a React root and render the app
const root = ReactDOM.createRoot(document.body)
root.render(<App />)
