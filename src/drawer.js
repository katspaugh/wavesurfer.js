WaveSurfer.Drawer = {
    FRAME_TIME: 1000 / 60,

    init: function (canvas, webAudio, params) {
        params = params || {};

        this.canvas = canvas;
        this.webAudio = webAudio;
        this.initCanvas(params);

        if (params.continuous) {
            this.scroller = this.canvas.offsetParent;
            this.scrollerWidth = this.scroller.clientWidth;
            this.currentScrollLeft = 0;

            this.marginRight = params.marginRight || 100;
            this.marginLeft = params.marginLeft || 100;

            this.continuousLineWidth = params.continuousLineWidth || 1;
            this.cursor = params.cursor;
            this.drawFn = this.drawContinuous;
        } else {
            this.drawFn = this.drawCurrent;
        }

        this.pos = this.maxPos = 0;
    },

    initCanvas: function (params) {
        this.cc = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        if (params.color) {
            this.cc.fillStyle = params.color;
            this.cc.strokeStyle = params.color;
        }
    },

    setDuration: function (duration) {
        var color = this.cc.fillStyle;
        this.width = ~~(
            ((duration * 1000) / this.FRAME_TIME) *
                this.continuousLineWidth
        );
        this.canvas.width = this.width;
        this.cc.fillStyle = color;
        this.cc.strokeStyle = color;
    },

    bindClick: function () {
        var self = this;
        this.canvas.addEventListener('click', function (e) {
            if (self.webAudio.paused) {
                return;
            }
            var canvasPosition = this.getBoundingClientRect();
            var relX = e.pageX - canvasPosition.left;
            var frames = relX / self.continuousLineWidth;
            var timePlayed = frames * self.FRAME_TIME;

            self.pos = relX;
            self.setCursor(relX);

            self.webAudio.play(timePlayed / 1000);
        }, false);
    },

    loop: function (dataFn) {
        var self = this;

        function loop() {
            if (!self.webAudio.paused) {
                var data = dataFn.call(self.webAudio);
                self.drawFn(data);
            }
            requestAnimationFrame(loop, self.canvas)
        };

        loop();
    },

    drawCurrent: function (data) {
        var w = this.width, h = this.height,
            len = data.length,
            i, value;

        this.lineWidth = ~~(w / len);

        this.cc.clearRect(0, 0, w, h);

        this.cc.beginPath();
        for (i = 0; i < len; i += 1) {
            value = ~~(h - (data[i] / 256 * h));
            this.cc.lineTo(
                this.lineWidth * i, h - value
            );
        }
        this.cc.stroke();
    },

    setCursor: function (pos) {
        if (this.cursor) {
            this.cursor.style.left = pos + 'px';
        }
    },

    setScroll: function (scrollLeft) {
        if (scrollLeft < 0) {
            scrollLeft = 0;
        }

        if (this.scrolling) {
            this.currentScrollLeft = scrollLeft;
        }

        if (scrollLeft === this.currentScrollLeft) {
            return;
        }

        var MAX_DIFF = 10;

        var self = this;

        if (Math.abs(scrollLeft - this.currentScrollLeft) > MAX_DIFF) {
            this.scrolling = true;
            WaveSurfer.animate(this.scroller, {
                styles: {
                    scrollLeft: {
                        start: this.currentScrollLeft,
                        end: scrollLeft
                    }
                },
                duration: 600,
                easing: 'easeInQuad',

                callback: function () {
                    self.scrolling = false;
                }
            });
         } else {
             this.scroller.scrollLeft = scrollLeft;
         }

         this.currentScrollLeft = scrollLeft;
    },

    drawContinuous: function (data) {
        this.setCursor(this.pos);

        if (this.pos < this.maxPos) {
            this.setScroll(this.pos - this.marginLeft);
            this.pos += 1;
            return;
        }

        this.setScroll(
            this.pos - (this.scrollerWidth - this.marginRight)
        );

        this.lineWidth = this.continuousLineWidth;

        var h = this.height,
            halfH = ~~(h / 2);

        var value = ~~((h - (data[0] / 256 * h)) / 2);
        this.cc.fillRect(
            this.pos, halfH - value,
            this.lineWidth, value * 2
        );

        this.pos += 1;
        this.maxPos = this.pos;
    }
};