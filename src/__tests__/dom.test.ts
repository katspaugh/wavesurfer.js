import createElement, { isHTMLElement } from '../dom.js'

describe('isHTMLElement', () => {
  test('accepts elements from the current realm', () => {
    expect(isHTMLElement(document.createElement('div'))).toBe(true)
  })

  test('accepts element-like objects from another realm (e.g. an iframe)', () => {
    // A realistic cross-realm HTML element: `instanceof HTMLElement` fails,
    // but the core element traits are all present.
    const foreign = {
      nodeType: 1,
      nodeName: 'DIV',
      namespaceURI: 'http://www.w3.org/1999/xhtml',
      style: {},
      appendChild: () => undefined,
    }
    expect(isHTMLElement(foreign)).toBe(true)
  })

  test('rejects non-elements', () => {
    expect(isHTMLElement(null)).toBe(false)
    expect(isHTMLElement(undefined)).toBe(false)
    expect(isHTMLElement('#container')).toBe(false)
    expect(isHTMLElement({})).toBe(false)
    expect(isHTMLElement(document.createTextNode('text'))).toBe(false)
  })

  test('rejects SVG elements (not HTML, even though they have nodeType 1 and style)', () => {
    expect(isHTMLElement(document.createElementNS('http://www.w3.org/2000/svg', 'svg'))).toBe(false)
  })

  test('rejects element-shaped objects missing core element traits', () => {
    // The old check accepted any {nodeType: 1, style: object} bag.
    expect(isHTMLElement({ nodeType: 1, style: {} })).toBe(false)
    expect(
      isHTMLElement({
        nodeType: 1,
        nodeName: 'DIV',
        namespaceURI: 'http://www.w3.org/1999/xhtml',
        style: null, // typeof null === 'object' slipped through the old check
        appendChild: () => undefined,
      }),
    ).toBe(false)
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
