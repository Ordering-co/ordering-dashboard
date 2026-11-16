/* eslint-disable import/first */
// redesign CA-B3 (decision 2): the filter bar of the campaigns list: search, the Channel and Audience pills, one chip per active
// value and «Clear filters». It holds no filter state: it shows what the host holds and reports each action once.
import React, { useState } from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  catalog: {} // what the runtime catalog of the API says for a key, over the default text
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (key, text) => mockState.catalog[key] ?? text]
}))

import { CampaignsFilters } from '../CampaignsFilters'

const EMPTY = { contact_type: [], audience_type: [] }

// What the host does with what the bar writes: a stateful stand-in, so the bar re-renders with the new values
const renderBar = ({ search = '', values = EMPTY } = {}) => {
  const onSearch = vi.fn()
  const onChange = vi.fn()
  const onClear = vi.fn()
  const Harness = () => {
    const [searchValue, setSearchValue] = useState(search)
    const [current, setCurrent] = useState(values)
    return (
      <CampaignsFilters
        search={searchValue}
        onSearch={(text) => { onSearch(text); setSearchValue(text) }}
        values={current}
        onChange={(next) => { onChange(next); setCurrent(next) }}
        onClear={onClear}
      />
    )
  }
  render(<Harness />)
  return { onSearch, onChange, onClear }
}

const popup = (name) => screen.findByRole('dialog', { name })
const lastWrite = (spy) => spy.mock.calls[spy.mock.calls.length - 1][0]
const chipTexts = () => [...screen.getByRole('list', { name: 'Active filters' }).querySelectorAll('.odc-chip-text')].map(item => item.textContent)

beforeEach(() => {
  vi.clearAllMocks()
  mockState.catalog = {}
})
afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})

describe('the bar', () => {
  it('is a group named «Campaign filters»', () => {
    renderBar()
    expect(screen.getByRole('group', { name: 'Campaign filters' })).toBeInTheDocument()
  })

  it('takes its words from the catalog', () => {
    mockState.catalog = { CAMPAIGNS_FILTERS: 'Filtros de campañas', CAMPAIGNS_SEARCH: 'Buscar campañas', CAMPAIGNS_FILTER_CHANNEL: 'Canal', CAMPAIGNS_FILTER_AUDIENCE: 'Audiencia' }
    renderBar()
    expect(screen.getByRole('group', { name: 'Filtros de campañas' })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Buscar campañas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Canal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Audiencia' })).toBeInTheDocument()
  })

  it('has the Channel and Audience pills and no Status pill (auditor #8)', () => {
    renderBar()
    expect(screen.getByRole('button', { name: 'Channel' })).toHaveAttribute('aria-haspopup', 'dialog')
    expect(screen.getByRole('button', { name: 'Audience' })).toHaveAttribute('aria-haspopup', 'dialog')
    expect(screen.queryByRole('button', { name: /status/i })).toBeNull()
  })
})

describe('search', () => {
  it('is named «Search campaigns», in the label and in the placeholder', () => {
    renderBar()
    expect(screen.getByRole('searchbox', { name: 'Search campaigns' })).toHaveAttribute('placeholder', 'Search campaigns')
  })

  it('sends the text once, after the wait, never per keystroke', async () => {
    const user = userEvent.setup()
    const { onSearch } = renderBar()
    await user.type(screen.getByRole('searchbox', { name: 'Search campaigns' }), 'black fri')
    expect(onSearch).not.toHaveBeenCalled()
    await waitFor(() => expect(onSearch).toHaveBeenCalledTimes(1), { timeout: 3000 })
    expect(onSearch).toHaveBeenCalledWith('black fri')
  })

  it('does not send before 750 ms have passed', async () => {
    const user = userEvent.setup()
    const { onSearch } = renderBar()
    await user.type(screen.getByRole('searchbox', { name: 'Search campaigns' }), 'a')
    await new Promise(resolve => setTimeout(resolve, 500))
    expect(onSearch).not.toHaveBeenCalled()
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('a'), { timeout: 3000 })
  })

  it('sends at once on Enter, and only once', async () => {
    const user = userEvent.setup()
    const { onSearch } = renderBar()
    await user.type(screen.getByRole('searchbox', { name: 'Search campaigns' }), 'sms{Enter}')
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenCalledWith('sms')
    await new Promise(resolve => setTimeout(resolve, 900))
    expect(onSearch).toHaveBeenCalledTimes(1)
  })

  it('«Clear search» empties it and sends «» at once', async () => {
    const user = userEvent.setup()
    const { onSearch } = renderBar({ search: 'sms' })
    const field = screen.getByRole('searchbox', { name: 'Search campaigns' })
    expect(field).toHaveValue('sms')
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenCalledWith('')
    expect(field).toHaveValue('')
  })

  it('shows a search that arrives from outside when the user is not typing', () => {
    renderBar({ search: 'promo' })
    expect(screen.getByRole('searchbox', { name: 'Search campaigns' })).toHaveValue('promo')
  })
})

describe('Channel pill', () => {
  it('lists the six channels by their names, none checked', async () => {
    const user = userEvent.setup()
    renderBar()
    await user.click(screen.getByRole('button', { name: 'Channel' }))
    const box = await popup('Channel')
    const rows = within(box).getAllByRole('checkbox')
    expect(rows.map(row => row.textContent)).toEqual(['Email', 'SMS', 'Push notification', 'WhatsApp', 'Webhook', 'Popup'])
    rows.forEach(row => expect(row).toHaveAttribute('aria-checked', 'false'))
  })

  it('a channel is written under contact_type, with the raw value the API filters by, and the audience is kept', async () => {
    const user = userEvent.setup()
    const { onChange } = renderBar({ values: { contact_type: [], audience_type: ['fixed'] } })
    await user.click(screen.getByRole('button', { name: 'Channel' }))
    const box = await popup('Channel')
    await user.click(within(box).getByRole('checkbox', { name: 'Push notification' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ contact_type: ['notification'], audience_type: ['fixed'] })
  })

  it('toggles: a second channel is added and a checked one is removed', async () => {
    const user = userEvent.setup()
    const { onChange } = renderBar()
    await user.click(screen.getByRole('button', { name: 'Channel' }))
    const box = await popup('Channel')
    await user.click(within(box).getByRole('checkbox', { name: 'Push notification' }))
    await user.click(within(box).getByRole('checkbox', { name: 'Email' }))
    expect(lastWrite(onChange)).toEqual({ contact_type: ['notification', 'email'], audience_type: [] })
    expect(within(box).getByRole('checkbox', { name: 'Email' })).toHaveAttribute('aria-checked', 'true')
    await user.click(within(box).getByRole('checkbox', { name: 'Push notification' }))
    expect(lastWrite(onChange)).toEqual({ contact_type: ['email'], audience_type: [] })
    expect(onChange).toHaveBeenCalledTimes(3)
  })

  it('«Clear» in the popover empties only the channels', async () => {
    const user = userEvent.setup()
    const { onChange } = renderBar({ values: { contact_type: ['sms', 'email'], audience_type: ['dynamic'] } })
    await user.click(screen.getByRole('button', { name: /^Channel/ }))
    const box = await popup('Channel')
    await user.click(within(box).getByRole('button', { name: 'Clear' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ contact_type: [], audience_type: ['dynamic'] })
  })

  it('the pill says the name of one channel and the count of several', () => {
    renderBar({ values: { contact_type: ['notification'], audience_type: [] } })
    expect(screen.getByRole('button', { name: /^Channel\s*Push notification$/ })).toBeInTheDocument()
    cleanup()
    renderBar({ values: { contact_type: ['notification', 'sms'], audience_type: [] } })
    expect(screen.getByRole('button', { name: /^Channel\s*2$/ })).toBeInTheDocument()
  })

  it('the pill is bare while nothing is chosen', () => {
    renderBar()
    expect(screen.getByRole('button', { name: 'Channel' })).not.toHaveAttribute('data-active')
  })
})

describe('Audience pill', () => {
  it('lists Fixed and Dynamic', async () => {
    const user = userEvent.setup()
    renderBar()
    await user.click(screen.getByRole('button', { name: 'Audience' }))
    const box = await popup('Audience')
    expect(within(box).getAllByRole('checkbox').map(row => row.textContent)).toEqual(['Fixed', 'Dynamic'])
  })

  it('an audience is written under audience_type and the channels are kept', async () => {
    const user = userEvent.setup()
    const { onChange } = renderBar({ values: { contact_type: ['sms'], audience_type: [] } })
    await user.click(screen.getByRole('button', { name: /^Audience/ }))
    const box = await popup('Audience')
    await user.click(within(box).getByRole('checkbox', { name: 'Dynamic' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ contact_type: ['sms'], audience_type: ['dynamic'] })
    await user.click(within(box).getByRole('checkbox', { name: 'Fixed' }))
    expect(lastWrite(onChange)).toEqual({ contact_type: ['sms'], audience_type: ['dynamic', 'fixed'] })
    await user.click(within(box).getByRole('checkbox', { name: 'Dynamic' }))
    expect(lastWrite(onChange)).toEqual({ contact_type: ['sms'], audience_type: ['fixed'] })
  })

  it('«Clear» in the popover empties only the audiences', async () => {
    const user = userEvent.setup()
    const { onChange } = renderBar({ values: { contact_type: ['sms'], audience_type: ['fixed'] } })
    await user.click(screen.getByRole('button', { name: /^Audience/ }))
    const box = await popup('Audience')
    await user.click(within(box).getByRole('button', { name: 'Clear' }))
    expect(onChange).toHaveBeenCalledWith({ contact_type: ['sms'], audience_type: [] })
  })
})

describe('values the host holds in a partial shape', () => {
  it.each([[undefined], [null], [{}], [{ contact_type: null }]])('%j is an empty filter and a write is a complete object', async (values) => {
    const user = userEvent.setup()
    const Bare = () => {
      const [current, setCurrent] = useState(values)
      return <CampaignsFilters search='' onSearch={() => {}} values={current} onChange={(next) => { bareChange(next); setCurrent(next) }} onClear={() => {}} />
    }
    const bareChange = vi.fn()
    render(<Bare />)
    expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Audience' }))
    const box = await popup('Audience')
    await user.click(within(box).getByRole('checkbox', { name: 'Fixed' }))
    expect(bareChange).toHaveBeenCalledWith({ contact_type: [], audience_type: ['fixed'] })
  })
})

describe('chips and «Clear filters»', () => {
  const FULL = { contact_type: ['notification', 'sms'], audience_type: ['fixed'] }

  it('draws one chip per active value, in the words of the table', () => {
    renderBar({ values: FULL })
    expect(chipTexts()).toEqual(['Channel: Push notification', 'Channel: SMS', 'Audience: Fixed'])
  })

  it('a value the API holds but the bar does not know is shown as «Other», never raw', () => {
    renderBar({ values: { contact_type: ['carrier-pigeon'], audience_type: [] } })
    expect(chipTexts()).toEqual(['Channel: Other'])
    expect(screen.queryByText(/carrier-pigeon/)).toBeNull()
  })

  it('each chip has its own accessible remove button', () => {
    renderBar({ values: FULL })
    const chips = screen.getByRole('list', { name: 'Active filters' })
    expect(within(chips).getByRole('button', { name: 'Remove Channel: Push notification filter' })).toBeInTheDocument()
    expect(within(chips).getByRole('button', { name: 'Remove Channel: SMS filter' })).toBeInTheDocument()
    expect(within(chips).getByRole('button', { name: 'Remove Audience: Fixed filter' })).toBeInTheDocument()
  })

  it('removing a chip takes that one value out and leaves the rest', async () => {
    const user = userEvent.setup()
    const { onChange } = renderBar({ values: FULL })
    await user.click(screen.getByRole('button', { name: 'Remove Channel: Push notification filter' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ contact_type: ['sms'], audience_type: ['fixed'] })
    expect(chipTexts()).toEqual(['Channel: SMS', 'Audience: Fixed'])
    await user.click(screen.getByRole('button', { name: 'Remove Audience: Fixed filter' }))
    expect(lastWrite(onChange)).toEqual({ contact_type: ['sms'], audience_type: [] })
  })

  it('removing the last chip leaves no chips and no «Clear filters»', async () => {
    const user = userEvent.setup()
    renderBar({ values: { contact_type: ['email'], audience_type: [] } })
    await user.click(screen.getByRole('button', { name: 'Remove Channel: Email filter' }))
    expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
  })

  it('«Clear filters» calls onClear once and writes nothing itself', async () => {
    const user = userEvent.setup()
    const { onClear, onChange, onSearch } = renderBar({ values: FULL })
    const clears = screen.getAllByRole('button', { name: 'Clear filters' })
    await user.click(clears[clears.length - 1])
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
    expect(onSearch).not.toHaveBeenCalled()
  })

  it('the one in the bar and the one after the chips both clear', async () => {
    const user = userEvent.setup()
    const { onClear } = renderBar({ values: FULL })
    const clears = screen.getAllByRole('button', { name: 'Clear filters' })
    expect(clears).toHaveLength(2)
    await user.click(clears[0])
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('the focus goes to the search field before the filters leave, never to <body>', async () => {
    const user = userEvent.setup()
    renderBar({ values: FULL })
    const clears = screen.getAllByRole('button', { name: 'Clear filters' })
    await user.click(clears[clears.length - 1])
    expect(screen.getByRole('searchbox', { name: 'Search campaigns' })).toHaveFocus()
  })

  it('a search alone narrows: «Clear filters» shows, with no chips', () => {
    renderBar({ search: 'promo' })
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull()
  })

  it('with nothing applied there is no «Clear filters» and no chips', () => {
    renderBar()
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
    expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull()
  })
})
