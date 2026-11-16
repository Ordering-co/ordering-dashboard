// redesign W0-5 (T0-17, G9)
import { describe, expect, it } from 'vitest'
import {
  BREAKPOINT_CONTAINER_NARROW,
  BREAKPOINT_PHONE,
  BREAKPOINT_SPLIT,
  BREAKPOINT_SPLIT_NARROW_UNTIL,
  CONTAINER_NARROW_DOWN,
  PHONE_DOWN,
  PHONE_DOWN_PX,
  PHONE_UP,
  SPLIT_DOWN,
  SPLIT_NARROW_DOWN,
  SPLIT_UP,
  TOUCH_OR_PHONE,
  maxWidthBelow
} from '../breakpoints'

describe('breakpoints (G9)', () => {
  it('holds the three values of the proposal', () => {
    expect([BREAKPOINT_PHONE, BREAKPOINT_SPLIT, BREAKPOINT_CONTAINER_NARROW]).toEqual([768, 1280, 600])
    expect(BREAKPOINT_SPLIT_NARROW_UNTIL).toBe(1359)
  })

  it('spells the media queries', () => {
    expect(PHONE_DOWN).toBe('(max-width: 767.98px)')
    expect(PHONE_DOWN_PX).toBe('(max-width: 767px)')
    expect(PHONE_UP).toBe('(min-width: 768px)')
    expect(SPLIT_UP).toBe('(min-width: 1280px)')
    expect(SPLIT_DOWN).toBe('(max-width: 1279.98px)')
    expect(SPLIT_NARROW_DOWN).toBe('(max-width: 1359px)')
    expect(CONTAINER_NARROW_DOWN).toBe('(max-width: 599px)')
    expect(maxWidthBelow(100)).toBe('(max-width: 99.98px)')
  })

  it('keeps the touch trigger exactly as the stylesheets have it (767px is < 768)', () => {
    expect(TOUCH_OR_PHONE).toBe('(pointer: coarse), (max-width: 767px)')
  })

  it('has no gap or overlap between phone and overlay at whole pixels', () => {
    const matchesPx = (query, width) => {
      const max = /max-width: ([\d.]+)px/.exec(query)
      const min = /min-width: ([\d.]+)px/.exec(query)
      return (!max || width <= Number(max[1])) && (!min || width >= Number(min[1]))
    }
    for (let width = 760; width <= 775; width += 1) {
      expect(matchesPx(PHONE_DOWN_PX, width)).toBe(width < BREAKPOINT_PHONE)
      expect(matchesPx(PHONE_DOWN, width)).toBe(width < BREAKPOINT_PHONE)
      expect(matchesPx(PHONE_UP, width)).toBe(width >= BREAKPOINT_PHONE)
    }
  })
})
