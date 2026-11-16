/* eslint-disable import/first */
// redesign reviews FA2 (D6, D7, auditor 1, 2, 5): the opt-in props of `StorePicker` (`includeInactive`, `allLabel`, `defaultOpen`,
// `label`, `placeholder`). The business list is a mocked `DashboardBusinessList` that records the props it is given; without the
// props the picker is what /intelligence/business-payments has (the specs of `BusinessPaymentReports` are its proof).
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ mounts: 0, listProps: null, empty: false, user: { level: 0 }, configs: {}, emit: null }))

vi.mock('../../../../../../index', async () => {
  const ReactModule = await import('react')
  const BUSINESSES = [
    { id: 5, name: 'Alpha Pizza', slug: 'alpha', logo: null, city: { name: 'Miami' }, external_id: 'ext-5' },
    { id: 6, name: 'Beta Burgers', slug: 'beta', logo: null, city: { name: 'Austin' }, external_id: null }
  ]
  return {
    useLanguage: () => [{ language: { code: 'en' }, dictionary: {} }, (_key, text) => text],
    useUtils: () => [{ optimizeImage: (url) => url }],
    useSession: () => [{ user: state.user }],
    useConfig: () => [{ configs: state.configs }],
    useEvent: () => [{ emit: (...args) => state.emit(...args) }],
    DashboardBusinessList: (props) => {
      ReactModule.useEffect(() => { state.mounts += 1 }, [])
      state.listProps = props
      const { UIComponent, ...rest } = props
      return ReactModule.createElement(UIComponent, {
        ...rest,
        businessList: { loading: false, error: null, businesses: state.empty ? [] : BUSINESSES },
        pagination: { currentPage: 1, pageSize: 6, totalPages: 1, total: 2 },
        searchValue: null,
        onSearch: () => {},
        getPageBusinesses: () => {}
      })
    }
  }
})

import { StorePicker } from '../StorePicker'

const ALPHA = { id: 5, name: 'Alpha Pizza', external_id: 'ext-5' }

const makeBusiness = (over = {}) => ({ selected: null, select: vi.fn(), restoring: false, ...over })

const EXIT = { timeout: 4000 }
const trigger = (name) => screen.getByRole('button', { name })
const openPicker = async (user, name) => {
  await user.click(trigger(name))
  return screen.findByRole('dialog', { name })
}

beforeEach(() => {
  vi.clearAllMocks()
  state.mounts = 0
  state.listProps = null
  state.empty = false
  state.user = { level: 0 }
  state.configs = {}
  state.emit = vi.fn()
})
afterEach(() => document.getElementById('app-modals')?.remove())

describe('StorePicker · as it was', () => {
  it('asks for the enabled businesses only (no noActiveStatusCondition) and is called «Business» / «Select business»', async () => {
    const user = userEvent.setup()
    render(<StorePicker business={makeBusiness()} />)
    expect(trigger(/Business/)).toHaveAccessibleName('Business Select business')
    const popup = await openPicker(user, /Business/)
    expect(state.listProps).toBeTruthy()
    expect(state.listProps.noActiveStatusCondition).toBeFalsy()
    expect(within(popup).getAllByRole('radio').map(radio => radio.querySelector('.odc-radio-text').textContent)).toEqual(['Alpha PizzaMiami', 'Beta BurgersAustin'])
    expect(within(popup).queryByRole('radio', { name: /All/ })).toBeNull()
  })

  it('choosing a store hands the whole business object remembered from the list to business.select', async () => {
    const user = userEvent.setup()
    const business = makeBusiness()
    render(<StorePicker business={business} />)
    const popup = await openPicker(user, /Business/)
    await user.click(within(popup).getByRole('radio', { name: 'Alpha Pizza' }))
    expect(business.select).toHaveBeenCalledTimes(1)
    expect(business.select.mock.calls[0][0]).toMatchObject({ id: 5, name: 'Alpha Pizza', external_id: 'ext-5' })
  })

  it('does not open by itself', () => {
    render(<StorePicker business={makeBusiness()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(state.mounts).toBe(0)
  })
})

describe('StorePicker · includeInactive', () => {
  it('hands noActiveStatusCondition to DashboardBusinessList', async () => {
    const user = userEvent.setup()
    render(<StorePicker business={makeBusiness()} includeInactive />)
    await openPicker(user, /Business/)
    expect(state.listProps.noActiveStatusCondition).toBe(true)
  })

  it('without it, the prop is not handed over', async () => {
    const user = userEvent.setup()
    render(<StorePicker business={makeBusiness()} />)
    await openPicker(user, /Business/)
    expect('noActiveStatusCondition' in state.listProps).toBe(false)
  })
})

describe('StorePicker · allLabel', () => {
  it('the pill says it while no store is chosen, and the list starts with it, marked', async () => {
    const user = userEvent.setup()
    render(<StorePicker business={makeBusiness()} allLabel='All stores' />)
    expect(trigger(/Business/)).toHaveAccessibleName('Business All stores')
    const popup = await openPicker(user, /Business/)
    const radios = within(popup).getAllByRole('radio')
    expect(radios[0]).toHaveAccessibleName('All stores')
    expect(radios[0]).toHaveAttribute('aria-checked', 'true')
    expect(radios).toHaveLength(3)
  })

  it('with a store chosen, the pill says its name and «All stores» is not marked', async () => {
    const user = userEvent.setup()
    render(<StorePicker business={makeBusiness({ selected: ALPHA })} allLabel='All stores' />)
    expect(trigger(/Business/)).toHaveAccessibleName('Business Alpha Pizza')
    const popup = await openPicker(user, /Business/)
    expect(within(popup).getByRole('radio', { name: 'All stores' })).toHaveAttribute('aria-checked', 'false')
  })

  it('choosing «All stores» calls business.select(null) and closes', async () => {
    const user = userEvent.setup()
    const business = makeBusiness({ selected: ALPHA })
    render(<StorePicker business={business} allLabel='All stores' />)
    const popup = await openPicker(user, /Business/)
    await user.click(within(popup).getByRole('radio', { name: 'All stores' }))
    expect(business.select).toHaveBeenCalledTimes(1)
    expect(business.select).toHaveBeenCalledWith(null)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Business' })).toBeNull(), EXIT)
  })

  it('while the store of the URL is being read, the pill says «Loading», not «All stores»', () => {
    render(<StorePicker business={makeBusiness({ restoring: true })} allLabel='All stores' />)
    expect(trigger(/Business/)).toHaveAccessibleName('Business Loading')
  })
})

describe('StorePicker · defaultOpen, label and placeholder', () => {
  it('defaultOpen opens the popover on mount and mounts the list', async () => {
    render(<StorePicker business={makeBusiness()} defaultOpen />)
    expect(await screen.findByRole('dialog', { name: 'Business' })).toBeInTheDocument()
    expect(state.mounts).toBeGreaterThan(0)
  })

  it('label and placeholder replace «Business» and «Select business»', async () => {
    const user = userEvent.setup()
    render(<StorePicker business={makeBusiness()} label='Store' placeholder='Pick a store' />)
    expect(trigger(/Store/)).toHaveAccessibleName('Store Pick a store')
    const popup = await openPicker(user, /Store/)
    expect(within(popup).getByRole('radiogroup', { name: 'Store' })).toBeInTheDocument()
  })

  it('the placeholder of its own shows only while no store is chosen', () => {
    render(<StorePicker business={makeBusiness({ selected: ALPHA })} placeholder='Pick a store' />)
    expect(trigger(/Business/)).toHaveAccessibleName('Business Alpha Pizza')
  })
})

// J2 (D-18, ): «No results found» offers the one «Add new store» of the dashboard (/stores/add), with the rule of the
// store list (`canRegisterStores`); in main this picker's button threw a TypeError (business-payments D10, P5).
describe('StorePicker · Add new store', () => {
  it('with no store in the list it offers «Add new store», which closes the picker and goes to the store add', async () => {
    state.empty = true
    const user = userEvent.setup()
    render(<StorePicker business={makeBusiness()} />)
    const popup = await openPicker(user, /Business/)
    expect(within(popup).getByText('No results found')).toBeInTheDocument()
    await user.click(within(popup).getByRole('button', { name: 'Add new store' }))
    expect(state.emit).toHaveBeenCalledWith('go_to_page', { page: 'business_add' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Business/ })).toBeNull(), EXIT)
  })

  it('does not offer it while there are stores', async () => {
    const user = userEvent.setup()
    render(<StorePicker business={makeBusiness()} />)
    const popup = await openPicker(user, /Business/)
    expect(within(popup).queryByRole('button', { name: 'Add new store' })).toBeNull()
  })

  it('does not offer it to a store owner when the project turned owner registration off', async () => {
    state.empty = true
    state.user = { level: 2 }
    state.configs = { allow_business_owner_register_business: { value: '0' } }
    const user = userEvent.setup()
    render(<StorePicker business={makeBusiness()} />)
    const popup = await openPicker(user, /Business/)
    expect(within(popup).getByText('No results found')).toBeInTheDocument()
    expect(within(popup).queryByRole('button', { name: 'Add new store' })).toBeNull()
  })
})
