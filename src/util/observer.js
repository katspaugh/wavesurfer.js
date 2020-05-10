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
    /**
     * Instantiate Observer
     */
    constructor() {
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
     * @return {ListenerDescriptor} The event descriptor
     */
    on(event, fn) {
        if (!this.handlers) {
            this.handlers = {};
        }

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
     *
     * @param {string} event Name of the event the listener that should be
     * removed listens to
     * @param {function} fn The callback that should be removed
     */
    un(event, fn) {
        if (!this.handlers) {
            return;
        }

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
     *
     * @param {string} event The event to listen to
     * @param {function} handler The callback that is only to be called once
     * @return {ListenerDescriptor} The event descriptor
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

    /**
     * Manually fire an event
     *
     * @param {string} event The event to fire manually
     * @param {...any} args The arguments with which to call the listeners
     */
    fireEvent(event, ...args) {
        if (!this.handlers) {
            return;
        }
        const handlers = this.handlers[event];
        handlers &&
            handlers.forEach(fn => {
                fn(...args);
            });
    }
}
