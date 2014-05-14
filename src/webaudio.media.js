'use strict';

WaveSurfer.WebAudio.Media = {
    postInit: function () {
        // Dummy media to catch errors
        this.media = {
            currentTime: 0,
            duration: 0,
            paused: true,
            playbackRate: 1,
            play: function () {},
            pause: function () {}
        };
        WaveSurfer.util.extend(this, WaveSurfer.AudioTag.Media);
    },

    load: function (media) {
        this.disconnectSource();
        this.media = media;
        this.source = this.ac.createMediaElementSource(this.media);
        this.media.playbackRate = this.playbackRate;
        this.source.connect(this.analyser);
    }
};
