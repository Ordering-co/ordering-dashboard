import React from 'react'

import {
  Container as CashWalletContainer,
  Tabs as CashWalletTabs,
  Tab as CashWalletTab
} from '../../../src/@/components-dashboard/src/ui/src/components/Users/CustomerCashWallet/styles'
import {
  WalletBalaceContainer,
  SectionContainer as CashWalletDetailsSectionContainer,
  FormController as CashWalletDetailsFormController
} from '../../../src/@/components-dashboard/src/ui/src/components/Users/CustomerCashWalletDetails/styles'
import {
  HeaderContainer,
  LeftHeader,
  VerifiedItem,
  ActionSelectorWrapper,
  OptionMenu
} from '../../../src/@/components-dashboard/src/ui/src/components/Users/CustomerDetails/styles'
import {
  Container as PointsContainer,
  EqualWrapper,
  PointsWrapper,
  LevelWrapper,
  Tabs as PointsTabs,
  Tab as PointsTab,
  LoyaltyLevel,
  LoyaltyLevelContent,
  SectionContainer as PointsSectionContainer,
  FormController as PointsFormController
} from '../../../src/@/components-dashboard/src/ui/src/components/Users/CustomerPointsWallet/styles'
import {
  TransactionHeader,
  TransactionDescription,
  Amount,
  TransactionCode
} from '../../../src/@/components-dashboard/src/ui/src/components/Users/CustomerWalletEvents/styles'
import { VerifiedStatusFilterContainer } from '../../../src/@/components-dashboard/src/ui/src/components/Users/CustomersListing/styles'

// Presentation-only fixture: the real Users (customers) styled surfaces, no
// controller, SDK, account or network. Every interactive node here is a
// native <button> with an accessible name.
//
// NOTE: while this fixture was being scaffolded, these same six styles.js
// files were concurrently edited on disk (their font-size literals replaced
// with `var(--od-type-*-size)`, plus added `:focus-visible` rings and
// `(pointer: coarse)` touch-target minimums on Tab and OptionMenu). None of
// that changed any export name or JSX nesting, so it does not affect what is
// mounted below, but it does mean the literal px values named in the source
// comments/history are already gone from styles.js by the time this file
// lands — see the coordinator note in the scaffold-fixture report for this
// batch.
//
// Real-nesting adaptations (checked against each source styles.js before
// mounting, per the a2 batch lesson):
// - CustomerDetails/styles.js scopes `span.customer-name` under LeftHeader
//   (`LeftHeader { span.customer-name { font-size: ... } }`), not under
//   HeaderContainer directly, so LeftHeader is mounted between them even
//   though it was not itself in the named list.
// - CustomerDetails/styles.js's ActionSelectorWrapper rule is
//   `> div { > div { .dropdown-item { font-size: ... } } }`: two nested
//   direct-child divs (mirroring react-bootstrap's Dropdown wrapper + menu)
//   are required before `.dropdown-item`, and it is a sibling of the
//   `button` rule, not a descendant of it.
// - CustomerPointsWallet/styles.js's `h3` font-size is declared on
//   LoyaltyLevelContent, not on LoyaltyLevel (LoyaltyLevel only owns its own
//   `h2` rule). LoyaltyLevelContent is mounted nested inside LoyaltyLevel to
//   match the real component's markup.
// - CustomerDetails/styles.js's OptionMenu now carries button-reset CSS
//   (appearance/background/border/text-align/width resets) and the real
//   CustomerDetails/index.js renders it `as='button' type='button'
//   aria-pressed={...}`, so it is mounted here the same way rather than as a
//   plain div.
export const UsersA2StylesFixture = () => {
  return (
    <main data-testid='users-a2-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>
      <CashWalletContainer data-testid='cash-wallet-container'>
        <h1 data-testid='cash-wallet-title'>Cash wallet</h1>
        <CashWalletTabs data-testid='cash-wallet-tabs'>
          <CashWalletTab as='button' type='button' active aria-pressed='true' data-testid='cash-wallet-tab-active'>Cash wallet</CashWalletTab>
          <CashWalletTab as='button' type='button' aria-pressed='false' data-testid='cash-wallet-tab-inactive'>Transaction history</CashWalletTab>
        </CashWalletTabs>
      </CashWalletContainer>

      <WalletBalaceContainer data-testid='wallet-balance'>
        <span data-testid='wallet-balance-amount'>$120.00</span>
        <span data-testid='wallet-balance-currency'>Wallet money</span>
      </WalletBalaceContainer>

      <CashWalletDetailsSectionContainer data-testid='cash-wallet-details-section'>
        <p data-testid='cash-wallet-details-section-title'>Add wallet money</p>
      </CashWalletDetailsSectionContainer>

      <CashWalletDetailsFormController data-testid='cash-wallet-details-form-controller'>
        <label htmlFor='fixture-cash-wallet-amount' data-testid='cash-wallet-details-form-label'>Indicate the amount to add</label>
        <input id='fixture-cash-wallet-amount' type='number' aria-label='Amount' data-testid='cash-wallet-details-form-input' />
        <textarea aria-label='Comment' rows={3} data-testid='cash-wallet-details-form-textarea' />
      </CashWalletDetailsFormController>

      <HeaderContainer data-testid='customer-header'>
        <LeftHeader data-testid='customer-left-header'>
          <span className='customer-name' data-testid='customer-name'>Ada Lovelace</span>
          <VerifiedItem data-testid='customer-verified'>
            <svg data-testid='customer-verified-icon' viewBox='0 0 16 16' width='12' height='12' aria-hidden='true' focusable='false'><path d='M3 8l3 3 7-7' fill='none' stroke='currentColor' strokeWidth='2' /></svg>
            <span data-testid='customer-verified-label'>Verified</span>
          </VerifiedItem>
        </LeftHeader>
        <ActionSelectorWrapper data-testid='customer-action-selector'>
          <div className='dropdown'>
            <button type='button' aria-label='Customer actions' aria-haspopup='true' aria-expanded='false'>
              <svg data-testid='customer-action-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><circle cx='8' cy='3' r='1.2' /><circle cx='8' cy='8' r='1.2' /><circle cx='8' cy='13' r='1.2' /></svg>
            </button>
            <div className='dropdown-menu'>
              <a className='dropdown-item' href='#' data-testid='customer-action-dropdown-item'>Custom fields</a>
            </div>
          </div>
        </ActionSelectorWrapper>
      </HeaderContainer>

      <OptionMenu as='button' type='button' aria-pressed='false' data-testid='customer-option-menu'>
        <span data-testid='customer-option-menu-label'>User details</span>
        <svg data-testid='customer-option-menu-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M6 4l4 4-4 4' fill='none' stroke='currentColor' strokeWidth='1.5' /></svg>
      </OptionMenu>

      <PointsContainer data-testid='points-wallet-container'>
        <h1 data-testid='points-wallet-title'>Points wallet</h1>
      </PointsContainer>

      {/* EqualWrapper is exported but rendered nowhere in the application. It is
          mounted here only to verify that its migrated declaration resolves; the
          evidence records it as unrendered dead code. */}
      <EqualWrapper data-testid='equal-wrapper'>=</EqualWrapper>

      <PointsWrapper data-testid='points-wrapper'>
        <h2 data-testid='points-balance'>1,250</h2>
        <p data-testid='points-balance-label'>Points</p>
      </PointsWrapper>

      <LevelWrapper data-testid='level-wrapper'>
        <h1 data-testid='level-wrapper-title'>Level</h1>
      </LevelWrapper>

      <PointsTabs data-testid='points-tabs'>
        <PointsTab as='button' type='button' active aria-pressed='true' data-testid='points-tab-active'>Points wallet</PointsTab>
        <PointsTab as='button' type='button' aria-pressed='false' data-testid='points-tab-inactive'>Transaction history</PointsTab>
      </PointsTabs>

      <LoyaltyLevel data-testid='loyalty-level'>
        <h2 data-testid='loyalty-level-title'>Level</h2>
        <LoyaltyLevelContent data-testid='loyalty-level-content'>
          <h3 data-testid='loyalty-level-name'>Gold</h3>
        </LoyaltyLevelContent>
      </LoyaltyLevel>

      <PointsSectionContainer data-testid='points-section'>
        <p data-testid='points-section-title'>Add wallet money</p>
      </PointsSectionContainer>

      <PointsFormController data-testid='points-form-controller'>
        <label htmlFor='fixture-points-amount' data-testid='points-form-label'>Indicate the amount to add</label>
        <input id='fixture-points-amount' type='number' aria-label='Amount' data-testid='points-form-input' />
        <textarea aria-label='Comment' rows={3} data-testid='points-form-textarea' />
      </PointsFormController>

      <TransactionHeader data-testid='transaction-header'>
        <svg data-testid='transaction-icon' viewBox='0 0 16 16' width='6' height='6' aria-hidden='true' focusable='false'><circle cx='8' cy='8' r='6' /></svg>
        <span className='date' data-testid='transaction-date'>Sep 12, 2026</span>
        <Amount data-testid='transaction-amount'>$45.00</Amount>
      </TransactionHeader>

      <TransactionDescription data-testid='transaction-description'>Refund for order #1042</TransactionDescription>

      <TransactionCode data-testid='transaction-code'>
        <span><strong>Code:</strong> 8H2K9Q</span>
      </TransactionCode>

      <VerifiedStatusFilterContainer data-testid='verified-status-filter'>
        <button type='button' aria-pressed='false' data-testid='verified-status-filter-button'>
          <span data-testid='verified-status-filter-label'>All</span>
          <svg data-testid='verified-status-filter-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M4 4l8 8M12 4l-8 8' stroke='currentColor' strokeWidth='1.5' /></svg>
        </button>
      </VerifiedStatusFilterContainer>
    </main>
  )
}
