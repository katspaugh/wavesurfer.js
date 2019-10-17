'use strict';

// Create an instance
var wavesurfer = {};

// Init & load audio file
document.addEventListener('DOMContentLoaded', function() {
    // Init
    wavesurfer = WaveSurfer.create({
        container: document.querySelector('#waveform'),
        backend: 'MediaElementWebAudio',
        minPxPerSec: 30,
        scrollParent: true,
        waveColor: '#A8DBA8',
        progressColor: '#3B8686',
        plugins: [
            WaveSurfer.timeline.create({
                container: '#timeline'
            })
        ]
    });

    // get audio peaks
    fetch('peaks.json')
        .then(response => {
            return response.json();
        })
        .then(peaks => {
            let max = peaks.data.reduce((max, el) => (el > max ? el : max));

            return peaks.data.map(el => {
                return el / max;
            });
        })
        .then(normalizedPeaks => {
            // Load audio from URL
            wavesurfer.load('stereo.mp3', normalizedPeaks, 51);
        });

    // Panner

    wavesurfer.panner = wavesurfer.backend.ac.createStereoPanner();

    let sliderPanner = document.querySelector('[data-action="pan"]');
    sliderPanner.addEventListener('input', () => {
        wavesurfer.panner.pan.value = Number(sliderPanner.value);
    });

    //Channel Volumes
    const channelSplitterNode = wavesurfer.backend.ac.createChannelSplitter(2);
    const channelMergerNode = wavesurfer.backend.ac.createChannelMerger(2);
    const leftGainNode = wavesurfer.backend.ac.createGain();
    const rightGainNode = wavesurfer.backend.ac.createGain();

    channelSplitterNode.connect(leftGainNode, 0);
    leftGainNode.gain.value = 0.8;

    channelSplitterNode.connect(rightGainNode, 1);
    rightGainNode.gain.value = 0.8;

    leftGainNode.connect(channelMergerNode, 0, 0);
    rightGainNode.connect(channelMergerNode, 0, 1);
    wavesurfer.backend.setFilters([
        channelSplitterNode,
        leftGainNode,
        channelMergerNode,
        wavesurfer.panner
    ]);

    let sliderLeftVolume = document.querySelector('[data-action="leftVolume"]');
    sliderLeftVolume.addEventListener('input', () => {
        leftGainNode.gain.value = Number(sliderLeftVolume.value);
    });

    let sliderRightVolume = document.querySelector(
        '[data-action="rightVolume"]'
    );
    sliderRightVolume.addEventListener('input', () => {
        rightGainNode.gain.value = Number(sliderRightVolume.value);
    });

    // Log errors
    wavesurfer.on('error', function(msg) {
        console.log(msg);
    });

    // Bind play/pause button
    document
        .querySelector('[data-action="play"]')
        .addEventListener('click', wavesurfer.playPause.bind(wavesurfer));
});
