/* eslint-disable import/first */
// redesign fix-qa C3: the date chip and the Date pill write the days in the project's date format (B12),
// and a driver group can be found by its id, which the checklist shows as a muted second text (B11).
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({ configs: {} }))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useHistory: () => ({ push: vi.fn() })
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  useConfig: () => [{ configs: mockState.configs, loading: false }],
  // eslint-disable-next-line no-use-before-define
  useUtils: () => [{ parseDate: mockParseDate(mockState.configs) }],
  useApi: () => [{ root: 'https://api.test' }],
  useSession: () => [{ token: 'token' }],
  OrdersFilter: ({ UIComponent, ...props }) => <UIComponent {...props} handleChangeGroup={vi.fn()} handleChangeDriver={vi.fn()} />
}))
vi.mock('../../OrdersFilterGroup', () => ({ OrdersFilterGroup: () => null }))

import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'
import { FilterValuesContext } from '../../../../contexts/FilterValuesContext'
import { mockParseDate } from './parseDateMock'
import { OrdersFilterBar } from '..'

const EMPTY_FILTERS = { businessIds: [], driverIds: [], statuses: [], driverGroupBusinessIds: [], metafield: [], timeStatus: null }

const renderBar = ({ filters = EMPTY_FILTERS, configs = {} } = {}) => {
  mockState.configs = configs
  return render(
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
          driversList={{ loading: false, drivers: [] }}
          driverGroupList={{ groups: [] }}
          assignableDriverGroupList={{ loading: false, groups: [{ id: 3, name: 'Night' }, { id: 34, name: 'Day' }] }}
          businessesList={{ loading: false, businesses: [] }}
          paymethodsList={{ loading: false, paymethods: [] }}
          adminsList={{ loading: false, admins: [] }}
          citiesList={[]}
        />
      </FilterValuesContext.Provider>
    </ConfigFileContext.Provider>
  )
}

const term = { ...EMPTY_FILTERS, dateType: 'term', deliveryFromDatetime: '2026-09-01 00:00:00', deliveryEndDatetime: '2026-09-30 23:59:59' }

describe('OrdersFilterBar · date in the project format (C3 B12)', () => {
  beforeEach(() => { mockState.configs = {} })

  it('writes the range in the format of the project on the chip and on the Date pill', () => {
    renderBar({ filters: term, configs: { dates_general_format: { value: 'DD-MM-YYYY HH:mm' } } })
    expect(screen.getByRole('list', { name: 'Active filters' })).toHaveTextContent('Date: 01-09-2026 – 30-09-2026')
    expect(screen.getByRole('button', { name: 'Date 01-09-2026 – 30-09-2026' })).toBeInTheDocument()
  })

  it('writes a single bound in the same format', () => {
    renderBar({
      filters: { ...EMPTY_FILTERS, dateType: 'term', deliveryFromDatetime: '2026-09-01 00:00:00' },
      configs: { dates_general_format: { value: 'MM/DD/YYYY hh:mm A' } }
    })
    expect(screen.getByRole('list', { name: 'Active filters' })).toHaveTextContent('Date: From 09/01/2026')
  })

  // redesign tramo A r5 (W0-QA3-02, decision 13): ISO is never visible; with no project format the days are the visible default,
  // on the chip and on the Date pill, as in the list
  it('writes the days in the visible default when the project has no date format, never ISO', () => {
    renderBar({ filters: term })
    expect(screen.getByRole('list', { name: 'Active filters' })).toHaveTextContent('Date: 01 Sep 2026 – 30 Sep 2026')
    expect(screen.getByRole('button', { name: 'Date 01 Sep 2026 – 30 Sep 2026' })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('keeps the days that go to the API and the URL in ISO (only the text changes)', () => {
    renderBar({ filters: term })
    expect(term.deliveryFromDatetime).toBe('2026-09-01 00:00:00')
  })
})

describe('OrdersFilterBar · driver group id (C3 B11)', () => {
  // redesign F6d-1 (P4-04): the id is back (Q2-04 had removed it), labelled «ID 34»; it is searchable by its number again.
  it('finds a group by its name and by its id, and shows the id labelled', async () => {
    const user = userEvent.setup()
    renderBar({ configs: { filter_order_options: { value: 'driver_group' } } })
    // redesign fix-qa D1: the pill is named «Driver group»
    await user.click(screen.getByRole('button', { name: 'Driver group' }))
    const popup = await screen.findByRole('dialog', { name: 'Driver group' })
    const search = within(popup).getByRole('searchbox', { name: 'Search Driver group' })
    const names = () => within(popup).getAllByRole('checkbox').map(box => box.querySelector('.odc-orders-picker-name').textContent)
    await user.type(search, 'Day')
    expect(names()).toEqual(['Day'])
    expect(popup.querySelector('.odc-orders-picker-meta')).toHaveTextContent('ID 34')
    await user.clear(search)
    await user.type(search, '34')
    expect(names()).toEqual(['Day'])
    // the word «ID» is a label, not something to match: it does not bring every group
    await user.clear(search)
    await user.type(search, 'ID')
    expect(within(popup).queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('does not put the id before the name in the pill or the chip', () => {
    renderBar({
      configs: { filter_order_options: { value: 'driver_group' } },
      filters: { ...EMPTY_FILTERS, driverGroupBusinessIds: [3] }
    })
    expect(screen.getByRole('button', { name: 'Driver group Night' })).toBeInTheDocument()
    // redesign F1b (D-13): the chip reads like the pill
    expect(screen.getByRole('list', { name: 'Active filters' })).toHaveTextContent('Driver group: Night')
  })
})
