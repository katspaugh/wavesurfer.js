'use strict';

var WaveSurfer = {
    init: function (params) {
        var my = this;

        var backend = WaveSurfer.Audio;

        if (!params.predrawn) {
            backend = WaveSurfer.WebAudio;
        }

        this.backend = Object.create(backend);
        this.backend.init(params);

        this.drawer = Object.create(WaveSurfer.Drawer);
        this.drawer.init(params);

        this.backend.bindUpdate(function () {
            my.onAudioProcess();
        });

        this.bindClick(params.canvas, function (percents) {
            my.playAt(percents);
        });
    },

    onAudioProcess: function () {
        if (!this.backend.isPaused()) {
            this.drawer.setCursorPercent(
                this.backend.getPlayedPercents()
            );
        }
    },

    playAt: function (percents) {
        this.backend.play(this.backend.getDuration() * percents);
    },

    pause: function () {
        this.backend.pause();
    },

    playPause: function () {
        if (this.backend.paused) {
            this.playAt(this.backend.getPlayedPercents() || 0);
        } else {
            this.pause();
        }
    },

    draw: function () {
        if (this.backend.currentBuffer) {
            this.drawer.drawBuffer(this.backend.currentBuffer);
        } else {
            console.error('This audio backend is not supporting drawing.');
        }
    },

    /**
     * Loads an audio file via XHR.
     */
    load: function (src) {
        var my = this;
        var xhr = new XMLHttpRequest();
        xhr.responseType = 'arraybuffer';
        xhr.onload = function () {
            my.backend.loadData(
                xhr.response,
                my.draw.bind(my)
            );
        };
        xhr.open('GET', src, true);
        xhr.send();
    },

    /**
     * Loads an audio file via drag'n'drop.
     */
    bindDragNDrop: function (dropTarget) {
        var my = this;
        var reader = new FileReader();
        reader.addEventListener('load', function (e) {
            my.backend.loadData(
                e.target.result,
                my.draw.bind(my)
            );
        }, false);

        (dropTarget || document).addEventListener('drop', function (e) {
            e.preventDefault();
            var file = e.dataTransfer.files[0];
            file && reader.readAsArrayBuffer(file);
        }, false);
    },

    /**
     * Click to seek.
     */
    bindClick: function (element, callback) {
        var my = this;
        element.addEventListener('click', function (e) {
            var relX = e.offsetX;
            if (null == relX) { relX = e.layerX; }
            callback(relX / this.clientWidth);
        }, false);
    }
};
