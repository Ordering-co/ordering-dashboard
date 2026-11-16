// redesign my-products R1-02: `useKeepFocus` gives the focus back after a save that disabled the control that started it.
// Covered: focus lost on <body> goes back to the control; a control that cannot take it (disabled, aria-disabled, gone) sends it to the
// fallback (a node, a ref or a function); focus that moved somewhere else on purpose is left alone; nothing runs before the timeout.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { useKeepFocus } from '../useKeepFocus'

const mount = (tag = 'button', attrs = {}) => {
  const node = document.createElement(tag)
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value))
  document.body.appendChild(node)
  return node
}

const finish = (hook, fallback) => {
  act(() => { hook.result.current.restore(fallback) })
  act(() => { vi.runAllTimers() })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('useKeepFocus', () => {
  // redesign my-products R1-02: a click that does not focus its button (Safari) starts from <body>
  it('a save started from <body> sends the focus to the fallback', () => {
    const hook = renderHook(() => useKeepFocus())
    const status = mount('p', { tabindex: '-1' })
    act(() => { hook.result.current.remember() })
    finish(hook, status)
    expect(document.activeElement).toBe(status)
  })

  it('with preferFallback (a failed save) the focus goes to the fallback even if the control could take it', () => {
    const hook = renderHook(() => useKeepFocus())
    const save = mount('button')
    const notice = mount('div', { tabindex: '-1' })
    save.focus()
    act(() => { hook.result.current.remember() })
    save.blur()
    act(() => { hook.result.current.restore(notice, { preferFallback: true }) })
    act(() => { vi.runAllTimers() })
    expect(document.activeElement).toBe(notice)
  })

  it('without a fallback it waits for a control that is still disabled, then gives it the focus', () => {
    const hook = renderHook(() => useKeepFocus())
    const field = mount('input')
    field.focus()
    act(() => { hook.result.current.remember() })
    field.blur()
    field.disabled = true
    act(() => { hook.result.current.restore() })
    act(() => { vi.advanceTimersByTime(1) })
    expect(document.activeElement).toBe(document.body)
    field.disabled = false
    act(() => { vi.runAllTimers() })
    expect(document.activeElement).toBe(field)
  })

  it('focus lost on <body> goes back to the control that started the save', () => {
    const hook = renderHook(() => useKeepFocus())
    const save = mount('button')
    const status = mount('p', { tabindex: '-1' })
    save.focus()
    act(() => { hook.result.current.remember() })
    save.blur()
    expect(document.activeElement).toBe(document.body)
    finish(hook, status)
    expect(document.activeElement).toBe(save)
  })

  it('waits for the timeout: nothing moves in the same tick as restore()', () => {
    const hook = renderHook(() => useKeepFocus())
    const save = mount('button')
    save.focus()
    act(() => { hook.result.current.remember() })
    save.blur()
    act(() => { hook.result.current.restore() })
    expect(document.activeElement).toBe(document.body)
    act(() => { vi.runAllTimers() })
    expect(document.activeElement).toBe(save)
  })

  it('a disabled control cannot take the focus: it goes to the fallback node', () => {
    const hook = renderHook(() => useKeepFocus())
    const save = mount('button')
    const status = mount('p', { tabindex: '-1' })
    save.focus()
    act(() => { hook.result.current.remember() })
    // a browser drops the focus on <body> when the focused control becomes disabled; jsdom keeps it, so it is dropped first
    save.blur()
    save.disabled = true
    expect(document.activeElement).toBe(document.body)
    finish(hook, status)
    expect(document.activeElement).toBe(status)
  })

  it('an aria-disabled control goes to the fallback too, and the fallback can be a ref or a function', () => {
    const hook = renderHook(() => useKeepFocus())
    const save = mount('button', { 'aria-disabled': 'true' })
    const viaRef = mount('p', { tabindex: '-1' })
    const viaFunction = mount('p', { tabindex: '-1' })

    save.focus()
    act(() => { hook.result.current.remember() })
    save.blur()
    finish(hook, { current: viaRef })
    expect(document.activeElement).toBe(viaRef)

    document.activeElement.blur()
    save.focus()
    act(() => { hook.result.current.remember() })
    save.blur()
    finish(hook, () => viaFunction)
    expect(document.activeElement).toBe(viaFunction)
  })

  it('a control that left the page goes to the fallback', () => {
    const hook = renderHook(() => useKeepFocus())
    const field = mount('input')
    const status = mount('p', { tabindex: '-1' })
    field.focus()
    act(() => { hook.result.current.remember() })
    field.remove()
    expect(document.activeElement).toBe(document.body)
    finish(hook, status)
    expect(document.activeElement).toBe(status)
  })

  it('focus moved somewhere else on purpose is not touched', () => {
    const hook = renderHook(() => useKeepFocus())
    const save = mount('button')
    const other = mount('input')
    const status = mount('p', { tabindex: '-1' })
    save.focus()
    act(() => { hook.result.current.remember() })
    save.disabled = true
    other.focus()
    finish(hook, status)
    expect(document.activeElement).toBe(other)
  })

  it('focus that never left the control stays there, and a second restore() without remember() has nothing to give back', () => {
    const hook = renderHook(() => useKeepFocus())
    const field = mount('input')
    const status = mount('p', { tabindex: '-1' })
    field.focus()
    act(() => { hook.result.current.remember() })
    finish(hook, status)
    expect(document.activeElement).toBe(field)

    field.blur()
    finish(hook, status)
    expect(document.activeElement).toBe(status)
  })
})
