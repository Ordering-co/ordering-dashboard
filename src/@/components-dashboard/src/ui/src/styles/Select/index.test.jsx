import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { describe, expect, test, vi } from 'vitest'

vi.mock('../../../../index', () => ({
  useSession: () => [{}]
}))

vi.mock('react-popper', () => ({
  usePopper: () => ({ styles: {}, attributes: {}, update: vi.fn() })
}))

import { Select } from './index'

const theme = {
  colors: {
    backgroundPage: '#FFFFFF',
    borderColor: '#DEE0E3',
    headingColor: '#0B0C0D',
    primary: '#266DF0',
    secundary: '#F6F7F7'
  }
}

describe('Select keyboard dismissal', () => {
  test('handles Escape inside the open select before a parent dialog sees it', async () => {
    const parentEscape = vi.fn()
    window.addEventListener('keydown', parentEscape)
    const { unmount } = render(
      <ThemeProvider theme={theme}>
        <Select
          placeholder='Choose'
          options={[{ value: 1, content: 'One' }]}
          onChange={vi.fn()}
        />
      </ThemeProvider>
    )

    fireEvent.click(screen.getByText('Choose'))
    const event = new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true })
    act(() => window.dispatchEvent(event))

    expect(event.defaultPrevented).toBe(true)
    expect(parentEscape).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByText('One').closest('.list')).toHaveStyle({ display: 'none' }))
    window.removeEventListener('keydown', parentEscape)
    unmount()
  })
})
