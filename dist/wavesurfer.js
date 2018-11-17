/*!
 * wavesurfer.js 2.0.6 (Tue Aug 28 2018 03:51:27 GMT-0400 (Eastern Daylight Time))
 * https://github.com/katspaugh/wavesurfer.js
 * @license BSD-3-Clause
 */
(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define("WaveSurfer", [], factory);
	else if(typeof exports === 'object')
		exports["WaveSurfer"] = factory();
	else
		root["WaveSurfer"] = factory();
})(window, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./src/wavesurfer.js");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./node_modules/debounce/index.js":
/*!****************************************!*\
  !*** ./node_modules/debounce/index.js ***!
  \****************************************/
/*! no static exports found */
/***/ (function(module, exports) {

/**
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
 * N milliseconds. If `immediate` is passed, trigger the function on the
 * leading edge, instead of the trailing. The function also has a property 'clear' 
 * that is a function which will clear the timer to prevent previously scheduled executions. 
 *
 * @source underscore.js
 * @see http://unscriptable.com/2009/03/20/debouncing-javascript-methods/
 * @param {Function} function to wrap
 * @param {Number} timeout in ms (`100`)
 * @param {Boolean} whether to execute at the beginning (`false`)
 * @api public
 */
function debounce(func, wait, immediate){
  var timeout, args, context, timestamp, result;
  if (null == wait) wait = 100;

  function later() {
    var last = Date.now() - timestamp;

    if (last < wait && last >= 0) {
      timeout = setTimeout(later, wait - last);
    } else {
      timeout = null;
      if (!immediate) {
        result = func.apply(context, args);
        context = args = null;
      }
    }
  };

  var debounced = function(){
    context = this;
    args = arguments;
    timestamp = Date.now();
    var callNow = immediate && !timeout;
    if (!timeout) timeout = setTimeout(later, wait);
    if (callNow) {
      result = func.apply(context, args);
      context = args = null;
    }

    return result;
  };

  debounced.clear = function() {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  
  debounced.flush = function() {
    if (timeout) {
      result = func.apply(context, args);
      context = args = null;
      
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
};

// Adds compatibility for ES modules
debounce.debounce = debounce;

module.exports = debounce;


/***/ }),

/***/ "./src/drawer.js":
/*!***********************!*\
  !*** ./src/drawer.js ***!
  \***********************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _util = __webpack_require__(/*! ./util */ "./src/util/index.js");

var util = _interopRequireWildcard(_util);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Parent class for renderers
 *
 * @extends {Observer}
 */
var Drawer = function (_util$Observer) {
    _inherits(Drawer, _util$Observer);

    /**
     * @param {HTMLElement} container The container node of the wavesurfer instance
     * @param {WavesurferParams} params The wavesurfer initialisation options
     */
    function Drawer(container, params) {
        _classCallCheck(this, Drawer);

        /** @private */
        var _this = _possibleConstructorReturn(this, (Drawer.__proto__ || Object.getPrototypeOf(Drawer)).call(this));

        _this.container = container;
        /**
         * @type {WavesurferParams}
         * @private
         */
        _this.params = params;
        /**
         * The width of the renderer
         * @type {number}
         */
        _this.width = 0;
        /**
         * The height of the renderer
         * @type {number}
         */
        _this.height = params.height * _this.params.pixelRatio;
        /** @private */
        _this.lastPos = 0;
        /**
         * The `<wave>` element which is added to the container
         * @type {HTMLElement}
         */
        _this.wrapper = null;
        return _this;
    }

    /**
     * Alias of `util.style`
     *
     * @param {HTMLElement} el The element that the styles will be applied to
     * @param {Object} styles The map of propName: attribute, both are used as-is
     * @return {HTMLElement} el
     */


    _createClass(Drawer, [{
        key: 'style',
        value: function style(el, styles) {
            return util.style(el, styles);
        }

        /**
         * Create the wrapper `<wave>` element, style it and set up the events for
         * interaction
         */

    }, {
        key: 'createWrapper',
        value: function createWrapper() {
            this.wrapper = this.container.appendChild(document.createElement('wave'));

            this.style(this.wrapper, {
                display: 'block',
                position: 'relative',
                userSelect: 'none',
                webkitUserSelect: 'none',
                height: this.params.height + 'px'
            });

            if (this.params.fillParent || this.params.scrollParent) {
                this.style(this.wrapper, {
                    width: '100%',
                    overflowX: this.params.hideScrollbar ? 'hidden' : 'auto',
                    overflowY: 'hidden'
                });
            }

            this.setupWrapperEvents();
        }

        /**
         * Handle click event
         *
         * @param {Event} e Click event
         * @param {?boolean} noPrevent Set to true to not call `e.preventDefault()`
         * @return {number} Playback position from 0 to 1
         */

    }, {
        key: 'handleEvent',
        value: function handleEvent(e, noPrevent) {
            !noPrevent && e.preventDefault();

            var clientX = e.targetTouches ? e.targetTouches[0].clientX : e.clientX;
            var bbox = this.wrapper.getBoundingClientRect();

            var nominalWidth = this.width;
            var parentWidth = this.getWidth();

            var progress = void 0;

            if (!this.params.fillParent && nominalWidth < parentWidth) {
                progress = (clientX - bbox.left) * (this.params.pixelRatio / nominalWidth) || 0;

                if (progress > 1) {
                    progress = 1;
                }
            } else {
                progress = (clientX - bbox.left + this.wrapper.scrollLeft) / this.wrapper.scrollWidth || 0;
            }

            return progress;
        }

        /**
         * @private
         */

    }, {
        key: 'setupWrapperEvents',
        value: function setupWrapperEvents() {
            var _this2 = this;

            this.wrapper.addEventListener('click', function (e) {
                var scrollbarHeight = _this2.wrapper.offsetHeight - _this2.wrapper.clientHeight;
                if (scrollbarHeight != 0) {
                    // scrollbar is visible.  Check if click was on it
                    var bbox = _this2.wrapper.getBoundingClientRect();
                    if (e.clientY >= bbox.bottom - scrollbarHeight) {
                        // ignore mousedown as it was on the scrollbar
                        return;
                    }
                }

                if (_this2.params.interact) {
                    _this2.fireEvent('click', e, _this2.handleEvent(e));
                }
            });

            this.wrapper.addEventListener('scroll', function (e) {
                return _this2.fireEvent('scroll', e);
            });
        }

        /**
         * Draw peaks on the canvas
         *
         * @param {number[]|number[][]} peaks Can also be an array of arrays for split channel
         * rendering
         * @param {number} length The width of the area that should be drawn
         * @param {number} start The x-offset of the beginning of the area that
         * should be rendered
         * @param {number} end The x-offset of the end of the area that should be
         * rendered
         */

    }, {
        key: 'drawPeaks',
        value: function drawPeaks(peaks, length, start, end) {
            if (!this.setWidth(length)) {
                this.clearWave();
            }

            this.params.barWidth ? this.drawBars(peaks, 0, start, end) : this.drawWave(peaks, 0, start, end);
        }

        /**
         * Scroll to the beginning
         */

    }, {
        key: 'resetScroll',
        value: function resetScroll() {
            if (this.wrapper !== null) {
                this.wrapper.scrollLeft = 0;
            }
        }

        /**
         * Recenter the viewport at a certain percent of the waveform
         *
         * @param {number} percent Value from 0 to 1 on the waveform
         */

    }, {
        key: 'recenter',
        value: function recenter(percent) {
            var position = this.wrapper.scrollWidth * percent;
            this.recenterOnPosition(position, true);
        }

        /**
         * Recenter the viewport on a position, either scroll there immediately or
         * in steps of 5 pixels
         *
         * @param {number} position X-offset in pixels
         * @param {boolean} immediate Set to true to immediately scroll somewhere
         */

    }, {
        key: 'recenterOnPosition',
        value: function recenterOnPosition(position, immediate) {
            var scrollLeft = this.wrapper.scrollLeft;
            var half = ~~(this.wrapper.clientWidth / 2);
            var maxScroll = this.wrapper.scrollWidth - this.wrapper.clientWidth;
            var target = position - half;
            var offset = target - scrollLeft;

            if (maxScroll == 0) {
                // no need to continue if scrollbar is not there
                return;
            }

            // if the cursor is currently visible...
            if (!immediate && -half <= offset && offset < half) {
                // we'll limit the "re-center" rate.
                var rate = 5;
                offset = Math.max(-rate, Math.min(rate, offset));
                target = scrollLeft + offset;
            }

            // limit target to valid range (0 to maxScroll)
            target = Math.max(0, Math.min(maxScroll, target));
            // no use attempting to scroll if we're not moving
            if (target != scrollLeft) {
                this.wrapper.scrollLeft = target;
            }
        }

        /**
         * Get the current scroll position in pixels
         *
         * @return {number}
         */

    }, {
        key: 'getScrollX',
        value: function getScrollX() {
            var pixelRatio = this.params.pixelRatio;
            var x = Math.round(this.wrapper.scrollLeft * pixelRatio);

            // In cases of elastic scroll (safari with mouse wheel) you can
            // scroll beyond the limits of the container
            // Calculate and floor the scrollable extent to make sure an out
            // of bounds value is not returned
            // Ticket #1312
            if (this.params.scrollParent) {
                var maxScroll = ~~(this.wrapper.scrollWidth * pixelRatio - this.getWidth());
                x = Math.min(maxScroll, Math.max(0, x));
            }

            return x;
        }

        /**
         * Get the width of the container
         *
         * @return {number}
         */

    }, {
        key: 'getWidth',
        value: function getWidth() {
            return Math.round(this.container.clientWidth * this.params.pixelRatio);
        }

        /**
         * Set the width of the container
         *
         * @param {number} width
         */

    }, {
        key: 'setWidth',
        value: function setWidth(width) {
            if (this.width == width) {
                return false;
            }

            this.width = width;

            if (this.params.fillParent || this.params.scrollParent) {
                this.style(this.wrapper, {
                    width: ''
                });
            } else {
                this.style(this.wrapper, {
                    width: ~~(this.width / this.params.pixelRatio) + 'px'
                });
            }

            this.updateSize();
            return true;
        }

        /**
         * Set the height of the container
         *
         * @param {number} height
         */

    }, {
        key: 'setHeight',
        value: function setHeight(height) {
            if (height == this.height) {
                return false;
            }
            this.height = height;

            this.style(this.wrapper, {
                height: ~~(this.height / this.params.pixelRatio) + 'px'
            });

            this.updateSize();
            return true;
        }

        /**
         * Called by wavesurfer when progress should be renderered
         *
         * @param {number} progress From 0 to 1
         */

    }, {
        key: 'progress',
        value: function progress(_progress) {
            var minPxDelta = 1 / this.params.pixelRatio;
            var pos = Math.round(_progress * this.width) * minPxDelta;

            if (pos < this.lastPos || pos - this.lastPos >= minPxDelta) {
                this.lastPos = pos;

                if (this.params.scrollParent && this.params.autoCenter) {
                    var newPos = ~~(this.wrapper.scrollWidth * _progress);
                    this.recenterOnPosition(newPos);
                }

                this.updateProgress(pos);
            }
        }

        /**
         * This is called when wavesurfer is destroyed
         */

    }, {
        key: 'destroy',
        value: function destroy() {
            this.unAll();
            if (this.wrapper) {
                if (this.wrapper.parentNode == this.container) {
                    this.container.removeChild(this.wrapper);
                }
                this.wrapper = null;
            }
        }

        /* Renderer-specific methods */

        /**
         * Called after cursor related params have changed.
         *
         * @abstract
         */

    }, {
        key: 'updateCursor',
        value: function updateCursor() {}

        /**
         * Called when the size of the container changes so the renderer can adjust
         *
         * @abstract
         */

    }, {
        key: 'updateSize',
        value: function updateSize() {}

        /**
         * Draw a waveform with bars
         *
         * @abstract
         * @param {number[]|number[][]} peaks Can also be an array of arrays for split channel
         * rendering
         * @param {number} channelIndex The index of the current channel. Normally
         * should be 0
         * @param {number} start The x-offset of the beginning of the area that
         * should be rendered
         * @param {number} end The x-offset of the end of the area that should be
         * rendered
         */

    }, {
        key: 'drawBars',
        value: function drawBars(peaks, channelIndex, start, end) {}

        /**
         * Draw a waveform
         *
         * @abstract
         * @param {number[]|number[][]} peaks Can also be an array of arrays for split channel
         * rendering
         * @param {number} channelIndex The index of the current channel. Normally
         * should be 0
         * @param {number} start The x-offset of the beginning of the area that
         * should be rendered
         * @param {number} end The x-offset of the end of the area that should be
         * rendered
         */

    }, {
        key: 'drawWave',
        value: function drawWave(peaks, channelIndex, start, end) {}

        /**
         * Clear the waveform
         *
         * @abstract
         */

    }, {
        key: 'clearWave',
        value: function clearWave() {}

        /**
         * Render the new progress
         *
         * @abstract
         * @param {number} position X-Offset of progress position in pixels
         */

    }, {
        key: 'updateProgress',
        value: function updateProgress(position) {}
    }]);

    return Drawer;
}(util.Observer);

exports.default = Drawer;
module.exports = exports['default'];

/***/ }),

/***/ "./src/drawer.multicanvas.js":
/*!***********************************!*\
  !*** ./src/drawer.multicanvas.js ***!
  \***********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _drawer = __webpack_require__(/*! ./drawer */ "./src/drawer.js");

var _drawer2 = _interopRequireDefault(_drawer);

var _util = __webpack_require__(/*! ./util */ "./src/util/index.js");

var util = _interopRequireWildcard(_util);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * @typedef {Object} CanvasEntry
 * @private
 * @property {HTMLElement} wave The wave node
 * @property {CanvasRenderingContext2D} waveCtx The canvas rendering context
 * @property {?HTMLElement} progress The progress wave node
 * @property {?CanvasRenderingContext2D} progressCtx The progress wave canvas
 * rendering context
 * @property {?number} start Start of the area the canvas should render, between 0 and 1
 * @property {?number} end End of the area the canvas should render, between 0 and 1
 */

/**
 * MultiCanvas renderer for wavesurfer. Is currently the default and sole built
 * in renderer.
 */
var MultiCanvas = function (_Drawer) {
    _inherits(MultiCanvas, _Drawer);

    /**
     * @param {HTMLElement} container The container node of the wavesurfer instance
     * @param {WavesurferParams} params The wavesurfer initialisation options
     */
    function MultiCanvas(container, params) {
        _classCallCheck(this, MultiCanvas);

        /**
         * @type {number}
         * @private
         */
        var _this = _possibleConstructorReturn(this, (MultiCanvas.__proto__ || Object.getPrototypeOf(MultiCanvas)).call(this, container, params));

        _this.maxCanvasWidth = params.maxCanvasWidth;
        /**
         * @private
         * @type {number}
         */
        _this.maxCanvasElementWidth = Math.round(params.maxCanvasWidth / params.pixelRatio);

        /**
         * Whether or not the progress wave is renderered. If the `waveColor`
         * and `progressColor` are the same colour it is not.
         * @type {boolean}
         */
        _this.hasProgressCanvas = params.waveColor != params.progressColor;
        /**
         * @private
         * @type {number}
         */
        _this.halfPixel = 0.5 / params.pixelRatio;
        /**
         * @private
         * @type {Array}
         */
        _this.canvases = [];
        /** @private */
        _this.progressWave = null;
        return _this;
    }

    /**
     * Initialise the drawer
     */


    _createClass(MultiCanvas, [{
        key: 'init',
        value: function init() {
            this.createWrapper();
            this.createElements();
        }

        /**
         * Create the canvas elements and style them
         *
         * @private
         */

    }, {
        key: 'createElements',
        value: function createElements() {
            this.progressWave = this.wrapper.appendChild(this.style(document.createElement('wave'), {
                position: 'absolute',
                zIndex: 3,
                left: 0,
                top: 0,
                bottom: 0,
                overflow: 'hidden',
                width: '0',
                display: 'none',
                boxSizing: 'border-box',
                borderRightStyle: 'solid',
                pointerEvents: 'none'
            }));

            this.addCanvas();
            this.updateCursor();
        }

        /**
         * Update cursor style from params.
         */

    }, {
        key: 'updateCursor',
        value: function updateCursor() {
            this.style(this.progressWave, {
                borderRightWidth: this.params.cursorWidth + 'px',
                borderRightColor: this.params.cursorColor
            });
        }

        /**
         * Adjust to the updated size by adding or removing canvases
         */

    }, {
        key: 'updateSize',
        value: function updateSize() {
            var _this2 = this;

            var totalWidth = Math.round(this.width / this.params.pixelRatio);
            var requiredCanvases = Math.ceil(totalWidth / this.maxCanvasElementWidth);

            while (this.canvases.length < requiredCanvases) {
                this.addCanvas();
            }

            while (this.canvases.length > requiredCanvases) {
                this.removeCanvas();
            }

            this.canvases.forEach(function (entry, i) {
                // Add some overlap to prevent vertical white stripes, keep the width even for simplicity.
                var canvasWidth = _this2.maxCanvasWidth + 2 * Math.ceil(_this2.params.pixelRatio / 2);

                if (i == _this2.canvases.length - 1) {
                    canvasWidth = _this2.width - _this2.maxCanvasWidth * (_this2.canvases.length - 1);
                }

                _this2.updateDimensions(entry, canvasWidth, _this2.height);
                _this2.clearWaveForEntry(entry);
            });
        }

        /**
         * Add a canvas to the canvas list
         *
         * @private
         */

    }, {
        key: 'addCanvas',
        value: function addCanvas() {
            var entry = {};
            var leftOffset = this.maxCanvasElementWidth * this.canvases.length;

            entry.wave = this.wrapper.appendChild(this.style(document.createElement('canvas'), {
                position: 'absolute',
                zIndex: 2,
                left: leftOffset + 'px',
                top: 0,
                bottom: 0,
                height: '100%',
                pointerEvents: 'none'
            }));
            entry.waveCtx = entry.wave.getContext('2d');

            if (this.hasProgressCanvas) {
                entry.progress = this.progressWave.appendChild(this.style(document.createElement('canvas'), {
                    position: 'absolute',
                    left: leftOffset + 'px',
                    top: 0,
                    bottom: 0,
                    height: '100%'
                }));
                entry.progressCtx = entry.progress.getContext('2d');
            }

            this.canvases.push(entry);
        }

        /**
         * Pop one canvas from the list
         *
         * @private
         */

    }, {
        key: 'removeCanvas',
        value: function removeCanvas() {
            var lastEntry = this.canvases.pop();
            lastEntry.wave.parentElement.removeChild(lastEntry.wave);
            if (this.hasProgressCanvas) {
                lastEntry.progress.parentElement.removeChild(lastEntry.progress);
            }
        }

        /**
         * Update the dimensions of a canvas element
         *
         * @private
         * @param {CanvasEntry} entry
         * @param {number} width The new width of the element
         * @param {number} height The new height of the element
         */

    }, {
        key: 'updateDimensions',
        value: function updateDimensions(entry, width, height) {
            var elementWidth = Math.round(width / this.params.pixelRatio);
            var totalWidth = Math.round(this.width / this.params.pixelRatio);

            // Where the canvas starts and ends in the waveform, represented as a decimal between 0 and 1.
            entry.start = entry.waveCtx.canvas.offsetLeft / totalWidth || 0;
            entry.end = entry.start + elementWidth / totalWidth;

            entry.waveCtx.canvas.width = width;
            entry.waveCtx.canvas.height = height;
            this.style(entry.waveCtx.canvas, { width: elementWidth + 'px' });

            this.style(this.progressWave, { display: 'block' });

            if (this.hasProgressCanvas) {
                entry.progressCtx.canvas.width = width;
                entry.progressCtx.canvas.height = height;
                this.style(entry.progressCtx.canvas, {
                    width: elementWidth + 'px'
                });
            }
        }

        /**
         * Clear the whole waveform
         */

    }, {
        key: 'clearWave',
        value: function clearWave() {
            var _this3 = this;

            this.canvases.forEach(function (entry) {
                return _this3.clearWaveForEntry(entry);
            });
        }

        /**
         * Clear one canvas
         *
         * @private
         * @param {CanvasEntry} entry
         */

    }, {
        key: 'clearWaveForEntry',
        value: function clearWaveForEntry(entry) {
            entry.waveCtx.clearRect(0, 0, entry.waveCtx.canvas.width, entry.waveCtx.canvas.height);
            if (this.hasProgressCanvas) {
                entry.progressCtx.clearRect(0, 0, entry.progressCtx.canvas.width, entry.progressCtx.canvas.height);
            }
        }

        /**
         * Draw a waveform with bars
         *
         * @param {number[]|number[][]} peaks Can also be an array of arrays for split channel
         * rendering
         * @param {number} channelIndex The index of the current channel. Normally
         * should be 0. Must be an integer.
         * @param {number} start The x-offset of the beginning of the area that
         * should be rendered
         * @param {number} end The x-offset of the end of the area that should be
         * rendered
         */

    }, {
        key: 'drawBars',
        value: function drawBars(peaks, channelIndex, start, end) {
            var _this4 = this;

            return this.prepareDraw(peaks, channelIndex, start, end, function (_ref) {
                var absmax = _ref.absmax,
                    hasMinVals = _ref.hasMinVals,
                    height = _ref.height,
                    offsetY = _ref.offsetY,
                    halfH = _ref.halfH,
                    peaks = _ref.peaks;

                // if drawBars was called within ws.empty we don't pass a start and
                // don't want anything to happen
                if (start === undefined) {
                    return;
                }
                // Skip every other value if there are negatives.
                var peakIndexScale = hasMinVals ? 2 : 1;
                var length = peaks.length / peakIndexScale;
                var bar = _this4.params.barWidth * _this4.params.pixelRatio;
                var gap = _this4.params.barGap === null ? Math.max(_this4.params.pixelRatio, ~~(bar / 2)) : Math.max(_this4.params.pixelRatio, _this4.params.barGap * _this4.params.pixelRatio);
                var step = bar + gap;

                var scale = length / _this4.width;
                var first = start;
                var last = end;
                var i = void 0;

                for (i = first; i < last; i += step) {
                    var peak = peaks[Math.floor(i * scale * peakIndexScale)] || 0;
                    var h = Math.round(peak / absmax * halfH);
                    _this4.fillRect(i + _this4.halfPixel, halfH - h + offsetY, bar + _this4.halfPixel, h * 2);
                }
            });
        }

        /**
         * Draw a waveform
         *
         * @param {number[]|number[][]} peaks Can also be an array of arrays for split channel
         * rendering
         * @param {number} channelIndex The index of the current channel. Normally
         * should be 0
         * @param {number?} start The x-offset of the beginning of the area that
         * should be rendered (If this isn't set only a flat line is rendered)
         * @param {number?} end The x-offset of the end of the area that should be
         * rendered
         */

    }, {
        key: 'drawWave',
        value: function drawWave(peaks, channelIndex, start, end) {
            var _this5 = this;

            return this.prepareDraw(peaks, channelIndex, start, end, function (_ref2) {
                var absmax = _ref2.absmax,
                    hasMinVals = _ref2.hasMinVals,
                    height = _ref2.height,
                    offsetY = _ref2.offsetY,
                    halfH = _ref2.halfH,
                    peaks = _ref2.peaks;

                if (!hasMinVals) {
                    var reflectedPeaks = [];
                    var len = peaks.length;
                    var i = void 0;
                    for (i = 0; i < len; i++) {
                        reflectedPeaks[2 * i] = peaks[i];
                        reflectedPeaks[2 * i + 1] = -peaks[i];
                    }
                    peaks = reflectedPeaks;
                }

                // if drawWave was called within ws.empty we don't pass a start and
                // end and simply want a flat line
                if (start !== undefined) {
                    _this5.drawLine(peaks, absmax, halfH, offsetY, start, end);
                }

                // Always draw a median line
                _this5.fillRect(0, halfH + offsetY - _this5.halfPixel, _this5.width, _this5.halfPixel);
            });
        }

        /**
         * Tell the canvas entries to render their portion of the waveform
         *
         * @private
         * @param {number[]} peaks Peak data
         * @param {number} absmax Maximum peak value (absolute)
         * @param {number} halfH Half the height of the waveform
         * @param {number} offsetY Offset to the top
         * @param {number} start The x-offset of the beginning of the area that
         * should be rendered
         * @param {number} end The x-offset of the end of the area that
         * should be rendered
         */

    }, {
        key: 'drawLine',
        value: function drawLine(peaks, absmax, halfH, offsetY, start, end) {
            var _this6 = this;

            this.canvases.forEach(function (entry) {
                _this6.setFillStyles(entry);
                _this6.drawLineToContext(entry, entry.waveCtx, peaks, absmax, halfH, offsetY, start, end);
                _this6.drawLineToContext(entry, entry.progressCtx, peaks, absmax, halfH, offsetY, start, end);
            });
        }

        /**
         * Render the actual waveform line on a canvas
         *
         * @private
         * @param {CanvasEntry} entry
         * @param {Canvas2DContextAttributes} ctx Essentially `entry.[wave|progress]Ctx`
         * @param {number[]} peaks
         * @param {number} absmax Maximum peak value (absolute)
         * @param {number} halfH Half the height of the waveform
         * @param {number} offsetY Offset to the top
         * @param {number} start The x-offset of the beginning of the area that
         * should be rendered
         * @param {number} end The x-offset of the end of the area that
         * should be rendered
         */

    }, {
        key: 'drawLineToContext',
        value: function drawLineToContext(entry, ctx, peaks, absmax, halfH, offsetY, start, end) {
            if (!ctx) {
                return;
            }

            var length = peaks.length / 2;
            var scale = this.params.fillParent && this.width != length ? this.width / length : 1;

            var first = Math.round(length * entry.start);
            // Use one more peak value to make sure we join peaks at ends -- unless,
            // of course, this is the last canvas.
            var last = Math.round(length * entry.end) + 1;
            if (first > end || last < start) {
                return;
            }
            var canvasStart = Math.min(first, start);
            var canvasEnd = Math.max(last, end);
            var i = void 0;
            var j = void 0;

            ctx.beginPath();
            ctx.moveTo((canvasStart - first) * scale + this.halfPixel, halfH + offsetY);

            for (i = canvasStart; i < canvasEnd; i++) {
                var peak = peaks[2 * i] || 0;
                var h = Math.round(peak / absmax * halfH);
                ctx.lineTo((i - first) * scale + this.halfPixel, halfH - h + offsetY);
            }

            // Draw the bottom edge going backwards, to make a single
            // closed hull to fill.
            for (j = canvasEnd - 1; j >= canvasStart; j--) {
                var _peak = peaks[2 * j + 1] || 0;
                var _h = Math.round(_peak / absmax * halfH);
                ctx.lineTo((j - first) * scale + this.halfPixel, halfH - _h + offsetY);
            }

            ctx.closePath();
            ctx.fill();
        }

        /**
         * Draw a rectangle on the waveform
         *
         * @param {number} x
         * @param {number} y
         * @param {number} width
         * @param {number} height
         */

    }, {
        key: 'fillRect',
        value: function fillRect(x, y, width, height) {
            var startCanvas = Math.floor(x / this.maxCanvasWidth);
            var endCanvas = Math.min(Math.ceil((x + width) / this.maxCanvasWidth) + 1, this.canvases.length);
            var i = void 0;
            for (i = startCanvas; i < endCanvas; i++) {
                var entry = this.canvases[i];
                var leftOffset = i * this.maxCanvasWidth;

                var intersection = {
                    x1: Math.max(x, i * this.maxCanvasWidth),
                    y1: y,
                    x2: Math.min(x + width, i * this.maxCanvasWidth + entry.waveCtx.canvas.width),
                    y2: y + height
                };

                if (intersection.x1 < intersection.x2) {
                    this.setFillStyles(entry);

                    this.fillRectToContext(entry.waveCtx, intersection.x1 - leftOffset, intersection.y1, intersection.x2 - intersection.x1, intersection.y2 - intersection.y1);

                    this.fillRectToContext(entry.progressCtx, intersection.x1 - leftOffset, intersection.y1, intersection.x2 - intersection.x1, intersection.y2 - intersection.y1);
                }
            }
        }

        /**
         * Performs preparation tasks and calculations which are shared by drawBars and drawWave
         *
         * @private
         * @param {number[]|number[][]} peaks Can also be an array of arrays for split channel
         * rendering
         * @param {number} channelIndex The index of the current channel. Normally
         * should be 0
         * @param {number?} start The x-offset of the beginning of the area that
         * should be rendered (If this isn't set only a flat line is rendered)
         * @param {number?} end The x-offset of the end of the area that should be
         * rendered
         * @param {function} fn The render function to call
         */

    }, {
        key: 'prepareDraw',
        value: function prepareDraw(peaks, channelIndex, start, end, fn) {
            var _this7 = this;

            return util.frame(function () {
                // Split channels and call this function with the channelIndex set
                if (peaks[0] instanceof Array) {
                    var channels = peaks;
                    if (_this7.params.splitChannels) {
                        _this7.setHeight(channels.length * _this7.params.height * _this7.params.pixelRatio);
                        return channels.forEach(function (channelPeaks, i) {
                            return _this7.prepareDraw(channelPeaks, i, start, end, fn);
                        });
                    }
                    peaks = channels[0];
                }
                // calculate maximum modulation value, either from the barHeight
                // parameter or if normalize=true from the largest value in the peak
                // set
                var absmax = 1 / _this7.params.barHeight;
                if (_this7.params.normalize) {
                    var max = util.max(peaks);
                    var min = util.min(peaks);
                    absmax = -min > max ? -min : max;
                }

                // Bar wave draws the bottom only as a reflection of the top,
                // so we don't need negative values
                var hasMinVals = [].some.call(peaks, function (val) {
                    return val < 0;
                });
                var height = _this7.params.height * _this7.params.pixelRatio;
                var offsetY = height * channelIndex || 0;
                var halfH = height / 2;

                return fn({
                    absmax: absmax,
                    hasMinVals: hasMinVals,
                    height: height,
                    offsetY: offsetY,
                    halfH: halfH,
                    peaks: peaks
                });
            })();
        }

        /**
         * Draw the actual rectangle on a canvas
         *
         * @private
         * @param {Canvas2DContextAttributes} ctx
         * @param {number} x
         * @param {number} y
         * @param {number} width
         * @param {number} height
         */

    }, {
        key: 'fillRectToContext',
        value: function fillRectToContext(ctx, x, y, width, height) {
            if (!ctx) {
                return;
            }
            ctx.fillRect(x, y, width, height);
        }

        /**
         * Set the fill styles for a certain entry (wave and progress)
         *
         * @private
         * @param {CanvasEntry} entry
         */

    }, {
        key: 'setFillStyles',
        value: function setFillStyles(entry) {
            entry.waveCtx.fillStyle = this.params.waveColor;
            if (this.hasProgressCanvas) {
                entry.progressCtx.fillStyle = this.params.progressColor;
            }
        }

        /**
         * Return image data of the waveform
         *
         * @param {string} type='image/png' An optional value of a format type.
         * @param {number} quality=0.92 An optional value between 0 and 1.
         * @return {string|string[]} images A data URL or an array of data URLs
         */

    }, {
        key: 'getImage',
        value: function getImage(type, quality) {
            var images = this.canvases.map(function (entry) {
                return entry.wave.toDataURL(type, quality);
            });
            return images.length > 1 ? images : images[0];
        }

        /**
         * Render the new progress
         *
         * @param {number} position X-Offset of progress position in pixels
         */

    }, {
        key: 'updateProgress',
        value: function updateProgress(position) {
            this.style(this.progressWave, { width: position + 'px' });
        }
    }]);

    return MultiCanvas;
}(_drawer2.default);

exports.default = MultiCanvas;
module.exports = exports['default'];

/***/ }),

/***/ "./src/mediaelement.js":
/*!*****************************!*\
  !*** ./src/mediaelement.js ***!
  \*****************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _webaudio = __webpack_require__(/*! ./webaudio */ "./src/webaudio.js");

var _webaudio2 = _interopRequireDefault(_webaudio);

var _util = __webpack_require__(/*! ./util */ "./src/util/index.js");

var util = _interopRequireWildcard(_util);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * MediaElement backend
 */
var MediaElement = function (_WebAudio) {
    _inherits(MediaElement, _WebAudio);

    /**
     * Construct the backend
     *
     * @param {WavesurferParams} params
     */
    function MediaElement(params) {
        _classCallCheck(this, MediaElement);

        /** @private */
        var _this = _possibleConstructorReturn(this, (MediaElement.__proto__ || Object.getPrototypeOf(MediaElement)).call(this, params));

        _this.params = params;

        // Dummy media to catch errors
        /** @private */
        _this.media = {
            currentTime: 0,
            duration: 0,
            paused: true,
            playbackRate: 1,
            play: function play() {},
            pause: function pause() {},

            volume: 0
        };

        /** @private */
        _this.mediaType = params.mediaType.toLowerCase();
        /** @private */
        _this.elementPosition = params.elementPosition;
        /** @private */
        _this.peaks = null;
        /** @private */
        _this.playbackRate = 1;
        /** @private */
        _this.volume = 1;
        /** @private */
        _this.buffer = null;
        /** @private */
        _this.onPlayEnd = null;
        return _this;
    }

    /**
     * Initialise the backend, called in `wavesurfer.createBackend()`
     */


    _createClass(MediaElement, [{
        key: 'init',
        value: function init() {
            this.setPlaybackRate(this.params.audioRate);
            this.createTimer();
        }

        /**
         * Create a timer to provide a more precise `audioprocess` event.
         *
         * @private
         */

    }, {
        key: 'createTimer',
        value: function createTimer() {
            var _this2 = this;

            var onAudioProcess = function onAudioProcess() {
                if (_this2.isPaused()) {
                    return;
                }
                _this2.fireEvent('audioprocess', _this2.getCurrentTime());

                // Call again in the next frame
                var requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame;
                requestAnimationFrame(onAudioProcess);
            };

            this.on('play', onAudioProcess);

            // Update the progress one more time to prevent it from being stuck in case of lower framerates
            this.on('pause', function () {
                _this2.fireEvent('audioprocess', _this2.getCurrentTime());
            });
        }

        /**
         * Create media element with url as its source,
         * and append to container element.
         *
         * @param {string} url Path to media file
         * @param {HTMLElement} container HTML element
         * @param {number[]|number[][]} peaks Array of peak data
         * @param {string} preload HTML 5 preload attribute value
         */

    }, {
        key: 'load',
        value: function load(url, container, peaks, preload) {
            var media = document.createElement(this.mediaType);
            media.controls = this.params.mediaControls;
            media.autoplay = this.params.autoplay || false;
            media.preload = preload == null ? 'auto' : preload;
            media.src = url;
            media.style.width = '100%';

            var prevMedia = container.querySelector(this.mediaType);
            if (prevMedia) {
                container.removeChild(prevMedia);
            }
            container.appendChild(media);

            this._load(media, peaks);
        }

        /**
         * Load existing media element.
         *
         * @param {HTMLMediaElement} elt HTML5 Audio or Video element
         * @param {number[]|number[][]} peaks Array of peak data
         */

    }, {
        key: 'loadElt',
        value: function loadElt(elt, peaks) {
            elt.controls = this.params.mediaControls;
            elt.autoplay = this.params.autoplay || false;

            this._load(elt, peaks);
        }

        /**
         * Private method called by both load (from url)
         * and loadElt (existing media element).
         *
         * @param {HTMLMediaElement} media HTML5 Audio or Video element
         * @param {number[]|number[][]} peaks Array of peak data
         * @private
         */

    }, {
        key: '_load',
        value: function _load(media, peaks) {
            var _this3 = this;

            // load must be called manually on iOS, otherwise peaks won't draw
            // until a user interaction triggers load --> 'ready' event
            if (typeof media.load == 'function') {
                // Resets the media element and restarts the media resource. Any
                // pending events are discarded. How much media data is fetched is
                // still affected by the preload attribute.
                media.load();
            }

            media.addEventListener('error', function () {
                _this3.fireEvent('error', 'Error loading media element');
            });

            media.addEventListener('canplay', function () {
                _this3.fireEvent('canplay');
            });

            media.addEventListener('ended', function () {
                _this3.fireEvent('finish');
            });

            // Listen to and relay play and pause events to enable
            // playback control from the external media element
            media.addEventListener('play', function () {
                _this3.fireEvent('play');
            });

            media.addEventListener('pause', function () {
                _this3.fireEvent('pause');
            });

            this.media = media;
            this.peaks = peaks;
            this.onPlayEnd = null;
            this.buffer = null;
            this.setPlaybackRate(this.playbackRate);
            this.setVolume(this.volume);
        }

        /**
         * Used by `wavesurfer.isPlaying()` and `wavesurfer.playPause()`
         *
         * @return {boolean}
         */

    }, {
        key: 'isPaused',
        value: function isPaused() {
            return !this.media || this.media.paused;
        }

        /**
         * Used by `wavesurfer.getDuration()`
         *
         * @return {number}
         */

    }, {
        key: 'getDuration',
        value: function getDuration() {
            if (this.explicitDuration) {
                return this.explicitDuration;
            }
            var duration = (this.buffer || this.media).duration;
            if (duration >= Infinity) {
                // streaming audio
                duration = this.media.seekable.end(0);
            }
            return duration;
        }

        /**
         * Returns the current time in seconds relative to the audioclip's
         * duration.
         *
         * @return {number}
         */

    }, {
        key: 'getCurrentTime',
        value: function getCurrentTime() {
            return this.media && this.media.currentTime;
        }

        /**
         * Get the position from 0 to 1
         *
         * @return {number}
         */

    }, {
        key: 'getPlayedPercents',
        value: function getPlayedPercents() {
            return this.getCurrentTime() / this.getDuration() || 0;
        }

        /**
         * Get the audio source playback rate.
         *
         * @return {number}
         */

    }, {
        key: 'getPlaybackRate',
        value: function getPlaybackRate() {
            return this.playbackRate || this.media.playbackRate;
        }

        /**
         * Set the audio source playback rate.
         *
         * @param {number} value
         */

    }, {
        key: 'setPlaybackRate',
        value: function setPlaybackRate(value) {
            this.playbackRate = value || 1;
            this.media.playbackRate = this.playbackRate;
        }

        /**
         * Used by `wavesurfer.seekTo()`
         *
         * @param {number} start Position to start at in seconds
         */

    }, {
        key: 'seekTo',
        value: function seekTo(start) {
            if (start != null) {
                this.media.currentTime = start;
            }
            this.clearPlayEnd();
        }

        /**
         * Plays the loaded audio region.
         *
         * @param {number} start Start offset in seconds, relative to the beginning
         * of a clip.
         * @param {number} end When to stop, relative to the beginning of a clip.
         * @emits MediaElement#play
         * @return {Promise}
         */

    }, {
        key: 'play',
        value: function play(start, end) {
            this.seekTo(start);
            var promise = this.media.play();
            end && this.setPlayEnd(end);

            return promise;
        }

        /**
         * Pauses the loaded audio.
         *
         * @emits MediaElement#pause
         * @return {Promise}
         */

    }, {
        key: 'pause',
        value: function pause() {
            var promise = void 0;

            if (this.media) {
                promise = this.media.pause();
            }
            this.clearPlayEnd();

            return promise;
        }

        /** @private */

    }, {
        key: 'setPlayEnd',
        value: function setPlayEnd(end) {
            var _this4 = this;

            this._onPlayEnd = function (time) {
                if (time >= end) {
                    _this4.pause();
                    _this4.seekTo(end);
                }
            };
            this.on('audioprocess', this._onPlayEnd);
        }

        /** @private */

    }, {
        key: 'clearPlayEnd',
        value: function clearPlayEnd() {
            if (this._onPlayEnd) {
                this.un('audioprocess', this._onPlayEnd);
                this._onPlayEnd = null;
            }
        }

        /**
         * Compute the max and min value of the waveform when broken into
         * <length> subranges.
         *
         * @param {number} length How many subranges to break the waveform into.
         * @param {number} first First sample in the required range.
         * @param {number} last Last sample in the required range.
         * @return {number[]|number[][]} Array of 2*<length> peaks or array of
         * arrays of peaks consisting of (max, min) values for each subrange.
         */

    }, {
        key: 'getPeaks',
        value: function getPeaks(length, first, last) {
            if (this.buffer) {
                return _get(MediaElement.prototype.__proto__ || Object.getPrototypeOf(MediaElement.prototype), 'getPeaks', this).call(this, length, first, last);
            }
            return this.peaks || [];
        }

        /**
         * Set the sink id for the media player
         *
         * @param {string} deviceId String value representing audio device id.
         */

    }, {
        key: 'setSinkId',
        value: function setSinkId(deviceId) {
            if (deviceId) {
                if (!this.media.setSinkId) {
                    return Promise.reject(new Error('setSinkId is not supported in your browser'));
                }
                return this.media.setSinkId(deviceId);
            }

            return Promise.reject(new Error('Invalid deviceId: ' + deviceId));
        }

        /**
         * Get the current volume
         *
         * @return {number} value A floating point value between 0 and 1.
         */

    }, {
        key: 'getVolume',
        value: function getVolume() {
            return this.volume || this.media.volume;
        }

        /**
         * Set the audio volume
         *
         * @param {number} value A floating point value between 0 and 1.
         */

    }, {
        key: 'setVolume',
        value: function setVolume(value) {
            this.volume = value;
            this.media.volume = this.volume;
        }

        /**
         * This is called when wavesurfer is destroyed
         *
         */

    }, {
        key: 'destroy',
        value: function destroy() {
            this.pause();
            this.unAll();

            if (this.params.removeMediaElementOnDestroy && this.media && this.media.parentNode) {
                this.media.parentNode.removeChild(this.media);
            }

            this.media = null;
        }
    }]);

    return MediaElement;
}(_webaudio2.default);

exports.default = MediaElement;
module.exports = exports['default'];

/***/ }),

/***/ "./src/peakcache.js":
/*!**************************!*\
  !*** ./src/peakcache.js ***!
  \**************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Caches the decoded peaks data to improve rendering speed for lage audio
 *
 * Is used if the option parameter `partialRender` is set to `true`
 */
var PeakCache = function () {
    /**
     * Instantiate cache
     */
    function PeakCache() {
        _classCallCheck(this, PeakCache);

        this.clearPeakCache();
    }

    /**
     * Empty the cache
     */


    _createClass(PeakCache, [{
        key: "clearPeakCache",
        value: function clearPeakCache() {
            /**
             * Flat array with entries that are always in pairs to mark the
             * beginning and end of each subrange.  This is a convenience so we can
             * iterate over the pairs for easy set difference operations.
             * @private
             */
            this.peakCacheRanges = [];
            /**
             * Length of the entire cachable region, used for resetting the cache
             * when this changes (zoom events, for instance).
             * @private
             */
            this.peakCacheLength = -1;
        }

        /**
         * Add a range of peaks to the cache
         *
         * @param {number} length The length of the range
         * @param {number} start The x offset of the start of the range
         * @param {number} end The x offset of the end of the range
         * @return {number[][]}
         */

    }, {
        key: "addRangeToPeakCache",
        value: function addRangeToPeakCache(length, start, end) {
            if (length != this.peakCacheLength) {
                this.clearPeakCache();
                this.peakCacheLength = length;
            }

            // Return ranges that weren't in the cache before the call.
            var uncachedRanges = [];
            var i = 0;
            // Skip ranges before the current start.
            while (i < this.peakCacheRanges.length && this.peakCacheRanges[i] < start) {
                i++;
            }
            // If |i| is even, |start| falls after an existing range.  Otherwise,
            // |start| falls between an existing range, and the uncached region
            // starts when we encounter the next node in |peakCacheRanges| or
            // |end|, whichever comes first.
            if (i % 2 == 0) {
                uncachedRanges.push(start);
            }
            while (i < this.peakCacheRanges.length && this.peakCacheRanges[i] <= end) {
                uncachedRanges.push(this.peakCacheRanges[i]);
                i++;
            }
            // If |i| is even, |end| is after all existing ranges.
            if (i % 2 == 0) {
                uncachedRanges.push(end);
            }

            // Filter out the 0-length ranges.
            uncachedRanges = uncachedRanges.filter(function (item, pos, arr) {
                if (pos == 0) {
                    return item != arr[pos + 1];
                } else if (pos == arr.length - 1) {
                    return item != arr[pos - 1];
                }
                return item != arr[pos - 1] && item != arr[pos + 1];
            });

            // Merge the two ranges together, uncachedRanges will either contain
            // wholly new points, or duplicates of points in peakCacheRanges.  If
            // duplicates are detected, remove both and extend the range.
            this.peakCacheRanges = this.peakCacheRanges.concat(uncachedRanges);
            this.peakCacheRanges = this.peakCacheRanges.sort(function (a, b) {
                return a - b;
            }).filter(function (item, pos, arr) {
                if (pos == 0) {
                    return item != arr[pos + 1];
                } else if (pos == arr.length - 1) {
                    return item != arr[pos - 1];
                }
                return item != arr[pos - 1] && item != arr[pos + 1];
            });

            // Push the uncached ranges into an array of arrays for ease of
            // iteration in the functions that call this.
            var uncachedRangePairs = [];
            for (i = 0; i < uncachedRanges.length; i += 2) {
                uncachedRangePairs.push([uncachedRanges[i], uncachedRanges[i + 1]]);
            }

            return uncachedRangePairs;
        }

        /**
         * For testing
         *
         * @return {number[][]}
         */

    }, {
        key: "getCacheRanges",
        value: function getCacheRanges() {
            var peakCacheRangePairs = [];
            var i = void 0;
            for (i = 0; i < this.peakCacheRanges.length; i += 2) {
                peakCacheRangePairs.push([this.peakCacheRanges[i], this.peakCacheRanges[i + 1]]);
            }
            return peakCacheRangePairs;
        }
    }]);

    return PeakCache;
}();

exports.default = PeakCache;
module.exports = exports["default"];

/***/ }),

/***/ "./src/util/ajax.js":
/*!**************************!*\
  !*** ./src/util/ajax.js ***!
  \**************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = ajax;

var _observer = __webpack_require__(/*! ./observer */ "./src/util/observer.js");

var _observer2 = _interopRequireDefault(_observer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Perform an ajax request
 *
 * @param {Options} options Description
 *
 * @returns {Object} Observer instance
 */
function ajax(options) {
    var instance = new _observer2.default();
    var xhr = new XMLHttpRequest();
    var fired100 = false;
    xhr.open(options.method || 'GET', options.url, true);
    xhr.responseType = options.responseType || 'json';

    if (options.xhr) {
        if (options.xhr.requestHeaders) {
            // add custom request headers
            options.xhr.requestHeaders.forEach(function (header) {
                xhr.setRequestHeader(header.key, header.value);
            });
        }
        if (options.xhr.withCredentials) {
            // use credentials
            xhr.withCredentials = true;
        }
    }

    xhr.addEventListener('progress', function (e) {
        instance.fireEvent('progress', e);
        if (e.lengthComputable && e.loaded == e.total) {
            fired100 = true;
        }
    });
    xhr.addEventListener('load', function (e) {
        if (!fired100) {
            instance.fireEvent('progress', e);
        }
        instance.fireEvent('load', e);
        if (200 == xhr.status || 206 == xhr.status) {
            instance.fireEvent('success', xhr.response, e);
        } else {
            instance.fireEvent('error', e);
        }
    });
    xhr.addEventListener('error', function (e) {
        return instance.fireEvent('error', e);
    });
    xhr.send();
    instance.xhr = xhr;
    return instance;
}
module.exports = exports['default'];

/***/ }),

/***/ "./src/util/extend.js":
/*!****************************!*\
  !*** ./src/util/extend.js ***!
  \****************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = extend;
/**
 * Extend an object shallowly with others
 *
 * @param {Object} dest The target object
 * @param {Object[]} sources The objects to use for extending
 *
 * @return {Object} Merged object
 */
function extend(dest) {
    for (var _len = arguments.length, sources = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        sources[_key - 1] = arguments[_key];
    }

    sources.forEach(function (source) {
        Object.keys(source).forEach(function (key) {
            dest[key] = source[key];
        });
    });
    return dest;
}
module.exports = exports["default"];

/***/ }),

/***/ "./src/util/frame.js":
/*!***************************!*\
  !*** ./src/util/frame.js ***!
  \***************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = frame;

var _requestAnimationFrame = __webpack_require__(/*! ./request-animation-frame */ "./src/util/request-animation-frame.js");

var _requestAnimationFrame2 = _interopRequireDefault(_requestAnimationFrame);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Create a function which will be called at the next requestAnimationFrame
 * cycle
 *
 * @param {function} func The function to call
 *
 * @return {func} The function wrapped within a requestAnimationFrame
 */
function frame(func) {
  return function () {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return (0, _requestAnimationFrame2.default)(function () {
      return func.apply(undefined, args);
    });
  };
}
module.exports = exports['default'];

/***/ }),

/***/ "./src/util/get-id.js":
/*!****************************!*\
  !*** ./src/util/get-id.js ***!
  \****************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = getId;
/**
 * Get a random prefixed ID
 *
 * @returns {String} Random ID
 */
function getId() {
    return 'wavesurfer_' + Math.random().toString(32).substring(2);
}
module.exports = exports['default'];

/***/ }),

/***/ "./src/util/index.js":
/*!***************************!*\
  !*** ./src/util/index.js ***!
  \***************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _ajax = __webpack_require__(/*! ./ajax */ "./src/util/ajax.js");

Object.defineProperty(exports, 'ajax', {
  enumerable: true,
  get: function get() {
    return _interopRequireDefault(_ajax).default;
  }
});

var _getId = __webpack_require__(/*! ./get-id */ "./src/util/get-id.js");

Object.defineProperty(exports, 'getId', {
  enumerable: true,
  get: function get() {
    return _interopRequireDefault(_getId).default;
  }
});

var _max = __webpack_require__(/*! ./max */ "./src/util/max.js");

Object.defineProperty(exports, 'max', {
  enumerable: true,
  get: function get() {
    return _interopRequireDefault(_max).default;
  }
});

var _min = __webpack_require__(/*! ./min */ "./src/util/min.js");

Object.defineProperty(exports, 'min', {
  enumerable: true,
  get: function get() {
    return _interopRequireDefault(_min).default;
  }
});

var _observer = __webpack_require__(/*! ./observer */ "./src/util/observer.js");

Object.defineProperty(exports, 'Observer', {
  enumerable: true,
  get: function get() {
    return _interopRequireDefault(_observer).default;
  }
});

var _extend = __webpack_require__(/*! ./extend */ "./src/util/extend.js");

Object.defineProperty(exports, 'extend', {
  enumerable: true,
  get: function get() {
    return _interopRequireDefault(_extend).default;
  }
});

var _style = __webpack_require__(/*! ./style */ "./src/util/style.js");

Object.defineProperty(exports, 'style', {
  enumerable: true,
  get: function get() {
    return _interopRequireDefault(_style).default;
  }
});

var _requestAnimationFrame = __webpack_require__(/*! ./request-animation-frame */ "./src/util/request-animation-frame.js");

Object.defineProperty(exports, 'requestAnimationFrame', {
  enumerable: true,
  get: function get() {
    return _interopRequireDefault(_requestAnimationFrame).default;
  }
});

var _frame = __webpack_require__(/*! ./frame */ "./src/util/frame.js");

Object.defineProperty(exports, 'frame', {
  enumerable: true,
  get: function get() {
    return _interopRequireDefault(_frame).default;
  }
});

var _debounce = __webpack_require__(/*! debounce */ "./node_modules/debounce/index.js");

Object.defineProperty(exports, 'debounce', {
  enumerable: true,
  get: function get() {
    return _interopRequireDefault(_debounce).default;
  }
});

var _preventClick = __webpack_require__(/*! ./prevent-click */ "./src/util/prevent-click.js");

Object.defineProperty(exports, 'preventClick', {
  enumerable: true,
  get: function get() {
    return _interopRequireDefault(_preventClick).default;
  }
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/***/ }),

/***/ "./src/util/max.js":
/*!*************************!*\
  !*** ./src/util/max.js ***!
  \*************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = max;
/**
 * Get the largest value
 *
 * @param   {Array} values Array of numbers
 * @returns {Number} Largest number found
 */
function max(values) {
    var largest = -Infinity;
    Object.keys(values).forEach(function (i) {
        if (values[i] > largest) {
            largest = values[i];
        }
    });
    return largest;
}
module.exports = exports["default"];

/***/ }),

/***/ "./src/util/min.js":
/*!*************************!*\
  !*** ./src/util/min.js ***!
  \*************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = min;
/**
 * Get the smallest value
 *
 * @param   {Array} values Array of numbers
 * @returns {Number}       Smallest number found
 */
function min(values) {
    var smallest = Number(Infinity);
    Object.keys(values).forEach(function (i) {
        if (values[i] < smallest) {
            smallest = values[i];
        }
    });
    return smallest;
}
module.exports = exports["default"];

/***/ }),

/***/ "./src/util/observer.js":
/*!******************************!*\
  !*** ./src/util/observer.js ***!
  \******************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * @typedef {Object} ListenerDescriptor
 * @property {string} name The name of the event
 * @property {function} callback The callback
 * @property {function} un The function to call to remove the listener
 */

/**
 * Observer class
 */
var Observer = function () {
    /**
     * Instantiate Observer
     */
    function Observer() {
        _classCallCheck(this, Observer);

        /**
         * @private
         * @todo Initialise the handlers here already and remove the conditional
         * assignment in `on()`
         */
        this.handlers = null;
    }
    /**
     * Attach a handler function for an event.
     *
     * @param {string} event Name of the event to listen to
     * @param {function} fn The callback to trigger when the event is fired
     * @return {ListenerDescriptor}
     */


    _createClass(Observer, [{
        key: "on",
        value: function on(event, fn) {
            var _this = this;

            if (!this.handlers) {
                this.handlers = {};
            }

            var handlers = this.handlers[event];
            if (!handlers) {
                handlers = this.handlers[event] = [];
            }
            handlers.push(fn);

            // Return an event descriptor
            return {
                name: event,
                callback: fn,
                un: function un(e, fn) {
                    return _this.un(e, fn);
                }
            };
        }

        /**
         * Remove an event handler.
         *
         * @param {string} event Name of the event the listener that should be
         * removed listens to
         * @param {function} fn The callback that should be removed
         */

    }, {
        key: "un",
        value: function un(event, fn) {
            if (!this.handlers) {
                return;
            }

            var handlers = this.handlers[event];
            var i = void 0;
            if (handlers) {
                if (fn) {
                    for (i = handlers.length - 1; i >= 0; i--) {
                        if (handlers[i] == fn) {
                            handlers.splice(i, 1);
                        }
                    }
                } else {
                    handlers.length = 0;
                }
            }
        }

        /**
         * Remove all event handlers.
         */

    }, {
        key: "unAll",
        value: function unAll() {
            this.handlers = null;
        }

        /**
         * Attach a handler to an event. The handler is executed at most once per
         * event type.
         *
         * @param {string} event The event to listen to
         * @param {function} handler The callback that is only to be called once
         * @return {ListenerDescriptor}
         */

    }, {
        key: "once",
        value: function once(event, handler) {
            var _this2 = this;

            var fn = function fn() {
                for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                    args[_key] = arguments[_key];
                }

                /*  eslint-disable no-invalid-this */
                handler.apply(_this2, args);
                /*  eslint-enable no-invalid-this */
                setTimeout(function () {
                    _this2.un(event, fn);
                }, 0);
            };
            return this.on(event, fn);
        }

        /**
         * Manually fire an event
         *
         * @param {string} event The event to fire manually
         * @param {...any} args The arguments with which to call the listeners
         */

    }, {
        key: "fireEvent",
        value: function fireEvent(event) {
            for (var _len2 = arguments.length, args = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
                args[_key2 - 1] = arguments[_key2];
            }

            if (!this.handlers) {
                return;
            }
            var handlers = this.handlers[event];
            handlers && handlers.forEach(function (fn) {
                fn.apply(undefined, args);
            });
        }
    }]);

    return Observer;
}();

exports.default = Observer;
module.exports = exports["default"];

/***/ }),

/***/ "./src/util/prevent-click.js":
/*!***********************************!*\
  !*** ./src/util/prevent-click.js ***!
  \***********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = preventClick;
function preventClickHandler(e) {
    e.stopPropagation();
    document.body.removeEventListener('click', preventClickHandler, true);
}

function preventClick(values) {
    document.body.addEventListener('click', preventClickHandler, true);
}
module.exports = exports['default'];

/***/ }),

/***/ "./src/util/request-animation-frame.js":
/*!*********************************************!*\
  !*** ./src/util/request-animation-frame.js ***!
  \*********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});

/**
 * Returns the requestAnimationFrame function for the browser, or a shim with
 * setTimeout if none is found
 *
 * @return {function}
 */
exports.default = (window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function (callback, element) {
    return setTimeout(callback, 1000 / 60);
}).bind(window);

module.exports = exports["default"];

/***/ }),

/***/ "./src/util/style.js":
/*!***************************!*\
  !*** ./src/util/style.js ***!
  \***************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = style;
/**
 * Apply a map of styles to an element
 *
 * @param {HTMLElement} el The element that the styles will be applied to
 * @param {Object} styles The map of propName: attribute, both are used as-is
 *
 * @return {HTMLElement} el
 */
function style(el, styles) {
    Object.keys(styles).forEach(function (prop) {
        if (el.style[prop] !== styles[prop]) {
            el.style[prop] = styles[prop];
        }
    });
    return el;
}
module.exports = exports["default"];

/***/ }),

/***/ "./src/wavesurfer.js":
/*!***************************!*\
  !*** ./src/wavesurfer.js ***!
  \***************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _util = __webpack_require__(/*! ./util */ "./src/util/index.js");

var util = _interopRequireWildcard(_util);

var _drawer = __webpack_require__(/*! ./drawer.multicanvas */ "./src/drawer.multicanvas.js");

var _drawer2 = _interopRequireDefault(_drawer);

var _webaudio = __webpack_require__(/*! ./webaudio */ "./src/webaudio.js");

var _webaudio2 = _interopRequireDefault(_webaudio);

var _mediaelement = __webpack_require__(/*! ./mediaelement */ "./src/mediaelement.js");

var _mediaelement2 = _interopRequireDefault(_mediaelement);

var _peakcache = __webpack_require__(/*! ./peakcache */ "./src/peakcache.js");

var _peakcache2 = _interopRequireDefault(_peakcache);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
 * This work is licensed under a BSD-3-Clause License.
 */

/** @external {HTMLElement} https://developer.mozilla.org/en/docs/Web/API/HTMLElement */
/** @external {OfflineAudioContext} https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext */
/** @external {File} https://developer.mozilla.org/en-US/docs/Web/API/File */
/** @external {Blob} https://developer.mozilla.org/en-US/docs/Web/API/Blob */
/** @external {CanvasRenderingContext2D} https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D */
/** @external {MediaStreamConstraints} https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamConstraints */
/** @external {AudioNode} https://developer.mozilla.org/de/docs/Web/API/AudioNode */

/**
 * @typedef {Object} WavesurferParams
 * @property {AudioContext} audioContext=null Use your own previously
 * initialized AudioContext or leave blank.
 * @property {number} audioRate=1 Speed at which to play audio. Lower number is
 * slower.
 * @property {ScriptProcessorNode} audioScriptProcessor=null Use your own previously
 * initialized ScriptProcessorNode or leave blank.
 * @property {boolean} autoCenter=true If a scrollbar is present, center the
 * waveform around the progress
 * @property {string} backend='WebAudio' `'WebAudio'|'MediaElement'` In most cases
 * you don't have to set this manually. MediaElement is a fallback for
 * unsupported browsers.
 * @property {number} barHeight=1 The height of the wave
 * @property {number} barGap=null The optional spacing between bars of the wave,
 * if not provided will be calculated in legacy format.
 * @property {boolean} closeAudioContext=false Close and nullify all audio
 * contexts when the destroy method is called.
 * @property {!string|HTMLElement} container CSS selector or HTML element where
 * the waveform should be drawn. This is the only required parameter.
 * @property {string} cursorColor='#333' The fill color of the cursor indicating
 * the playhead position.
 * @property {number} cursorWidth=1 Measured in pixels.
 * @property {boolean} fillParent=true Whether to fill the entire container or
 * draw only according to `minPxPerSec`.
 * @property {boolean} forceDecode=false Force decoding of audio using web audio
 * when zooming to get a more detailed waveform.
 * @property {number} height=128 The height of the waveform. Measured in
 * pixels.
 * @property {boolean} hideScrollbar=false Whether to hide the horizontal
 * scrollbar when one would normally be shown.
 * @property {boolean} interact=true Whether the mouse interaction will be
 * enabled at initialization. You can switch this parameter at any time later
 * on.
 * @property {boolean} loopSelection=true (Use with regions plugin) Enable
 * looping of selected regions
 * @property {number} maxCanvasWidth=4000 Maximum width of a single canvas in
 * pixels, excluding a small overlap (2 * `pixelRatio`, rounded up to the next
 * even integer). If the waveform is longer than this value, additional canvases
 * will be used to render the waveform, which is useful for very large waveforms
 * that may be too wide for browsers to draw on a single canvas.
 * @property {boolean} mediaControls=false (Use with backend `MediaElement`)
 * this enables the native controls for the media element
 * @property {string} mediaType='audio' (Use with backend `MediaElement`)
 * `'audio'|'video'`
 * @property {number} minPxPerSec=20 Minimum number of pixels per second of
 * audio.
 * @property {boolean} normalize=false If true, normalize by the maximum peak
 * instead of 1.0.
 * @property {boolean} partialRender=false Use the PeakCache to improve
 * rendering speed of large waveforms
 * @property {number} pixelRatio=window.devicePixelRatio The pixel ratio used to
 * calculate display
 * @property {PluginDefinition[]} plugins=[] An array of plugin definitions to
 * register during instantiation, they will be directly initialised unless they
 * are added with the `deferInit` property set to true.
 * @property {string} progressColor='#555' The fill color of the part of the
 * waveform behind the cursor.
 * @property {boolean} removeMediaElementOnDestroy=true Set to false to keep the
 * media element in the DOM when the player is destroyed. This is useful when
 * reusing an existing media element via the `loadMediaElement` method.
 * @property {Object} renderer=MultiCanvas Can be used to inject a custom
 * renderer.
 * @property {boolean|number} responsive=false If set to `true` resize the
 * waveform, when the window is resized. This is debounced with a `100ms`
 * timeout by default. If this parameter is a number it represents that timeout.
 * @property {boolean} scrollParent=false Whether to scroll the container with a
 * lengthy waveform. Otherwise the waveform is shrunk to the container width
 * (see fillParent).
 * @property {number} skipLength=2 Number of seconds to skip with the
 * skipForward() and skipBackward() methods.
 * @property {boolean} splitChannels=false Render with seperate waveforms for
 * the channels of the audio
 * @property {string} waveColor='#999' The fill color of the waveform after the
 * cursor.
 * @property {object} xhr={} XHR options.
 */

/**
 * @typedef {Object} PluginDefinition
 * @desc The Object used to describe a plugin
 * @example wavesurfer.addPlugin(pluginDefinition);
 * @property {string} name The name of the plugin, the plugin instance will be
 * added as a property to the wavesurfer instance under this name
 * @property {?Object} staticProps The properties that should be added to the
 * wavesurfer instance as static properties
 * @property {?boolean} deferInit Don't initialise plugin
 * automatically
 * @property {Object} params={} The plugin parameters, they are the first parameter
 * passed to the plugin class constructor function
 * @property {PluginClass} instance The plugin instance factory, is called with
 * the dependency specified in extends. Returns the plugin class.
 */

/**
 * @interface PluginClass
 *
 * @desc This is the interface which is implemented by all plugin classes. Note
 * that this only turns into an observer after being passed through
 * `wavesurfer.addPlugin`.
 *
 * @extends {Observer}
 */
var PluginClass = function () {
    _createClass(PluginClass, [{
        key: 'create',

        /**
         * Plugin definition factory
         *
         * This function must be used to create a plugin definition which can be
         * used by wavesurfer to correctly instantiate the plugin.
         *
         * @param  {Object} params={} The plugin params (specific to the plugin)
         * @return {PluginDefinition} an object representing the plugin
         */
        value: function create(params) {}
        /**
         * Construct the plugin
         *
         * @param {Object} ws The wavesurfer instance
         * @param {Object} params={} The plugin params (specific to the plugin)
         */

    }]);

    function PluginClass(ws, params) {
        _classCallCheck(this, PluginClass);
    }
    /**
     * Initialise the plugin
     *
     * Start doing something. This is called by
     * `wavesurfer.initPlugin(pluginName)`
     */


    _createClass(PluginClass, [{
        key: 'init',
        value: function init() {}
        /**
         * Destroy the plugin instance
         *
         * Stop doing something. This is called by
         * `wavesurfer.destroyPlugin(pluginName)`
         */

    }, {
        key: 'destroy',
        value: function destroy() {}
    }]);

    return PluginClass;
}();

/**
 * WaveSurfer core library class
 *
 * @extends {Observer}
 * @example
 * const params = {
 *   container: '#waveform',
 *   waveColor: 'violet',
 *   progressColor: 'purple'
 * };
 *
 * // initialise like this
 * const wavesurfer = WaveSurfer.create(params);
 *
 * // or like this ...
 * const wavesurfer = new WaveSurfer(params);
 * wavesurfer.init();
 *
 * // load audio file
 * wavesurfer.load('example/media/demo.wav');
 */


var WaveSurfer = function (_util$Observer) {
    _inherits(WaveSurfer, _util$Observer);

    _createClass(WaveSurfer, null, [{
        key: 'create',


        /**
         * Instantiate this class, call its `init` function and returns it
         *
         * @param {WavesurferParams} params
         * @return {Object} WaveSurfer instance
         * @example const wavesurfer = WaveSurfer.create(params);
         */

        /** @private */
        value: function create(params) {
            var wavesurfer = new WaveSurfer(params);
            return wavesurfer.init();
        }

        /**
         * The library version number is available as a static property of the
         * WaveSurfer class
         *
         * @type {String}
         * @example
         * console.log('Using wavesurfer.js ' + WaveSurfer.VERSION);
         */


        /** @private */


        /**
         * Functions in the `util` property are available as a prototype property to
         * all instances
         *
         * @type {Object}
         * @example
         * const wavesurfer = WaveSurfer.create(params);
         * wavesurfer.util.style(myElement, { background: 'blue' });
         */


        /**
         * Functions in the `util` property are available as a static property of the
         * WaveSurfer class
         *
         * @type {Object}
         * @example
         * WaveSurfer.util.style(myElement, { background: 'blue' });
         */

    }]);

    /**
     * Initialise wavesurfer instance
     *
     * @param {WavesurferParams} params Instantiation options for wavesurfer
     * @example
     * const wavesurfer = new WaveSurfer(params);
     * @returns {this}
     */
    function WaveSurfer(params) {
        var _ret;

        _classCallCheck(this, WaveSurfer);

        /**
         * Extract relevant parameters (or defaults)
         * @private
         */
        var _this = _possibleConstructorReturn(this, (WaveSurfer.__proto__ || Object.getPrototypeOf(WaveSurfer)).call(this));

        _this.defaultParams = {
            audioContext: null,
            audioRate: 1,
            autoCenter: true,
            backend: 'WebAudio',
            barHeight: 1,
            barGap: null,
            container: null,
            cursorColor: '#333',
            cursorWidth: 1,
            dragSelection: true,
            fillParent: true,
            forceDecode: false,
            height: 128,
            hideScrollbar: false,
            interact: true,
            loopSelection: true,
            maxCanvasWidth: 4000,
            mediaContainer: null,
            mediaControls: false,
            mediaType: 'audio',
            minPxPerSec: 20,
            normalize: false,
            partialRender: false,
            pixelRatio: window.devicePixelRatio || screen.deviceXDPI / screen.logicalXDPI,
            plugins: [],
            progressColor: '#555',
            removeMediaElementOnDestroy: true,
            renderer: _drawer2.default,
            responsive: false,
            scrollParent: false,
            skipLength: 2,
            splitChannels: false,
            waveColor: '#999',
            xhr: {}
        };
        _this.backends = {
            MediaElement: _mediaelement2.default,
            WebAudio: _webaudio2.default
        };
        _this.util = util;
        _this.params = util.extend({}, _this.defaultParams, params);

        /** @private */
        _this.container = 'string' == typeof params.container ? document.querySelector(_this.params.container) : _this.params.container;

        if (!_this.container) {
            throw new Error('Container element not found');
        }

        if (_this.params.mediaContainer == null) {
            /** @private */
            _this.mediaContainer = _this.container;
        } else if (typeof _this.params.mediaContainer == 'string') {
            /** @private */
            _this.mediaContainer = document.querySelector(_this.params.mediaContainer);
        } else {
            /** @private */
            _this.mediaContainer = _this.params.mediaContainer;
        }

        if (!_this.mediaContainer) {
            throw new Error('Media Container element not found');
        }

        if (_this.params.maxCanvasWidth <= 1) {
            throw new Error('maxCanvasWidth must be greater than 1');
        } else if (_this.params.maxCanvasWidth % 2 == 1) {
            throw new Error('maxCanvasWidth must be an even number');
        }

        /**
         * @private Used to save the current volume when muting so we can
         * restore once unmuted
         * @type {number}
         */
        _this.savedVolume = 0;

        /**
         * @private The current muted state
         * @type {boolean}
         */
        _this.isMuted = false;

        /**
         * @private Will hold a list of event descriptors that need to be
         * cancelled on subsequent loads of audio
         * @type {Object[]}
         */
        _this.tmpEvents = [];

        /**
         * @private Holds any running audio downloads
         * @type {Observer}
         */
        _this.currentAjax = null;
        /** @private */
        _this.arraybuffer = null;
        /** @private */
        _this.drawer = null;
        /** @private */
        _this.backend = null;
        /** @private */
        _this.peakCache = null;

        // cache constructor objects
        if (typeof _this.params.renderer !== 'function') {
            throw new Error('Renderer parameter is invalid');
        }
        /**
         * @private The uninitialised Drawer class
         */
        _this.Drawer = _this.params.renderer;
        /**
         * @private The uninitialised Backend class
         */
        _this.Backend = _this.backends[_this.params.backend];

        /**
         * @private map of plugin names that are currently initialised
         */
        _this.initialisedPluginList = {};
        /** @private */
        _this.isDestroyed = false;
        /** @private */
        _this.isReady = false;

        // responsive debounced event listener. If this.params.responsive is not
        // set, this is never called. Use 100ms or this.params.responsive as
        // timeout for the debounce function.
        var prevWidth = 0;
        _this._onResize = util.debounce(function () {
            if (prevWidth != _this.drawer.wrapper.clientWidth && !_this.params.scrollParent) {
                prevWidth = _this.drawer.wrapper.clientWidth;
                _this.drawer.fireEvent('redraw');
            }
        }, typeof _this.params.responsive === 'number' ? _this.params.responsive : 100);

        return _ret = _this, _possibleConstructorReturn(_this, _ret);
    }

    /**
     * Initialise the wave
     *
     * @example
     * var wavesurfer = new WaveSurfer(params);
     * wavesurfer.init();
     * @return {this}
     */


    _createClass(WaveSurfer, [{
        key: 'init',
        value: function init() {
            this.registerPlugins(this.params.plugins);
            this.createDrawer();
            this.createBackend();
            this.createPeakCache();
            return this;
        }

        /**
         * Add and initialise array of plugins (if `plugin.deferInit` is falsey),
         * this function is called in the init function of wavesurfer
         *
         * @param {PluginDefinition[]} plugins An array of plugin definitions
         * @emits {WaveSurfer#plugins-registered} Called with the array of plugin definitions
         * @return {this}
         */

    }, {
        key: 'registerPlugins',
        value: function registerPlugins(plugins) {
            var _this2 = this;

            // first instantiate all the plugins
            plugins.forEach(function (plugin) {
                return _this2.addPlugin(plugin);
            });

            // now run the init functions
            plugins.forEach(function (plugin) {
                // call init function of the plugin if deferInit is falsey
                // in that case you would manually use initPlugins()
                if (!plugin.deferInit) {
                    _this2.initPlugin(plugin.name);
                }
            });
            this.fireEvent('plugins-registered', plugins);
            return this;
        }

        /**
         * Add a plugin object to wavesurfer
         *
         * @param {PluginDefinition} plugin A plugin definition
         * @emits {WaveSurfer#plugin-added} Called with the name of the plugin that was added
         * @example wavesurfer.addPlugin(WaveSurfer.minimap());
         * @return {this}
         */

    }, {
        key: 'addPlugin',
        value: function addPlugin(plugin) {
            var _this3 = this;

            if (!plugin.name) {
                throw new Error('Plugin does not have a name!');
            }
            if (!plugin.instance) {
                throw new Error('Plugin ' + plugin.name + ' does not have an instance property!');
            }

            // staticProps properties are applied to wavesurfer instance
            if (plugin.staticProps) {
                Object.keys(plugin.staticProps).forEach(function (pluginStaticProp) {
                    /**
                     * Properties defined in a plugin definition's `staticProps` property are added as
                     * staticProps properties of the WaveSurfer instance
                     */
                    _this3[pluginStaticProp] = plugin.staticProps[pluginStaticProp];
                });
            }

            var Instance = plugin.instance;

            // turn the plugin instance into an observer
            var observerPrototypeKeys = Object.getOwnPropertyNames(util.Observer.prototype);
            observerPrototypeKeys.forEach(function (key) {
                Instance.prototype[key] = util.Observer.prototype[key];
            });

            /**
             * Instantiated plugin classes are added as a property of the wavesurfer
             * instance
             * @type {Object}
             */
            this[plugin.name] = new Instance(plugin.params || {}, this);
            this.fireEvent('plugin-added', plugin.name);
            return this;
        }

        /**
         * Initialise a plugin
         *
         * @param {string} name A plugin name
         * @emits WaveSurfer#plugin-initialised
         * @example wavesurfer.initPlugin('minimap');
         * @return {this}
         */

    }, {
        key: 'initPlugin',
        value: function initPlugin(name) {
            if (!this[name]) {
                throw new Error('Plugin ' + name + ' has not been added yet!');
            }
            if (this.initialisedPluginList[name]) {
                // destroy any already initialised plugins
                this.destroyPlugin(name);
            }
            this[name].init();
            this.initialisedPluginList[name] = true;
            this.fireEvent('plugin-initialised', name);
            return this;
        }

        /**
         * Destroy a plugin
         *
         * @param {string} name A plugin name
         * @emits WaveSurfer#plugin-destroyed
         * @example wavesurfer.destroyPlugin('minimap');
         * @returns {this}
         */

    }, {
        key: 'destroyPlugin',
        value: function destroyPlugin(name) {
            if (!this[name]) {
                throw new Error('Plugin ' + name + ' has not been added yet and cannot be destroyed!');
            }
            if (!this.initialisedPluginList[name]) {
                throw new Error('Plugin ' + name + ' is not active and cannot be destroyed!');
            }
            if (typeof this[name].destroy !== 'function') {
                throw new Error('Plugin ' + name + ' does not have a destroy function!');
            }

            this[name].destroy();
            delete this.initialisedPluginList[name];
            this.fireEvent('plugin-destroyed', name);
            return this;
        }

        /**
         * Destroy all initialised plugins. Convenience function to use when
         * wavesurfer is removed
         *
         * @private
         */

    }, {
        key: 'destroyAllPlugins',
        value: function destroyAllPlugins() {
            var _this4 = this;

            Object.keys(this.initialisedPluginList).forEach(function (name) {
                return _this4.destroyPlugin(name);
            });
        }

        /**
         * Create the drawer and draw the waveform
         *
         * @private
         * @emits WaveSurfer#drawer-created
         */

    }, {
        key: 'createDrawer',
        value: function createDrawer() {
            var _this5 = this;

            this.drawer = new this.Drawer(this.container, this.params);
            this.drawer.init();
            this.fireEvent('drawer-created', this.drawer);

            if (this.params.responsive !== false) {
                window.addEventListener('resize', this._onResize, true);
                window.addEventListener('orientationchange', this._onResize, true);
            }

            this.drawer.on('redraw', function () {
                _this5.drawBuffer();
                _this5.drawer.progress(_this5.backend.getPlayedPercents());
            });

            // Click-to-seek
            this.drawer.on('click', function (e, progress) {
                setTimeout(function () {
                    return _this5.seekTo(progress);
                }, 0);
            });

            // Relay the scroll event from the drawer
            this.drawer.on('scroll', function (e) {
                if (_this5.params.partialRender) {
                    _this5.drawBuffer();
                }
                _this5.fireEvent('scroll', e);
            });
        }

        /**
         * Create the backend
         *
         * @private
         * @emits WaveSurfer#backend-created
         */

    }, {
        key: 'createBackend',
        value: function createBackend() {
            var _this6 = this;

            if (this.backend) {
                this.backend.destroy();
            }

            // Back compat
            if (this.params.backend == 'AudioElement') {
                this.params.backend = 'MediaElement';
            }

            if (this.params.backend == 'WebAudio' && !this.Backend.prototype.supportsWebAudio.call(null)) {
                this.params.backend = 'MediaElement';
            }

            this.backend = new this.Backend(this.params);
            this.backend.init();
            this.fireEvent('backend-created', this.backend);

            this.backend.on('finish', function () {
                return _this6.fireEvent('finish');
            });
            this.backend.on('play', function () {
                return _this6.fireEvent('play');
            });
            this.backend.on('pause', function () {
                return _this6.fireEvent('pause');
            });

            this.backend.on('audioprocess', function (time) {
                _this6.drawer.progress(_this6.backend.getPlayedPercents());
                _this6.fireEvent('audioprocess', time);
            });
        }

        /**
         * Create the peak cache
         *
         * @private
         */

    }, {
        key: 'createPeakCache',
        value: function createPeakCache() {
            if (this.params.partialRender) {
                this.peakCache = new _peakcache2.default();
            }
        }

        /**
         * Get the duration of the audio clip
         *
         * @example const duration = wavesurfer.getDuration();
         * @return {number} Duration in seconds
         */

    }, {
        key: 'getDuration',
        value: function getDuration() {
            return this.backend.getDuration();
        }

        /**
         * Get the current playback position
         *
         * @example const currentTime = wavesurfer.getCurrentTime();
         * @return {number} Playback position in seconds
         */

    }, {
        key: 'getCurrentTime',
        value: function getCurrentTime() {
            return this.backend.getCurrentTime();
        }

        /**
         * Set the current play time in seconds.
         *
         * @param {number} seconds A positive number in seconds. E.g. 10 means 10
         * seconds, 60 means 1 minute
         */

    }, {
        key: 'setCurrentTime',
        value: function setCurrentTime(seconds) {
            if (seconds >= this.getDuration()) {
                this.seekTo(1);
            } else {
                this.seekTo(seconds / this.getDuration());
            }
        }

        /**
         * Starts playback from the current position. Optional start and end
         * measured in seconds can be used to set the range of audio to play.
         *
         * @param {?number} start Position to start at
         * @param {?number} end Position to end at
         * @emits WaveSurfer#interaction
         * @return {Promise}
         * @example
         * // play from second 1 to 5
         * wavesurfer.play(1, 5);
         */

    }, {
        key: 'play',
        value: function play(start, end) {
            var _this7 = this;

            this.fireEvent('interaction', function () {
                return _this7.play(start, end);
            });
            return this.backend.play(start, end);
        }

        /**
         * Stops playback
         *
         * @example wavesurfer.pause();
         * @return {Promise}
         */

    }, {
        key: 'pause',
        value: function pause() {
            if (!this.backend.isPaused()) {
                return this.backend.pause();
            }
        }

        /**
         * Toggle playback
         *
         * @example wavesurfer.playPause();
         * @return {Promise}
         */

    }, {
        key: 'playPause',
        value: function playPause() {
            return this.backend.isPaused() ? this.play() : this.pause();
        }

        /**
         * Get the current playback state
         *
         * @example const isPlaying = wavesurfer.isPlaying();
         * @return {boolean} False if paused, true if playing
         */

    }, {
        key: 'isPlaying',
        value: function isPlaying() {
            return !this.backend.isPaused();
        }

        /**
         * Skip backward
         *
         * @param {?number} seconds Amount to skip back, if not specified `skipLength`
         * is used
         * @example wavesurfer.skipBackward();
         */

    }, {
        key: 'skipBackward',
        value: function skipBackward(seconds) {
            this.skip(-seconds || -this.params.skipLength);
        }

        /**
         * Skip forward
         *
         * @param {?number} seconds Amount to skip back, if not specified `skipLength`
         * is used
         * @example wavesurfer.skipForward();
         */

    }, {
        key: 'skipForward',
        value: function skipForward(seconds) {
            this.skip(seconds || this.params.skipLength);
        }

        /**
         * Skip a number of seconds from the current position (use a negative value
         * to go backwards).
         *
         * @param {number} offset Amount to skip back or forwards
         * @example
         * // go back 2 seconds
         * wavesurfer.skip(-2);
         */

    }, {
        key: 'skip',
        value: function skip(offset) {
            var duration = this.getDuration() || 1;
            var position = this.getCurrentTime() || 0;
            position = Math.max(0, Math.min(duration, position + (offset || 0)));
            this.seekAndCenter(position / duration);
        }

        /**
         * Seeks to a position and centers the view
         *
         * @param {number} progress Between 0 (=beginning) and 1 (=end)
         * @example
         * // seek and go to the middle of the audio
         * wavesurfer.seekTo(0.5);
         */

    }, {
        key: 'seekAndCenter',
        value: function seekAndCenter(progress) {
            this.seekTo(progress);
            this.drawer.recenter(progress);
        }

        /**
         * Seeks to a position
         *
         * @param {number} progress Between 0 (=beginning) and 1 (=end)
         * @emits WaveSurfer#interaction
         * @emits WaveSurfer#seek
         * @example
         * // seek to the middle of the audio
         * wavesurfer.seekTo(0.5);
         */

    }, {
        key: 'seekTo',
        value: function seekTo(progress) {
            var _this8 = this;

            // return an error if progress is not a number between 0 and 1
            if (typeof progress !== 'number' || !isFinite(progress) || progress < 0 || progress > 1) {
                return console.error('Error calling wavesurfer.seekTo, parameter must be a number between 0 and 1!');
            }
            this.fireEvent('interaction', function () {
                return _this8.seekTo(progress);
            });

            var paused = this.backend.isPaused();
            // avoid draw wrong position while playing backward seeking
            if (!paused) {
                this.backend.pause();
            }
            // avoid small scrolls while paused seeking
            var oldScrollParent = this.params.scrollParent;
            this.params.scrollParent = false;
            this.backend.seekTo(progress * this.getDuration());
            this.drawer.progress(progress);

            if (!paused) {
                this.backend.play();
            }
            this.params.scrollParent = oldScrollParent;
            this.fireEvent('seek', progress);
        }

        /**
         * Stops and goes to the beginning.
         *
         * @example wavesurfer.stop();
         */

    }, {
        key: 'stop',
        value: function stop() {
            this.pause();
            this.seekTo(0);
            this.drawer.progress(0);
        }

        /**
         * Set the playback volume.
         *
         * @param {string} deviceId String value representing underlying output device
         */

    }, {
        key: 'setSinkId',
        value: function setSinkId(deviceId) {
            return this.backend.setSinkId(deviceId);
        }

        /**
         * Set the playback volume.
         *
         * @param {number} newVolume A value between 0 and 1, 0 being no
         * volume and 1 being full volume.
         * @emits WaveSurfer#volume
         */

    }, {
        key: 'setVolume',
        value: function setVolume(newVolume) {
            this.backend.setVolume(newVolume);
            this.fireEvent('volume', newVolume);
        }

        /**
         * Get the playback volume.
         *
         * @return {number} A value between 0 and 1, 0 being no
         * volume and 1 being full volume.
         */

    }, {
        key: 'getVolume',
        value: function getVolume() {
            return this.backend.getVolume();
        }

        /**
         * Set the playback rate.
         *
         * @param {number} rate A positive number. E.g. 0.5 means half the normal
         * speed, 2 means double speed and so on.
         * @example wavesurfer.setPlaybackRate(2);
         */

    }, {
        key: 'setPlaybackRate',
        value: function setPlaybackRate(rate) {
            this.backend.setPlaybackRate(rate);
        }

        /**
         * Get the playback rate.
         *
         * @return {number}
         */

    }, {
        key: 'getPlaybackRate',
        value: function getPlaybackRate() {
            return this.backend.getPlaybackRate();
        }

        /**
         * Toggle the volume on and off. It not currenly muted it will save the
         * current volume value and turn the volume off. If currently muted then it
         * will restore the volume to the saved value, and then rest the saved
         * value.
         *
         * @example wavesurfer.toggleMute();
         */

    }, {
        key: 'toggleMute',
        value: function toggleMute() {
            this.setMute(!this.isMuted);
        }

        /**
         * Enable or disable muted audio
         *
         * @param {boolean} mute
         * @emits WaveSurfer#volume
         * @emits WaveSurfer#mute
         * @example
         * // unmute
         * wavesurfer.setMute(false);
         */

    }, {
        key: 'setMute',
        value: function setMute(mute) {
            // ignore all muting requests if the audio is already in that state
            if (mute === this.isMuted) {
                this.fireEvent('mute', this.isMuted);
                return;
            }

            if (mute) {
                // If currently not muted then save current volume,
                // turn off the volume and update the mute properties
                this.savedVolume = this.backend.getVolume();
                this.backend.setVolume(0);
                this.isMuted = true;
                this.fireEvent('volume', 0);
            } else {
                // If currently muted then restore to the saved volume
                // and update the mute properties
                this.backend.setVolume(this.savedVolume);
                this.isMuted = false;
                this.fireEvent('volume', this.savedVolume);
            }
            this.fireEvent('mute', this.isMuted);
        }

        /**
         * Get the current mute status.
         *
         * @example const isMuted = wavesurfer.getMute();
         * @return {boolean}
         */

    }, {
        key: 'getMute',
        value: function getMute() {
            return this.isMuted;
        }

        /**
         * Get the current ready status.
         *
         * @example const isReady = wavesurfer.isReady();
         * @return {boolean}
         */

    }, {
        key: 'isReady',
        value: function isReady() {
            return this.isReady;
        }

        /**
         * Get the list of current set filters as an array.
         *
         * Filters must be set with setFilters method first
         *
         * @return {array}
         */

    }, {
        key: 'getFilters',
        value: function getFilters() {
            return this.backend.filters || [];
        }

        /**
         * Toggles `scrollParent` and redraws
         *
         * @example wavesurfer.toggleScroll();
         */

    }, {
        key: 'toggleScroll',
        value: function toggleScroll() {
            this.params.scrollParent = !this.params.scrollParent;
            this.drawBuffer();
        }

        /**
         * Toggle mouse interaction
         *
         * @example wavesurfer.toggleInteraction();
         */

    }, {
        key: 'toggleInteraction',
        value: function toggleInteraction() {
            this.params.interact = !this.params.interact;
        }

        /**
         * Get the fill color of the waveform after the cursor.
         *
         * @return {string} A CSS color string.
         */

    }, {
        key: 'getWaveColor',
        value: function getWaveColor() {
            return this.params.waveColor;
        }

        /**
         * Set the fill color of the waveform after the cursor.
         *
         * @param {string} color A CSS color string.
         * @example wavesurfer.setWaveColor('#ddd');
         */

    }, {
        key: 'setWaveColor',
        value: function setWaveColor(color) {
            this.params.waveColor = color;
            this.drawBuffer();
        }

        /**
         * Get the fill color of the waveform behind the cursor.
         *
         * @return {string} A CSS color string.
         */

    }, {
        key: 'getProgressColor',
        value: function getProgressColor() {
            return this.params.progressColor;
        }

        /**
         * Set the fill color of the waveform behind the cursor.
         *
         * @param {string} color A CSS color string.
         * @example wavesurfer.setProgressColor('#400');
         */

    }, {
        key: 'setProgressColor',
        value: function setProgressColor(color) {
            this.params.progressColor = color;
            this.drawBuffer();
        }

        /**
         * Get the fill color of the cursor indicating the playhead
         * position.
         *
         * @return {string} A CSS color string.
         */

    }, {
        key: 'getCursorColor',
        value: function getCursorColor() {
            return this.params.cursorColor;
        }

        /**
         * Set the fill color of the cursor indicating the playhead
         * position.
         *
         * @param {string} color A CSS color string.
         * @example wavesurfer.setCursorColor('#222');
         */

    }, {
        key: 'setCursorColor',
        value: function setCursorColor(color) {
            this.params.cursorColor = color;
            this.drawer.updateCursor();
        }

        /**
         * Get the height of the waveform.
         *
         * @return {number} Height measured in pixels.
         */

    }, {
        key: 'getHeight',
        value: function getHeight() {
            return this.params.height;
        }

        /**
         * Set the height of the waveform.
         *
         * @param {number} height Height measured in pixels.
         * @example wavesurfer.setHeight(200);
         */

    }, {
        key: 'setHeight',
        value: function setHeight(height) {
            this.params.height = height;
            this.drawer.setHeight(height * this.params.pixelRatio);
            this.drawBuffer();
        }

        /**
         * Get the correct peaks for current wave viewport and render wave
         *
         * @private
         * @emits WaveSurfer#redraw
         */

    }, {
        key: 'drawBuffer',
        value: function drawBuffer() {
            var nominalWidth = Math.round(this.getDuration() * this.params.minPxPerSec * this.params.pixelRatio);
            var parentWidth = this.drawer.getWidth();
            var width = nominalWidth;
            var start = this.drawer.getScrollX();
            var end = Math.max(start + parentWidth, width);
            // Fill container
            if (this.params.fillParent && (!this.params.scrollParent || nominalWidth < parentWidth)) {
                width = parentWidth;
                start = 0;
                end = width;
            }

            var peaks = void 0;
            if (this.params.partialRender) {
                var newRanges = this.peakCache.addRangeToPeakCache(width, start, end);
                var i = void 0;
                for (i = 0; i < newRanges.length; i++) {
                    peaks = this.backend.getPeaks(width, newRanges[i][0], newRanges[i][1]);
                    this.drawer.drawPeaks(peaks, width, newRanges[i][0], newRanges[i][1]);
                }
            } else {
                peaks = this.backend.getPeaks(width, start, end);
                this.drawer.drawPeaks(peaks, width, start, end);
            }
            this.fireEvent('redraw', peaks, width);
        }

        /**
         * Horizontally zooms the waveform in and out. It also changes the parameter
         * `minPxPerSec` and enables the `scrollParent` option. Calling the function
         * with a falsey parameter will reset the zoom state.
         *
         * @param {?number} pxPerSec Number of horizontal pixels per second of
         * audio, if none is set the waveform returns to unzoomed state
         * @emits WaveSurfer#zoom
         * @example wavesurfer.zoom(20);
         */

    }, {
        key: 'zoom',
        value: function zoom(pxPerSec) {
            if (!pxPerSec) {
                this.params.minPxPerSec = this.defaultParams.minPxPerSec;
                this.params.scrollParent = false;
            } else {
                this.params.minPxPerSec = pxPerSec;
                this.params.scrollParent = true;
            }

            this.drawBuffer();
            this.drawer.progress(this.backend.getPlayedPercents());

            this.drawer.recenter(this.getCurrentTime() / this.getDuration());
            this.fireEvent('zoom', pxPerSec);
        }

        /**
         * Decode buffer and load
         *
         * @private
         * @param {ArrayBuffer} arraybuffer
         */

    }, {
        key: 'loadArrayBuffer',
        value: function loadArrayBuffer(arraybuffer) {
            var _this9 = this;

            this.decodeArrayBuffer(arraybuffer, function (data) {
                if (!_this9.isDestroyed) {
                    _this9.loadDecodedBuffer(data);
                }
            });
        }

        /**
         * Directly load an externally decoded AudioBuffer
         *
         * @private
         * @param {AudioBuffer} buffer
         * @emits WaveSurfer#ready
         */

    }, {
        key: 'loadDecodedBuffer',
        value: function loadDecodedBuffer(buffer) {
            this.backend.load(buffer);
            this.drawBuffer();
            this.fireEvent('ready');
            this.isReady = true;
        }

        /**
         * Loads audio data from a Blob or File object
         *
         * @param {Blob|File} blob Audio data
         * @example
         */

    }, {
        key: 'loadBlob',
        value: function loadBlob(blob) {
            var _this10 = this;

            // Create file reader
            var reader = new FileReader();
            reader.addEventListener('progress', function (e) {
                return _this10.onProgress(e);
            });
            reader.addEventListener('load', function (e) {
                return _this10.loadArrayBuffer(e.target.result);
            });
            reader.addEventListener('error', function () {
                return _this10.fireEvent('error', 'Error reading file');
            });
            reader.readAsArrayBuffer(blob);
            this.empty();
        }

        /**
         * Loads audio and re-renders the waveform.
         *
         * @param {string|HTMLMediaElement} url The url of the audio file or the
         * audio element with the audio
         * @param {?number[]|number[][]} peaks Wavesurfer does not have to decode
         * the audio to render the waveform if this is specified
         * @param {?string} preload (Use with backend `MediaElement`)
         * `'none'|'metadata'|'auto'` Preload attribute for the media element
         * @param {?number} duration The duration of the audio. This is used to
         * render the peaks data in the correct size for the audio duration (as
         * befits the current minPxPerSec and zoom value) without having to decode
         * the audio.
         * @example
         * // using ajax or media element to load (depending on backend)
         * wavesurfer.load('http://example.com/demo.wav');
         *
         * // setting preload attribute with media element backend and supplying
         * peaks wavesurfer.load(
         *   'http://example.com/demo.wav',
         *   [0.0218, 0.0183, 0.0165, 0.0198, 0.2137, 0.2888],
         *   true,
         * );
         */

    }, {
        key: 'load',
        value: function load(url, peaks, preload, duration) {
            this.empty();

            if (preload) {
                // check whether the preload attribute will be usable and if not log
                // a warning listing the reasons why not and nullify the variable
                var preloadIgnoreReasons = {
                    "Preload is not 'auto', 'none' or 'metadata'": ['auto', 'metadata', 'none'].indexOf(preload) === -1,
                    'Peaks are not provided': !peaks,
                    'Backend is not of type MediaElement': this.params.backend !== 'MediaElement',
                    'Url is not of type string': typeof url !== 'string'
                };
                var activeReasons = Object.keys(preloadIgnoreReasons).filter(function (reason) {
                    return preloadIgnoreReasons[reason];
                });
                if (activeReasons.length) {
                    console.warn('Preload parameter of wavesurfer.load will be ignored because:\n\t- ' + activeReasons.join('\n\t- '));
                    // stop invalid values from being used
                    preload = null;
                }
            }

            switch (this.params.backend) {
                case 'WebAudio':
                    return this.loadBuffer(url, peaks, duration);
                case 'MediaElement':
                    return this.loadMediaElement(url, peaks, preload, duration);
            }
        }

        /**
         * Loads audio using Web Audio buffer backend.
         *
         * @private
         * @param {string} url
         * @param {?number[]|number[][]} peaks
         * @param {?number} duration
         */

    }, {
        key: 'loadBuffer',
        value: function loadBuffer(url, peaks, duration) {
            var _this11 = this;

            var load = function load(action) {
                if (action) {
                    _this11.tmpEvents.push(_this11.once('ready', action));
                }
                return _this11.getArrayBuffer(url, function (data) {
                    return _this11.loadArrayBuffer(data);
                });
            };

            if (peaks) {
                this.backend.setPeaks(peaks, duration);
                this.drawBuffer();
                this.tmpEvents.push(this.once('interaction', load));
            } else {
                return load();
            }
        }

        /**
         * Either create a media element, or load an existing media element.
         *
         * @private
         * @param {string|HTMLMediaElement} urlOrElt Either a path to a media file, or an
         * existing HTML5 Audio/Video Element
         * @param {number[]|number[][]} peaks Array of peaks. Required to bypass web audio
         * dependency
         * @param {?boolean} preload Set to true if the preload attribute of the
         * audio element should be enabled
         * @param {?number} duration
         */

    }, {
        key: 'loadMediaElement',
        value: function loadMediaElement(urlOrElt, peaks, preload, duration) {
            var _this12 = this;

            var url = urlOrElt;

            if (typeof urlOrElt === 'string') {
                this.backend.load(url, this.mediaContainer, peaks, preload);
            } else {
                var elt = urlOrElt;
                this.backend.loadElt(elt, peaks);

                // If peaks are not provided,
                // url = element.src so we can get peaks with web audio
                url = elt.src;
            }

            this.tmpEvents.push(this.backend.once('canplay', function () {
                _this12.drawBuffer();
                _this12.fireEvent('ready');
                _this12.isReady = true;
            }), this.backend.once('error', function (err) {
                return _this12.fireEvent('error', err);
            }));

            // If no pre-decoded peaks provided or pre-decoded peaks are
            // provided with forceDecode flag, attempt to download the
            // audio file and decode it with Web Audio.
            if (peaks) {
                this.backend.setPeaks(peaks, duration);
            }

            if ((!peaks || this.params.forceDecode) && this.backend.supportsWebAudio()) {
                this.getArrayBuffer(url, function (arraybuffer) {
                    _this12.decodeArrayBuffer(arraybuffer, function (buffer) {
                        _this12.backend.buffer = buffer;
                        _this12.backend.setPeaks(null);
                        _this12.drawBuffer();
                        _this12.fireEvent('waveform-ready');
                    });
                });
            }
        }

        /**
         * Decode an array buffer and pass data to a callback
         *
         * @private
         * @param {Object} arraybuffer
         * @param {function} callback
         */

    }, {
        key: 'decodeArrayBuffer',
        value: function decodeArrayBuffer(arraybuffer, callback) {
            var _this13 = this;

            this.arraybuffer = arraybuffer;

            this.backend.decodeArrayBuffer(arraybuffer, function (data) {
                // Only use the decoded data if we haven't been destroyed or
                // another decode started in the meantime
                if (!_this13.isDestroyed && _this13.arraybuffer == arraybuffer) {
                    callback(data);
                    _this13.arraybuffer = null;
                }
            }, function () {
                return _this13.fireEvent('error', 'Error decoding audiobuffer');
            });
        }

        /**
         * Load an array buffer by ajax and pass to a callback
         *
         * @param {string} url
         * @param {function} callback
         * @private
         */

    }, {
        key: 'getArrayBuffer',
        value: function getArrayBuffer(url, callback) {
            var _this14 = this;

            var ajax = util.ajax({
                url: url,
                responseType: 'arraybuffer',
                xhr: this.params.xhr
            });

            this.currentAjax = ajax;

            this.tmpEvents.push(ajax.on('progress', function (e) {
                _this14.onProgress(e);
            }), ajax.on('success', function (data, e) {
                callback(data);
                _this14.currentAjax = null;
            }), ajax.on('error', function (e) {
                _this14.fireEvent('error', 'XHR error: ' + e.target.statusText);
                _this14.currentAjax = null;
            }));

            return ajax;
        }

        /**
         * Called while the audio file is loading
         *
         * @private
         * @param {Event} e
         * @emits WaveSurfer#loading
         */

    }, {
        key: 'onProgress',
        value: function onProgress(e) {
            var percentComplete = void 0;
            if (e.lengthComputable) {
                percentComplete = e.loaded / e.total;
            } else {
                // Approximate progress with an asymptotic
                // function, and assume downloads in the 1-3 MB range.
                percentComplete = e.loaded / (e.loaded + 1000000);
            }
            this.fireEvent('loading', Math.round(percentComplete * 100), e.target);
        }

        /**
         * Exports PCM data into a JSON array and opens in a new window.
         *
         * @param {number} length=1024 The scale in which to export the peaks. (Integer)
         * @param {number} accuracy=10000 (Integer)
         * @param {?boolean} noWindow Set to true to disable opening a new
         * window with the JSON
         * @param {number} start
         * @todo Update exportPCM to work with new getPeaks signature
         * @return {string} JSON of peaks
         */

    }, {
        key: 'exportPCM',
        value: function exportPCM(length, accuracy, noWindow, start) {
            length = length || 1024;
            start = start || 0;
            accuracy = accuracy || 10000;
            noWindow = noWindow || false;
            var peaks = this.backend.getPeaks(length, start);
            var arr = [].map.call(peaks, function (val) {
                return Math.round(val * accuracy) / accuracy;
            });
            var json = JSON.stringify(arr);
            if (!noWindow) {
                window.open('data:application/json;charset=utf-8,' + encodeURIComponent(json));
            }
            return json;
        }

        /**
         * Save waveform image as data URI.
         *
         * The default format is `image/png`. Other supported types are
         * `image/jpeg` and `image/webp`.
         *
         * @param {string} format='image/png'
         * @param {number} quality=1
         * @return {string} data URI of image
         */

    }, {
        key: 'exportImage',
        value: function exportImage(format, quality) {
            if (!format) {
                format = 'image/png';
            }
            if (!quality) {
                quality = 1;
            }

            return this.drawer.getImage(format, quality);
        }

        /**
         * Cancel any ajax request currently in progress
         */

    }, {
        key: 'cancelAjax',
        value: function cancelAjax() {
            if (this.currentAjax) {
                this.currentAjax.xhr.abort();
                this.currentAjax = null;
            }
        }

        /**
         * @private
         */

    }, {
        key: 'clearTmpEvents',
        value: function clearTmpEvents() {
            this.tmpEvents.forEach(function (e) {
                return e.un();
            });
        }

        /**
         * Display empty waveform.
         */

    }, {
        key: 'empty',
        value: function empty() {
            if (!this.backend.isPaused()) {
                this.stop();
                this.backend.disconnectSource();
            }
            this.isReady = false;
            this.cancelAjax();
            this.clearTmpEvents();
            this.drawer.progress(0);
            this.drawer.setWidth(0);
            this.drawer.drawPeaks({ length: this.drawer.getWidth() }, 0);
        }

        /**
         * Remove events, elements and disconnect WebAudio nodes.
         *
         * @emits WaveSurfer#destroy
         */

    }, {
        key: 'destroy',
        value: function destroy() {
            this.destroyAllPlugins();
            this.fireEvent('destroy');
            this.cancelAjax();
            this.clearTmpEvents();
            this.unAll();
            if (this.params.responsive !== false) {
                window.removeEventListener('resize', this._onResize, true);
                window.removeEventListener('orientationchange', this._onResize, true);
            }
            this.backend.destroy();
            this.drawer.destroy();
            this.isDestroyed = true;
            this.isReady = false;
            this.arraybuffer = null;
        }
    }]);

    return WaveSurfer;
}(util.Observer);

WaveSurfer.VERSION = "2.0.6";
WaveSurfer.util = util;
exports.default = WaveSurfer;
module.exports = exports['default'];

/***/ }),

/***/ "./src/webaudio.js":
/*!*************************!*\
  !*** ./src/webaudio.js ***!
  \*************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _util = __webpack_require__(/*! ./util */ "./src/util/index.js");

var util = _interopRequireWildcard(_util);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

// using consts to prevent someone writing the string wrong
var PLAYING = 'playing';
var PAUSED = 'paused';
var FINISHED = 'finished';

/**
 * WebAudio backend
 *
 * @extends {Observer}
 */

var WebAudio = function (_util$Observer) {
    _inherits(WebAudio, _util$Observer);

    _createClass(WebAudio, [{
        key: 'supportsWebAudio',


        /**
         * Does the browser support this backend
         *
         * @return {boolean}
         */

        /** @private */

        /** @private */
        value: function supportsWebAudio() {
            return !!(window.AudioContext || window.webkitAudioContext);
        }

        /**
         * Get the audio context used by this backend or create one
         *
         * @return {AudioContext}
         */

        /** @private */

        /** @private */

    }, {
        key: 'getAudioContext',
        value: function getAudioContext() {
            if (!window.WaveSurferAudioContext) {
                window.WaveSurferAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            return window.WaveSurferAudioContext;
        }

        /**
         * Get the offline audio context used by this backend or create one
         *
         * @param {number} sampleRate
         * @return {OfflineAudioContext}
         */

    }, {
        key: 'getOfflineAudioContext',
        value: function getOfflineAudioContext(sampleRate) {
            if (!window.WaveSurferOfflineAudioContext) {
                window.WaveSurferOfflineAudioContext = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 2, sampleRate);
            }
            return window.WaveSurferOfflineAudioContext;
        }

        /**
         * Construct the backend
         *
         * @param {WavesurferParams} params
         */

    }]);

    function WebAudio(params) {
        var _this$stateBehaviors, _this$states;

        _classCallCheck(this, WebAudio);

        /** @private */
        var _this = _possibleConstructorReturn(this, (WebAudio.__proto__ || Object.getPrototypeOf(WebAudio)).call(this));

        _this.audioContext = null;
        _this.offlineAudioContext = null;
        _this.stateBehaviors = (_this$stateBehaviors = {}, _defineProperty(_this$stateBehaviors, PLAYING, {
            init: function init() {
                this.addOnAudioProcess();
            },
            getPlayedPercents: function getPlayedPercents() {
                var duration = this.getDuration();
                return this.getCurrentTime() / duration || 0;
            },
            getCurrentTime: function getCurrentTime() {
                return this.startPosition + this.getPlayedTime();
            }
        }), _defineProperty(_this$stateBehaviors, PAUSED, {
            init: function init() {
                this.removeOnAudioProcess();
            },
            getPlayedPercents: function getPlayedPercents() {
                var duration = this.getDuration();
                return this.getCurrentTime() / duration || 0;
            },
            getCurrentTime: function getCurrentTime() {
                return this.startPosition;
            }
        }), _defineProperty(_this$stateBehaviors, FINISHED, {
            init: function init() {
                this.removeOnAudioProcess();
                this.fireEvent('finish');
            },
            getPlayedPercents: function getPlayedPercents() {
                return 1;
            },
            getCurrentTime: function getCurrentTime() {
                return this.getDuration();
            }
        }), _this$stateBehaviors);
        _this.params = params;
        /** @private */
        _this.ac = params.audioContext || _this.getAudioContext();
        /**@private */
        _this.lastPlay = _this.ac.currentTime;
        /** @private */
        _this.startPosition = 0;
        /** @private  */
        _this.scheduledPause = null;
        /** @private */
        _this.states = (_this$states = {}, _defineProperty(_this$states, PLAYING, Object.create(_this.stateBehaviors[PLAYING])), _defineProperty(_this$states, PAUSED, Object.create(_this.stateBehaviors[PAUSED])), _defineProperty(_this$states, FINISHED, Object.create(_this.stateBehaviors[FINISHED])), _this$states);
        /** @private */
        _this.analyser = null;
        /** @private */
        _this.buffer = null;
        /** @private */
        _this.filters = [];
        /** @private */
        _this.gainNode = null;
        /** @private */
        _this.mergedPeaks = null;
        /** @private */
        _this.offlineAc = null;
        /** @private */
        _this.peaks = null;
        /** @private */
        _this.playbackRate = 1;
        /** @private */
        _this.analyser = null;
        /** @private */
        _this.scriptNode = null;
        /** @private */
        _this.source = null;
        /** @private */
        _this.splitPeaks = [];
        /** @private */
        _this.state = null;
        /** @private */
        _this.explicitDuration = null;
        return _this;
    }

    /**
     * Initialise the backend, called in `wavesurfer.createBackend()`
     */


    _createClass(WebAudio, [{
        key: 'init',
        value: function init() {
            this.createVolumeNode();
            this.createScriptNode();
            this.createAnalyserNode();

            this.setState(PAUSED);
            this.setPlaybackRate(this.params.audioRate);
            this.setLength(0);
        }

        /** @private */

    }, {
        key: 'disconnectFilters',
        value: function disconnectFilters() {
            if (this.filters) {
                this.filters.forEach(function (filter) {
                    filter && filter.disconnect();
                });
                this.filters = null;
                // Reconnect direct path
                this.analyser.connect(this.gainNode);
            }
        }

        /** @private */

    }, {
        key: 'setState',
        value: function setState(state) {
            if (this.state !== this.states[state]) {
                this.state = this.states[state];
                this.state.init.call(this);
            }
        }

        /**
         * Unpacked `setFilters()`
         *
         * @param {...AudioNode} filters
         */

    }, {
        key: 'setFilter',
        value: function setFilter() {
            for (var _len = arguments.length, filters = Array(_len), _key = 0; _key < _len; _key++) {
                filters[_key] = arguments[_key];
            }

            this.setFilters(filters);
        }

        /**
         * Insert custom Web Audio nodes into the graph
         *
         * @param {AudioNode[]} filters Packed filters array
         * @example
         * const lowpass = wavesurfer.backend.ac.createBiquadFilter();
         * wavesurfer.backend.setFilter(lowpass);
         */

    }, {
        key: 'setFilters',
        value: function setFilters(filters) {
            // Remove existing filters
            this.disconnectFilters();

            // Insert filters if filter array not empty
            if (filters && filters.length) {
                this.filters = filters;

                // Disconnect direct path before inserting filters
                this.analyser.disconnect();

                // Connect each filter in turn
                filters.reduce(function (prev, curr) {
                    prev.connect(curr);
                    return curr;
                }, this.analyser).connect(this.gainNode);
            }
        }

        /** @private */

    }, {
        key: 'createScriptNode',
        value: function createScriptNode() {
            if (this.params.audioScriptProcessor) {
                this.scriptNode = this.params.audioScriptProcessor;
            } else {
                if (this.ac.createScriptProcessor) {
                    this.scriptNode = this.ac.createScriptProcessor(WebAudio.scriptBufferSize);
                } else {
                    this.scriptNode = this.ac.createJavaScriptNode(WebAudio.scriptBufferSize);
                }
            }
            this.scriptNode.connect(this.ac.destination);
        }

        /** @private */

    }, {
        key: 'addOnAudioProcess',
        value: function addOnAudioProcess() {
            var _this2 = this;

            this.scriptNode.onaudioprocess = function () {
                var time = _this2.getCurrentTime();

                if (time >= _this2.getDuration()) {
                    _this2.setState(FINISHED);
                    _this2.fireEvent('pause');
                } else if (time >= _this2.scheduledPause) {
                    _this2.pause();
                } else if (_this2.state === _this2.states[PLAYING]) {
                    _this2.fireEvent('audioprocess', time);
                }
            };
        }

        /** @private */

    }, {
        key: 'removeOnAudioProcess',
        value: function removeOnAudioProcess() {
            this.scriptNode.onaudioprocess = null;
        }

        /** @private */

    }, {
        key: 'createAnalyserNode',
        value: function createAnalyserNode() {
            this.analyser = this.ac.createAnalyser();
            this.analyser.connect(this.gainNode);
        }

        /**
         * Create the gain node needed to control the playback volume.
         *
         * @private
         */

    }, {
        key: 'createVolumeNode',
        value: function createVolumeNode() {
            // Create gain node using the AudioContext
            if (this.ac.createGain) {
                this.gainNode = this.ac.createGain();
            } else {
                this.gainNode = this.ac.createGainNode();
            }
            // Add the gain node to the graph
            this.gainNode.connect(this.ac.destination);
        }

        /**
         * Set the sink id for the media player
         *
         * @param {string} deviceId String value representing audio device id.
         */

    }, {
        key: 'setSinkId',
        value: function setSinkId(deviceId) {
            if (deviceId) {
                /**
                 * The webaudio API doesn't currently support setting the device
                 * output. Here we create an HTMLAudioElement, connect the
                 * webaudio stream to that element and setSinkId there.
                 */
                var audio = new window.Audio();
                if (!audio.setSinkId) {
                    return Promise.reject(new Error('setSinkId is not supported in your browser'));
                }
                audio.autoplay = true;
                var dest = this.ac.createMediaStreamDestination();
                this.gainNode.disconnect();
                this.gainNode.connect(dest);
                audio.srcObject = dest.stream;

                return audio.setSinkId(deviceId);
            } else {
                return Promise.reject(new Error('Invalid deviceId: ' + deviceId));
            }
        }

        /**
         * Set the audio volume
         *
         * @param {number} value A floating point value between 0 and 1.
         */

    }, {
        key: 'setVolume',
        value: function setVolume(value) {
            this.gainNode.gain.setValueAtTime(value, this.ac.currentTime);
        }

        /**
         * Get the current volume
         *
         * @return {number} value A floating point value between 0 and 1.
         */

    }, {
        key: 'getVolume',
        value: function getVolume() {
            return this.gainNode.gain.value;
        }

        /** @private */

    }, {
        key: 'decodeArrayBuffer',
        value: function decodeArrayBuffer(arraybuffer, callback, errback) {
            if (!this.offlineAc) {
                this.offlineAc = this.getOfflineAudioContext(this.ac ? this.ac.sampleRate : 44100);
            }
            this.offlineAc.decodeAudioData(arraybuffer, function (data) {
                return callback(data);
            }, errback);
        }

        /**
         * Set pre-decoded peaks
         *
         * @param {number[]|number[][]} peaks
         * @param {?number} duration
         */

    }, {
        key: 'setPeaks',
        value: function setPeaks(peaks, duration) {
            this.explicitDuration = duration;
            this.peaks = peaks;
        }

        /**
         * Set the rendered length (different from the length of the audio).
         *
         * @param {number} length
         */

    }, {
        key: 'setLength',
        value: function setLength(length) {
            // No resize, we can preserve the cached peaks.
            if (this.mergedPeaks && length == 2 * this.mergedPeaks.length - 1 + 2) {
                return;
            }

            this.splitPeaks = [];
            this.mergedPeaks = [];
            // Set the last element of the sparse array so the peak arrays are
            // appropriately sized for other calculations.
            var channels = this.buffer ? this.buffer.numberOfChannels : 1;
            var c = void 0;
            for (c = 0; c < channels; c++) {
                this.splitPeaks[c] = [];
                this.splitPeaks[c][2 * (length - 1)] = 0;
                this.splitPeaks[c][2 * (length - 1) + 1] = 0;
            }
            this.mergedPeaks[2 * (length - 1)] = 0;
            this.mergedPeaks[2 * (length - 1) + 1] = 0;
        }

        /**
         * Compute the max and min value of the waveform when broken into <length> subranges.
         *
         * @param {number} length How many subranges to break the waveform into.
         * @param {number} first First sample in the required range.
         * @param {number} last Last sample in the required range.
         * @return {number[]|number[][]} Array of 2*<length> peaks or array of arrays of
         * peaks consisting of (max, min) values for each subrange.
         */

    }, {
        key: 'getPeaks',
        value: function getPeaks(length, first, last) {
            if (this.peaks) {
                return this.peaks;
            }

            first = first || 0;
            last = last || length - 1;

            this.setLength(length);

            /**
             * The following snippet fixes a buffering data issue on the Safari
             * browser which returned undefined It creates the missing buffer based
             * on 1 channel, 4096 samples and the sampleRate from the current
             * webaudio context 4096 samples seemed to be the best fit for rendering
             * will review this code once a stable version of Safari TP is out
             */
            if (!this.buffer.length) {
                var newBuffer = this.createBuffer(1, 4096, this.sampleRate);
                this.buffer = newBuffer.buffer;
            }

            var sampleSize = this.buffer.length / length;
            var sampleStep = ~~(sampleSize / 10) || 1;
            var channels = this.buffer.numberOfChannels;
            var c = void 0;

            for (c = 0; c < channels; c++) {
                var peaks = this.splitPeaks[c];
                var chan = this.buffer.getChannelData(c);
                var i = void 0;

                for (i = first; i <= last; i++) {
                    var start = ~~(i * sampleSize);
                    var end = ~~(start + sampleSize);
                    var min = 0;
                    var max = 0;
                    var j = void 0;

                    for (j = start; j < end; j += sampleStep) {
                        var value = chan[j];

                        if (value > max) {
                            max = value;
                        }

                        if (value < min) {
                            min = value;
                        }
                    }

                    peaks[2 * i] = max;
                    peaks[2 * i + 1] = min;

                    if (c == 0 || max > this.mergedPeaks[2 * i]) {
                        this.mergedPeaks[2 * i] = max;
                    }

                    if (c == 0 || min < this.mergedPeaks[2 * i + 1]) {
                        this.mergedPeaks[2 * i + 1] = min;
                    }
                }
            }

            return this.params.splitChannels ? this.splitPeaks : this.mergedPeaks;
        }

        /**
         * Get the position from 0 to 1
         *
         * @return {number}
         */

    }, {
        key: 'getPlayedPercents',
        value: function getPlayedPercents() {
            return this.state.getPlayedPercents.call(this);
        }

        /** @private */

    }, {
        key: 'disconnectSource',
        value: function disconnectSource() {
            if (this.source) {
                this.source.disconnect();
            }
        }

        /**
         * This is called when wavesurfer is destroyed
         */

    }, {
        key: 'destroy',
        value: function destroy() {
            if (!this.isPaused()) {
                this.pause();
            }
            this.unAll();
            this.buffer = null;
            this.disconnectFilters();
            this.disconnectSource();
            this.gainNode.disconnect();
            this.scriptNode.disconnect();
            this.analyser.disconnect();

            // close the audioContext if closeAudioContext option is set to true
            if (this.params.closeAudioContext) {
                // check if browser supports AudioContext.close()
                if (typeof this.ac.close === 'function' && this.ac.state != 'closed') {
                    this.ac.close();
                }
                // clear the reference to the audiocontext
                this.ac = null;
                // clear the actual audiocontext, either passed as param or the
                // global singleton
                if (!this.params.audioContext) {
                    window.WaveSurferAudioContext = null;
                } else {
                    this.params.audioContext = null;
                }
                // clear the offlineAudioContext
                window.WaveSurferOfflineAudioContext = null;
            }
        }

        /**
         * Loaded a decoded audio buffer
         *
         * @param {Object} buffer
         */

    }, {
        key: 'load',
        value: function load(buffer) {
            this.startPosition = 0;
            this.lastPlay = this.ac.currentTime;
            this.buffer = buffer;
            this.createSource();
        }

        /** @private */

    }, {
        key: 'createSource',
        value: function createSource() {
            this.disconnectSource();
            this.source = this.ac.createBufferSource();

            // adjust for old browsers
            this.source.start = this.source.start || this.source.noteGrainOn;
            this.source.stop = this.source.stop || this.source.noteOff;

            this.source.playbackRate.setValueAtTime(this.playbackRate, this.ac.currentTime);
            this.source.buffer = this.buffer;
            this.source.connect(this.analyser);
        }

        /**
         * Used by `wavesurfer.isPlaying()` and `wavesurfer.playPause()`
         *
         * @return {boolean}
         */

    }, {
        key: 'isPaused',
        value: function isPaused() {
            return this.state !== this.states[PLAYING];
        }

        /**
         * Used by `wavesurfer.getDuration()`
         *
         * @return {number}
         */

    }, {
        key: 'getDuration',
        value: function getDuration() {
            if (!this.buffer) {
                if (this.explicitDuration) {
                    return this.explicitDuration;
                }
                return 0;
            }
            return this.buffer.duration;
        }

        /**
         * Used by `wavesurfer.seekTo()`
         *
         * @param {number} start Position to start at in seconds
         * @param {number} end Position to end at in seconds
         * @return {{start: number, end: number}}
         */

    }, {
        key: 'seekTo',
        value: function seekTo(start, end) {
            if (!this.buffer) {
                return;
            }

            this.scheduledPause = null;

            if (start == null) {
                start = this.getCurrentTime();
                if (start >= this.getDuration()) {
                    start = 0;
                }
            }
            if (end == null) {
                end = this.getDuration();
            }

            this.startPosition = start;
            this.lastPlay = this.ac.currentTime;

            if (this.state === this.states[FINISHED]) {
                this.setState(PAUSED);
            }

            return {
                start: start,
                end: end
            };
        }

        /**
         * Get the playback position in seconds
         *
         * @return {number}
         */

    }, {
        key: 'getPlayedTime',
        value: function getPlayedTime() {
            return (this.ac.currentTime - this.lastPlay) * this.playbackRate;
        }

        /**
         * Plays the loaded audio region.
         *
         * @param {number} start Start offset in seconds, relative to the beginning
         * of a clip.
         * @param {number} end When to stop relative to the beginning of a clip.
         */

    }, {
        key: 'play',
        value: function play(start, end) {
            if (!this.buffer) {
                return;
            }

            // need to re-create source on each playback
            this.createSource();

            var adjustedTime = this.seekTo(start, end);

            start = adjustedTime.start;
            end = adjustedTime.end;

            this.scheduledPause = end;

            this.source.start(0, start, end - start);

            if (this.ac.state == 'suspended') {
                this.ac.resume && this.ac.resume();
            }

            this.setState(PLAYING);

            this.fireEvent('play');
        }

        /**
         * Pauses the loaded audio.
         */

    }, {
        key: 'pause',
        value: function pause() {
            this.scheduledPause = null;

            this.startPosition += this.getPlayedTime();
            this.source && this.source.stop(0);

            this.setState(PAUSED);

            this.fireEvent('pause');
        }

        /**
         * Returns the current time in seconds relative to the audioclip's
         * duration.
         *
         * @return {number}
         */

    }, {
        key: 'getCurrentTime',
        value: function getCurrentTime() {
            return this.state.getCurrentTime.call(this);
        }

        /**
         * Returns the current playback rate. (0=no playback, 1=normal playback)
         *
         * @return {number}
         */

    }, {
        key: 'getPlaybackRate',
        value: function getPlaybackRate() {
            return this.playbackRate;
        }

        /**
         * Set the audio source playback rate.
         *
         * @param {number} value
         */

    }, {
        key: 'setPlaybackRate',
        value: function setPlaybackRate(value) {
            value = value || 1;
            if (this.isPaused()) {
                this.playbackRate = value;
            } else {
                this.pause();
                this.playbackRate = value;
                this.play();
            }
        }
    }]);

    return WebAudio;
}(util.Observer);

WebAudio.scriptBufferSize = 256;
exports.default = WebAudio;
module.exports = exports['default'];

/***/ })

/******/ });
});
//# sourceMappingURL=wavesurfer.js.map