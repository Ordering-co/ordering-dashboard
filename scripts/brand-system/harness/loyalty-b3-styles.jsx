import React from 'react'

import {
  LevelName as LldLevelName,
  ActionSelectorWrapper as LldActionSelectorWrapper,
  FormController as LldFormController,
  ExPirationWrapper as LldExPirationWrapper,
  CheckBoxWrapper as LldCheckBoxWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Loyalty/LoyaltyLevelDetail/styles'
import {
  HeaderContainer as PwbdHeaderContainer,
  PointsRedemptionWrapper as PwbdPointsRedemptionWrapper,
  CheckBoxWrapper as PwbdCheckBoxWrapper,
  PointsAccumulationContainer as PwbdPointsAccumulationContainer,
  ToggleWrapper as PwbdToggleWrapper,
  ExPirationWrapper as PwbdExPirationWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Loyalty/PointsWalletBusinessDetail/styles'
import {
  BusinessInfoWrapper as PwblBusinessInfoWrapper,
  ModifiedWrapper as PwblModifiedWrapper,
  CheckBoxWrapper as PwblCheckBoxWrapper,
  CheckBoxInnerWrapper as PwblCheckBoxInnerWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Loyalty/PointsWalletBusinessList/styles'
import {
  Title as PwlTitle,
  LevelName as PwlLevelName,
  AddNewLevelButton as PwlAddNewLevelButton,
  LevelItemContainer as PwlLevelItemContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Loyalty/PointsWalletLevels/styles'
import {
  HeaderTitleContainer as RpHeaderTitleContainer,
  LoyaltyItemContent as RpLoyaltyItemContent,
  InfoContent as RpInfoContent,
  IconWrapper as RpIconWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Loyalty/RewardsPrograms/styles'
import {
  Title as WTitle,
  Tab as WTab
} from '../../../src/@/components-dashboard/src/ui/src/components/Loyalty/Wallet/styles'

// Presentation-only fixture: the real Loyalty styled surfaces named in the
// b3-loyalty ruleset, no controller, SDK, account or network. These screens
// move wallet balances and gift-card credit, so nothing is mounted from any
// row's index.js — only the styled-components exported by each row's
// styles.js, exactly as scan-coupling and classify-preview read them.
//
// Single viewport: this batch's ruleset (scripts/brand-system/l5-b3-loyalty-typography-rules.json)
// declares no preservation of a breakpoint override on top of a role, so there
// is no second width at which any assertion here would differ.
export const LoyaltyB3StylesFixture = () => {
  return (
    <main data-testid='loyalty-b3-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>
      {/* redesign GC-C: sites 1–7 (GiftCardDetail, GiftCards) left with their styles.js; the gift card catalog is Product now */}
      {/* 8. LoyaltyLevelDetail | LevelName | <root> */}
      <LldLevelName data-testid='lld-level-name'>Silver tier</LldLevelName>

      {/* 9. LoyaltyLevelDetail | ActionSelectorWrapper | > div > > div > .dropdown-item */}
      <LldActionSelectorWrapper data-testid='lld-action-selector-wrapper'>
        <div>
          <div>
            <button type='button' className='dropdown-item' data-testid='lld-action-selector-dropdown-item'>Delete</button>
          </div>
        </div>
      </LldActionSelectorWrapper>

      {/* 10. LoyaltyLevelDetail | FormController | label */}
      <LldFormController data-testid='lld-form-controller-wrapper'>
        <label data-testid='lld-form-controller-label'>Level name</label>
      </LldFormController>

      {/* 11. LoyaltyLevelDetail | ExPirationWrapper | > h2 */}
      <LldExPirationWrapper data-testid='lld-expiration-wrapper'>
        <h2 data-testid='lld-expiration-h2'>Expiration</h2>
      </LldExPirationWrapper>

      {/*
        12. LoyaltyLevelDetail | CheckBoxWrapper | p
        CheckBoxWrapper is one of the wrappers this batch declares NOT
        converted to a native control: it wraps flow content (a p, and — see
        preservation P5 below — an svg), and a button may not legally contain
        that content model. It stays a non-interactive div, as it renders in
        the product today.
      */}
      <LldCheckBoxWrapper data-testid='lld-checkbox-wrapper'>
        <p data-testid='lld-checkbox-p'>Auto-renew this level</p>
      </LldCheckBoxWrapper>

      {/* 13. PointsWalletBusinessDetail | HeaderContainer | h1 */}
      <PwbdHeaderContainer data-testid='pwbd-header-wrapper'>
        <h1 data-testid='pwbd-header-h1'>Downtown Diner wallet</h1>
      </PwbdHeaderContainer>

      {/* 14-15. PointsWalletBusinessDetail | PointsRedemptionWrapper | h2, p (one instance, both real children of the row) */}
      <PwbdPointsRedemptionWrapper data-testid='pwbd-points-redemption-wrapper'>
        <h2 data-testid='pwbd-points-redemption-h2'>Redemption</h2>
        <p data-testid='pwbd-points-redemption-p'>Points redeem for store credit.</p>
      </PwbdPointsRedemptionWrapper>

      {/* 16. PointsWalletBusinessDetail | CheckBoxWrapper | p (non-interactive div; same exclusion as montaje 12) */}
      <PwbdCheckBoxWrapper data-testid='pwbd-checkbox-wrapper'>
        <p data-testid='pwbd-checkbox-p'>Enable redemption</p>
      </PwbdCheckBoxWrapper>

      {/* 17-19. PointsWalletBusinessDetail | PointsAccumulationContainer | > h2, > p, > span (one instance, all three real children) */}
      <PwbdPointsAccumulationContainer data-testid='pwbd-points-accumulation-wrapper'>
        <h2 data-testid='pwbd-points-accumulation-h2'>Accumulation</h2>
        <p data-testid='pwbd-points-accumulation-p'>Earn points per purchase.</p>
        <span data-testid='pwbd-points-accumulation-span'>1 point per $1</span>
      </PwbdPointsAccumulationContainer>

      {/* 20. PointsWalletBusinessDetail | ToggleWrapper | p */}
      <PwbdToggleWrapper data-testid='pwbd-toggle-wrapper'>
        <p data-testid='pwbd-toggle-p'>Accumulates points</p>
      </PwbdToggleWrapper>

      {/* 21. PointsWalletBusinessDetail | ExPirationWrapper | > h2 */}
      <PwbdExPirationWrapper data-testid='pwbd-expiration-wrapper'>
        <h2 data-testid='pwbd-expiration-h2'>Expiration</h2>
      </PwbdExPirationWrapper>

      {/* 22. PointsWalletBusinessList | BusinessInfoWrapper | > span */}
      <PwblBusinessInfoWrapper data-testid='pwbl-business-info-wrapper'>
        <span data-testid='pwbl-business-info-span'>Downtown Diner</span>
      </PwblBusinessInfoWrapper>

      {/*
        23. PointsWalletBusinessList | ModifiedWrapper | > span
        The rule's `> span` block sits inside `${({ isSkeleton }) => !isSkeleton && css...}`
        in ModifiedWrapper's styles, so it only exists when isSkeleton is
        falsy. Mounted without the prop (falsy by default) so the selector
        actually matches a rendered node.
      */}
      <PwblModifiedWrapper data-testid='pwbl-modified-wrapper'>
        <span data-testid='pwbl-modified-span'>2 days ago</span>
      </PwblModifiedWrapper>

      {/* 24. PointsWalletLevels | Title | <root> */}
      <PwlTitle data-testid='pwl-title'>Levels</PwlTitle>

      {/* 25. PointsWalletLevels | LevelName | <root> */}
      <PwlLevelName data-testid='pwl-level-name'>Bronze</PwlLevelName>

      {/* 26. PointsWalletLevels | AddNewLevelButton | <root> */}
      <PwlAddNewLevelButton data-testid='pwl-add-new-level-button'>Add level</PwlAddNewLevelButton>

      {/* 27. RewardsPrograms | HeaderTitleContainer | > h1 */}
      <RpHeaderTitleContainer data-testid='rp-header-title-wrapper'>
        <h1 data-testid='rp-header-title-h1'>Rewards programs</h1>
      </RpHeaderTitleContainer>

      {/* 28-29. RewardsPrograms | LoyaltyItemContent | h5, p (one instance, both real children) */}
      <RpLoyaltyItemContent data-testid='rp-loyalty-item-content-wrapper'>
        <h5 data-testid='rp-loyalty-item-h5'>Cashback</h5>
        <p data-testid='rp-loyalty-item-p'>Earn cash on every order.</p>
      </RpLoyaltyItemContent>

      {/* 30. RewardsPrograms | InfoContent | <root> */}
      <RpInfoContent data-testid='rp-info-content'>Learn more about this program.</RpInfoContent>

      {/* 31. Wallet | Title | <root> */}
      <WTitle data-testid='w-title'>Wallet</WTitle>

      {/*
        32. Wallet | Tab | <root>
        Wallet/index.js renders this styled-component with `as='button'`,
        `type='button'` and `aria-pressed`, so the fixture mounts the same
        native tab-button instead of the bare div the styled component
        defaults to.
      */}
      <WTab as='button' type='button' aria-pressed='true' data-testid='w-tab'>Points</WTab>

      {/*
        The declared preservations. Each is mounted on its own instance of the
        row's styled-component, separate from the role mounts above, so the
        role mounts stay free of preservation-only markup. Ten live in
        the ruleset; only six are observable here. The other four —
        LoyaltyLevelDetail's UploadImageIcon span (P6:
        UploadImageIcon renders only an ImageIcon component, with no span
        child carrying text), PointsWalletBusinessDetail's PaymentRulesWrapper
        h2 and p (P7, P8: the whole block is commented out in index.js, so
        neither node ever renders), and PointsWalletBusinessDetail's
        AccumulationInputWrapper .price (P10: no node in index.js carries that
        class) — have selectors that match nothing in the current markup, so
        no fixture can mount a node for a spec to measure. They stay
        unmounted here; a spec cannot assert what does not render.
      */}
      <section data-testid='b3-preservations'>
        {/* redesign GC-C: P1 and P3 (GiftCardDetail, GiftCards) left with their styles.js */}
        {/* P4. LoyaltyLevelDetail | ActionSelectorWrapper | button > svg (the three-dots action glyph) */}
        <LldActionSelectorWrapper data-testid='lld-action-selector-icon-wrapper'>
          <button type='button' aria-label='Level menu'>
            <svg data-testid='lld-action-selector-icon' />
          </button>
        </LldActionSelectorWrapper>

        {/* P5. LoyaltyLevelDetail | CheckBoxWrapper | svg (radio glyph; non-interactive div, same exclusion as montaje 12) */}
        <LldCheckBoxWrapper data-testid='lld-checkbox-icon-wrapper'>
          <svg data-testid='lld-checkbox-icon' />
        </LldCheckBoxWrapper>

        {/* P9. PointsWalletBusinessDetail | CheckBoxWrapper | svg (radio glyph; non-interactive div, same exclusion as montaje 16) */}
        <PwbdCheckBoxWrapper data-testid='pwbd-checkbox-icon-wrapper'>
          <svg data-testid='pwbd-checkbox-icon' />
        </PwbdCheckBoxWrapper>

        {/* P11. PointsWalletBusinessList | ModifiedWrapper | svg (row chevron; renders regardless of isSkeleton, unlike montaje 23's span) */}
        <PwblModifiedWrapper data-testid='pwbl-modified-icon-wrapper'>
          <svg data-testid='pwbl-modified-icon' />
        </PwblModifiedWrapper>

        {/*
          P12. PointsWalletLevels | LevelItemContainer | > svg (row chevron)
          LevelItemContainer is one of the wrappers this batch declares NOT
          converted to a native control: it wraps flow content (the level's
          image and name), so it stays the non-interactive div it is in the
          product.
        */}
        <PwlLevelItemContainer data-testid='pwl-level-item-wrapper'>
          <svg data-testid='pwl-level-item-icon' />
        </PwlLevelItemContainer>

        {/* P13. RewardsPrograms | IconWrapper | svg (the programme icon) */}
        <RpIconWrapper data-testid='rp-icon-wrapper'>
          <svg data-testid='rp-icon-wrapper-icon' />
        </RpIconWrapper>
      </section>

      {/*
        Declared native-control conversion with no typography rule or
        preservation of its own: PointsWalletBusinessList's
        CheckBoxInnerWrapper. PointsWalletBusinessList/index.js renders it as
        `as='button' type='button' role='checkbox' aria-checked={...}`, nested
        inside CheckBoxWrapper exactly as in the product, so the fixture
        mounts the same pairing rather than a bare span.
      */}
      <PwblCheckBoxWrapper data-testid='pwbl-checkbox-wrapper'>
        <PwblCheckBoxInnerWrapper as='button' type='button' role='checkbox' aria-checked='true' data-testid='pwbl-checkbox-inner'>
          <svg />
        </PwblCheckBoxInnerWrapper>
      </PwblCheckBoxWrapper>
    </main>
  )
}
