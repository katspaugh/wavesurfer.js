'use strict';

WaveSurfer.Drawer.Canvas = Object.create(WaveSurfer.Drawer);

WaveSurfer.util.extend(WaveSurfer.Drawer.Canvas, {
    createElements: function () {
        var waveCanvas = document.createElement('canvas');
        this.style(waveCanvas, {
            position: 'absolute',
            zIndex: 1
        });
        var waveCc = waveCanvas.getContext('2d');

        var progressWave = document.createElement('wave');
        this.style(progressWave, {
            position: 'absolute',
            zIndex: 2,
            overflow: 'hidden',
            width: '0',
            borderRight: [
                this.params.cursorWidth + 'px',
                'solid',
                this.params.cursorColor
            ].join(' ')
        });

        var progressCanvas = document.createElement('canvas');
        var progressCc = progressCanvas.getContext('2d');
        progressWave.appendChild(progressCanvas);

        var marksCanvas = document.createElement('canvas');
        this.style(marksCanvas, {
            position: 'absolute',
            zIndex: 3
        });
        var marksCc = marksCanvas.getContext('2d');

        var wrapper = document.createElement('wave');
        this.style(wrapper, {
            position: 'relative'
        });
        wrapper.appendChild(waveCanvas);
        wrapper.appendChild(progressWave);
        wrapper.appendChild(marksCanvas);

        this.container.appendChild(wrapper);

        this.canvases = [ waveCanvas, progressCanvas, marksCanvas ];

        this.waveCc = waveCc;
        this.progressCc = progressCc;
        this.progressWave = progressWave;
        this.marksCc = marksCc;
        this.marks = {};
    },

    updateWidth: function () {
        this.canvases.forEach(function (canvas) {
            canvas.width = this.width;
            canvas.height = this.height;

            if (this.params.fillParent && !this.params.scrollParent) {
                this.style(canvas, {
                    width: this.container.clientWidth + 'px',
                    height: this.container.clientHeight + 'px'
                });
            } else {
                this.style(canvas, {
                    width: Math.round(this.width / this.pixelRatio) + 'px',
                    height: Math.round(this.height / this.pixelRatio) + 'px'
                });
            }
        }, this);
    },

    drawWave: function (peaks, max) {
        for (var i = 0; i < this.width; i++) {
            var h = max > 0 ? Math.round(peaks[i] * (this.height / max)) : 1;
            var y = Math.round((this.height - h) / 2);
            this.waveCc.fillStyle = this.params.waveColor;
            this.waveCc.fillRect(i, y, 1, h);
            this.progressCc.fillStyle = this.params.progressColor;
            this.progressCc.fillRect(i, y, 1, h);
        }
    },

    updateProgress: function (progress) {
        var pos = Math.round(
            this.width * progress
        ) / this.pixelRatio;
        this.progressWave.style.width = pos + 'px';
    },

    addMark: function (mark) {
        var redraw = mark.id in this.marks;
        this.marks[mark.id] = mark;
        redraw ? this.redrawMarks() : this.drawMark(mark);
    },

    removeMark: function (mark) {
        delete this.marks[mark.id];
        this.redrawMarks();
    },

    drawMark: function (mark) {
        this.marksCc.fillStyle = mark.color;
        var x = Math.round(mark.percentage * this.width - mark.width / 2);
        this.marksCc.fillRect(x, 0, mark.width, this.height);
    },

    redrawMarks: function () {
        this.marksCc.clearRect(0, 0, this.width, this.height);
        Object.keys(this.marks).forEach(function (id) {
            this.drawMark(this.marks[id]);
        }, this);
    }
});