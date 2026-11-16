/* eslint-disable import/first */
// redesign W1-7 (T1-7-4, W1-QC1-03, W1-PC1-10): the business selector is usable with the keyboard alone.
// Shared with Appointments, Reports, Reviews and Products, so everything here is a property of the component itself.
import React, { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from 'styled-components'

const businesses = [
  { id: 1, name: 'Subway', city: { name: 'Miami' }, logo: '' },
  { id: 2, name: 'Taco Bell', city: { name: 'Austin' }, logo: '' },
  { id: 3, name: 'Wendys', city: { name: 'Denver' }, logo: '' }
]
const listState = vi.hoisted(() => ({ loading: false, total: 3, loadMoreBusinesses: null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: value => value }],
  useSession: () => [{ user: { level: 0 } }],
  useConfig: () => [{ configs: {} }],
  useEvent: () => [{ emit: () => {} }],
  DashboardBusinessList: ({ UIComponent, ...props }) => (
    <UIComponent
      {...props}
      businessList={{ loading: listState.loading, businesses: listState.loading ? [] : businesses }}
      pagination={{ currentPage: 1, pageSize: 20, total: listState.total, from: 1, to: 3, totalPages: Math.ceil(listState.total / 20) }}
      searchValue=''
      onSearch={() => {}}
      loadMoreBusinesses={listState.loadMoreBusinesses}
    />
  )
}))

import { BusinessSelectHeader } from '../index'

// The same shape every caller has: a trigger, then the selector (Appointments header and its empty-state action).
const Harness = ({ onPick = () => {}, withEmptyState = false }) => {
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState(null)
  return (
    <ThemeProvider theme={{ colors: {} }}>
      <div>
        <button type='button' aria-haspopup='true' aria-expanded={open} onClick={() => setOpen(!open)}>Header trigger</button>
        {open && (
          <BusinessSelectHeader
            close={() => setOpen(false)}
            isOpen={open}
            changeBusinessState={business => { setPicked(business); onPick(business); setOpen(false) }}
          />
        )}
      </div>
      {withEmptyState && !picked && <button type='button' onClick={() => setOpen(true)}>Empty trigger</button>}
      <output data-testid='picked'>{picked?.name || ''}</output>
    </ThemeProvider>
  )
}

describe('BusinessSelectHeader keyboard', () => {
  beforeEach(() => {
    Object.assign(listState, { loading: false, total: 3, loadMoreBusinesses: vi.fn() })
  })

  it('moves the focus to the search when it opens', async () => {
    render(<Harness />)
    screen.getByText('Header trigger').focus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByPlaceholderText('Search')).toHaveFocus()
  })

  it('makes every business a focusable button reachable by Tab and by the arrow keys', async () => {
    render(<Harness />)
    screen.getByText('Header trigger').focus()
    await userEvent.keyboard('{Enter}')
    const options = screen.getAllByRole('button').filter(el => /Subway|Taco Bell|Wendys/.test(el.textContent))
    expect(options).toHaveLength(3)
    await userEvent.keyboard('{ArrowDown}')
    expect(options[0]).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(options[1]).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(options[2]).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(options[2]).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(options[0]).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByPlaceholderText('Search')).toHaveFocus()
    await userEvent.tab()
    expect(options[0]).toHaveFocus()
  })

  // the list scrolls and loads by pages; reaching the last option with the keyboard asks for the next page
  it('reaching the last loaded option with the arrow keys or End asks for the next page, once', async () => {
    listState.total = 10
    render(<Harness />)
    screen.getByText('Header trigger').focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('{ArrowDown}')
    expect(listState.loadMoreBusinesses).not.toHaveBeenCalled()
    await userEvent.keyboard('{End}')
    expect(listState.loadMoreBusinesses).toHaveBeenCalledTimes(1)
    await userEvent.keyboard('{ArrowDown}')
    expect(listState.loadMoreBusinesses).toHaveBeenCalledTimes(1)
  })

  it('does not ask for more at the last option when everything is loaded', async () => {
    render(<Harness />)
    screen.getByText('Header trigger').focus()
    await userEvent.keyboard('{Enter}{End}')
    expect(listState.loadMoreBusinesses).not.toHaveBeenCalled()
  })

  it('chooses a business with Enter and gives the focus back to the trigger', async () => {
    const onPick = vi.fn()
    render(<Harness onPick={onPick} />)
    screen.getByText('Header trigger').focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Taco Bell' }))
    expect(screen.queryByPlaceholderText('Search')).toBeNull()
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('Header trigger')).toHaveFocus()
  })

  it('closes with Esc, from the search and from an option, and returns the focus to the trigger that opened it', async () => {
    render(<Harness />)
    const trigger = screen.getByText('Header trigger')
    trigger.focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByPlaceholderText('Search')).toBeNull()
    await act(async () => { await Promise.resolve() })
    expect(trigger).toHaveFocus()
    await userEvent.keyboard('{Enter}{ArrowDown}{Escape}')
    expect(screen.queryByPlaceholderText('Search')).toBeNull()
    await act(async () => { await Promise.resolve() })
    expect(trigger).toHaveFocus()
  })

  it('does not let Esc reach a parent handler (a modal around the selector stays open)', async () => {
    const onKeyDown = vi.fn()
    render(<div onKeyDown={onKeyDown}><Harness /></div>)
    screen.getByText('Header trigger').focus()
    await userEvent.keyboard('{Enter}')
    onKeyDown.mockClear()
    await userEvent.keyboard('{Escape}')
    expect(onKeyDown).not.toHaveBeenCalled()
  })

  it('opened from the empty-state button it is one instance, the focus goes to its search and Esc goes back to that button', async () => {
    render(<Harness withEmptyState />)
    const empty = screen.getByText('Empty trigger')
    empty.focus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getAllByPlaceholderText('Search')).toHaveLength(1)
    expect(screen.getByPlaceholderText('Search')).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await act(async () => { await Promise.resolve() })
    expect(empty).toHaveFocus()
  })

  it('when the opener disappears with the choice, the focus goes to the trigger next to the selector (never to body)', async () => {
    render(<Harness withEmptyState />)
    screen.getByText('Empty trigger').focus()
    await userEvent.keyboard('{Enter}{ArrowDown}{Enter}')
    await act(async () => { await Promise.resolve() })
    expect(screen.queryByText('Empty trigger')).toBeNull()
    expect(screen.getByText('Header trigger')).toHaveFocus()
  })

  it('names the selector and links the opener to it with aria-controls and aria-expanded', async () => {
    render(<Harness withEmptyState />)
    const empty = screen.getByText('Empty trigger')
    empty.focus()
    await userEvent.keyboard('{Enter}')
    const group = screen.getByRole('group', { name: 'Select business' })
    expect(empty).toHaveAttribute('aria-controls', group.id)
    expect(empty).toHaveAttribute('aria-expanded', 'true')
    // a trigger that already states its own aria-expanded keeps it
    await userEvent.keyboard('{Escape}')
    await act(async () => { await Promise.resolve() })
    expect(empty).not.toHaveAttribute('aria-controls')
    expect(empty).not.toHaveAttribute('aria-expanded')
    const header = screen.getByText('Header trigger')
    header.focus()
    await userEvent.keyboard('{Enter}')
    expect(header).toHaveAttribute('aria-controls', screen.getByRole('group', { name: 'Select business' }).id)
    expect(header).toHaveAttribute('aria-expanded', 'true')
  })

  it('still lets the mouse choose a business', () => {
    const onPick = vi.fn()
    render(<Harness onPick={onPick} />)
    fireEvent.click(screen.getByText('Header trigger'))
    fireEvent.click(screen.getByText('Wendys'))
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Wendys' }))
  })

  it('does not take the focus when a touch screen opens it with a tap (no on-screen keyboard over the list)', async () => {
    const original = window.matchMedia
    window.matchMedia = query => ({ matches: query === '(pointer: coarse)', media: query, addEventListener () {}, removeEventListener () {} })
    try {
      render(<Harness />)
      fireEvent.click(screen.getByText('Header trigger'))
      expect(screen.getByPlaceholderText('Search')).not.toHaveFocus()
    } finally {
      window.matchMedia = original
    }
  })
})

// redesign bugs F, live check L-3: /stores/products without a store opens the selector by itself on load, so nothing had
// the focus to give it back to, and Escape left it on <body>. With no opener, the trigger of the header (aria-haspopup="dialog", in
// the selector's surroundings) takes it.
describe('BusinessSelectHeader · opened by the page (no opener)', () => {
  const AutoOpen = () => {
    const [open, setOpen] = useState(true)
    return (
      <ThemeProvider theme={{ colors: {} }}>
        <div className='head'>
          <div className='title'><button type='button' aria-haspopup='dialog' aria-expanded={open} onClick={() => setOpen(!open)}>Pick a store</button></div>
          <div className='selector'>
            {open && <BusinessSelectHeader close={() => setOpen(false)} isOpen={open} changeBusinessState={() => setOpen(false)} />}
          </div>
        </div>
      </ThemeProvider>
    )
  }

  it('Escape gives the focus to the header trigger, not to <body>', async () => {
    render(<AutoOpen />)
    expect(screen.getByPlaceholderText('Search')).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await act(async () => { await Promise.resolve() })
    expect(screen.getByRole('button', { name: 'Pick a store' })).toHaveFocus()
  })
})
