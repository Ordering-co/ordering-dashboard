// redesign (AD-4, AD-6): the anatomy of the lists of the delivery group panel. A named group, Product actions with
// main's effect, rows whose title toggles the checkbox, and a loading, error, empty or no-match state instead of a bare list.
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DriversGroupPickList, DriversGroupPickRow } from '..'

const LABELS = {
  legend: 'Drivers',
  searchLabel: 'Search drivers',
  clearLabel: 'Clear search',
  selectAllLabel: 'Select all',
  selectNoneLabel: 'Select none',
  loadingLabel: 'Loading',
  errorTitle: "We couldn't load the drivers.",
  emptyTitle: 'No drivers yet',
  noMatchTitle: 'Nothing matches your search'
}

const draw = (props = {}, rows = null) => render(
  <DriversGroupPickList {...LABELS} {...props}>
    {rows}
  </DriversGroupPickList>
)

afterEach(cleanup)

describe('DriversGroupPickList', () => {
  it('is a group named by its legend, with Product actions that call their handlers', async () => {
    const onSelectAll = vi.fn()
    const onSelectNone = vi.fn()
    draw({ onSelectAll, onSelectNone }, <DriversGroupPickRow title='Ana' checked={false} />)
    const group = screen.getByRole('group', { name: 'Drivers' })
    expect(group).toBeInTheDocument()
    const all = screen.getByRole('button', { name: 'Select all' })
    expect(all).toHaveClass('odc-btn')
    await userEvent.click(all)
    await userEvent.click(screen.getByRole('button', { name: 'Select none' }))
    expect(onSelectAll).toHaveBeenCalledTimes(1)
    expect(onSelectNone).toHaveBeenCalledTimes(1)
  })

  it('draws a search field that hands every keystroke to onSearch', async () => {
    const onSearch = vi.fn()
    draw({ search: '', onSearch }, <DriversGroupPickRow title='Ana' />)
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search drivers' }), 'a')
    expect(onSearch).toHaveBeenCalledWith('a')
  })

  it('a row is a checkbox named by its title, and clicking the title toggles it', async () => {
    const onCheckedChange = vi.fn()
    draw({}, <DriversGroupPickRow title='Ana Pérez' meta='ana@example.com' checked={false} onCheckedChange={onCheckedChange} />)
    const box = screen.getByRole('checkbox', { name: 'Ana Pérez' })
    expect(box).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(screen.getByText('Ana Pérez'))
    expect(onCheckedChange).toHaveBeenCalledWith(true)
    expect(screen.getByText('ana@example.com')).toBeInTheDocument()
  })

  it('says it is loading instead of drawing an empty list', () => {
    draw({ loading: true })
    expect(screen.getByRole('status', { name: 'Loading' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('says when there is nothing to pick from, and when the search finds nothing', () => {
    draw({ empty: true })
    expect(screen.getByText('No drivers yet')).toBeInTheDocument()
    cleanup()
    draw({ empty: true, search: 'zz', onSearch: vi.fn() })
    expect(screen.getByText('Nothing matches your search')).toBeInTheDocument()
  })

  it('says when the list could not load, as an alert', () => {
    draw({ error: true })
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the drivers.")
  })

  it('draws the footer only under rows', () => {
    draw({ footer: <span>pages</span> }, <DriversGroupPickRow title='Ana' />)
    expect(screen.getByText('pages')).toBeInTheDocument()
    cleanup()
    draw({ footer: <span>pages</span>, empty: true })
    expect(screen.queryByText('pages')).not.toBeInTheDocument()
  })
})
