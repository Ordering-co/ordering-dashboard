/* eslint-disable import/first */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../index.js', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: { name: 'Ada' } }]
}))

import { Banners, BannerStack } from '..'

// redesign (R2): the past-due notice on Product (InlineNotice danger + Button), same copy, same click.
describe('Banners', () => {
  it('renders the past-due message and opens the billing payment flow', () => {
    const setShowBillingPayment = vi.fn()

    renderWithProviders(<Banners setShowBillingPayment={setShowBillingPayment} />)

    fireEvent.click(screen.getByRole('button', { name: 'Pay now' }))

    expect(screen.getByText('Hey Ada, we have a problem, your account is past due.')).toBeInTheDocument()
    expect(setShowBillingPayment).toHaveBeenCalledWith(expect.any(Function))
    expect(setShowBillingPayment.mock.calls[0][0]({ open: false })).toEqual({
      open: true,
      from: 'past_due'
    })
  })

  it('is a danger notice with the alert role, the title above the body and the action beside them', () => {
    renderWithProviders(<Banners setShowBillingPayment={vi.fn()} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('data-tone', 'danger')
    expect(alert).toHaveClass('odc-notice')
    expect(alert.querySelector('.odc-shell-notice-title')).toHaveTextContent('Hey Ada, we have a problem, your account is past due.')
    expect(alert.querySelector('.odc-shell-notice-body')).toHaveTextContent('There appears to be an issue with your payment. Kindly update the card on file and complete your payment.')
    expect(alert.querySelector('svg')).not.toBeNull()
    expect(alert.querySelector('.odc-notice-action')).toContainElement(screen.getByRole('button', { name: 'Pay now' }))
    expect(screen.getByRole('button', { name: 'Pay now' })).toHaveAttribute('data-variant', 'primary')
  })
})

describe('BannerStack', () => {
  it('renders its children inside the sticky stack container', () => {
    const { container } = renderWithProviders(<BannerStack data-testid='stack'><p>Child</p></BannerStack>)

    const stack = screen.getByTestId('stack')
    expect(stack).toHaveClass('odc-root', 'odc-banner-stack')
    expect(stack).toContainElement(screen.getByText('Child'))
    expect(container.querySelectorAll('.odc-banner-stack')).toHaveLength(1)
  })

  it('renders an empty container (no children) that the stylesheet hides', () => {
    renderWithProviders(<BannerStack data-testid='stack'>{null}</BannerStack>)

    const stack = screen.getByTestId('stack')
    expect(stack).toBeEmptyDOMElement()
    expect(stack).toHaveClass('odc-banner-stack')
  })
})

// the stack is sticky at the top of the page, so the menu has to start under it. The stack says how tall it is
// (a CSS variable on the root, read by sidebar.css) and takes it back when it leaves.
describe('BannerStack · publishes its height for the menu', () => {
  const VAR = '--odc-shell-banner-block'
  const observers = []
  class FakeResizeObserver {
    constructor (callback) { this.callback = callback; observers.push(this) }
    observe () {}
    unobserve () {}
    disconnect () { this.disconnected = true }
  }
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    observers.length = 0
    document.documentElement.style.removeProperty(VAR)
  })

  it('sets the variable to the stack height, follows it, and removes it on unmount', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    let height = 63
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const h = this.classList?.contains('odc-banner-stack') ? height : 0
      return { top: 0, bottom: h, left: 0, right: 0, width: 0, height: h, x: 0, y: 0 }
    })
    const { unmount } = renderWithProviders(<BannerStack><p>Past due</p></BannerStack>)
    expect(document.documentElement.style.getPropertyValue(VAR)).toBe('63px')

    height = 110
    observers.forEach(observer => observer.callback([]))
    expect(document.documentElement.style.getPropertyValue(VAR)).toBe('110px')

    unmount()
    expect(observers.every(observer => observer.disconnected)).toBe(true)
    expect(document.documentElement.style.getPropertyValue(VAR)).toBe('')
  })

  it('publishes 0 for an empty stack, which the stylesheet hides', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    renderWithProviders(<BannerStack>{null}</BannerStack>)
    expect(document.documentElement.style.getPropertyValue(VAR)).toBe('0px')
  })
})
