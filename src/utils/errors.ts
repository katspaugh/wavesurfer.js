/**
 * Error handling utilities for WaveSurfer.js
 * Provides typed errors and error boundaries
 */

import { Subject, type Stream } from '../streams/index.js'

/**
 * Error codes for different types of failures
 */
export enum ErrorCode {
  // Audio loading errors
  FETCH_ERROR = 'FETCH_ERROR',
  DECODE_ERROR = 'DECODE_ERROR',
  INVALID_AUDIO = 'INVALID_AUDIO',

  // Playback errors
  PLAYBACK_ERROR = 'PLAYBACK_ERROR',
  MEDIA_ERROR = 'MEDIA_ERROR',

  // Rendering errors
  RENDER_ERROR = 'RENDER_ERROR',
  CANVAS_ERROR = 'CANVAS_ERROR',

  // State errors
  STATE_ERROR = 'STATE_ERROR',
  INVALID_STATE = 'INVALID_STATE',

  // Plugin errors
  PLUGIN_ERROR = 'PLUGIN_ERROR',
  PLUGIN_INIT_ERROR = 'PLUGIN_INIT_ERROR',

  // Resource errors
  RESOURCE_ERROR = 'RESOURCE_ERROR',
  DISPOSAL_ERROR = 'DISPOSAL_ERROR',

  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INVALID_ARGUMENT = 'INVALID_ARGUMENT',
}

/**
 * Base error class for WaveSurfer
 */
export class WaveSurferError extends Error {
  public readonly timestamp: number
  public readonly code: ErrorCode
  public readonly context: Record<string, unknown>

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    context: Record<string, unknown> = {}
  ) {
    super(message)
    this.name = 'WaveSurferError'
    this.code = code
    this.context = context
    this.timestamp = Date.now()

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WaveSurferError)
    }
  }

  /**
   * Convert error to JSON
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    }
  }

  /**
   * Create error from unknown error type
   */
  static from(error: unknown, code?: ErrorCode, context?: Record<string, unknown>): WaveSurferError {
    if (error instanceof WaveSurferError) {
      return error
    }

    if (error instanceof Error) {
      const wsError = new WaveSurferError(
        error.message,
        code ?? ErrorCode.UNKNOWN_ERROR,
        { ...context, originalError: error }
      )
      wsError.stack = error.stack
      return wsError
    }

    return new WaveSurferError(
      String(error),
      code ?? ErrorCode.UNKNOWN_ERROR,
      context
    )
  }
}

/**
 * Result type for operations that can fail
 */
export type Result<T, E = WaveSurferError> =
  | { ok: true; value: T }
  | { ok: false; error: E }

/**
 * Create a success result
 */
export function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

/**
 * Create an error result
 */
export function err<E = WaveSurferError>(error: E): Result<never, E> {
  return { ok: false, error }
}

/**
 * Global error stream for all WaveSurfer errors
 */
class ErrorHandler {
  private errorStream = new Subject<WaveSurferError>()

  /**
   * Get the global error stream
   */
  get stream(): Stream<WaveSurferError> {
    return this.errorStream
  }

  /**
   * Emit an error to the global stream
   */
  emit(error: WaveSurferError): void {
    this.errorStream.next(error)
  }

  /**
   * Handle an error - emit to stream and optionally log
   */
  handle(error: unknown, code?: ErrorCode, context?: Record<string, unknown>): WaveSurferError {
    const wsError = WaveSurferError.from(error, code, context)
    this.emit(wsError)
    return wsError
  }

  /**
   * Subscribe to all errors
   */
  subscribe(handler: (error: WaveSurferError) => void) {
    return this.errorStream.subscribe(handler)
  }
}

// Global error handler instance
export const errorHandler = new ErrorHandler()

/**
 * Error boundary for async operations
 */
export async function withErrorBoundary<T>(
  operation: () => Promise<T>,
  errorCode: ErrorCode,
  context?: Record<string, unknown>
): Promise<Result<T, WaveSurferError>> {
  try {
    const value = await operation()
    return ok(value)
  } catch (error) {
    const wsError = WaveSurferError.from(error, errorCode, context)
    errorHandler.emit(wsError)
    return err(wsError)
  }
}

/**
 * Error boundary for synchronous operations
 */
export function withErrorBoundarySync<T>(
  operation: () => T,
  errorCode: ErrorCode,
  context?: Record<string, unknown>
): Result<T, WaveSurferError> {
  try {
    const value = operation()
    return ok(value)
  } catch (error) {
    const wsError = WaveSurferError.from(error, errorCode, context)
    errorHandler.emit(wsError)
    return err(wsError)
  }
}

/**
 * Safely execute a function that might throw
 */
export function tryCatch<T>(
  fn: () => T,
  errorCode: ErrorCode = ErrorCode.UNKNOWN_ERROR
): Result<T, WaveSurferError> {
  return withErrorBoundarySync(fn, errorCode)
}

/**
 * Safely execute an async function that might throw
 */
export async function tryCatchAsync<T>(
  fn: () => Promise<T>,
  errorCode: ErrorCode = ErrorCode.UNKNOWN_ERROR
): Promise<Result<T, WaveSurferError>> {
  return withErrorBoundary(fn, errorCode)
}

/**
 * Assert a condition, throw WaveSurferError if false
 */
export function assert(
  condition: boolean,
  message: string,
  code: ErrorCode = ErrorCode.INVALID_ARGUMENT,
  context?: Record<string, unknown>
): asserts condition {
  if (!condition) {
    throw new WaveSurferError(message, code, context)
  }
}

/**
 * Assert value is not null/undefined
 */
export function assertExists<T>(
  value: T | null | undefined,
  message: string,
  code: ErrorCode = ErrorCode.INVALID_ARGUMENT
): asserts value is T {
  if (value == null) {
    throw new WaveSurferError(message, code)
  }
}
