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

    drawWave: function (peaks, channelIndex) {
        // Split channels
        if (peaks[0] instanceof Array) {
            var channels = peaks;
            if (this.params.splitChannels) {
                this.setHeight(channels.length * this.params.height * this.params.pixelRatio);
                channels.forEach(this.drawWave, this);
                return;
            } else {
                peaks = channels[0];
            }
        }

        // A half-pixel offset makes lines crisp
        var $ = 0.5 / this.params.pixelRatio;
        // A margin between split waveforms
        var height = this.params.height * this.params.pixelRatio;
        var offsetY = height * channelIndex || 0;
        var halfH = height / 2;
        var length = peaks.length;
        var scale = 1;
        if (this.params.fillParent && this.width != length) {
            scale = this.width / length;
        }
        var max = 1;
        if (this.params.normalize) {
            max = Math.max.apply(Math, peaks);
        }

        this.waveCc.fillStyle = this.params.waveColor;
        if (this.progressCc) {
            this.progressCc.fillStyle = this.params.progressColor;
        }

        [ this.waveCc, this.progressCc ].forEach(function (cc) {
            if (!cc) { return; }

            cc.beginPath();
            cc.moveTo($, halfH + offsetY);

            for (var i = 0; i < length; i++) {
                var h = Math.round(peaks[i] / max * halfH);
                cc.lineTo(i * scale + $, halfH + h + offsetY);
            }

            cc.lineTo(this.width + $, halfH + offsetY);
            cc.moveTo($, halfH + offsetY);

            for (var i = 0; i < length; i++) {
                var h = Math.round(peaks[i] / max * halfH);
                cc.lineTo(i * scale + $, halfH - h + offsetY);
            }

            cc.lineTo(this.width + $, halfH + offsetY);
            cc.closePath();
            cc.fill();

            // Always draw a median line
            cc.fillRect(0, halfH + offsetY - $, this.width, $);
        }, this);
    },

    updateProgress: function (progress) {
        var pos = Math.round(
            this.width * progress
        ) / this.params.pixelRatio;
        this.style(this.progressWave, { width: pos + 'px' });
    }
});
