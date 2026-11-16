// redesign drivers-dashboard B4 (promotion): the stacked-board hook shared by /deliveries and /drivers-dashboard
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { BOARD_STACK_BELOW, useBoardStacked } from '../useBoardStacked'

const mockMatchMedia = (matches) => {
  const listeners = new Set()
  const list = {
    matches,
    media: '',
    addEventListener: (_event, fn) => listeners.add(fn),
    removeEventListener: (_event, fn) => listeners.delete(fn)
  }
  window.matchMedia = vi.fn(() => list)
  return { list, fire: (next) => { list.matches = next; listeners.forEach(fn => fn()) } }
}

describe('useBoardStacked', () => {
  const original = window.matchMedia
  afterEach(() => { window.matchMedia = original })

  it('stacks below 1024px and follows the media query', () => {
    expect(BOARD_STACK_BELOW).toBe(1024)
    const media = mockMatchMedia(true)
    const { result } = renderHook(() => useBoardStacked())
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 1023.98px)')
    expect(result.current).toBe(true)
    act(() => media.fire(false))
    expect(result.current).toBe(false)
  })
})
