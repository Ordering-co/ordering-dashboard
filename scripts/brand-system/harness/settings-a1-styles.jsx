import React from 'react'

import { Button } from '../../../src/@/components-dashboard/src/ui/src/styles'

import {
  CategoryName as AsCategoryName,
  HeaderTitleContainer as AsHeaderTitleContainer,
  IconWrapper as AsIconWrapper,
  InfoContent as AsInfoContent,
  MenuContainer as AsMenuContainer,
  SidebarContent as AsSidebarContent,
  SubMenu as AsSubMenu
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/AllSettings/styles'
import {
  HeaderTitleContainer as FsHeaderTitleContainer,
  IconWrapper as FsIconWrapper,
  InfoContent as FsInfoContent,
  LoyaltyItemContent as FsLoyaltyItemContent
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/FilterSettings/styles'
import {
  CategoryName as IhbCategoryName,
  Description as IhbDescription,
  VideoContainer as IhbVideoContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/InfoHelpBox/styles'
import {
  IconWrapper as SiuIconWrapper,
  SettingItemDescription as SiuSettingItemDescription,
  Title as SiuTitle
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/SettingItemUI/styles'
import {
  CategoryName as SdCategoryName,
  Content as SdContent,
  Description as SdDescription,
  MoreInfo as SdMoreInfo,
  VideoContainer as SdVideoContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/SettingsDetail/styles'
import {
  ImageActions as SiImageActions,
  ImageContainer as SiImageContainer,
  UploadImageIcon as SiUploadImageIcon
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/SettingsImage/styles'
import {
  CheckBoxWrapper as SlCheckBoxWrapper,
  Description as SlDescription,
  FormGroupCheck as SlFormGroupCheck,
  FormGroupText as SlFormGroupText,
  GeneralTitle as SlGeneralTitle,
  OptionsError as SlOptionsError,
  PasswordInputWrapper as SlPasswordInputWrapper,
  Required as SlRequired,
  SubmitBtnWrapper as SlSubmitBtnWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/SettingsList/styles'
import {
  Option as SsuOption,
  OptionsError as SsuOptionsError,
  SelectContent as SsuSelectContent,
  SelectHeader as SsuSelectHeader
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/SettingsSelectUI/styles'

// Batch fixture for a1-settings-core.
//
// It mounts the migrated STYLES, not the controllers. That is deliberate and it
// is what keeps this batch inside the boundary of section 5.1 of the goal: the
// Settings controllers reach paymethods, integrations and tenant configuration,
// and mounting them would put network and write surfaces behind a typography
// test. Styled components render the same CSS with none of that.
//
// Every node below exists to place ONE declared site of the ruleset in the exact
// selector context the rule names, so the spec can measure it. Where a context
// is a direct child (`> h1`), the markup is a direct child; where it is a
// descendant (`svg`), it is a descendant. Getting that wrong makes a test that
// measures the wrong node and passes anyway.
export const SettingsA1StylesFixture = () => (
  <div data-testid='settings-a1-styles' style={{ padding: 24, display: 'grid', gap: 12 }}>

    {/* AllSettings */}
    <AsHeaderTitleContainer data-testid='as-header-wrapper'>
      <h1 data-testid='as-header'>All settings</h1>
    </AsHeaderTitleContainer>
    <AsIconWrapper data-testid='as-icon-wrapper'>
      <svg data-testid='as-icon' viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
    </AsIconWrapper>
    <AsCategoryName data-testid='as-category-name-wrapper'>
      <p data-testid='as-category-name'>Delivery</p>
    </AsCategoryName>
    <AsInfoContent data-testid='as-info-content'>Manage every setting from this tab</AsInfoContent>
    <AsMenuContainer data-testid='as-menu-wrapper'>
      <span data-testid='as-menu'>Basic</span>
    </AsMenuContainer>
    <AsSubMenu data-testid='as-submenu'>Business settings</AsSubMenu>
    <AsSidebarContent data-testid='as-sidebar-wrapper'>
      <button type='button' data-testid='as-sidebar-button'>
        Open
        <svg data-testid='as-sidebar-icon' viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
      </button>
    </AsSidebarContent>

    {/* FilterSettings */}
    <FsHeaderTitleContainer data-testid='fs-header-wrapper'>
      <h1 data-testid='fs-header'>Filter settings</h1>
    </FsHeaderTitleContainer>
    <FsIconWrapper data-testid='fs-icon-wrapper'>
      <svg data-testid='fs-icon' viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
    </FsIconWrapper>
    <FsLoyaltyItemContent data-testid='fs-item-content'>
      <h5 data-testid='fs-item-title'>Loyalty</h5>
      <p data-testid='fs-item-description'>Points, levels and rewards</p>
    </FsLoyaltyItemContent>
    <FsInfoContent data-testid='fs-info-content'>Only the settings you enabled</FsInfoContent>

    {/* InfoHelpBox */}
    <IhbCategoryName data-testid='ihb-category-name-wrapper'>
      <p data-testid='ihb-category-name'>Checkout</p>
    </IhbCategoryName>
    <IhbDescription data-testid='ihb-description'>What this group of settings controls.</IhbDescription>
    <IhbVideoContainer data-testid='ihb-video-wrapper'>
      <svg data-testid='ihb-video-icon' viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
    </IhbVideoContainer>

    {/* SettingItemUI */}
    <SiuIconWrapper data-testid='siu-icon-wrapper'>
      <svg data-testid='siu-icon' viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
    </SiuIconWrapper>
    <SiuTitle data-testid='siu-title'>Language settings</SiuTitle>
    <SiuSettingItemDescription data-testid='siu-description'>Pick the languages your store speaks</SiuSettingItemDescription>

    {/* SettingsDetail */}
    <SdContent data-testid='sd-content'>
      <button type='button' className='all-setting' data-testid='sd-all-setting-button'>
        <span data-testid='sd-all-setting'>All settings</span>
      </button>
    </SdContent>
    <SdCategoryName data-testid='sd-category-name-wrapper'>
      <p data-testid='sd-category-name'>Checkout</p>
    </SdCategoryName>
    <SdDescription data-testid='sd-description'>What this setting group controls.</SdDescription>
    <SdMoreInfo data-testid='sd-more-info'>More info</SdMoreInfo>
    <SdVideoContainer data-testid='sd-video-wrapper'>
      <svg data-testid='sd-video-icon' viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
    </SdVideoContainer>

    {/* SettingsImage */}
    <SiImageContainer data-testid='si-image-wrapper'>
      <p data-testid='si-image-name'>Logo</p>
    </SiImageContainer>
    <SiUploadImageIcon data-testid='si-upload-wrapper'>
      <span data-testid='si-upload'>Put your image here</span>
    </SiUploadImageIcon>
    {/*
      The product renders this `Button` (the shared one, with the props below)
      inside `ImageActions`, and `ImageActions button` is the rule that sizes it
      (L8 13px -> control). Same markup as the product's SettingsImage.
    */}
    <SiImageActions>
      <Button type='button' outline color='primary' borderRadius='8px' data-testid='si-restore-button'>
        Restore default
      </Button>
    </SiImageActions>

    {/* SettingsList */}
    <SlGeneralTitle data-testid='sl-general-title-wrapper'>
      <p data-testid='sl-general-title'>All settings</p>
    </SlGeneralTitle>
    <SlOptionsError data-testid='sl-options-error'>There is no options value</SlOptionsError>
    <SlFormGroupText data-testid='sl-form-text-wrapper'>
      <label htmlFor='fixture-settings-a1-form-text' data-testid='sl-form-text-label'>Store name</label>
      <input id='fixture-settings-a1-form-text' type='text' data-testid='sl-form-text-input' defaultValue='Downtown Diner' />
    </SlFormGroupText>
    <SlFormGroupCheck data-testid='sl-form-check-wrapper'>
      <label htmlFor='fixture-settings-a1-form-check' data-testid='sl-form-check-label'>Enable signup</label>
      <input id='fixture-settings-a1-form-check' type='checkbox' />
    </SlFormGroupCheck>
    {/*
      `Required` has no consumer in the product: it is a dead EXPORT, not dead
      CSS. A fixture can mount it, so its role is demonstrable and it is migrated
      rather than preserved — and this node is what makes that demonstrable.
    */}
    <SlRequired data-testid='sl-required'>Required</SlRequired>
    <SlCheckBoxWrapper data-testid='sl-checkbox-wrapper'>
      <label data-testid='sl-checkbox-label'>Delivery zones</label>
      <p data-testid='sl-checkbox-description'>Which zones this store delivers to</p>
    </SlCheckBoxWrapper>
    <SlSubmitBtnWrapper data-testid='sl-submit-wrapper'>
      <button type='button' data-testid='sl-submit'>Save</button>
    </SlSubmitBtnWrapper>
    <SlDescription data-testid='sl-description'>What this list of settings controls.</SlDescription>
    <SlPasswordInputWrapper data-testid='sl-password-wrapper'>
      <button type='button' data-testid='sl-password-button'>
        <svg data-testid='sl-password-icon' viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
      </button>
    </SlPasswordInputWrapper>

    {/* SettingsLogs: retired 2026-10-11, the page moved onto Product (Shared/ChangeLog); its styles.js is gone */}

    {/* SettingsSelectUI */}
    <SsuSelectHeader data-testid='ssu-header-wrapper'>
      <label data-testid='ssu-header-label'>Order type</label>
      <p data-testid='ssu-header-description'>Which order types this store accepts</p>
    </SsuSelectHeader>
    <SsuSelectContent data-testid='ssu-select-wrapper'>
      <div className='select'>
        <div data-testid='ssu-select-value'>Delivery</div>
      </div>
    </SsuSelectContent>
    <SsuOption data-testid='ssu-option'>Yes</SsuOption>
    <SsuOptionsError data-testid='ssu-options-error'>There is no options value</SsuOptionsError>
  </div>
)
