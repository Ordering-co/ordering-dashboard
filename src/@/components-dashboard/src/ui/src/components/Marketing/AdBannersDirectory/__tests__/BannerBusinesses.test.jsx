/* eslint-disable import/first */
// redesign AB-B3 (decision 2; defects M-AB12, M-AB15, M-AB16): the businesses of a «Business page» banner, in create and edit mode.
// The controller is not mounted: its state and handlers come in as props (spies). SearchField, Checkbox, Pagination, Avatar and
// InlineNotice are the real Product wrappers. Nothing is ever sent.
import React from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text]
}))

import { BannerBusinesses } from '../BannerBusinesses'

const businesses = [
  { id: 1, name: 'KCF', logo: 'https://img.test/kcf.png' },
  { id: 2, name: 'Fast Bite', logo: null },
  { id: 3, name: "Dono's Pizza", logo: null }
]
const pagination = (overrides = {}) => ({ current_page: 1, total_pages: 1, page_size: 10, total: 3, ...overrides })

let props

const setup = (overrides = {}) => {
  props = {
    mode: 'edit',
    businessList: { loading: false, businesses, pagination: pagination() },
    selectedBusinessIds: [1],
    handleSelectBusiness: vi.fn(),
    handleSelectAllBusiness: vi.fn(),
    handleSelectEveryBusiness: vi.fn().mockResolvedValue({ ok: true, error: null, count: 3 }),
    handleChangeBusinessPage: vi.fn(),
    searchBusinesses: vi.fn(),
    actionState: { loading: false, error: null },
    onSave: vi.fn().mockResolvedValue({ ok: true, error: null }),
    ...overrides
  }
  return render(<BannerBusinesses {...props} />)
}

beforeEach(() => {})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('BannerBusinesses list', () => {
  it('draws a checkbox row per business, checked from the selected ids, with the logo and the name', () => {
    setup({ selectedBusinessIds: [1, 3] })
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes.map(box => box.getAttribute('aria-checked'))).toEqual(['true', 'false', 'true'])
    expect(screen.getByRole('checkbox', { name: 'KCF' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: "Dono's Pizza" })).toBeInTheDocument()
    expect(document.querySelectorAll('.odc-avatar[data-kind="business"]')).toHaveLength(3)
    expect(document.querySelector('.odc-avatar img')).toHaveAttribute('src', 'https://img.test/kcf.png')
  })

  it('the whole row toggles: the name is part of the checkbox (M-AB15)', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('Fast Bite'))
    expect(props.handleSelectBusiness).toHaveBeenCalledTimes(1)
    expect(props.handleSelectBusiness).toHaveBeenCalledWith(2, true)
    await user.click(screen.getByText('KCF'))
    expect(props.handleSelectBusiness).toHaveBeenLastCalledWith(1, false)
  })

  it('the list is named', () => {
    setup()
    expect(screen.getByRole('list', { name: 'Businesses' })).toBeInTheDocument()
  })

  it('shows skeleton rows, not a half list, while it loads', () => {
    setup({ businessList: { loading: true, businesses: [], pagination: undefined } })
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    const busy = document.querySelector('[aria-busy="true"]')
    expect(busy).not.toBeNull()
    expect(busy.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(within(busy).getByText('Loading')).toBeInTheDocument()
  })

  it('says «No businesses found.» when there are none', () => {
    setup({ businessList: { loading: false, businesses: [], pagination: pagination({ total: 0 }) }, selectedBusinessIds: [] })
    expect(screen.getByText('No businesses found.')).toBeInTheDocument()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('a controller that has no list yet is an empty one, not a crash', () => {
    setup({ businessList: undefined, selectedBusinessIds: undefined })
    expect(screen.getByText('No businesses found.')).toBeInTheDocument()
  })

  it('rows are disabled while an action runs', () => {
    setup({ actionState: { loading: true, error: null } })
    for (const box of screen.getAllByRole('checkbox')) expect(box).toBeDisabled()
  })
})

describe('BannerBusinesses select all / none act on this page and say so (M-AB12)', () => {
  it('«Select all on this page» and «Select none on this page» call the controller with true and false', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Select all on this page' }))
    expect(props.handleSelectAllBusiness).toHaveBeenLastCalledWith(true, { pageOnly: true })
    await user.click(screen.getByRole('button', { name: 'Select none on this page' }))
    expect(props.handleSelectAllBusiness).toHaveBeenLastCalledWith(false, { pageOnly: true })
    expect(props.handleSelectAllBusiness).toHaveBeenCalledTimes(2)
  })

  // redesign (review F-2): the page buttons touch the page only, so a selection that spans pages is cleared beside the count
  it('«Clear selection» beside the count clears every page, and is there only with something selected', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(props.handleSelectAllBusiness).toHaveBeenLastCalledWith(false)
    cleanup()
    setup({ selectedBusinessIds: [] })
    expect(screen.queryByRole('button', { name: 'Clear selection' })).toBeNull()
  })

  it('there is no bare «Select all»', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Select all' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Select none' })).toBeNull()
  })
})

// redesign (row 41, P-3): «Select all businesses» takes every enabled business of the search, on every page; the two
// per-page buttons stay. The controller does the read; this draws the button, its busy state and its failure.
describe('BannerBusinesses «Select all businesses» (row 41)', () => {
  const selectAll = () => screen.getByRole('button', { name: 'Select all businesses' })

  it('is there beside the two per-page buttons, in edit and in create mode', () => {
    setup()
    expect(selectAll()).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Select all on this page' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select none on this page' })).toBeInTheDocument()
    cleanup()
    setup({ mode: 'create', onSave: undefined, selectedBusinessIds: [] })
    expect(selectAll()).toBeEnabled()
  })

  it('is not drawn when the controller does not give the action', () => {
    setup({ handleSelectEveryBusiness: undefined })
    expect(screen.queryByRole('button', { name: 'Select all businesses' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Select all on this page' })).toBeInTheDocument()
  })

  it('asks the controller once and keeps quiet when it works', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(selectAll())
    expect(props.handleSelectEveryBusiness).toHaveBeenCalledTimes(1)
    expect(props.handleSelectAllBusiness).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(selectAll()).not.toHaveAttribute('aria-busy', 'true')
  })

  it('is busy while it loads: a second press does nothing, and nothing else can change the selection or be saved meanwhile', async () => {
    const user = userEvent.setup()
    let done
    const handleSelectEveryBusiness = vi.fn(() => new Promise(resolve => { done = resolve }))
    setup({ handleSelectEveryBusiness })
    await user.click(selectAll())
    expect(selectAll()).toHaveAttribute('aria-busy', 'true')
    await user.click(selectAll())
    expect(handleSelectEveryBusiness).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Select all on this page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Select none on this page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save businesses' })).toBeDisabled()
    for (const box of screen.getAllByRole('checkbox')) expect(box).toBeDisabled()
    await act(async () => { done({ ok: true, error: null, count: 3 }) })
    expect(selectAll()).not.toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Select all on this page' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Save businesses' })).toBeEnabled()
    for (const box of screen.getAllByRole('checkbox')) expect(box).toBeEnabled()
  })

  it('says why it failed, inline, and no «Saved»', async () => {
    const user = userEvent.setup()
    setup({ handleSelectEveryBusiness: vi.fn().mockResolvedValue({ ok: false, error: ['Not allowed'] }) })
    await user.click(selectAll())
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed')
    expect(screen.queryByText('Saved')).toBeNull()
  })

  it('a failure with no text, or a rejected call, still says something', async () => {
    const user = userEvent.setup()
    setup({ handleSelectEveryBusiness: vi.fn().mockResolvedValue({ ok: false, error: null }) })
    await user.click(selectAll())
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't select all the businesses. Try again.")
    cleanup()
    setup({ handleSelectEveryBusiness: vi.fn().mockRejectedValue(new Error('Network down')) })
    await user.click(selectAll())
    expect(await screen.findByRole('alert')).toHaveTextContent('Network down')
  })

  it('the failure goes away when it is tried again and works', async () => {
    const user = userEvent.setup()
    const handleSelectEveryBusiness = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: ['Not allowed'] })
      .mockResolvedValueOnce({ ok: true, error: null, count: 3 })
    setup({ handleSelectEveryBusiness })
    await user.click(selectAll())
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await user.click(selectAll())
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('says so when there is nothing to select, and nothing when the answer was for an old search', async () => {
    const user = userEvent.setup()
    const handleSelectEveryBusiness = vi.fn()
      .mockResolvedValueOnce({ ok: true, error: null, count: 0 })
      .mockResolvedValueOnce({ ok: true, error: null, stale: true })
    setup({ handleSelectEveryBusiness })
    await user.click(selectAll())
    expect(await screen.findByText('No businesses to select.')).toBeInTheDocument()
    await user.click(selectAll())
    expect(screen.queryByText('No businesses to select.')).toBeNull()
  })

  it('the count and the checkboxes of the page follow the selection the controller made', () => {
    const view = setup({ selectedBusinessIds: [1] })
    expect(document.querySelector('.odc-banners-selected')).toHaveTextContent('1 selected')
    view.rerender(<BannerBusinesses {...props} selectedBusinessIds={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]} />)
    expect(document.querySelector('.odc-banners-selected')).toHaveTextContent('12 selected')
    expect(screen.getAllByRole('checkbox').map(box => box.getAttribute('aria-checked'))).toEqual(['true', 'true', 'true'])
  })

  it('a banner still cannot be saved with no business: the button is disabled and says why (b)', async () => {
    const user = userEvent.setup()
    setup({ selectedBusinessIds: [], handleSelectEveryBusiness: vi.fn().mockResolvedValue({ ok: true, error: null, count: 0 }) })
    await user.click(selectAll())
    expect(screen.getByRole('button', { name: 'Save businesses' })).toBeDisabled()
    expect(screen.getByText('Choose at least one business.')).toBeInTheDocument()
  })

  it('a controller answer after the list went away changes nothing and warns of nothing', async () => {
    const user = userEvent.setup()
    let done
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = setup({ handleSelectEveryBusiness: vi.fn(() => new Promise(resolve => { done = resolve })) })
    await user.click(selectAll())
    unmount()
    await act(async () => { done({ ok: false, error: ['late'] }) })
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })
})

describe('BannerBusinesses search (debounced 300 ms, as SearchBar lazyLoad)', () => {
  beforeEach(() => { vi.useFakeTimers() })

  it('asks the controller for the text once, 300 ms after the last keystroke, and never on mount', async () => {
    setup()
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(props.searchBusinesses).not.toHaveBeenCalled()
    const box = screen.getByRole('searchbox', { name: 'Search businesses' })
    fireEvent.change(box, { target: { value: 'k' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(200) })
    fireEvent.change(box, { target: { value: 'kc' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(299) })
    expect(props.searchBusinesses).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(props.searchBusinesses).toHaveBeenCalledTimes(1)
    expect(props.searchBusinesses).toHaveBeenCalledWith('kc')
  })

  it('clearing the search asks for the whole list again', async () => {
    setup()
    const box = screen.getByRole('searchbox', { name: 'Search businesses' })
    fireEvent.change(box, { target: { value: 'kc' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    expect(props.searchBusinesses).toHaveBeenLastCalledWith('')
  })

  it('a search pending when the list goes away is not sent', async () => {
    const { unmount } = setup()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search businesses' }), { target: { value: 'kc' } })
    unmount()
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(props.searchBusinesses).not.toHaveBeenCalled()
  })
})

describe('BannerBusinesses pagination', () => {
  it('has none when everything fits one page', () => {
    setup()
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })

  it('shows the range and moves to the next page', async () => {
    const user = userEvent.setup()
    setup({ businessList: { loading: false, businesses, pagination: pagination({ total_pages: 3, total: 25, current_page: 1 }) } })
    const nav = screen.getByRole('navigation', { name: 'Pagination' })
    expect(nav).toHaveTextContent('Showing 1–10 of 25')
    await user.click(within(nav).getByRole('button', { name: 'Next page' }))
    expect(props.handleChangeBusinessPage).toHaveBeenCalledWith(2)
  })

  it('goes back from the second page', async () => {
    const user = userEvent.setup()
    setup({ businessList: { loading: false, businesses, pagination: pagination({ total_pages: 3, total: 25, current_page: 2 }) } })
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Showing 11–20 of 25')
    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(props.handleChangeBusinessPage).toHaveBeenCalledWith(1)
  })
})

describe('BannerBusinesses count', () => {
  it('says how many are selected, with the figure in its own node', () => {
    setup({ selectedBusinessIds: [1, 2] })
    const line = screen.getByText((_, node) => node.tagName === 'P' && /selected/.test(node.textContent) && node.querySelector('.odc-figure') !== null)
    expect(line).toHaveTextContent('2 selected')
    expect(line.querySelector('.odc-figure')).toHaveTextContent('2')
  })

  it('and 1 selected in the singular key', () => {
    setup({ selectedBusinessIds: [3] })
    expect(document.querySelector('.odc-banners-selected')).toHaveTextContent('1 selected')
  })

  it('0 selected', () => {
    setup({ selectedBusinessIds: [] })
    expect(document.querySelector('.odc-banners-selected')).toHaveTextContent('0 selected')
  })
})

describe('BannerBusinesses create mode', () => {
  it('has the title, the list and no save button', () => {
    setup({ mode: 'create', onSave: undefined, selectedBusinessIds: [] })
    expect(screen.getByRole('heading', { name: 'Businesses' })).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: 'Save businesses' })).toBeNull()
    expect(screen.queryByText('Choose at least one business.')).toBeNull()
  })

  it('selecting works the same', async () => {
    const user = userEvent.setup()
    setup({ mode: 'create', onSave: undefined, selectedBusinessIds: [] })
    await user.click(screen.getByRole('checkbox', { name: 'KCF' }))
    expect(props.handleSelectBusiness).toHaveBeenCalledWith(1, true)
  })
})

describe('BannerBusinesses edit mode save', () => {
  it('with nothing selected the button is disabled and the reason is linked to it (as main disabled it)', () => {
    setup({ selectedBusinessIds: [] })
    const save = screen.getByRole('button', { name: 'Save businesses' })
    expect(save).toBeDisabled()
    const reason = screen.getByText('Choose at least one business.')
    expect(save.getAttribute('aria-describedby')).toBe(reason.id)
    expect(reason.id).not.toBe('')
  })

  it('with a selection it is enabled and has no reason', () => {
    setup({ selectedBusinessIds: [1] })
    expect(screen.getByRole('button', { name: 'Save businesses' })).toBeEnabled()
    expect(screen.queryByText('Choose at least one business.')).toBeNull()
  })

  it('saves through onSave and says «Saved»', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Save businesses' }))
    expect(props.onSave).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('is busy while it saves and a second press does nothing', async () => {
    const user = userEvent.setup()
    let done
    const onSave = vi.fn(() => new Promise(resolve => { done = resolve }))
    setup({ onSave })
    const save = screen.getByRole('button', { name: 'Save businesses' })
    await user.click(save)
    expect(save).toHaveAttribute('aria-busy', 'true')
    await user.click(save)
    expect(onSave).toHaveBeenCalledTimes(1)
    await act(async () => { done({ ok: true }) })
    expect(save).not.toHaveAttribute('aria-busy', 'true')
  })

  it('shows the translated error inline when it fails, and no «Saved»', async () => {
    const user = userEvent.setup()
    setup({ onSave: vi.fn().mockResolvedValue({ ok: false, error: ['The banner is locked'] }) })
    await user.click(screen.getByRole('button', { name: 'Save businesses' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The banner is locked')
    expect(screen.queryByText('Saved')).toBeNull()
  })

  it('a failure with no text, or a rejected call, still says something', async () => {
    const user = userEvent.setup()
    setup({ onSave: vi.fn().mockResolvedValue({ ok: false, error: null }) })
    await user.click(screen.getByRole('button', { name: 'Save businesses' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't save the businesses. Try again.")
    cleanup()
    setup({ onSave: vi.fn().mockRejectedValue(new Error('Network down')) })
    await user.click(screen.getByRole('button', { name: 'Save businesses' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Network down')
  })

  it('«Saved» goes away when the selection changes afterwards', async () => {
    const user = userEvent.setup()
    const view = setup({ selectedBusinessIds: [1] })
    await user.click(screen.getByRole('button', { name: 'Save businesses' }))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    view.rerender(<BannerBusinesses {...props} selectedBusinessIds={[1, 2]} />)
    expect(screen.queryByText('Saved')).toBeNull()
  })

  it('«Saved» stays when the host hands the same ids back in a new array', async () => {
    const user = userEvent.setup()
    const view = setup({ selectedBusinessIds: [2, 1] })
    await user.click(screen.getByRole('button', { name: 'Save businesses' }))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    view.rerender(<BannerBusinesses {...props} selectedBusinessIds={[1, 2]} />)
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('an edit-mode list with no onSave does not crash on press', async () => {
    const user = userEvent.setup()
    setup({ onSave: undefined })
    await user.click(screen.getByRole('button', { name: 'Save businesses' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
