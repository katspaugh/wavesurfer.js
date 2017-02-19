/**
 * @typedef {Object} TimelinePluginParams
 * @desc Extends WavesurferParams
 * @property {!string|HTMLElement} container CSS selector or HTML element where
 * the timeline should be drawn. This is the only required parameter.
 * @property {number} notchPercentHeight=90 Height of notches in percent
 * @property {string} primaryColor='#000' The colour of the main notches
 * @property {string} secondaryColor='#c0c0c0' The colour of the secondary
 * notches
 * @property {string} primaryFontColor='#000' The colour of the labels next to
 * the main notches
 * @property {string} secondaryFontColor='#000' The colour of the labels next to
 * the secondary notches
 * @property {string} fontFamily='Arial'
 * @property {number} fontSize=10 Font size of labels in pixels
 * @property {function} formatTimeCallback=→00:00
 * @property {?boolean} deferInit Set to true to manually call
 * `initPlugin('timeline')`
 */

/**
 * Timeline plugin definition factory
 *
 * @param  {TimelinePluginParams} params parameters use to initialise the plugin
 * @return {PluginDefinition} an object representing the plugin
 */
export default function(params = {}) {
    return {
        name: 'timeline',
        deferInit: params && params.deferInit ? params.deferInit : false,
        extends: 'observer',
        instance: Observer => class TimelinePlugin extends Observer {
            constructor(wavesurfer) {
                super();
                this.params = params;
                this.wavesurfer = wavesurfer;
                this.style = wavesurfer.util.style;

                this.container = 'string' == typeof params.container
                    ? document.querySelector(params.container)
                    : params.container;

                if (!this.container) {
                    throw new Error('No container for WaveSurfer timeline');
                }

                this.params = wavesurfer.util.extend({}, {
                    height: 20,
                    notchPercentHeight: 90,
                    primaryColor: '#000',
                    secondaryColor: '#c0c0c0',
                    primaryFontColor: '#000',
                    secondaryFontColor: '#000',
                    fontFamily: 'Arial',
                    fontSize: 10,
                    formatTimeCallback(seconds) {
                        if (seconds / 60 > 1) {
                            // calculate minutes and seconds from seconds count
                            const minutes = parseInt(seconds / 60, 10);
                            seconds = parseInt(seconds % 60, 10);
                            // fill up seconds with zeroes
                            seconds = (seconds < 10) ? '0' + seconds : seconds;
                            return `${minutes}:${seconds}`;
                        }
                        return seconds;
                    },
                    timeInterval(pxPerSec) {
                        if (pxPerSec >= 25) {
                            return 1;
                        } else if (pxPerSec * 5 >= 25) {
                            return 5;
                        } else if (pxPerSec * 15 >= 25) {
                            return 15;
                        }
                        return 60;
                    },
                    primaryLabelInterval(pxPerSec) {
                        if (pxPerSec >= 25) {
                            return 10;
                        } else if (pxPerSec * 5 >= 25) {
                            return 6;
                        } else if (pxPerSec * 15 >= 25) {
                            return 4;
                        }
                        return 4;
                    },
                    secondaryLabelInterval(pxPerSec) {
                        if (pxPerSec >= 25) {
                            return 5;
                        } else if (pxPerSec * 5 >= 25) {
                            return 2;
                        } else if (pxPerSec * 15 >= 25) {
                            return 2;
                        }
                        return 2;
                    }
                }, params);

                this.canvases = [];

                this._onScroll = () => {
                    this.wrapper.scrollLeft = this.drawer.wrapper.scrollLeft;
                };
                this._onRedraw = () => this.render();
                this._onReady = () => {
                    this.drawer = wavesurfer.drawer;
                    this.pixelRatio = wavesurfer.drawer.params.pixelRatio;
                    this.maxCanvasWidth = wavesurfer.drawer.maxCanvasWidth || wavesurfer.drawer.width;
                    this.maxCanvasElementWidth = wavesurfer.drawer.maxCanvasElementWidth || Math.round(this.maxCanvasWidth / this.pixelRatio);

                    this.createWrapper();
                    this.render();
                    wavesurfer.drawer.wrapper.addEventListener('scroll', this._onScroll);
                    wavesurfer.on('redraw', this._onRedraw);
                };
            }

            init() {
                this.wavesurfer.on('ready', this._onReady);
                // Check if ws is ready
                if (this.wavesurfer.isReady) {
                    this._onReady();
                }
            }

            destroy() {
                this.unAll();
                this.wavesurfer.un('redraw', this._onRedraw);
                this.wavesurfer.un('ready', this._onReady);
                this.wavesurfer.drawer.wrapper.removeEventListener('scroll', this._onScroll);
                if (this.wrapper && this.wrapper.parentNode) {
                    this.wrapper.parentNode.removeChild(this.wrapper);
                    this.wrapper = null;
                }
            }

            createWrapper() {
                const wsParams = this.wavesurfer.params;
                this.wrapper = this.container.appendChild(
                    document.createElement('timeline')
                );
                this.style(this.wrapper, {
                    display: 'block',
                    position: 'relative',
                    userSelect: 'none',
                    webkitUserSelect: 'none',
                    height: `${this.params.height}px`
                });

                if (wsParams.fillParent || wsParams.scrollParent) {
                    this.style(this.wrapper, {
                        width: '100%',
                        overflowX: 'hidden',
                        overflowY: 'hidden'
                    });
                }

                this._onClick = e => {
                    e.preventDefault();
                    const relX = 'offsetX' in e ? e.offsetX : e.layerX;
                    this.fireEvent('click', (relX / this.wrapper.scrollWidth) || 0);
                };
                this.wrapper.addEventListener('click', this._onClick);
            }

            removeOldCanvases() {
                while (this.canvases.length > 0) {
                    const canvas = this.canvases.pop();
                    canvas.parentElement.removeChild(canvas);
                }
            }

            createCanvases() {
                this.removeOldCanvases();

                const totalWidth = Math.round(this.drawer.wrapper.scrollWidth);
                const requiredCanvases = Math.ceil(totalWidth / this.maxCanvasElementWidth);
                let i;

                for (i = 0; i < requiredCanvases; i++) {
                    const canvas = this.wrapper.appendChild(document.createElement('canvas'));
                    this.canvases.push(canvas);
                    this.style(canvas, {
                        position: 'absolute',
                        zIndex: 4
                    });
                }
            }

            render() {
                this.createCanvases();
                this.updateCanvasStyle();
                this.drawTimeCanvases();
            }

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
                    canvas.height = this.params.height * this.pixelRatio;
                    this.style(canvas, {
                        width: `${canvasWidth}px`,
                        height: `${this.params.height}px`,
                        left: `${i * this.maxCanvasElementWidth}px`
                    });
                }
            }

            drawTimeCanvases() {
                const backend = this.wavesurfer.backend;
                const wsParams = this.wavesurfer.params;
                const duration = this.wavesurfer.backend.getDuration();
                const totalSeconds = parseInt(duration, 10) + 1;
                const width = wsParams.fillParent && !wsParams.scrollParent
                    ? this.drawer.getWidth()
                    : this.drawer.wrapper.scrollWidth * wsParams.pixelRatio;
                const pixelsPerSecond = width / duration;

                const formatTime = this.params.formatTimeCallback;
                // if parameter is function, call the function with
                // pixelsPerSecond, otherwise simply take the value as-is
                const intervalFnOrVal = option => (typeof option === 'function' ? option(pixelsPerSecond) : option);
                const timeInterval = intervalFnOrVal(this.params.timeInterval);
                const primaryLabelInterval = intervalFnOrVal(this.params.primaryLabelInterval);
                const secondaryLabelInterval = intervalFnOrVal(this.params.secondaryLabelInterval);

                let curPixel = 0;
                let curSeconds = 0;

                if (duration <= 0) {
                    return;
                }

                const height1 = this.params.height - 4;
                const height2 = (this.params.height * (this.params.notchPercentHeight / 100)) - 4;
                const fontSize = this.params.fontSize * wsParams.pixelRatio;
                let i;

                for (i = 0; i < totalSeconds / timeInterval; i++) {
                    if (i % primaryLabelInterval == 0) {
                        this.setFillStyles(this.params.primaryColor);
                        this.fillRect(curPixel, 0, 1, height1);
                        this.setFonts(`${fontSize}px ${this.params.fontFamily}`);
                        this.setFillStyles(this.params.primaryFontColor);
                        this.fillText(formatTime(curSeconds), curPixel + 5, height1);
                    } else if (i % secondaryLabelInterval == 0) {
                        this.setFillStyles(this.params.secondaryColor);
                        this.fillRect(curPixel, 0, 1, height1);
                        this.setFonts(`${fontSize}px ${this.params.fontFamily}`);
                        this.setFillStyles(this.params.secondaryFontColor);
                        this.fillText(formatTime(curSeconds), curPixel + 5, height1);
                    } else {
                        this.setFillStyles(this.params.secondaryColor);
                        this.fillRect(curPixel, 0, 1, height2);
                    }

                    curSeconds += timeInterval;
                    curPixel += pixelsPerSecond * timeInterval;
                }
            }

            setFillStyles(fillStyle) {
                this.canvases.forEach(canvas => {
                    canvas.getContext('2d').fillStyle = fillStyle;
                });
            }

            setFonts(font) {
                this.canvases.forEach(canvas => {
                    canvas.getContext('2d').font = font;
                });
            }

            fillRect(x, y, width, height) {
                this.canvases.forEach((canvas, i) => {
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
                });
            }

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
            }
        }
    };
}
