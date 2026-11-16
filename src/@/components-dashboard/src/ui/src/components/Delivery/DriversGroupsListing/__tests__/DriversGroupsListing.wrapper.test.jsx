/* eslint-disable import/first */
// redesign DG-B5 (decision 1): `Delivery/DriversGroupsListing` keeps its export, its wrapper and its `paginationSettings`, and mounts the
// controller (K/DriversGroupsList) with the new UI (`DriversGroupsDirectory/DriversGroupsListing`). The old UI is gone from this file.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const seen = vi.hoisted(() => ({ controller: null }))

vi.mock('../../../../../../index', () => ({
  DriversGroupsList: (props) => {
    seen.controller = props
    return <div data-testid='controller' />
  }
}))

vi.mock('../../DriversGroupsDirectory/DriversGroupsListing', () => ({
  DriversGroupsListingUI: () => <div data-testid='new-ui' />
}))

import { DriversGroupsListingUI } from '../../DriversGroupsDirectory/DriversGroupsListing'
import { DriversGroupsListing } from '../index'

afterEach(() => {
  cleanup()
  seen.controller = null
})

const mount = (props = {}, route = '/delivery/drivers-groups') => render(
  <MemoryRouter initialEntries={[route]}>
    <DriversGroupsListing {...props} />
  </MemoryRouter>
)

describe('Delivery/DriversGroupsListing (the export the page imports)', () => {
  it('mounts the controller with the new UI, asking for the managers as main did, and passes the page props on', () => {
    mount({ isUseQuery: true, extra: 'x' })
    expect(seen.controller.UIComponent).toBe(DriversGroupsListingUI)
    expect(seen.controller).toMatchObject({ isDriversMangersRequired: true, isUseQuery: true, extra: 'x' })
  })

  it('takes the page and the page size of the address when the page uses the query', () => {
    mount({ isUseQuery: true }, '/delivery/drivers-groups?page=3&pageSize=25')
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 3, pageSize: 25, controlType: 'pages' })
  })

  it('starts at page 1 with 10 rows without the query, with no address or with a page that is not a number', () => {
    mount({ isUseQuery: false }, '/delivery/drivers-groups?page=3&pageSize=25')
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 1, pageSize: 10, controlType: 'pages' })
    cleanup()
    mount({ isUseQuery: true })
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 1, pageSize: 10, controlType: 'pages' })
    cleanup()
    mount({ isUseQuery: true }, '/delivery/drivers-groups?page=abc&pageSize=25')
    expect(seen.controller.paginationSettings).toEqual({ initialPage: 1, pageSize: 10, controlType: 'pages' })
  })

  it('no longer carries the old UI (the side bar, the generic Confirm, the list and the add form of main)', () => {
    const source = readFileSync(resolve(__dirname, '../index.js'), 'utf8')
    expect(source).not.toMatch(/const DriversGroupsListingUI/)
    expect(source).not.toMatch(/SideBar|Confirm|SearchBar|DriversGroupAddForm|DriversGroupDetails/)
  })
})
