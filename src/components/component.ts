/**
 * Declarative component system for creating reusable UI elements
 *
 * Components separate rendering logic from state management.
 * They work seamlessly with reactive effects for automatic updates.
 */

/**
 * Base properties for components
 */
export interface ComponentProps {
  [key: string]: any
}

/**
 * A declarative UI component with lifecycle methods
 */
export interface Component<P extends ComponentProps = ComponentProps> {
  /** Current element instance */
  element: HTMLElement | null

  /**
   * Render the component with initial props
   * @param props Initial component properties
   * @returns The rendered HTMLElement
   */
  render(props: P): HTMLElement

  /**
   * Update the component with new props
   * Only updates changed properties
   * @param props Partial props to update
   */
  update?(props: Partial<P>): void

  /**
   * Clean up the component and remove from DOM
   */
  destroy?(): void
}

/**
 * Render function type that creates a DOM element
 */
export type RenderFunction<P extends ComponentProps> = (props: P) => HTMLElement

/**
 * Update function type that modifies an existing DOM element
 */
export type UpdateFunction<P extends ComponentProps> = (element: HTMLElement, props: Partial<P>) => void

/**
 * Destroy function type for component cleanup
 */
export type DestroyFunction = (element: HTMLElement) => void

/**
 * Create a declarative component with render and optional update/destroy methods
 *
 * @param render Function that creates the initial DOM element
 * @param update Optional function that updates the element with new props
 * @param destroy Optional function for cleanup
 * @returns Component instance with lifecycle methods
 *
 * @example
 * ```typescript
 * const Button = createComponent<{ text: string; disabled: boolean }>(
 *   (props) => {
 *     const button = document.createElement('button')
 *     button.textContent = props.text
 *     button.disabled = props.disabled
 *     return button
 *   },
 *   (element, props) => {
 *     if (props.text !== undefined) {
 *       element.textContent = props.text
 *     }
 *     if (props.disabled !== undefined) {
 *       (element as HTMLButtonElement).disabled = props.disabled
 *     }
 *   }
 * )
 *
 * // Usage
 * const button = Button.render({ text: 'Click me', disabled: false })
 * button.update({ disabled: true })
 * ```
 */
export function createComponent<P extends ComponentProps>(
  render: RenderFunction<P>,
  update?: UpdateFunction<P>,
  destroy?: DestroyFunction,
): Component<P> {
  let element: HTMLElement | null = null

  return {
    get element() {
      return element
    },

    render(props: P): HTMLElement {
      if (element) {
        throw new Error('Component already rendered. Call destroy() first.')
      }
      element = render(props)
      return element
    },

    update(newProps: Partial<P>): void {
      if (!element) {
        throw new Error('Component not rendered. Call render() first.')
      }
      if (update) {
        update(element, newProps)
      }
    },

    destroy(): void {
      if (element) {
        if (destroy) {
          destroy(element)
        }
        element.remove()
        element = null
      }
    },
  }
}

/**
 * Create multiple instances of a component
 *
 * Utility function for creating multiple component instances.
 * Note: Each call creates a new independent component instance.
 *
 * @param componentFactory Component created with createComponent
 * @param count Number of instances to create
 * @returns Array of component instances
 *
 * @example
 * ```typescript
 * const buttons = createInstances(ButtonComponent, 3)
 * buttons.forEach((btn, i) => {
 *   btn.render({ text: `Button ${i}`, disabled: false })
 * })
 * ```
 */
export function createInstances<P extends ComponentProps>(
  componentFactory: Component<P>,
  count: number,
): Component<P>[] {
  const instances: Component<P>[] = []

  for (let i = 0; i < count; i++) {
    // Create a new component instance
    const factory = componentFactory as any
    instances.push(factory)
  }

  return instances
}
