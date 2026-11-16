/* eslint-disable import/first */
// redesign D-12 (owner, 2026-10-19): the stores of a delivery provider say how many are selected in a polite status
// line next to "Select all" / "Select none". What "Select all" marks does not change here (the list is paginated locally and it
// already selects every loaded store): the buttons call the controller exactly as before.
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from 'styled-components'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: (url) => url }]
}))

import { DeliveryServiceBusinesses } from '..'

const BUSINESSES = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `Store ${i + 1}` }))
const draw = (props = {}) => {
  const handlers = { handleSelectAllBusiness: vi.fn(), handleSelectBusiness: vi.fn() }
  render(
    <ThemeProvider theme={createDashboardTheme(theme)}>
      <DeliveryServiceBusinesses
        deliveryServiceState={{ deliveryService: { id: 5 } }}
        businesses={BUSINESSES}
        actionState={{ loading: false }}
        selectedBusinessIds={[]}
        {...handlers}
        {...props}
      />
    </ThemeProvider>
  )
  return handlers
}

// the list has other statuses (pagination); the count is the one that says «selected»
const countStatus = () => screen.getAllByRole('status').find(node => /selected/.test(node.textContent))

afterEach(cleanup)

describe('DeliveryServicesBusinesses · selection count (D-12)', () => {
  it('says how many stores are selected, singular and plural, in a polite status', () => {
    draw({ selectedBusinessIds: [] })
    expect(countStatus()).toHaveTextContent('0 stores selected')
    cleanup()
    draw({ selectedBusinessIds: [2] })
    expect(countStatus()).toHaveTextContent(/^1 store selected$/)
  })

  it('counts the whole selection, also the stores of the other local pages', () => {
    draw({ selectedBusinessIds: [1, 5, 11, 12] })
    expect(countStatus()).toHaveTextContent('4 stores selected')
  })

  it('"Select all" and "Select none" call the controller as before', async () => {
    const { handleSelectAllBusiness } = draw({ selectedBusinessIds: [1] })
    await userEvent.click(screen.getByRole('button', { name: 'Select all' }))
    expect(handleSelectAllBusiness).toHaveBeenLastCalledWith(true)
    await userEvent.click(screen.getByRole('button', { name: 'Select none' }))
    expect(handleSelectAllBusiness).toHaveBeenLastCalledWith(false)
    expect(handleSelectAllBusiness).toHaveBeenCalledTimes(2)
  })
})
