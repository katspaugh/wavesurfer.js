import drawer from './drawer';
import * as util from './util';

export default util.extend({}, drawer, {
    createElements: function () {
        const waveCanvas = this.wrapper.appendChild(
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
            const progressCanvas = this.progressWave.appendChild(
                document.createElement('canvas')
            );
            this.progressCc = progressCanvas.getContext('2d');
        }
    },

    updateSize: function () {
        const width = Math.round(this.width / this.params.pixelRatio);

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

    drawBars: function (peaks, channelIndex) {
        // Split channels
        if (peaks[0] instanceof Array) {
            const channels = peaks;
            if (this.params.splitChannels) {
                this.setHeight(channels.length * this.params.height * this.params.pixelRatio);
                channels.forEach(this.drawBars, this);
                return;
            }
            peaks = channels[0];
        }

        // Bar wave draws the bottom only as a reflection of the top,
        // so we don't need negative values
        const hasMinVals = [].some.call(peaks, val => val < 0);
        if (hasMinVals) {
            peaks = [].filter.call(peaks, (_, index) => index % 2 == 0);
        }

        // A half-pixel offset makes lines crisp
        const $ = 0.5 / this.params.pixelRatio;
        const width = this.width;
        const height = this.params.height * this.params.pixelRatio;
        const offsetY = height * channelIndex || 0;
        const halfH = height / 2;
        const length = peaks.length;
        const bar = this.params.barWidth * this.params.pixelRatio;
        const gap = Math.max(this.params.pixelRatio, ~~(bar / 2));
        const step = bar + gap;

        let absmax = 1;
        if (this.params.normalize) {
            absmax = util.max(peaks);
        }

        const scale = length / width;

        this.waveCc.fillStyle = this.params.waveColor;
        if (this.progressCc) {
            this.progressCc.fillStyle = this.params.progressColor;
        }

        [ this.waveCc, this.progressCc ].forEach(cc => {
            if (!cc) { return; }
            let i;

            for (i = 0; i < width; i += step) {
                const h = Math.round(peaks[Math.floor(i * scale)] / absmax * halfH);
                cc.fillRect(i + $, halfH - h + offsetY, bar + $, h * 2);
            }
        });
    },

    drawWave: function (peaks, channelIndex) {
        // Split channels
        if (peaks[0] instanceof Array) {
            const channels = peaks;
            if (this.params.splitChannels) {
                this.setHeight(channels.length * this.params.height * this.params.pixelRatio);
                channels.forEach(this.drawWave, this);
                return;
            }
            peaks = channels[0];
        }

        // Support arrays without negative peaks
        const hasMinValues = [].some.call(peaks, val => val < 0);
        if (!hasMinValues) {
            const reflectedPeaks = [];
            let i;
            let len;
            for (i = 0, len = peaks.length; i < len; i++) {
                reflectedPeaks[2 * i] = peaks[i];
                reflectedPeaks[2 * i + 1] = -peaks[i];
            }
            peaks = reflectedPeaks;
        }

        // A half-pixel offset makes lines crisp
        const $ = 0.5 / this.params.pixelRatio;
        const height = this.params.height * this.params.pixelRatio;
        const offsetY = height * channelIndex || 0;
        const halfH = height / 2;
        const length = ~~(peaks.length / 2);

        let scale = 1;
        if (this.params.fillParent && this.width != length) {
            scale = this.width / length;
        }

        let absmax = 1;
        if (this.params.normalize) {
            const max = util.max(peaks);
            const min = util.min(peaks);
            absmax = -min > max ? -min : max;
        }

        this.waveCc.fillStyle = this.params.waveColor;
        if (this.progressCc) {
            this.progressCc.fillStyle = this.params.progressColor;
        }

        [ this.waveCc, this.progressCc ].forEach(function (cc) {
            if (!cc) { return; }
            let i;
            let j;

            cc.beginPath();
            cc.moveTo($, halfH + offsetY);

            for (i = 0; i < length; i++) {
                const h = Math.round(peaks[2 * i] / absmax * halfH);
                cc.lineTo(i * scale + $, halfH - h + offsetY);
            }

            // Draw the bottom edge going backwards, to make a single
            // closed hull to fill.
            for (j = length - 1; j >= 0; j--) {
                const k = Math.round(peaks[2 * j + 1] / absmax * halfH);
                cc.lineTo(j * scale + $, halfH - k + offsetY);
            }

            cc.closePath();
            cc.fill();

            // Always draw a median line
            cc.fillRect(0, halfH + offsetY - $, this.width, $);
        }, this);
    },

    updateProgress: function (progress) {
        const pos = Math.round(
            this.width * progress
        ) / this.params.pixelRatio;
        this.style(this.progressWave, { width: pos + 'px' });
    },

    getImage: function(type, quality) {
        return this.waveCc.canvas.toDataURL(type, quality);
    }
});
