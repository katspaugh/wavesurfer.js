import { createComponent } from '../component'

describe('createComponent', () => {
  it('should create a component with render method', () => {
    const TestComponent = createComponent<{ text: string }>((props) => {
      const div = document.createElement('div')
      div.textContent = props.text
      return div
    })

    expect(TestComponent.render).toBeDefined()
    expect(TestComponent.update).toBeDefined()
    expect(TestComponent.destroy).toBeDefined()
  })

  it('should render component with initial props', () => {
    const TestComponent = createComponent<{ text: string; className: string }>((props) => {
      const div = document.createElement('div')
      div.textContent = props.text
      div.className = props.className
      return div
    })

    const element = TestComponent.render({ text: 'Hello', className: 'test' })

    expect(element.textContent).toBe('Hello')
    expect(element.className).toBe('test')
  })

  it('should return the rendered element', () => {
    const TestComponent = createComponent<{ id: string }>((props) => {
      const div = document.createElement('div')
      div.id = props.id
      return div
    })

    const element = TestComponent.render({ id: 'test-id' })

    expect(element).toBeInstanceOf(HTMLElement)
    expect(element.id).toBe('test-id')
  })

  it('should store element reference', () => {
    const TestComponent = createComponent<{ text: string }>((props) => {
      const div = document.createElement('div')
      div.textContent = props.text
      return div
    })

    expect(TestComponent.element).toBeNull()

    const element = TestComponent.render({ text: 'Test' })

    expect(TestComponent.element).toBe(element)
  })

  it('should throw error if rendered twice without destroy', () => {
    const TestComponent = createComponent<{ text: string }>((props) => {
      const div = document.createElement('div')
      div.textContent = props.text
      return div
    })

    TestComponent.render({ text: 'First' })

    expect(() => {
      TestComponent.render({ text: 'Second' })
    }).toThrow('Component already rendered')
  })
})

describe('component update', () => {
  it('should update element with new props when update function provided', () => {
    const TestComponent = createComponent<{ text: string; color: string }>(
      (props) => {
        const div = document.createElement('div')
        div.textContent = props.text
        div.style.color = props.color
        return div
      },
      (element, props) => {
        if (props.text !== undefined) {
          element.textContent = props.text
        }
        if (props.color !== undefined) {
          element.style.color = props.color
        }
      },
    )

    const element = TestComponent.render({ text: 'Hello', color: 'red' })
    expect(element.textContent).toBe('Hello')
    expect(element.style.color).toBe('red')

    TestComponent.update?.({ text: 'Updated' })
    expect(element.textContent).toBe('Updated')
    expect(element.style.color).toBe('red') // Unchanged

    TestComponent.update?.({ color: 'blue' })
    expect(element.textContent).toBe('Updated') // Unchanged
    expect(element.style.color).toBe('blue')
  })

  it('should handle partial updates', () => {
    const TestComponent = createComponent<{ a: number; b: number; c: number }>(
      (props) => {
        const div = document.createElement('div')
        div.dataset.a = String(props.a)
        div.dataset.b = String(props.b)
        div.dataset.c = String(props.c)
        return div
      },
      (element, props) => {
        if (props.a !== undefined) element.dataset.a = String(props.a)
        if (props.b !== undefined) element.dataset.b = String(props.b)
        if (props.c !== undefined) element.dataset.c = String(props.c)
      },
    )

    const element = TestComponent.render({ a: 1, b: 2, c: 3 })

    TestComponent.update?.({ b: 20 })

    expect(element.dataset.a).toBe('1')
    expect(element.dataset.b).toBe('20')
    expect(element.dataset.c).toBe('3')
  })

  it('should work without update function', () => {
    const TestComponent = createComponent<{ text: string }>((props) => {
      const div = document.createElement('div')
      div.textContent = props.text
      return div
    })

    const element = TestComponent.render({ text: 'Hello' })

    // Should not throw, but won't actually update
    expect(() => {
      TestComponent.update?.({ text: 'Updated' })
    }).not.toThrow()

    // Element won't be updated without update function
    expect(element.textContent).toBe('Hello')
  })

  it('should throw error if update called before render', () => {
    const TestComponent = createComponent<{ text: string }>((props) => {
      const div = document.createElement('div')
      div.textContent = props.text
      return div
    })

    expect(() => {
      TestComponent.update?.({ text: 'Test' })
    }).toThrow('Component not rendered')
  })
})

describe('component destroy', () => {
  it('should remove element from DOM', () => {
    const TestComponent = createComponent<{ text: string }>((props) => {
      const div = document.createElement('div')
      div.textContent = props.text
      return div
    })

    const container = document.createElement('div')
    const element = TestComponent.render({ text: 'Test' })
    container.appendChild(element)

    expect(container.children.length).toBe(1)

    TestComponent.destroy?.()

    expect(container.children.length).toBe(0)
  })

  it('should call custom destroy function', () => {
    const destroyFn = jest.fn()

    const TestComponent = createComponent<{ text: string }>(
      (props) => {
        const div = document.createElement('div')
        div.textContent = props.text
        return div
      },
      undefined,
      destroyFn,
    )

    TestComponent.render({ text: 'Test' })
    TestComponent.destroy?.()

    expect(destroyFn).toHaveBeenCalledTimes(1)
  })

  it('should clear element reference after destroy', () => {
    const TestComponent = createComponent<{ text: string }>((props) => {
      const div = document.createElement('div')
      div.textContent = props.text
      return div
    })

    TestComponent.render({ text: 'Test' })
    expect(TestComponent.element).not.toBeNull()

    TestComponent.destroy?.()
    expect(TestComponent.element).toBeNull()
  })

  it('should allow re-rendering after destroy', () => {
    const TestComponent = createComponent<{ text: string }>((props) => {
      const div = document.createElement('div')
      div.textContent = props.text
      return div
    })

    const element1 = TestComponent.render({ text: 'First' })
    TestComponent.destroy?.()

    const element2 = TestComponent.render({ text: 'Second' })

    expect(element2).not.toBe(element1)
    expect(element2.textContent).toBe('Second')
  })

  it('should not throw if destroy called without render', () => {
    const TestComponent = createComponent<{ text: string }>((props) => {
      const div = document.createElement('div')
      div.textContent = props.text
      return div
    })

    expect(() => {
      TestComponent.destroy?.()
    }).not.toThrow()
  })
})

describe('component with reactive effects', () => {
  it('should work with manual updates (simulating effects)', () => {
    const TestComponent = createComponent<{ position: number }>(
      (props) => {
        const div = document.createElement('div')
        div.style.left = `${props.position}px`
        return div
      },
      (element, props) => {
        if (props.position !== undefined) {
          element.style.left = `${props.position}px`
        }
      },
    )

    const element = TestComponent.render({ position: 0 })

    // Simulate reactive updates
    for (let i = 0; i <= 100; i += 10) {
      TestComponent.update?.({ position: i })
    }

    expect(element.style.left).toBe('100px')
  })

  it('should handle complex prop types', () => {
    interface ComplexProps {
      data: { value: number }
      callback: () => void
      visible: boolean
    }

    const TestComponent = createComponent<ComplexProps>(
      (props) => {
        const div = document.createElement('div')
        div.dataset.value = String(props.data.value)
        div.style.display = props.visible ? 'block' : 'none'
        div.onclick = props.callback
        return div
      },
      (element, props) => {
        if (props.data !== undefined) {
          element.dataset.value = String(props.data.value)
        }
        if (props.visible !== undefined) {
          element.style.display = props.visible ? 'block' : 'none'
        }
        if (props.callback !== undefined) {
          element.onclick = props.callback
        }
      },
    )

    const callback1 = jest.fn()
    const element = TestComponent.render({
      data: { value: 10 },
      callback: callback1,
      visible: true,
    })

    expect(element.dataset.value).toBe('10')
    expect(element.style.display).toBe('block')

    element.click()
    expect(callback1).toHaveBeenCalled()

    const callback2 = jest.fn()
    TestComponent.update?.({ callback: callback2, visible: false })

    expect(element.style.display).toBe('none')

    element.click()
    expect(callback2).toHaveBeenCalled()
  })
})

describe('TypeScript type safety', () => {
  it('should enforce prop types at compile time', () => {
    interface ButtonProps {
      text: string
      disabled: boolean
    }

    const ButtonComponent = createComponent<ButtonProps>(
      (props) => {
        const button = document.createElement('button')
        button.textContent = props.text
        button.disabled = props.disabled
        return button
      },
      (element, props) => {
        const button = element as HTMLButtonElement
        if (props.text !== undefined) button.textContent = props.text
        if (props.disabled !== undefined) button.disabled = props.disabled
      },
    )

    // Valid usage
    const button = ButtonComponent.render({ text: 'Click me', disabled: false })
    ButtonComponent.update?.({ disabled: true })

    expect(button.textContent).toBe('Click me')
    expect((button as HTMLButtonElement).disabled).toBe(true)

    // TypeScript would catch these errors:
    // ButtonComponent.render({ text: 123, disabled: false }) // Error: text must be string
    // ButtonComponent.update({ text: 'Hi', invalid: true }) // Error: invalid is not in ButtonProps
  })
})
