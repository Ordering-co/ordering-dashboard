// (review): after a ⌘K navigation the watch claimed the page title back every time the destination moved the focus into its
// own panel or field (the h1's focusout runs while <body> is still the active element), so «Order #…» and «Quick Add Product» ended on
// the h1. With `onlyIfLost`, a control that takes the focus by itself ends the watch.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { watchPageStart } from '../watchPageStart'

describe('watchPageStart › onlyIfLost (⌘K)', () => {
  let rects
  beforeEach(() => {
    vi.useFakeTimers()
    // jsdom draws no boxes; focusPageStart only picks a title that has one
    rects = vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}])
    document.body.innerHTML = '<main><h1>Orders list</h1><aside><button type="button">Close panel</button></aside></main>'
  })
  afterEach(() => {
    rects.mockRestore()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('takes the page start when the focus is lost', () => {
    const watch = watchPageStart(null, { onlyIfLost: true })
    watch.arm()
    expect(document.activeElement).toBe(document.querySelector('h1'))
    watch.stop()
  })

  // Chrome moves the focus in two steps: the old element loses it (focusout, <body> active) and then the new one gets it
  const moveFocusLikeChrome = (element) => {
    document.activeElement.blur()
    element.focus()
  }

  it('lets a panel that opens afterwards keep the focus it takes, without pulling it back to the title on the way', () => {
    const watch = watchPageStart(null, { onlyIfLost: true })
    watch.arm()
    const h1 = document.querySelector('h1')
    const titleFocus = vi.fn()
    h1.addEventListener('focus', titleFocus)
    const close = document.querySelector('button')
    moveFocusLikeChrome(close)
    vi.advanceTimersByTime(1000)
    expect(titleFocus).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(close)
    watch.stop()
  })

  it('does not take the focus from a field the destination focused before it armed', () => {
    const watch = watchPageStart(null, { onlyIfLost: true })
    const close = document.querySelector('button')
    close.focus()
    watch.arm()
    vi.advanceTimersByTime(1000)
    expect(document.activeElement).toBe(close)
    watch.stop()
  })
})
