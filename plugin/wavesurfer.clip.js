'use strict';

WaveSurfer.Clip = {
    init: function (params) {
        var self = this;
        this.params = params;
        var wavesurfer = this.wavesurfer = params.wavesurfer;

        if (!this.wavesurfer) {
            throw Error('No WaveSurfer instance provided');
        }

        var drawer = this.drawer = this.wavesurfer.drawer;

        this.container = 'string' === typeof params.container ?
            document.querySelector(params.container) : params.container;

        if (!this.container) {
            throw Error('No container for WaveSurfer clip');
        }

        this.width = drawer.width;
        this.height = this.params.height || 20;

        var prevClip = this.container.querySelector('clip');
        if (prevClip) {
            this.container.removeChild(prevClip);
        }

        if (this.params.template) {
            this.container.innerHTML = this.params.template;
        } else {
            // fix me
            var clipContainer = WaveSurfer.util.template('<div></div>');
            this.container.innerHTML = clipContainer;
        }

        this.wavesurfer.on('region-update-end', function () {
            self.setRegionTable();
        });

        this.wavesurfer.on('region-removed', function () {
            self.setRegionTable();
        });

        this.segmentStart = document.querySelector('#waveform-clip-segment-start');
        this.segmentEnd = document.querySelector('#waveform-clip-segment-end');

        this.regionStart = document.querySelector('#waveform-clip-region-start');
        this.regionEnd = document.querySelector('#waveform-clip-region-end');

        this.clipReset = document.querySelector('#waveform-clip-reset');
        this.clipReset.onclick = function () {
            self.wavesurfer.clearRegions();
            self.init(params);
        };

        this.submit = document.querySelector('#waveform-clip-submit');
        this.submit.onclick = function () {
            if (params.submit && typeof params.submit === 'function') {
                var start = 0;
                var end = self.wavesurfer.getDuration();

                var regions = Object.keys(self.wavesurfer.regions.list).map(function (key, i) {
                    var item = self.wavesurfer.regions.list[key];
                    return { start: item.start, end: item.end };
                }).sort(function (a, b) {
                    return a.start - b.start;
                });

                var pos = 0;
                var ret = [];
                for (var i in regions) {
                    var region = regions[i];
                    if (pos < region.start) {
                        ret.push({ start: pos, end: region.start });
                        pos = pos < region.end ? region.end : pos;
                    } else {
                        pos = pos < region.end ? region.end : pos;
                    }
                }
                ret.push({ start: pos, end: end });
                params.submit(ret);
            }
        };

        this.regionSubmit = document.querySelector('#waveform-clip-region-submit');
        this.regionSubmit.onclick = function () {
            if (params.regionSubmit && typeof params.regionSubmit === 'function') {
                params.regionSubmit(Object.keys(self.wavesurfer.regions.list).map(function (key, i) {
                    var item = self.wavesurfer.regions.list[key];
                    return { start: item.start, end: item.end };
                }));
            }
        };
    },
    setRegionTable: function () {
        var self = this;
        var regions = this.wavesurfer.regions.list;

        [].forEach.call(self.container.querySelectorAll('#region-list > tr'), function (tr) {
            var tds = tr.querySelectorAll('td');
            tds[1].innerHTML = '';
            tds[2].innerHTML = '';
        });

        Object.keys(this.wavesurfer.regions.list).map(function (key, i) {
            var item = regions[key];
            var tr = self.container.querySelector('#region-list > tr:nth-child(' + (i + 1) + ')');
            if (tr) {
                var tds = tr.querySelectorAll('td');
                tds[1].innerHTML = self.formatTime(item.start);
                tds[2].innerHTML = self.formatTime(item.end - item.start);
            } else {
                tr = document.createElement('tr');
                self.container.querySelector('#region-list').appendChild(tr);
                tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + self.formatTime(item.start) + '</td><td>' + self.formatTime(item.end - item.start) + '</td><td></td>';
            }
        });
    },
    formatTime: function (time) {
        return [
            Math.floor(time % 3600 / 60), // minutes
            ('00' + Math.floor(time % 60)).slice(-2) // seconds
        ].join(':');
    }
};

WaveSurfer.util.extend(WaveSurfer.Clip, WaveSurfer.Observer);