'use strict';

// Create an instance
var wavesurfer = Object.create(WaveSurfer);

// Init & load
document.addEventListener('DOMContentLoaded', function () {
  // Init wavesurfer
  wavesurfer.init({
    container     : '#waveform',
    waveColor     : 'violet',
    progressColor : 'purple',
    loaderColor   : 'purple',
    cursorColor   : 'navy'
  });
  wavesurfer.load('../../example/media/demo.wav');

  // Time stretcher
  wavesurfer.on('ready', function () {
    var st = new soundtouch.SoundTouch(wavesurfer.backend.ac.sampleRate);
    var data = wavesurfer.backend.buffer.getChannelData(0);
    var length = data.length;
    var seekingPos = null;
    var seekingDiff = 0;

    var source = {
      extract: function (target, numFrames, position) {
        if (seekingPos != null) {
          seekingDiff = seekingPos - position;
          seekingPos = null;
        }

        position += seekingDiff;

        for (var i = 0; i < numFrames; i++) {
          target[i * 2] = data[i + position];
        }
        return Math.min(numFrames, length - position);
      }
    };

    var soundtouchNode;

    wavesurfer.on('play', function () {
      seekingPos = ~~(wavesurfer.backend.getPlayedPercents() * length);
      st.tempo = wavesurfer.getPlaybackRate();

      if (st.tempo === 1) {
        wavesurfer.backend.disconnectFilters();
      } else {
        if (!soundtouchNode) {
          var filter = new soundtouch.SimpleFilter(source, st);
          soundtouchNode = soundtouch.getWebAudioNode(wavesurfer.backend.ac, filter);
        }
        wavesurfer.backend.setFilter(soundtouchNode);
      }
    });

    wavesurfer.on('pause', function () {
      soundtouchNode && soundtouchNode.disconnect();
    });

    wavesurfer.on('seek', function () {
      seekingPos = ~~(wavesurfer.backend.getPlayedPercents() * length);
    });
  });
});
