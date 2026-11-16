/* eslint-disable import/first */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign (row 92, M-C19): clearing the end date reset the wrong variable and left `deliveryEndDatetime` undefined
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test' }] }))
vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'token' }] }))

import { UsersFilter } from '..'

const mountFilter = async () => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  render(<UsersFilter UIComponent={UIComponent} />)
  await waitFor(() => expect(ui.current.loyaltyLevelState.loading).toBe(false))
  return ui
}

describe('UsersFilter · date range', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ error: false, result: [] }) })))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('formats the dates it is given', async () => {
    const ui = await mountFilter()
    await act(async () => { ui.current.handleChangeFromDate(new Date(2026, 0, 5, 10, 30, 0)) })
    await act(async () => { ui.current.handleChangeEndDate(new Date(2026, 0, 9, 18, 0, 0)) })
    expect(ui.current.filterValues.deliveryFromDatetime).toBe('2026-01-05 10:30:00')
    expect(ui.current.filterValues.deliveryEndDatetime).toBe('2026-01-09 18:00:00')
  })

  it('clearing the start date resets it to null', async () => {
    const ui = await mountFilter()
    await act(async () => { ui.current.handleChangeFromDate(new Date(2026, 0, 5, 10, 30, 0)) })
    await act(async () => { ui.current.handleChangeFromDate(null) })
    expect(ui.current.filterValues.deliveryFromDatetime).toBeNull()
  })

  it('clearing the end date resets it to null, not undefined', async () => {
    const ui = await mountFilter()
    await act(async () => { ui.current.handleChangeEndDate(new Date(2026, 0, 9, 18, 0, 0)) })
    await act(async () => { ui.current.handleChangeEndDate(null) })
    expect(ui.current.filterValues.deliveryEndDatetime).toBeNull()
  })
})
