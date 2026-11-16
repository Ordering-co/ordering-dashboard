import React from 'react'

import {
  ActionsContent as STPActionsContent,
  CardItemActionsWrapper as STPCardItemActionsWrapper,
  CardItemContent as STPCardItemContent,
  ErrorMessage as STPErrorMessage,
  OptionStripeContainer as STPOptionStripeContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Billing/BillingPaymentOptions/Stripe/styles'
import {
  ErrorMessage as SCFErrorMessage
} from '../../../src/@/components-dashboard/src/ui/src/components/Billing/BillingPaymentOptions/Stripe/CardForm/styles'

// the /ordering-products route (OrderingProducts/OrderingProductsListing,
// OrderingProductDetails, OrderingProductGeneralDetails, SiteTheme) moved onto
// Product with its own CSS; those four styles.js are gone, so their 20 nodes
// (opd-, opg-, opl-, sth-) are no longer mounted here. Only Billing/Stripe remains.

const Glyph = ({ testid }) => (
  <svg data-testid={testid} viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
)

export const BillingD1StylesFixture = () => (
  <div data-testid='billing-d1-styles' style={{ padding: 24, display: 'grid', gap: 12 }}>

    {/* Billing/BillingPaymentOptions/Stripe */}
    <STPOptionStripeContainer data-testid='stp-option-stripe-container-wrap'>
      <a className='Link' href='#top'><span className='Text' data-testid='stp-option-stripe-container-alinkspantext'>Powered by Stripe</span></a>
      <a className='Link' href='#top'><Glyph testid='stp-option-stripe-container-alinksvg' /></a>
    </STPOptionStripeContainer>
    <STPCardItemContent data-testid='stp-card-item-content-wrap'>
      <span data-testid='stp-card-item-content-span'>Visa 4242</span>
    </STPCardItemContent>
    {/* row 82 made the card ⋮ (span) and Delete (div) native buttons in PaymentCard.js and
        re-pinned l6-d1 to `button` and `> button > svg`; these nodes mirror that markup (testids per testidFor). */}
    <STPActionsContent data-testid='stp-actions-content-wrap' role='menu'>
      <button type='button' role='menuitem' className='delete' data-testid='stp-actions-content-button'>Delete</button>
    </STPActionsContent>
    <STPErrorMessage data-testid='stp-error-message-root'>Available Formats</STPErrorMessage>
    <STPCardItemActionsWrapper data-testid='stp-card-item-actions-wrapper-wrap'>
      <button type='button' aria-label='Card actions: Visa 4242' data-testid='stp-card-item-actions-wrapper-button'><Glyph testid='stp-card-item-actions-wrapper-buttonsvg' /></button>
    </STPCardItemActionsWrapper>

    {/* Billing/BillingPaymentOptions/Stripe/CardForm */}
    <SCFErrorMessage data-testid='scf-error-message-root'>Available Formats</SCFErrorMessage>
  </div>
)
