'use strict';

const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
let wavesurfer, context, processor;

// Init & load
document.addEventListener('DOMContentLoaded', function() {
    let micBtn = document.querySelector('#micBtn');

    micBtn.onclick = function() {
        if (wavesurfer === undefined) {
            if (isSafari) {
                // Safari 11 or newer automatically suspends new AudioContext's that aren't
                // created in response to a user-gesture, like a click or tap, so create one
                // here (inc. the script processor)
                let AudioContext =
                    window.AudioContext || window.webkitAudioContext;
                context = new AudioContext();
                processor = context.createScriptProcessor(1024, 1, 1);
            }

            // Init wavesurfer
            wavesurfer = WaveSurfer.create({
                container: '#waveform',
                waveColor: 'black',
                interact: false,
                cursorWidth: 0,
                audioContext: context || null,
                audioScriptProcessor: processor || null,
                plugins: [
                    WaveSurfer.microphone.create({
                        bufferSize: 4096,
                        numberOfInputChannels: 1,
                        numberOfOutputChannels: 1,
                        constraints: {
                            video: false,
                            audio: true
                        }
                    })
                ]
            });

            wavesurfer.microphone.on('deviceReady', function() {
                console.info('Device ready!');
            });
            wavesurfer.microphone.on('deviceError', function(code) {
                console.warn('Device error: ' + code);
            });
            wavesurfer.on('error', function(e) {
                console.warn(e);
            });
            wavesurfer.microphone.start();
        } else {
            // start/stop mic on button click
            if (wavesurfer.microphone.active) {
                wavesurfer.microphone.stop();
            } else {
                wavesurfer.microphone.start();
            }
        }
    };
});
