/* eslint-disable import/first */
// redesign SL-F1 (A1): the filters of /stores/list: the filter bar that replaces the filter modal: search and the Type, City, Featured,
// Name and External ID pills. Each change reaches the list once, as the same object the modal sent on «Accept» (compared here with the
// BusinessFilter controller of main, replayed in legacyBusinessFilter.js), and «Clear filters» is {}.
// redesign stores 3.A: the row of business types is gone; «Type» is the first pill (P/ListPopover, still fed by the
// BusinessTypeFilter controller), «Clear filters» clears the type too, and City applies once with «Apply».
import React, { useState } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { legacyBusinessFilter } from './legacyBusinessFilter'

const mockState = vi.hoisted(() => ({
  types: [],
  typesLoading: false,
  typesError: null,
  fetchedTypes: 0,
  typesMounts: 0,
  cityListMounts: 0,
  cities: [],
  // redesign tanda AB (S-4b): a test may put a live-catalogue translation in front of the English default
  translate: null
}))

// main 581c89005: Featured is the admin's alone; these tests are an admin's unless they say otherwise
vi.mock('../../../../hooks/useFeaturedRestriction', () => ({ useFeaturedRestriction: () => mockState.featuredRestricted ?? false }))
vi.mock('../../../../../../index', async () => {
  const react = await import('react')
  return {
    useLanguage: () => [{ dictionary: {} }, (key, text) => (mockState.translate ? mockState.translate(key, text) : text)],
    // the BusinessTypeFilter controller: it hands its UIComponent the types, the selected one and the handler that tells the page
    BusinessTypeFilter: ({ UIComponent, businessTypes, defaultBusinessType, onChangeBusinessType, ...rest }) => {
      const [selected, setSelected] = react.useState(defaultBusinessType)
      react.useEffect(() => { mockState.typesMounts += 1 }, [])
      if (!businessTypes) mockState.fetchedTypes += 1
      const typesState = { loading: mockState.typesLoading, error: mockState.typesError, types: businessTypes || mockState.types }
      return (
        <UIComponent
          {...rest}
          typesState={typesState}
          currentTypeSelected={selected}
          handleChangeBusinessType={(id) => { setSelected(id); onChangeBusinessType?.(id) }}
        />
      )
    },
    // the CityList controller: it hands its UIComponent the cities
    CityList: ({ UIComponent, ...props }) => {
      mockState.cityListMounts += 1
      return <UIComponent {...props} citiesList={{ cities: mockState.cities, loading: false, error: null }} />
    }
  }
})

import { StoresFilters } from '../StoresFilters'
import { initialFilterValues } from '../storesListModel'

const TYPES = [
  { id: null, enabled: true, image: null, name: 'All' },
  { id: 1, enabled: true, image: null, name: 'Food' },
  { id: 2, enabled: true, image: null, name: 'Grocery' },
  { id: 3, enabled: false, image: null, name: 'Hidden' }
]
const CITIES = [{ id: 10, name: 'Miami' }, { id: 11, name: 'Austin' }]

// A stateful stand-in for the list controller: it keeps `filterValues` like DashboardBusinessList.
const renderFilters = (props = {}, initial = {}) => {
  const handleChangeFilterValues = vi.fn()
  const onSearch = vi.fn()
  const handleChangeBusinessType = vi.fn()
  const setBusinessTypes = vi.fn()
  const Harness = () => {
    const [filterValues, setFilterValues] = useState(initial)
    // the list controller's `types.id`: the page holds it and hands it down as `businessTypeSelected`
    const [businessTypeSelected, setBusinessTypeSelected] = useState(props.businessTypeSelected ?? null)
    return (
      <StoresFilters
        searchValue={null}
        onSearch={onSearch}
        filterValues={filterValues}
        handleChangeFilterValues={(next) => { handleChangeFilterValues(next); setFilterValues(next) }}
        setBusinessTypes={setBusinessTypes}
        {...props}
        businessTypeSelected={businessTypeSelected}
        handleChangeBusinessType={(id) => { handleChangeBusinessType(id); setBusinessTypeSelected(id) }}
      />
    )
  }
  render(<Harness />)
  return { handleChangeFilterValues, onSearch, handleChangeBusinessType, setBusinessTypes }
}

// What the old modal handed to handleChangeFilterValues after the same gestures, replayed from the BusinessFilter controller of main
const modalResult = (...gestures) => {
  const modal = legacyBusinessFilter()
  gestures.forEach(gesture => modal.change(gesture))
  return modal.values
}

const popup = (name) => screen.findByRole('dialog', { name })

beforeEach(() => {
  vi.clearAllMocks()
  mockState.featuredRestricted = false
  mockState.types = TYPES
  mockState.typesLoading = false
  mockState.typesError = null
  mockState.fetchedTypes = 0
  mockState.typesMounts = 0
  mockState.cityListMounts = 0
  mockState.cities = CITIES
})
afterEach(() => document.getElementById('app-modals')?.remove())

// redesign stores 3.A, G1-01/G1-02: the types are the first pill of the bar (P/ListPopover), not a row above it
describe('Type pill', () => {
  it('is the first pill of the bar, and the row of types is gone', () => {
    renderFilters()
    const bar = screen.getByRole('group', { name: 'Store filters' })
    const pills = within(bar).getAllByRole('button').filter(button => button.classList.contains('odc-pill'))
    expect(pills.map(pill => pill.textContent.trim()).slice(0, 2)).toEqual(['Type', 'City'])
    expect(screen.queryByRole('group', { name: 'Business type' })).toBeNull()
    expect(document.querySelector('.odc-sl-types')).toBeNull()
    expect(document.querySelector('.odc-sl-type')).toBeNull()
  })

  it('picking a type costs two clicks: open «Type», click «Grocery»; the pill then shows it', async () => {
    const user = userEvent.setup()
    const { handleChangeBusinessType } = renderFilters()
    await user.click(screen.getByRole('button', { name: 'Type' }))
    const box = await popup('Type')
    await user.click(within(box).getByRole('option', { name: 'Grocery' }))
    expect(handleChangeBusinessType).toHaveBeenCalledTimes(1)
    expect(handleChangeBusinessType).toHaveBeenLastCalledWith(2)
    expect(screen.getByRole('button', { name: /^Type\s*Grocery$/ })).toBeInTheDocument()
    expect(document.querySelector('.odc-sl-types')).toBeNull()
  })

  it('offers «All types» first and the enabled types; a type that is not enabled is not offered', async () => {
    const user = userEvent.setup()
    renderFilters()
    await user.click(screen.getByRole('button', { name: 'Type' }))
    const box = await popup('Type')
    expect(within(box).getAllByRole('option').map(option => option.textContent)).toEqual(['All types', 'Food', 'Grocery'])
    expect(within(box).queryByRole('option', { name: 'Hidden' })).toBeNull()
  })

  it('«All types» sends null', async () => {
    const user = userEvent.setup()
    const { handleChangeBusinessType } = renderFilters({ businessTypeSelected: 2 })
    await user.click(screen.getByRole('button', { name: /^Type/ }))
    const box = await popup(/Type/)
    expect(within(box).getByRole('option', { name: 'Grocery' })).toHaveAttribute('aria-selected', 'true')
    await user.click(within(box).getByRole('option', { name: 'All types' }))
    expect(handleChangeBusinessType).toHaveBeenCalledTimes(1)
    expect(handleChangeBusinessType).toHaveBeenLastCalledWith(null)
    expect(screen.getByRole('button', { name: 'Type' })).toBeInTheDocument()
  })

  it('finds a type by the name of the API too (keywords) and starts on the type the page asks for', async () => {
    const user = userEvent.setup()
    renderFilters({ businessTypeSelected: 1 })
    expect(screen.getByRole('button', { name: /^Type\s*Food$/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Type/ }))
    const box = await popup(/Type/)
    await user.type(within(box).getByRole('searchbox'), 'groc')
    expect(within(box).getAllByRole('option').map(option => option.textContent)).toEqual(['All types', 'Grocery'])
  })

  it('hands the loaded types up with setBusinessTypes, which the editor reads', () => {
    const { setBusinessTypes } = renderFilters()
    expect(setBusinessTypes).toHaveBeenCalledWith(TYPES)
  })

  it('uses the types the page already has and does not fetch them again', () => {
    renderFilters({ businessTypes: TYPES })
    expect(mockState.fetchedTypes).toBe(0)
    expect(screen.getByRole('button', { name: 'Type' })).toBeInTheDocument()
  })

  it('keeps its place while the types load, hands up nothing, and says «Loading...» when opened', async () => {
    const user = userEvent.setup()
    mockState.typesLoading = true
    mockState.types = []
    const { setBusinessTypes } = renderFilters()
    expect(setBusinessTypes).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Type' }))
    expect(within(await popup('Type')).getByText('Loading...')).toBeInTheDocument()
  })

  it('draws no pill, and says nothing, when the project has no types (an empty answer is not an error)', () => {
    mockState.types = []
    renderFilters()
    expect(screen.queryByRole('button', { name: 'Type' })).toBeNull()
    expect(screen.queryByText("We couldn't load the business types.")).toBeNull()
  })

  it('is not drawn when the project has no stores, but the filter bar is', () => {
    renderFilters({ noBusinesses: true })
    expect(screen.queryByRole('button', { name: 'Type' })).toBeNull()
    expect(screen.getByRole('group', { name: 'Store filters' })).toBeInTheDocument()
  })

  it('is drawn over a failed load of the list, whose empty list is not «no stores»', () => {
    renderFilters({ noBusinesses: true, loadFailed: true })
    expect(screen.getByRole('button', { name: 'Type' })).toBeInTheDocument()
  })

  // redesign stores 1.C, G1-03: the row used to vanish with no word when the request failed
  it('says the types could not load, with «Retry» that asks the controller for them again', async () => {
    const user = userEvent.setup()
    mockState.typesError = ['Synthetic failure']
    const { setBusinessTypes } = renderFilters()
    expect(mockState.typesMounts).toBe(1)
    await user.click(screen.getByRole('button', { name: 'Type' }))
    const box = await popup('Type')
    expect(within(box).getByText("We couldn't load the business types.")).toBeInTheDocument()
    expect(within(box).queryByRole('option', { name: 'Grocery' })).toBeNull()
    expect(within(box).getByRole('option', { name: 'All types' })).toBeInTheDocument() // «All» stays pickable
    mockState.typesError = null
    await user.click(within(box).getByRole('button', { name: 'Retry' }))
    expect(mockState.typesMounts).toBe(2)
    expect(setBusinessTypes).toHaveBeenLastCalledWith(TYPES)
    await user.click(screen.getByRole('button', { name: 'Type' }))
    expect(within(await popup('Type')).getByRole('option', { name: 'Grocery' })).toBeInTheDocument()
    expect(screen.queryByText("We couldn't load the business types.")).toBeNull()
  })

  describe('chip and «Clear filters»', () => {
    it('shows the chip «Type: Grocery» first, and removing it sends null', async () => {
      const user = userEvent.setup()
      const { handleChangeBusinessType, handleChangeFilterValues } = renderFilters({ businessTypeSelected: 2 }, { ...initialFilterValues(), cityIds: [10] })
      const list = screen.getByRole('list', { name: 'Active filters' })
      expect(within(list).getAllByRole('listitem').filter(item => !item.classList.contains('odc-chips-clear')).map(item => item.textContent.replace(/Remove.*/, ''))).toEqual(['Type: Grocery', 'City: Miami'])
      await user.click(within(list).getByRole('button', { name: 'Remove Type Grocery filter' }))
      expect(handleChangeBusinessType).toHaveBeenCalledTimes(1)
      expect(handleChangeBusinessType).toHaveBeenLastCalledWith(null)
      expect(handleChangeFilterValues).not.toHaveBeenCalled()
    })

    it('shows the id in the chip when the type is not among the loaded ones (S5)', () => {
      renderFilters({ businessTypeSelected: 99 })
      expect(within(screen.getByRole('list', { name: 'Active filters' })).getByText('Type: 99')).toBeInTheDocument()
    })

    // redesign stores 3.A, review F1: one «Clear filters» at a time is FilterBar's CSS (C7): the bar's own button on a
    // wide screen (`[data-clear]` hides the chips' one) and the chips' «clear all» on the phone, where the bar's button leaves. Both
    // are mounted (jsdom applies no CSS) and both clear the filters and the type; without the chips' one the phone had none.
    it('mounts the bar «Clear filters» and the chips «clear all» (one shown per width by FilterBar), both clearing everything', async () => {
      const user = userEvent.setup()
      const { handleChangeBusinessType, handleChangeFilterValues } = renderFilters({ businessTypeSelected: 2 }, { ...initialFilterValues(), cityIds: [10] })
      const buttons = screen.getAllByRole('button', { name: 'Clear filters' })
      expect(buttons).toHaveLength(2)
      expect(document.querySelector('.odc-filterbar').hasAttribute('data-clear')).toBe(true)
      expect(buttons.filter(button => button.closest('.odc-chips-clear') || button.classList.contains('odc-chips-clear'))).toHaveLength(1)
      await user.click(buttons.find(button => button.closest('.odc-chips-clear') || button.classList.contains('odc-chips-clear')))
      expect(handleChangeFilterValues).toHaveBeenCalledTimes(1)
      expect(handleChangeBusinessType).toHaveBeenCalledTimes(1)
    })

    it('the bar «Clear filters» clears the filters and the type, each in one call', async () => {
      const user = userEvent.setup()
      const { handleChangeBusinessType, handleChangeFilterValues } = renderFilters({ businessTypeSelected: 2 }, { ...initialFilterValues(), cityIds: [10] })
      await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0])
      expect(handleChangeFilterValues).toHaveBeenCalledTimes(1)
      expect(handleChangeFilterValues).toHaveBeenCalledWith({})
      expect(handleChangeBusinessType).toHaveBeenCalledTimes(1)
      expect(handleChangeBusinessType).toHaveBeenCalledWith(null)
      expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
      expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull()
    })

    it('with only a type on, «Clear filters» clears the type and sends no useless request of filters', async () => {
      const user = userEvent.setup()
      const { handleChangeBusinessType, handleChangeFilterValues } = renderFilters({ businessTypeSelected: 2 })
      await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0])
      expect(handleChangeBusinessType).toHaveBeenCalledTimes(1)
      expect(handleChangeBusinessType).toHaveBeenCalledWith(null)
      expect(handleChangeFilterValues).not.toHaveBeenCalled()
    })

    it('with only filters on, «Clear filters» does not touch the type', async () => {
      const user = userEvent.setup()
      const { handleChangeBusinessType, handleChangeFilterValues } = renderFilters({}, { ...initialFilterValues(), featured: true })
      await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0])
      expect(handleChangeFilterValues).toHaveBeenCalledTimes(1)
      expect(handleChangeFilterValues).toHaveBeenCalledWith({})
      expect(handleChangeBusinessType).not.toHaveBeenCalled()
    })

    // a search that finds nothing is narrowing the list too, so the bar offers the way out
    it('offers «Clear filters» with only a search on, and it clears the search and nothing else', async () => {
      const user = userEvent.setup()
      const { onSearch, handleChangeBusinessType, handleChangeFilterValues } = renderFilters({ searchValue: 'zzqqxx' })
      const buttons = screen.getAllByRole('button', { name: 'Clear filters' })
      expect(buttons).toHaveLength(1)
      await user.click(buttons[0])
      expect(onSearch).toHaveBeenCalledTimes(1)
      expect(onSearch).toHaveBeenCalledWith('')
      expect(handleChangeFilterValues).not.toHaveBeenCalled()
      expect(handleChangeBusinessType).not.toHaveBeenCalled()
    })

    it('with a search, filters and a type on, «Clear filters» clears the three', async () => {
      const user = userEvent.setup()
      const { onSearch, handleChangeBusinessType, handleChangeFilterValues } = renderFilters(
        { searchValue: 'zzqqxx', businessTypeSelected: 2 },
        { ...initialFilterValues(), cityIds: [10] }
      )
      await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0])
      expect(onSearch).toHaveBeenCalledWith('')
      expect(handleChangeFilterValues).toHaveBeenCalledWith({})
      expect(handleChangeBusinessType).toHaveBeenCalledWith(null)
    })

    it('has no «Clear filters» without a search, filters or type', () => {
      renderFilters({ searchValue: '' })
      expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
    })
  })
})

describe('search', () => {
  it('sends the text once, after the wait of main (750 ms), not per keystroke', async () => {
    const user = userEvent.setup()
    const { onSearch } = renderFilters()
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'burg')
    expect(onSearch).not.toHaveBeenCalled()
    await waitFor(() => expect(onSearch).toHaveBeenCalledTimes(1), { timeout: 3000 })
    expect(onSearch).toHaveBeenCalledWith('burg')
  })

  it('does not send before 750 ms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const { onSearch } = renderFilters()
      await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'a')
      act(() => { vi.advanceTimersByTime(700) })
      expect(onSearch).not.toHaveBeenCalled()
      act(() => { vi.advanceTimersByTime(100) })
      expect(onSearch).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('Enter sends it at once and only once', async () => {
    const user = userEvent.setup()
    const { onSearch } = renderFilters()
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'burg{Enter}')
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenCalledWith('burg')
    await act(() => new Promise(resolve => setTimeout(resolve, 900)))
    expect(onSearch).toHaveBeenCalledTimes(1)
  })

  it('«Clear search» empties it and sends «» once', async () => {
    const user = userEvent.setup()
    const { onSearch } = renderFilters({ searchValue: 'burg' })
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('burg')
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenCalledWith('')
  })
})

describe('City pill', () => {
  // redesign stores 3.A, S4: the ticks change a draft; «Apply» reaches the list once, with what the modal sent on «Accept»
  it('lists the cities; ticking two calls nothing and «Apply» sends both once, with what the modal sent', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterValues } = renderFilters()
    await user.click(screen.getByRole('button', { name: 'City' }))
    const box = await popup('City')
    expect(within(box).getAllByRole('checkbox').map(box => box.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('Miami'), expect.stringContaining('Austin')]))
    await user.click(within(box).getByRole('checkbox', { name: /Miami/ }))
    await user.click(within(box).getByRole('checkbox', { name: /Austin/ }))
    expect(within(box).getByRole('checkbox', { name: /Miami/ })).toBeChecked()
    expect(handleChangeFilterValues).not.toHaveBeenCalled()
    await user.click(within(box).getByRole('button', { name: 'Apply' }))
    expect(handleChangeFilterValues).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterValues).toHaveBeenLastCalledWith(modalResult(p => p.handleChangeCity(10), p => p.handleChangeCity(11)))
    expect(screen.queryByRole('dialog', { name: 'City' })).toBeNull() // «Apply» closes it
  })

  it('a second tick on a city removes it from the draft', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterValues } = renderFilters()
    await user.click(screen.getByRole('button', { name: 'City' }))
    const box = await popup('City')
    await user.click(within(box).getByRole('checkbox', { name: /Miami/ }))
    await user.click(within(box).getByRole('checkbox', { name: /Austin/ }))
    await user.click(within(box).getByRole('checkbox', { name: /Miami/ }))
    await user.click(within(box).getByRole('button', { name: 'Apply' }))
    expect(handleChangeFilterValues).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterValues).toHaveBeenLastCalledWith(modalResult(p => p.handleChangeCity(11)))
  })

  it('«Apply» with the draft as the applied cities does not reach the list; Escape drops the draft', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterValues } = renderFilters({}, { ...initialFilterValues(), cityIds: [10] })
    await user.click(screen.getByRole('button', { name: /^City/ }))
    await user.click(within(await popup(/City/)).getByRole('button', { name: 'Apply' }))
    expect(handleChangeFilterValues).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /^City/ }))
    await user.click(within(await popup(/City/)).getByRole('checkbox', { name: /Austin/ }))
    await user.keyboard('{Escape}')
    expect(handleChangeFilterValues).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /^City\s*Miami$/ })).toBeInTheDocument()
  })

  it('shows the city in the pill once applied: its name for one, the count for several', async () => {
    const user = userEvent.setup()
    renderFilters()
    await user.click(screen.getByRole('button', { name: 'City' }))
    await user.click(within(await popup('City')).getByRole('checkbox', { name: /Miami/ }))
    await user.click(within(await popup('City')).getByRole('button', { name: 'Apply' }))
    expect(screen.getByRole('button', { name: /^City\s*Miami$/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^City/ }))
    const box = await popup(/City/)
    await user.click(within(box).getByRole('checkbox', { name: /Austin/ }))
    await user.click(within(box).getByRole('button', { name: 'Apply' }))
    expect(screen.getByRole('button', { name: /^City\s*2$/ })).toBeInTheDocument()
  })

  it('«Clear» in the popover removes only the cities and, with nothing else on, sends {}', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterValues } = renderFilters({}, { ...initialFilterValues(), cityIds: [10] })
    await user.click(screen.getByRole('button', { name: /^City/ }))
    const box = await popup(/City/)
    await user.click(within(box).getByRole('button', { name: 'Clear' }))
    expect(handleChangeFilterValues).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterValues).toHaveBeenCalledWith({})
  })

  it('asks the CityList controller for the cities when the page does not give them', () => {
    renderFilters()
    expect(mockState.cityListMounts).toBeGreaterThan(0)
  })

  it('uses the cities of the list controller when the page gives them, with no request of its own', async () => {
    const user = userEvent.setup()
    renderFilters({ citiesList: [{ id: 99, name: 'Lima' }] })
    expect(mockState.cityListMounts).toBe(0)
    await user.click(screen.getByRole('button', { name: 'City' }))
    const box = await popup('City')
    expect(within(box).getByRole('checkbox', { name: /Lima/ })).toBeInTheDocument()
  })
})

describe('Featured pill', () => {
  it('is not offered to anyone but an admin, nor its chip (main 581c89005)', () => {
    mockState.featuredRestricted = true
    renderFilters({}, { ...initialFilterValues(), featured: true })
    expect(screen.queryByRole('button', { name: /^Featured/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove Featured Yes filter' })).toBeNull()
  })

  it('Yes and No each send what the select sent (true / false), one call per choice', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterValues } = renderFilters()
    await user.click(screen.getByRole('button', { name: 'Featured' }))
    const box = await popup('Featured')
    await user.click(within(box).getByRole('radio', { name: 'Yes' }))
    expect(handleChangeFilterValues).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterValues).toHaveBeenLastCalledWith(modalResult(p => p.handleChangeValue({ featured: true })))
    await user.click(within(box).getByRole('radio', { name: 'No' }))
    expect(handleChangeFilterValues).toHaveBeenCalledTimes(2)
    expect(handleChangeFilterValues).toHaveBeenLastCalledWith(modalResult(p => p.handleChangeValue({ featured: false })))
    expect(screen.getByRole('button', { name: /^Featured\s*No$/ })).toBeInTheDocument()
  })

  it('«Clear» sends {} when it was the only filter', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterValues } = renderFilters({}, { ...initialFilterValues(), featured: true })
    await user.click(screen.getByRole('button', { name: /^Featured/ }))
    const box = await popup(/Featured/)
    expect(within(box).getByRole('radio', { name: 'Yes' })).toHaveAttribute('aria-checked', 'true')
    await user.click(within(box).getByRole('button', { name: 'Clear' }))
    expect(handleChangeFilterValues).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterValues).toHaveBeenCalledWith({})
  })
})

describe.each([
  ['Name', 'name'],
  ['External ID', 'externalId']
])('%s pill', (label, key) => {
  it('applies the text with Enter, once, with what the modal sent', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterValues } = renderFilters()
    await user.click(screen.getByRole('button', { name: label }))
    const box = await popup(label)
    await user.type(within(box).getByRole('textbox', { name: label }), 'ab12{Enter}')
    expect(handleChangeFilterValues).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterValues).toHaveBeenCalledWith(modalResult(p => p.handleChangeValue({ [key]: 'ab12' })))
    expect(screen.getByRole('button', { name: new RegExp(`^${label}\\s*ab12$`) })).toBeInTheDocument()
  })

  it('applies the text with «Apply», and not while it is only typed', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterValues } = renderFilters()
    await user.click(screen.getByRole('button', { name: label }))
    const box = await popup(label)
    await user.type(within(box).getByRole('textbox', { name: label }), 'xy')
    expect(handleChangeFilterValues).not.toHaveBeenCalled()
    await user.click(within(box).getByRole('button', { name: 'Apply' }))
    expect(handleChangeFilterValues).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterValues).toHaveBeenCalledWith(modalResult(p => p.handleChangeValue({ [key]: 'xy' })))
  })

  // redesign stores 1.C, G1-06: «Apply» with nothing to change used to send a new {} and refetch the list
  it('«Apply» with nothing typed and nothing applied does not reach the list', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterValues } = renderFilters()
    await user.click(screen.getByRole('button', { name: label }))
    const box = await popup(label)
    await user.click(within(box).getByRole('button', { name: 'Apply' }))
    await user.type(within(box).getByRole('textbox', { name: label }), '   {Enter}')
    expect(handleChangeFilterValues).not.toHaveBeenCalled()
  })

  it('«Apply» of the text already applied does not reach the list', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterValues } = renderFilters({}, { ...initialFilterValues(), [key]: 'old' })
    await user.click(screen.getByRole('button', { name: new RegExp(`^${label}`) }))
    const box = await popup(new RegExp(label))
    await user.click(within(box).getByRole('button', { name: 'Apply' }))
    expect(handleChangeFilterValues).not.toHaveBeenCalled()
  })

  it('starts from the applied text, and «Clear» removes it and sends {} when it was the only filter', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterValues } = renderFilters({}, { ...initialFilterValues(), [key]: 'old' })
    await user.click(screen.getByRole('button', { name: new RegExp(`^${label}`) }))
    const box = await popup(new RegExp(label))
    expect(within(box).getByRole('textbox', { name: label })).toHaveValue('old')
    await user.click(within(box).getByRole('button', { name: 'Clear' }))
    expect(handleChangeFilterValues).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterValues).toHaveBeenCalledWith({})
  })

  it('an emptied text goes back to null in the shape, and keeps the other filters', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterValues } = renderFilters({}, { ...initialFilterValues(), [key]: 'old', featured: true })
    await user.click(screen.getByRole('button', { name: new RegExp(`^${label}`) }))
    const box = await popup(new RegExp(label))
    await user.clear(within(box).getByRole('textbox', { name: label }))
    await user.click(within(box).getByRole('button', { name: 'Apply' }))
    expect(handleChangeFilterValues).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterValues).toHaveBeenCalledWith({ ...initialFilterValues(), featured: true })
  })
})

describe('together', () => {
  it('several filters make one object, as the modal did on a single Accept', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterValues } = renderFilters()
    await user.click(screen.getByRole('button', { name: 'Featured' }))
    await user.click(within(await popup('Featured')).getByRole('radio', { name: 'Yes' }))
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: /^Name/ }))
    await user.type(within(await popup(/Name/)).getByRole('textbox', { name: 'Name' }), 'bur{Enter}')
    expect(handleChangeFilterValues).toHaveBeenCalledTimes(2)
    expect(handleChangeFilterValues).toHaveBeenLastCalledWith(modalResult(p => p.handleChangeValue({ featured: true, name: 'bur' })))
  })

  it('Clear filters is not there with no filter and sends {} when there is one', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterValues } = renderFilters({}, { ...initialFilterValues(), featured: false, cityIds: [10] })
    expect(screen.getAllByRole('button', { name: 'Clear filters' })).toHaveLength(2) // redesign stores 3.A, review F1: the bar's and the chips' (FilterBar's CSS shows one per width)
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0])
    expect(handleChangeFilterValues).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterValues).toHaveBeenCalledWith({})
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
  })

  it('does not offer Clear filters for {} or for the empty shape', () => {
    renderFilters({}, {})
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
  })

  it('shows one chip per value and removing one sends the rest', async () => {
    const user = userEvent.setup()
    const { handleChangeFilterValues } = renderFilters({}, { ...initialFilterValues(), cityIds: [10, 11], featured: true, name: 'bur' })
    const list = screen.getByRole('list', { name: 'Active filters' })
    expect(within(list).getAllByRole('listitem').map(item => item.textContent.replace(/Remove.*/, ''))).toEqual(
      expect.arrayContaining(['City: Miami', 'City: Austin', 'Featured: Yes', 'Name: bur'])
    )
    await user.click(within(list).getByRole('button', { name: 'Remove City Miami filter' }))
    expect(handleChangeFilterValues).toHaveBeenCalledTimes(1)
    expect(handleChangeFilterValues).toHaveBeenLastCalledWith({ ...initialFilterValues(), cityIds: [11], featured: true, name: 'bur' })
    await user.click(screen.getByRole('button', { name: 'Remove Featured Yes filter' }))
    expect(handleChangeFilterValues).toHaveBeenLastCalledWith({ ...initialFilterValues(), cityIds: [11], name: 'bur' })
  })
})

// redesign stores 3.B: the column manager of the table is a tool of this bar (it had a row of its own)
describe('tools', () => {
  it('draws what it is given at the end of the bar', () => {
    renderFilters({ citiesList: CITIES, tools: <button type='button'>Manage columns</button> })
    const bar = screen.getByRole('button', { name: 'Manage columns' }).closest('.odc-filterbar')
    expect(bar).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Manage columns' }).closest('.odc-filterbar-tools')).not.toBeNull()
  })

  it('without it the bar has no tools, as before', () => {
    const { container } = render(
      <StoresFilters searchValue={null} onSearch={vi.fn()} filterValues={{}} handleChangeFilterValues={vi.fn()} setBusinessTypes={vi.fn()} citiesList={CITIES} />
    )
    expect(container.querySelector('.odc-filterbar-tools')).toBeNull()
    expect(container.querySelector('.odc-filterbar')).not.toHaveAttribute('data-tools')
  })
})

// redesign tanda AB (S-4b): the live catalogue says «External Id» for EXTERNAL_ID; the stores' filter has its own key, STORE_EXTERNAL_ID («External ID»)
describe('StoresFilters · the External ID pill (S-4b)', () => {
  afterEach(() => { mockState.translate = null })

  it('does not take the live catalogue\'s «External Id» of EXTERNAL_ID', () => {
    mockState.translate = (key, text) => (key === 'EXTERNAL_ID' ? 'External Id' : text)
    renderFilters()
    expect(screen.getByRole('button', { name: 'External ID' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'External Id' })).toBeNull()
  })
})
