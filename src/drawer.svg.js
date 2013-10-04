'use strict';

WaveSurfer.Drawer.SVG = Object.create(WaveSurfer.Drawer);

WaveSurfer.util.extend(WaveSurfer.Drawer.SVG, {
    attr: function (node, attrs) {
        Object.keys(attrs).forEach(function (key) {
            var ns = key == 'href' ? 'http://www.w3.org/1999/xlink' : null;
            node.setAttributeNS(ns, key, attrs[key]);
        });
    },

    node: function (name, attrs) {
        var node = document.createElementNS('http://www.w3.org/2000/svg', name);
        attrs && this.attr(node, attrs);
        return node;
    },

    createElements: function () {
        var svg = this.node('svg');
        var defs = svg.appendChild(this.node('defs'));

        // Wave path definition
        var pathId = WaveSurfer.util.getId();
        var wavePath = defs.appendChild(this.node('path', {
            id: pathId
        }));

        // Progress clip definition
        var clipId = WaveSurfer.util.getId();
        var clipRect = defs.appendChild(this.node('clipPath', {
            id: clipId
        })).appendChild(this.node('rect', {
            width: 0,
            height: this.height
        }));

        svg.appendChild(this.node('use', {
            stroke: this.params.waveColor,
            'class': 'wavesurfer-wave',
            'href': '#' + pathId
        }));

        svg.appendChild(this.node('use', {
            stroke: this.params.progressColor,
            'clip-path': 'url(#' + clipId + ')',
            'class': 'wavesurfer-progress',
            'href': '#' + pathId
        }));

        this.cursorWidth = this.params.cursorWidth * this.pixelRatio;
        var cursor = svg.appendChild(this.node('rect', {
            width: this.cursorWidth,
            height: this.height,
            fill: this.params.cursorColor,
            'class': 'wavesurfer-cursor'
        }));

        this.style(svg, {
            userSelect: 'none',
            webkitUserSelect: 'none'
        });
        this.wrapper.appendChild(svg);

        this.svg = svg;
        this.wavePath = wavePath;
        this.progressNode = clipRect;
        this.cursor = cursor;
    },

    updateWidth: function () {
        if (this.params.fillParent) {
            // 0.5 px offset makes the path stroke look sharp
            this.attr(this.svg, {
                viewBox: [ 0.5, 0.5, this.width, this.height ].join(' ')
            });
        }

        if (this.params.scrollParent || !this.params.fillParent) {
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
        this.progressNode.setAttribute('width', this.lastPos);

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
