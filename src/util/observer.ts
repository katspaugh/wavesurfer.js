type ListenerDescriptor = {
    /**
     * The name of the event
     */
    name: string;

    /**
     * The callback
     */
    callback: Function;

    /**
     * The function to call to remove the listener
     */
    un: Function;
}

/**
 * Observer class
 */
export default class Observer {
    private _disabledEventEmissions: string[];

    private handlers: any;

    /**
     * Instantiate Observer
     */
    constructor() {
        /**
         * @private
         * @todo Initialise the handlers here already and remove the conditional
         * assignment in `on()`
         */
        this._disabledEventEmissions = [];
        this.handlers = null;
    }
    /**
     * Attach a handler function for an event.
     *
     * @param event Name of the event to listen to
     * @param fn The callback to trigger when the event is fired
     * @return The event descriptor
     */
    on(event: string, fn: Function): ListenerDescriptor {
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
            un: (e: string, fn: Function) => this.un(e, fn)
        };
    }

    /**
     * Remove an event handler.
     *
     * @param event Name of the event the listener that should be
     * removed listens to
     * @param fn The callback that should be removed
     */
    un(event: string, fn: Function): void {
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
    unAll(): void {
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
    once(event: string, handler: Function): ListenerDescriptor {
        const fn = (...args: any[]) => {
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
     * Disable firing a list of events by name. When specified, event handlers for any event type
     * passed in here will not be called.
     *
     * @since 4.0.0
     * @param eventNames an array of event names to disable emissions for
     * @example
     * // disable seek and interaction events
     * wavesurfer.setDisabledEventEmissions(['seek', 'interaction']);
     */
    setDisabledEventEmissions(eventNames: string[]): void {
        this._disabledEventEmissions = eventNames;
    }

    /**
     * plugins borrow part of this class without calling the constructor,
     * so we have to be careful about _disabledEventEmissions
     */
    _isDisabledEventEmission(event: string): boolean {
        return this._disabledEventEmissions && this._disabledEventEmissions.includes(event);
    }

    /**
     * Manually fire an event
     *
     * @param event The event to fire manually
     * @param args The arguments with which to call the listeners
     */
    fireEvent(event: string, ...args: any[]): void {
        if (!this.handlers || this._isDisabledEventEmission(event)) {
            return;
        }

        const handlers = this.handlers[event];
        handlers &&
            handlers.forEach((fn: Function) => {
                fn(...args);
            });
    }
}
