/**
 * Enhanced EventEmitter - Bridge between classic API and reactive streams
 * Maintains backward compatibility while providing stream-based access
 */

import { Subject, type Stream } from './streams/index.js'

export type GeneralEventTypes = {
  [EventName: string]: unknown[]
}

type EventListener<EventTypes extends GeneralEventTypes, EventName extends keyof EventTypes> = (
  ...args: EventTypes[EventName]
) => void

type EventMap<EventTypes extends GeneralEventTypes> = {
  [EventName in keyof EventTypes]: Set<EventListener<EventTypes, EventName>>
}

type StreamMap<EventTypes extends GeneralEventTypes> = {
  [EventName in keyof EventTypes]?: Subject<EventTypes[EventName]>
}

/**
 * Enhanced event emitter that supports both classic .on() API and stream-based subscriptions
 */
class EventEmitter<EventTypes extends GeneralEventTypes> {
  private listeners = {} as EventMap<EventTypes>
  private streams = {} as StreamMap<EventTypes>

  /**
   * Subscribe to an event (classic API)
   * Returns an unsubscribe function
   */
  public on<EventName extends keyof EventTypes>(
    event: EventName,
    listener: EventListener<EventTypes, EventName>,
    options?: { once?: boolean },
  ): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set()
    }

    if (options?.once) {
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

  /**
   * Unsubscribe from an event
   */
  public un<EventName extends keyof EventTypes>(
    event: EventName,
    listener: EventListener<EventTypes, EventName>,
  ): void {
    this.listeners[event]?.delete(listener)
  }

  /**
   * Subscribe to an event only once
   */
  public once<EventName extends keyof EventTypes>(
    event: EventName,
    listener: EventListener<EventTypes, EventName>,
  ): () => void {
    return this.on(event, listener, { once: true })
  }

  /**
   * Clear all events
   */
  public unAll(): void {
    this.listeners = {} as EventMap<EventTypes>
    // Complete all streams
    Object.values(this.streams).forEach((stream) => {
      if (stream && !stream.closed) {
        stream.complete()
      }
    })
    this.streams = {} as StreamMap<EventTypes>
  }

  /**
   * Emit an event to all listeners (both classic and stream-based)
   */
  protected emit<EventName extends keyof EventTypes>(
    eventName: EventName,
    ...args: EventTypes[EventName]
  ): void {
    // Emit to classic listeners
    if (this.listeners[eventName]) {
      this.listeners[eventName].forEach((listener) => {
        try {
          listener(...args)
        } catch (error) {
          console.error(`Error in event listener for "${String(eventName)}":`, error)
        }
      })
    }

    // Emit to stream subscribers
    if (this.streams[eventName]) {
      this.streams[eventName]!.next(args)
    }
  }

  /**
   * Get a stream for a specific event
   * The stream emits arrays of event arguments
   */
  public getEventStream<EventName extends keyof EventTypes>(
    event: EventName
  ): Stream<EventTypes[EventName]> {
    if (!this.streams[event]) {
      this.streams[event] = new Subject<EventTypes[EventName]>()
    }
    return this.streams[event]!
  }

  /**
   * Get a stream that emits the first argument of each event
   * Convenient for events with a single argument
   */
  public getEventValue<EventName extends keyof EventTypes>(
    event: EventName
  ): Stream<EventTypes[EventName][0]> {
    return this.getEventStream(event).map((args) => args[0])
  }

  /**
   * Check if an event has any listeners
   */
  public hasListeners<EventName extends keyof EventTypes>(event: EventName): boolean {
    const hasClassicListeners = this.listeners[event]?.size > 0
    const hasStreamSubscribers = this.streams[event]?.observerCount ?? 0 > 0
    return hasClassicListeners || hasStreamSubscribers
  }

  /**
   * Get the total number of listeners for an event
   */
  public listenerCount<EventName extends keyof EventTypes>(event: EventName): number {
    const classicCount = this.listeners[event]?.size ?? 0
    const streamCount = this.streams[event]?.observerCount ?? 0
    return classicCount + streamCount
  }
}

export default EventEmitter
