'use strict';

WaveSurfer.MediaSession = {
    init: function (params) {
        this.params = params;

        var wavesurfer = this.wavesurfer = params.wavesurfer;

        if (!this.wavesurfer) {
            throw new Error('No WaveSurfer instance provided');
        }

        if ('mediaSession' in navigator) {
            // update metadata
            this.metadata = this.params.metadata;
            this.update();

            // update metadata when playback starts
            var here = this;
            wavesurfer.on('play', function() {
                here.update();
            });

            // set playback action handlers
            navigator.mediaSession.setActionHandler('play', function() {
                wavesurfer.play();
            });
            navigator.mediaSession.setActionHandler('pause', function() {
                wavesurfer.playPause();
            });
            navigator.mediaSession.setActionHandler('seekbackward', function() {
                wavesurfer.skipBackward();
            });
            navigator.mediaSession.setActionHandler('seekforward', function() {
                wavesurfer.skipForward();
            });
        }
    },

    update: function()
    {
        if (typeof MediaMetadata === typeof Function) {
            // set metadata
            navigator.mediaSession.metadata = new MediaMetadata(this.metadata);
        }
    }

};

WaveSurfer.util.extend(WaveSurfer.MediaSession, WaveSurfer.Observer);
