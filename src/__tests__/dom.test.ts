import createElement, { isHTMLElement } from '../dom.js'

describe('isHTMLElement', () => {
  test('accepts elements from the current realm', () => {
    expect(isHTMLElement(document.createElement('div'))).toBe(true)
  })

  test('accepts element-like objects from another realm (e.g. an iframe)', () => {
    const foreign = { nodeType: 1, style: {} }
    expect(isHTMLElement(foreign)).toBe(true)
  })

  test('rejects non-elements', () => {
    expect(isHTMLElement(null)).toBe(false)
    expect(isHTMLElement(undefined)).toBe(false)
    expect(isHTMLElement('#container')).toBe(false)
    expect(isHTMLElement({})).toBe(false)
    expect(isHTMLElement(document.createTextNode('text'))).toBe(false)
  })
})

describe('createElement', () => {
  test('creates DOM structure', () => {
    const container = document.createElement('div')
    const el = createElement(
      'div',
      {
        id: 'root',
        children: {
          span: { textContent: 'child' },
        },
      },
      container,
    )

    expect(container.firstChild).toBe(el)
    expect((el as HTMLElement).id).toBe('root')
    expect(el.querySelector('span')?.textContent).toBe('child')
  })
})
