export default {
    /**
     * Attach a handler function for an event.
     */
    on: function (event, fn) {
        if (!this.handlers) { this.handlers = {}; }

        let handlers = this.handlers[event];
        if (!handlers) {
            handlers = this.handlers[event] = [];
        }
        handlers.push(fn);

        // Return an event descriptor
        return {
            name: event,
            callback: fn,
            un: (e, fn) => this.un(e, fn)
        };
    },

    /**
     * Remove an event handler.
     */
    un: function (event, fn) {
        if (!this.handlers) { return; }

        const handlers = this.handlers[event];
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
        const fn = () => {
            /*  eslint-disable no-invalid-this, prefer-rest-params */
            handler.apply(this, arguments);
            /*  eslint-enable no-invalid-this, prefer-rest-params */
            setTimeout(() => {
                this.un(event, fn);
            }, 0);
        };
        return this.on(event, fn);
    },

    fireEvent: function (event, ...args) {
        if (!this.handlers) { return; }
        const handlers = this.handlers[event];
        handlers && handlers.forEach(fn => {
            fn(...args);
        });
    }
};
