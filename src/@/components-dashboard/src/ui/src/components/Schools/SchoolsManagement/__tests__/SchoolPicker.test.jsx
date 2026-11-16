/* eslint-disable import/first */
// redesign SC-B5 (decision 1A; auditor 9): the school picker, on its own row under the header. Real U/FirstSelect in its C18 anatomy and
// P/Field; only the contexts of the app are replaced.
// (X-SC1, X-SC2, X-SC3): a C18 list pages when the consumer pages it (the schools are 10 at a time, as main), P/Field names its
// trigger, and its search box keeps its own name. The search box of a C18 list tells on every key, so the picker waits for a pause, as main did.
import React from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const mockState = vi.hoisted(() => ({ catalog: {} }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (key, text) => mockState.catalog[key] ?? text]
}))

import { SchoolPicker } from '../SchoolPicker'

const SCHOOLS = [{ id: 1, name: 'Sunrise School' }, { id: 2, name: 'Moonlight Academy' }]

const renderPicker = (props = {}) => {
  const spies = { onSelect: vi.fn(), onSearch: vi.fn(), onChangePage: vi.fn() }
  const view = render(
    <ThemeProvider theme={createDashboardTheme(theme)}>
      <SchoolPicker
        schools={SCHOOLS}
        selectedSchool={null}
        loading={false}
        searchValue=''
        page={1}
        totalPages={1}
        pageSize={10}
        {...spies}
        {...props}
      />
    </ThemeProvider>
  )
  return { ...spies, ...view }
}

const trigger = () => document.querySelector('.od-first-select-trigger')
const open = async (user) => {
  await user.click(trigger())
  return screen.findByRole('listbox')
}
// the search of a C18 list is a P/SearchField: its input is a searchbox named «Search» (not the label of the field around it)
const searchInput = () => screen.getByRole('searchbox', { name: 'Search' })

beforeEach(() => { mockState.catalog = {} })
afterEach(cleanup)

describe('the field', () => {
  it('has the visible label «School» and the placeholder «Select a school»', () => {
    renderPicker()
    expect(screen.getByText('School')).toBeInTheDocument()
    expect(trigger()).toHaveTextContent('Select a school')
  })

  it('shows the chosen school in the trigger, and the trigger is named by the label and the school (X-SC2)', () => {
    renderPicker({ selectedSchool: SCHOOLS[1] })
    expect(trigger()).toHaveTextContent('Moonlight Academy')
    expect(screen.getByRole('button', { name: 'School Moonlight Academy' })).toBe(trigger())
  })

  it('takes its words from the catalog', () => {
    mockState.catalog = { SCHOOL: 'Colegio', SCHOOL_SELECT_SCHOOL: 'Elige un colegio' }
    renderPicker()
    expect(screen.getByText('Colegio')).toBeInTheDocument()
    expect(trigger()).toHaveTextContent('Elige un colegio')
  })

  it('is the C18 anatomy of the other selects of the page (X-SC1): the list starts at the trigger, inside the field, no portal', async () => {
    const user = userEvent.setup()
    renderPicker()
    await open(user)
    const list = document.querySelector('.od-first-select-list')
    expect(document.querySelector('.od-first-select-root')).toHaveAttribute('data-fit', 'trigger')
    expect(list).toHaveAttribute('data-fit', 'trigger')
    expect(document.querySelector('.od-first-select-root').contains(list)).toBe(true)
    expect(document.querySelector('.odc-field').contains(list)).toBe(true)
    expect(document.getElementById('app-modals')).toBeNull()
  })
})

describe('the list', () => {
  it('lists the schools of the page', async () => {
    const user = userEvent.setup()
    renderPicker()
    const list = await open(user)
    expect(within(list).getAllByRole('option').map((option) => option.textContent.trim())).toEqual(['Sunrise School', 'Moonlight Academy'])
  })

  it('picking a school calls onSelect with its id', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderPicker()
    await user.click(within(await open(user)).getByRole('option', { name: 'Moonlight Academy' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it('the chosen school is listed first even when it is not on this page', async () => {
    const user = userEvent.setup()
    renderPicker({ selectedSchool: { id: 99, name: 'Far Away School' } })
    const options = within(await open(user)).getAllByRole('option').map((option) => option.textContent.trim())
    expect(options).toEqual(['Far Away School', 'Sunrise School', 'Moonlight Academy'])
  })

  it('does not list the chosen school twice when it is on the page', async () => {
    const user = userEvent.setup()
    renderPicker({ selectedSchool: SCHOOLS[0] })
    const options = within(await open(user)).getAllByRole('option').map((option) => option.textContent.trim())
    expect(options).toEqual(['Sunrise School', 'Moonlight Academy'])
  })

  it('shows skeleton rows while the schools load', async () => {
    const user = userEvent.setup()
    renderPicker({ loading: true })
    const list = await open(user)
    expect(list.querySelectorAll('.react-loading-skeleton').length).toBeGreaterThan(0)
  })
})

describe('the search (the list has a search box, as in main)', () => {
  it('typing shows the text at once and reaches onSearch once, when the person pauses (as main: the box waited for a pause)', async () => {
    const user = userEvent.setup()
    const { onSearch } = renderPicker()
    await open(user)
    await user.type(searchInput(), 'moon')
    expect(searchInput()).toHaveValue('moon')
    expect(onSearch).not.toHaveBeenCalled()
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('moon'), { timeout: 3000 })
    expect(onSearch).toHaveBeenCalledTimes(1)
  })

  it('emptying the box asks at once, without waiting', async () => {
    const user = userEvent.setup()
    const { onSearch } = renderPicker({ searchValue: 'moon' })
    await open(user)
    await user.clear(searchInput())
    expect(onSearch).toHaveBeenLastCalledWith('')
  })

  it('shows the value it is given', async () => {
    const user = userEvent.setup()
    renderPicker({ searchValue: 'moon' })
    await open(user)
    expect(searchInput()).toHaveValue('moon')
  })

  it('a search with no results says so, in a row that cannot be picked', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderPicker({ schools: [], searchValue: 'zzz' })
    const list = await open(user)
    const row = within(list).getByRole('option', { name: 'No results' })
    expect(row).toHaveAttribute('aria-disabled', 'true')
    await user.click(row)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('does not say «No results» while it loads, nor when there are schools', async () => {
    const user = userEvent.setup()
    const view = renderPicker({ schools: [], loading: true })
    await open(user)
    expect(screen.queryByRole('option', { name: 'No results' })).toBeNull()
    view.unmount()
    renderPicker()
    await open(user)
    expect(screen.queryByRole('option', { name: 'No results' })).toBeNull()
  })
})

describe('the pages (parity with main: the schools are paged 10 at a time)', () => {
  it('one page: no pager', async () => {
    const user = userEvent.setup()
    renderPicker({ totalPages: 1 })
    await open(user)
    expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull()
  })

  it('page 2 of the list is reachable: «Page 2» and «Next page» call onChangePage', async () => {
    const user = userEvent.setup()
    const { onChangePage, onSelect } = renderPicker({ page: 1, totalPages: 3 })
    await open(user)
    await user.click(screen.getByRole('button', { name: 'Page 2' }))
    expect(onChangePage).toHaveBeenLastCalledWith(2)
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onChangePage).toHaveBeenCalledTimes(2)
    // using the pager picks no school
    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('on the last page «Next page» is disabled and «Previous page» goes back', async () => {
    const user = userEvent.setup()
    const { onChangePage } = renderPicker({ page: 3, totalPages: 3 })
    await open(user)
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(onChangePage).toHaveBeenCalledWith(2)
  })

  it('takes the pager words from the catalog', async () => {
    mockState.catalog = { NEXT_PAGE: 'Página siguiente' }
    const user = userEvent.setup()
    renderPicker({ page: 1, totalPages: 2 })
    await open(user)
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeInTheDocument()
  })
})
