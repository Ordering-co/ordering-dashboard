/* eslint-disable import/first */
// redesign stores 5.7 (G3-23, G3-26): «Delivery, pickup & more» on P/Tabs. The `?tab=` is read against the tabs this person is
// offered (every owner since main ), and a click goes through the editor's leave guard (a tab
// with unsaved work asks «Keep editing · Save · Discard» before another opens). The four tabs are stand-ins; the one that
// registers a form in the guard does it the way the real forms do (useLeaveGuard).
import React, { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LeaveDialog, LeaveGuardContext, useLeaveGuard, useLeaveGuardHost } from '../../../Shared/Product/LeaveGuard'

const env = vi.hoisted(() => ({ search: '', addQueryToUrl: null, setIsExtendExtraOpen: null }))
env.addQueryToUrl = vi.fn()

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback ?? key]
}))
vi.mock('../../../../utils', () => ({ addQueryToUrl: (...args) => env.addQueryToUrl(...args) }))
vi.mock('react-router-dom', () => ({ useLocation: () => ({ search: env.search }) }))
vi.mock('../../BusinessDeliveryDetails', () => ({
  BusinessDeliveryDetails: (props) => {
    const [dirty, setDirty] = useState(false)
    useLeaveGuard({ dirty, save: async () => ({ ok: true }), discard: () => setDirty(false) })
    return (
      <div>
        <p>Delivery body {props.business?.id}</p>
        <button type='button' onClick={() => setDirty(true)}>Edit delivery</button>
      </div>
    )
  }
}))
vi.mock('../../BusinessPickupDetails', () => ({ BusinessPickupDetails: () => <p>Pickup body</p> }))
vi.mock('../../BusinessEta', () => ({ BusinessEta: () => <p>ETA body</p> }))
vi.mock('../../BusinessDeliveryGroupsDetails', () => ({ DriversGroupsListingDetails: () => <p>Driver groups body</p> }))

import { BusinessDeliveryPickupMore } from '../index'

const Host = ({ children }) => {
  const host = useLeaveGuardHost()
  return (
    <LeaveGuardContext.Provider value={host.context}>
      {children}
      <LeaveDialog {...host.dialog} title='Save your changes?' keepLabel='Keep editing' saveLabel='Save and continue' discardLabel='Discard' closeLabel='Close' />
    </LeaveGuardContext.Provider>
  )
}

const draw = () => render(
  <Host><BusinessDeliveryPickupMore business={{ id: 7 }} setIsExtendExtraOpen={env.setIsExtendExtraOpen} /></Host>
)

beforeEach(() => {
  env.search = ''
  env.addQueryToUrl.mockClear()
  env.setIsExtendExtraOpen = vi.fn()
})
afterEach(cleanup)

describe('Delivery, pickup & more · tabs', () => {
  it('keeps the title, the four tabs and passes its props to the open one', () => {
    draw()
    expect(screen.getByRole('heading', { level: 1, name: 'Delivery, pickup & more' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Delivery', 'Pickup', 'Driver Delivery Group', 'Advanced ETA'])
    expect(screen.getByText('Delivery body 7')).toBeInTheDocument()
  })

  it('opens the tab named by ?tab= when it is offered, without rewriting the address', () => {
    env.search = '?tab=advanced_eta'
    draw()
    expect(screen.getByText('ETA body')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Advanced ETA' })).toHaveAttribute('aria-selected', 'true')
    expect(env.addQueryToUrl).not.toHaveBeenCalled()
  })

  it('opens Delivery for an unknown ?tab= and writes it back', () => {
    env.search = '?tab=nope'
    draw()
    expect(screen.getByText('Delivery body 7')).toBeInTheDocument()
    expect(env.addQueryToUrl).toHaveBeenCalledWith({ tab: 'delivery' })
  })

  // main dropped the EatStreet owner rule: ?tab=driver_delivery_group opens the driver groups for every owner
  it('?tab=driver_delivery_group opens the driver groups, with the four tabs, and writes nothing back', () => {
    env.search = '?tab=driver_delivery_group'
    draw()
    expect(screen.getByText('Driver groups body')).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Delivery', 'Pickup', 'Driver Delivery Group', 'Advanced ETA'])
    expect(env.addQueryToUrl).not.toHaveBeenCalled()
  })

  it('a clean switch is immediate, writes ?tab= and closes the extra panel', async () => {
    draw()
    env.setIsExtendExtraOpen.mockClear()
    await userEvent.click(screen.getByRole('tab', { name: 'Pickup' }))
    expect(screen.getByText('Pickup body')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(env.addQueryToUrl).toHaveBeenCalledWith({ tab: 'pickup' })
    expect(env.setIsExtendExtraOpen).toHaveBeenCalledWith(false)
  })

  it('G3-23: with unsaved work the tab does not change until Discard', async () => {
    env.search = '?tab=delivery'
    draw()
    await userEvent.click(screen.getByRole('button', { name: 'Edit delivery' }))
    await userEvent.click(screen.getByRole('tab', { name: 'Pickup' }))

    await screen.findByRole('alertdialog')
    expect(screen.queryByText('Pickup body')).toBeNull()
    expect(screen.getByText('Delivery body 7')).toBeInTheDocument()
    expect(env.addQueryToUrl).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByText('Delivery body 7')).toBeInTheDocument()
    expect(env.addQueryToUrl).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('tab', { name: 'Pickup' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(screen.getByText('Pickup body')).toBeInTheDocument()
    expect(env.addQueryToUrl).toHaveBeenCalledWith({ tab: 'pickup' })
  })
})
