'use strict';

WaveSurfer.Drawer.Canvas = Object.create(WaveSurfer.Drawer);

WaveSurfer.util.extend(WaveSurfer.Drawer.Canvas, {
    createElements: function () {
        var waveCanvas = this.wrapper.appendChild(
            this.style(document.createElement('canvas'), {
                position: 'absolute',
                zIndex: 1,
                left: 0,
                top: 0,
                bottom: 0
            })
        );
        this.waveCc = waveCanvas.getContext('2d');

        this.progressWave = this.wrapper.appendChild(
            this.style(document.createElement('wave'), {
                position: 'absolute',
                zIndex: 2,
                left: 0,
                top: 0,
                bottom: 0,
                overflow: 'hidden',
                width: '0',
                display: 'none',
                boxSizing: 'border-box',
                borderRightStyle: 'solid',
                borderRightWidth: this.params.cursorWidth + 'px',
                borderRightColor: this.params.cursorColor
            })
        );

        if (this.params.waveColor != this.params.progressColor) {
            var progressCanvas = this.progressWave.appendChild(
                document.createElement('canvas')
            );
            this.progressCc = progressCanvas.getContext('2d');
        }
    },

    updateSize: function () {
        var width = Math.round(this.width / this.params.pixelRatio);

        this.waveCc.canvas.width = this.width;
        this.waveCc.canvas.height = this.height;
        this.style(this.waveCc.canvas, { width: width + 'px'});

        this.style(this.progressWave, { display: 'block'});

        if (this.progressCc) {
            this.progressCc.canvas.width = this.width;
            this.progressCc.canvas.height = this.height;
            this.style(this.progressCc.canvas, { width: width + 'px'});
        }

        this.clearWave();
    },

    clearWave: function () {
        this.waveCc.clearRect(0, 0, this.width, this.height);
        if (this.progressCc) {
            this.progressCc.clearRect(0, 0, this.width, this.height);
        }
    },

    drawBars: function (peaks, channelIndex, start, end) {
        var requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame;
        var my = this;
            requestAnimationFrame(function() {
            // Split channels
            if (peaks[0] instanceof Array) {
               var channels = peaks;
                if (my.params.splitChannels) {
                    my.setHeight(channels.length * my.params.height * my.params.pixelRatio);
                    channels.forEach(function(channelPeaks, i) {
                        my.drawBars(channelPeaks, i, start, end);
                        });
                    return;
                } else {
                    peaks = channels[0];
                }
            }

            // Bar wave draws the bottom only as a reflection of the top,
            // so we don't need negative values
            var hasMinVals = [].some.call(peaks, function (val) { return val < 0; });
            // Skip every other value if there are negatives.
            var peakIndexScale = 1;
            if (hasMinVals) {
                peakIndexScale = 2;
            }

            // A half-pixel offset makes lines crisp
           var $ = 0.5 / my.params.pixelRatio;
            var width = my.width;
            var height = my.params.height * my.params.pixelRatio;
            var offsetY = height * channelIndex || 0;
            var halfH = height / 2;
            var length = peaks.length / peakIndexScale;
            var bar = my.params.barWidth * my.params.pixelRatio;
            var gap = Math.max(my.params.pixelRatio, ~~(bar / 2));
            var step = bar + gap;

            var absmax = 1 / my.params.barHeight;
            if (my.params.normalize) {
                var max = WaveSurfer.util.max(peaks);
                var min = WaveSurfer.util.min(peaks);
                absmax = -min > max ? -min : max;
            }

            var scale = length / width;

            my.waveCc.fillStyle = my.params.waveColor;
            if (my.progressCc) {
                my.progressCc.fillStyle = my.params.progressColor;
            }

            [ my.waveCc, my.progressCc ].forEach(function (cc) {
                if (!cc) { return; }

                for (var i = (start / scale); i < (end / scale); i += step) {
                    var peak = peaks[Math.floor(i * scale * peakIndexScale)] || 0;
                    var h = Math.round(peak / absmax * halfH);
                    cc.fillRect(i + $, halfH - h + offsetY, bar + $, h * 2);
                }
            }, my);
        })
    },

    drawWave: function (peaks, channelIndex, start, end) {
        var requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame;
        var my = this;
        requestAnimationFrame(function() {
            // Split channels
            if (peaks[0] instanceof Array) {
                var channels = peaks;
                if (my.params.splitChannels) {
                    my.setHeight(channels.length * my.params.height * my.params.pixelRatio);
                    channels.forEach(function(channelPeaks, i) {
                        my.drawWave(channelPeaks, i, start, end);
                    });
                    return;
                } else {
                    peaks = channels[0];
                }
            }

            // Support arrays without negative peaks
            var hasMinValues = [].some.call(peaks, function (val) { return val < 0; });
            if (!hasMinValues) {
                var reflectedPeaks = [];
                for (var i = 0, len = peaks.length; i < len; i++) {
                    reflectedPeaks[2 * i] = peaks[i];
                    reflectedPeaks[2 * i + 1] = -peaks[i];
                }
                peaks = reflectedPeaks;
            }

            // A half-pixel offset makes lines crisp
            var $ = 0.5 / my.params.pixelRatio;
            var height = my.params.height * my.params.pixelRatio;
            var offsetY = height * channelIndex || 0;
            var halfH = height / 2;
            var length = ~~(peaks.length / 2);

            var scale = 1;
            if (my.params.fillParent && my.width != length) {
                scale = my.width / length;
            }

            var absmax = 1 / this.params.barHeight;
            if (my.params.normalize) {
                var max = WaveSurfer.util.max(peaks);
                var min = WaveSurfer.util.min(peaks);
                absmax = -min > max ? -min : max;
            }

            my.waveCc.fillStyle = my.params.waveColor;
            if (my.progressCc) {
                my.progressCc.fillStyle = my.params.progressColor;
            }

            [ my.waveCc, my.progressCc ].forEach(function (cc) {
                if (!cc) { return; }

               cc.beginPath();
               cc.moveTo(start * scale + $, halfH + offsetY);

               for (var i = start; i < end; i++) {
                    var h = Math.round(peaks[2 * i] / absmax * halfH);
                    cc.lineTo(i * scale + $, halfH - h + offsetY);
                }

                // Draw the bottom edge going backwards, to make a single
                // closed hull to fill.
                for (var i = end - 1; i >= start; i--) {
                    var h = Math.round(peaks[2 * i + 1] / absmax * halfH);
                    cc.lineTo(i * scale + $, halfH - h + offsetY);
                }

                cc.closePath();
                cc.fill();

               // Always draw a median line
                cc.fillRect(0, halfH + offsetY - $, this.width, $);
            }, my);
        })
    },

    updateProgress: function (pos) {
        this.style(this.progressWave, { width: pos + 'px' });
    },

    getImage: function(type, quality) {
        return this.waveCc.canvas.toDataURL(type, quality);
    }
});
