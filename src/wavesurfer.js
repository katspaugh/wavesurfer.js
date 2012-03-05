(function (globals, exports) {
    'use strict';

    globals.requestAnimationFrame = globals.requestAnimationFrame ||
        globals.webkitRequestAnimationFrame;


    var WaveSurfer = {};


    WaveSurfer.visualizer = {
		FRAME_TIME: 1000 / 60,

        init: function (canvas, analyzer, params) {
            params = params || {};

            this.canvas = canvas;
            this.analyzer = analyzer;
            this.initCanvas(params);

			if (params.continuous) {
				this.scroller = this.canvas.offsetParent;
				this.continuousLineWidth = params.continuousLineWidth || 1;
				this.cursor = params.cursor;
				this.drawFn = this.drawContinuous;
			} else {
				this.drawFn = this.drawCurrent;
			}

            this.pos = 0;
        },

        initCanvas: function (params) {
            this.cc = this.canvas.getContext('2d');
            this.width = this.canvas.width;
            this.height = this.canvas.height;

            if (params.color) {
                this.cc.fillStyle = params.color;
                this.cc.strokeStyle = params.color;
            }
        },

		bindClick: function () {
			var self = this;
			this.canvas.addEventListener('click', function (e) {
				var canvasPosition = this.getBoundingClientRect();
				var relX = e.pageX - canvasPosition.left;
				var frames = relX / self.continuousLineWidth;
				var timePlayed = frames * self.FRAME_TIME;

				if (self.cursor) {
					self.cursor.style.left = relX + 'px';
				}

				self.analyzer.playRegion(timePlayed / 1000);
			}, false);
		},

        loop: function (dataFn) {
			var self = this;

			function loop() {
				if (!self.analyzer.isPaused()) {
					var data = dataFn.call(self.analyzer);
					self.drawFn(data);
				}
				globals.requestAnimationFrame(loop, self.canvas)
			};

			loop();
        },

        drawCurrent: function (data) {
            var w = this.width, h = this.height,
                len = data.length,
                i, value;

            this.lineWidth = ~~(w / len);

            this.cc.clearRect(0, 0, w, h);

            this.cc.beginPath();
            for (i = 0; i < len; i += 1) {
                value = ~~(h - (data[i] / 256 * h));
                this.cc.lineTo(
                    this.lineWidth * i, h - value
                );
            }
            this.cc.stroke();
        },

        drawContinuous: function (data) {
            var h = this.height,
                halfH = ~~(h / 2);

			this.lineWidth = this.continuousLineWidth;

            var value = ~~((h - (data[0] / 256 * h)) / 2);
            this.cc.fillRect(
                this.pos, halfH - value,
                this.lineWidth, value * 2
            );


			if (this.cursor) {
				this.cursor.style.left = this.pos + 'px';
			}

			if (this.offsetParent) {
				this.offsetParent.scrollLeft = this.pos;
			}

            this.pos += 1;
        }
    };


    WaveSurfer.analyzer = {
        ac: new (globals.AudioContext ||
            globals.webkitAudioContext),

        /**
         * Initializes the analyser with given params.
         *
         * @param {Object} params
         * @param {String} params.smoothingTimeConstant
         */
        init: function (params) {
            params = params || {};

			this.js = this.ac.createJavaScriptNode(
				params.bufferSize || 2048,
				2, /* number of input channels */
				2 /* number of output channels */
			);

            this.analyser = this.ac.createAnalyser();
            this.analyser.smoothingTimeConstant =
                params.smoothingTimeConstant || 0.3;

            this.analytics = new Uint8Array(
                this.analyser.frequencyBinCount
            );

            this.destination = params.destination || this.ac.destination;

			this.analyser.connect(this.destination);
			this.js.connect(this.destination);

            this.paused = true;

            this.defineSource();
        },

        /**
         * @private
         */
        defineSource: function () {
            var self = this, source;

            Object.defineProperty(this, 'source', {
                get: function () {
                    return source;
                },
                set: function (value) {
					if (source) {
						self.clearPauseTimeout();
						source.disconnect();
					}
                    source = value;
                    source.connect(self.analyser);
                }
            });
        },

        /**
         * Loads audio data from a HTML5 media element.
         *
         * @param {HTMLAudioElement} el The audio/video DOM-element.
         */
        loadElement: function (el) {
            this.type = 'element';
            this.source = this.ac.createMediaElementSource(el);
            this.audioEl = el;
        },

        /**
         * Loads data as an audiobuffer.
         *
         * @param {AudioBuffer} data Audio data.
         */
        loadData: function (data) {
            var self = this;
            this.ac.decodeAudioData(
                data,
                /* success */
                function (buffer) {
                    self.type = 'buffer';
                    self.currentBuffer = buffer;
					self.source = self.ac.createBufferSource();
                },
                /* failure */
                function (e) {
                    throw e;
                }
            );
        },

        isPaused: function () {
            if ('element' === this.type) {
                return this.audioEl.paused;
            }
            return this.paused;
        },

		setPauseTimeout: function (delay) {
			var endTime = this.ac.currentTime + delay;
			var timeout = (function () {
				if (this.ac.currentTime >= endTime) {
					this.pause();
					this.js.onaudioprocess = null;
				}
			}).bind(this);

			this.js.onaudioprocess = timeout;
		},

		clearPauseTimeout: function () {
			this.js.onaudioprocess = null;
		},

        /**
         * Plays the loaded audio region.
		 * 
		 * @param {Number} start Start offset in seconds,
		 * relative to the beginning of the track.
		 * 
		 * @param {Number} end End offset in seconds,
		 * relative to the beginning of the track. 
         */
        playRegion: function (start, end) {
			this.pause();

			start = start || 0;

            if ('buffer' === this.type) {
                this.source = this.ac.createBufferSource();
                this.source.buffer = this.currentBuffer;
				var duration = end ? end - start : this.source.buffer.duration;
				this.source.noteGrainOn(0, start, duration);
            } else if ('element' === this.type) {
				this.audioEl.currentTime = start;
                this.audioEl.play();
            }

            this.paused = false;

			if (end) {
				this.setPauseTimeout(end - start);
			}
        },

		/**
		 * Unpauses the loaded audio.
		 */
		play: function () {
			this.clearPauseTimeout();

            if (!this.isPaused()) {
                return;
            }

            if ('buffer' === this.type) {
                this.source = this.ac.createBufferSource();
                this.source.buffer = this.currentBuffer;
				this.source.noteOn(0);
            } else if ('element' === this.type) {
                this.audioEl.play();
            }

            this.paused = false;
		},

        /**
         * Pauses the loaded audio.
         */
        pause: function () {
			this.clearPauseTimeout();

            if (this.isPaused()) {
                return;
            }

            if ('buffer' === this.type) {
                this.source.noteOff(0);
            } else if ('element' === this.type) {
                this.audioEl.pause();
            }

            this.paused = true;
        },

        /**
         * Returns the real-time waveform data.
         *
         * @return {Uint8Array} The waveform data.
         * Values range from 0 to 255.
         */
        waveform: function () {
            this.analyser.getByteTimeDomainData(this.analytics);
            return this.analytics;
        },

        /**
         * Returns the real-time frequency data.
         *
         * @return {Uint8Array} The frequency data.
         * Values range from 0 to 255.
         */
        frequency: function () {
            this.analyser.getByteFrequencyData(this.analytics);
            return this.analytics;
        }
    };

    exports.WaveSurfer = WaveSurfer;
}(this, this));