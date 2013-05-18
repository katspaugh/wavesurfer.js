(function (window) {

    'use strict';

    var WaveSurfer = {

        defaultParams: {
            skipLength: 2
        },

        init: function (params) {
            var my = this;

            // extract relevant parameters (or defaults)
            this.params = params;
            Object.keys(this.defaultParams).forEach(function (key) {
                if (!(key in my.params)) {
                    my.params[key] = my.defaultParams[key];
                }
            });

            var backend;
            if (this.params.audio) {
                backend = WaveSurfer.Audio;
            } else {
                backend = WaveSurfer.WebAudio;
            }

            this.backend = Object.create(backend);
            this.backend.init(this.params);

            this.drawer = Object.create(WaveSurfer.Drawer);
            this.drawer.init(this.params);

            this.bindClick(this.params.canvas, function (percents) {
                my.playAt(percents);
            });
        },

        onAudioProcess: function () {
            if (!this.backend.isPaused()) {
                this.drawer.progress(this.backend.getPlayedPercents());
            }
        },

        playAt: function (percents) {
            this.backend.play(this.backend.getDuration() * percents);
        },

        pause: function () {
            this.backend.pause();
        },

        playPause: function () {
            if (this.backend.paused) {
                this.playAt(this.backend.getPlayedPercents() || 0);
            } else {
                this.pause();
            }
        },

        skipBackward: function(seconds) {
            this.skip(seconds || -this.params.skipLength);
        },

        skipForward: function(seconds) {
            this.skip(seconds || this.params.skipLength);
        },

        skip: function(offset) {
            var timings = this.timings(offset);
            this.playAt(timings[0] / timings[1]);
        },

        marks: 0,
        mark: function(options) {
            options = options || {};

            var timings = this.timings(0);

            var marker = {
                width: options.width,
                color: options.color,
                percentage: timings[0] / timings[1],
                position: timings[0]
            };

            var id = options.id || '_m' + this.marks++;

            this.drawer.markers[id] = marker;
            if (this.backend.paused) this.drawer.redraw();
            return marker;
        },

        timings: function(offset) {
            var position = this.backend.getCurrentTime() || 0;
            var duration = this.backend.getDuration() || 1;
            position = Math.max(0, Math.min(duration, position + offset));
            return [position, duration];
        },

        drawBuffer: function () {
            if (this.backend.currentBuffer) {
                var my = this;
                this.backend.bindUpdate(function () {
                    my.onAudioProcess();
                });
                this.drawer.drawBuffer(this.backend.currentBuffer);
            }
        },

        /**
         * Streams audio through HTML5 Audio.
         */
        streamUrl: function (url) {
            var my = this;
            var audioApi = Object.create(WaveSurfer.Audio);

            var audio = this.backend.streamUrl(
                url,
                // on timeupdate
                function (pcm) {
                    var percents = my.backend.getPlayedPercents();
                    my.drawer.setCursor(percents);
                    my.drawer.drawStreamFrame(pcm, percents);
                },
                // on canplay
                function () {
                    my.drawer.setMinWidth(~~my.backend.getDuration());
                    my.backend.play(my.backend.getCurrentTime());
                }
            );

            this.params.audio = audio;
            this.backend = audioApi;
            this.backend.init(this.params);
        },

        /**
         * Loads an audio file via XHR.
         */
        load: function (url) {
            var my = this;
            var xhr = new XMLHttpRequest();
            xhr.responseType = 'arraybuffer';

            xhr.addEventListener('progress', function (e) {
                var percentComplete;
                if (e.lengthComputable) {
                    percentComplete = e.loaded / e.total;
                } else {
                    // TODO
                    // for now, approximate progress with an asymptotic
                    // function, and assume downloads in the 1-3 MB range.
                    percentComplete = e.loaded / (e.loaded + 1000000);
                }
                my.drawer.drawLoading(percentComplete);
            }, false);

            xhr.addEventListener('load', function (e) {
                my.drawer.drawLoading(1);
                my.backend.loadData(
                    e.target.response,
                    my.drawBuffer.bind(my),
                    my.streamUrl.bind(my, url)
                );
            }, false);

            xhr.open('GET', url, true);
            xhr.send();
        },

        /**
         * Loads an audio blob
         */
        loadBlob: function (blob) {
            var my = this;
            my.backend.loadData(
                blob,
                my.drawBuffer.bind(my)
            );
        },

        /**
         * Loads an audio file via drag'n'drop.
         */
        bindDragNDrop: function (dropTarget) {
            var my = this;
            var reader = new FileReader();
            reader.addEventListener('load', function (e) {
                my.loadBlob(e.target.result);
            }, false);

            (dropTarget || document).addEventListener('drop', function (e) {
                e.preventDefault();
                e.stopPropagation();
                var file = e.dataTransfer.files[0];
                file && reader.readAsArrayBuffer(file);
            }, false);
        },

        /**
         * Click to seek.
         */
        bindClick: function (element, callback) {
            var my = this;
            element.addEventListener('click', function (e) {
                var relX = e.offsetX;
                if (null == relX) { relX = e.layerX; }
                callback(relX / this.clientWidth);
            }, false);
        }
    };

    WaveSurfer.Audio = {
        /**
         * Initializes the analyser with given params.
         *
         * @param {Object} params (required)
         * @param {HTMLAudioElement} params.audio (required)
         */
        init: function (params) {
            params = params || {};

            this.audio = params.audio;
        },

        isPaused: function () {
            return this.audio.paused;
        },

        getDuration: function () {
            return this.audio.duration;
        },

        /**
         * Plays the audio from a given position.
         *
         * @param {Number} start Start offset in seconds,
         * relative to the beginning of the track.
         */
        play: function (start) {
            start = start || 0;
            if (this.audio.currentTime !== start) {
                this.audio.currentTime = start;
            }
            this.audio.play();
        },

        /**
         * Pauses playback.
         */
        pause: function () {
            this.audio.pause();
        },

        getCurrentTime: function () {
            return this.audio.currentTime;
        },

        getPlayedPercents: function () {
            var time = Math.min(this.audio.currentTime, this.audio.duration);
            return (time / this.audio.duration);
        },

        bindUpdate: function (callback) {
            this.audio.addEventListener('timeupdate', callback, false);
        }
    };

    WaveSurfer.WebAudio = {
        Defaults: {
            fftSize: 1024,
            smoothingTimeConstant: 0.3
        },

        ac: new (window.AudioContext || window.webkitAudioContext),

        /**
         * Initializes the analyser with given params.
         *
         * @param {Object} params
         * @param {String} params.smoothingTimeConstant
         */
        init: function (params) {
            params = params || {};

            this.fftSize = params.fftSize || this.Defaults.fftSize;
            this.destination = params.destination || this.ac.destination;

            this.analyser = this.ac.createAnalyser();
            this.analyser.smoothingTimeConstant = params.smoothingTimeConstant ||
                this.Defaults.smoothingTimeConstant;
            this.analyser.fftSize = this.fftSize;
            this.analyser.connect(this.destination);

            this.proc = this.ac.createJavaScriptNode(this.fftSize / 2, 1, 1);
            this.proc.connect(this.destination);

            this.byteTimeDomain = new Uint8Array(this.analyser.fftSize);
            this.byteFrequency = new Uint8Array(this.analyser.fftSize);

            this.paused = true;
        },

        bindUpdate: function (callback) {
            var my = this;

            this.proc.onaudioprocess = function () {
                callback();
                if (my.getPlayedPercents() > 1.0) {
                    my.pause();
                    my.lastPause = 0;
                }
            };
        },

        setSource: function (source) {
            this.source && this.source.disconnect();
            this.source = source;
            this.source.connect(this.analyser);
            this.source.connect(this.proc);
        },

        /**
         * Create and connect to a media element source.
         */
        streamUrl: function (url, onUpdate, onCanPlay) {
            var my = this;
            var audio = new Audio();

            audio.addEventListener('canplay', function () {
                my.setSource(my.ac.createMediaElementSource(audio));

                onCanPlay && onCanPlay();
            }, false);

            audio.addEventListener('timeupdate', function () {
                if (!audio.paused) {
                    onUpdate && onUpdate(my.waveform(), audio.currentTime);
                }
            });

            audio.autoplay = false;
            audio.src = url;
            return audio;
        },

        /**
         * Loads audiobuffer.
         *
         * @param {AudioBuffer} audioData Audio data.
         */
        loadData: function (audiobuffer, cb, errb) {
            var my = this;

            this.pause();

            this.ac.decodeAudioData(
                audiobuffer,
                function (buffer) {
                    my.currentBuffer = buffer;
                    my.lastStart = 0;
                    my.lastPause = 0;
                    my.startTime = null;
                    cb && cb(buffer);
                },
                function () {
                    //console.error('Error decoding audio buffer');
                    errb && errb();
                }
            );
        },

        isPaused: function () {
            return this.paused;
        },

        getDuration: function () {
            return this.currentBuffer && this.currentBuffer.duration;
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
        play: function (start, end, delay) {
            if (!this.currentBuffer) {
                return;
            }

            this.pause();

            this.setSource(this.ac.createBufferSource());
            this.source.buffer = this.currentBuffer;

            if (null == start) { start = this.getCurrentTime(); }
            if (null == end  ) { end = this.source.buffer.duration; }
            if (null == delay) { delay = 0; }

            this.lastStart = start;
            this.startTime = this.ac.currentTime;

            this.source.noteGrainOn(delay, start, end - start);

            this.paused = false;
        },

        /**
         * Pauses the loaded audio.
         */
        pause: function (delay) {
            if (!this.currentBuffer || this.paused) {
                return;
            }

            this.lastPause = this.getCurrentTime();

            this.source.noteOff(delay || 0);

            this.paused = true;
        },

        getPlayedPercents: function () {
            return this.getCurrentTime() / this.getDuration();
        },

        getCurrentTime: function () {
            if (this.isPaused()) {
                return this.lastPause;
            } else {
                return this.lastStart + (this.ac.currentTime - this.startTime);
            }
        },

        /**
         * Returns the real-time waveform data.
         *
         * @return {Uint8Array} The waveform data.
         * Values range from 0 to 255.
         */
        waveform: function () {
            this.analyser.getByteTimeDomainData(this.byteTimeDomain);
            return this.byteTimeDomain;
        },

        /**
         * Returns the real-time frequency data.
         *
         * @return {Uint8Array} The frequency data.
         * Values range from 0 to 255.
         */
        frequency: function () {
            this.analyser.getByteFrequencyData(this.byteFrequency);
            return this.byteFrequency;
        }
    };

    WaveSurfer.Drawer = {
        defaultParams: {
            waveColor     : '#999',
            progressColor : '#333',
            cursorColor   : '#ddd',
            markerColor   : '#eee',
            loadingColor  : '#999',
            cursorWidth   : 1,
            loadPercent   : false,
            loadingBars   : 20,
            barHeight     : 1,
            barMargin     : 10,
            markerWidth   : 1,
            frameMargin   : 0,
            fillParent    : false,
            maxSecPerPx   : false,
            scrollParent  : false
        },

        scale: window.devicePixelRatio,

        init: function (params) {
            var my = this;

            // extend params with defaults
            this.params = {};
            Object.keys(this.defaultParams).forEach(function (key) {
                my.params[key] = key in params ? params[key] :
                    my.defaultParams[key];
            });

            this.peaks = [];
            this.markers = {};
            this.maxPeak = 128;

            this.canvas = params.canvas;
            this.parent = this.canvas.parentNode;

            if (params.fillParent && !params.scrollParent) {
                var style = this.canvas.style;
                style.width = this.parent.clientWidth + 'px';
                style.height = this.parent.clientHeight + 'px';
            }

            this.prepareContext();

            if (params.image) {
                this.loadImage(params.image, this.drawImage.bind(this));
            }
        },

        setMinWidth: function (width) {
            if (width <= this.width) { return; }

            if (width > this.parent.clientWidth) {
                this.params.scrollParent = true;
            }

            this.canvas.style.width = width + 'px';
            this.prepareContext();
        },

        prepareContext: function() {
            var canvas = this.canvas;

            var w = canvas.clientWidth;
            var h = canvas.clientHeight;
            this.width = canvas.width = w * this.scale;
            this.height = canvas.height = h * this.scale;
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
            this.cc = canvas.getContext('2d');

            if (!this.width || !this.height) {
                console.error('Canvas size is zero.');
            }
        },

        getPeaks: function (buffer) {
            var frames = buffer.getChannelData(0).length;
            // Frames per pixel
            var k = frames / this.width;

            var maxSecPerPx = this.params.maxSecPerPx;
            if (maxSecPerPx) {
                var secPerPx = k / buffer.sampleRate;
                if (secPerPx > maxSecPerPx) {
                    var targetWidth = Math.ceil(
                        frames / maxSecPerPx / buffer.sampleRate / this.scale
                    );
                    this.canvas.style.width = targetWidth + 'px';
                    this.prepareContext();
                    k = frames / this.width;
                }
            }

            this.maxPeak = -Infinity;

            for (var i = 0; i < this.width; i++) {
                var sum = 0;
                for (var c = 0; c < buffer.numberOfChannels; c++) {
                    var chan = buffer.getChannelData(c);
                    var vals = chan.subarray(i * k, (i + 1) * k);
                    var peak = -Infinity;
                    for (var p = 0, l = vals.length; p < l; p++) {
                        var val = Math.abs(vals[p]);
                        if (val > peak){
                            peak = val;
                        }
                    }
                    sum += peak;
                }
                this.peaks[i] = sum;

                if (sum > this.maxPeak) {
                    this.maxPeak = sum;
                }
            }

            this.maxPeak *= 1 + this.params.frameMargin;
        },

        setCursor: function (percents) {
            this.cursorPos = ~~(this.width * percents);
        },

        progress: function (percents) {
            this.setCursor(percents);
            this.redraw();

            if (this.params.scrollParent) {
                var half = this.parent.clientWidth / 2;
                var target = this.cursorPos - half;
                var offset = target - this.parent.scrollLeft;

                // if the cursor is currently visible...
                if (offset >= -half && offset < half) {
                    // we'll limit the "re-center" rate.
                    var rate = 5;
                    offset = Math.max(-rate, Math.min(rate, offset));
                    target = this.parent.scrollLeft + offset;
                }

                this.canvas.parentNode.scrollLeft = ~~target;
            }
        },

        drawBuffer: function (buffer) {
            this.getPeaks(buffer);
            this.progress(0);
        },

        /**
         * Redraws the entire canvas on each audio frame.
         */
        redraw: function () {
            var my = this;

            this.clear();

            // Draw WebAudio buffer peaks.
            if (this.peaks.length) {
                this.peaks.forEach(function (peak, index) {
                    my.drawFrame(index, peak, my.maxPeak);
                });
            // Or draw an image.
            } else if (this.image) {
                this.drawImage();
            }

            // Draw markers.
            Object.keys(this.markers).forEach(function (key) {
                var marker = my.markers[key];
                var percentage = ~~(my.width * marker.percentage);
                my.drawMarker(percentage, marker.width, marker.color);
            });

            this.drawCursor();
        },

        clear: function () {
            this.cc.clearRect(0, 0, this.width, this.height);
        },

        drawFrame: function (index, value, max) {
            var w = 1;
            var h = Math.round(value * (this.height / max));

            var x = index * w;
            var y = Math.round((this.height - h) / 2);

            if (this.cursorPos >= x) {
                this.cc.fillStyle = this.params.progressColor;
            } else {
                this.cc.fillStyle = this.params.waveColor;
            }

            this.cc.fillRect(x, y, w, h);
        },

        drawStreamFrame: function (data, percentage) {
            var index = ~~(this.width * percentage);

            if (null == this.peaks[index]) {
                var max = -Infinity;
                for (var i = 0, len = data.length; i < len; i++) {
                    var val = data[i];
                    if (val > max) { max = val; }
                }
                this.peaks[index] = max - 128 || 1;
            }
            this.redraw();
        },

        drawCursor: function () {
            this.drawMarker(
                this.cursorPos,
                this.params.cursorWidth,
                this.params.cursorColor
            );
        },

        drawMarker: function (position, width, color) {
            width = width || this.params.markerWidth;
            color = color || this.params.markerColor;

            var w = width * this.scale;
            var h = this.height;

            var x = Math.min(position, this.width - w);
            var y = 0;

            this.cc.fillStyle = color;
            this.cc.fillRect(x, y, w, h);
        },

        /**
         * Loads and caches an image.
         */
        loadImage: function (url, callback) {
            var my = this;
            var img = document.createElement('img');
            var onLoad = function () {
                img.removeEventListener('load', onLoad);
                my.image = img;
                callback(img);
            };
            img.addEventListener('load', onLoad, false);
            img.src = url;
        },

        /**
         * Draws a pre-drawn waveform image.
         */
        drawImage: function () {
            var cc = this.cc;
            cc.drawImage(this.image, 0, 0, this.width, this.height);
            cc.save();
            cc.globalCompositeOperation = 'source-atop';
            cc.fillStyle = this.params.progressColor;
            cc.fillRect(0, 0, this.cursorPos, this.height);
            cc.restore();
        },

        drawLoading: function (progress) {
            var barHeight = this.params.barHeight * this.scale;
            var y = ~~(this.height - barHeight) / 2;

            this.cc.fillStyle = this.params.loadingColor;

            if (this.params.loadPercent) {
                var width = Math.round(this.width * progress);
                this.cc.fillRect(0, y, width, barHeight);
                return;
            }

            var bars = this.params.loadingBars;
            var margin = this.params.barMargin * this.scale;
            var barWidth = ~~(this.width / bars) - margin;
            var progressBars = ~~(bars * progress);

            for (var i = 0; i < progressBars; i += 1) {
                var x = i * barWidth + i * margin;
                this.cc.fillRect(x, y, barWidth, barHeight);
            }
        }
    };

    // Exports
    window.WaveSurfer = WaveSurfer;
    // AMD
    if (typeof define === 'function ') {

        define('wavesurver', [], function () { return WaveSurfer; });
    }
})(window);