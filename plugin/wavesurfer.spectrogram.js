'use strict';

WaveSurfer.Spectrogram = {
    init: function (params) {
        this.params = params;
        var wavesurfer = this.wavesurfer = params.wavesurfer;

        if (!this.wavesurfer) {
            throw Error('No WaveSurfer intance provided');
        }

        var drawer = this.drawer = this.wavesurfer.drawer;
        this.buffer = this.wavesurfer.backend.buffer;

        this.container = 'string' == typeof params.container ?
            document.querySelector(params.container) : params.container;

        if (!this.container) {
            throw Error('No container for WaveSurfer spectrogram');
        }

        this.width = drawer.width;
		this.pixelRatio = this.params.pixelRatio || wavesurfer.params.pixelRatio;
		this.fftSamples = this.params.fftSamples || wavesurfer.params.fftSamples || 1024;
        this.height = this.fftSamples / 4;

        this.createWrapper();
        this.createCanvas();
        this.updateCanvasStyle();
        this.drawSpectrogram();

        wavesurfer.drawer.wrapper.onscroll = this.updateScroll.bind(this)
    },

    createWrapper: function () {
        var wsParams = this.wavesurfer.params
        this.wrapper = this.container.appendChild(
            document.createElement('spectrogram')
        );
        this.drawer.style(this.wrapper, {
            display: 'block',
            position: 'relative',
            userSelect: 'none',
            webkitUserSelect: 'none',
            height: this.height + 'px'
        });

        if (wsParams.fillParent || wsParams.scrollParent) {
            this.drawer.style(this.wrapper, {
                width: '100%',
                overflowX: 'hidden',
                overflowY: 'hidden'
            });
        }

        var my = this;
        this.wrapper.addEventListener('click', function (e) {
            e.preventDefault();
            var relX = 'offsetX' in e ? e.offsetX : e.layerX;
            my.fireEvent('click', (relX / my.scrollWidth) || 0);
        });
    },

    createCanvas: function () {
        var canvas = this.canvas = this.wrapper.appendChild(
          document.createElement('canvas')
        );

        this.spectrCc = canvas.getContext('2d');

        this.wavesurfer.drawer.style(canvas, {
            position: 'absolute',
            zIndex: 4
        });
    },

    updateCanvasStyle: function () {
        var width = Math.round(this.width / this.pixelRatio) + 'px';
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.style.width = width;
    },

    drawSpectrogram: function() {
		var buffer = this.buffer;
		var fftSamples = this.fftSamples;
		var spectrCc = this.spectrCc;

		var length = this.wavesurfer.backend.getDuration();
		var columnWidth = 0.1 * this.width / length;
		var height = this.height;

		var chrome = navigator.userAgent.indexOf('Chrom') > -1 ? true : false;
		var channel, sampleSize;

		if (chrome) {
			channel = buffer.getChannelData(0);
			sampleSize = Math.ceil(buffer.length / length * 0.1);
		}
		else {
			sampleSize = buffer.length;
		}

		var samplesCount = Math.ceil(buffer.length / sampleSize);

		var i = 0;
        var my = this;

		function processSample() {
			var frequencyData = new Array();
			var context = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, sampleSize, buffer.sampleRate);
			var source = context.createBufferSource();
			var processor = context.createScriptProcessor(0, 1, 1);

			var analyser = context.createAnalyser();
			analyser.fftSize = fftSamples;
			analyser.smoothingTimeConstant = 0.0;

			if (chrome) {
				source.buffer = context.createBuffer(1, sampleSize, buffer.sampleRate);
			}
			else {
				source.buffer = buffer;
			}

			source.connect(analyser);
			analyser.connect(processor);
			processor.connect(context.destination);

			processor.onaudioprocess = function (e) {
				var array = new Uint8Array(analyser.frequencyBinCount);
				analyser.getByteFrequencyData(array);

				if (chrome && frequencyData.length == 0) {
					frequencyData.push(array);
				}
				else {
					my.drawColumn(array, height, columnWidth, i);
					i++;
				}
			};

			if (chrome) {
				context.oncomplete = function (e) {
					if (frequencyData.length > 0) {
						my.drawColumn(frequencyData[0], height, columnWidth, i);
						i++;
					}
					else {
						console.log('Got 0 frequencies frames for sample ' + i + ', repeating');
					}

					if (i <= samplesCount) {
						processSample();
					}
				};
			}

			if (chrome) {
				var sample = new Float32Array(sampleSize);

				for (var j = 0; j < sampleSize; j++) {
					sample[j] = channel[i * sampleSize + j]
				}

				source.buffer.getChannelData(0).set(sample);
			}

			source.start(0);
			context.startRendering();
		}

		processSample();
    },

    drawColumn: function(column, height, width, start) {
		start = start || 0;
		for (var r = 0; r < column.length; r++) {
			var colorValue = 255 - column[r];
			this.spectrCc.fillStyle = 'rgb(' + colorValue + ', '  + colorValue + ', ' + colorValue + ')';
			this.spectrCc.fillRect(start * width, height - r, width, 1);
		}
	},

    updateScroll: function(e) {
      this.wrapper.scrollLeft = e.target.scrollLeft
    }
};

WaveSurfer.util.extend(WaveSurfer.Spectrogram, WaveSurfer.Observer);
