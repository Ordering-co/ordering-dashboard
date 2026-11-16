/* eslint-disable import/first */
// redesign F2 (C18): the content of a dropdown row. Media 20px (round for people, rounded square for
// businesses), the label, and the secondary data as a muted second column, never in parentheses.
import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SelectOptionContent } from './SelectOption'

describe('SelectOptionContent', () => {
  it('draws a person as a round avatar, a business as a square one', () => {
    const { container, rerender } = render(<SelectOptionContent label='Marco Test' media={{ kind: 'person', name: 'Marco Test' }} />)
    expect(container.querySelector('.odc-avatar')).toHaveAttribute('data-kind', 'person')
    rerender(<SelectOptionContent label='Fast Bite' media={{ kind: 'business', name: 'Fast Bite' }} />)
    expect(container.querySelector('.odc-avatar')).toHaveAttribute('data-kind', 'business')
  })

  it('falls back to initials when there is no picture, and to the picture when there is one', () => {
    const { container, rerender } = render(<SelectOptionContent label='Marco Test' media={{ kind: 'person', name: 'Marco Test' }} />)
    expect(container.querySelector('.odc-avatar-initials')).toHaveTextContent('MT')
    rerender(<SelectOptionContent label='Marco Test' media={{ kind: 'person', name: 'Marco Test', src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }} />)
    expect(container.querySelector('.odc-avatar img')).not.toBeNull()
  })

  it('has no media slot without media', () => {
    const { container } = render(<SelectOptionContent label='Pending' />)
    expect(container.querySelector('.odc-avatar')).toBeNull()
    expect(container.querySelector('.odc-so-label')).toHaveTextContent('Pending')
  })

  it('puts the secondary data in a second column at the end, without parentheses', () => {
    const { container } = render(<SelectOptionContent label='Marco Test' meta='0 Assigned orders' />)
    const [label, meta] = container.querySelector('.odc-so').children
    expect(label).toHaveClass('odc-so-label')
    expect(meta).toHaveClass('odc-so-meta')
    expect(meta).toHaveTextContent('0 Assigned orders')
    expect(container.textContent).not.toMatch(/[()]/)
  })

  it('omits the meta column when there is nothing to say', () => {
    const { container } = render(<SelectOptionContent label='Pending' meta='' />)
    expect(container.querySelector('.odc-so-meta')).toBeNull()
  })
})
