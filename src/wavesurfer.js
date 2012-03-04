(function (globals, exports) {
    'use strict';

    globals.requestAnimationFrame = globals.requestAnimationFrame ||
        globals.webkitRequestAnimationFrame;


    var WaveSurfer = {};


    WaveSurfer.visualizer = {
        init: function (canvas, analyzer, params) {
            params = params || {};

            this.canvas = canvas;
            this.analyzer = analyzer;
            this.initCanvas(params);

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

        loop: function (drawFn, dataFn) {
            if (!this.analyzer.isPaused()) {
                var data = dataFn.call(this.analyzer);
                drawFn.call(this, data);
            }
            var self = this;
            globals.requestAnimationFrame(function () {
                self.loop(drawFn, dataFn);
            }, this.canvas);
        },

        drawCurrent: function (data) {
            var w = this.width, h = this.height,
                len = data.length,
                lineW = ~~(w / len),
                i, value;

            this.cc.clearRect(0, 0, w, h);

            this.cc.beginPath();
            for (i = 0; i < len; i += 1) {
                value = ~~(h - (data[i] / 256 * h));
                this.cc.lineTo(
                    lineW * i, h - value
                );
            }
            this.cc.stroke();
        },

        drawContinuous: function (data) {
            var w = this.width, h = this.height,
                x = this.pos % w,
                halfH = ~~(h / 2);

            var value = ~~((h - (data[0] / 256 * h)) / 2);
            this.cc.fillRect(
                x, halfH - value,
                1, value * 2
            );

            this.pos += 1;

            if (this.pos > 0 && x === 0) {
                this.cc.clearRect(0, 0, w, h);
            }
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

            this.analyser = this.ac.createAnalyser();
            this.analyser.smoothingTimeConstant =
                params.smoothingTimeConstant || 0.3;

            this.analytics = new Uint8Array(
                this.analyser.frequencyBinCount
            );

            this.destination = this.ac.destination;
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
                    source && source.disconnect();
                    self.analyser.disconnect();
                    source = value;
                    source.connect(self.analyser);
                    self.analyser.connect(self.destination);
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

        /**
         * Plays the loaded audio.
         */
        play: function () {
            if (!this.isPaused()) {
                return;
            }

            if ('buffer' === this.type) {
                this.source = this.ac.createBufferSource();
                this.source.connect(this.destination);
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