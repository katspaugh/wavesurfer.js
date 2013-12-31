'use strict';

WaveSurfer.Timeline = {
    init: function (params) {
        this.params = params;
        var wavesurfer = this.wavesurfer = params.wavesurfer;

        if (!this.wavesurfer) {
            throw Error('No WaveSurfer intance provided');
        }

        var drawer = this.drawer = this.wavesurfer.drawer;
        this.width = drawer.width;
        this.height = 20;

        this.container = 'string' == typeof params.container ?
            document.querySelector(params.container) : params.container;

        if (!this.container) {
            throw Error('No container for WaveSurfer timeline');
        }

        this.createWrapper();
        this.createCanvas();
        this.updateCanvasStyle();
        this.drawTimeCanvas();

        wavesurfer.drawer.wrapper.onscroll = this.updateScroll.bind(this)
    },

    createWrapper: function () {
        var wsParams = this.wavesurfer.params
        this.wrapper = this.container.appendChild(
            document.createElement('wave')
        );
        this.drawer.style(this.wrapper, {
            display: 'block',
            position: 'relative',
            userSelect: 'none',
            webkitUserSelect: 'none',
            height: this.params.height + 'px'
        });

        if (wsParams.fillParent || wsParams.scrollParent) {
            this.drawer.style(this.wrapper, {
                width: '100%',
                height: '20px',
                overflowX: 'hidden',
                overflowY: 'hidden'
            });
        }

        var my = this;
        this.wrapper.addEventListener('click', function (e) {
            e.preventDefault();
            var relX = 'offsetX' in e ? e.offsetX : e.layerX;
            my.fireEvent('click', (relX / my.scrollWidth) || 0);
        });
    },

    createCanvas: function () {
        var canvas = this.canvas = this.wrapper.appendChild(
          document.createElement('canvas')
        );

        this.timeCc = canvas.getContext('2d');

        this.wavesurfer.drawer.style(canvas, {
            position: 'absolute',
            zIndex: 4
        });
    },

    updateCanvasStyle: function () {
        var width = Math.round(this.width / this.pixelRatio) + 'px';
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.style.width = width;
    },

    drawTimeCanvas: function() {
        var backend = this.wavesurfer.backend
            , wsParams = this.wavesurfer.params
            , duration = backend.getDuration();

        if (wsParams.fillParent && !wsParams.scrollParent) {
            var width = this.drawer.getWidth();
            var pixelsPerSecond = width/duration;
        } else {
            var width = backend.getDuration() * wsParams.minPxPerSec;
            var pixelsPerSecond = wsParams.minPxPerSec;
        }

        if (duration > 0) {
            var curPixel = 0,
                curSeconds = 0,
                totalSeconds = parseInt(duration, 10) + 1,
                timeInterval = (pixelsPerSecond < 10) ? 10 : 1,
                formatTime = function(seconds) {
                    if (seconds/60 > 1) {
                        var minutes = parseInt(seconds / 60),
                            seconds = parseInt(seconds % 60),
                            seconds = (seconds < 10) ? '0' + seconds : seconds;
                        return '' + minutes + ':' + seconds;
                    } else {
                        return seconds;
                    }
                };

            for (var i = 0; i < totalSeconds/timeInterval; i++) {
                if (i % 10 == 0) {
                    this.timeCc.fillStyle = '#000000';
                    this.timeCc.fillRect(curPixel, 0, 1, 16);
                    this.timeCc.font = '10px Arial';
                    this.timeCc.fillText(formatTime(curSeconds), curPixel + 5, 16);
                } else if (i % 10 == 5) {
                    this.timeCc.fillStyle = '#c0c0c0';
                    this.timeCc.fillRect(curPixel,0,1,16);
                    this.timeCc.font = '10px Arial';
                    this.timeCc.fillText(formatTime(curSeconds), curPixel + 5, 16);
                } else {
                    this.timeCc.fillStyle = '#c0c0c0';
                    this.timeCc.fillRect(curPixel, 0, 1, 6);
                }

                curSeconds += timeInterval;
                curPixel += pixelsPerSecond * timeInterval;
            }
        }
    },

    updateScroll: function(e){
      this.wrapper.scrollLeft = e.target.scrollLeft
    }
};

WaveSurfer.util.extend(WaveSurfer.Timeline, WaveSurfer.Observer);
