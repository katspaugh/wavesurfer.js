'use strict';

WaveSurfer.Controls = {
    init: function (params) {
        this.params = params;
        this.wavesurfer = params.wavesurfer;

        if (!this.wavesurfer) {
            throw Error('No WaveSurfer instance provided');
        }

        var drawer = this.drawer = this.wavesurfer.drawer;

        this.container = 'string' === typeof params.container ?
            document.querySelector(params.container) : params.container;

        if (!this.container) {
            throw Error('No container for WaveSurfer controls');
        }

        this.width = drawer.width;
        this.height = this.params.height || 20;
        this.zoomLevel = this.params.zoomLevel || 1;
        this.volume = this.params.volume || 1;

        var prevControls = this.container.querySelector('controls');
        if (prevControls) {
            this.container.removeChild(prevControls);
        }

        if (this.params.template) {
            this.container.innerHTML = this.params.template;
        } else {
            var controlsContainer = WaveSurfer.util.template('<div></div>');
            this.container.innerHTML = controlsContainer;
        }

        this.setStatusOpt();
        this.setPosOpt();
        this.setVolumeOpt();
        this.setZoomOpt();
    },
    setStatusOpt: function () {
        var self = this;
        this.play = this.container.querySelector('#waveform-controls-play');
        this.pause = this.container.querySelector('#waveform-controls-pause');
        if (this.wavesurfer.isPlaying()) {
            this.play.style.display = 'none';
            this.pause.style.display = '';
        } else {
            this.pause.style.display = 'none';
            this.play.style.display = '';
        }

        this.play.onclick = function () {
            self.wavesurfer.playPause();
        };

        this.pause.onclick = function () {
            self.wavesurfer.playPause();
        };

        this.wavesurfer.on('pause', function () {
            self.pause.style.display = 'none';
            self.play.style.display = '';
        });

        this.wavesurfer.on('finish', function () {
            self.pause.style.display = 'none';
            self.play.style.display = '';
        });
        this.wavesurfer.on('play', function () {
            self.pause.style.display = '';
            self.play.style.display = 'none';
        });
    },
    setPosOpt: function () {
        var self = this;
        var cur = this.container.querySelector('#waveform-controls-pos-info .cur');
        var total = this.container.querySelector('#waveform-controls-pos-info .total');

        total.innerHTML = this.formatTime(this.wavesurfer.getDuration());
        this.wavesurfer.on('audioprocess', function () {
            cur.innerHTML = self.formatTime(self.wavesurfer.getCurrentTime());
        });

        this.restart = this.container.querySelector('#waveform-controls-restart');
        this.restart.onclick = function () {
            var isPlaying = self.wavesurfer.isPlaying();
            self.wavesurfer.pause();
            self.wavesurfer.seekTo(0);
            if (isPlaying) {
                self.wavesurfer.play();
            }
        };

        this.end = this.container.querySelector('#waveform-controls-end');
        this.end.onclick = function () {
            self.wavesurfer.stop();
            self.wavesurfer.seekTo(1);
        };

        this.backward5 = this.container.querySelector('#waveform-controls-backward5');
        this.backward5.onclick = function () {
            var isPlaying = self.wavesurfer.isPlaying();
            self.wavesurfer.pause();
            self.wavesurfer.skipBackward(5);
            if (isPlaying) {
                self.wavesurfer.play();
            }
        };

        this.forward5 = this.container.querySelector('#waveform-controls-forward5');
        this.forward5.onclick = function () {
            self.wavesurfer.skipForward(5);
        };
    },
    setVolumeOpt: function () {
        var self = this;
        this.volumeinput = this.container.querySelector('#waveform-controls-volume');
        this.volumeup = this.container.querySelector('#waveform-controls-volume-up');
        this.volumedown = this.container.querySelector('#waveform-controls-volume-down');
        this.volumeoff = this.container.querySelector('#waveform-controls-volume-off');

        this.volumeinput.onchange = function checkField(e) {
            self.volume = parseInt(e.target.value) / 100.0;
            self.wavesurfer.setVolume(self.volume);

            if (self.volume > 0.5) {
                self.volumeup.style.display = '';
                self.volumedown.style.display = 'none';
                self.volumeoff.style.display = 'none';
            } else if (self.volume > 0) {
                self.volumeup.style.display = 'none';
                self.volumedown.style.display = '';
                self.volumeoff.style.display = 'none';
            } else {
                self.volumeup.style.display = 'none';
                self.volumedown.style.display = 'none';
                self.volumeoff.style.display = '';
            }
        };

        this.volumeup.onclick = function () {
            self.wavesurfer.toggleMute();
            self.volumeup.style.display = 'none';
            self.volumedown.style.display = 'none';
            self.volumeoff.style.display = '';
        };
        this.volumedown.onclick = function () {
            self.wavesurfer.toggleMute();
            self.volumeup.style.display = 'none';
            self.volumedown.style.display = 'none';
            self.volumeoff.style.display = '';
        };
        this.volumeoff.onclick = function () {
            self.wavesurfer.toggleMute();
            self.volumeoff.style.display = 'none';

            if (self.volume > 0.5) {
                self.volumeup.style.display = '';
                self.volumedown.style.display = 'none';
            } else {
                self.volumeup.style.display = 'none';
                self.volumedown.style.display = '';
            }
        };
    },
    setZoomOpt: function () {
        var self = this;
        var span = 0.2;
        this.zoomup = this.container.querySelector('#waveform-controls-zoomup');
        this.zoomup.onclick = function () {
            self.zoomLevel = self.zoomLevel + span >= 5 * span ? 5 * span : self.zoomLevel + span;
            self.wavesurfer.zoom(self.zoomLevel);
        };

        this.zoomdown = this.container.querySelector('#waveform-controls-zoomdown');
        this.zoomdown.onclick = function () {
            self.zoomLevel = self.zoomLevel - span <= span ? span : self.zoomLevel - span;
            self.wavesurfer.zoom(self.zoomLevel);
        };
    },
    formatTime: function (time) {
        return [
            Math.floor(time % 3600 / 60), // minutes
            ('00' + Math.floor(time % 60)).slice(-2) // seconds
        ].join(':');
    }
};

WaveSurfer.util.extend(WaveSurfer.Controls, WaveSurfer.Observer);