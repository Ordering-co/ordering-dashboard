import { readFileSync } from 'node:fs'
import path from 'node:path'
import React from 'react'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SaveBar } from '../SaveBar'

// redesign UF-B1b: the bar promoted from Settings. It has no text of its own: every string is a prop.

const moreText = n => `+${n}`

const baseProps = {
  label: 'Save changes',
  count: 0,
  discardLabel: 'Discard',
  saveLabel: 'Save changes',
  savedText: 'Saved',
  moreText,
  onDiscard: vi.fn(),
  onSave: vi.fn()
}

const renderBar = (props = {}) => render(<SaveBar {...baseProps} {...props} />)

describe('SaveBar (UF-B1b)', () => {
  it('draws nothing while there is nothing to say', () => {
    const { container } = renderBar()
    expect(container).toBeEmptyDOMElement()
  })

  it('is a named group with the consumer class, and a missing label throws (an empty one paints empty)', () => {
    const view = renderBar({ count: 1, countText: '1 unsaved change', className: 'consumer-class' })
    const bar = screen.getByRole('group', { name: 'Save changes' })
    expect(bar).toHaveClass('odc-savebar')
    expect(bar).toHaveClass('consumer-class')
    view.unmount()

    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderBar({ label: undefined, count: 1, countText: '1 unsaved change' })).toThrow(/label/)
    expect(() => renderBar({ label: null, count: 1, countText: '1 unsaved change' })).toThrow(/label/)
    error.mockRestore()

    renderBar({ label: '', count: 1, countText: '1 unsaved change' })
    expect(screen.getByRole('group')).toHaveAttribute('aria-label', '')
  })

  it('shows the count text and lists up to three names with «+n» from moreText', () => {
    const view = renderBar({ count: 1, countText: '1 unsaved change', names: ['Tax'] })
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    expect(screen.getByText(/Tax/)).toBeInTheDocument()

    view.rerender(<SaveBar {...baseProps} count={5} countText='5 unsaved changes' names={['A', 'B', 'C', 'D', 'E']} />)
    expect(screen.getByText('5 unsaved changes')).toBeInTheDocument()
    expect(screen.getByText(/A, B, C \+2/)).toBeInTheDocument()
    expect(screen.queryByText(/\bD\b/)).toBeNull()
  })

  it('needs moreText only when the names overflow', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderBar({ count: 4, countText: '4', names: ['A', 'B', 'C', 'D'], moreText: undefined })).toThrow(/moreText/)
    error.mockRestore()
    renderBar({ count: 3, countText: '3', names: ['A', 'B', 'C'], moreText: undefined })
    expect(screen.getByText(/A, B, C/)).toBeInTheDocument()
  })

  it('offers Discard and Save and calls their handlers', async () => {
    const onDiscard = vi.fn()
    const onSave = vi.fn()
    renderBar({ count: 2, countText: '2 unsaved changes', onDiscard, onSave })

    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(onDiscard).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('needs discardLabel and saveLabel when there are changes', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderBar({ count: 1, countText: '1', discardLabel: undefined })).toThrow(/discardLabel/)
    expect(() => renderBar({ count: 1, countText: '1', saveLabel: undefined })).toThrow(/saveLabel/)
    error.mockRestore()
    renderBar({ count: 0, saved: true, discardLabel: undefined, saveLabel: undefined })
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
  })

  it('marks Save busy and blocks Discard and repeated saves while saving', async () => {
    const onDiscard = vi.fn()
    const onSave = vi.fn()
    renderBar({ count: 2, countText: '2 unsaved changes', saving: true, onDiscard, onSave })

    const save = screen.getByRole('button', { name: 'Save changes' })
    expect(save).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('group')).toHaveAttribute('data-saving', '')
    expect(screen.getByRole('button', { name: 'Discard' })).toBeDisabled()
    await userEvent.click(save)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows the error text as an alert, and not while a save is running', () => {
    const view = renderBar({ count: 2, countText: '2 unsaved changes', errorText: 'Fix 3 fields to save.' })
    expect(screen.getByRole('alert')).toHaveTextContent('Fix 3 fields to save.')

    view.rerender(<SaveBar {...baseProps} count={2} countText='2 unsaved changes' saving errorText='Fix 3 fields to save.' />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps the bar visible for an error with no pending change (the consumer decides what to say)', () => {
    renderBar({ count: 0, errorText: 'We couldn\'t save your changes. Server unavailable' })
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn\'t save your changes. Server unavailable')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows «Saved» as a status when the changes are stored, and not next to new unsaved changes', () => {
    const view = renderBar({ count: 0, saved: true })
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
    expect(screen.queryByRole('button')).toBeNull()

    view.rerender(<SaveBar {...baseProps} count={1} countText='1 unsaved change' saved />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('needs savedText when it paints the saved status', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderBar({ count: 0, saved: true, savedText: undefined })).toThrow(/savedText/)
    error.mockRestore()
  })

  it('moves the focus to the «Saved» status when the Save button that had it goes away', async () => {
    const view = renderBar({ count: 1, countText: '1 unsaved change' })
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    view.rerender(<SaveBar {...baseProps} count={0} saved />)
    expect(screen.getByRole('status')).toHaveFocus()
  })

  it('does not steal the focus when the save was not pressed from the bar', async () => {
    const view = render(
      <div>
        <input aria-label='Elsewhere' />
        <SaveBar {...baseProps} count={1} countText='1 unsaved change' />
      </div>
    )
    await userEvent.click(screen.getByLabelText('Elsewhere'))
    view.rerender(
      <div>
        <input aria-label='Elsewhere' />
        <SaveBar {...baseProps} count={0} saved />
      </div>
    )
    expect(screen.getByLabelText('Elsewhere')).toHaveFocus()
  })

  it('gives the focus back to the form selected by formSelector when «Saved» ends with the focus inside the bar', async () => {
    const Page = (props) => (
      <div>
        <div className='consumer-form' tabIndex={-1} data-testid='form' />
        <SaveBar {...baseProps} formSelector='.consumer-form' {...props} />
      </div>
    )
    const view = render(<Page count={1} countText='1 unsaved change' />)
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    view.rerender(<Page count={0} saved />)
    expect(screen.getByRole('status')).toHaveFocus()
    view.rerender(<Page count={0} saved={false} />)
    expect(screen.getByTestId('form')).toHaveFocus()
  })

  it('looks for a surrounding <form> by default (a bar rendered inside the form)', async () => {
    const Page = (props) => (
      <form tabIndex={-1} data-testid='form' onSubmit={event => event.preventDefault()}>
        <input aria-label='Name' />
        <SaveBar {...baseProps} {...props} />
      </form>
    )
    const view = render(<Page count={1} countText='1 unsaved change' />)
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    view.rerender(<Page count={0} saved />)
    expect(screen.getByRole('status')).toHaveFocus()
    view.rerender(<Page count={0} saved={false} />)
    expect(screen.getByTestId('form')).toHaveFocus()
  })

  describe('saveType', () => {
    it('is a plain button by default: inside a form it does not submit', async () => {
      const onSubmit = vi.fn(event => event.preventDefault())
      const onSave = vi.fn()
      render(
        <form onSubmit={onSubmit}>
          <SaveBar {...baseProps} count={1} countText='1 unsaved change' onSave={onSave} />
        </form>
      )
      const save = screen.getByRole('button', { name: 'Save changes' })
      expect(save).toHaveAttribute('type', 'button')
      await userEvent.click(save)
      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('«submit» submits the surrounding form from the button and with Enter in a field, and onSave is optional', async () => {
      const onSubmit = vi.fn(event => event.preventDefault())
      render(
        <form onSubmit={onSubmit}>
          <input aria-label='Name' />
          <SaveBar {...baseProps} count={1} countText='1 unsaved change' saveType='submit' onSave={undefined} />
        </form>
      )
      const save = screen.getByRole('button', { name: 'Save changes' })
      expect(save).toHaveAttribute('type', 'submit')
      await userEvent.click(save)
      expect(onSubmit).toHaveBeenCalledTimes(1)

      await userEvent.type(screen.getByLabelText('Name'), 'x{Enter}')
      expect(onSubmit).toHaveBeenCalledTimes(2)
    })

    it('«submit» is a plain button while saving, so a click cannot submit twice', async () => {
      const onSubmit = vi.fn(event => event.preventDefault())
      render(
        <form onSubmit={onSubmit}>
          <SaveBar {...baseProps} count={1} countText='1 unsaved change' saveType='submit' saving />
        </form>
      )
      const save = screen.getByRole('button', { name: 'Save changes' })
      expect(save).toHaveAttribute('type', 'button')
      await userEvent.click(save)
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('«submit» still calls onSave when it is given', async () => {
      const onSubmit = vi.fn(event => event.preventDefault())
      const onSave = vi.fn()
      render(
        <form onSubmit={onSubmit}>
          <SaveBar {...baseProps} count={1} countText='1 unsaved change' saveType='submit' onSave={onSave} />
        </form>
      )
      await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })
  })

  // redesign stores 2.A (decision 4): the opt-in retry after the error text
  describe('retry (stores 2.A)', () => {
    const failed = { count: 2, countText: '2 unsaved changes', errorText: 'We couldn\'t save your changes.' }

    // review F3-R7: beside the alert, not inside it, so its label is not read as part of the error
    it('draws a ghost retry button right after the alert, outside it', () => {
      renderBar({ ...failed, onRetry: vi.fn(), retryLabel: 'Try again' })
      const alert = screen.getByRole('alert')
      const retry = screen.getByRole('button', { name: 'Try again' })
      expect(within(alert).queryByRole('button')).toBeNull()
      expect(retry).toHaveAttribute('data-variant', 'ghost')
      expect(retry).toHaveAttribute('data-size', 'sm')
      expect(alert.nextElementSibling).toBe(retry)
      expect(alert).toHaveTextContent('We couldn\'t save your changes.')
    })

    it('calls onRetry once on click, and neither onSave nor onDiscard', async () => {
      const onRetry = vi.fn()
      const onSave = vi.fn()
      const onDiscard = vi.fn()
      renderBar({ ...failed, onRetry, retryLabel: 'Try again', onSave, onDiscard })
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(onRetry).toHaveBeenCalledTimes(1)
      expect(onSave).not.toHaveBeenCalled()
      expect(onDiscard).not.toHaveBeenCalled()
    })

    it('is absent without onRetry, even when a retryLabel is given', () => {
      renderBar({ ...failed, retryLabel: 'Try again' })
      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
      expect(screen.getByRole('alert').parentElement.querySelector('button')).toBeNull()
    })

    it('is absent while saving (the error is not drawn then)', () => {
      renderBar({ ...failed, saving: true, onRetry: vi.fn(), retryLabel: 'Try again' })
      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    })

    it('is absent when there is no error, and does not ask for its label then', () => {
      renderBar({ count: 2, countText: '2 unsaved changes', onRetry: vi.fn() })
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('draws for an error with no pending change too', async () => {
      const onRetry = vi.fn()
      renderBar({ count: 0, errorText: 'Server unavailable', onRetry, retryLabel: 'Try again' })
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('throws without a retryLabel when it draws the retry (an empty one paints empty)', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(() => renderBar({ ...failed, onRetry: vi.fn() })).toThrow(/retryLabel/)
      expect(() => renderBar({ ...failed, onRetry: vi.fn(), retryLabel: null })).toThrow(/retryLabel/)
      error.mockRestore()
      renderBar({ ...failed, onRetry: vi.fn(), retryLabel: '' })
      expect(screen.getByRole('alert').nextElementSibling).toHaveTextContent('')
    })
  })
})

describe('SaveBar touch areas', () => {
  const css = readFileSync(path.join(__dirname, '..', 'save-bar.css'), 'utf8')
  it('puts >= 14px between the error\'s Retry and the wrapped actions, under the query that turns the 44px reach on', () => {
    // Retry (sm, 28px) reaches 8px below its box and a 32px action 6px above: --od-space-2 (7px on the 14px root) let them cross.
    expect(css).toMatch(/@media \(pointer: coarse\), \(max-width: 767px\)\s*\{\s*\.odc-savebar \{ row-gap: var\(--od-space-4\); \}/)
  })
})

// redesign stores 5.18 (F7 of 5.11, m3 of 5.13): the focused control under the sticky bar is brought above it. The layout
// is stubbed (jsdom has none): a scroller from 0 to 400, the bar from 300 to 400 across the full width.
describe('SaveBar · the focused control stays above the bar (stores 5.18)', () => {
  const rect = (top, bottom, left = 0, right = 390) => ({ top, bottom, left, right, height: bottom - top, width: right - left, x: left, y: top })

  const mount = ({ fieldRect, after = false }) => {
    const scrollBy = vi.fn()
    const view = render(
      <div data-testid='scroller' style={{ overflowY: 'auto' }}>
        {!after && <input aria-label='Notes' />}
        <SaveBar {...baseProps} count={1} countText='1 unsaved change' />
        {after && <input aria-label='Notes' />}
      </div>
    )
    const scroller = screen.getByTestId('scroller')
    scroller.scrollBy = scrollBy
    scroller.getBoundingClientRect = () => rect(0, 400)
    screen.getByRole('group', { name: 'Save changes' }).getBoundingClientRect = () => rect(300, 400)
    screen.getByRole('textbox', { name: 'Notes' }).getBoundingClientRect = () => fieldRect
    return { scrollBy, view }
  }

  const frame = () => new Promise(resolve => window.requestAnimationFrame(() => resolve()))

  it('scrolls the scroller by what clears the bar, plus a gap, when the focus moves to a field under it', async () => {
    const { scrollBy } = mount({ fieldRect: rect(290, 322) })
    screen.getByRole('textbox', { name: 'Notes' }).focus()
    await frame()
    expect(scrollBy).toHaveBeenCalledTimes(1)
    const { top } = scrollBy.mock.calls[0][0]
    expect(top).toBeGreaterThanOrEqual(22) // 322 - 300, plus the gap token (0 where jsdom has no tokens)
  })

  it('reveals again while typing', async () => {
    const { scrollBy } = mount({ fieldRect: rect(290, 322) })
    const field = screen.getByRole('textbox', { name: 'Notes' })
    field.focus()
    await frame()
    await userEvent.type(field, 'a')
    await frame()
    expect(scrollBy.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('leaves alone a field above the bar, one in another column, and one that comes after the bar', async () => {
    const above = mount({ fieldRect: rect(100, 132) })
    screen.getByRole('textbox', { name: 'Notes' }).focus()
    await frame()
    expect(above.scrollBy).not.toHaveBeenCalled()
    above.view.unmount()

    const beside = mount({ fieldRect: rect(310, 342, 400, 600) })
    screen.getByRole('textbox', { name: 'Notes' }).focus()
    await frame()
    expect(beside.scrollBy).not.toHaveBeenCalled()
    beside.view.unmount()

    const after = mount({ fieldRect: rect(310, 342), after: true })
    screen.getByRole('textbox', { name: 'Notes' }).focus()
    await frame()
    expect(after.scrollBy).not.toHaveBeenCalled()
  })

  // review F1 (stores 5.18): a focused container of the bar (a panel, the form the bar gives the focus back to; a tap on iOS does not
  // move the focus) is not a field under it: revealing it scrolled the whole panel under the finger
  it('leaves alone a focused element that holds the bar', async () => {
    const scrollBy = vi.fn()
    render(
      <div data-testid='scroller' style={{ overflowY: 'auto' }}>
        <form data-testid='form' tabIndex={-1}>
          <input aria-label='Notes' />
          <SaveBar {...baseProps} count={1} countText='1 unsaved change' />
        </form>
      </div>
    )
    const scroller = screen.getByTestId('scroller')
    scroller.scrollBy = scrollBy
    scroller.getBoundingClientRect = () => rect(0, 400)
    screen.getByRole('group', { name: 'Save changes' }).getBoundingClientRect = () => rect(300, 400)
    screen.getByTestId('form').getBoundingClientRect = () => rect(100, 520)
    screen.getByTestId('form').focus()
    await frame()
    expect(scrollBy).not.toHaveBeenCalled()
  })

  it('does nothing once the bar is gone', async () => {
    const { scrollBy, view } = mount({ fieldRect: rect(290, 322) })
    await frame()
    scrollBy.mockClear()
    view.rerender(
      <div data-testid='scroller' style={{ overflowY: 'auto' }}>
        <input aria-label='Notes' />
        <SaveBar {...baseProps} count={0} />
      </div>
    )
    screen.getByRole('textbox', { name: 'Notes' }).focus()
    await frame()
    expect(scrollBy).not.toHaveBeenCalled()
  })
})

// redesign stores: the toast sits bottom-end at a fixed offset and covered Discard / Save on a phone. While the bar is
// drawn it publishes its height as --od-toast-offset on <html> (+12px), and toast.css lifts the toast by it.
describe('SaveBar · --od-toast-offset', () => {
  const OFFSET = '--od-toast-offset'
  const read = () => document.documentElement.style.getPropertyValue(OFFSET)
  const heights = new Map()
  let spy
  let observers

  beforeEach(() => {
    heights.clear()
    observers = []
    spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const height = heights.get(this.getAttribute('aria-label')) || 0
      return { top: 0, bottom: height, left: 0, right: 390, height, width: 390, x: 0, y: 0 }
    })
    vi.stubGlobal('ResizeObserver', class {
      constructor (callback) { this.callback = callback; observers.push(this) }
      observe () {}
      disconnect () {}
    })
  })

  afterEach(() => {
    spy.mockRestore()
    vi.unstubAllGlobals()
    document.documentElement.style.removeProperty(OFFSET)
  })

  it('sets the measured height plus 12px while the bar has changes, and removes it when it hides or unmounts', () => {
    heights.set('Save changes', 80)
    const view = renderBar({ count: 1, countText: '1 unsaved change' })
    expect(read()).toBe('92px')
    view.rerender(<SaveBar {...baseProps} count={0} />)
    expect(read()).toBe('')
    view.rerender(<SaveBar {...baseProps} count={2} countText='2 unsaved changes' />)
    expect(read()).toBe('92px')
    view.unmount()
    expect(read()).toBe('')
  })

  it('follows the bar when its size changes (ResizeObserver)', () => {
    heights.set('Save changes', 56)
    renderBar({ count: 1, countText: '1 unsaved change' })
    expect(read()).toBe('68px')
    heights.set('Save changes', 100)
    act(() => { observers.forEach(observer => observer.callback()) })
    expect(read()).toBe('112px')
  })

  it('with two bars, the last one to clean up does not erase the other one\'s offset', () => {
    heights.set('First', 60)
    heights.set('Second', 90)
    const first = render(<SaveBar {...baseProps} label='First' count={1} countText='1 unsaved change' />)
    const second = render(<SaveBar {...baseProps} label='Second' count={1} countText='1 unsaved change' />)
    expect(read()).toBe('102px')
    second.unmount()
    expect(read()).toBe('72px')
    first.unmount()
    expect(read()).toBe('')
  })

  it('sets nothing while the bar draws nothing', () => {
    renderBar({ count: 0 })
    expect(read()).toBe('')
  })

  it('toast.css lifts the toast by the variable, on every viewport', () => {
    const toastCss = readFileSync(path.join(__dirname, '..', '..', 'UI', 'toast.css'), 'utf8')
    expect(toastCss).toMatch(/bottom:\s*calc\(30px \+ var\(--od-toast-offset, 0px\)\);/)
    expect(toastCss.match(/bottom:/g)).toHaveLength(1)
  })
})
