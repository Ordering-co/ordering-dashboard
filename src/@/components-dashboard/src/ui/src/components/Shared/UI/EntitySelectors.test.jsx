/* eslint-disable import/first */
import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const runtime = vi.hoisted(() => ({
  level: 0,
  cityControllerProps: null,
  firstSelectProps: null,
  multiSelectProps: null,
  levelsControllerProps: null,
  usersControllerProps: null,
  paginationProps: null,
  optimizeImage: null
}))

vi.mock('../../../../../index', () => ({
  CityList: ({ UIComponent, ...props }) => {
    runtime.cityControllerProps = { ...props, UIComponent }
    return <UIComponent {...props} />
  },
  PointsWalletLevels: ({ UIComponent, ...props }) => {
    runtime.levelsControllerProps = { ...props, UIComponent }
    return <UIComponent {...props} />
  },
  UsersList: ({ UIComponent, ...props }) => {
    runtime.usersControllerProps = { ...props, UIComponent }
    return <UIComponent {...props} />
  },
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: runtime.level } }],
  useUtils: () => [{ optimizeImage: (...args) => runtime.optimizeImage(...args) }]
}))

vi.mock('../../../styles/Select/FirstSelect', () => ({
  Select: props => {
    runtime.firstSelectProps = props
    return <div data-testid='first-select'>{props.placeholder}</div>
  }
}))

vi.mock('../../../styles/MultiSelect', () => ({
  MultiSelect: props => {
    runtime.multiSelectProps = props
    return <div data-testid='multi-select'>{props.placeholder}</div>
  }
}))

vi.mock('../SearchBar', () => ({
  SearchBar: props => (
    <input
      aria-label={props.placeholder}
      data-lazy={props.lazyLoad ? 'true' : 'false'}
      value={props.search ?? ''}
      onChange={event => props.onSearch(event.target.value)}
    />
  )
}))

vi.mock('../Pagination', () => ({
  Pagination: props => {
    runtime.paginationProps = props
    return (
      <div data-testid='pagination'>
        <button type='button' onClick={() => props.handleChangePage(2)}>Page 2</button>
        {props.handleChangePageSize && (
          <button type='button' onClick={() => props.handleChangePageSize(25)}>Page size 25</button>
        )}
      </div>
    )
  }
}))

vi.mock('react-loading-skeleton', () => ({
  default: props => <span data-testid='skeleton' style={props.style} />
}))

import { CitySelector } from './CitySelector'
import { SelectBusinesses } from './SelectBusinesses'
import { SelectLoyaltyLevels } from './SelectLoyaltyLevels'
import { SelectSites } from './SelectSites'
import { SelectUsers } from './SelectUsers'
import { entitySelectorStyle } from './entity-selector-theme'

const withBusinessDummy = currentTheme => ({
  ...currentTheme,
  images: {
    ...currentTheme.images,
    dummies: {
      ...currentTheme.images?.dummies,
      businessLogo: 'dummy-business.png'
    }
  }
})
const lightTheme = withBusinessDummy(createDashboardTheme(theme))
const darkTheme = withBusinessDummy(createDashboardTheme(theme, { mode: 'dark' }))
const rtlDarkTheme = { ...darkTheme, rtl: true }
const renderWithTheme = (content, currentTheme = lightTheme) => render(
  <ThemeProvider theme={currentTheme}>{content}</ThemeProvider>
)

beforeEach(() => {
  runtime.level = 0
  runtime.cityControllerProps = null
  runtime.firstSelectProps = null
  runtime.multiSelectProps = null
  runtime.levelsControllerProps = null
  runtime.usersControllerProps = null
  runtime.paginationProps = null
  runtime.optimizeImage = vi.fn(url => `/optimized/${url}`)
})

describe('L2d-C6 entity selectors', () => {
  it('keeps CitySelector scalar forwarding and a full-height loading surface', async () => {
    const handleChangeCity = vi.fn()
    const citiesList = { loading: false, cities: [{ id: 7, name: 'Austin' }] }
    const rendered = renderWithTheme(
      <CitySelector
        citiesList={citiesList}
        defaultValue={7}
        handleChangeCity={handleChangeCity}
        isDefault
        optionInnerMaxHeight='240px'
        position='left'
        requestMarker='forwarded'
      />
    )

    await waitFor(() => expect(runtime.firstSelectProps?.options).toHaveLength(1))
    expect(runtime.cityControllerProps.requestMarker).toBe('forwarded')
    expect(runtime.cityControllerProps.UIComponent).toEqual(expect.any(Function))
    expect(runtime.firstSelectProps).toMatchObject({
      defaultValue: 7,
      optionInnerMaxHeight: '240px',
      position: 'left'
    })
    expect(runtime.firstSelectProps.options[0].value).toBe(7)
    act(() => runtime.firstSelectProps.onChange(7))
    expect(handleChangeCity).toHaveBeenCalledWith(7, 'city_id')

    rendered.rerender(
      <ThemeProvider theme={darkTheme}>
        <CitySelector citiesList={{ loading: true, cities: [] }} handleChangeCity={handleChangeCity} isDefault />
      </ThemeProvider>
    )
    const loading = screen.getByTestId('skeleton').closest('[data-slot="city-selector-loading"]')
    expect(loading).toHaveClass('od-ui', 'od-city-selector-loading')
    expect(screen.getByTestId('skeleton')).toHaveStyle({ height: '100%' })
    expect(getComputedStyle(loading).getPropertyValue('--od-entity-selector-surface')).toBe(darkTheme.ordering.semantic.surface.default)
  })

  it('keeps CitySelector multi paging, search, callbacks, and the one-option source-list quirk', async () => {
    const handleChangeCity = vi.fn()
    const citiesList = {
      loading: false,
      cities: [
        { id: 11, name: 'North' },
        { id: 22, name: 'South' }
      ]
    }
    renderWithTheme(
      <CitySelector
        citiesList={citiesList}
        filterValues={{ cityIds: [22] }}
        handleChangeCity={handleChangeCity}
        isAddMode
        isDefault={false}
      />
    )

    await waitFor(() => expect(runtime.multiSelectProps?.options).toHaveLength(2))
    expect(runtime.multiSelectProps).toMatchObject({
      className: 'od-city-multi-select',
      defaultValue: [22],
      isHidePagecontrol: true,
      isShowSearchBar: true,
      searchBarIsCustomLayout: true,
      searchBarIsNotLazyLoad: true
    })
    expect(runtime.multiSelectProps.pagination.pageSize).toBe(5)
    act(() => runtime.multiSelectProps.handleChangePage(3))
    await waitFor(() => expect(runtime.multiSelectProps.pagination.currentPage).toBe(3))
    act(() => runtime.multiSelectProps.handleChangeSearch('south'))
    await waitFor(() => expect(runtime.multiSelectProps.options).toHaveLength(1))
    expect(runtime.multiSelectProps.pagination.currentPage).toBe(3)
    expect(handleChangeCity).toHaveBeenCalledWith(11, 'city_id')
    act(() => runtime.multiSelectProps.onChange(22))
    expect(handleChangeCity).toHaveBeenLastCalledWith(22, 'city_id')
  })

  it('keeps SelectBusinesses local filtering, row payloads, imagery, bulk actions, and add action', async () => {
    const props = {
      allBusinesses: [
        { id: 1, name: 'Alpha marketplace with a long display name', logo: 'alpha.png' },
        { id: 2, name: 'Beta', logo: null }
      ],
      handleAddClick: vi.fn(),
      handleSelectAllBusinesses: vi.fn(),
      handleSelectBusiness: vi.fn(),
      handleSelectNoneBusinesses: vi.fn(),
      handleUpdateClick: vi.fn(),
      isAddMode: true,
      isDisabled: false,
      selectedBusinessIds: []
    }
    renderWithTheme(<SelectBusinesses {...props} />)

    await screen.findByText('Alpha marketplace with a long display name')
    const root = document.querySelector('[data-entity-selector="businesses"]')
    expect(root).toHaveAttribute('data-slot', 'entity-selector')
    expect(within(root).queryAllByTestId('skeleton')).toHaveLength(0)
    expect(root.querySelector('[data-slot="entity-selector-actions"]')).toBeInTheDocument()
    expect(root.querySelectorAll('[data-slot="entity-selector-row"]')).toHaveLength(2)
    expect(root.querySelector('[data-slot="entity-selector-image"]')).toBeInTheDocument()
    expect(runtime.optimizeImage).toHaveBeenCalledWith('alpha.png', 'h_50,c_limit')
    expect(runtime.optimizeImage).toHaveBeenCalledWith(lightTheme.images.dummies.businessLogo, 'h_50,c_limit')

    fireEvent.click(screen.getByRole('checkbox', { name: 'Beta' }))
    expect(props.handleSelectBusiness).toHaveBeenCalledWith(2, true)
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select none' }))
    expect(props.handleSelectAllBusinesses.mock.calls[0]).toEqual([])
    expect(props.handleSelectNoneBusinesses.mock.calls[0]).toEqual([])

    fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), { target: { value: 'beta' } })
    await waitFor(() => expect(screen.queryByText('Alpha marketplace with a long display name')).not.toBeInTheDocument())
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.queryByTestId('pagination')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(props.handleAddClick).toHaveBeenCalledOnce()
  })

  it('keeps SelectBusinesses server search, lazy flag, paging gate, and save action', () => {
    const searchBusinesses = vi.fn()
    const handleUpdateClick = vi.fn()
    renderWithTheme(
      <SelectBusinesses
        allBusinesses={[{ id: 4, name: 'Server business', logo: 'server.png' }]}
        businessesPaginationProps={{ currentPage: 1, pageSize: 20, totalPages: 2 }}
        handleChangeBusinessPage={vi.fn()}
        handleChangeBusinessPageSize={vi.fn()}
        handleSelectAllBusinesses={vi.fn()}
        handleSelectBusiness={vi.fn()}
        handleSelectNoneBusinesses={vi.fn()}
        handleUpdateClick={handleUpdateClick}
        searchBusinesses={searchBusinesses}
        selectedBusinessIds={[]}
      />
    )

    const search = screen.getByRole('textbox', { name: 'Search' })
    expect(search).toHaveAttribute('data-lazy', 'true')
    fireEvent.change(search, { target: { value: 'query' } })
    expect(searchBusinesses).toHaveBeenCalledWith('query')
    expect(screen.getByTestId('pagination')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(handleUpdateClick).toHaveBeenCalledOnce()
  })

  // redesign bugs F opt-in `isLocked` freezes the selection controls while a save is in flight
  it('isLocked disables every checkbox and both bulk buttons; without it they are enabled', () => {
    const props = {
      allBusinesses: [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }],
      handleSelectAllBusinesses: vi.fn(),
      handleSelectBusiness: vi.fn(),
      handleSelectNoneBusinesses: vi.fn(),
      handleUpdateClick: vi.fn(),
      selectedBusinessIds: [1]
    }
    const { rerender } = renderWithTheme(<SelectBusinesses {...props} />)
    screen.getAllByRole('checkbox').forEach(box => expect(box).toBeEnabled())
    expect(screen.getByRole('button', { name: 'Select all' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Select none' })).toBeEnabled()
    rerender(<ThemeProvider theme={lightTheme}><SelectBusinesses {...props} isLocked /></ThemeProvider>)
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    screen.getAllByRole('checkbox').forEach(box => expect(box).toBeDisabled())
    expect(screen.getByRole('button', { name: 'Select all' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Select none' })).toBeDisabled()
    // the save button is still ruled by isDisabled alone
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('isDisabled keeps disabling only the save button (Marketing passes it for its own reasons)', () => {
    renderWithTheme(
      <SelectBusinesses
        allBusinesses={[{ id: 1, name: 'Alpha' }]}
        handleSelectAllBusinesses={vi.fn()}
        handleSelectBusiness={vi.fn()}
        handleSelectNoneBusinesses={vi.fn()}
        handleUpdateClick={vi.fn()}
        isDisabled
        selectedBusinessIds={[]}
      />
    )
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Alpha' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Select all' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Select none' })).toBeEnabled()
  })

  it('keeps loyalty local search, checked-first row payload, filtered select-all, and loading count', async () => {
    const props = {
      handleAddPromotion: vi.fn(),
      handleSelectAllLoyaltyLevels: vi.fn(),
      handleSelectLoyaltyLevel: vi.fn(),
      handleUpdateClick: vi.fn(),
      isAddMode: true,
      levelList: { loading: false, levels: [{ id: 5, name: 'Gold' }, { id: 6, name: 'Silver' }] },
      selectedLoyaltyLevelIds: []
    }
    const rendered = renderWithTheme(<SelectLoyaltyLevels {...props} />)

    await screen.findByText('Gold')
    expect(runtime.levelsControllerProps.UIComponent).toEqual(expect.any(Function))
    expect(document.querySelector('[data-entity-selector="loyalty-levels"]')).toHaveAttribute('data-slot', 'entity-selector')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Gold' }))
    expect(props.handleSelectLoyaltyLevel).toHaveBeenCalledWith(true, 5)
    fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), { target: { value: 'gold' } })
    await waitFor(() => expect(screen.queryByText('Silver')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select none' }))
    expect(props.handleSelectAllLoyaltyLevels).toHaveBeenNthCalledWith(1, [5])
    expect(props.handleSelectAllLoyaltyLevels).toHaveBeenNthCalledWith(2, [])
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(props.handleAddPromotion).toHaveBeenCalledOnce()

    rendered.rerender(
      <ThemeProvider theme={lightTheme}>
        <SelectLoyaltyLevels {...props} levelList={{ loading: true, levels: [] }} />
      </ThemeProvider>
    )
    expect(screen.getAllByTestId('skeleton')).toHaveLength(20)
  })

  it('keeps SelectSites zero-arg bulk actions, checked-first rows, save, and its search-only effect', async () => {
    const props = {
      allSites: [{ id: 1, name: 'Alpha site' }],
      handleAddClick: vi.fn(),
      handleSelectAllSites: vi.fn(),
      handleSelectNoneSites: vi.fn(),
      handleSelectSite: vi.fn(),
      handleUpdateClick: vi.fn(),
      selectedSitesIds: []
    }
    const rendered = renderWithTheme(<SelectSites {...props} />, rtlDarkTheme)
    await screen.findByText('Alpha site')
    const root = document.querySelector('[data-entity-selector="sites"]')
    expect(root).toHaveAttribute('data-slot', 'entity-selector')
    expect(root).toHaveAttribute('dir', 'rtl')
    expect(getComputedStyle(root).getPropertyValue('--od-entity-selector-surface')).toBe(darkTheme.ordering.semantic.surface.default)

    rendered.rerender(
      <ThemeProvider theme={rtlDarkTheme}>
        <SelectSites {...props} allSites={[{ id: 2, name: 'Beta site' }]} />
      </ThemeProvider>
    )
    expect(screen.getByText('Alpha site')).toBeInTheDocument()
    expect(screen.queryByText('Beta site')).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), { target: { value: 'beta' } })
    await screen.findByText('Beta site')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Beta site' }))
    expect(props.handleSelectSite).toHaveBeenCalledWith(true, 2)
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select none' }))
    expect(props.handleSelectAllSites.mock.calls[0]).toEqual([])
    expect(props.handleSelectNoneSites.mock.calls[0]).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(props.handleUpdateClick).toHaveBeenCalledOnce()
  })

  it('keeps SelectUsers controller/search/all/paging contracts and checked-first row payloads', async () => {
    const props = {
      getUsers: vi.fn(),
      handleAddPromotion: vi.fn(),
      handleSelectAllUsers: vi.fn(),
      handleSelectUser: vi.fn(),
      handleUpdateClick: vi.fn(),
      isAddMode: true,
      onSearch: vi.fn(),
      paginationProps: { currentPage: 1, from: 31, totalPages: 4 },
      searchValue: '',
      selectedUserIds: [],
      usersList: { loading: false, users: [{ id: 8, name: 'Ada', lastname: 'Lovelace' }] }
    }
    renderWithTheme(<SelectUsers {...props} />)

    expect(runtime.usersControllerProps).toMatchObject({
      defaultUserTypesSelected: [3],
      isSearchByUserEmail: true,
      isSearchByUserName: true,
      isSearchByUserPhone: true
    })
    expect(runtime.usersControllerProps.propsToFetch).toEqual([
      'id', 'name', 'lastname', 'email', 'phone', 'photo', 'cellphone', 'external_id',
      'country_phone_code', 'level', 'enabled', 'middle_name', 'second_lastname', 'birthdate'
    ])
    const root = document.querySelector('[data-entity-selector="users"]')
    expect(root).toHaveAttribute('data-slot', 'entity-selector')
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'All' })).toBeChecked())
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pagination')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'All' }))
    expect(props.handleSelectAllUsers).not.toHaveBeenCalled()
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ada Lovelace' }))
    expect(props.handleSelectUser).toHaveBeenCalledWith(true, 8)
    fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), { target: { value: 'ab' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), { target: { value: 'abc' } })
    expect(props.onSearch).toHaveBeenNthCalledWith(1, '')
    expect(props.onSearch).toHaveBeenNthCalledWith(2, 'abc')

    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }))
    expect(props.getUsers).toHaveBeenLastCalledWith(2, 10)
    fireEvent.click(screen.getByRole('button', { name: 'Page size 25' }))
    expect(props.getUsers).toHaveBeenLastCalledWith(2, 25)
    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }))
    expect(props.getUsers).toHaveBeenLastCalledWith(2, 25)

    fireEvent.click(screen.getByRole('checkbox', { name: 'All' }))
    expect(props.handleSelectAllUsers).toHaveBeenCalledOnce()
    expect(props.handleSelectAllUsers.mock.calls[0]).toEqual([])
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(props.handleAddPromotion).toHaveBeenCalledOnce()
  })

  it('maps Light and Dark semantic roles with CSS-ready density values', () => {
    const light = entitySelectorStyle(lightTheme)
    const dark = entitySelectorStyle(darkTheme)
    expect(light['--od-entity-selector-surface']).toBe(lightTheme.ordering.semantic.surface.default)
    expect(dark['--od-entity-selector-surface']).toBe(darkTheme.ordering.semantic.surface.default)
    expect(light['--od-entity-selector-touch-target']).toBe('44px')
    expect(light['--od-entity-selector-compact-height']).toBe('32px')
    expect(light['--od-entity-selector-focus-width']).toBe('2px')
  })
})
