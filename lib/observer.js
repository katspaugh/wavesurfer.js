var Observer = (function () {
    'use strict';

    return {
        on: function (event, fn) {
            if (!this.handlers) { this.handlers = {}; }

            var handlers = this.handlers[event];
            if (!handlers) {
                handlers = this.handlers[event] = [];
            }
            handlers.push(fn);
        },

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

        fireEvent: function (event, data) {
            if (!this.handlers) { return; }

            var handlers = this.handlers[event];
            if (handlers) {
                for (var i = 0, len = handlers.length; i < len; i += 1) {
                    handlers[i](data);
                }
            }
        }
    };
}());
