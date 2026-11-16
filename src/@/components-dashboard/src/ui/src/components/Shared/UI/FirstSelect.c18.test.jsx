/* eslint-disable import/first */
// redesign F2 (C18): one anatomy for every dropdown inside the orders surfaces. The surface opts in through
// SelectSurfaceContext ({ fitTrigger: true }); a picker outside it keeps the list it always had.
import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { FirstSelect } from './FirstSelect'
import { SelectSurfaceContext } from './selectPlacement'

const text = value => <span>{value}</span>

const drivers = [
  { value: 'default', content: text('Select driver'), color: 'primary', disabled: true, showDisable: true },
  { value: 'remove', content: text('Remove assigned driver'), danger: true },
  { value: 'available', content: text('Available'), group: true, disabled: true },
  { value: 1, content: text('Ana') },
  { value: 2, content: text('Beto') },
  { value: 3, content: text('Berta') },
  { value: 'busy', content: text('Busy'), group: true, disabled: true },
  { value: 4, content: text('Carla') }
]

const many = Array.from({ length: 9 }, (_, index) => ({ value: index, content: text(`Option ${index}`) }))

const renderSelect = (props = {}, surface = { fitTrigger: true }) => render(
  <ThemeProvider theme={createDashboardTheme(theme)}>
    <SelectSurfaceContext.Provider value={surface}>
      <FirstSelect placeholder='Pick one' options={drivers} defaultValue='default' onChange={vi.fn()} {...props} />
    </SelectSurfaceContext.Provider>
  </ThemeProvider>
)

const trigger = () => document.querySelector('.od-first-select-trigger')
const open = () => fireEvent.click(trigger())
const options = () => within(screen.getByRole('listbox')).getAllByRole('option')
const label = element => element.textContent.trim()

describe('FirstSelect, C18 anatomy inside the orders surfaces', () => {
  it('draws the closed field as a brand field (the root says so)', () => {
    renderSelect()
    expect(document.querySelector('.od-first-select-root')).toHaveAttribute('data-fit', 'trigger')
  })

  it('shows group labels as headings, never as options', () => {
    renderSelect()
    open()
    expect(screen.queryByRole('option', { name: 'Available' })).toBeNull()
    const heading = screen.getByText('Available').closest('.od-first-select-group')
    expect(heading).toHaveClass('od-first-select-group')
    expect(heading).not.toHaveAttribute('tabindex')
    expect(options().map(label)).toEqual(['Remove assigned driver', 'Ana', 'Beto', 'Berta', 'Carla'])
  })

  // redesign F6c (P3-02): «Remove assigned driver» is back at the top of the list, as in `main`, set apart from
  // the options by a divider and drawn as the danger action.
  it('puts a dangerous action first, before a separator, and marks it', () => {
    renderSelect()
    open()
    const list = screen.getByRole('listbox')
    const remove = options()[0]
    expect(label(remove)).toBe('Remove assigned driver')
    expect(remove).toHaveAttribute('data-danger')
    // redesign F6h: the line is presentational (a separator is not an allowed child of a listbox)
    const separator = list.querySelector('.od-first-select-separator')
    expect(separator.compareDocumentPosition(remove) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    expect(separator.compareDocumentPosition(options()[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('draws no separator when the dangerous action is the only row', () => {
    renderSelect({ options: drivers.filter(option => option.danger) })
    open()
    // redesign F6h: the line is presentational (a separator is not an allowed child of a listbox)
    expect(screen.getByRole('listbox').querySelector('.od-first-select-separator')).toBeNull()
  })

  it('marks the selected row with a check mark and aria-selected, not only with a fill', () => {
    renderSelect({ defaultValue: 2 })
    open()
    const selected = options().find(option => option.getAttribute('aria-selected') === 'true')
    expect(label(selected)).toBe('Beto')
    expect(selected.querySelector('.od-first-select-check svg')).not.toBeNull()
    const other = options().find(option => option.textContent.trim() === 'Ana')
    expect(other.querySelector('.od-first-select-check svg')).toBeNull()
  })

  // redesign F6c (Q2-18): the check mark is at the START of the row in every dropdown (the Product Menu radio items
  // and the multi-select checkbox already are), in a slot every row keeps so the labels stay aligned.
  it('draws the check mark slot before the label, on every row', () => {
    renderSelect({ defaultValue: 2 })
    open()
    for (const option of options()) {
      expect(option.firstElementChild).toHaveClass('od-first-select-check')
    }
    const selected = options().find(option => option.getAttribute('aria-selected') === 'true')
    expect(selected.firstElementChild.querySelector('svg')).not.toBeNull()
  })

  // redesign F6c (P3-03): `main` always had the search field where the consumer asks for it; the threshold is gone.
  it('shows the search field whenever the consumer asks for it, whatever the number of options', () => {
    const { unmount } = renderSelect({ options: many.slice(0, 3), isShowSearchBar: true, handleChangeSearch: vi.fn(), searchValue: '' })
    open()
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument()
    unmount()
    renderSelect({ options: many, isShowSearchBar: true, handleChangeSearch: vi.fn(), searchValue: '' })
    open()
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument()
  })

  it('shows no search field when the consumer did not ask for one', () => {
    renderSelect({ options: many })
    open()
    expect(screen.queryByRole('searchbox')).toBeNull()
  })

  it('keeps the search field while a search narrows the list below 9', () => {
    renderSelect({ options: many.slice(0, 2), isShowSearchBar: true, handleChangeSearch: vi.fn(), searchValue: 'opt' })
    open()
    expect(screen.getByRole('searchbox')).toHaveValue('opt')
  })

  // SC-1 (from ): C18 dropped the pager of the legacy list (`!fit`) because the orders lists scroll, but a remote
  // list with search is paged by its consumer: without the pager page 2 cannot be reached. The pager is back when the consumer gives
  // `pagination` (more than one page) and `handleChangePage`; a local list with neither keeps scrolling with no pager.
  it('paints the pager when the consumer pages the list, and reaches page 2', () => {
    const handleChangePage = vi.fn()
    renderSelect({ options: many, isShowSearchBar: true, handleChangeSearch: vi.fn(), searchValue: '', pagination: { currentPage: 1, pageSize: 5, totalPages: 3 }, handleChangePage })
    open()
    const pager = screen.getByRole('listbox').parentElement.querySelector('.od-first-select-pagination')
    expect(pager).not.toBeNull()
    fireEvent.click(within(pager).getByRole('button', { name: 'Next page' }))
    expect(handleChangePage).toHaveBeenCalledWith(2)
    // the list stays open while the page changes (the click is the pager's, not an outside click)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(options()).toHaveLength(9)
  })

  it.each([
    ['no pagination', { }],
    ['a single page', { pagination: { currentPage: 1, pageSize: 5, totalPages: 1 }, handleChangePage: vi.fn() }],
    ['pagination without handleChangePage', { pagination: { currentPage: 1, pageSize: 5, totalPages: 3 } }]
  ])('has no pager with %s (a local list scrolls)', (_, extra) => {
    renderSelect({ options: many, ...extra })
    open()
    expect(document.querySelector('.od-first-select-pagination')).toBeNull()
    expect(options()).toHaveLength(9)
  })

  describe('keyboard', () => {
    it('ArrowDown on the closed field opens the list on the selected row', () => {
      renderSelect({ defaultValue: 2 })
      trigger().focus()
      fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
      expect(screen.getByRole('listbox')).toBeInTheDocument()
      expect(document.activeElement).toBe(options().find(option => label(option) === 'Beto'))
    })

    // redesign F6c: the dangerous action is the first row now, so «the first row» is the first one after it
    it('ArrowDown opens on the first enabled row when nothing is selected', () => {
      renderSelect()
      trigger().focus()
      fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
      expect(document.activeElement).toBe(options()[1])
      expect(label(document.activeElement)).toBe('Ana')
    })

    it('arrows move between rows, skipping the group headings; Home and End jump to the ends', () => {
      renderSelect({ defaultValue: 3 })
      trigger().focus()
      fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
      expect(label(document.activeElement)).toBe('Berta')
      fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' })
      expect(label(document.activeElement)).toBe('Carla')
      fireEvent.keyDown(document.activeElement, { key: 'ArrowUp' })
      fireEvent.keyDown(document.activeElement, { key: 'ArrowUp' })
      expect(label(document.activeElement)).toBe('Beto')
      fireEvent.keyDown(document.activeElement, { key: 'Home' })
      expect(label(document.activeElement)).toBe('Remove assigned driver')
      fireEvent.keyDown(document.activeElement, { key: 'End' })
      expect(label(document.activeElement)).toBe('Carla')
    })

    it('ArrowDown never opens on the dangerous action while another row can take the focus', () => {
      renderSelect()
      trigger().focus()
      fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
      expect(label(document.activeElement)).toBe('Ana')
      expect(document.activeElement).not.toHaveAttribute('data-danger')
    })

    it('typing jumps to the next row that starts with those letters', () => {
      vi.useFakeTimers()
      try {
        renderSelect()
        trigger().focus()
        fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
        fireEvent.keyDown(document.activeElement, { key: 'b' })
        expect(label(document.activeElement)).toBe('Beto')
        // the same letter again goes on to the next match
        fireEvent.keyDown(document.activeElement, { key: 'b' })
        expect(label(document.activeElement)).toBe('Berta')
        // several letters typed together refine the match; after a pause the buffer starts again
        fireEvent.keyDown(document.activeElement, { key: 'e' })
        expect(label(document.activeElement)).toBe('Berta')
        act(() => { vi.advanceTimersByTime(800) })
        fireEvent.keyDown(document.activeElement, { key: 'c' })
        expect(label(document.activeElement)).toBe('Carla')
      } finally {
        vi.useRealTimers()
      }
    })

    it('Enter picks the focused row, closes the list and gives the focus back to the field', () => {
      const onChange = vi.fn()
      renderSelect({ onChange })
      trigger().focus()
      fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
      fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' })
      fireEvent.keyDown(document.activeElement, { key: 'Enter' })
      expect(onChange).toHaveBeenCalledWith(2)
      expect(screen.queryByRole('listbox')).toBeNull()
      expect(document.activeElement).toBe(trigger())
    })

    it('Escape closes only the list: nothing above it hears the key, and the field has the focus', () => {
      const outer = vi.fn()
      const { container } = render(
        <ThemeProvider theme={createDashboardTheme(theme)}>
          <SelectSurfaceContext.Provider value={{ fitTrigger: true }}>
            <div onKeyDown={outer}>
              <FirstSelect placeholder='Pick one' options={drivers} defaultValue='default' onChange={vi.fn()} />
            </div>
          </SelectSurfaceContext.Provider>
        </ThemeProvider>
      )
      const field = container.querySelector('.od-first-select-trigger')
      field.focus()
      fireEvent.keyDown(field, { key: 'ArrowDown' })
      fireEvent.keyDown(document.activeElement, { key: 'Escape' })
      expect(screen.queryByRole('listbox')).toBeNull()
      expect(document.activeElement).toBe(field)
      expect(outer).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' }))
    })

    it('ArrowDown in the search field moves to the first row; ArrowUp on the first row goes back to it', () => {
      renderSelect({ options: many, isShowSearchBar: true, handleChangeSearch: vi.fn(), searchValue: '' })
      open()
      const search = screen.getByRole('searchbox')
      search.focus()
      fireEvent.keyDown(search, { key: 'ArrowDown' })
      expect(label(document.activeElement)).toBe('Option 0')
      fireEvent.keyDown(document.activeElement, { key: 'ArrowUp' })
      expect(document.activeElement).toBe(search)
    })
  })

  describe('outside the orders surfaces', () => {
    it('keeps every option, group and danger row as before: no attribute, no check, no separator', () => {
      renderSelect({ defaultValue: 2 }, {})
      expect(document.querySelector('.od-first-select-root')).not.toHaveAttribute('data-fit')
      open()
      const list = screen.getByRole('listbox')
      expect(within(list).queryByRole('separator')).toBeNull()
      expect(list.querySelector('.od-first-select-check')).toBeNull()
      expect(within(list).getAllByRole('option').map(label)).toEqual([
        'Select driver', 'Remove assigned driver', 'Available', 'Ana', 'Beto', 'Berta', 'Busy', 'Carla'
      ])
    })

    it('does not move focus with arrows', () => {
      renderSelect({}, {})
      trigger().focus()
      fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
      expect(screen.queryByRole('listbox')).toBeNull()
    })
  })
})

// redesign stores 5.18 (m7 of 5.13): OPT-IN `ariaDescribedBy` reaches the trigger, so a hint («Can't be changed after
// creating») describes the control itself, disabled or not. A wrapper's aria-describedby describes nothing.
describe('FirstSelect · ariaDescribedBy (stores 5.18)', () => {
  it('describes the trigger with the given node, also when it is disabled', () => {
    renderSelect({ isDisabled: true, ariaDescribedBy: 'lock-hint' })
    const hint = document.createElement('p')
    hint.id = 'lock-hint'
    hint.textContent = "Can't be changed after creating."
    document.body.append(hint)
    expect(trigger()).toHaveAccessibleDescription("Can't be changed after creating.")
    hint.remove()
  })

  it('without it the trigger has no description, as before', () => {
    renderSelect()
    expect(trigger()).not.toHaveAttribute('aria-describedby')
  })
})
