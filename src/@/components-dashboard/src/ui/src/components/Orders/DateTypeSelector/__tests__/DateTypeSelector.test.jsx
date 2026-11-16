/* eslint-disable import/first */
// redesign fix-qa E1: the date range of the filters. A brand popover (a bottom sheet on phones) with the
// presets, From / To fields with a mask and a calendar of buttons, on the same handlers as before.
import React, { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const lang = vi.hoisted(() => ({ configs: {} }))

// redesign tramo A r5 (W0-QA3-02): the REAL UtilsProviders (parseDate) over mocked config and language.
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (key, text) => text],
  useConfig: () => [{ configs: lang.configs }]
}))
vi.mock('../../../../../../contexts/ConfigContext', () => ({ useConfig: () => [{ configs: lang.configs }] }))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (key, text) => text]
}))

import { Sheet } from '../../../Shared/Product/Sheet'
import { DateTypeSelector } from '..'
import { UtilsProviders } from '../../../../../../contexts/UtilsContext'

const stubMatchMedia = (matches) => {
  window.matchMedia = vi.fn((query) => ({
    matches: matches && query.includes('max-width: 767px'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
}

// The controller's handlers spread the filter values of the render they came from, like these.
const Harness = ({ initial = {}, spies = {}, inSheet = false }) => {
  const [filterValues, setFilterValues] = useState({ dateType: 'default', deliveryFromDatetime: null, deliveryEndDatetime: null, ...initial })
  const handlers = {
    handleChangeDateType: (dateType) => {
      spies.type?.(dateType)
      setFilterValues({ ...filterValues, dateType, deliveryFromDatetime: dateType === 'term' ? null : '2026-09-01 00:00:00', deliveryEndDatetime: null })
    },
    handleChangeFromDate: (value) => {
      spies.from?.(value)
      setFilterValues({ ...filterValues, deliveryFromDatetime: value })
    },
    handleChangeEndDate: (value) => {
      spies.end?.(value)
      setFilterValues({ ...filterValues, deliveryEndDatetime: value })
    }
  }
  const [sheetOpen, setSheetOpen] = useState(true)
  const selector = <UtilsProviders><DateTypeSelector filterValues={filterValues} {...handlers} /></UtilsProviders>
  return (
    <>
      <output data-testid='state'>{JSON.stringify(filterValues)}</output>
      {inSheet
        ? (
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen} title='Filters' closeLabel='Close filters'>{selector}</Sheet>
          )
        : selector}
    </>
  )
}

const state = () => JSON.parse(screen.getByTestId('state').textContent)
const openPicker = async (user) => {
  await user.click(screen.getByRole('button', { name: 'Select a date' }))
  return screen.findByRole('dialog', { name: 'Select a date' })
}

beforeEach(() => {
  lang.configs = { dates_general_format: { value: 'DD-MM-YYYY HH:mm' } }
  stubMatchMedia(false)
})

afterEach(() => {
  delete window.matchMedia
  document.getElementById('app-modals')?.remove()
})

describe('DateTypeSelector · the picker', () => {
  it('shows an empty filter as «Select a date» and opens a dialog with presets, From, To and a calendar', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const button = screen.getByRole('button', { name: 'Select a date' })
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    const popup = await openPicker(user)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    const presets = within(popup).getByRole('group', { name: 'Date' })
    expect(within(presets).getAllByRole('button').map(item => item.textContent)).toEqual(['Any', 'Today', 'Yesterday', 'Last 7 days', 'Last 30 days'])
    expect(within(presets).getByRole('button', { name: 'Any' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(popup).getByLabelText('From')).toHaveAttribute('placeholder', 'dd-mm-yyyy')
    expect(within(popup).getByLabelText('To')).toBeInTheDocument()
    expect(within(popup).getByRole('grid')).toBeInTheDocument()
  })

  it('a preset sends only handleChangeDateType, closes, and gives the focus back to the trigger', async () => {
    const user = userEvent.setup()
    const spies = { type: vi.fn(), from: vi.fn(), end: vi.fn() }
    render(<Harness spies={spies} />)
    const popup = await openPicker(user)
    await user.click(within(popup).getByRole('button', { name: 'Last 7 days' }))
    expect(spies.type).toHaveBeenCalledExactlyOnceWith('last7')
    expect(spies.from).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).not.toBeInTheDocument())
    const button = screen.getByRole('button', { name: 'Last 7 days' })
    expect(button).toHaveFocus()
    expect(state().dateType).toBe('last7')
  })

  it('types a date with the mask of the project and sends «term», then the day at 00:00:00', async () => {
    const user = userEvent.setup()
    const spies = { type: vi.fn(), from: vi.fn(), end: vi.fn() }
    render(<Harness spies={spies} />)
    const popup = await openPicker(user)
    const from = within(popup).getByLabelText('From')
    await user.click(from)
    await user.type(from, '10012026')
    expect(from).toHaveValue('10-01-2026')
    await waitFor(() => expect(spies.from).toHaveBeenCalledWith('2026-01-10 00:00:00'))
    expect(spies.type).toHaveBeenCalledExactlyOnceWith('term')
    expect(state()).toMatchObject({ dateType: 'term', deliveryFromDatetime: '2026-01-10 00:00:00', deliveryEndDatetime: null })
    expect(screen.getByRole('button', { name: 'From 10-01-2026' })).toBeInTheDocument()
  })

  it('a range keeps both ends although each handler spreads stale values: To is sent at 23:59:59', async () => {
    const user = userEvent.setup()
    const spies = { type: vi.fn(), from: vi.fn(), end: vi.fn() }
    render(<Harness spies={spies} />)
    const popup = await openPicker(user)
    const from = within(popup).getByLabelText('From')
    await user.click(from)
    await user.type(from, '10012026')
    await user.click(within(popup).getByRole('button', { name: /January 20, 2026/ }))
    await waitFor(() => expect(spies.end).toHaveBeenCalledWith('2026-01-20 23:59:59'))
    expect(state()).toMatchObject({ dateType: 'term', deliveryFromDatetime: '2026-01-10 00:00:00', deliveryEndDatetime: '2026-01-20 23:59:59' })
    expect(within(popup).getByLabelText('To')).toHaveValue('20-01-2026')
    expect(screen.getByRole('button', { name: '10-01-2026 – 20-01-2026' })).toBeInTheDocument()
    // The calendar paints the run between the ends.
    const days = within(popup).getAllByRole('gridcell').filter(cell => cell.getAttribute('aria-selected') === 'true')
    expect(days).toHaveLength(11)
  })

  it('two clicks on the calendar make a range; a third starts another', async () => {
    const user = userEvent.setup()
    render(<Harness initial={{ dateType: 'term', deliveryFromDatetime: '2026-01-10 00:00:00', deliveryEndDatetime: '2026-01-12 23:59:59' }} />)
    await user.click(screen.getByRole('button', { name: '10-01-2026 – 12-01-2026' }))
    const popup = await screen.findByRole('dialog', { name: 'Select a date' })
    const day = (number) => within(popup).getByRole('button', { name: new RegExp(`January ${number}, 2026`) })
    await user.click(day(15))
    await waitFor(() => expect(state().deliveryEndDatetime).toBeNull())
    expect(state().deliveryFromDatetime).toBe('2026-01-15 00:00:00')
    await user.click(day(18))
    await waitFor(() => expect(state().deliveryEndDatetime).toBe('2026-01-18 23:59:59'))
    expect(within(popup).getByLabelText('From')).toHaveValue('15-01-2026')
    expect(within(popup).getByLabelText('To')).toHaveValue('18-01-2026')
  })

  it('refuses a date that does not exist and one that ends before it starts, and says so', async () => {
    const user = userEvent.setup()
    const spies = { type: vi.fn(), from: vi.fn(), end: vi.fn() }
    render(<Harness spies={spies} initial={{ dateType: 'term', deliveryFromDatetime: '2026-01-10 00:00:00', deliveryEndDatetime: null }} />)
    await user.click(screen.getByRole('button', { name: 'From 10-01-2026' }))
    const popup = await screen.findByRole('dialog', { name: 'Select a date' })
    const from = within(popup).getByLabelText('From')
    const to = within(popup).getByLabelText('To')
    await user.click(to)
    await user.type(to, '05012026')
    expect(to).toHaveAttribute('aria-invalid', 'true')
    expect(within(popup).getByRole('alert')).toHaveTextContent('The start date must not be after the end date.')
    expect(to).toHaveAccessibleDescription('The start date must not be after the end date.')
    expect(spies.end).not.toHaveBeenCalled()
    await user.clear(to)
    await user.click(from)
    await user.clear(from)
    await user.type(from, '31022026')
    expect(from).toHaveAttribute('aria-invalid', 'true')
    expect(within(popup).getByRole('alert')).toHaveTextContent('Enter a real date as dd-mm-yyyy.')
    expect(spies.from).not.toHaveBeenCalledWith(expect.stringContaining('2026-02'))
  })

  it('emptying a field sends null for that end only', async () => {
    const user = userEvent.setup()
    const spies = { type: vi.fn(), from: vi.fn(), end: vi.fn() }
    render(<Harness spies={spies} initial={{ dateType: 'term', deliveryFromDatetime: '2026-01-10 00:00:00', deliveryEndDatetime: '2026-01-20 23:59:59' }} />)
    await user.click(screen.getByRole('button', { name: '10-01-2026 – 20-01-2026' }))
    const popup = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.clear(within(popup).getByLabelText('To'))
    await waitFor(() => expect(spies.end).toHaveBeenCalledWith(null))
    expect(spies.from).not.toHaveBeenCalled()
    expect(state()).toMatchObject({ deliveryFromDatetime: '2026-01-10 00:00:00', deliveryEndDatetime: null })
  })

  it('follows the date format of the project', async () => {
    lang.configs = { dates_general_format: { value: 'MM/DD/YYYY hh:mm A' } }
    const user = userEvent.setup()
    render(<Harness />)
    const popup = await openPicker(user)
    const from = within(popup).getByLabelText('From')
    expect(from).toHaveAttribute('placeholder', 'mm/dd/yyyy')
    await user.type(from, '10012026')
    expect(from).toHaveValue('10/01/2026')
    await waitFor(() => expect(state().deliveryFromDatetime).toBe('2026-10-01 00:00:00'))
  })

  it('falls back to the ISO day when the project has no format', async () => {
    lang.configs = {}
    const user = userEvent.setup()
    render(<Harness />)
    const popup = await openPicker(user)
    expect(within(popup).getByLabelText('From')).toHaveAttribute('placeholder', 'yyyy-mm-dd')
  })
})

describe('DateTypeSelector · calendar', () => {
  const openOnJanuary = async (user) => {
    render(<Harness initial={{ dateType: 'term', deliveryFromDatetime: '2026-01-10 00:00:00', deliveryEndDatetime: null }} />)
    await user.click(screen.getByRole('button', { name: 'From 10-01-2026' }))
    return screen.findByRole('dialog', { name: 'Select a date' })
  }

  it('is a grid of buttons named by their full date, with the month and previous / next', async () => {
    const user = userEvent.setup()
    const popup = await openOnJanuary(user)
    expect(within(popup).getByText('January 2026')).toBeInTheDocument()
    expect(within(popup).getAllByRole('columnheader')).toHaveLength(7)
    expect(within(popup).getByRole('button', { name: 'Saturday, January 10, 2026' })).toBeInTheDocument()
    await user.click(within(popup).getByRole('button', { name: 'Next month' }))
    expect(within(popup).getByText('February 2026')).toBeInTheDocument()
    await user.click(within(popup).getByRole('button', { name: 'Previous month' }))
    await user.click(within(popup).getByRole('button', { name: 'Previous month' }))
    expect(within(popup).getByText('December 2025')).toBeInTheDocument()
    await user.click(within(popup).getByRole('button', { name: 'Go to today' }))
    expect(within(popup).queryByText('December 2025')).not.toBeInTheDocument()
  })

  it('has one tab stop and moves with the arrows, Home / End and the page keys', async () => {
    const user = userEvent.setup()
    const popup = await openOnJanuary(user)
    const day = (name) => within(popup).getByRole('button', { name })
    const tabStops = () => within(popup).getAllByRole('button').filter(button => button.dataset.day && button.tabIndex === 0)
    expect(tabStops()).toHaveLength(1)
    expect(tabStops()[0]).toHaveAccessibleName('Saturday, January 10, 2026')
    day('Saturday, January 10, 2026').focus()
    await user.keyboard('{ArrowLeft}')
    expect(day('Friday, January 9, 2026')).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(day('Friday, January 16, 2026')).toHaveFocus()
    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(day('Friday, January 2, 2026')).toHaveFocus()
    await user.keyboard('{Home}')
    expect(day('Sunday, December 28, 2025')).toHaveFocus()
    await user.keyboard('{End}')
    expect(day('Saturday, January 3, 2026')).toHaveFocus()
    await user.keyboard('{PageDown}')
    expect(within(popup).getByText('February 2026')).toBeInTheDocument()
    expect(day('Tuesday, February 3, 2026')).toHaveFocus()
    expect(tabStops()).toHaveLength(1)
  })
})

describe('DateTypeSelector · layers', () => {
  it('Escape closes only the picker, returns the focus to the trigger, and the next Escape closes the sheet', async () => {
    const user = userEvent.setup()
    render(<Harness inSheet />)
    await screen.findByRole('dialog', { name: 'Filters' })
    await openPicker(user)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).not.toBeInTheDocument())
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Select a date' })).toHaveFocus())
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Filters' })).not.toBeInTheDocument())
  })

  it('Escape while typing in From closes the picker, not the sheet', async () => {
    const user = userEvent.setup()
    render(<Harness inSheet />)
    await screen.findByRole('dialog', { name: 'Filters' })
    const popup = await openPicker(user)
    await user.click(within(popup).getByLabelText('From'))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).not.toBeInTheDocument())
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeInTheDocument()
  })

  it('«Done» closes it and a press on the trigger toggles it', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const popup = await openPicker(user)
    await user.click(within(popup).getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).not.toBeInTheDocument())
    const button = screen.getByRole('button', { name: 'Select a date' })
    await user.click(button)
    await screen.findByRole('dialog', { name: 'Select a date' })
    await user.click(button)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).not.toBeInTheDocument())
  })

  it('under 768px it is a bottom sheet over the filters, with the same content', async () => {
    stubMatchMedia(true)
    const user = userEvent.setup()
    render(<Harness inSheet />)
    await screen.findByRole('dialog', { name: 'Filters' })
    await user.click(screen.getByRole('button', { name: 'Select a date' }))
    const sheet = await screen.findByRole('dialog', { name: 'Select a date' })
    expect(sheet).toHaveAttribute('data-side', 'bottom')
    expect(within(sheet).getByLabelText('From')).toBeInTheDocument()
    expect(within(sheet).getByRole('grid')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Select a date' })).not.toBeInTheDocument())
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeInTheDocument()
  })
})

// redesign tramo A r5 (W0-QA3-02): the pill writes the days like the list (parseDate), never ISO, with and without dates_general_format;
// the values that travel stay 'YYYY-MM-DD HH:mm:ss'.
describe('DateTypeSelector · the days of the pill', () => {
  const range = { dateType: 'term', deliveryFromDatetime: '2026-10-01 00:00:00', deliveryEndDatetime: '2026-10-05 23:59:59' }

  it('without dates_general_format paints «01 Oct 2026 – 05 Oct 2026», no ISO', () => {
    lang.configs = {}
    render(<Harness initial={range} />)
    const button = screen.getByRole('button', { name: '01 Oct 2026 – 05 Oct 2026' })
    expect(button).toBeInTheDocument()
    expect(button.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('without the format, one end only: «From 01 Oct 2026»', () => {
    lang.configs = {}
    render(<Harness initial={{ ...range, deliveryEndDatetime: null }} />)
    expect(screen.getByRole('button', { name: 'From 01 Oct 2026' })).toBeInTheDocument()
  })

  it('with dates_general_format paints the project format', () => {
    lang.configs = { dates_general_format: { value: 'MM/DD/YYYY hh:mm A' } }
    render(<Harness initial={range} />)
    expect(screen.getByRole('button', { name: '10/01/2026 – 10/05/2026' })).toBeInTheDocument()
  })

  it('still sends ISO to the handlers when a range is picked without a format', async () => {
    lang.configs = {}
    const user = userEvent.setup()
    const spies = { from: vi.fn(), end: vi.fn() }
    render(<Harness spies={spies} />)
    const popup = await openPicker(user)
    const from = within(popup).getByLabelText('From')
    await user.click(from)
    await user.type(from, '20261001')
    await waitFor(() => expect(spies.from).toHaveBeenCalledWith('2026-10-01 00:00:00'))
    expect(screen.getByRole('button', { name: 'From 01 Oct 2026' })).toBeInTheDocument()
  })
})
