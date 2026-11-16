// review R-1: history v4 undoes a blocked browser Back with go(delta) and then notifies the listeners again with
// the LAST action. Since the phone section is a PUSH, that repeat looked like a second push of the same entry, so the next
// blocked Back counted two steps and «Discard» left Settings. The stack ignores a push of the entry it already stands on.
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSettingsHubGuard } from '../useSettingsHubGuard'

const fakeHistory = () => {
  const listeners = []
  const state = { blocker: null }
  return {
    location: { key: 'list' },
    listen: (listener) => {
      listeners.push(listener)
      return () => listeners.splice(listeners.indexOf(listener), 1)
    },
    block: (blocker) => {
      state.blocker = blocker
      return () => { state.blocker = null }
    },
    go: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    notify: (location, action) => listeners.forEach(listener => listener(location, action)),
    tryLeave: (location, action) => state.blocker?.(location, action)
  }
}

describe('useSettingsHubGuard stack (R-1)', () => {
  const mount = (history) => renderHook(() => useSettingsHubGuard({
    history,
    getCurrentSectionKey: () => 'stripe',
    getCurrentSectionLabel: () => 'Card payments',
    getLocationSectionKey: () => null
  }))

  it('a repeated notification of the entry on screen does not count as another step back', () => {
    const history = fakeHistory()
    const { result } = mount(history)
    act(() => history.notify({ key: 'section' }, 'PUSH'))
    act(() => result.current.report('stripe', { dirty: true, saving: false }))

    // system Back, blocked: Keep editing; history reverts it and repeats the last action (PUSH of the same entry)
    act(() => { expect(history.tryLeave({ key: 'list' }, 'POP')).toBe(false) })
    expect(result.current.pending.delta).toBe(-1)
    act(() => result.current.keepEditing())
    act(() => history.notify({ key: 'section' }, 'PUSH'))

    // system Back again, Discard: one step, back to the list
    act(() => { history.tryLeave({ key: 'list' }, 'POP') })
    expect(result.current.pending.delta).toBe(-1)
    act(() => result.current.discard())
    expect(history.go).toHaveBeenCalledWith(-1)
  })

  it('a real push of another entry still moves the stack forward', () => {
    const history = fakeHistory()
    const { result } = mount(history)
    act(() => history.notify({ key: 'section' }, 'PUSH'))
    act(() => history.notify({ key: 'other' }, 'PUSH'))
    act(() => result.current.report('stripe', { dirty: true, saving: false }))
    act(() => { history.tryLeave({ key: 'list' }, 'POP') })
    expect(result.current.pending.delta).toBe(-2)
  })
})
