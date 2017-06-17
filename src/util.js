/* Common utilities */
WaveSurfer.util = {
    requestAnimationFrame: (
        window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback, element) { setTimeout(callback, 1000 / 60); }
    ).bind(window),

    frame: function (func) {
        return function () {
            var my = this, args = arguments;
            WaveSurfer.util.requestAnimationFrame(function () {
                func.apply(my, args);
            });
        };
    },

    extend: function (dest) {
        var sources = Array.prototype.slice.call(arguments, 1);
        sources.forEach(function (source) {
            Object.keys(source).forEach(function (key) {
                dest[key] = source[key];
            });
        });
        return dest;
    },

    deepMerge: function (target, obj, levels) {
        if (obj === null || typeof(obj) != 'object' || 'isActiveClone' in obj) { return (typeof(target) != 'object') ? obj : target; }
        if (target === null || typeof(target) != 'object') {
            var target = (obj instanceof Date) ? new obj.constructor() : obj.constructor();
        }
        for (var key in obj) {
            if (!Object.prototype.hasOwnProperty.call(obj, key)) { continue; }
            obj.isActiveClone = null;
            target[key] = (obj[key] instanceof Element || (levels !== undefined && levels == 0)) ?
                obj[key] : this.deepMerge(target[key], obj[key], levels === undefined ? undefined : levels - 1);
            delete obj.isActiveClone;
        }
        return target;
    },

    setAliases: function (init) {
        var targetObject = init.target.object, targetProperty = init.target.property;
        if (init.styleSource) {
            var setExtra = function (n) { styleSourceObject[styleSourceProperty] = n; };
            var styleSourceObject = init.styleSource.object, styleSourceProperty = init.styleSource.property;
            var styleSourcePropertyUnderscore = styleSourceProperty.replace(/([A-Z])/g, '-$1').toLowerCase();
            Object.defineProperty(styleSourceObject, styleSourceProperty, {
                get: function () { return this.getPropertyValue(styleSourcePropertyUnderscore); },
                set: function (n) {targetObject[targetProperty] = n; this.setProperty(styleSourcePropertyUnderscore, n); }
            });
        }
        init.sourceList.forEach(function (source) {
            if (source.get) {
                var get = function () { return source.get(targetObject[targetProperty]); };
            } else {
                var get = function () { return targetObject[targetProperty]; };
            }
            if (source.set) {
                if (setExtra) {
                    var set = function (value) { setExtra(value); targetObject[targetProperty] = source.set(value); };
                } else {
                    var set = function (value) { targetObject[targetProperty] = source.set(value); };
                }
            } else {
                if (setExtra) {
                    var set = function (value) { setExtra(value); targetObject[targetProperty] = value; };
                } else {
                    var set = function (value) { targetObject[targetProperty] = value; };
                }
            }
            Object.defineProperty(source.object, source.property, { configurable: true, get: get, set: set });
        });
    },

    refreshAliases: function (aliases, changes) {
        for (var aliasName in aliases) {
            var alias = aliases[aliasName];
            if (changes[aliasName]) { WaveSurfer.util.deepMerge(alias, changes[aliasName], 1); }
            WaveSurfer.util.setAliases(alias);
        }
    },

    debounce: function (func, wait, immediate) {
        var args, context, timeout;
        var later = function() {
            timeout = null;
            if (!immediate) {
                func.apply(context, args);
            }
        };
        return function() {
            context = this;
            args = arguments;
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (!timeout) {
                timeout = setTimeout(later, wait);
            }
            if (callNow) {
                func.apply(context, args);
            }
        };
    },

    min: function (values) {
        var min = +Infinity;
        for (var i in values) {
            if (values[i] < min) {
                min = values[i];
            }
        }

        return min;
    },

    max: function (values) {
        var max = -Infinity;
        for (var i in values) {
            if (values[i] > max) {
                max = values[i];
            }
        }

        return max;
    },

    getId: function () {
        return 'wavesurfer_' + Math.random().toString(32).substring(2);
    },

    ajax: function (options) {
        var ajax = Object.create(WaveSurfer.Observer);
        var xhr = new XMLHttpRequest();
        var fired100 = false;

        xhr.open(options.method || 'GET', options.url, true);
        xhr.responseType = options.responseType || 'json';

        xhr.addEventListener('progress', function (e) {
            ajax.fireEvent('progress', e);
            if (e.lengthComputable && e.loaded == e.total) {
                fired100 = true;
            }
        });

        xhr.addEventListener('load', function (e) {
            if (!fired100) {
                ajax.fireEvent('progress', e);
            }
            ajax.fireEvent('load', e);

            if (200 == xhr.status || 206 == xhr.status) {
                ajax.fireEvent('success', xhr.response, e);
            } else {
                ajax.fireEvent('error', e);
            }
        });

        xhr.addEventListener('error', function (e) {
            ajax.fireEvent('error', e);
        });

        xhr.send();
        ajax.xhr = xhr;
        return ajax;
    }
};

/* Observer */
WaveSurfer.Observer = {
    /**
     * Attach a handler function for an event.
     */
    on: function (event, fn) {
        if (!this.handlers) { this.handlers = {}; }

        var handlers = this.handlers[event];
        if (!handlers) {
            handlers = this.handlers[event] = [];
        }
        handlers.push(fn);

        // Return an event descriptor
        return {
            name: event,
            callback: fn,
            un: this.un.bind(this, event, fn)
        };
    },

    /**
     * Remove an event handler.
     */
    un: function (event, fn) {
        if (!this.handlers) { return; }

        var handlers = this.handlers[event];
        if (handlers) {
            if (fn) {
                for (var i = handlers.length - 1; i >= 0; i--) {
                    if (handlers[i] == fn) {
                        handlers.splice(i, 1);
                    }
                }
            } else {
                handlers.length = 0;
            }
        }
    },

    /**
     * Remove all event handlers.
     */
    unAll: function () {
        this.handlers = null;
    },

    /**
     * Attach a handler to an event. The handler is executed at most once per
     * event type.
     */
    once: function (event, handler) {
        var my = this;
        var fn = function () {
            handler.apply(this, arguments);
            setTimeout(function () {
                my.un(event, fn);
            }, 0);
        };
        return this.on(event, fn);
    },

    fireEvent: function (event) {
        if (!this.handlers) { return; }
        var handlers = this.handlers[event];
        var args = Array.prototype.slice.call(arguments, 1);
        handlers && handlers.forEach(function (fn) {
            fn.apply(null, args);
        });
    }
};

/* Make the main WaveSurfer object an observer */
WaveSurfer.util.extend(WaveSurfer, WaveSurfer.Observer);
