'use strict';

var WaveSurfer = {
    init: function (params) {
        this.webAudio = Object.create(WaveSurfer.WebAudio);
        this.webAudio.init(params);

        this.drawer = Object.create(WaveSurfer.Drawer);
        this.drawer.init(params);

        var self = this;
        this.webAudio.proc.onaudioprocess = function () {
            self.onAudioProcess();
        };

        this.drawer.bindClick(function (percents) {
            self.playAt(percents);
        });
    },

    onAudioProcess: function () {
        if (!this.webAudio.paused) {
            this.updatePercents();
            this.drawer.setCursorPercent(this.currentPercents);
        }
    },

    updatePercents: function () {
        var d = this.webAudio.ac.currentTime - this.webAudio.lastPlay;
        var percents = d / this.webAudio.getDuration();
        this.currentPercents = this.lastPlayPercents + percents;
    },

    playAt: function (percents) {
        this.webAudio.play(this.webAudio.getDuration() * percents);

        this.lastPlayPercents = percents;
    },

    pause: function () {
        this.webAudio.pause();

        this.updatePercents();
    },

    playPause: function () {
        if (this.webAudio.paused) {
            this.playAt(this.currentPercents || 0);
        } else {
            this.pause();
        }
    },

    draw: function () {
        this.drawer.drawBuffer(this.webAudio.currentBuffer);
    },

    /**
     * Loads an audio file via XHR.
     */
    load: function (src) {
        var self = this;
        var xhr = new XMLHttpRequest();
        xhr.responseType = 'arraybuffer';
        xhr.onload = function () {
            self.webAudio.loadData(
                xhr.response,
                self.draw.bind(self)
            );
        };
        xhr.open('GET', src, true);
        xhr.send();
    },

    /**
     * Loads an audio file via drag'n'drop.
     */
    bindDragNDrop: function (dropTarget) {
        var self = this;
        var reader = new FileReader();
        reader.addEventListener('load', function (e) {
            self.webAudio.loadData(
                e.target.result,
                self.draw.bind(self)
            );
        }, false);

        (dropTarget || document).addEventListener('drop', function (e) {
            e.preventDefault();
            var file = e.dataTransfer.files[0];
            file && reader.readAsArrayBuffer(file);
        }, false);
    }
};