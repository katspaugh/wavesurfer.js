// Spectrogram plugin example

import WaveSurfer from 'wavesurfer.js'
import Spectrogram from 'wavesurfer.js/dist/plugins/spectrogram.esm.js'

// Create an instance of WaveSurfer
const ws = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  url: '/examples/audio/audio.wav',
  sampleRate: 44100,
})

// Initialize the Spectrogram plugin with detailed configuration
ws.registerPlugin(
  Spectrogram.create({
    // Display frequency labels on the left side
    labels: true,
    
    // Height of the spectrogram in pixels
    height: 200,
    
    // Render separate spectrograms for each audio channel
    // Set to false to combine all channels into one spectrogram
    splitChannels: true,
    
    // Frequency scale type:
    // - 'linear': Standard linear frequency scale (0-20kHz)
    // - 'logarithmic': Logarithmic scale, better for low frequencies
    // - 'mel': Mel scale based on human hearing perception (default)
    // - 'bark': Bark scale for psychoacoustic analysis
    // - 'erb': ERB scale for auditory filter modeling
    scale: 'mel',
    
    // Frequency range to display (in Hz)
    frequencyMax: 8000,  // Maximum frequency to show
    frequencyMin: 0,     // Minimum frequency to show
    
    // FFT parameters
    fftSamples: 1024,    // Number of samples for FFT (must be power of 2)
                        // Higher values = better frequency resolution, slower rendering
    
    // Visual styling
    labelsBackground: 'rgba(0, 0, 0, 0.1)',  // Background for frequency labels
    
    // Performance optimization
    useWebWorker: true,  // Use web worker for FFT calculations (improves performance)
    
    // Additional options you can configure:
    // 
    // Window function for FFT (affects frequency resolution vs time resolution):
    // windowFunc: 'hann' | 'hamming' | 'blackman' | 'bartlett' | 'cosine' | 'gauss' | 'lanczoz' | 'rectangular' | 'triangular'
    // 
    // Color mapping for frequency intensity:
    // colorMap: 'gray' | 'igray' | 'roseus' | custom array
    // 
    // Gain and range for color scaling:
    // gainDB: 20,        // Brightness adjustment (default: 20dB)
    // rangeDB: 80,       // Dynamic range (default: 80dB)
    // 
    // Overlap between FFT windows:
    // noverlap: null,    // Auto-calculated by default, or set manually
    // 
    // Maximum canvas width for performance:
    // maxCanvasWidth: 30000,  // Split large spectrograms into multiple canvases
  }),
)

// Play audio when user clicks on the waveform
ws.once('interaction', () => {
  ws.play()
})

// Event listeners for spectrogram interactions
ws.on('spectrogram-ready', () => {
  console.log('Spectrogram has finished rendering')
})

ws.on('spectrogram-click', (relativeX) => {
  console.log('Clicked on spectrogram at position:', relativeX)
  // You can use relativeX to seek to that position in the audio
  ws.setTime(relativeX * ws.getDuration())
})

/*
<html>
  <div id="waveform"></div>
  
  <!-- Configuration Options -->
  <div style="margin-top: 20px; padding: 15px; border-radius: 8px;">
    <div style=" border: 1px solid #ffeaa7; border-radius: 6px; padding: 12px; margin-bottom: 15px;">
      <strong>⚠️ Important Note:</strong> For audio files that require scrolling (longer than the container width), 
      you <strong>MUST</strong> set a <code>minPxPerSec</code> value in the WaveSurfer configuration to ensure 
      proper spectrogram rendering. Without this, the spectrogram may not display correctly.
    </div>
    
    <h3>Spectrogram Settings</h3>
    
    <h4>Visual Options</h4>
    <ul>
      <li><code>labels: true/false</code> - Show frequency labels on the left</li>
      <li><code>height: 200</code> - Spectrogram height in pixels</li>
      <li><code>splitChannels: true/false</code> - Separate spectrograms for each audio channel</li>
      <li><code>labelsBackground: 'rgba(0,0,0,0.1)'</code> - Background color for labels</li>
      <li><code>labelsColor: '#fff'</code> - Text color for frequency labels</li>
    </ul>
    
    <h4>Frequency Settings</h4>
    <ul>
      <li><code>scale: 'mel'|'linear'|'logarithmic'|'bark'|'erb'</code> - Frequency scale type</li>
      <li><code>frequencyMax: 8000</code> - Maximum frequency to display (Hz)</li>
      <li><code>frequencyMin: 0</code> - Minimum frequency to display (Hz)</li>
    </ul>
    
    <h4>Performance Settings</h4>
    <ul>
      <li><code>fftSamples: 1024</code> - FFT resolution (512, 1024, 2048, 4096)</li>
      <li><code>useWebWorker: true</code> - Use web worker for faster processing</li>
      <li><code>maxCanvasWidth: 30000</code> - Split large spectrograms into multiple canvases</li>
      <li><code>noverlap: null</code> - Overlap between FFT windows (auto-calculated)</li>
    </ul>
    
    <h4>Color & Styling</h4>
    <ul>
      <li><code>colorMap: 'gray'|'igray'|'roseus'</code> - Color scheme for frequency intensity</li>
      <li><code>gainDB: 20</code> - Brightness adjustment (-20 to +40)</li>
      <li><code>rangeDB: 80</code> - Dynamic range (20 to 120)</li>
      <li><code>windowFunc: 'hann'</code> - FFT window function (hann, hamming, blackman, etc.)</li>
    </ul>
    
    <p style="margin-top: 15px; font-size: 14px;">
      📖 <a href="https://wavesurfer.xyz/docs/modules/plugins_spectrogram">Full Documentation</a>
    </p>
  </div>
</html>
*/
