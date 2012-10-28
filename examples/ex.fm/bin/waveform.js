/******************************************************************************
 * Generate a PNG waveform image from a file containing an audio track.
 * http://github.com/jhurliman/node-pcm
 * Copyright (c) 2012 Cull TV, Inc. <jhurliman@cull.tv>
 *****************************************************************************/

var fs = require('fs');
var pcm = require('pcm');
var Canvas;
var ffprobe;

var WIDTH = 1024;
var HEIGHT = 128;
var SAMPLE_RATE = 11025;
var CHANNELS = 2;
var COLOR = 'navy';

// Check command line args
if (process.argv.length !== 4) {
  console.error('Usage: node waveform.js [input] [output.png]. Input is any ' +
    'file with an audio track readable by ffmpeg, and output is a ' +
    WIDTH+'x'+HEIGHT + ' PNG waveform image');
  process.exit(-1);
}

// Test if Canvas is installed
try {
  Canvas = require('canvas');
  ffprobe = require('node-ffprobe');
} catch (ex) {
  console.error('Canvas and node-ffprobe are required. Run "npm install canvas" ' +
    'and "npm install node-ffprobe" first.');
  process.exit(-2);
}

var peaks = new Array(WIDTH); // Peak value for each pixel of the output image
var peakIdx = 0; // Current index into peak array
var totalMax = 0; // Highest value seen in the input
var curMax = 0; // Highest value seen for the current round
var sampleIdx = 0; // Current sample index

ffprobe(process.argv[2], function(err, inputInfo) {
  if (err) {
    console.error(err);
    process.exit(-1);
  }

  if (!inputInfo || !inputInfo.format) {
      console.error("Couldn't read %s", process.argv[2]);
      process.exit(-1);
  }

  // Calculate the number of samples to merge into each vertical column of pixels
  // in the output image
  var samplesPerPeak = Math.round(
    inputInfo.format.duration * SAMPLE_RATE / WIDTH) * CHANNELS;

  console.log('Reading audio data...');
  pcm.getPcmData(process.argv[2], { stereo: CHANNELS === 2, sampleRate: SAMPLE_RATE },
    function(sample, channel) {
      sample = Math.abs(sample);
      if (sample > curMax) curMax = sample;

      // Do we have enough samples to store a peak value?
      if (++sampleIdx >= samplesPerPeak)
        storePeak();
    },
    function(err, output) {
      if (err) throw err;

      // Store the final peak value if needed
      if (sampleIdx > 0 && peakIdx < peaks.length)
        storePeak();

      console.log('Creating output image...');
      writePNG();
      process.on('exit', function() { console.log('Done'); });
    }
  );
});

function storePeak() {
  if (curMax > 0)
    curMax = altLogMeter(coefficientTodB(curMax));
  else
    curMax = -altLogMeter(coefficientTodB(-curMax));
  peaks[peakIdx++] = curMax;

  if (curMax > totalMax)
    totalMax = curMax;

  curMax = 0;
  sampleIdx = 0;
}

function log10(arg) {
  return Math.log(arg) / Math.LN10;
}

function logMeter(power, lowerdB, upperdB, nonLinearity) {
  return (power < lowerdB ? 0 : Math.pow((power - lowerdB) / (upperdB - lowerdB), nonLinearity));
}

function altLogMeter(power) {
  return logMeter(power, -192.0, 0.0, 8.0);
}

function coefficientTodB(coeff) {
  return 20.0 * log10(coeff);
}

function writePNG() {
  var canvas = new Canvas(WIDTH, HEIGHT);
  var ctx = canvas.getContext('2d');

  var gain = 1.0 / totalMax;

  for (var i = 0; i < peaks.length; i++)
    drawLine(ctx, i, null, peaks[i] * gain);

  var out = fs.createWriteStream(process.argv[3]);
  var stream = canvas.createPNGStream();
  stream.pipe(out);
}

function drawLine(ctx, offset, min, max) {
    var w = 1;
    var h = Math.round(max * HEIGHT);
    var x = offset;
    var y = Math.round((HEIGHT - h) / 2);

    ctx.fillStyle = COLOR;
    ctx.fillRect(x, y, w, h);
}
