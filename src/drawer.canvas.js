'use strict';

WaveSurfer.Drawer.Canvas = Object.create(WaveSurfer.Drawer);

WaveSurfer.util.extend(WaveSurfer.Drawer.Canvas, {
    createElements: function () {
        this.marks = {};

        var waveCanvas = this.wrapper.appendChild(
            document.createElement('canvas')
        );
        this.style(waveCanvas, {
            position: 'absolute',
            zIndex: 1
        });

        var progressWave = this.wrapper.appendChild(
            document.createElement('wave')
        );
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

        var progressCanvas = progressWave.appendChild(
            document.createElement('canvas')
        );

        var marksCanvas = this.wrapper.appendChild(
            document.createElement('canvas')
        );
        this.style(marksCanvas, {
            position: 'absolute',
            zIndex: 3
        });

        var timeCanvas = this.wrapper.appendChild(
            document.createElement('canvas')
        );
        this.style(timeCanvas, {
            position: 'absolute',
            zIndex: 4
        });

        this.canvases = [ waveCanvas, progressCanvas, marksCanvas, timeCanvas ];

        this.waveCc = waveCanvas.getContext('2d');
        this.progressCc = progressCanvas.getContext('2d');
        this.progressWave = progressWave;
        this.marksCc = marksCanvas.getContext('2d');
        this.timeCc = timeCanvas.getContext('2d');
    },

    updateWidth: function () {
        var width = Math.round(this.width / this.pixelRatio) + 'px';
        this.canvases.forEach(function (canvas) {
            canvas.width = this.width;
            canvas.height = this.height;
            canvas.style.width = width;
        }, this);
    },

    drawWave: function (peaks, max) {
        var duration = this.backend.getDuration();

        for (var i = 0; i < this.width; i++) {
            var h = max > 0 ? Math.round(peaks[i] * (this.height / max)) : 1;
            var y = Math.round((this.height - h) / 2);
            this.waveCc.fillStyle = this.params.waveColor;
            this.waveCc.fillRect(i, y, 1, h);
            this.progressCc.fillStyle = this.params.progressColor;
            this.progressCc.fillRect(i, y, 1, h);
        }

        // draw time canvas
        if (this.params.showTime && duration > 0) {
            var curPixel = 0,
                curSeconds = 0,
                pixelsPerSecond = this.width/duration,
                totalSeconds = parseInt(duration)+1,
                timeInterval = (pixelsPerSecond < 10) ? 10 : 1,
                formatTime = function(seconds) {
                    if (seconds/60 > 1) {
                        var minutes = parseInt(seconds/60),
                            seconds = parseInt(seconds%60),
                            seconds = (seconds<10) ? '0' + seconds : seconds;
                        return '' + minutes + ':' + seconds;
                    } else {
                        return seconds;
                    }
                };

            for (var i=0; i < totalSeconds/timeInterval; i++) {
                if (i%10 == 0) {
                    this.timeCc.fillStyle = '#000000';
                    this.timeCc.fillRect(curPixel,0,1,16);
                    this.timeCc.font="10px Arial";
                    this.timeCc.fillText(formatTime(curSeconds),curPixel+5,16);
                } else if (i%10 == 5) {
                    this.timeCc.fillStyle = '#c0c0c0';
                    this.timeCc.fillRect(curPixel,0,1,16);
                    this.timeCc.font="10px Arial";
                    this.timeCc.fillText(formatTime(curSeconds),curPixel+5,16);
                } else  {
                    this.timeCc.fillStyle = '#c0c0c0';
                    this.timeCc.fillRect(curPixel,0,1,6);
                }

                curSeconds += timeInterval;
                curPixel += pixelsPerSecond*timeInterval;          
            }
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
        var x = Math.min(
            this.width - mark.width,
            Math.max(0, Math.round(
                mark.percentage * this.width - mark.width / 2
            ))
        );
        this.marksCc.fillRect(x, 0, mark.width, this.height);
    },

    redrawMarks: function () {
        this.marksCc.clearRect(0, 0, this.width, this.height);
        Object.keys(this.marks).forEach(function (id) {
            this.drawMark(this.marks[id]);
        }, this);
    }
});
