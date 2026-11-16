/* eslint-disable import/first */
// redesign PE-B1 (decisions 3, 4, 8, 9, 10; PE-01, PE-02, PE-04, PE-05, PE-09, PE-17): the promotions list as a Product DataTable
// (and RecordCards under 768px), the same in Quick offers and Advanced offers. Values come out of the REAL UtilsProviders
// (parseDate, parsePrice) and the real helpers of promotionData.js; only the environment (language, config, the phone flag) is
// simulated. The Product wrappers are real. The dates of the fixtures are far from today (2020 and 2099) so no test depends on the clock.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ phone: false }))

vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: {} }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', async () => {
  const { useUtils } = await import('../../../../../../contexts/UtilsContext')
  return {
    useLanguage: () => [{ dictionary: {}, language: { code: 'en' } }, (_key, text) => text],
    useUtils
  }
})
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => mocks.phone }))

import { UtilsProviders, useUtils } from '../../../../../../contexts/UtilsContext'
import { PromotionsTable } from '../PromotionsTable'

const ACTIVE_FROM = '2020-01-01 00:00:00'
const FAR_END = '2099-12-31 23:59:59'

const weekend = {
  id: 1,
  name: 'Weekend 15%',
  description: 'Fifteen percent every weekend',
  enabled: true,
  start: '2020-09-01 00:00:00',
  end: FAR_END,
  rate_type: 1,
  rate: 15,
  target: 1,
  minimum: 30,
  max_discount: 10,
  type: 1,
  auto: true,
  rank: 2,
  image: null
}
const welcome = {
  id: 2,
  name: 'Welcome code',
  description: null,
  enabled: false,
  start: ACTIVE_FROM,
  end: null,
  rate_type: 2,
  rate: 5,
  target: 3,
  minimum: 0,
  max_discount: 0,
  type: 2,
  auto: false,
  coupon: 'WELCOME5',
  rank: 1,
  image: 'https://example.com/welcome.png'
}
const freeShip = {
  id: 3,
  name: 'Free shipping',
  description: 'Delivery on us',
  enabled: true,
  start: ACTIVE_FROM,
  end: '2020-06-30 23:59:59',
  rate_type: 1,
  rate: 100,
  target: 2,
  type: 1,
  auto: false,
  rank: null
}
const soon = {
  id: 4,
  name: 'Opening week',
  enabled: true,
  start: '2099-01-01 00:00:00',
  end: '2099-01-07 23:59:59',
  rate_type: 1,
  rate: 12.5,
  target: 1,
  type: 2,
  auto: true,
  rank: null
}

const util = {}
const Probe = () => {
  Object.assign(util, useUtils()[0])
  return null
}

let current
const draw = (props = {}) => {
  current = {
    variant: 'advanced',
    promotions: [weekend, welcome, freeShip, soon],
    loading: false,
    error: null,
    onRetry: vi.fn(),
    activeId: undefined,
    onOpen: vi.fn(),
    onToggle: vi.fn(() => Promise.resolve({ ok: true })),
    onDelete: vi.fn(),
    drag: {
      onDragStart: vi.fn(),
      onDragOver: vi.fn(),
      onDrop: vi.fn(),
      onDragEnd: vi.fn(),
      targetId: '',
      targetBottom: false
    },
    pagination: { page: 1, pageSize: 10, total: 4, onPageChange: vi.fn(), onPageSizeChange: vi.fn(), pageSizeOptions: [10, 25, 50] },
    searchValue: '',
    onClearSearch: vi.fn(),
    emptyAction: <button type='button'>Add promotion</button>,
    ...props
  }
  const ui = (next) => <UtilsProviders><Probe /><PromotionsTable {...next} /></UtilsProviders>
  const view = render(ui(current))
  return { ...view, rerenderWith: (extra) => { current = { ...current, ...extra }; view.rerender(ui(current)) } }
}

const quick = (props = {}) => draw({ variant: 'quick', drag: undefined, pagination: { page: 1, pageSize: 10, total: 4, onPageChange: vi.fn(), onPageSizeChange: vi.fn() }, emptyAction: undefined, ...props })

const rowOf = (container, id) => container.querySelector(`tr[data-row-id="${id}"]`)
const cardOf = (container, id) => container.querySelector(`li[data-row-id="${id}"]`)
const cellsOf = (row) => Array.from(row.querySelectorAll('td, th[scope="row"]'))
const headers = () => screen.getAllByRole('columnheader').map(header => header.textContent)
const rowIds = (container) => Array.from(container.querySelectorAll('tbody tr[data-row-id]')).map(row => Number(row.getAttribute('data-row-id')))

beforeEach(() => { mocks.phone = false })
afterEach(() => { vi.restoreAllMocks() })

describe('PromotionsTable columns', () => {
  it('advanced: the priority handle, Promotion, Status, Benefit, Promotion type, Applies, Date range, Enable and the row menu, in a table named «Promotions»', () => {
    draw()
    expect(screen.getByRole('table', { name: 'Promotions' })).toBeInTheDocument()
    expect(headers()).toEqual(['Priority', 'Promotion', 'Status', 'Benefit', 'Promotion type', 'Applies', 'Date range', 'Enable', 'Actions'])
  })

  it('quick: no handle and no menu; Promotion, Status, Benefit, Applies, Date range, Enable and the visible actions', () => {
    quick()
    expect(headers()).toEqual(['Promotion', 'Status', 'Benefit', 'Applies', 'Date range', 'Enable', 'Actions'])
  })

  it('the Promotion cell is the row header with the name', () => {
    const { container } = draw()
    expect(within(rowOf(container, 1)).getByRole('rowheader')).toHaveTextContent('Weekend 15%')
  })

  it('advanced draws rows in the order of their rank, null ranks first (as main), and does not reorder the list it was given (PE-08)', () => {
    const promotions = [weekend, welcome, freeShip, soon]
    const { container } = draw({ promotions })
    expect(rowIds(container)).toEqual([3, 4, 2, 1])
    expect(promotions.map(item => item.id)).toEqual([1, 2, 3, 4])
  })

  it('advanced: the image is 24px of the promotion or a neutral box; quick has no image', () => {
    const { container, unmount } = draw()
    expect(rowOf(container, 2).querySelector('img.odc-promo-image')).toHaveAttribute('src', expect.stringContaining('welcome.png'))
    expect(rowOf(container, 2).querySelector('img.odc-promo-image')).toHaveAttribute('alt', '')
    expect(rowOf(container, 1).querySelector('img')).toBeNull()
    expect(rowOf(container, 1).querySelector('.odc-promo-image-empty')).not.toBeNull()
    unmount()
    const view = quick()
    expect(view.container.querySelector('.odc-promo-image')).toBeNull()
  })

  it('the Type column names the target and Applies names how it is applied; a coupon shows its code in a mono chip', () => {
    const { container } = draw()
    const text = (id, column) => cellsOf(rowOf(container, id))[column].textContent
    // cells: handle, promotion, status, benefit, type, applies, dates, enable, menu
    expect(text(1, 4)).toBe('Subtotal')
    expect(text(2, 4)).toBe('Service fee')
    expect(text(3, 4)).toBe('Delivery fee')
    expect(text(1, 5)).toBe('Automatic discount')
    expect(text(3, 5)).toBe('Discount')
    expect(text(4, 5)).toBe('Automatic coupon')
    expect(text(2, 5)).toBe('Coupon WELCOME5')
    const chip = within(cellsOf(rowOf(container, 2))[5]).getByText('WELCOME5')
    expect(chip).toHaveClass('odc-promo-code')
    // a discount never shows a code
    expect(rowOf(container, 1).querySelector('.odc-promo-code')).toBeNull()
  })
})

describe('PromotionsTable status', () => {
  it('says Active, Off, Ended and Scheduled in words, from the switch and the dates', () => {
    const { container } = draw()
    const status = id => cellsOf(rowOf(container, id))[2]
    expect(status(1)).toHaveTextContent('Active')
    expect(status(2)).toHaveTextContent('Off')
    expect(status(3)).toHaveTextContent('Ended')
    expect(status(4)).toHaveTextContent('Scheduled')
    expect(status(1).querySelector('.odc-status')).toHaveAttribute('data-family', 'progress')
    expect(status(3).querySelector('.odc-status')).toHaveAttribute('data-family', 'done')
  })

  it('a disabled promotion that is also past its end reads Off, not Ended', () => {
    const { container } = draw({ promotions: [{ ...freeShip, enabled: 0 }] })
    expect(cellsOf(rowOf(container, 3))[2]).toHaveTextContent('Off')
    expect(cellsOf(rowOf(container, 3))[2]).not.toHaveTextContent('Ended')
  })

  // (G4, tanda AK, coordinator option a): an Ended promotion keeps its switch on; at 1440 the row already says «Ended» in
  // Status, so the switch is described by that cell, with nothing new on screen (AC-9 keeps the «no longer applies» line for the cards,
  // which have no column header)
  it('the switch of an Ended row is described by its Status cell, and the others are not', () => {
    const { container } = draw()
    const ended = within(rowOf(container, 3)).getByRole('switch', { name: 'Enable Free shipping' })
    const described = ended.getAttribute('aria-describedby')
    expect(described).not.toBeNull()
    const status = cellsOf(rowOf(container, 3))[2]
    expect(status.querySelector(`[id="${described}"]`)).toHaveTextContent(/^Ended$/)
    expect(within(rowOf(container, 1)).getByRole('switch', { name: 'Enable Weekend 15%' })).not.toHaveAttribute('aria-describedby')
    expect(container).not.toHaveTextContent('no longer applies')
  })
})

describe('PromotionsTable benefit and dates', () => {
  it('the benefit is written with its figures in .odc-figure (the rate, the minimum, the cap)', () => {
    const { container } = draw()
    const benefit = cellsOf(rowOf(container, 1))[3]
    expect(benefit.textContent).toBe(`15% off · min ${util.parsePrice(30)} · max ${util.parsePrice(10)}`)
    expect(within(benefit).getByText('15%')).toHaveClass('odc-figure')
    expect(within(benefit).getByText(util.parsePrice(30))).toHaveClass('odc-figure')
    expect(within(benefit).getByText(util.parsePrice(10))).toHaveClass('odc-figure')
    // a fixed amount off the service fee; free delivery is words only
    expect(cellsOf(rowOf(container, 2))[3].textContent).toBe(`${util.parsePrice(5)} off service fee`)
    expect(within(cellsOf(rowOf(container, 2))[3]).getByText(util.parsePrice(5))).toHaveClass('odc-figure')
    expect(cellsOf(rowOf(container, 3))[3].textContent).toBe('Free delivery')
    expect(cellsOf(rowOf(container, 4))[3].textContent).toBe('12.5% off')
  })

  it('a promotion without a usable rate shows a dash', () => {
    const { container } = draw({ promotions: [{ ...weekend, rate: null }] })
    expect(cellsOf(rowOf(container, 1))[3].textContent).toBe('—')
  })

  it('the dates come from parseDate (day only, wall time) in figures, and no ISO date reaches the DOM (decision 13)', () => {
    const { container } = draw()
    const start = util.parseDate(weekend.start, { utc: false, dateOnly: true })
    const end = util.parseDate(weekend.end, { utc: false, dateOnly: true })
    const dates = cellsOf(rowOf(container, 1))[6]
    expect(dates.textContent).toBe(`${start} – ${end}`)
    expect(within(dates).getByText(start)).toHaveClass('odc-figure')
    expect(within(dates).getByText(end)).toHaveClass('odc-figure')
    expect(container.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('no end date says so, in words and not as a figure', () => {
    const { container } = draw()
    const start = util.parseDate(welcome.start, { utc: false, dateOnly: true })
    const dates = cellsOf(rowOf(container, 2))[6]
    expect(dates.textContent).toBe(`${start} – No end date`)
    expect(within(dates).getByText('No end date')).not.toHaveClass('odc-figure')
  })
})

describe('PromotionsTable enable switch', () => {
  it('names the object: «Enable <name>», on when the promotion is, and asks the host for the opposite', async () => {
    const { container } = draw()
    const control = within(rowOf(container, 1)).getByRole('switch', { name: 'Enable Weekend 15%' })
    expect(control).toBeChecked()
    expect(within(rowOf(container, 2)).getByRole('switch', { name: 'Enable Welcome code' })).not.toBeChecked()
    await userEvent.click(control)
    expect(current.onToggle).toHaveBeenCalledWith(weekend, false)
    await userEvent.click(within(rowOf(container, 2)).getByRole('switch'))
    expect(current.onToggle).toHaveBeenLastCalledWith(welcome, true)
    expect(current.onOpen).not.toHaveBeenCalled()
  })

  it('a stored «0» is off in the switch too, as in the status', () => {
    const { container } = draw({ promotions: [{ ...weekend, enabled: '0' }] })
    expect(within(rowOf(container, 1)).getByRole('switch')).not.toBeChecked()
    expect(cellsOf(rowOf(container, 1))[2]).toHaveTextContent('Off')
  })

  it('a save that fails leaves the switch on its stored value and says why (PE-03)', async () => {
    const onToggle = vi.fn(() => Promise.resolve({ ok: false, error: 'Nope' }))
    const { container } = draw({ onToggle })
    const control = within(rowOf(container, 1)).getByRole('switch', { name: 'Enable Weekend 15%' })
    await userEvent.click(control)
    expect(await screen.findByRole('alert')).toHaveTextContent('Nope')
    expect(control).toBeChecked()
    expect(onToggle).toHaveBeenCalledWith(weekend, false)
  })

  it('an error without text says the translated fallback', async () => {
    const { container } = draw({ onToggle: vi.fn(() => Promise.resolve({ ok: false })) })
    await userEvent.click(within(rowOf(container, 1)).getByRole('switch'))
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't change this promotion. Try again.")
  })
})

describe('PromotionsTable opening and deleting', () => {
  it('clicking a row opens it, and the row of the open promotion is the active one', async () => {
    const { container } = draw({ activeId: '3' })
    await userEvent.click(within(rowOf(container, 1)).getByText('Weekend 15%'))
    expect(current.onOpen).toHaveBeenCalledWith(weekend)
    expect(rowOf(container, 3)).toHaveAttribute('aria-current', 'true')
    expect(rowOf(container, 1)).not.toHaveAttribute('aria-current')
  })

  it('Enter on a focused row opens it', async () => {
    const { container } = draw()
    act(() => rowOf(container, 3).focus())
    await userEvent.keyboard('{Enter}')
    expect(current.onOpen).toHaveBeenCalledWith(freeShip)
  })

  it('advanced: «Delete» is in the menu of the row, which names the promotion, and does not open the row', async () => {
    const { container } = draw()
    await userEvent.click(within(rowOf(container, 1)).getByRole('button', { name: 'Actions for Weekend 15%' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    expect(current.onDelete).toHaveBeenCalledWith(weekend)
    expect(current.onOpen).not.toHaveBeenCalled()
  })

  it('advanced has no Move up / Move down (owner proposal P-6)', async () => {
    const { container } = draw()
    await userEvent.click(within(rowOf(container, 1)).getByRole('button', { name: 'Actions for Weekend 15%' }))
    const items = (await screen.findAllByRole('menuitem')).map(item => item.textContent)
    expect(items).toEqual(['Delete'])
  })

  it('quick: «Delete <name>» is a visible button, never behind a menu, and «Edit promotion» opens once', async () => {
    const { container } = quick()
    const row = rowOf(container, 1)
    expect(within(row).queryByRole('button', { name: /Actions for/ })).toBeNull()
    const remove = within(row).getByRole('button', { name: 'Delete Weekend 15%' })
    // redesign PE-B4 (live check): in the table row the visible Delete is an icon button whose name and tooltip say it
    expect(remove).toHaveAttribute('title', 'Delete Weekend 15%')
    await userEvent.click(remove)
    expect(current.onDelete).toHaveBeenCalledWith(weekend)
    expect(current.onOpen).not.toHaveBeenCalled()
    await userEvent.click(within(row).getByRole('button', { name: 'Edit promotion' }))
    expect(current.onOpen).toHaveBeenCalledTimes(1)
    expect(current.onOpen).toHaveBeenCalledWith(weekend)
  })

  it('quick: the second line of the name is the description, or «No description»', () => {
    const { container } = quick()
    expect(rowOf(container, 1)).toHaveTextContent('Fifteen percent every weekend')
    expect(within(rowOf(container, 1)).getByText('Fifteen percent every weekend')).toHaveAttribute('title', 'Fifteen percent every weekend')
    expect(rowOf(container, 2)).toHaveTextContent('No description')
  })
})

describe('PromotionsTable drag and drop (advanced)', () => {
  it('each row has a handle that cannot open the row, and the rows are the ones the controller looks for', () => {
    const { container } = draw()
    const row = rowOf(container, 1)
    const grip = row.querySelector('.odc-promo-grip')
    expect(grip).toHaveAttribute('draggable', 'true')
    expect(grip).toHaveAttribute('data-odc-no-open')
    expect(grip).toHaveAttribute('aria-hidden', 'true')
    expect(row).toHaveAttribute('data-promotion-id', '1')
    // main's handler resolves the row with this class
    expect(row).toHaveClass('draggable_promotion')
  })

  it('clicking the handle does not open the row', async () => {
    const { container } = draw()
    await userEvent.click(rowOf(container, 1).querySelector('.odc-promo-grip'))
    expect(current.onOpen).not.toHaveBeenCalled()
  })

  it('starting a drag on the handle gives the host the event and the promotion', () => {
    const { container } = draw()
    const dataTransfer = { setData: vi.fn(), setDragImage: vi.fn() }
    fireEvent.dragStart(rowOf(container, 2).querySelector('.odc-promo-grip'), { dataTransfer })
    expect(current.drag.onDragStart).toHaveBeenCalledTimes(1)
    expect(current.drag.onDragStart.mock.calls[0][1]).toBe(welcome)
  })

  it('dragging over a row gives the host the id and the index of that row in the rendered order', () => {
    const { container } = draw()
    // rendered order: 3, 4, 2, 1
    fireEvent.dragOver(within(rowOf(container, 1)).getByText('Weekend 15%'), { dataTransfer: {} })
    expect(current.drag.onDragOver).toHaveBeenCalledTimes(1)
    const [event, id, index] = current.drag.onDragOver.mock.calls[0]
    expect(event.type).toBe('dragover')
    expect(id).toBe(1)
    expect(index).toBe(3)
    fireEvent.dragOver(within(rowOf(container, 4)).getByText('Opening week'), { dataTransfer: {} })
    expect(current.drag.onDragOver.mock.calls[1].slice(1)).toEqual([4, 1])
  })

  it('dropping on a row gives the host the event and the record of that row', () => {
    const { container } = draw()
    fireEvent.drop(within(rowOf(container, 3)).getByText('Free shipping'), { dataTransfer: { getData: () => '2' } })
    expect(current.drag.onDrop).toHaveBeenCalledTimes(1)
    const [event, record] = current.drag.onDrop.mock.calls[0]
    expect(event.type).toBe('drop')
    expect(record).toBe(freeShip)
    expect(current.onOpen).not.toHaveBeenCalled()
  })

  it('a drop or a drag over something that is not a row is not forwarded', () => {
    const { container } = draw()
    fireEvent.drop(container.querySelector('thead th'), { dataTransfer: {} })
    fireEvent.dragOver(container.querySelector('thead th'), { dataTransfer: {} })
    expect(current.drag.onDrop).not.toHaveBeenCalled()
    expect(current.drag.onDragOver).not.toHaveBeenCalled()
  })

  it('the end of a drag reaches the host from the handle that was dragged', () => {
    const { container } = draw()
    fireEvent.dragEnd(rowOf(container, 1).querySelector('.odc-promo-grip'), { dataTransfer: {} })
    expect(current.drag.onDragEnd).toHaveBeenCalledTimes(1)
  })

  it('marks the row the host says is the target, and the last row when the drop goes to the bottom', () => {
    const view = draw()
    view.rerenderWith({ drag: { ...current.drag, targetId: 1 } })
    expect(rowOf(view.container, 1)).toHaveClass('odc-promo-drop-target')
    expect(rowOf(view.container, 2)).not.toHaveClass('odc-promo-drop-target')
    view.rerenderWith({ drag: { ...current.drag, targetId: '', targetBottom: true } })
    expect(rowOf(view.container, 1)).toHaveClass('odc-promo-drop-bottom') // the last in rank order
    expect(rowOf(view.container, 4)).not.toHaveClass('odc-promo-drop-bottom')
  })

  it('quick has no handle and no drag', () => {
    const { container } = quick()
    expect(container.querySelector('.odc-promo-grip')).toBeNull()
    expect(container.querySelector('[data-promotion-id]')).not.toBeNull() // the attribute stays; only advanced listens
  })
})

describe('PromotionsTable states', () => {
  it('loading paints ten skeleton rows, busy, with a hidden label, and no empty state', () => {
    const { container } = draw({ loading: true, promotions: [] })
    expect(container.querySelectorAll('tr[data-skeleton]')).toHaveLength(10)
    expect(screen.getByRole('table', { name: 'Promotions' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Loading promotions')).toHaveClass('odc-sr-only')
    expect(screen.queryByText('No promotions yet')).toBeNull()
  })

  it('an error takes the place of the list: a message, the reason, and Retry (PE-15)', async () => {
    draw({ error: ['Network failure'], promotions: [] })
    const alert = screen.getByRole('alert')
    expect(within(alert).getByText("We couldn't load promotions.")).toBeInTheDocument()
    expect(within(alert).getByText('Network failure')).toBeInTheDocument()
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(current.onRetry).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('an error given as a string works too, and an empty list of errors is not an error', () => {
    const view = draw({ error: 'Unauthorized', promotions: [] })
    expect(within(screen.getByRole('alert')).getByText('Unauthorized')).toBeInTheDocument()
    view.rerenderWith({ error: [], promotions: [weekend] })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('no results for a search: «No promotions match your search» and «Clear search»', async () => {
    draw({ promotions: [], searchValue: 'zzz', pagination: { page: 1, pageSize: 10, total: 0 } })
    expect(screen.getByText('No promotions match your search')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(current.onClearSearch).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })

  it('advanced, first use: «No promotions yet» with the action the host gives', () => {
    draw({ promotions: [], pagination: { page: 1, pageSize: 10, total: 0 } })
    expect(screen.getByText('No promotions yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add promotion' })).toBeInTheDocument()
    expect(screen.queryByText('No promotions match your search')).toBeNull()
  })

  it('quick, first use: the existing text and no action', () => {
    quick({ promotions: [], pagination: { page: 1, pageSize: 10, total: 0 } })
    expect(screen.getByText('No promotions yet. Choose a template to create your first draft.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add promotion' })).toBeNull()
  })
})

describe('PromotionsTable column manager (advanced)', () => {
  const openManager = async () => userEvent.click(screen.getByRole('button', { name: 'Manage columns' }))

  it('offers Promotion (locked), Status, Benefit, Promotion type, Applies, Date range and Enable', async () => {
    draw()
    await openManager()
    const dialog = await screen.findByRole('dialog')
    for (const name of ['Promotion', 'Status', 'Benefit', 'Promotion type', 'Applies', 'Date range', 'Enable']) {
      expect(within(dialog).getByRole('checkbox', { name })).toBeInTheDocument()
    }
    expect(within(dialog).getByRole('checkbox', { name: 'Promotion' })).toBeDisabled()
    expect(within(dialog).getByRole('checkbox', { name: 'Date range' })).toBeEnabled()
  })

  it('main let people hide the type, how and date range columns and the enable column: it still can, and Reset brings them back', async () => {
    draw()
    await openManager()
    const dialog = await screen.findByRole('dialog')
    for (const name of ['Promotion type', 'Applies', 'Date range', 'Enable']) {
      await userEvent.click(within(dialog).getByRole('checkbox', { name }))
    }
    expect(headers()).toEqual(['Priority', 'Promotion', 'Status', 'Benefit', 'Actions'])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset' }))
    expect(headers()).toContain('Date range')
    expect(headers()).toContain('Enable')
  })

  it('a host that gives hiddenColumnIds decides what is hidden and hears the new list of hidden ids', async () => {
    const onColumnsChange = vi.fn()
    draw({ hiddenColumnIds: ['dates'], onColumnsChange })
    expect(headers()).not.toContain('Date range')
    await openManager()
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Applies' }))
    expect(onColumnsChange).toHaveBeenCalledTimes(1)
    expect(onColumnsChange.mock.calls[0][0].sort()).toEqual(['applies', 'dates'])
  })

  it('quick has no column manager', () => {
    quick()
    expect(screen.queryByRole('button', { name: 'Manage columns' })).toBeNull()
  })
})

describe('PromotionsTable pagination', () => {
  it('advanced shows the range with figures and 10, 25 and 50 per page', async () => {
    draw({ promotions: [weekend], pagination: { page: 2, pageSize: 10, total: 25, onPageChange: vi.fn(), onPageSizeChange: vi.fn(), pageSizeOptions: [10, 25, 50] } })
    const nav = screen.getByRole('navigation', { name: 'Pagination' })
    expect(nav).toHaveTextContent('Showing 11–20 of 25')
    expect(within(nav).getByText('11')).toHaveClass('odc-figure')
    await userEvent.click(within(nav).getByRole('button', { name: /Items per page/ }))
    expect((await screen.findAllByRole('menuitemradio')).map(item => item.textContent)).toEqual(['10', '25', '50'])
  })

  it('next, previous and another page size tell the host', async () => {
    const pagination = { page: 2, pageSize: 10, total: 25, onPageChange: vi.fn(), onPageSizeChange: vi.fn(), pageSizeOptions: [10, 25, 50] }
    draw({ promotions: [weekend], pagination })
    const nav = screen.getByRole('navigation', { name: 'Pagination' })
    await userEvent.click(within(nav).getByRole('button', { name: 'Next page' }))
    expect(pagination.onPageChange).toHaveBeenCalledWith(3)
    await userEvent.click(within(nav).getByRole('button', { name: 'Previous page' }))
    expect(pagination.onPageChange).toHaveBeenLastCalledWith(1)
    await userEvent.click(within(nav).getByRole('button', { name: /Items per page/ }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: '25' }))
    expect(pagination.onPageSizeChange.mock.calls[0][0]).toBe(25)
  })

  it('quick keeps ten per page with previous and next, and no size selector', () => {
    quick({ promotions: [weekend], pagination: { page: 1, pageSize: 10, total: 25, onPageChange: vi.fn(), onPageSizeChange: vi.fn() } })
    const nav = screen.getByRole('navigation', { name: 'Pagination' })
    expect(within(nav).getByRole('button', { name: 'Next page' })).toBeEnabled()
    expect(within(nav).queryByRole('button', { name: /Items per page/ })).toBeNull()
  })

  it('paints nothing when there are no results', () => {
    draw({ promotions: [], pagination: { page: 1, pageSize: 10, total: 0 } })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })
})

describe('PromotionsTable on a phone', () => {
  beforeEach(() => { mocks.phone = true })

  it('draws one card per promotion and no table, in the rank order, named «Promotions»', () => {
    const { container } = draw()
    expect(screen.queryByRole('table')).toBeNull()
    const list = screen.getByRole('list', { name: 'Promotions' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(4)
    expect(Array.from(container.querySelectorAll('li[data-row-id]')).map(item => Number(item.getAttribute('data-row-id')))).toEqual([3, 4, 2, 1])
  })

  it('every card carries the name, the status, the benefit in figures and the dates', () => {
    const { container } = draw()
    const card = cardOf(container, 1)
    expect(within(card).getByRole('link', { name: 'Open Weekend 15%' })).toHaveTextContent('Weekend 15%')
    expect(card).toHaveTextContent('Active')
    expect(card).toHaveTextContent(`15% off · min ${util.parsePrice(30)} · max ${util.parsePrice(10)}`)
    expect(within(card).getByText('15%')).toHaveClass('odc-figure')
    expect(card).toHaveTextContent(`${util.parseDate(weekend.start, { utc: false, dateOnly: true })} – ${util.parseDate(weekend.end, { utc: false, dateOnly: true })}`)
    expect(card).toHaveTextContent('Automatic discount')
    expect(cardOf(container, 2)).toHaveTextContent('Coupon WELCOME5')
    expect(cardOf(container, 3)).toHaveTextContent('Ended')
    expect(container.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('the switch is on the card, names the promotion, and toggling it does not open the card', async () => {
    const { container } = draw()
    await userEvent.click(within(cardOf(container, 1)).getByRole('switch', { name: 'Enable Weekend 15%' }))
    expect(current.onToggle).toHaveBeenCalledWith(weekend, false)
    expect(current.onOpen).not.toHaveBeenCalled()
  })

  it('advanced: the card has the row menu with «Delete»', async () => {
    const { container } = draw()
    await userEvent.click(within(cardOf(container, 1)).getByRole('button', { name: 'Actions for Weekend 15%' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    expect(current.onDelete).toHaveBeenCalledWith(weekend)
    expect(current.onOpen).not.toHaveBeenCalled()
  })

  it('quick: the card shows the description (or «No description») and the visible «Edit promotion» and «Delete <name>»', async () => {
    const { container } = quick()
    const card = cardOf(container, 1)
    expect(card).toHaveTextContent('Fifteen percent every weekend')
    expect(cardOf(container, 2)).toHaveTextContent('No description')
    expect(within(card).queryByRole('button', { name: /Actions for/ })).toBeNull()
    await userEvent.click(within(card).getByRole('button', { name: 'Delete Weekend 15%' }))
    expect(current.onDelete).toHaveBeenCalledWith(weekend)
    await userEvent.click(within(card).getByRole('button', { name: 'Edit promotion' }))
    expect(current.onOpen).toHaveBeenCalledTimes(1)
  })

  it('tapping a card opens it', async () => {
    const { container } = draw()
    await userEvent.click(within(cardOf(container, 3)).getByRole('link', { name: 'Open Free shipping' }))
    expect(current.onOpen).toHaveBeenCalledWith(freeShip)
  })

  it('has no handle to drag', () => {
    const { container } = draw()
    expect(container.querySelector('.odc-promo-grip')).toBeNull()
  })

  it('has the same loading, error and empty states', () => {
    const view = draw({ loading: true, promotions: [] })
    expect(screen.getByText('Loading promotions')).toBeInTheDocument()
    expect(view.container.querySelectorAll('li[data-skeleton]')).toHaveLength(10)
    view.rerenderWith({ loading: false, error: ['Boom'] })
    expect(within(screen.getByRole('alert')).getByText("We couldn't load promotions.")).toBeInTheDocument()
    view.rerenderWith({ error: null, pagination: { page: 1, pageSize: 10, total: 0 } })
    expect(screen.getByText('No promotions yet')).toBeInTheDocument()
    view.rerenderWith({ searchValue: 'x' })
    expect(screen.getByText('No promotions match your search')).toBeInTheDocument()
  })
})

// redesign (row 81, review r1 R8, R9): two gaps against main.
// redesign AC-D (G7): on a phone the switch of a card said nothing visible («Enable <name>» was only its aria-label), and an
// Ended promotion kept it on with no hint of what that means. The card now writes «Enable» beside the switch (the word of the table's
// header; the accessible name stays «Enable <name>», which contains it), and an Ended card says so in a line of its own. The switch
// is not removed or disabled.
describe('PromotionsTable phone card switch (G7)', () => {
  beforeEach(() => { mocks.phone = true })

  it('every card shows «Enable» as visible text beside its switch, and the switch keeps its name «Enable <name>»', () => {
    const { container } = draw()
    for (const promotion of [weekend, welcome, freeShip, soon]) {
      const control = within(cardOf(container, promotion.id)).getByRole('switch', { name: `Enable ${promotion.name}` })
      expect(control).toHaveTextContent('Enable')
      expect(control.querySelector('.odc-switch-text')).toHaveTextContent(/^Enable$/)
    }
  })

  it('toggling through the visible label asks the host for the opposite and does not open the card', async () => {
    const { container } = draw()
    await userEvent.click(within(cardOf(container, 1)).getByText('Enable'))
    expect(current.onToggle).toHaveBeenCalledWith(weekend, false)
    expect(current.onOpen).not.toHaveBeenCalled()
  })

  it('an Ended promotion says in a visible line that it no longer applies, and keeps its switch on and enabled', () => {
    const { container } = draw()
    const card = cardOf(container, 3)
    expect(card).toHaveTextContent('Ended · no longer applies')
    const control = within(card).getByRole('switch', { name: 'Enable Free shipping' })
    expect(control).toBeChecked()
    expect(control).not.toBeDisabled()
    expect(control.getAttribute('aria-describedby')).not.toBeNull()
    expect(card.querySelector(`[id="${control.getAttribute('aria-describedby')}"]`)).toHaveTextContent('Ended · no longer applies')
  })

  it('a promotion that has not ended draws no such line', () => {
    const { container } = draw()
    for (const id of [1, 2, 4]) expect(cardOf(container, id)).not.toHaveTextContent('no longer applies')
    expect(cardOf(container, 1).querySelector('.odc-promo-card-note')).toBeNull()
  })

  it('a disabled promotion past its end reads Off, so it gets no Ended line either', () => {
    const { container } = draw({ promotions: [{ ...freeShip, enabled: 0 }] })
    expect(cardOf(container, 3)).not.toHaveTextContent('no longer applies')
  })

  it('quick cards carry the same label and line, and the table cells do not (they have a column header)', () => {
    const { container } = quick()
    expect(within(cardOf(container, 3)).getByRole('switch', { name: 'Enable Free shipping' })).toHaveTextContent('Enable')
    expect(cardOf(container, 3)).toHaveTextContent('Ended · no longer applies')
    cleanup()
    mocks.phone = false
    const table = draw().container
    expect(table).not.toHaveTextContent('no longer applies')
    expect(within(rowOf(table, 1)).getByRole('switch', { name: 'Enable Weekend 15%' }).querySelector('.odc-switch-text')).toBeNull()
  })
})

// redesign AC-D (G6): at 1440 the table goes on sideways and the pinned last column slid over the end of the Enable
// column, so its header read «Enab». Widening Enable cannot fix that (the overflow grows by what it gains); the Enable column is
// pinned too, right before the last one, so its header and switch are always whole and what scrolls goes under both.
describe('PromotionsTable pinned Enable column (G6)', () => {
  const css = readFileSync(resolve(__dirname, '../promotions-table.css'), 'utf8')
  const rules = (selector) => {
    const declarations = {}
    for (const [, selectors, body] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!selectors.split(',').map(item => item.trim().replace(/\s+/g, ' ')).includes(selector)) continue
      body.split(';').map(item => item.trim()).filter(Boolean).forEach(item => {
        const index = item.indexOf(':')
        declarations[item.slice(0, index).trim()] = item.slice(index + 1).trim()
      })
    }
    return declarations
  }

  // live check: a long coupon code («dessertsforeveryone») kept Applies at 179 px and Advanced offers 52 px too wide at 1440
  it('lets a long coupon code break, so the code never sets the width of Applies', () => {
    expect(rules('.odc-promo-code')['overflow-wrap']).toBe('anywhere')
    expect(rules('.odc-promo-code')['min-inline-size']).toBe('0')
  })

  it.each(['advanced', 'quick'])('%s: the Enable header and its cells carry the pinned class, and no other column does', (variant) => {
    const { container } = variant === 'quick' ? quick() : draw()
    const enable = screen.getAllByRole('columnheader').find(header => header.textContent === 'Enable')
    expect(enable).toHaveClass('odc-promo-col-enabled')
    const pinned = Array.from(container.querySelectorAll('.odc-promo-col-enabled'))
    expect(pinned).toHaveLength(1 + 4)
    for (const id of [1, 2, 3, 4]) {
      expect(cellsOf(rowOf(container, id)).filter(cell => cell.classList.contains('odc-promo-col-enabled'))).toHaveLength(1)
      expect(cellsOf(rowOf(container, id)).find(cell => cell.classList.contains('odc-promo-col-enabled')).querySelector('[role="switch"]')).not.toBeNull()
    }
  })

  it('a hidden Enable column leaves no pinned cell behind', async () => {
    const { container } = draw({ hiddenColumnIds: ['enabled'] })
    expect(container.querySelector('.odc-promo-col-enabled')).toBeNull()
  })

  it.each(['th', 'td'])('the pinned %s is sticky at the inline end, right before the last column, above what scrolls under it', (tag) => {
    const rule = rules(`.odc-promo-table .odc-table ${tag}.odc-promo-col-enabled`)
    expect(rule.position).toBe('sticky')
    expect(rule['inset-inline-end']).toBe('var(--odc-promo-pin-end)')
    expect(rule['z-index']).toContain('var(--od-x-layer-raised)')
  })

  it('the pinned body cell takes the colour of the row, as the last column does', () => {
    expect(rules('.odc-promo-table .odc-table tbody td.odc-promo-col-enabled').background).toBe('var(--od-bg)')
    expect(css).toMatch(/tr\[data-interactive\]:hover td:where\([^)]*\.odc-promo-col-enabled[^)]*\)\s*\{[^}]*var\(--od-x-hover\)/)
    expect(css).toMatch(/tr\[data-active\] td:where\([^)]*\.odc-promo-col-enabled[^)]*\)\s*\{[^}]*var\(--od-x-selected\)/)
  })

  it('the pin counts on the width of the last column, which the CSS fixes (Quick: two icon buttons; Advanced: the menu)', () => {
    const table = rules('.odc-promo-table')
    expect(table['--odc-promo-actions-width']).toContain('2 * var(--od-x-control-height)')
    expect(table['--odc-promo-menu-width']).toContain('var(--od-x-control-height)')
    expect(table['--odc-promo-pin-end']).toBe('var(--odc-promo-menu-width)')
    expect(rules(".odc-promo-table[data-variant='quick']")['--odc-promo-pin-end']).toBe('var(--odc-promo-actions-width)')
    for (const [column, width] of [['actions', 'actions'], ['menu', 'menu']]) {
      for (const tag of ['th', 'td']) {
        const rule = rules(`.odc-promo-table .odc-table ${tag}.odc-promo-col-${column}`)
        expect(rule['inline-size']).toBe(`var(--odc-promo-${width}-width)`)
        expect(rule['min-inline-size']).toBe(`var(--odc-promo-${width}-width)`)
      }
    }
  })

  // redesign AC-D2 (G6, review): the pinned Enable column hid the end of the dates at 1440 (the table was 1196px wide in a
  // 1144px container). The width a table asks for is the sum of what each column cannot give up: «Automatic discount» (Applies) was
  // kept on one line, 149px, and in Quick the nowrap description held the Promotion column at its 320px cap (356px). Applies may
  // now break between words (its min is its longest word), and Quick's Promotion column is capped at 3/4 of the old cap.
  it.each(['advanced', 'quick'])('%s: the Applies cells may wrap (the column gives up width before a date is covered), the Date range ones may not', (variant) => {
    const { container } = variant === 'quick' ? quick() : draw()
    const index = screen.getAllByRole('columnheader').findIndex(header => header.textContent === 'Applies')
    const dates = screen.getAllByRole('columnheader').findIndex(header => header.textContent === 'Date range')
    for (const id of [1, 2, 3, 4]) {
      expect(cellsOf(rowOf(container, id))[index]).toHaveAttribute('data-wrap')
      expect(cellsOf(rowOf(container, id))[dates]).not.toHaveAttribute('data-wrap')
    }
  })

  it('the dates never break: «01-05-2025 – 01-05-2031» stays on one line (PE-B1)', () => {
    expect(rules('.odc-promo-dates')['white-space']).toBe('nowrap')
  })

  it.each(['td', 'th'])('Quick: the name and its description in a %s ask for at most 3/4 of the shared cap, so the Promotion column gives room to the pinned ones', (tag) => {
    const rule = rules(`.odc-promo-table[data-variant='quick'] ${tag} .odc-promo-name-text`)
    expect(rule['max-inline-size']).toBe('calc(var(--od-x-col-max-promotion) * 0.75)')
  })

  it('the edge shadow of the sideways table moves to the pinned Enable column when there is one, and stays on the last column when not', () => {
    expect(css).toMatch(/\.odc-table-scroll\[data-overflow-end\]\s+:where\(th, td\)\.odc-promo-col-enabled::after\s*,/)
    expect(css).toMatch(/\.odc-table-scroll\[data-overflow-end\]:not\(:has\(\.odc-promo-col-enabled\)\)\s+:where\(th, td\):where\(\.odc-promo-col-actions, \.odc-promo-col-menu\)::after/)
  })
})

describe('PromotionsTable busy row (R8)', () => {
  it('quick table: the Delete of the row whose switch is saving is disabled, the others are not', () => {
    const { container } = quick({ busyId: 1 })
    expect(within(rowOf(container, 1)).getByRole('button', { name: 'Delete Weekend 15%' })).toBeDisabled()
    expect(within(rowOf(container, 2)).getByRole('button', { name: 'Delete Welcome code' })).not.toBeDisabled()
  })

  it('quick cards: same', () => {
    mocks.phone = true
    const { container } = quick({ busyId: 1 })
    expect(within(cardOf(container, 1)).getByRole('button', { name: 'Delete Weekend 15%' })).toBeDisabled()
    expect(within(cardOf(container, 2)).getByRole('button', { name: 'Delete Welcome code' })).not.toBeDisabled()
  })

  it('with no busy row every Delete is enabled', () => {
    const { container } = quick()
    expect(within(rowOf(container, 1)).getByRole('button', { name: 'Delete Weekend 15%' })).not.toBeDisabled()
  })
})

describe('PromotionsTable error keeps the search (R9)', () => {
  it('the host toolbar stays beside the error, so a failed search can be changed and not only retried', () => {
    draw({ error: ['Network failure'], promotions: [], toolbar: <input aria-label='Search promotions' /> })
    expect(within(screen.getByRole('alert')).getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Search promotions' })).toBeInTheDocument()
  })

  it('the toolbar is also there on a phone', () => {
    mocks.phone = true
    draw({ error: ['Network failure'], promotions: [], toolbar: <input aria-label='Search promotions' /> })
    expect(screen.getByRole('textbox', { name: 'Search promotions' })).toBeInTheDocument()
  })
})

// descriptions saved by an older version carry raw `YYYY-MM-DDTHH:mm` stamps; the list writes them as dates
describe('PromotionsTable legacy descriptions with ISO stamps', () => {
  const ISO = /\d{4}-\d{2}-\d{2}T/
  const legacy = {
    ...weekend,
    id: 7,
    name: 'Legacy offer',
    description: 'Customers receive 20% off, from 2026-09-01T16:57 to 2026-09-30T16:57.'
  }

  it('the Quick table subline shows the stamps as dates', () => {
    const { container } = quick({ promotions: [legacy] })
    const subline = rowOf(container, 7).querySelector('.odc-promo-name-sub')
    expect(subline.textContent).not.toMatch(ISO)
    expect(subline.textContent).toMatch(/^Customers receive 20% off, from .*2026.* to .*2026.*\.$/)
    expect(subline.getAttribute('title')).not.toMatch(ISO)
  })

  it('the Quick phone card shows the stamps as dates', () => {
    mocks.phone = true
    const { container } = quick({ promotions: [legacy] })
    const text = cardOf(container, 7).querySelector('.odc-promo-name-sub')
    expect(text.textContent).not.toMatch(ISO)
    expect(text.textContent).toContain('Customers receive 20% off, from ')
  })

  it('a description without stamps is drawn as it is', () => {
    const { container } = quick({ promotions: [weekend] })
    expect(rowOf(container, 1).querySelector('.odc-promo-name-sub').textContent).toBe('Fifteen percent every weekend')
  })
})
