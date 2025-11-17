import { createProgressComponent } from '../progress'

describe('ProgressComponent', () => {
  it('should render progress bar with initial props', () => {
    const progress = createProgressComponent()
    const element = progress.render({
      progress: 0.5,
      height: '100%',
    })

    expect(element.className).toBe('progress')
    expect(element.style.position).toBe('absolute')
    expect(element.style.width).toBe('50%')
    expect(element.style.height).toBe('100%')
    expect(element.style.zIndex).toBe('2')
    expect(element.style.overflow).toBe('hidden')
    expect(element.style.pointerEvents).toBe('none')
  })

  it('should contain inner div for proper overflow', () => {
    const progress = createProgressComponent()
    const element = progress.render({
      progress: 0,
      height: '100%',
    })

    expect(element.children.length).toBe(1)
    const inner = element.children[0] as HTMLElement
    expect(inner.style.position).toBe('relative')
  })

  it('should update progress', () => {
    const progress = createProgressComponent()
    const element = progress.render({
      progress: 0,
      height: '100%',
    })

    expect(element.style.width).toBe('0%')

    progress.update?.({ progress: 0.25 })
    expect(element.style.width).toBe('25%')

    progress.update?.({ progress: 0.5 })
    expect(element.style.width).toBe('50%')

    progress.update?.({ progress: 0.75 })
    expect(element.style.width).toBe('75%')

    progress.update?.({ progress: 1 })
    expect(element.style.width).toBe('100%')
  })

  it('should not have a background color (waveform is in canvases)', () => {
    const progress = createProgressComponent()
    const element = progress.render({
      progress: 0.5,
      height: '100%',
    })

    // Progress component is just a container, no backgroundColor
    expect(element.style.backgroundColor).toBe('')
  })

  it('should update height', () => {
    const progress = createProgressComponent()
    const element = progress.render({
      progress: 0.5,
      height: '100%',
    })

    expect(element.style.height).toBe('100%')

    progress.update?.({ height: '64px' })
    expect(element.style.height).toBe('64px')
  })

  it('should handle partial updates', () => {
    const progress = createProgressComponent()
    const element = progress.render({
      progress: 0.3,
      height: '100%',
    })

    // Update only progress
    progress.update?.({ progress: 0.7 })

    expect(element.style.width).toBe('70%')
    expect(element.style.height).toBe('100%') // Unchanged
  })

  it('should handle rapid progress updates (simulating playback)', () => {
    const progress = createProgressComponent()
    const element = progress.render({
      progress: 0,
      height: '100%',
    })

    // Simulate rapid updates during playback
    for (let i = 0; i <= 100; i += 5) {
      progress.update?.({ progress: i / 100 })
    }

    expect(element.style.width).toBe('100%')
  })

  it('should grow from left to right', () => {
    const progress = createProgressComponent()
    const element = progress.render({
      progress: 0.3,
      height: '100%',
    })

    expect(element.style.left).toBe('0px')
    expect(element.style.top).toBe('0px')
    expect(element.style.position).toBe('absolute')
  })

  it('should be positioned correctly in container', () => {
    const progress = createProgressComponent()
    const element = progress.render({
      progress: 0.5,
      height: '100%',
    })

    const container = document.createElement('div')
    container.style.position = 'relative'
    container.style.width = '1000px'
    container.style.height = '128px'
    container.appendChild(element)

    expect(element.style.position).toBe('absolute')
    expect(element.style.left).toBe('0px')
    expect(element.style.top).toBe('0px')
  })

  it('should cleanup properly', () => {
    const progress = createProgressComponent()
    const element = progress.render({
      progress: 0.5,
      height: '100%',
    })

    const container = document.createElement('div')
    container.appendChild(element)

    expect(container.children.length).toBe(1)

    progress.destroy?.()

    expect(container.children.length).toBe(0)
    expect(progress.element).toBeNull()
  })

  it('should allow multiple independent progress instances', () => {
    const progress1 = createProgressComponent()
    const progress2 = createProgressComponent()

    const element1 = progress1.render({
      progress: 0.3,
      height: '100%',
    })

    const element2 = progress2.render({
      progress: 0.7,
      height: '100%',
    })

    expect(element1.style.width).toBe('30%')
    expect(element2.style.width).toBe('70%')

    progress1.update?.({ progress: 0.5 })
    expect(element1.style.width).toBe('50%')
    expect(element2.style.width).toBe('70%') // Unchanged
  })

  it('should handle edge cases', () => {
    const progress = createProgressComponent()
    const element = progress.render({
      progress: 0,
      height: '100%',
    })

    // Test 0%
    expect(element.style.width).toBe('0%')

    // Test 100%
    progress.update?.({ progress: 1 })
    expect(element.style.width).toBe('100%')

    // Test very small progress
    progress.update?.({ progress: 0.001 })
    expect(element.style.width).toBe('0.1%')
  })
})
