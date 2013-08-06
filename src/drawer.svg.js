'use strict';

WaveSurfer.Drawer.SVG = Object.create(WaveSurfer.Drawer);

WaveSurfer.util.extend(WaveSurfer.Drawer.SVG, {
    attr: function (node, attrs) {
        Object.keys(attrs).forEach(function (key) {
            node.setAttribute(key, attrs[key]);
        });
    },

    node: function (name, attrs) {
        var node = document.createElementNS('http://www.w3.org/2000/svg', name);
        attrs && this.attr(node, attrs);
        return node;
    },

    createElements: function () {
        var svg = this.node('svg', {
            viewBox: [ 0, 0, this.width, this.height ].join(' ')
        });

        var defs = this.node('defs');

        // Wave path
        var pathId = WaveSurfer.util.getId();
        var path = this.node('path', {
            id: pathId
        });
        defs.appendChild(path);

        // Progress clip
        var clipId = WaveSurfer.util.getId();
        var clip = this.node('clipPath', {
            id: clipId
        });
        var clipRect = this.node('rect', {
            width: 0,
            height: this.height
        });
        clip.appendChild(clipRect);
        defs.appendChild(clip);

        var useWave = this.node('use', {
            stroke: this.params.waveColor,
            'class': 'wavesurfer-wave'
        });
        useWave.href.baseVal = '#' + pathId;

        var useClip = this.node('use', {
            stroke: this.params.progressColor,
            'clip-path': 'url(#' + clipId + ')',
            'class': 'wavesurfer-progress'
        });
        useClip.href.baseVal = '#' + pathId;

        this.cursorWidth = this.params.cursorWidth * this.pixelRatio;
        var cursor = this.node('rect', {
            width: this.cursorWidth,
            height: this.height,
            fill: this.params.cursorColor,
            'class': 'wavesurfer-cursor'
        });

        [ defs, useWave, useClip, cursor ].forEach(function (node) {
            svg.appendChild(node);
        });

        this.container.appendChild(svg);

        this.svg = svg;
        this.wavePath = path;
        this.progressPath = clipRect;
        this.cursor = cursor;
    },

    updateWidth: function () {
        this.attr(this.svg, {
            viewBox: [ 0, 0, this.width, this.height ].join(' ')
        });

        if (this.params.scrollParent) {
            this.attr(this.svg, {
                width: this.scrollWidth,
                height: '100%'
            });
        }
    },

    drawWave: function (peaks, max) {
        var height = this.height;
        var pathData = [];

        if (0 == max) {
            pathData.push('M', 0, Math.round(height / 2), 'l', this.width, 0);
        } else {
            var factor = height / max;
            for (var i = 0; i < this.width; i++) {
                var h = Math.round(peaks[i] * factor);
                var y = Math.round((height - h) / 2);
                pathData.push('M', i, y, 'l', 0, h);
            }
        }

        this.wavePath.setAttribute('d', pathData.join(' '));
    },

    updateProgress: function () {
        this.progressPath.setAttribute('width', this.lastPos);

        this.cursor.setAttribute('x', Math.min(
            this.lastPos - ~~(this.params.cursorWidth / 2),
            this.width - this.params.cursorWidth
        ));
    },

    addMark: function (mark) {
        var markRect = document.getElementById(mark.id);
        if (markRect) {
            var title = markRect.querySelector('title');
        } else {
            markRect = this.node('rect');
            markRect.setAttribute('id', mark.id);
            this.svg.appendChild(markRect);
            title = this.node('title');
            markRect.appendChild(title);
        }
        this.attr(markRect, {
            fill: mark.color,
            width: mark.width,
            height: this.height,
            x: Math.round(mark.percentage * this.width)
        });
        title.textContent = mark.getTitle();
    },

    removeMark: function (mark) {
        var markRect = document.getElementById(mark.id);
        if (markRect) {
            this.svg.removeChild(markRect);
        }
    }
});
