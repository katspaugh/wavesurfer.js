import { Scope } from './scope'
import { isHTMLElement, createElement } from './dom'

/**
 * Resolve a container option: element, selector, or fallback.
 * Throws with the plugin name on failure.
 */
export function resolveContainer(
  option: HTMLElement | string | undefined,
  fallback: HTMLElement,
  pluginName: string,
): HTMLElement {
  if (option === undefined) {
    return fallback
  }

  if (isHTMLElement(option)) {
    return option
  }

  // option is a string selector
  const element = document.querySelector(option)
  if (!isHTMLElement(element)) {
    throw new Error(`${pluginName}: container not found: ${option}`)
  }

  return element
}

/**
 * Create an absolutely-positioned overlay div, appended to parent.
 * Removed on scope dispose.
 */
export function overlayElement(scope: Scope, parent: HTMLElement, style?: Partial<CSSStyleDeclaration>): HTMLElement {
  const el = createElement('div', {}, parent)
  el.style.position = 'absolute'
  if (style) {
    Object.assign(el.style, style)
  }
  scope.add(() => el.remove())
  return el
}

/**
 * Forward events from one emitter to another.
 * Unsubscribes on scope dispose.
 */
export function bridgeEvents<Events extends Record<string, unknown[]>>(
  scope: Scope,
  from: { on: (e: never, cb: never) => () => void },
  to: { emit: (e: never, ...args: never[]) => void },
  names: Array<keyof Events & string>,
): void {
  names.forEach((name) => {
    const unsubscribe = from.on(
      name as never,
      ((...args: unknown[]) => to.emit(name as never, ...(args as never[]))) as never,
    )
    scope.add(unsubscribe)
  })
}
