'use strict';

WaveSurfer.Drawer.Canvas = Object.create(WaveSurfer.Drawer);

WaveSurfer.util.extend(WaveSurfer.Drawer.Canvas, {
    createElements: function () {
        var waveCanvas = this.wrapper.appendChild(
            this.style(document.createElement('canvas'), {
                position: 'absolute',
                zIndex: 1
            })
        );
        this.waveCc = waveCanvas.getContext('2d');

        this.progressWave = this.wrapper.appendChild(
            this.style(document.createElement('wave'), {
                position: 'absolute',
                zIndex: 2,
                overflow: 'hidden',
                width: '0',
                height: this.params.height + 'px',
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

    updateWidth: function () {
        var width = Math.round(this.width / this.params.pixelRatio);

        this.waveCc.canvas.width = this.width;
        this.waveCc.canvas.height = this.height;
        this.style(this.waveCc.canvas, { width: width + 'px'});

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

    drawWave: function (peaks, max) {
        // A half-pixel offset makes lines crisp
        var $ = 0.5 / this.params.pixelRatio;

        this.waveCc.fillStyle = this.params.waveColor;
        if (this.progressCc) {
            this.progressCc.fillStyle = this.params.progressColor;
        }

        var halfH = this.height / 2;
        var coef = halfH / max;
        var length = peaks.length;
        var scale = 1;
        if (this.params.fillParent && this.width != length) {
            scale = this.width / peaks.length;
        }

        this.waveCc.beginPath();
        this.waveCc.moveTo($, halfH);

        if (this.progressCc) {
            this.progressCc.beginPath();
            this.progressCc.moveTo($, halfH);
        }

        for (var i = 0; i < length; i++) {
            var h = Math.round(peaks[i] * coef);
            this.waveCc.lineTo(i * scale + $, halfH + h);
            if (this.progressCc) {
                this.progressCc.lineTo(i * scale + $, halfH + h);
            }
        }

        this.waveCc.lineTo(this.width + $, halfH);
        if (this.progressCc) {
            this.progressCc.lineTo(this.width + $, halfH);
        }

        this.waveCc.moveTo($, halfH);
        if (this.progressCc) {
            this.progressCc.moveTo($, halfH);
        }

        for (var i = 0; i < length; i++) {
            var h = Math.round(peaks[i] * coef);
            this.waveCc.lineTo(i * scale + $, halfH - h);
            if (this.progressCc) {
                this.progressCc.lineTo(i * scale + $, halfH - h);
            }
        }

        this.waveCc.lineTo(this.width + $, halfH);
        this.waveCc.fill();

        if (this.progressCc) {
            this.progressCc.lineTo(this.width + $, halfH);
            this.progressCc.fill();
        }

        // Always draw a median line
        this.waveCc.fillRect(0, halfH - $, this.width, $);
    },

    updateProgress: function (progress) {
        var pos = Math.round(
            this.width * progress
        ) / this.params.pixelRatio;
        this.style(this.progressWave, { width: pos + 'px' });
    }
});
