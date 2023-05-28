export type GeneralEventTypes = {
  // the name of the event and the data it dispatches with
  // e.g. 'entryCreated': [count: 1]
  [EventName: string]: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
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
    eventName: EventName,
    listener: EventListener<EventTypes, EventName>,
  ): () => void {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = new Set()
    }
    this.listeners[eventName].add(listener)

    return () => this.un(eventName, listener)
  }

  /** Subscribe to an event only once */
  public once<EventName extends keyof EventTypes>(
    eventName: EventName,
    listener: EventListener<EventTypes, EventName>,
  ): () => void {
    // The actual subscription
    const unsubscribe = this.on(eventName, listener)

    // Another subscription that will unsubscribe the actual subscription and itself after the first event
    const unsubscribeOnce = this.on(eventName, () => {
      unsubscribe()
      unsubscribeOnce()
    })

    return unsubscribe
  }

  /** Unsubscribe from an event */
  public un<EventName extends keyof EventTypes>(
    eventName: EventName,
    listener: EventListener<EventTypes, EventName>,
  ): void {
    if (this.listeners[eventName]) {
      if (listener) {
        this.listeners[eventName].delete(listener)
      } else {
        delete this.listeners[eventName]
      }
    }
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
