/* eslint-disable import/first */
// redesign stores 4.B (decisions 3 and 4; G1-28, G1-29, G1-30): the Overview of the store editor says whether the
// store takes orders now, whether it is snoozed (with «End snooze») and what it is missing, from the request the editor already
// makes; the slug is saved with its own «Save», alone, and says how it went.
import React, { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('~components', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: (url) => url, parseDate: (value) => `parsed(${value})` }],
  // no session here, so the Order with Google figure reads nothing and is not drawn
  useApi: () => [{ root: 'https://api.test' }],
  useSession: () => [{ token: null }]
}))

import { StoreOverview } from '../StoreOverview'
import { durationText, overviewFacts, todayHoursText } from '../storeOverviewModel'

const FUTURE = '2999-01-01 18:50:00'
const PAST = '2000-01-01 18:50:00'

const makeBusiness = (over = {}) => ({
  id: 2,
  name: 'Fast Bite',
  slug: 'fastbite',
  enabled: true,
  open: true,
  timezone: 'America/New_York',
  today: { enabled: true, lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }] },
  menus_count: 2,
  available_menus_count: 2,
  num_zones: 3,
  delivery_time: '2:0',
  pickup_time: '0:20',
  paymethods: [{ enabled: true }, { enabled: true }, { enabled: false }],
  offers: [{ enabled: true }, { enabled: false }],
  reviews: { reviews: [{}, {}, {}], total: 4.94 },
  description: 'A modern quick-service restaurant',
  ...over
})

const SECTIONS = [
  { id: 'store_details', label: 'Store details', enabled: true },
  { id: 'menu', label: 'Menu', enabled: true },
  { id: 'delivery_pickup_more', label: 'Delivery, pickup & more', enabled: true },
  { id: 'payment_methods', label: 'Payment methods', enabled: true },
  { id: 'promotions', label: 'Promotions', enabled: true }
]

// A shared form that holds its state, as the controller's does.
const Harness = ({ business, update, onOpenSection, canOpen = () => true, ...rest }) => {
  const [formState, setFormState] = useState({ loading: false, changes: {} })
  Harness.formState = formState
  return (
    <StoreOverview
      loading={false}
      business={business}
      isAdmin
      isEatstreetProject={false}
      isWhiteLabelModule={false}
      storeUrl='https://shop.test/store/fastbite'
      onOpenSite={vi.fn()}
      formState={formState}
      setFormState={setFormState}
      handleUpdateBusinessClick={update}
      sections={SECTIONS}
      canOpenSection={canOpen}
      onOpenSection={onOpenSection}
      {...rest}
    />
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('StoreOverview · snooze (G1-30)', () => {
  it('says the snooze in force, and «End snooze» saves only snooze_until and takes the notice away', async () => {
    const user = userEvent.setup()
    let answer
    const update = vi.fn(() => new Promise(resolve => { answer = resolve }))
    render(<Harness business={makeBusiness({ snooze_until: FUTURE })} update={update} />)
    // in the store's clock (America/New_York, 5 hours behind UTC in January), like the hours of today below it
    expect(screen.getByText('Jan 1, 13:50')).toBeInTheDocument()
    // the server's `open` follows the schedule: while snoozed the summary does not say «Open»
    expect(screen.queryByText('Open 24 hours')).toBeNull()
    const end = screen.getByRole('button', { name: 'End snooze' })
    await user.click(end)
    await user.click(end)
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith({ snooze_until: null }, { keepPendingChanges: true })
    expect(end).toHaveAttribute('aria-busy', 'true')
    await act(async () => { answer({ ok: true }) })
    expect(screen.queryByRole('button', { name: 'End snooze' })).toBeNull()
    // the focus goes to the line that says it ended, not to the page
    const ended = screen.getByText('Snooze ended. The store takes orders again on its schedule.')
    await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)) })
    expect(ended).toHaveFocus()
    expect(screen.getByText('Open 24 hours')).toBeInTheDocument()
  })

  it('says the end in the person\'s clock when the store has no timezone', () => {
    render(<Harness business={makeBusiness({ snooze_until: FUTURE, timezone: null })} update={vi.fn()} />)
    expect(screen.getByText(`parsed(${FUTURE})`)).toBeInTheDocument()
  })

  // redesign bugs C: the dialog and the Overview read it on the store's clock, and say which one
  it('names the store\'s time zone beside the end of the snooze', () => {
    render(<Harness business={makeBusiness({ snooze_until: FUTURE })} update={vi.fn()} />)
    const notice = screen.getByText('Jan 1, 13:50').closest('.odc-se-snoozed')
    expect(within(notice).getByText('(America/New_York)')).toBeInTheDocument()
    // review: the zone closes the first sentence; it does not run into the next one
    expect(notice.querySelector('strong')).toHaveTextContent('Snoozed until Jan 1, 13:50 (America/New_York)')
  })

  it('says why when ending it fails, and keeps the notice', async () => {
    const user = userEvent.setup()
    const update = vi.fn(async () => ({ ok: false, error: ['Not allowed'] }))
    render(<Harness business={makeBusiness({ snooze_until: FUTURE })} update={update} />)
    await user.click(screen.getByRole('button', { name: 'End snooze' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed')
    expect(screen.getByRole('button', { name: 'End snooze' })).toBeInTheDocument()
  })

  it('says nothing about a snooze that is over or was never set', () => {
    const { unmount } = render(<Harness business={makeBusiness({ snooze_until: PAST })} update={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'End snooze' })).toBeNull()
    unmount()
    render(<Harness business={makeBusiness({ snooze_until: null })} update={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'End snooze' })).toBeNull()
  })
})

describe('StoreOverview · today (T11)', () => {
  it('says the status and the hours of today in the store\'s timezone', () => {
    render(<Harness business={makeBusiness()} update={vi.fn()} />)
    expect(screen.getByText('Open 24 hours')).toBeInTheDocument()
    expect(document.querySelector('.odc-se-today-hours')).toHaveTextContent('Today 00:00–23:59')
    expect(screen.getByText('America/New_York')).toBeInTheDocument()
  })

  it('writes the hours in 12 hours when the project does, and says when it is closed all day', () => {
    const { unmount } = render(<Harness business={makeBusiness({ timezone: null })} is12Hours update={vi.fn()} />)
    expect(document.querySelector('.odc-se-today-hours')).toHaveTextContent('Today 12:00 AM–11:59 PM')
    unmount()
    render(<Harness business={makeBusiness({ open: false, today: { enabled: false, lapses: [] } })} update={vi.fn()} />)
    expect(screen.getByText('Closed')).toBeInTheDocument()
    expect(screen.getByText('Closed today')).toBeInTheDocument()
  })

  it('does not say «Open» for a disabled store (as the list)', () => {
    render(<Harness business={makeBusiness({ enabled: false })} update={vi.fn()} />)
    expect(screen.queryByText('Open 24 hours')).toBeNull()
  })
})

describe('StoreOverview · figures', () => {
  const figure = (label) => screen.getByText(label).closest('.odc-se-fact')
  const figuresIn = (element) => [...element.querySelectorAll('.odc-figure')].map(node => node.textContent)

  // redesign bugs Q: only the numbers are figures (mono); the words stay in the interface font
  it('the Rating row puts only its numbers in .odc-figure, and «No reviews yet» in none', () => {
    const first = render(<Harness business={makeBusiness({ reviews: { reviews: [{}, {}, {}, {}], total: 5 } })} update={vi.fn()} />)
    expect(figure('Rating')).toHaveTextContent('5 (4 reviews)')
    expect(figuresIn(figure('Rating'))).toEqual(['5', '4'])
    first.unmount()
    render(<Harness business={makeBusiness({ reviews: { reviews: [], total: 0 } })} update={vi.fn()} />)
    const row = figure('Rating')
    expect(within(row).getByText('No reviews yet')).toBeInTheDocument()
    expect(within(row).getByText('No reviews yet').closest('.odc-figure')).toBeNull()
    expect(row.querySelector('.odc-figure')).toBeNull()
  })

  it('«1 of 1» has only its numbers in .odc-figure', () => {
    render(<Harness business={makeBusiness({ menus_count: 1, available_menus_count: 1 })} update={vi.fn()} />)
    expect(figure('Menus available')).toHaveTextContent('1 of 1')
    expect(figuresIn(figure('Menus available'))).toEqual(['1', '1'])
  })

  it('the hours of today keep AM / PM out of .odc-figure', () => {
    render(<Harness business={makeBusiness({ timezone: null })} is12Hours update={vi.fn()} />)
    const hours = document.querySelector('.odc-se-today-hours')
    expect(figuresIn(hours)).toEqual(['12:00', '11:59'])
    expect(hours).toHaveTextContent('Today 12:00 AM–11:59 PM')
  })

  it('shows each figure with the way to its section', async () => {
    const user = userEvent.setup()
    const onOpenSection = vi.fn()
    render(<Harness business={makeBusiness()} update={vi.fn()} onOpenSection={onOpenSection} />)
    expect(figure('Menus available')).toHaveTextContent('2 of 2')
    expect(within(figure('Delivery zones')).getByText('3')).toBeInTheDocument()
    expect(within(figure('Delivery · pickup time')).getByText('2:00 · 0:20 h')).toBeInTheDocument()
    expect(within(figure('Payment methods on')).getByText('2')).toBeInTheDocument()
    expect(within(figure('Promotions on')).getByText('1')).toBeInTheDocument()
    expect(figure('Rating')).toHaveTextContent('4.94 (3 reviews)')
    expect(within(figure('Rating')).queryByRole('button')).toBeNull()
    await user.click(within(figure('Payment methods on')).getByRole('button', { name: 'Open Payment methods' }))
    expect(onOpenSection).toHaveBeenCalledWith('payment_methods')
  })

  it('marks what keeps the store from taking orders: no menu available, no payment method on', () => {
    render(<Harness business={makeBusiness({ available_menus_count: 0, paymethods: [{ enabled: false }], reviews: { reviews: [], total: 0 } })} update={vi.fn()} />)
    expect(figure('Menus available')).toHaveAttribute('data-warn')
    expect(figure('Menus available')).toHaveTextContent('0 of 2')
    expect(figure('Payment methods on')).toHaveAttribute('data-warn')
    expect(within(figure('Payment methods on')).getByText('None')).toBeInTheDocument()
    expect(figure('Delivery zones')).not.toHaveAttribute('data-warn')
    expect(within(figure('Rating')).getByText('No reviews yet')).toBeInTheDocument()
  })

  it('has no link to a section the menu does not offer', () => {
    render(<Harness business={makeBusiness()} update={vi.fn()} canOpen={id => id !== 'payment_methods'} />)
    expect(within(figure('Payment methods on')).queryByRole('button')).toBeNull()
    expect(within(figure('Menus available')).getByRole('button', { name: 'Open Menu' })).toBeInTheDocument()
  })

  it('the description stays, with the way to Store details', async () => {
    const user = userEvent.setup()
    const onOpenSection = vi.fn()
    render(<Harness business={makeBusiness()} update={vi.fn()} onOpenSection={onOpenSection} />)
    expect(screen.getByText('A modern quick-service restaurant')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit in Store details' }))
    expect(onOpenSection).toHaveBeenCalledWith('store_details')
  })
})

describe('StoreOverview · slug with «Save» (G1-28, P-4)', () => {
  const slugField = () => screen.getByRole('textbox', { name: 'Slug' })
  const save = () => screen.getByRole('button', { name: 'Save' })

  it('Save is off until the slug changes; the typed slug is held by the shared form until saved', async () => {
    const user = userEvent.setup()
    const update = vi.fn(async () => ({ ok: true }))
    render(<Harness business={makeBusiness()} update={update} />)
    expect(save()).toBeDisabled()
    await user.clear(slugField())
    await user.type(slugField(), 'quickbite')
    expect(Harness.formState.changes).toEqual({ slug: 'quickbite' })
    expect(update).not.toHaveBeenCalled()
    await user.click(save())
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith({ slug: 'quickbite' }, { keepPendingChanges: true })
    // Save turns off once nothing is left to save: the focus goes back to the field
    await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)) })
    expect(slugField()).toHaveFocus()
  })

  it('shows the public address under the slug, except with the white label module (as main: no link to the site)', () => {
    const { unmount } = render(<Harness business={makeBusiness()} update={vi.fn()} />)
    expect(screen.getByText('shop.test/store/fastbite')).toBeInTheDocument()
    unmount()
    render(<Harness business={makeBusiness()} update={vi.fn()} isWhiteLabelModule />)
    expect(screen.queryByText('shop.test/store/fastbite')).toBeNull()
  })

  it('going back to the stored slug leaves nothing pending', async () => {
    const user = userEvent.setup()
    render(<Harness business={makeBusiness()} update={vi.fn()} />)
    await user.type(slugField(), 'x')
    expect(Harness.formState.changes).toEqual({ slug: 'fastbitex' })
    await user.type(slugField(), '{Backspace}')
    expect(Harness.formState.changes).toEqual({})
    expect(save()).toBeDisabled()
  })

  it('Enter saves too', async () => {
    const user = userEvent.setup()
    const update = vi.fn(async () => ({ ok: true }))
    render(<Harness business={makeBusiness()} update={update} />)
    await user.type(slugField(), '2{Enter}')
    expect(update).toHaveBeenCalledWith({ slug: 'fastbite2' }, { keepPendingChanges: true })
  })

  it('says a failed save next to the field and keeps what was typed', async () => {
    const user = userEvent.setup()
    const update = vi.fn(async () => ({ ok: false, error: ['Slug already in use'] }))
    render(<Harness business={makeBusiness()} update={update} />)
    await user.type(slugField(), '2')
    await user.click(save())
    expect(await screen.findByText('Slug already in use')).toBeInTheDocument()
    expect(slugField()).toHaveValue('fastbite2')
    expect(slugField()).toHaveAttribute('aria-invalid', 'true')
  })

  it('an empty slug is said, and cannot be saved', () => {
    render(<Harness business={makeBusiness()} update={vi.fn()} />)
    fireEvent.change(slugField(), { target: { value: '' } })
    expect(screen.getByText('Slug is required')).toBeInTheDocument()
    expect(save()).toBeDisabled()
  })

  it('typing or pasting a character other than a letter or a number leaves it out', async () => {
    const user = userEvent.setup()
    render(<Harness business={makeBusiness()} update={vi.fn()} />)
    await user.type(slugField(), '-é 7')
    expect(slugField()).toHaveValue('fastbite7')
    fireEvent.change(slugField(), { target: { value: 'fast-bite 2' } })
    expect(slugField()).toHaveValue('fastbite2')
  })

  it('a stored slug older than that rule is not changed for the person: the field says it and it cannot be saved as it is', () => {
    render(<Harness business={makeBusiness({ slug: 'fast-bite' })} update={vi.fn()} />)
    fireEvent.change(slugField(), { target: { value: 'fast-bite2' } })
    expect(slugField()).toHaveValue('fast-bite2')
    expect(screen.getByText('Use only letters, numbers and underscores (_).')).toBeInTheDocument()
    expect(save()).toBeDisabled()
  })

  // redesign bugs C
  it('a slug with «_», as the add makes them, can be edited and saved', async () => {
    const user = userEvent.setup()
    const update = vi.fn(async () => ({ ok: true }))
    render(<Harness business={makeBusiness({ slug: 'fast_bite' })} update={update} />)
    await user.type(slugField(), '_2')
    expect(slugField()).toHaveValue('fast_bite_2')
    expect(save()).toBeEnabled()
    await user.click(save())
    expect(update).toHaveBeenCalledWith({ slug: 'fast_bite_2' }, { keepPendingChanges: true })
  })
})

describe('storeOverviewModel', () => {
  it('durationText writes «H:M» as «H:MM»', () => {
    expect(durationText('2:0')).toBe('2:00')
    expect(durationText('0:20')).toBe('0:20')
    expect(durationText('1:5')).toBe('1:05')
    expect(durationText('')).toBeNull()
    expect(durationText(null)).toBeNull()
  })

  it('todayHoursText joins the lapses, null when closed all day and undefined without `today`', () => {
    const today = { enabled: true, lapses: [{ open: { hour: 9, minute: 0 }, close: { hour: 14, minute: 0 } }, { open: { hour: 18, minute: 0 }, close: { hour: 23, minute: 0 } }] }
    expect(todayHoursText(today, false)).toBe('09:00–14:00, 18:00–23:00')
    expect(todayHoursText({ enabled: false, lapses: today.lapses }, false)).toBeNull()
    expect(todayHoursText({ enabled: true, lapses: [] }, false)).toBeNull()
    expect(todayHoursText(undefined, false)).toBeUndefined()
  })

  it('overviewFacts leaves out what the store does not carry', () => {
    expect(overviewFacts({})).toEqual([])
    expect(overviewFacts({ menus_count: 0 }).map(fact => [fact.id, fact.warn])).toEqual([['menus', true]])
  })
})

// redesign tanda AB (S-4c): `.odc-se-today-hours` is a flex container with a gap, so every direct child (a text run
// or a figure span) is separated from the next by that gap: «12:00 AM–» then a gap then «11:59 PM». The label and the hours must be
// ONE item, so the range reads «12:00 AM–11:59 PM» with no space on either side of the dash.
describe('StoreOverview · the hours of today are one flex item (S-4c)', () => {
  it('keeps «Today 12:00 AM–11:59 PM» inside a single element, with no loose text or figure beside the dash', () => {
    render(<Harness business={makeBusiness({ timezone: null })} is12Hours update={vi.fn()} />)
    const hours = document.querySelector('.odc-se-today-hours')
    const loose = [...hours.childNodes].filter(node => node.nodeType === 3 && node.textContent.trim())
    expect(loose).toEqual([])
    expect([...hours.children].some(child => child.classList.contains('odc-figure'))).toBe(false)
    const holder = [...hours.children].find(child => child.textContent.includes('11:59'))
    expect(holder.textContent).toBe('Today 12:00 AM–11:59 PM')
    expect(holder.textContent).not.toMatch(/–\s|\s–/)
  })
})
