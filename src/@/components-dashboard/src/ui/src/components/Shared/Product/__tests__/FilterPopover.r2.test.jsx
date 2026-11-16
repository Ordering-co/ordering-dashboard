/* eslint-disable import/first */
// redesign W0-2 r2 (W0-Q1-01, W0-Q1-04, W0-Q1-05): the labels of the pill popovers may be empty strings (a project's empty
// translation paints empty and never blanks the app), the focus stays inside the popover after «Clear», and Tab out of a
// non-modal popover closes it and lands on the next control after the pill, never on <body>.
import React, { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

// redesign W0-4b (D-25): spy on the props the popovers hand to the Base UI positioner and on the token they read.
const positionerProps = []
vi.mock('@base-ui/react/popover', async (importOriginal) => {
  const actual = await importOriginal()
  const Positioner = React.forwardRef(function SpyPositioner (props, ref) {
    positionerProps.push(props)
    return <actual.Popover.Positioner ref={ref} {...props} />
  })
  return { ...actual, Popover: { ...actual.Popover, Positioner } }
})
vi.mock('../positioning', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, tokenPx: (name, scope) => name === '--od-x-viewport-gap' ? 17 : actual.tokenPx(name, scope) }
})

import { Checkbox } from '../Checkbox'
import { DateRangePopover } from '../DateRangePopover'
import { ChecklistPopover, FilterPopover, PopoverFoot } from '../FilterPopover'

afterEach(() => document.getElementById('app-modals')?.remove())

const EXIT = { timeout: 4000 }
const ITEMS = [{ id: 1, name: 'Ada Lovelace' }, { id: 2, name: 'Grace Hopper' }, { id: 3, name: 'Alan Turing' }]
const LABELS = {
  searchLabel: 'Search',
  clearSearchLabel: 'Clear search',
  loadingLabel: 'Loading...',
  noResultsLabel: 'No results found',
  clearLabel: 'Clear'
}

const pill = () => screen.getByRole('button', { name: /^Driver/, hidden: true })
const popup = () => screen.queryByRole('dialog', { name: 'Driver', hidden: true })

// A checklist whose selection is real state, so «Clear» empties it and the foot unmounts like in the app.
const Stateful = (props) => {
  const [selected, setSelected] = useState([1])
  return (
    <>
      <button type='button'>Before</button>
      <ChecklistPopover
        label='Driver'
        items={ITEMS}
        selected={selected}
        onToggle={id => setSelected(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id])}
        onClear={() => setSelected([])}
        {...LABELS}
        {...props}
      />
      <button type='button'>After</button>
    </>
  )
}

// the Product checkbox is a `button[role=checkbox]`; Base UI adds a hidden native input with the same role
const rowsOf = dialog => Array.from(dialog.querySelectorAll('button[role="checkbox"]'))

const open = async (user, name = 'Driver') => {
  await user.click(screen.getByRole('button', { name: new RegExp(`^${name}`), hidden: true }))
  return screen.findByRole('dialog', { name, hidden: true })
}

describe('W0-Q1-01 · an empty label paints empty', () => {
  it('PopoverFoot throws with a null clearLabel', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<PopoverFoot onClear={() => {}} clearLabel={null} />)).toThrow('PopoverFoot needs a clearLabel')
    error.mockRestore()
  })

  it('PopoverFoot draws with clearLabel \'\' and throws with undefined', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container, unmount } = render(<PopoverFoot onClear={() => {}} clearLabel='' />)
    expect(container.querySelector('.odc-orders-popover-foot button')).toBeInTheDocument()
    unmount()
    expect(() => render(<PopoverFoot onClear={() => {}} />)).toThrow('PopoverFoot needs a clearLabel')
    error.mockRestore()
  })

  it.each([
    ['searchLabel', 'ChecklistPopover needs a searchLabel', {}],
    ['clearSearchLabel', 'ChecklistPopover needs a clearSearchLabel', {}], // redesign W0-2 r3 (W0-P2-06)
    ['noResultsLabel', 'ChecklistPopover needs a noResultsLabel', { items: [] }],
    ['loadingLabel', 'ChecklistPopover needs a loadingLabel', { items: [], loading: true }],
    ['clearLabel', 'PopoverFoot needs a clearLabel', {}]
  ])('ChecklistPopover %s: \'\' paints, undefined throws', async (name, message, props) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    const { unmount } = render(<Stateful {...props} {...{ [name]: '' }} />)
    const dialog = await open(user)
    expect(dialog).toBeInTheDocument()
    unmount()
    document.getElementById('app-modals')?.remove()

    const again = userEvent.setup()
    await expect(async () => {
      render(<Stateful {...props} {...{ [name]: undefined }} />)
      await open(again)
    }).rejects.toThrow(message)
    error.mockRestore()
  })
})

describe('W0-Q1-04 · the focus stays in the popover after «Clear»', () => {
  const insidePopup = () => popup()?.contains(document.activeElement)

  it('mouse: ChecklistPopover puts the focus on the search field', async () => {
    const user = userEvent.setup()
    render(<Stateful />)
    const dialog = await open(user)
    await user.click(within(dialog).getByRole('button', { name: 'Clear', hidden: true }))
    await waitFor(() => expect(within(dialog).queryByRole('button', { name: 'Clear', hidden: true })).toBeNull())
    expect(dialog.isConnected).toBe(true)
    expect(document.activeElement).not.toBe(document.body)
    expect(document.activeElement).not.toBe(pill())
    expect(document.activeElement).toBe(within(dialog).getByRole('searchbox', { hidden: true }))
    expect(insidePopup()).toBe(true)
  })

  it('keyboard: Tab to «Clear» and Enter keeps the focus inside', async () => {
    const user = userEvent.setup()
    render(<Stateful />)
    const dialog = await open(user)
    within(dialog).getByRole('button', { name: 'Clear', hidden: true }).focus()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(within(dialog).queryByRole('button', { name: 'Clear', hidden: true })).toBeNull())
    expect(document.activeElement).toBe(within(dialog).getByRole('searchbox', { hidden: true }))
    expect(popup()).toBeInTheDocument()
  })

  it('PopoverFoot on its own (no popup around it) still clears', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(<PopoverFoot onClear={onClear} clearLabel='Clear' />)
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})

describe('W0-Q1-05 · Tab out of the popover', () => {
  it('Tab from the last stop closes it and lands on the control after the pill, never on <body>', async () => {
    const user = userEvent.setup()
    render(<Stateful />)
    const dialog = await open(user)
    // search → row (roving) → Clear
    within(dialog).getByRole('button', { name: 'Clear', hidden: true }).focus()
    await user.tab()
    expect(document.activeElement).not.toBe(document.body)
    await waitFor(() => expect(popup()).toBeNull(), EXIT)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'After', hidden: true }))
  })

  it('Tab from the last row of a popover without a foot also leaves to the next control', async () => {
    const user = userEvent.setup()
    // nothing picked, so no foot: the roving row is the last stop
    render(<Stateful selected={[]} />)
    const dialog = await open(user)
    expect(within(dialog).queryByRole('button', { name: 'Clear', hidden: true })).toBeNull()
    rowsOf(dialog)[0].focus()
    await user.tab()
    await waitFor(() => expect(popup()).toBeNull(), EXIT)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'After', hidden: true }))
  })

  it('Shift+Tab from the first stop closes it and goes back to the pill', async () => {
    const user = userEvent.setup()
    render(<Stateful />)
    const dialog = await open(user)
    within(dialog).getByRole('searchbox', { hidden: true }).focus()
    await user.tab({ shift: true })
    await waitFor(() => expect(popup()).toBeNull(), EXIT)
    expect(document.activeElement).toBe(pill())
  })

  it('Tab between stops inside the popover does not close it', async () => {
    const user = userEvent.setup()
    render(<Stateful />)
    const dialog = await open(user)
    within(dialog).getByRole('searchbox', { hidden: true }).focus()
    await user.tab()
    expect(popup()).toBeInTheDocument()
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('FilterPopover with a body that has no stops: Tab leaves to the next control', async () => {
    const user = userEvent.setup()
    render(
      <>
        <FilterPopover label='Driver'><p>Body</p></FilterPopover>
        <button type='button'>After</button>
      </>
    )
    const dialog = await open(user)
    dialog.focus()
    await user.tab()
    await waitFor(() => expect(popup()).toBeNull(), EXIT)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'After', hidden: true }))
  })

  it('Escape still closes it and returns the focus to the pill', async () => {
    const user = userEvent.setup()
    render(
      <FilterPopover label='Driver'>
        <Checkbox checked={false} onCheckedChange={() => {}}>Row</Checkbox>
      </FilterPopover>
    )
    const dialog = await open(user)
    rowsOf(dialog)[0].focus()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(popup()).toBeNull(), EXIT)
    expect(document.activeElement).toBe(pill())
  })
})

// redesign tramo A (W0-Q2-02): the next stop after the pill is a control the browser can really focus. A «+0 more filters»
// button that is hidden (visibility, display, hidden, inert, aria-hidden, disabled, data-overflowed) is skipped.
describe('W0-Q2-02 · Tab out skips the controls that cannot take the focus', () => {
  const HIDDEN = {
    'visibility: hidden': { style: { visibility: 'hidden' } },
    'display: none': { style: { display: 'none' } },
    hidden: { hidden: true },
    inert: { inert: '' },
    'aria-hidden': { 'aria-hidden': 'true' },
    disabled: { disabled: true },
    'data-overflowed': { 'data-overflowed': '' }
  }

  it.each(Object.keys(HIDDEN))('a «+N» sibling that is %s is skipped: the focus lands on the visible control after it', async (kind) => {
    const user = userEvent.setup()
    render(
      <>
        <FilterPopover label='Driver'><Checkbox checked={false} onCheckedChange={() => {}}>Row</Checkbox></FilterPopover>
        <span className='odc-filterbar-overflow' data-empty=''>
          <button type='button' {...HIDDEN[kind]}>+0 more filters</button>
        </span>
        <button type='button'>Filters</button>
      </>
    )
    const dialog = await open(user)
    rowsOf(dialog)[0].focus()
    await user.tab()
    await waitFor(() => expect(popup()).toBeNull(), EXIT)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Filters', hidden: true }))
    expect(document.activeElement).not.toBe(document.body)
  })

  it('a visible «+N» sibling is still the next stop', async () => {
    const user = userEvent.setup()
    render(
      <>
        <FilterPopover label='Driver'><Checkbox checked={false} onCheckedChange={() => {}}>Row</Checkbox></FilterPopover>
        <button type='button'>+2 more filters</button>
        <button type='button'>Filters</button>
      </>
    )
    const dialog = await open(user)
    rowsOf(dialog)[0].focus()
    await user.tab()
    await waitFor(() => expect(popup()).toBeNull(), EXIT)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '+2 more filters', hidden: true }))
  })

  it('with no visible control after the pill, the focus goes back to the pill', async () => {
    const user = userEvent.setup()
    render(
      <>
        <FilterPopover label='Driver'><Checkbox checked={false} onCheckedChange={() => {}}>Row</Checkbox></FilterPopover>
        <button type='button' style={{ visibility: 'hidden' }}>+0 more filters</button>
      </>
    )
    const dialog = await open(user)
    rowsOf(dialog)[0].focus()
    await user.tab()
    await waitFor(() => expect(popup()).toBeNull(), EXIT)
    expect(document.activeElement).toBe(pill())
  })
})

// redesign W0-4b (D-25)
describe('W0-4b (D-25) · a pill popover keeps inside the viewport', () => {
  it('FilterPopover flips on the side axis, shifts on the align axis and pads by the viewport gap token', async () => {
    positionerProps.length = 0
    const user = userEvent.setup()
    render(<FilterPopover label='Driver'><Checkbox checked={false} onCheckedChange={() => {}}>Row</Checkbox></FilterPopover>)
    await open(user)
    const props = positionerProps.at(-1)
    expect(props.collisionAvoidance).toEqual({ side: 'flip', align: 'shift' })
    expect(props.collisionPadding).toBe(17)
  })

  it('DateRangePopover under a pill uses the same collision rule', async () => {
    positionerProps.length = 0
    const user = userEvent.setup()
    window.matchMedia = vi.fn(query => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    render(
      <DateRangePopover
        presets={[{ value: 'default', label: 'Any' }]}
        presetValue='default'
        dateFormat='DD-MM-YYYY'
        triggerText='Date'
        labels={{ title: 'Select a date', presets: 'Date', close: 'Close', done: 'Done', from: 'From', to: 'To', today: 'Today', goToToday: 'Go to today', previousMonth: 'Previous month', nextMonth: 'Next month', rangeOrder: 'x', invalidDate: () => 'x' }}
        locale='en'
        align='start'
        onPreset={vi.fn()}
        onRange={vi.fn()}
        renderTrigger={({ ref, expanded, toggle }) => <button ref={ref} type='button' aria-expanded={expanded} onClick={toggle}>Date</button>}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Date' }))
    await screen.findByRole('dialog', { name: 'Select a date' })
    const props = positionerProps.at(-1)
    expect(props.collisionAvoidance).toEqual({ side: 'flip', align: 'shift' })
    expect(props.collisionPadding).toBe(17)
  })
})
