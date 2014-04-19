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

        this.progressWave = this.wrapper.appendChild(
            this.style(document.createElement('wave'), {
                position: 'absolute',
                zIndex: 2,
                overflow: 'hidden',
                width: '0',
                height: this.params.height + 'px',
                borderRight: [
                    this.params.cursorWidth + 'px',
                    'solid',
                    this.params.cursorColor
                ].join(' ')
            })
        );

        var progressCanvas = this.progressWave.appendChild(
            document.createElement('canvas')
        );

        var selectionCanvas = this.wrapper.appendChild(
            this.style(document.createElement('canvas'), {
                position: 'absolute',
                zIndex: 0
            })
        );

        this.waveCc = waveCanvas.getContext('2d');
        this.progressCc = progressCanvas.getContext('2d');
        this.selectionCc = selectionCanvas.getContext('2d');
    },

    updateWidth: function () {
        var width = Math.round(this.width / this.pixelRatio) + 'px';
        [
            this.waveCc,
            this.progressCc,
            this.selectionCc
        ].forEach(function (cc) {
            cc.canvas.width = this.width;
            cc.canvas.height = this.height;
            this.style(cc.canvas, { width: width + 'px' });
        }, this);

        this.clearWave();
    },

    clearWave: function () {
        this.waveCc.clearRect(0, 0, this.width, this.height);
        this.progressCc.clearRect(0, 0, this.width, this.height);
    },

    drawWave: function (peaks, max) {
        var $ = 0.5 / this.pixelRatio;
        this.waveCc.fillStyle = this.params.waveColor;
        this.progressCc.fillStyle = this.params.progressColor;

        var coef = this.height / max;
        var halfH = this.height / 2;

        this.waveCc.beginPath();
        this.waveCc.moveTo($, halfH);
        this.progressCc.beginPath();
        this.progressCc.moveTo($, halfH);
        for (var i = 0; i < this.width; i++) {
            var h = Math.round(peaks[i] * coef);
            this.waveCc.lineTo(i + $, halfH + h);
            this.progressCc.lineTo(i + $, halfH + h);
        }
        this.waveCc.lineTo(this.width + $, halfH);
        this.progressCc.lineTo(this.width + $, halfH);

        this.waveCc.moveTo($, halfH);
        this.progressCc.moveTo($, halfH);
        for (var i = 0; i < this.width; i++) {
            var h = Math.round(peaks[i] * coef);
            this.waveCc.lineTo(i + $, halfH - h);
            this.progressCc.lineTo(i + $, halfH - h);
        }

        this.waveCc.lineTo(this.width + $, halfH);
        this.waveCc.fill();
        this.progressCc.lineTo(this.width + $, halfH);
        this.progressCc.fill();
    },

    updateProgress: function (progress) {
        var pos = Math.round(
            this.width * progress
        ) / this.pixelRatio;
        this.style(this.progressWave, { width: pos + 'px' });
    },

    addMark: function (mark) {
        var markEl = document.createElement('mark');
        markEl.id = mark.id;
        this.wrapper.appendChild(markEl);

        var my = this;
        markEl.addEventListener('mouseover', function (e) {
            my.fireEvent('mark-over', mark, e);
        });
        markEl.addEventListener('mouseleave', function (e) {
            my.fireEvent('mark-leave', mark, e);
        });

        this.updateMark(mark);
    },

    updateMark: function (mark) {
        var markEl = document.getElementById(mark.id);
        markEl.title = mark.getTitle();
        this.style(markEl, {
            height: '100%',
            position: 'absolute',
            zIndex: 3,
            width: mark.width + 'px',
            left: Math.max(0, Math.round(
                mark.percentage * this.width - mark.width / 2
            )) + 'px',
            backgroundColor: mark.color
        });
    },

    removeMark: function (mark) {
        var markEl = document.getElementById(mark.id);
        if (markEl) {
            this.wrapper.removeChild(markEl);
        }
    },

    drawSelection: function () {
        this.eraseSelection();

        this.selectionCc.fillStyle = this.params.selectionColor;
        var x = this.startPercent * this.width;
        var width = this.endPercent * this.width - x;

        this.selectionCc.fillRect(x, 0, width, this.height);
    },

    eraseSelection: function () {
        this.selectionCc.clearRect(0, 0, this.width, this.height);
    }
});
