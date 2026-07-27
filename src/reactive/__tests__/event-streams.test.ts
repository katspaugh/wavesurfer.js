import { fromEvent, cleanup } from '../event-streams'

describe('fromEvent', () => {
  let button: HTMLButtonElement

  beforeEach(() => {
    button = document.createElement('button')
  })

  it('should convert DOM events to signal', () => {
    const clicks = fromEvent(button, 'click')
    const callback = jest.fn()

    clicks.subscribe(callback)
    button.click()

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ type: 'click' }))
  })

  it('should start with null value', () => {
    const clicks = fromEvent(button, 'click')
    expect(clicks.value).toBeNull()
  })

  it('should update signal on each event', () => {
    const clicks = fromEvent(button, 'click')
    const values: any[] = []

    clicks.subscribe((event) => values.push(event))

    button.click()
    button.click()

    expect(values).toHaveLength(2)
    expect(values[0]).toMatchObject({ type: 'click' })
    expect(values[1]).toMatchObject({ type: 'click' })
  })

  it('should cleanup event listener on cleanup()', () => {
    const clicks = fromEvent(button, 'click')
    const callback = jest.fn()

    clicks.subscribe(callback)
    button.click()
    expect(callback).toHaveBeenCalledTimes(1)

    cleanup(clicks)
    button.click()
    expect(callback).toHaveBeenCalledTimes(1) // Should not increase
  })

  it('should work with different event types', () => {
    const input = document.createElement('input')
    const changes = fromEvent(input, 'change')
    const callback = jest.fn()

    changes.subscribe(callback)
    input.dispatchEvent(new Event('change'))

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ type: 'change' }))
  })
})
