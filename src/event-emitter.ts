export type GeneralEventTypes = {
  // the name of the event and the data it dispatches with
  // e.g. 'entryCreated': [count: 1]
  [EventName: string]: unknown[]
}

type EventListener<EventTypes extends GeneralEventTypes, EventName extends keyof EventTypes> = (
  ...args: EventTypes[EventName]
) => void

type EventMap<EventTypes extends GeneralEventTypes> = {
  [EventName in keyof EventTypes]: Set<EventListener<EventTypes, EventName>>
}

/** A simple event emitter that can be used to listen to and emit events. */
class EventEmitter<EventTypes extends GeneralEventTypes> {
  private listeners = {} as EventMap<EventTypes>

  /** Subscribe to an event. Returns an unsubscribe function. */
  public on<EventName extends keyof EventTypes>(
    event: EventName,
    listener: EventListener<EventTypes, EventName>,
    options?: { once?: boolean },
  ): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set()
    }

    if (options?.once) {
      // Create a wrapper that removes itself after being called once
      const onceWrapper: EventListener<EventTypes, EventName> = (...args) => {
        this.un(event, onceWrapper)
        listener(...args)
      }
      this.listeners[event].add(onceWrapper)
      return () => this.un(event, onceWrapper)
    }

    this.listeners[event].add(listener)
    return () => this.un(event, listener)
  }

  /** Unsubscribe from an event */
  public un<EventName extends keyof EventTypes>(
    event: EventName,
    listener: EventListener<EventTypes, EventName>,
  ): void {
    this.listeners[event]?.delete(listener)
  }

  /** Subscribe to an event only once */
  public once<EventName extends keyof EventTypes>(
    event: EventName,
    listener: EventListener<EventTypes, EventName>,
  ): () => void {
    return this.on(event, listener, { once: true })
  }

  /** Clear all events */
  public unAll(): void {
    this.listeners = {} as EventMap<EventTypes>
  }

  /** Emit an event */
  protected emit<EventName extends keyof EventTypes>(eventName: EventName, ...args: EventTypes[EventName]): void {
    if (this.listeners[eventName]) {
      this.listeners[eventName].forEach((listener) => listener(...args))
    }
  }
}

export default EventEmitter
