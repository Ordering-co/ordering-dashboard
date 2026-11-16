/* eslint-disable import/first */
// redesign AB-B4 (M-AB01, M-AB15, M-AB20): the business picker of the image dialog. A search field (debounced 300 ms, the controller
// searches by name), a Product RadioGroup whose options carry the 20px logo, skeleton rows while loading, an empty line, a Product
// Pagination and the «Linked now» line when the stored business is not on the visible page. The Product wrappers are real; the
// language and the utils are simulated. Nothing is ever sent.
import React from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  useUtils: () => [{ optimizeImage: (url) => url }]
}))

import { BusinessRadioList } from '../BusinessRadioList'

const kcf = { id: 1, name: 'KCF', logo: 'https://cdn.example.test/kcf.png', slug: 'kcf' }
const bite = { id: 2, name: 'Fast Bite', logo: null, slug: 'fast-bite' }
const dono = { id: 3, name: "Dono's Pizza", logo: null, slug: 'donos' }

const listOf = (overrides = {}) => ({
  loading: false,
  businesses: [kcf, bite, dono],
  pagination: { current_page: 1, total_pages: 1, page_size: 10, total: 3 },
  ...overrides
})

let props
const draw = (overrides = {}) => {
  props = {
    businessList: listOf(),
    onSearch: vi.fn(),
    onPageChange: vi.fn(),
    value: null,
    onChange: vi.fn(),
    label: 'Business',
    ...overrides
  }
  return render(<BusinessRadioList {...props} />)
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  document.getElementById('app-modals')?.remove()
})

describe('BusinessRadioList · the list', () => {
  it('is a radiogroup named by `label` with one radio per business, the stored one checked', () => {
    draw({ value: 2 })
    const group = screen.getByRole('radiogroup', { name: 'Business' })
    const radios = within(group).getAllByRole('radio')
    expect(radios.map(radio => radio.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false'])
    expect(within(group).getByRole('radio', { name: 'Fast Bite' })).toBeInTheDocument()
    expect(within(group).getByRole('radio', { name: "Dono's Pizza" })).toBeInTheDocument()
  })

  it('draws the logo of each business as a decorative avatar (a name when there is no logo: initials)', () => {
    const { container } = draw()
    const avatars = container.querySelectorAll('.odc-avatar')
    expect(avatars).toHaveLength(3)
    avatars.forEach(avatar => expect(avatar).toHaveAttribute('aria-hidden', 'true'))
    expect(avatars[0].querySelector('img')).toHaveAttribute('src', 'https://cdn.example.test/kcf.png')
    expect(avatars[1]).toHaveTextContent('FB')
  })

  it('chooses with a click and tells the owner the id and the business', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    draw()
    await user.click(screen.getByRole('radio', { name: "Dono's Pizza" }))
    expect(props.onChange).toHaveBeenCalledTimes(1)
    expect(props.onChange).toHaveBeenCalledWith(3, dono)
  })

  it('draws skeleton rows (busy, no radios) while the list loads', () => {
    const { container } = draw({ businessList: listOf({ loading: true }) })
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(container.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(screen.getByText('Loading')).toBeInTheDocument()
  })

  it('says «No businesses found.» when the list is empty', () => {
    draw({ businessList: listOf({ businesses: [], pagination: { current_page: 1, total_pages: 1, page_size: 10, total: 0 } }) })
    expect(screen.getByText('No businesses found.')).toBeInTheDocument()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })

  it('says it when the businesses could not be loaded, translating the API message', () => {
    draw({ businessList: listOf({ businesses: [], error: ['INTERNAL_ERROR'] }) })
    expect(screen.getByRole('alert')).toHaveTextContent('INTERNAL_ERROR')
    expect(screen.queryByText('No businesses found.')).toBeNull()
  })

  it('falls back to a sentence when the error carries no text', () => {
    draw({ businessList: listOf({ businesses: [], error: [{}] }) })
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the businesses.")
  })
})

describe('BusinessRadioList · search (M-AB20: the text goes to the controller as typed)', () => {
  it('names the field «Search businesses» and never searches on mount', () => {
    draw()
    expect(screen.getByRole('searchbox', { name: 'Search businesses' })).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(1000) })
    expect(props.onSearch).not.toHaveBeenCalled()
  })

  it('debounces: one call, 300 ms after the last key, with the raw text (&, #, % included)', async () => {
    // a frozen clock and synchronous events (no real time passes while typing), so 299 ms is exactly 299 ms after the last key
    vi.useRealTimers()
    vi.useFakeTimers()
    draw()
    const field = screen.getByRole('searchbox', { name: 'Search businesses' })
    fireEvent.change(field, { target: { value: 'A' } })
    act(() => { vi.advanceTimersByTime(200) })
    fireEvent.change(field, { target: { value: 'A&B #1 50%' } })
    expect(props.onSearch).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(299) })
    expect(props.onSearch).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(props.onSearch).toHaveBeenCalledTimes(1)
    expect(props.onSearch).toHaveBeenCalledWith('A&B #1 50%')
  })

  it('clearing the field searches for nothing (the full list comes back)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    draw()
    await user.type(screen.getByRole('searchbox', { name: 'Search businesses' }), 'kc')
    act(() => { vi.advanceTimersByTime(300) })
    props.onSearch.mockClear()
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    act(() => { vi.advanceTimersByTime(300) })
    expect(props.onSearch).toHaveBeenCalledWith('')
  })

  it('starts from the search the controller already holds (the list was filtered before this one mounted)', () => {
    draw({ initialSearch: 'kc' })
    expect(screen.getByRole('searchbox', { name: 'Search businesses' })).toHaveValue('kc')
    act(() => { vi.advanceTimersByTime(1000) })
    expect(props.onSearch).not.toHaveBeenCalled()
  })
})

describe('BusinessRadioList · pages', () => {
  const paged = { current_page: 2, total_pages: 3, page_size: 10, total: 25 }

  it('shows the Product pagination only when there is more than one page', () => {
    draw()
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
    cleanup()
    draw({ businessList: listOf({ pagination: paged }) })
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument()
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 11–20 of 25')
  })

  it('goes to the next and the previous page through `onPageChange`', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    draw({ businessList: listOf({ pagination: paged }) })
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(props.onPageChange).toHaveBeenLastCalledWith(3)
    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(props.onPageChange).toHaveBeenLastCalledWith(1)
  })

  it('paginates with only `total_pages` when the API gave no total', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    draw({ businessList: listOf({ pagination: { current_page: 1, total_pages: 2, page_size: 10 } }) })
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(props.onPageChange).toHaveBeenLastCalledWith(2)
  })
})

describe('BusinessRadioList · «Linked now» (the choice is never invisible)', () => {
  it('says which business is linked when it is not on the visible page', () => {
    draw({ value: 77 })
    expect(screen.getByText('Linked now: business #77')).toBeInTheDocument()
    expect(screen.getAllByRole('radio').every(radio => radio.getAttribute('aria-checked') === 'false')).toBe(true)
  })

  // redesign AB-R1 (review r1 #6): with the stored link, the line names it by its path, not by an id the person cannot read
  it('names the linked business by the text the host gives', () => {
    draw({ value: 77, linkedText: 'Linked now: /store/burgerpalace' })
    expect(screen.getByText('Linked now: /store/burgerpalace')).toBeInTheDocument()
    expect(screen.queryByText('Linked now: business #77')).toBeNull()
  })

  it('stays quiet when the linked business is on the page, when nothing is linked, and while loading', () => {
    draw({ value: 2 })
    expect(screen.queryByText(/Linked now/)).toBeNull()
    cleanup()
    draw({ value: null })
    expect(screen.queryByText(/Linked now/)).toBeNull()
    cleanup()
    draw({ value: 77, businessList: listOf({ loading: true }) })
    expect(screen.queryByText(/Linked now/)).toBeNull()
  })

  it('matches an id stored as text with the id the list carries as a number', () => {
    draw({ value: '3' })
    expect(screen.queryByText(/Linked now/)).toBeNull()
    expect(screen.getByRole('radio', { name: "Dono's Pizza" })).toHaveAttribute('aria-checked', 'true')
  })
})
