import React from 'react'

import {
  Badge as CpBadge,
  Content as CpContent,
  ContextChip as CpContextChip,
  EmptyState as CpEmptyState,
  Footer as CpFooter,
  InputRow as CpInputRow,
  ItemSubtitle as CpItemSubtitle,
  ItemText as CpItemText,
  ItemTitle as CpItemTitle,
  Kbd as CpKbd,
  StatusRow as CpStatusRow,
  TriggerButton as CpTriggerButton
} from '../../../src/@/components-dashboard/src/ui/src/components/CommandPalette/styles'
import {
  Divider as AuDivider,
  Field as AuField,
  HeroCaption as AuHeroCaption,
  LoginContainer as AuLoginContainer,
  OtpHeader as AuOtpHeader,
  OtpWrapper as AuOtpWrapper,
  PrimaryButton as AuPrimaryButton,
  RedirectLink as AuRedirectLink,
  ResendCode as AuResendCode,
  Route as AuRoute,
  SecondaryButton as AuSecondaryButton,
  Tab as AuTab,
  Tabs as AuTabs,
  TextInput as AuTextInput,
  TitleFormSide as AuTitleFormSide,
  CountdownTimer as AuCountdownTimer
} from '../../../src/@/components-dashboard/src/ui/src/components/Login/AuthLayout/styles'

// Batch fixture for l8-shell (L8 lot 3.2): CommandPalette and Login/AuthLayout.
// Home/ProjectStatusBadge has no sites. The Assistant left the lot when its
// styled-components file was replaced by Product CSS, so its
// nodes are gone from this fixture.
//
// It mounts the STYLED COMPONENTS, not the controllers, so no network or write
// surface sits behind a typography test. One node per declared site of the
// ruleset (20 rules + 12 preservations = 32 data-testids, plus the root), placed
// in the selector context the rule names. Direct-child contexts are direct
// children; descendant contexts are descendants.
//
// Three families need special handling:
//
//  - CommandPalette `Content` is `styled(Dialog.Content)`. The Radix dialog is
//    NOT mounted: `as='div'` replaces the wrapped Radix component with a plain
//    div and keeps the styled CSS, and the `[cmdk-*]` attribute selectors are
//    matched with equivalent attributes on plain nodes. Its fixed positioning
//    is neutralised inline; geometry only, never typography.
//  - Login/AuthLayout styled components live inside `LoginContainer`, which
//    declares the `--od-*` variables of `main` (`orderingBrandScope`). Every
//    AuthLayout node is mounted INSIDE a real `LoginContainer`, which is also
//    the node of its own rule.
//  - A rule and a preservation that share ONE element in the product (Tab,
//    controlStyles, buttonBase, otp-input) get a node each:
//    a node with two testids cannot exist, and the second sibling is the same
//    styled component with the same context.

const neutralised = { position: 'static', transform: 'none', animation: 'none', top: 'auto', left: 'auto', width: 'auto', maxHeight: 'none', zIndex: 'auto' }
const icon = (testid) => (
  <svg data-testid={testid} viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
)

export const L8ShellStylesFixture = () => (
  <div data-testid='l8-shell-styles' style={{ padding: 24, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>

    {/* CommandPalette: styled components only, no Radix dialog */}
    <CpContent as='div' style={neutralised}>
      {/* cmdk's own attribute, the selector the styles target */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <div cmdk-group-heading='' data-testid='cp-content-group-heading'>Pages</div>
    </CpContent>
    <CpInputRow>
      {icon()}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <input cmdk-input='' aria-label='Search' data-testid='cp-inputrow-input' defaultValue='orders' />
    </CpInputRow>
    <div><CpContextChip type='button' data-testid='cp-contextchip'><span>Orders</span></CpContextChip></div>
    <div><CpKbd data-testid='cp-kbd'>K</CpKbd></div>
    <CpItemText>
      <CpItemTitle data-testid='cp-itemtitle'>Orders</CpItemTitle>
      <CpItemSubtitle data-testid='cp-itemsubtitle'>Go to the orders list</CpItemSubtitle>
    </CpItemText>
    <div><CpBadge data-testid='cp-badge'>New</CpBadge></div>
    <CpStatusRow data-testid='cp-statusrow'>Searching</CpStatusRow>
    <CpEmptyState>
      <p data-testid='cp-emptystate-p'>No results</p>
      <p data-testid='cp-emptystate-p-p'>Try another search</p>
    </CpEmptyState>
    <CpFooter data-testid='cp-footer'><span>Navigate</span></CpFooter>
    <CpTriggerButton type='button' data-testid='cp-triggerbutton'>
      {icon('cp-triggerbutton-svg')}
      <span>Search</span>
    </CpTriggerButton>

    {/* Login/AuthLayout: every node inside a real LoginContainer */}
    <AuLoginContainer $isPopup data-testid='auth-logincontainer'>
      <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12, padding: 16 }}>
        <AuHeroCaption data-testid='auth-herocaption'>One route</AuHeroCaption>
        <AuRoute>
          <li data-testid='auth-route-li'>Order</li>
          <li>Store</li>
          <li>Driver</li>
          <li>Customer</li>
        </AuRoute>
        <AuTitleFormSide>
          <h1 data-testid='auth-titleformside-h1'>Sign in</h1>
          <p data-testid='auth-titleformside-p'>Welcome back</p>
        </AuTitleFormSide>
        <AuTabs>
          <AuTab type='button' data-testid='auth-tab'>Email</AuTab>
          <AuTab type='button' data-testid='auth-tab-font-reset'>Phone</AuTab>
        </AuTabs>
        <AuField>
          <label htmlFor='fixture-l8-shell-email' data-testid='auth-field-label'>Email</label>
          <AuTextInput id='fixture-l8-shell-email' type='text' data-testid='auth-controlstyles' defaultValue='ada@example.invalid' />
          <AuTextInput type='text' aria-label='Email (font reset)' data-testid='auth-controlstyles-font-reset' defaultValue='ada@example.invalid' />
          <AuTextInput type='text' aria-label='Email (below 768px)' data-testid='auth-controlstyles-font-size-3' defaultValue='ada@example.invalid' />
        </AuField>
        <div style={{ display: 'grid', gap: 8 }}>
          <AuPrimaryButton type='button' data-testid='auth-buttonbase'>Sign in</AuPrimaryButton>
          <AuSecondaryButton type='button' data-testid='auth-buttonbase-font-reset'>Sign in with a code</AuSecondaryButton>
        </div>
        <AuRedirectLink data-testid='auth-redirectlink'>No account yet? <a href='#signup'>Sign up</a></AuRedirectLink>
        <AuDivider data-testid='auth-divider'>or</AuDivider>
        <AuOtpHeader>
          <AuCountdownTimer data-testid='auth-countdowntimer'>04:59</AuCountdownTimer>
        </AuOtpHeader>
        <AuOtpWrapper>
          <div className='otp-container'>
            <input className='otp-input' aria-label='Digit' data-testid='auth-otp-input' defaultValue='1' />
            <input className='otp-input' aria-label='Digit (font reset)' data-testid='auth-otp-font-reset' defaultValue='2' />
          </div>
        </AuOtpWrapper>
        <div style={{ display: 'grid' }}>
          <AuResendCode type='button' data-testid='auth-resendcode-font-reset'>Resend code</AuResendCode>
        </div>
      </div>
    </AuLoginContainer>
  </div>
)
