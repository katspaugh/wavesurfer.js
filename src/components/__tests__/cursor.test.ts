import { createCursorComponent } from '../cursor'

describe('CursorComponent', () => {
  it('should render cursor with initial props', () => {
    const cursor = createCursorComponent()
    const element = cursor.render({
      position: 0.5,
      color: '#333',
      width: 2,
      height: '100%',
    })

    expect(element.className).toBe('cursor')
    expect(element.style.position).toBe('absolute')
    expect(element.style.left).toBe('50%')
    expect(element.style.backgroundColor).toBe('rgb(51, 51, 51)')
    expect(element.style.width).toBe('2px')
    expect(element.style.height).toBe('100%')
    expect(element.style.zIndex).toBe('5')
    expect(element.style.pointerEvents).toBe('none')
  })

  it('should update position', () => {
    const cursor = createCursorComponent()
    const element = cursor.render({
      position: 0,
      color: '#333',
      width: 2,
      height: '100%',
    })

    expect(element.style.left).toBe('0%')

    cursor.update?.({ position: 0.25 })
    expect(element.style.left).toBe('25%')

    cursor.update?.({ position: 0.75 })
    expect(element.style.left).toBe('75%')

    cursor.update?.({ position: 1 })
    expect(element.style.left).toBe('100%')
  })

  it('should update color', () => {
    const cursor = createCursorComponent()
    const element = cursor.render({
      position: 0,
      color: '#000',
      width: 2,
      height: '100%',
    })

    expect(element.style.backgroundColor).toBe('rgb(0, 0, 0)')

    cursor.update?.({ color: '#fff' })
    expect(element.style.backgroundColor).toBe('rgb(255, 255, 255)')

    cursor.update?.({ color: 'rgba(255, 0, 0, 0.5)' })
    expect(element.style.backgroundColor).toBe('rgba(255, 0, 0, 0.5)')
  })

  it('should update width', () => {
    const cursor = createCursorComponent()
    const element = cursor.render({
      position: 0,
      color: '#333',
      width: 1,
      height: '100%',
    })

    expect(element.style.width).toBe('1px')

    cursor.update?.({ width: 3 })
    expect(element.style.width).toBe('3px')

    cursor.update?.({ width: 5 })
    expect(element.style.width).toBe('5px')
  })

  it('should update height', () => {
    const cursor = createCursorComponent()
    const element = cursor.render({
      position: 0,
      color: '#333',
      width: 2,
      height: '100%',
    })

    expect(element.style.height).toBe('100%')

    cursor.update?.({ height: '50px' })
    expect(element.style.height).toBe('50px')
  })

  it('should handle partial updates', () => {
    const cursor = createCursorComponent()
    const element = cursor.render({
      position: 0.3,
      color: '#333',
      width: 2,
      height: '100%',
    })

    // Update only position
    cursor.update?.({ position: 0.6 })

    expect(element.style.left).toBe('60%')
    expect(element.style.backgroundColor).toBe('rgb(51, 51, 51)') // Unchanged
    expect(element.style.width).toBe('2px') // Unchanged
  })

  it('should handle rapid position updates (simulating playback)', () => {
    const cursor = createCursorComponent()
    const element = cursor.render({
      position: 0,
      color: '#333',
      width: 2,
      height: '100%',
    })

    // Simulate rapid updates during playback
    for (let i = 0; i <= 100; i += 5) {
      cursor.update?.({ position: i / 100 })
    }

    expect(element.style.left).toBe('100%')
  })

  it('should be positioned correctly in container', () => {
    const cursor = createCursorComponent()
    const element = cursor.render({
      position: 0.5,
      color: '#333',
      width: 2,
      height: '100%',
    })

    const container = document.createElement('div')
    container.style.position = 'relative'
    container.style.width = '1000px'
    container.style.height = '128px'
    container.appendChild(element)

    expect(element.style.position).toBe('absolute')
    expect(element.style.top).toBe('0px')
  })

  it('should cleanup properly', () => {
    const cursor = createCursorComponent()
    const element = cursor.render({
      position: 0,
      color: '#333',
      width: 2,
      height: '100%',
    })

    const container = document.createElement('div')
    container.appendChild(element)

    expect(container.children.length).toBe(1)

    cursor.destroy?.()

    expect(container.children.length).toBe(0)
    expect(cursor.element).toBeNull()
  })

  it('should allow multiple independent cursor instances', () => {
    const cursor1 = createCursorComponent()
    const cursor2 = createCursorComponent()

    const element1 = cursor1.render({
      position: 0.3,
      color: '#333',
      width: 2,
      height: '100%',
    })

    const element2 = cursor2.render({
      position: 0.7,
      color: '#666',
      width: 4,
      height: '100%',
    })

    expect(element1.style.left).toBe('30%')
    expect(element2.style.left).toBe('70%')
    expect(element1.style.backgroundColor).toBe('rgb(51, 51, 51)')
    expect(element2.style.backgroundColor).toBe('rgb(102, 102, 102)')

    cursor1.update?.({ position: 0.5 })
    expect(element1.style.left).toBe('50%')
    expect(element2.style.left).toBe('70%') // Unchanged
  })
})
