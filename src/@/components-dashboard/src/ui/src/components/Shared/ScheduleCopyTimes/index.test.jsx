import React from 'react'
import { render } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { describe, expect, test, vi } from 'vitest'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback || key]
}))

import { ScheduleCopyTimes } from './index'

describe('ScheduleCopyTimes keyboard dismissal', () => {
  test('consumes Escape before the promotion builder can close', () => {
    const onClose = vi.fn()
    const parentEscape = vi.fn()
    window.addEventListener('keydown', parentEscape)
    render(
      <ThemeProvider theme={{ colors: { backgroundPage: '#FFFFFF', borderColor: '#DEE0E3', primary: '#266DF0' } }}>
        <ScheduleCopyTimes
          open
          daysOfWeekIndex={1}
          selectedCopyDays={[]}
          cleanSelectedCopyDays={vi.fn()}
          handleSelectDays={vi.fn()}
          handleApplyScheduleCopyTimes={vi.fn()}
          onClose={onClose}
          onClick={vi.fn()}
        />
      </ThemeProvider>
    )

    const event = new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(parentEscape).not.toHaveBeenCalled()
    window.removeEventListener('keydown', parentEscape)
  })
})
