'use strict';

// Create an instance
var wavesurfer = Object.create(WaveSurfer);

// Init & load audio file
document.addEventListener('DOMContentLoaded', function () {
    // Init
    wavesurfer.init({
        container: document.querySelector('#waveform'),
        minPxPerSec: 30,
        scrollParent: true,
        waveColor: '#A8DBA8',
        progressColor: '#3B8686'
    });

    // Load audio from URL
    wavesurfer.load('../split-channels/stereo.mp3');
    
    // Panner
    (function () {
        // Add panner
        wavesurfer.splitter = wavesurfer.backend.ac.createChannelSplitter();
        wavesurfer.merger = wavesurfer.backend.ac.createChannelMerger();
        wavesurfer.channelVolumeNode = [];

        wavesurfer.backend.analyser.disconnect();

        wavesurfer.backend.analyser.connect(wavesurfer.splitter);
        for (var channel = 0; channel < wavesurfer.backend.ac.destination.channelCount; channel++) {
			wavesurfer.channelVolumeNode.push(wavesurfer.backend.ac.createGain());
			wavesurfer.splitter.connect(wavesurfer.channelVolumeNode[channel],channel);
			wavesurfer.channelVolumeNode[channel].connect(wavesurfer.merger,0,channel);
		};
        wavesurfer.backend.connect(wavesurfer.merger,wavesurfer.backend.gainNode,wavesurfer.backend.ac.destination,'series');

        // Bind panner slider
        var onStereoPan = function () {
            var xDeg = parseInt(stereoPan.value);
            var x = xDeg * (Math.PI / 180);
            wavesurfer.channelVolumeNode[0].gain.value = Math.cos(x);
            wavesurfer.channelVolumeNode[1].gain.value = Math.sin(x);
        };
        var stereoPan = document.querySelector('[data-action="stereoPan"]');
        stereoPan.addEventListener('input', onStereoPan);
        stereoPan.addEventListener('change', onStereoPan);
        onStereoPan();

		var mono = function (channel) {
			wavesurfer.splitter.disconnect();
			if (channel == "-1") {
				wavesurfer.channelVolumeNode.forEach(function(element,index,array) {
					element.disconnect();
					this.splitter.connect(element,0);
					element.connect(this.merger,0,index);
					element.gain.value = 1;
				},wavesurfer);
			} else if (channel == "1") {
				wavesurfer.channelVolumeNode.forEach(function(element,index,array) {
					element.disconnect();
					wavesurfer.splitter.connect(element,1);
					element.connect(this.merger,0,index);
					element.gain.value = 1;
				},wavesurfer);
			} else {
				wavesurfer.channelVolumeNode.forEach(function(element,index,array) {
					element.disconnect();
					this.splitter.connect(element,index);
					element.connect(this.merger,0,index);
					element.gain.value = 1;
				},wavesurfer);
			};
		};
		
        // Bind mono slider
        var onMono = function () {
            mono(parseInt(monoSlider.value));
        };
        var monoSlider = document.querySelector('[data-action="mono"]');
        monoSlider.addEventListener('input', onMono);
        monoSlider.addEventListener('change', onMono);
        onMono();
        wavesurfer.on('ready', function () {
        	if (wavesurfer.backend.buffer.numberOfChannels == 1) {
        		mono(-1);
        		monoSlider.value = -1;
        		monoSlider.disabled = true;
        	};
        });
    }());

    // Log errors
    wavesurfer.on('error', function (msg) {
        console.log(msg);
    });

    // Bind play/pause button
    document.querySelector(
        '[data-action="play"]'
    ).addEventListener('click', wavesurfer.playPause.bind(wavesurfer));

    // Progress bar
    (function () {
        var progressDiv = document.querySelector('#progress-bar');
        var progressBar = progressDiv.querySelector('.progress-bar');

        var showProgress = function (percent) {
            progressDiv.style.display = 'block';
            progressBar.style.width = percent + '%';
        };

        var hideProgress = function () {
            progressDiv.style.display = 'none';
        };

        wavesurfer.on('loading', showProgress);
        wavesurfer.on('ready', hideProgress);
        wavesurfer.on('destroy', hideProgress);
        wavesurfer.on('error', hideProgress);
    }());
});
