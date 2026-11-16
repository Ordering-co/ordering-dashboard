/* eslint-disable import/first */
// redesign audit-4 (P3): «Clear filters» of the bar has the control height of its neighbours (no `sm`), and
// the labels that were fixed English text go through `t()`: the dictionary of the project still wins.
import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const lang = vi.hoisted(() => ({ dictionary: {}, translations: {} }))
const recorded = vi.hoisted(() => ({ filterBar: null }))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useHistory: () => ({ push: vi.fn() })
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: lang.dictionary }, (key, text) => lang.translations[key] ?? text],
  useConfig: () => [{ configs: {}, loading: false }],
  // eslint-disable-next-line no-use-before-define
  useUtils: () => [{ parseDate: mockParseDate({}) }],
  useApi: () => [{ root: 'https://api.test' }],
  useSession: () => [{ token: 'token' }],
  OrdersFilter: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
vi.mock('../../OrdersFilterGroup', () => ({ OrdersFilterGroup: () => null }))
vi.mock('../../OrdersHeaderFilterGroup', () => ({ OrdersHeaderFilterGroup: () => null }))
vi.mock('../../../Shared/Product', async (importActual) => ({
  ...(await importActual()),
  FilterBar: (props) => {
    recorded.filterBar = props
    return <div data-testid='filter-bar'>{props.clear}{props.chips}</div>
  }
}))

import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'
import { FilterValuesContext } from '../../../../contexts/FilterValuesContext'
import { mockParseDate } from './parseDateMock'
import { OrdersFilterBar } from '..'

const EMPTY_FILTERS = { businessIds: [], driverIds: [], statuses: [], driverGroupBusinessIds: [], metafield: [], timeStatus: null }

const renderBar = (filters = EMPTY_FILTERS) => render(
  <ConfigFileContext.Provider value={[{ app_internal_name: 'ordering' }]}>
    <FilterValuesContext.Provider value={[filters, { handleFilterValues: vi.fn() }]}>
      <OrdersFilterBar
        ordersStatusGroup='pending'
        handleChangeFilterValues={vi.fn()}
        handleChangeSearch={vi.fn()}
        setTimeStatus={vi.fn()}
        filterModalOpen={false}
        setFilterModalOpen={vi.fn()}
        searchValue={null}
        driversList={{ drivers: [] }}
        driverGroupList={{ groups: [] }}
        assignableDriverGroupList={{ groups: [{ id: 3, name: 'Night' }] }}
        businessesList={{ businesses: [] }}
        paymethodsList={{ paymethods: [] }}
        adminsList={{ admins: [] }}
        citiesList={[]}
      />
    </FilterValuesContext.Provider>
  </ConfigFileContext.Provider>
)

describe('OrdersFilterBar · audit 4', () => {
  beforeEach(() => {
    recorded.filterBar = null
    lang.dictionary = {}
    lang.translations = {}
  })

  it('draws «Clear filters» at the control height: a ghost button with no small size', () => {
    renderBar({ ...EMPTY_FILTERS, businessIds: [1] })
    const clear = recorded.filterBar.clear
    expect(clear.props.children).toBe('Clear filters')
    expect(clear.props.variant).toBe('ghost')
    // `sm` is 28px; the bar's other controls are 32px.
    expect(clear.props.size).toBeUndefined()
    expect(screen.getAllByRole('button', { name: 'Clear filters' })[0]).not.toHaveAttribute('data-size', 'sm')
  })

  // redesign F1b (D-13): the chip of the assignable group reads like its pill, "Driver group" (DRIVER_GROUP); the
  // sheet field and the chip of the assigned group keep their qualifier.
  it('names the assignable driver group and the external id through t(), so they translate', () => {
    lang.translations = { DRIVER_GROUP: 'Grupo de repartidores', EXTERNAL_ID: 'ID externo' }
    renderBar({ ...EMPTY_FILTERS, driverGroupBusinessIds: [3], externalId: 'X-9' })
    const chips = screen.getByRole('list', { name: 'Active filters' })
    expect(chips).toHaveTextContent('Grupo de repartidores: Night')
    expect(chips).toHaveTextContent('ID externo: X-9')
  })

  it('falls back to the English words, with the capital D of «External ID»', () => {
    renderBar({ ...EMPTY_FILTERS, driverGroupBusinessIds: [3], externalId: 'X-9' })
    const chips = screen.getByRole('list', { name: 'Active filters' })
    // redesign F1b (D-13): no «(assignable)» on the chip
    expect(chips).toHaveTextContent('Driver group: Night')
    expect(chips).not.toHaveTextContent('(assignable)')
    expect(chips).toHaveTextContent('External ID: X-9')
    expect(chips).not.toHaveTextContent('External Id')
  })

  it('keeps the project dictionary first: its words beat t()', () => {
    lang.dictionary = { DRIVER_GROUP: 'Fleet', ORDERING_EXTERNAL_ID: 'Reference' }
    lang.translations = { DRIVER_GROUP: 'Grupo de repartidores', EXTERNAL_ID: 'ID externo' }
    renderBar({ ...EMPTY_FILTERS, driverGroupBusinessIds: [3], externalId: 'X-9' })
    const chips = screen.getByRole('list', { name: 'Active filters' })
    expect(chips).toHaveTextContent('Fleet: Night')
    expect(chips).toHaveTextContent('Reference: X-9')
  })
})
