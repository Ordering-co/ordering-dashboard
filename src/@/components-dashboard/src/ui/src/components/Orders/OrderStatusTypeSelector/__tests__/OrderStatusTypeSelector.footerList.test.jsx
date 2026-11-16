/* eslint-disable import/first */
// redesign fix-qa E6: the status list of the order panel footer (the one that passes `placement`).
// It opens on the current status, marks it, and has no "Pending" twice (as a group title and as an
// option). Any other consumer keeps the list exactly as before.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useApi: () => [{ project: 'demo' }],
  useSession: () => [{ user: { level: 0 } }]
}))

vi.mock('../../../../styles/MultiSelect', () => ({ MultiSelect: () => null }))
vi.mock('../../../Shared', () => ({ Alert: () => null }))
vi.mock('../../OrderStatusRegressionModal', () => ({ OrderStatusRegressionModal: () => null }))

import { OrderStatusTypeSelector } from '..'

const scrolled = []
const original = Element.prototype.scrollIntoView

beforeEach(() => {
  scrolled.length = 0
  Element.prototype.scrollIntoView = function (options) { scrolled.push({ element: this, options }) }
})

afterEach(() => {
  Element.prototype.scrollIntoView = original
})

const open = (props = {}) => {
  const view = renderWithProviders(
    <OrderStatusTypeSelector isFirstSelect noPadding orderId={1} deliveryType={1} defaultValue={11} handleUpdateOrderStatus={vi.fn()} {...props} />
  )
  fireEvent.click(view.container.querySelector('.od-first-select-trigger'))
  return view
}

const options = () => within(screen.getByRole('listbox')).getAllByRole('option')
const pendingOptions = () => options().filter(option => option.textContent.trim() === 'Pending')

describe('the footer status list', () => {
  it('marks the current status as selected', async () => {
    open({ placement: 'auto' })
    const current = options().find(option => option.getAttribute('aria-selected') === 'true')
    expect(current).toHaveTextContent('Delivery Completed by Driver')
    expect(current).toHaveAttribute('data-selected')
  })

  it('scrolls the list to the current status when it opens', async () => {
    open({ placement: 'auto' })
    await waitFor(() => expect(scrolled.length).toBeGreaterThan(0))
    const current = options().find(option => option.getAttribute('aria-selected') === 'true')
    expect(scrolled.at(-1).element).toBe(current)
    expect(scrolled.at(-1).options).toEqual({ block: 'nearest' })
  })

  it('has a single "Pending": the option, not also a group title', () => {
    open({ placement: 'auto', defaultValue: 0 })
    expect(pendingOptions()).toHaveLength(1)
    expect(pendingOptions()[0]).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('keeps the other group titles', () => {
    open({ placement: 'auto' })
    const titles = options().filter(option => option.getAttribute('aria-disabled') === 'true').map(option => option.textContent.trim())
    expect(titles).toEqual(expect.arrayContaining(['In Progress', 'Completed', 'Cancelled']))
  })

  it('still offers every status of the order type, Pending included, in the same order', () => {
    open({ placement: 'auto', defaultValue: 0 })
    const labels = options().map(option => option.textContent.trim())
    expect(labels).toContain('Pending')
    expect(labels).toContain('Accepted by business')
    expect(labels.indexOf('Pending')).toBeLessThan(labels.indexOf('Accepted by business'))
  })

  it('does not change the list of any other consumer: the group title stays, nothing is scrolled', async () => {
    open()
    expect(pendingOptions()).toHaveLength(2)
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(scrolled).toHaveLength(0)
  })
})
