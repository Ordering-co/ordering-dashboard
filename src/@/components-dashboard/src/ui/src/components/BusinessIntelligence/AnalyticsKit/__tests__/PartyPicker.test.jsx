/* eslint-disable import/first */
// redesign invoice FC1 (D7, auditor 13): the picker of one business or one driver. It works against the controller contract with
// a fake `party`: the business list searches on the server (`party.setSearch`) and pages (`party.goToPage`); the driver list
// filters here, without accents or capitals. Choosing calls `party.select({ id, name })` and closes the popover.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' }, dictionary: {} }, (_key, text) => text]
}))

// A transparent spy on the pager, to see the `pageSize` the picker hands it (the pager does not show it)
const paginationProps = []
vi.mock('../../../Shared/Product', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    Pagination: (props) => {
      paginationProps.push(props)
      return actual.Pagination(props)
    }
  }
})

import { PartyPicker } from '../PartyPicker'

const STORES = [
  { id: 1, name: 'Alpha Pizza' },
  { id: 2, name: 'Beta Burgers' },
  { id: 3, name: 'Gamma Grill' }
]
const DRIVERS = [
  { id: 21, name: 'José Pérez' },
  { id: 22, name: 'Ana Ruiz' },
  { id: 23, name: 'Cy Díaz' }
]

const businessParty = (over = {}) => ({
  kind: 'business',
  items: STORES,
  loading: false,
  error: null,
  page: 1,
  totalPages: 1,
  search: '',
  setSearch: vi.fn(),
  goToPage: vi.fn(),
  selected: null,
  select: vi.fn(),
  ...over
})

const driverParty = (over = {}) => ({
  kind: 'driver',
  items: DRIVERS,
  loading: false,
  error: null,
  selected: null,
  select: vi.fn(),
  ...over
})

// The exit transition of the overlays takes a moment in jsdom
const EXIT = { timeout: 4000 }
const trigger = (name) => screen.getByRole('button', { name })
const openPicker = async (user, name) => {
  await user.click(trigger(name))
  return screen.findByRole('dialog', { name })
}

beforeEach(() => {
  vi.clearAllMocks()
  paginationProps.length = 0
})
afterEach(() => document.getElementById('app-modals')?.remove())

describe('PartyPicker · the trigger', () => {
  it('business: a field named «Business» that says «Select a business» until one is chosen', () => {
    render(<PartyPicker party={businessParty()} />)
    const button = trigger(/Business/)
    expect(button.tagName).toBe('BUTTON')
    expect(button).toHaveAttribute('aria-haspopup', 'dialog')
    expect(button).toHaveAccessibleName('Business Select a business')
    // redesign invoice R2 (r1 P6): a visible field label above the pill names the group; the pill keeps its own label
    expect(screen.getByText('Business', { selector: '.odc-pill-label' })).toBeInTheDocument()
    expect(screen.getAllByText('Business')).toHaveLength(2)
    expect(screen.getByRole('group', { name: 'Business' })).toContainElement(button)
  })

  it('driver: «Driver» and «Select a driver»', () => {
    render(<PartyPicker party={driverParty()} />)
    expect(trigger(/Driver/)).toHaveAccessibleName('Driver Select a driver')
  })

  it('shows the chosen name, which is the name of the control, and not the placeholder', () => {
    render(<PartyPicker party={businessParty({ selected: { id: 2, name: 'Beta Burgers' } })} />)
    const button = trigger(/Business/)
    expect(button).toHaveAccessibleName('Business Beta Burgers')
    expect(button).not.toHaveTextContent('Select a business')
  })
})

describe('PartyPicker · business (server search and pages)', () => {
  it('opens a popover with a search field and the businesses as radios of one choice', async () => {
    const user = userEvent.setup()
    render(<PartyPicker party={businessParty({ selected: { id: 2, name: 'Beta Burgers' } })} />)
    const popup = await openPicker(user, /Business/)
    expect(within(popup).getByRole('searchbox', { name: /Search/ })).toBeInTheDocument()
    const group = within(popup).getByRole('radiogroup', { name: 'Business' })
    const radios = within(group).getAllByRole('radio')
    expect(radios.map(radio => radio.textContent)).toEqual(['Alpha Pizza', 'Beta Burgers', 'Gamma Grill'])
    expect(within(group).getByRole('radio', { name: 'Beta Burgers' })).toHaveAttribute('aria-checked', 'true')
    expect(within(group).getByRole('radio', { name: 'Alpha Pizza' })).toHaveAttribute('aria-checked', 'false')
    // the Tab stop is the chosen one only
    expect(within(group).getByRole('radio', { name: 'Beta Burgers' })).toHaveAttribute('tabindex', '0')
    expect(within(group).getByRole('radio', { name: 'Alpha Pizza' })).toHaveAttribute('tabindex', '-1')
  })

  it('what is typed goes to the server through party.setSearch, after a wait; Enter sends it at once', async () => {
    const user = userEvent.setup()
    const party = businessParty()
    render(<PartyPicker party={party} />)
    const popup = await openPicker(user, /Business/)
    const search = within(popup).getByRole('searchbox', { name: /Search/ })
    await user.type(search, 'alp')
    expect(party.setSearch).not.toHaveBeenCalled()
    await waitFor(() => expect(party.setSearch).toHaveBeenCalledWith('alp'), { timeout: 3000 })
    expect(party.setSearch).toHaveBeenCalledTimes(1)
    party.setSearch.mockClear()
    await user.type(search, 'h{Enter}')
    expect(party.setSearch).toHaveBeenCalledWith('alph')
  })

  it('starts from the search the controller holds, so the list and the field agree', async () => {
    const user = userEvent.setup()
    render(<PartyPicker party={businessParty({ search: 'pizza' })} />)
    const popup = await openPicker(user, /Business/)
    expect(within(popup).getByRole('searchbox', { name: /Search/ })).toHaveValue('pizza')
  })

  it('pages with Pagination: the next page asks the controller for page 2, and the page is said as «Page 1 of 3»', async () => {
    const user = userEvent.setup()
    const party = businessParty({ totalPages: 3 })
    render(<PartyPicker party={party} />)
    const popup = await openPicker(user, /Business/)
    const pager = within(popup).getByRole('navigation', { name: 'Pagination' })
    expect(pager).toHaveTextContent('Page 1 of 3')
    await user.click(within(pager).getByRole('button', { name: 'Next page' }))
    expect(party.goToPage).toHaveBeenCalledTimes(1)
    expect(party.goToPage).toHaveBeenCalledWith(2)
    expect(within(pager).getByRole('button', { name: 'Previous page' })).toBeDisabled()
  })

  // R4: main's store selector jumped straight to a page; the picker of Payment reports and Reviews too
  it('has a page field, so page 3 of 3 is one entry and not two clicks', async () => {
    const user = userEvent.setup()
    const party = businessParty({ totalPages: 3 })
    render(<PartyPicker party={party} />)
    const popup = await openPicker(user, /Business/)
    const field = within(popup).getByRole('textbox', { name: 'Page' })
    expect(field).toHaveValue('1')
    expect(within(popup).getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('of 3')
    await user.clear(field)
    await user.type(field, '3{Enter}')
    expect(party.goToPage).toHaveBeenCalledWith(3)
  })

  it('has no pager when everything fits one page', async () => {
    const user = userEvent.setup()
    render(<PartyPicker party={businessParty({ totalPages: 1 })} />)
    const popup = await openPicker(user, /Business/)
    expect(within(popup).queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })

  it('choosing one calls party.select({ id, name }) once and closes the popover', async () => {
    const user = userEvent.setup()
    const party = businessParty()
    render(<PartyPicker party={party} />)
    const popup = await openPicker(user, /Business/)
    await user.click(within(popup).getByRole('radio', { name: 'Gamma Grill' }))
    expect(party.select).toHaveBeenCalledTimes(1)
    expect(party.select).toHaveBeenCalledWith({ id: 3, name: 'Gamma Grill' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Business' })).toBeNull(), EXIT)
    expect(trigger(/Business/)).toHaveFocus()
  })
})

describe('PartyPicker · driver (local search)', () => {
  it('filters the list here, without accents or capitals, and never asks a server', async () => {
    const user = userEvent.setup()
    const party = driverParty()
    render(<PartyPicker party={party} />)
    const popup = await openPicker(user, /Driver/)
    await user.type(within(popup).getByRole('searchbox', { name: /Search/ }), 'JOSE')
    const radios = within(popup).getAllByRole('radio')
    expect(radios.map(radio => radio.textContent)).toEqual(['José Pérez'])
    expect(party.setSearch).toBeUndefined()
  })

  it('«diaz» finds «Díaz», and a search with no match says «No results found»', async () => {
    const user = userEvent.setup()
    render(<PartyPicker party={driverParty()} />)
    const popup = await openPicker(user, /Driver/)
    const search = within(popup).getByRole('searchbox', { name: /Search/ })
    await user.type(search, 'diaz')
    expect(within(popup).getAllByRole('radio').map(radio => radio.textContent)).toEqual(['Cy Díaz'])
    await user.clear(search)
    await user.type(search, 'zzz')
    expect(within(popup).queryAllByRole('radio')).toHaveLength(0)
    expect(within(popup).getByText('No results found')).toBeInTheDocument()
  })

  it('has no pager and choosing calls select with the id and the name', async () => {
    const user = userEvent.setup()
    const party = driverParty()
    render(<PartyPicker party={party} />)
    const popup = await openPicker(user, /Driver/)
    expect(within(popup).queryByRole('navigation', { name: 'Pagination' })).toBeNull()
    await user.click(within(popup).getByRole('radio', { name: 'Ana Ruiz' }))
    expect(party.select).toHaveBeenCalledWith({ id: 22, name: 'Ana Ruiz' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Driver' })).toBeNull(), EXIT)
  })
})

describe('PartyPicker · keyboard and states', () => {
  it('the arrows move the focus between the search field and the options without choosing; Enter chooses', async () => {
    const user = userEvent.setup()
    const party = businessParty()
    render(<PartyPicker party={party} />)
    const popup = await openPicker(user, /Business/)
    const search = within(popup).getByRole('searchbox', { name: /Search/ })
    expect(search).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(within(popup).getByRole('radio', { name: 'Alpha Pizza' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(within(popup).getByRole('radio', { name: 'Beta Burgers' })).toHaveFocus()
    await user.keyboard('{End}')
    expect(within(popup).getByRole('radio', { name: 'Gamma Grill' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(within(popup).getByRole('radio', { name: 'Alpha Pizza' })).toHaveFocus()
    expect(party.select).not.toHaveBeenCalled()
    await user.keyboard('{ArrowUp}')
    expect(search).toHaveFocus()
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(party.select).toHaveBeenCalledWith({ id: 2, name: 'Beta Burgers' })
  })

  it('Escape closes it and the focus goes back to the trigger', async () => {
    const user = userEvent.setup()
    render(<PartyPicker party={businessParty()} />)
    await openPicker(user, /Business/)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Business' })).toBeNull(), EXIT)
    expect(trigger(/Business/)).toHaveFocus()
  })

  it('says «Loading» while the first list comes, and keeps the list in view (busy) while another page loads', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<PartyPicker party={businessParty({ items: [], loading: true })} />)
    const popup = await openPicker(user, /Business/)
    expect(within(popup).getByText('Loading')).toBeInTheDocument()
    rerender(<PartyPicker party={businessParty({ items: STORES, loading: true, totalPages: 2 })} />)
    expect(within(popup).getAllByRole('radio')).toHaveLength(3)
    expect(within(popup).getByRole('radiogroup', { name: 'Business' })).toHaveAttribute('aria-busy', 'true')
  })

  it('says «No results found» when the server returns nothing', async () => {
    const user = userEvent.setup()
    render(<PartyPicker party={businessParty({ items: [], search: 'nope' })} />)
    const popup = await openPicker(user, /Business/)
    expect(within(popup).getByText('No results found')).toBeInTheDocument()
  })

  // J2 (D-18, ): an opt-in action under «No results found» (StorePicker's «Add new store»)
  it('emptyAction: a button under «No results found» that runs onSelect and closes; never with a list, while loading or without it', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const { unmount } = render(<PartyPicker party={businessParty({ items: [] })} emptyAction={{ label: 'Add new store', onSelect }} />)
    let popup = await openPicker(user, /Business/)
    await user.click(within(popup).getByRole('button', { name: 'Add new store' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Business/ })).toBeNull(), { timeout: 4000 })
    unmount()
    const again = render(<PartyPicker party={businessParty({ items: [], loading: true })} emptyAction={{ label: 'Add new store', onSelect }} />)
    popup = await openPicker(user, /Business/)
    expect(within(popup).queryByRole('button', { name: 'Add new store' })).toBeNull()
    again.unmount()
    const third = render(<PartyPicker party={businessParty()} emptyAction={{ label: 'Add new store', onSelect }} />)
    popup = await openPicker(user, /Business/)
    expect(within(popup).queryByRole('button', { name: 'Add new store' })).toBeNull()
    third.unmount()
    render(<PartyPicker party={businessParty({ items: [] })} />)
    popup = await openPicker(user, /Business/)
    expect(within(popup).queryByRole('button', { name: 'Add new store' })).toBeNull()
  })

  it('an error says so in words, never the raw message, and «Try again» goes to party.retry', async () => {
    const user = userEvent.setup()
    const retry = vi.fn()
    render(<PartyPicker party={businessParty({ items: [], error: 'Invalid response format', retry })} />)
    const popup = await openPicker(user, /Business/)
    expect(within(popup).getByText('The list could not be loaded.')).toBeInTheDocument()
    expect(popup).not.toHaveTextContent('Invalid response format')
    await user.click(within(popup).getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('without party.retry a business falls back to asking the controller for the same page again', async () => {
    const user = userEvent.setup()
    const party = businessParty({ items: [], error: 'x', page: 2, totalPages: 3 })
    render(<PartyPicker party={party} />)
    const popup = await openPicker(user, /Business/)
    await user.click(within(popup).getByRole('button', { name: 'Try again' }))
    expect(party.goToPage).toHaveBeenCalledWith(2)
  })
})

// redesign business-payments (D-picker): the picker was promoted from /intelligence/invoice to the kit with optional props.
// Without them the render is the one above (the whole file above is the proof); these are the new ones.
describe('PartyPicker · promoted props', () => {
  const WITH_AREA = [
    { id: 1, name: 'Alpha Pizza', secondary: 'Miami' },
    { id: 2, name: 'Beta Burgers' },
    { id: 3, name: 'Gamma Grill', secondary: 'Austin' }
  ]

  it('label and placeholder of its own name the group, the pill, the list and the search; without them they are today\'s', async () => {
    const user = userEvent.setup()
    render(<PartyPicker party={businessParty()} label='Store' placeholder='Pick a store' />)
    expect(screen.getByRole('group', { name: 'Store' })).toBeInTheDocument()
    expect(trigger(/Store/)).toHaveAccessibleName('Store Pick a store')
    expect(screen.queryByText('Business')).toBeNull()
    const popup = await openPicker(user, /Store/)
    expect(within(popup).getByRole('radiogroup', { name: 'Store' })).toBeInTheDocument()
    expect(within(popup).getByRole('searchbox', { name: 'Search Store' })).toBeInTheDocument()
  })

  it('the placeholder of its own shows only while nothing is chosen', () => {
    render(<PartyPicker party={businessParty({ selected: { id: 2, name: 'Beta Burgers' } })} placeholder='Pick a store' />)
    expect(trigger(/Business/)).toHaveAccessibleName('Business Beta Burgers')
  })

  it('errorText of its own is painted; without it, the text of today', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<PartyPicker party={businessParty({ items: [], error: 'x' })} errorText='Stores are not available.' />)
    let popup = await openPicker(user, /Business/)
    expect(within(popup).getByText('Stores are not available.')).toBeInTheDocument()
    expect(within(popup).queryByText('The list could not be loaded.')).toBeNull()
    unmount()
    document.getElementById('app-modals')?.remove()
    render(<PartyPicker party={businessParty({ items: [], error: 'x' })} />)
    popup = await openPicker(user, /Business/)
    expect(within(popup).getByText('The list could not be loaded.')).toBeInTheDocument()
  })

  it('variant «pill»: only the filter pill, with no group and no visible label, and it still opens and chooses', async () => {
    const user = userEvent.setup()
    const party = businessParty()
    const { container } = render(<PartyPicker party={party} variant='pill' />)
    expect(screen.queryByRole('group')).toBeNull()
    expect(container.querySelector('.odc-iv-party')).toBeNull()
    expect(container.querySelector('.odc-iv-party-label')).toBeNull()
    // «Business» is said once: inside the pill
    expect(screen.getAllByText('Business')).toHaveLength(1)
    expect(screen.getByText('Business', { selector: '.odc-pill-label' })).toBeInTheDocument()
    expect(trigger(/Business/)).toHaveAccessibleName('Business Select a business')
    const popup = await openPicker(user, /Business/)
    await user.click(within(popup).getByRole('radio', { name: 'Gamma Grill' }))
    expect(party.select).toHaveBeenCalledWith({ id: 3, name: 'Gamma Grill' })
  })

  it('variant «field» is the default: the group has its visible label', () => {
    render(<PartyPicker party={businessParty()} variant='field' />)
    expect(screen.getByRole('group', { name: 'Business' })).toBeInTheDocument()
    expect(screen.getAllByText('Business')).toHaveLength(2)
  })

  it('secondary: the second line of each option is painted and described by, and the name of the radio stays the name', async () => {
    const user = userEvent.setup()
    render(<PartyPicker party={businessParty({ items: WITH_AREA })} secondary />)
    const popup = await openPicker(user, /Business/)
    const alpha = within(popup).getByRole('radio', { name: 'Alpha Pizza' })
    const note = within(alpha).getByText('Miami')
    expect(note.id).toBeTruthy()
    expect(note).toHaveClass('odc-radio-description')
    expect(alpha).toHaveAttribute('aria-describedby', note.id)
    expect(alpha).toHaveAccessibleDescription('Miami')
    expect(within(popup).getByRole('radio', { name: 'Gamma Grill' })).toHaveAccessibleDescription('Austin')
    // an option with no second line has no description
    expect(within(popup).getByRole('radio', { name: 'Beta Burgers' })).not.toHaveAttribute('aria-describedby')
    // two options do not share the id of their description
    expect(within(popup).getByText('Austin').id).not.toBe(note.id)
  })

  it('ListSource: the list is not mounted until the popover opens, and what it hands over replaces the list of party', async () => {
    const user = userEvent.setup()
    const mounted = vi.fn()
    const ListSource = ({ children }) => {
      mounted()
      return children({ items: [{ id: 9, name: 'Delta Deli' }], totalPages: 1, page: 1 })
    }
    const party = businessParty({ items: [], selected: { id: 9, name: 'Delta Deli' } })
    render(<PartyPicker party={party} ListSource={ListSource} />)
    expect(mounted).not.toHaveBeenCalled()
    // the pill still takes `selected` from party
    expect(trigger(/Business/)).toHaveAccessibleName('Business Delta Deli')
    const popup = await openPicker(user, /Business/)
    expect(mounted).toHaveBeenCalled()
    expect(within(popup).getAllByRole('radio').map(radio => radio.textContent)).toEqual(['Delta Deli'])
    expect(within(popup).getByRole('radio', { name: 'Delta Deli' })).toHaveAttribute('aria-checked', 'true')
    // choosing still goes to party.select and closes
    await user.click(within(popup).getByRole('radio', { name: 'Delta Deli' }))
    expect(party.select).toHaveBeenCalledWith({ id: 9, name: 'Delta Deli' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Business' })).toBeNull(), EXIT)
  })

  it('ListSource: its setSearch, page and error reach the list (the search goes to the source, not to party)', async () => {
    const user = userEvent.setup()
    const setSearch = vi.fn()
    const ListSource = ({ children }) => children({ items: [], error: 'x', page: 2, totalPages: 3, setSearch, goToPage: party.goToPage })
    const party = businessParty({ items: STORES })
    render(<PartyPicker party={party} ListSource={ListSource} />)
    const popup = await openPicker(user, /Business/)
    expect(within(popup).getByText('The list could not be loaded.')).toBeInTheDocument()
    await user.click(within(popup).getByRole('button', { name: 'Try again' }))
    expect(party.goToPage).toHaveBeenCalledWith(2)
  })

  it('avatars=\'business\': a decorative business avatar before each name, which does not change the name of the radio', async () => {
    const user = userEvent.setup()
    const items = [
      { id: 1, name: 'Alpha Pizza', photo: 'https://example.test/alpha.png' },
      { id: 2, name: 'Beta Burgers' },
      { id: 3, name: 'Gamma Grill' }
    ]
    render(<PartyPicker party={businessParty({ items })} avatars='business' />)
    const popup = await openPicker(user, /Business/)
    const radios = within(popup).getAllByRole('radio')
    expect(radios).toHaveLength(3)
    radios.forEach(radio => {
      const avatar = radio.querySelector('.odc-avatar')
      expect(avatar).toBeTruthy()
      expect(avatar).toHaveAttribute('data-kind', 'business')
      expect(avatar).toHaveAttribute('aria-hidden', 'true')
    })
    expect(radios[0].querySelector('.odc-avatar img')).toHaveAttribute('src', 'https://example.test/alpha.png')
    expect(within(popup).getByRole('radio', { name: 'Beta Burgers' })).toBeInTheDocument()
  })

  it('without avatars there is no avatar', async () => {
    const user = userEvent.setup()
    render(<PartyPicker party={businessParty()} />)
    const popup = await openPicker(user, /Business/)
    expect(popup.querySelector('.odc-avatar')).toBeNull()
  })

  it('pageSize goes to the pager; by default it is 10', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<PartyPicker party={businessParty({ totalPages: 3 })} />)
    await openPicker(user, /Business/)
    expect(paginationProps.length).toBeGreaterThan(0)
    expect(paginationProps.every(props => props.pageSize === 10)).toBe(true)
    unmount()
    document.getElementById('app-modals')?.remove()
    paginationProps.length = 0
    render(<PartyPicker party={businessParty({ totalPages: 3 })} pageSize={25} />)
    await openPicker(user, /Business/)
    expect(paginationProps.length).toBeGreaterThan(0)
    expect(paginationProps.every(props => props.pageSize === 25)).toBe(true)
  })

  it('without secondary the second line is not painted, even if the item has one', async () => {
    const user = userEvent.setup()
    render(<PartyPicker party={businessParty({ items: WITH_AREA })} />)
    const popup = await openPicker(user, /Business/)
    expect(within(popup).queryByText('Miami')).toBeNull()
    expect(within(popup).getByRole('radio', { name: 'Alpha Pizza' })).not.toHaveAttribute('aria-describedby')
  })
})

describe('PartyPicker · Base UI stays behind Shared/Product', () => {
  // redesign invoice FC1 (R1): the repo only lets Base UI be imported by the registered owners under Shared/Product
  it('does not import @base-ui: the popover is the FilterPopover of Shared/Product', () => {
    const source = readFileSync(path.resolve(__dirname, '../PartyPicker.jsx'), 'utf8')
    expect(source).not.toContain('@base-ui')
    expect(source).toMatch(/FilterPopover/)
  })
})

// redesign reviews FA2 (D6, D7, auditor 1, 2, 5): three opt-in props. Without them nothing above changes.
describe('PartyPicker · serverSearch, allOption, defaultOpen', () => {
  describe('serverSearch', () => {
    afterEach(() => vi.useRealTimers())

    it('a driver list with serverSearch sends the text to party.setSearch after the wait and does not filter here', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const party = driverParty({ setSearch: vi.fn(), search: '' })
      render(<PartyPicker party={party} serverSearch />)
      const popup = await openPicker(user, /Driver/)
      const search = within(popup).getByRole('searchbox', { name: /Search/ })
      await user.type(search, 'ana')
      expect(party.setSearch).not.toHaveBeenCalled()
      // not filtered in the client: the list is whatever the controller hands over
      expect(within(popup).getAllByRole('radio').map(radio => radio.textContent)).toEqual(['José Pérez', 'Ana Ruiz', 'Cy Díaz'])
      await vi.advanceTimersByTimeAsync(450)
      expect(party.setSearch).toHaveBeenCalledTimes(1)
      expect(party.setSearch).toHaveBeenCalledWith('ana')
      party.setSearch.mockClear()
      await user.type(search, 'x{Enter}')
      expect(party.setSearch).toHaveBeenCalledWith('anax')
    })

    it('starts from party.search, clearing sends an empty text, and no pager is added to a driver list', async () => {
      const user = userEvent.setup()
      const party = driverParty({ setSearch: vi.fn(), search: 'ru', page: 1, totalPages: 3, goToPage: vi.fn() })
      render(<PartyPicker party={party} serverSearch />)
      const popup = await openPicker(user, /Driver/)
      const search = within(popup).getByRole('searchbox', { name: /Search/ })
      expect(search).toHaveValue('ru')
      expect(within(popup).queryByRole('navigation', { name: 'Pagination' })).toBeNull()
      await user.click(within(popup).getByRole('button', { name: 'Clear search' }))
      expect(party.setSearch).toHaveBeenCalledWith('')
    })

    it('without serverSearch a driver list still filters here and never calls setSearch', async () => {
      const user = userEvent.setup()
      const party = driverParty({ setSearch: vi.fn(), search: 'zzz' })
      render(<PartyPicker party={party} />)
      const popup = await openPicker(user, /Driver/)
      const search = within(popup).getByRole('searchbox', { name: /Search/ })
      expect(search).toHaveValue('')
      await user.type(search, 'ana{Enter}')
      expect(within(popup).getAllByRole('radio').map(radio => radio.textContent)).toEqual(['Ana Ruiz'])
      expect(party.setSearch).not.toHaveBeenCalled()
    })
  })

  describe('allOption', () => {
    const allOption = { label: 'All drivers' }

    it('is the first radio, marked when nothing is chosen, with the single Tab stop', async () => {
      const user = userEvent.setup()
      render(<PartyPicker party={driverParty()} allOption={allOption} />)
      const popup = await openPicker(user, /Driver/)
      const radios = within(popup).getAllByRole('radio')
      expect(radios.map(radio => radio.textContent)).toEqual(['All drivers', 'José Pérez', 'Ana Ruiz', 'Cy Díaz'])
      expect(radios[0]).toHaveAttribute('aria-checked', 'true')
      expect(radios[0]).toHaveAttribute('tabindex', '0')
      radios.slice(1).forEach(radio => {
        expect(radio).toHaveAttribute('aria-checked', 'false')
        expect(radio).toHaveAttribute('tabindex', '-1')
      })
    })

    it('is not marked when something is chosen, and then the chosen one holds the Tab stop', async () => {
      const user = userEvent.setup()
      render(<PartyPicker party={driverParty({ selected: { id: 22, name: 'Ana Ruiz' } })} allOption={allOption} />)
      const popup = await openPicker(user, /Driver/)
      expect(within(popup).getByRole('radio', { name: 'All drivers' })).toHaveAttribute('aria-checked', 'false')
      expect(within(popup).getByRole('radio', { name: 'All drivers' })).toHaveAttribute('tabindex', '-1')
      expect(within(popup).getByRole('radio', { name: 'Ana Ruiz' })).toHaveAttribute('aria-checked', 'true')
      expect(within(popup).getByRole('radio', { name: 'Ana Ruiz' })).toHaveAttribute('tabindex', '0')
    })

    it('choosing it calls party.select(null) once and closes the popover', async () => {
      const user = userEvent.setup()
      const party = driverParty({ selected: { id: 22, name: 'Ana Ruiz' } })
      render(<PartyPicker party={party} allOption={allOption} />)
      const popup = await openPicker(user, /Driver/)
      await user.click(within(popup).getByRole('radio', { name: 'All drivers' }))
      expect(party.select).toHaveBeenCalledTimes(1)
      expect(party.select).toHaveBeenCalledWith(null)
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Driver' })).toBeNull(), EXIT)
      expect(trigger(/Driver/)).toHaveFocus()
    })

    it('Enter on it chooses it; the arrows go from it to the next option, Home and End included', async () => {
      const user = userEvent.setup()
      const party = driverParty({ selected: { id: 22, name: 'Ana Ruiz' } })
      render(<PartyPicker party={party} allOption={allOption} />)
      const popup = await openPicker(user, /Driver/)
      await user.keyboard('{ArrowDown}')
      // from the search field the focus enters on the Tab stop (the chosen one)
      expect(within(popup).getByRole('radio', { name: 'Ana Ruiz' })).toHaveFocus()
      await user.keyboard('{Home}')
      expect(within(popup).getByRole('radio', { name: 'All drivers' })).toHaveFocus()
      await user.keyboard('{ArrowDown}')
      expect(within(popup).getByRole('radio', { name: 'José Pérez' })).toHaveFocus()
      await user.keyboard('{End}')
      expect(within(popup).getByRole('radio', { name: 'Cy Díaz' })).toHaveFocus()
      await user.keyboard('{Home}{Enter}')
      expect(party.select).toHaveBeenCalledWith(null)
    })

    it('from the search field the focus enters on «All» when nothing is chosen; ArrowUp from it goes back to the search', async () => {
      const user = userEvent.setup()
      render(<PartyPicker party={driverParty()} allOption={allOption} />)
      const popup = await openPicker(user, /Driver/)
      const search = within(popup).getByRole('searchbox', { name: /Search/ })
      await user.keyboard('{ArrowDown}')
      expect(within(popup).getByRole('radio', { name: 'All drivers' })).toHaveFocus()
      await user.keyboard('{ArrowUp}')
      expect(search).toHaveFocus()
    })

    it('the search does not filter it out, and it stays when nothing else matches', async () => {
      const user = userEvent.setup()
      render(<PartyPicker party={driverParty()} allOption={allOption} />)
      const popup = await openPicker(user, /Driver/)
      const search = within(popup).getByRole('searchbox', { name: /Search/ })
      await user.type(search, 'ana')
      expect(within(popup).getAllByRole('radio').map(radio => radio.textContent)).toEqual(['All drivers', 'Ana Ruiz'])
      await user.clear(search)
      await user.type(search, 'zzz')
      expect(within(popup).getAllByRole('radio').map(radio => radio.textContent)).toEqual(['All drivers'])
      expect(within(popup).getByText('No results found')).toBeInTheDocument()
    })

    it('works in a business list too (server search): select(null) and no option without the prop', async () => {
      const user = userEvent.setup()
      const party = businessParty({ selected: { id: 2, name: 'Beta Burgers' } })
      const { unmount } = render(<PartyPicker party={party} allOption={{ label: 'All stores' }} />)
      let popup = await openPicker(user, /Business/)
      expect(within(popup).getAllByRole('radio')[0]).toHaveAccessibleName('All stores')
      await user.click(within(popup).getByRole('radio', { name: 'All stores' }))
      expect(party.select).toHaveBeenCalledWith(null)
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Business' })).toBeNull(), EXIT)
      unmount()
      document.getElementById('app-modals')?.remove()
      render(<PartyPicker party={businessParty()} />)
      popup = await openPicker(user, /Business/)
      expect(within(popup).getAllByRole('radio')).toHaveLength(3)
    })
  })

  describe('defaultOpen', () => {
    it('opens the popover when it mounts; without it, it starts closed', async () => {
      const { unmount } = render(<PartyPicker party={businessParty()} defaultOpen />)
      expect(await screen.findByRole('dialog', { name: 'Business' })).toBeInTheDocument()
      unmount()
      document.getElementById('app-modals')?.remove()
      render(<PartyPicker party={businessParty()} />)
      expect(screen.queryByRole('dialog', { name: 'Business' })).toBeNull()
    })
  })
})
