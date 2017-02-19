/**
 * @typedef {Object} ListenerDescriptor
 * @property {string} name The name of the event
 * @property {function} callback The callback
 * @property {function} un The function to call to remove the listener
 */

/**
 * Observer class
 */
export default class Observer {
    constructor() {
    }
    /**
     * Attach a handler function for an event.
     */
    on(event, fn) {
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
    }

    /**
     * Remove an event handler.
     */
    un(event, fn) {
        if (!this.handlers) { return; }

        const handlers = this.handlers[event];
        let i;
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
    unAll() {
        this.handlers = null;
    }

    /**
     * Attach a handler to an event. The handler is executed at most once per
     * event type.
     */
    once(event, handler) {
        const fn = (...args) => {
            /*  eslint-disable no-invalid-this */
            handler.apply(this, args);
            /*  eslint-enable no-invalid-this */
            setTimeout(() => {
                this.un(event, fn);
            }, 0);
        };
        return this.on(event, fn);
    }

    fireEvent(event, ...args) {
        if (!this.handlers) { return; }
        const handlers = this.handlers[event];
        handlers && handlers.forEach(fn => {
            fn(...args);
        });
    }
}
