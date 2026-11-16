import React from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SegmentedControl } from '../SegmentedControl'

const OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'status', label: 'Status' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'payments', label: 'Payments' }
]

/*
 * jsdom has no layout. The wrapper reads the natural width of its hidden measuring
 * track (`.odc-seg-measure`) and the width the container offers (`.odc-seg`), and
 * re-reads both when a ResizeObserver fires. Here both are simulated.
 */
const layout = { natural: 200, available: 400 }
const observers = new Set()

class FakeResizeObserver {
  constructor (callback) {
    this.callback = callback
    observers.add(this)
  }

  observe () {}
  unobserve () {}
  disconnect () { observers.delete(this) }
}

const resize = async (next) => {
  Object.assign(layout, next)
  await act(async () => {
    for (const observer of observers) observer.callback([], observer)
  })
}

const widthOf = (element) => {
  if (element.classList.contains('odc-seg-measure')) return layout.natural
  if (element.classList.contains('odc-seg')) return layout.available
  return 0
}

beforeEach(() => {
  layout.natural = 200
  layout.available = 400
  observers.clear()
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function () { return widthOf(this) })
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () { return widthOf(this) })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const setup = ({ value = 'all', options = OPTIONS, wrap, ...props } = {}) => {
  const onValueChange = vi.fn()
  const element = (nextValue = value) => {
    const control = <SegmentedControl label='Show' value={nextValue} onValueChange={onValueChange} options={options} {...props} />
    return wrap ? wrap(control) : control
  }
  const view = render(element())
  return { onValueChange, element, ...view }
}

const buttons = () => screen.getAllByRole('button')

describe('Product SegmentedControl (C13)', () => {
  it('exposes a named group with one button per option', () => {
    setup()
    expect(screen.getByRole('group', { name: 'Show' })).toBeInTheDocument()
    expect(buttons().map(button => button.textContent)).toEqual(['All', 'Status', 'Logistics', 'Payments'])
  })

  it('marks only the current option as pressed', () => {
    setup({ value: 'logistics' })
    const [all, status, logistics, payments] = buttons()
    expect(logistics).toHaveAttribute('aria-pressed', 'true')
    for (const other of [all, status, payments]) expect(other).toHaveAttribute('aria-pressed', 'false')
  })

  // R1-08: Base UI's composite parks the tab stop on the first option; a radiogroup parks it on the chosen one.
  it('has a single tab stop (roving tabindex), on the chosen option', () => {
    setup({ value: 'logistics' })
    expect(buttons().map(button => button.getAttribute('tabindex'))).toEqual(['-1', '-1', '0', '-1'])
  })

  it('falls back to the first option when no option is chosen', () => {
    setup({ value: 'nothing' })
    expect(buttons().map(button => button.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1'])
  })

  it('Tab from outside lands on the chosen option, not on the first', async () => {
    const user = userEvent.setup()
    setup({ value: 'status', wrap: control => <div><button type='button'>Before</button>{control}<button type='button'>After</button></div> })
    await user.tab()
    expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Status' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus()
  })

  it('moves the tab stop with the focus, and gives it back to the chosen option when the focus leaves', async () => {
    const user = userEvent.setup()
    setup({ value: 'status', wrap: control => <div><button type='button'>Before</button>{control}<button type='button'>After</button></div> })
    await user.tab()
    await user.tab()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(screen.getByRole('button', { name: 'Payments' })).toHaveFocus()
    expect(buttons().filter(button => button.textContent !== 'Before' && button.textContent !== 'After').map(button => button.getAttribute('tabindex'))).toEqual(['-1', '-1', '-1', '0'])
    // Shift+Tab leaves the group (it does not bounce to the chosen option)
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus()
    expect(buttons().filter(button => button.textContent !== 'Before' && button.textContent !== 'After').map(button => button.getAttribute('tabindex'))).toEqual(['-1', '0', '-1', '-1'])
  })

  it('reports the chosen value on click', async () => {
    const user = userEvent.setup()
    const { onValueChange } = setup()
    await user.click(screen.getByRole('button', { name: 'Payments' }))
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenLastCalledWith('payments')
  })

  it('moves focus with arrows, Home and End; Space and Enter choose', async () => {
    const user = userEvent.setup()
    const { onValueChange } = setup()
    const [all, status, logistics] = buttons()
    await user.tab()
    expect(all).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(status).toHaveFocus()
    expect(onValueChange).not.toHaveBeenCalled()
    await user.keyboard('{ArrowRight}')
    expect(logistics).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(status).toHaveFocus()
    await user.keyboard('{End}')
    expect(buttons()[3]).toHaveFocus()
    await user.keyboard('{Home}')
    expect(all).toHaveFocus()
    await user.keyboard('{ArrowRight} ')
    expect(onValueChange).toHaveBeenLastCalledWith('status')
    await user.keyboard('{ArrowRight}{Enter}')
    expect(onValueChange).toHaveBeenLastCalledWith('logistics')
  })

  it('inverts the arrows in RTL', async () => {
    const user = userEvent.setup()
    setup({ wrap: control => <ThemeProvider theme={{ rtl: true }}><div dir='rtl'>{control}</div></ThemeProvider> })
    const [all, status] = buttons()
    await user.tab()
    expect(all).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(status).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(all).toHaveFocus()
  })

  it('keeps the arrows natural in LTR', async () => {
    const user = userEvent.setup()
    setup({ wrap: control => <ThemeProvider theme={{ rtl: false }}><div dir='ltr'>{control}</div></ThemeProvider> })
    const [all, status] = buttons()
    await user.tab()
    await user.keyboard('{ArrowRight}')
    expect(status).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(all).toHaveFocus()
  })

  it('cannot be left without a value: pressing the chosen option again keeps it', async () => {
    const user = userEvent.setup()
    const { onValueChange } = setup({ value: 'status' })
    await user.click(screen.getByRole('button', { name: 'Status' }))
    await user.keyboard(' ')
    expect(onValueChange).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Status' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('has no text of its own', () => {
    setup({ options: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }] })
    expect(screen.getByRole('group')).toHaveTextContent(/^AlphaBeta$/)
  })

  it('throws with more than 4 options', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const options = [...OPTIONS, { value: 'chat', label: 'Messages' }]
    expect(() => render(<SegmentedControl label='Show' value='all' onValueChange={() => {}} options={options} />)).toThrow(/at most 4/i)
  })

  it('throws without a label', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<SegmentedControl value='all' onValueChange={() => {}} options={OPTIONS} />)).toThrow('SegmentedControl needs a label')
  })

  describe('when the options do not fit in one row', () => {
    const select = () => screen.getByRole('combobox', { name: 'Show' })

    it('stays a segmented control while the track fits', () => {
      setup()
      expect(screen.queryByRole('combobox')).toBeNull()
      expect(screen.getByRole('group', { name: 'Show' })).toBeInTheDocument()
    })

    it('becomes a native select with the same label and options', () => {
      layout.natural = 520
      layout.available = 320
      setup({ value: 'logistics' })
      expect(screen.queryByRole('group')).toBeNull()
      expect(screen.queryAllByRole('button')).toHaveLength(0)
      expect(select().tagName).toBe('SELECT')
      expect(select()).toHaveAccessibleName('Show')
      expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['All', 'Status', 'Logistics', 'Payments'])
      expect(select()).toHaveValue('logistics')
    })

    it('reports the chosen value from the select', async () => {
      const user = userEvent.setup()
      layout.natural = 520
      layout.available = 320
      const { onValueChange } = setup()
      await user.selectOptions(select(), 'payments')
      expect(onValueChange).toHaveBeenCalledTimes(1)
      expect(onValueChange).toHaveBeenLastCalledWith('payments')
    })

    it('switches when the container resizes, both ways, without a second row', async () => {
      setup({ value: 'status' })
      expect(screen.queryByRole('combobox')).toBeNull()
      await resize({ available: 150 })
      expect(select()).toHaveValue('status')
      expect(screen.queryByRole('group')).toBeNull()
      await resize({ available: 400 })
      expect(screen.queryByRole('combobox')).toBeNull()
      expect(screen.getByRole('group', { name: 'Show' })).toBeInTheDocument()
      expect(buttons()).toHaveLength(4)
    })

    it('keeps the group while the width is exactly the natural one', async () => {
      setup()
      await resize({ natural: 300, available: 300 })
      expect(screen.getByRole('group', { name: 'Show' })).toBeInTheDocument()
    })

    it('measures a hidden track, so the options exist once for assistive tech', () => {
      setup()
      const measure = document.querySelector('.odc-seg-measure')
      expect(measure).toHaveAttribute('aria-hidden', 'true')
      expect(screen.getAllByText('Status')).toHaveLength(1)
    })
  })
})
