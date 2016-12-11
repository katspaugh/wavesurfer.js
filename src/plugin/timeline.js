/**
 * timeline plugin
 *
 * @param  {Object} params parameters use to initialise the plugin
 * @return {Object} an object representing the plugin
 */
export default function(params = {}) {
    return {
        name: 'timeline',
        deferInit: params && params.deferInit ? params.deferInit : false,
        extends: ['observer'],
        instance: {
            init(wavesurfer) {
                this.params = params;
                this.wavesurfer = wavesurfer;

                if (!this.wavesurfer) {
                    throw Error('No WaveSurfer intance provided');
                }


                this.container = 'string' == typeof params.container ?
                document.querySelector(params.container) : params.container;

                if (!this.container) {
                    throw Error('No container for WaveSurfer timeline');
                }

                this.height = this.params.height || 20;
                this.notchPercentHeight = this.params.notchPercentHeight || 90;
                this.primaryColor = this.params.primaryColor || '#000';
                this.secondaryColor = this.params.secondaryColor || '#c0c0c0';
                this.primaryFontColor = this.params.primaryFontColor || '#000';
                this.secondaryFontColor = this.params.secondaryFontColor || '#000';
                this.fontFamily = this.params.fontFamily || 'Arial';
                this.fontSize = this.params.fontSize || 10;
                this.timeInterval = this.params.timeInterval;
                this.primaryLabelInterval = this.params.primaryLabelInterval;
                this.secondaryLabelInterval = this.params.secondaryLabelInterval;
                this.formatTimeCallback = this.params.formatTimeCallback;
                this.canvases = [];

                this._onRedraw = () => {
                    this.render();
                };

                this._onReady = () => {
                    this.drawer = this.wavesurfer.drawer;
                    this.width = this.wavesurfer.drawer.width;
                    this.pixelRatio = this.wavesurfer.drawer.params.pixelRatio;
                    this.maxCanvasWidth = this.wavesurfer.drawer.maxCanvasWidth || this.width;
                    this.maxCanvasElementWidth = this.wavesurfer.drawer.maxCanvasElementWidth || Math.round(this.maxCanvasWidth / this.pixelRatio);

                    this.createWrapper();
                    this.render();
                    this.wavesurfer.drawer.wrapper.addEventListener('scroll', e => this.updateScroll(e));
                    this.wavesurfer.on('redraw', this._onRedraw);
                };
                this.wavesurfer.on('ready', this._onReady);
                // Check if ws is ready
                if (this.wavesurfer.backend) {
                    this._onReady();
                }
            },

            destroy() {
                this.unAll();
                this.wavesurfer.un('redraw', this._onRedraw);
                this.wavesurfer.un('ready', this._onReady);
                if (this.wrapper && this.wrapper.parentNode) {
                    this.wrapper.parentNode.removeChild(this.wrapper);
                    this.wrapper = null;
                }
            },

            createWrapper() {

                const wsParams = this.wavesurfer.params;
                this.wrapper = this.container.appendChild(
                    document.createElement('timeline')
                );
                this.drawer.style(this.wrapper, {
                    display: 'block',
                    position: 'relative',
                    userSelect: 'none',
                    webkitUserSelect: 'none',
                    height: this.height + 'px'
                });

                if (wsParams.fillParent || wsParams.scrollParent) {
                    this.drawer.style(this.wrapper, {
                        width: '100%',
                        overflowX: 'hidden',
                        overflowY: 'hidden'
                    });
                }

                this.wrapper.addEventListener('click', e => {
                    e.preventDefault();
                    const relX = 'offsetX' in e ? e.offsetX : e.layerX;
                    this.fireEvent('click', (relX / this.wrapper.scrollWidth) || 0);
                });
            },

            removeOldCanvases() {
                while (this.canvases.length > 0) {
                    const canvas = this.canvases.pop();
                    canvas.parentElement.removeChild(canvas);
                }
            },

            createCanvases() {
                this.removeOldCanvases();

                const totalWidth = Math.round(this.drawer.wrapper.scrollWidth);
                const requiredCanvases = Math.ceil(totalWidth / this.maxCanvasElementWidth);
                let canvas;
                let i;

                for (i = 0; i < requiredCanvases; i++) {
                    canvas = this.wrapper.appendChild(document.createElement('canvas'));
                    this.canvases.push(canvas);
                    this.drawer.style(canvas, {
                        position: 'absolute',
                        zIndex: 4
                    });
                }
            },

            render() {
                this.createCanvases();
                this.updateCanvasStyle();
                this.drawTimeCanvases();
            },

            updateCanvasStyle() {
                const requiredCanvases = this.canvases.length;
                let i;
                for (i = 0; i < requiredCanvases; i++) {
                    const canvas = this.canvases[i];
                    let canvasWidth = this.maxCanvasElementWidth;

                    if (i === requiredCanvases - 1) {
                        canvasWidth = this.drawer.wrapper.scrollWidth - (this.maxCanvasElementWidth * (requiredCanvases - 1));
                    }

                    canvas.width = canvasWidth * this.pixelRatio;
                    canvas.height = this.height * this.pixelRatio;
                    canvas.style.width = canvasWidth + 'px';
                    canvas.style.height = this.height + 'px';
                    canvas.style.left = i * this.maxCanvasElementWidth + 'px';
                }
            },

            drawTimeCanvases() {
                const backend = this.wavesurfer.backend;
                const wsParams = this.wavesurfer.params;
                const duration = backend.getDuration();
                const totalSeconds = parseInt(duration, 10) + 1;
                let width;
                let curPixel = 0;
                let curSeconds = 0;

                if (wsParams.fillParent && !wsParams.scrollParent) {
                    width = this.drawer.getWidth();
                } else {
                    width = this.drawer.wrapper.scrollWidth * wsParams.pixelRatio;
                }
                const pixelsPerSecond = width/duration;

                if (duration <= 0) { return; }

                const formatTime = seconds => {
                    if (typeof this.formatTimeCallback === 'function') {
                        return this.formatTimeCallback(seconds);
                    }

                    if (seconds/60 > 1) {
                        const minutes = parseInt(seconds / 60);
                        seconds = parseInt(seconds % 60);
                        seconds = (seconds < 10) ? '0' + seconds : seconds;
                        return '' + minutes + ':' + seconds;
                    }
                    return seconds;
                };

                let timeInterval = 60;
                let primaryLabelInterval = 4;
                let secondaryLabelInterval = 2;
                if (pixelsPerSecond * 1 >= 25) {
                    timeInterval = 1;
                    primaryLabelInterval = 10;
                    secondaryLabelInterval = 5;
                } else if (pixelsPerSecond * 5 >= 25) {
                    timeInterval = 5;
                    primaryLabelInterval = 6;
                    secondaryLabelInterval = 2;
                } else if (pixelsPerSecond * 15 >= 25) {
                    timeInterval = 15;
                    primaryLabelInterval = 4;
                    secondaryLabelInterval = 2;
                }

                timeInterval = this.timeInterval || timeInterval;
                primaryLabelInterval = this.primaryLabelInterval || primaryLabelInterval;
                secondaryLabelInterval = this.secondaryLabelInterval || secondaryLabelInterval;

                const height1 = this.height - 4;
                const height2 = (this.height * (this.notchPercentHeight / 100.0)) - 4;
                const fontSize = this.fontSize * wsParams.pixelRatio;
                let i;

                for (i = 0; i < totalSeconds/timeInterval; i++) {
                    if (i % primaryLabelInterval == 0) {
                        this.setFillStyles(this.primaryColor);
                        this.fillRect(curPixel, 0, 1, height1);
                        this.setFonts(fontSize + 'px ' + this.fontFamily);
                        this.setFillStyles(this.primaryFontColor);
                        this.fillText(formatTime(curSeconds), curPixel + 5, height1);
                    } else if (i % secondaryLabelInterval == 0) {
                        this.setFillStyles(this.secondaryColor);
                        this.fillRect(curPixel, 0, 1, height1);
                        this.setFonts(fontSize + 'px ' + this.fontFamily);
                        this.setFillStyles(this.secondaryFontColor);
                        this.fillText(formatTime(curSeconds), curPixel + 5, height1);
                    } else {
                        this.setFillStyles(this.secondaryColor);
                        this.fillRect(curPixel, 0, 1, height2);
                    }

                    curSeconds += timeInterval;
                    curPixel += pixelsPerSecond * timeInterval;
                }
            },

            setFillStyles(fillStyle) {
                let i;
                for (i in this.canvases) {
                    this.canvases[i].getContext('2d').fillStyle = fillStyle;
                }
            },

            setFonts(font) {
                let i;
                for (i in this.canvases) {
                    this.canvases[i].getContext('2d').font = font;
                }
            },

            fillRect(x, y, width, height) {
                let i;
                for (i in this.canvases) {
                    const canvas = this.canvases[i];
                    const leftOffset = i * this.maxCanvasWidth;

                    const intersection = {
                        x1: Math.max(x, i * this.maxCanvasWidth),
                        y1: y,
                        x2: Math.min(x + width, i * this.maxCanvasWidth + canvas.width),
                        y2: y + height
                    };

                    if (intersection.x1 < intersection.x2) {
                        canvas.getContext('2d').fillRect(
                            intersection.x1 - leftOffset,
                            intersection.y1,
                            intersection.x2 - intersection.x1,
                            intersection.y2 - intersection.y1
                        );
                    }
                }
            },

            fillText(text, x, y) {
                let textWidth;
                let xOffset = 0;
                let i;

                for (i in this.canvases) {
                    const context = this.canvases[i].getContext('2d');
                    const canvasWidth = context.canvas.width;

                    if (xOffset > x + textWidth) {
                        break;
                    }

                    if (xOffset + canvasWidth > x) {
                        textWidth = context.measureText(text).width;
                        context.fillText(text, x - xOffset, y);
                    }

                    xOffset += canvasWidth;
                }
            },

            updateScroll() {
                this.wrapper.scrollLeft = this.drawer.wrapper.scrollLeft;
            }
        }
    };
}
