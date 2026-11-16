// (review): the collapse button keeps its node and its focus when the menu becomes the rail, so the rail label never got the
// pointer or focus event that places it: it showed at the top of the rail, off the button. Entering the rail with the focus inside places it.
import React from 'react'
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RailItem } from '../AccountMenu'

describe('RailItem › entering the rail with the focus inside', () => {
  afterEach(() => vi.restoreAllMocks())

  it('places the label at the control it wraps', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: 12, height: 32, bottom: 44, left: 0, right: 32, width: 32 })
    const { rerender, container } = render(<RailItem label='Expand sidebar' bare><button type='button'>toggle</button></RailItem>)
    container.querySelector('button').focus()

    rerender(<RailItem label='Expand sidebar'><button type='button'>toggle</button></RailItem>)

    expect(container.querySelector('.odc-rail-item').style.getPropertyValue('--odc-tip-y')).toBe('28px')
  })

  it('leaves the label alone when the focus is elsewhere', () => {
    const { rerender, container } = render(<RailItem label='Expand sidebar' bare><button type='button'>toggle</button></RailItem>)
    rerender(<RailItem label='Expand sidebar'><button type='button'>toggle</button></RailItem>)
    expect(container.querySelector('.odc-rail-item').style.getPropertyValue('--odc-tip-y')).toBe('')
  })
})
