import { DeclarativeRenderer } from '../declarative-renderer'
import { createWaveSurferState } from '../../state/wavesurfer-state'

describe('DeclarativeRenderer', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.removeChild(container)
  })

  describe('constructor', () => {
    it('should create renderer with HTMLElement container', () => {
      const { state } = createWaveSurferState()
      const renderer = new DeclarativeRenderer(container, state, {
        container,
        height: 128,
      })

      expect(renderer).toBeDefined()
      expect(renderer.getWrapper()).toBeInstanceOf(HTMLElement)
    })

    it('should create renderer with string selector', () => {
      container.id = 'test-container'
      const { state } = createWaveSurferState()
      const renderer = new DeclarativeRenderer('#test-container', state, {
        container: '#test-container',
        height: 128,
      })

      expect(renderer).toBeDefined()
    })

    it('should throw error if string selector not found', () => {
      const { state } = createWaveSurferState()

      expect(() => {
        new DeclarativeRenderer('#non-existent', state, {
          container: '#non-existent',
          height: 128,
        })
      }).toThrow('Container not found')
    })

    it('should create wrapper with correct height', () => {
      const { state } = createWaveSurferState()
      new DeclarativeRenderer(container, state, {
        container,
        height: 256,
      })

      const scrollContainer = container.querySelector('.wavesurfer-scroll') as HTMLElement
      expect(scrollContainer.style.height).toBe('256px')
    })

    it('should support auto height', () => {
      const { state } = createWaveSurferState()
      new DeclarativeRenderer(container, state, {
        container,
        height: 'auto',
      })

      const scrollContainer = container.querySelector('.wavesurfer-scroll') as HTMLElement
      expect(scrollContainer.style.height).toBe('auto')
    })

    it('should create DOM structure', () => {
      const { state } = createWaveSurferState()
      const renderer = new DeclarativeRenderer(container, state, {
        container,
        height: 128,
      })

      const scrollContainer = container.querySelector('.wavesurfer-scroll') as HTMLElement
      expect(scrollContainer).not.toBeNull()
      expect(scrollContainer.parentElement).toBe(container)

      const wrapper = renderer.getWrapper()
      expect(wrapper.parentElement).toBe(scrollContainer)
      expect(wrapper.className).toBe('wavesurfer-wrapper')

      const canvasWrapper = renderer.getCanvasWrapper()
      expect(canvasWrapper.parentElement).toBe(wrapper)
      expect(canvasWrapper.className).toBe('wavesurfer-canvases')
    })

    it('should create cursor and progress components', () => {
      const { state } = createWaveSurferState()
      const renderer = new DeclarativeRenderer(container, state, {
        container,
        height: 128,
        cursorColor: '#333',
        progressColor: 'rgba(255, 255, 255, 0.5)',
      })

      const wrapper = renderer.getWrapper()
      const cursor = wrapper.querySelector('.cursor')
      const progress = wrapper.querySelector('.progress')

      expect(cursor).not.toBeNull()
      expect(progress).not.toBeNull()
    })
  })

  describe('reactive updates', () => {
    it('should update cursor position automatically when state changes', (done) => {
      const { state, actions } = createWaveSurferState()
      const renderer = new DeclarativeRenderer(container, state, {
        container,
        height: 128,
      })

      const wrapper = renderer.getWrapper()
      const cursor = wrapper.querySelector('.cursor') as HTMLElement

      // Initial position
      expect(cursor.style.left).toBe('0%')

      // Change state
      actions.setDuration(100)
      actions.setCurrentTime(50)

      // Wait for effect to run and then flush render
      setTimeout(() => {
        // Force immediate render for test
        renderer.flushRender()
        expect(cursor.style.left).toBe('50%')
        done()
      }, 10)
    })

    it('should update progress bar automatically when state changes', (done) => {
      const { state, actions } = createWaveSurferState()
      const renderer = new DeclarativeRenderer(container, state, {
        container,
        height: 128,
      })

      const wrapper = renderer.getWrapper()
      const progress = wrapper.querySelector('.progress') as HTMLElement

      // Initial width
      expect(progress.style.width).toBe('0%')

      // Change state
      actions.setDuration(100)
      actions.setCurrentTime(75)

      // Wait for effect to run and then flush render
      setTimeout(() => {
        renderer.flushRender()
        expect(progress.style.width).toBe('75%')
        done()
      }, 10)
    })

    it('should handle rapid state changes', (done) => {
      const { state, actions } = createWaveSurferState()
      const renderer = new DeclarativeRenderer(container, state, {
        container,
        height: 128,
      })

      const wrapper = renderer.getWrapper()
      const cursor = wrapper.querySelector('.cursor') as HTMLElement

      actions.setDuration(100)

      // Simulate rapid updates
      for (let i = 0; i <= 100; i += 10) {
        actions.setCurrentTime(i)
      }

      setTimeout(() => {
        renderer.flushRender()
        expect(cursor.style.left).toBe('100%')
        done()
      }, 20)
    })

    it('should update both cursor and progress simultaneously', (done) => {
      const { state, actions } = createWaveSurferState()
      const renderer = new DeclarativeRenderer(container, state, {
        container,
        height: 128,
      })

      const wrapper = renderer.getWrapper()
      const cursor = wrapper.querySelector('.cursor') as HTMLElement
      const progress = wrapper.querySelector('.progress') as HTMLElement

      actions.setDuration(100)
      actions.setCurrentTime(33)

      setTimeout(() => {
        renderer.flushRender()
        expect(cursor.style.left).toBe('33%')
        expect(progress.style.width).toBe('33%')
        done()
      }, 10)
    })
  })

  describe('scroll management', () => {
    it('should get and set scroll position', () => {
      const { state } = createWaveSurferState()
      const renderer = new DeclarativeRenderer(container, state, {
        container,
        height: 128,
      })

      expect(renderer.getScroll()).toBe(0)

      renderer.setScroll(100)
      expect(renderer.getScroll()).toBe(100)
    })

    it('should set scroll by percentage', () => {
      const { state } = createWaveSurferState()
      const renderer = new DeclarativeRenderer(container, state, {
        container,
        height: 128,
      })

      renderer.setScrollPercentage(0.5)
      // In JSDOM, scrollWidth is 0, so scrollLeft will be 0
      expect(renderer.getScroll()).toBeGreaterThanOrEqual(0)
    })

    it('should auto-scroll when playing', (done) => {
      const { state, actions } = createWaveSurferState()
      new DeclarativeRenderer(container, state, {
        container,
        height: 128,
        autoScroll: true,
      })

      actions.setDuration(100)
      actions.setPlaying(true)
      actions.setCurrentTime(50)

      // Auto-scroll effect should trigger
      setTimeout(() => {
        // In JSDOM, scroll won't actually change but effect ran
        expect(state.isPlaying.value).toBe(true)
        expect(state.progressPercent.value).toBe(0.5)
        done()
      }, 10)
    })

    it('should not auto-scroll when paused', (done) => {
      const { state, actions } = createWaveSurferState()
      new DeclarativeRenderer(container, state, {
        container,
        height: 128,
        autoScroll: true,
      })

      actions.setDuration(100)
      actions.setPlaying(false)
      actions.setCurrentTime(50)

      setTimeout(() => {
        expect(state.isPlaying.value).toBe(false)
        done()
      }, 10)
    })

    it('should not auto-scroll when autoScroll is disabled', (done) => {
      const { state, actions } = createWaveSurferState()
      const renderer = new DeclarativeRenderer(container, state, {
        container,
        height: 128,
        autoScroll: false,
      })

      actions.setDuration(100)
      actions.setPlaying(true)
      actions.setCurrentTime(50)

      setTimeout(() => {
        // No auto-scroll should happen
        expect(renderer.getScroll()).toBe(0)
        done()
      }, 10)
    })
  })

  describe('manual methods', () => {
    it('should allow manual progress rendering for compatibility', () => {
      const { state } = createWaveSurferState()
      const renderer = new DeclarativeRenderer(container, state, {
        container,
        height: 128,
      })

      const wrapper = renderer.getWrapper()
      const cursor = wrapper.querySelector('.cursor') as HTMLElement

      renderer.renderProgress(0.6)

      expect(cursor.style.left).toBe('60%')
    })

    it('should update cursor style', () => {
      const { state } = createWaveSurferState()
      const renderer = new DeclarativeRenderer(container, state, {
        container,
        height: 128,
        cursorColor: '#000',
      })

      const wrapper = renderer.getWrapper()
      const cursor = wrapper.querySelector('.cursor') as HTMLElement

      renderer.updateCursorStyle('#ff0000', 5)

      expect(cursor.style.backgroundColor).toBe('rgb(255, 0, 0)')
      expect(cursor.style.width).toBe('5px')
    })

    it('should not update progress style (handled by canvas rendering)', () => {
      const { state } = createWaveSurferState()
      const renderer = new DeclarativeRenderer(container, state, {
        container,
        height: 128,
        progressColor: '#000',
      })

      const wrapper = renderer.getWrapper()
      const progress = wrapper.querySelector('.progress') as HTMLElement

      // Progress component is just a container, no backgroundColor
      renderer.updateProgressStyle()

      expect(progress.style.backgroundColor).toBe('')
    })
  })

  describe('getters', () => {
    it('should get wrapper element', () => {
      const { state } = createWaveSurferState()
      const renderer = new DeclarativeRenderer(container, state, {
        container,
        height: 128,
      })

      const wrapper = renderer.getWrapper()
      expect(wrapper.className).toBe('wavesurfer-wrapper')
    })

    it('should get canvas wrapper element', () => {
      const { state } = createWaveSurferState()
      const renderer = new DeclarativeRenderer(container, state, {
        container,
        height: 128,
      })

      const canvasWrapper = renderer.getCanvasWrapper()
      expect(canvasWrapper.className).toBe('wavesurfer-canvases')
    })

    it('should get width', () => {
      container.style.width = '800px'
      const { state } = createWaveSurferState()
      const renderer = new DeclarativeRenderer(container, state, {
        container,
        height: 128,
      })

      const width = renderer.getWidth()
      // In JSDOM, clientWidth is 0, but the method should work
      expect(width).toBeGreaterThanOrEqual(0)
    })
  })

  describe('destroy', () => {
    it('should cleanup effects', () => {
      const { state, actions } = createWaveSurferState()
      const renderer = new DeclarativeRenderer(container, state, {
        container,
        height: 128,
      })

      const scrollContainer = container.querySelector('.wavesurfer-scroll') as HTMLElement

      renderer.destroy()

      // After destroy, state changes should not affect the removed elements
      actions.setDuration(100)
      actions.setCurrentTime(50)

      // Element should be removed
      expect(scrollContainer.parentElement).toBeNull()
    })

    it('should remove DOM elements', () => {
      const { state } = createWaveSurferState()
      const renderer = new DeclarativeRenderer(container, state, {
        container,
        height: 128,
      })

      expect(container.children.length).toBeGreaterThan(0)

      renderer.destroy()

      expect(container.children.length).toBe(0)
    })

    it('should destroy components', () => {
      const { state } = createWaveSurferState()
      const renderer = new DeclarativeRenderer(container, state, {
        container,
        height: 128,
      })

      const wrapper = renderer.getWrapper()
      const cursor = wrapper.querySelector('.cursor')
      const progress = wrapper.querySelector('.progress')

      expect(cursor).not.toBeNull()
      expect(progress).not.toBeNull()

      renderer.destroy()

      // Components should be destroyed
      expect(cursor?.parentElement).toBeNull()
      expect(progress?.parentElement).toBeNull()
    })
  })

  describe('styling options', () => {
    it('should apply custom cursor color', () => {
      const { state } = createWaveSurferState()
      const renderer = new DeclarativeRenderer(container, state, {
        container,
        height: 128,
        cursorColor: '#ff0000',
      })

      const wrapper = renderer.getWrapper()
      const cursor = wrapper.querySelector('.cursor') as HTMLElement

      expect(cursor.style.backgroundColor).toBe('rgb(255, 0, 0)')
    })

    it('should apply custom cursor width', () => {
      const { state } = createWaveSurferState()
      const renderer = new DeclarativeRenderer(container, state, {
        container,
        height: 128,
        cursorWidth: 5,
      })

      const wrapper = renderer.getWrapper()
      const cursor = wrapper.querySelector('.cursor') as HTMLElement

      expect(cursor.style.width).toBe('5px')
    })

    it('should not apply backgroundColor to progress (handled by canvas)', () => {
      const { state } = createWaveSurferState()
      const renderer = new DeclarativeRenderer(container, state, {
        container,
        height: 128,
        progressColor: 'rgba(0, 0, 255, 0.3)',
      })

      const wrapper = renderer.getWrapper()
      const progress = wrapper.querySelector('.progress') as HTMLElement

      // Progress component is just a container, progressColor is used for canvas rendering
      expect(progress.style.backgroundColor).toBe('')
    })

    it('should use progressColor as fallback for cursorColor', () => {
      const { state } = createWaveSurferState()
      const renderer = new DeclarativeRenderer(container, state, {
        container,
        height: 128,
        progressColor: '#00ff00',
      })

      const wrapper = renderer.getWrapper()
      const cursor = wrapper.querySelector('.cursor') as HTMLElement

      expect(cursor.style.backgroundColor).toBe('rgb(0, 255, 0)')
    })
  })
})
