import React from 'react'

import {
  Header as CdHeader,
  InputWrapper as CdInputWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/CityDetails/styles'
import {
  ActionSelectorWrapper as ClActionSelector,
  ActionsContainer as ClActions,
  CheckboxWrapper as ClCheckbox,
  CountryName as ClCountryName,
  EnableWrapper as ClEnable
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/CountriesList/styles'
import {
  Header as CyHeader,
  InputWrapper as CyInputWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/CountryDetails/styles'
import {
  FormGroupText as CsFormGroupText,
  GeneralTitle as CsGeneralTitle,
  PasswordInputWrapper as CsPasswordWrapper,
  Required as CsRequired
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/CountrySettingDetail/styles'
import {
  InsertLinkContainer as IvContainer,
  WrapperInput as IvWrapperInput
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/InsertVideo/styles'
import {
  SiteItem as McSiteItem,
  SitesListContainer as McSitesList
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/MultiCountrySettings/styles'
import {
  ActionSelectorWrapper as PlActionSelector,
  ActionsContainer as PlActions,
  CheckboxWrapper as PlCheckbox,
  CityAdministrator as PlCityAdministrator,
  CityName as PlCityName,
  CountryName as PlCountryName,
  EnableWrapper as PlEnable,
  HeaderLeft as PlHeaderLeft,
  Tab as PlTab
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/PlaceListing/styles'
import {
  CountryListItem as ScCountryListItem,
  CountrySearchInput as ScCountrySearchInput,
  CountrySelectWrapper as ScSelectWrapper,
  SearchIconWrapper as ScSearchIcon
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/SettingsCountryFilter/styles'
import {
  Header as ZdHeader,
  InputWrapper as ZdInputWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/ZoneDropdownDetails/styles'

// Batch fixture for a3-settings-places. Mounts the migrated STYLES, not the
// controllers, for the same reason as a1 and a2.
export const SettingsA3StylesFixture = () => (
  <div data-testid='settings-a3-styles' style={{ padding: 24, display: 'grid', gap: 12 }}>

    <CdHeader data-testid='cd-header-wrapper'><h1 data-testid='cd-header'>City</h1></CdHeader>
    <CdInputWrapper data-testid='cd-input-wrapper'>
      <label data-testid='cd-input-label'>Name</label>
      <div data-testid='cd-input-value'>Barcelona</div>
    </CdInputWrapper>

    <ClCountryName data-testid='cl-country-name'>Spain</ClCountryName>
    <ClActions data-testid='cl-actions'>Actions</ClActions>
    <ClEnable data-testid='cl-enable-wrapper'><span data-testid='cl-enable'>Enable</span></ClEnable>
    <ClActionSelector data-testid='cl-action-selector-wrapper'>
      <div><div><div className='dropdown-item' data-testid='cl-action-selector'>Edit</div></div></div>
    </ClActionSelector>
    <ClCheckbox data-testid='cl-checkbox-wrapper'>
      <svg data-testid='cl-checkbox-icon' viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
    </ClCheckbox>

    <CyHeader data-testid='cy-header-wrapper'><h1 data-testid='cy-header'>Country</h1></CyHeader>
    <CyInputWrapper data-testid='cy-input-wrapper'>
      <label data-testid='cy-input-label'>Name</label>
      <div data-testid='cy-input-value'>Spain</div>
    </CyInputWrapper>

    <CsGeneralTitle data-testid='cs-general-title-wrapper'><p data-testid='cs-general-title'>Country settings</p></CsGeneralTitle>
    <CsFormGroupText data-testid='cs-form-wrapper'>
      <label data-testid='cs-form-label'>API key</label>
      <input type='text' data-testid='cs-form-input' defaultValue='abc123' />
    </CsFormGroupText>
    <CsRequired data-testid='cs-required'>Required</CsRequired>
    <CsPasswordWrapper data-testid='cs-password-wrapper'>
      <button type='button' data-testid='cs-password-button'>
        <svg data-testid='cs-password-icon' viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
      </button>
    </CsPasswordWrapper>

    <IvContainer data-testid='iv-container-wrapper'><h1 data-testid='iv-container'>Insert video</h1></IvContainer>
    <IvWrapperInput data-testid='iv-input-wrapper'><label data-testid='iv-input-label'>Video URL</label></IvWrapperInput>

    <McSitesList data-testid='mc-sites-wrapper'><h1 data-testid='mc-sites'>Multi country settings</h1></McSitesList>
    <McSiteItem data-testid='mc-site-item'>
      <span data-testid='mc-site-name'>Spain</span>
      <svg data-testid='mc-site-chevron' viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
    </McSiteItem>
    {/*
      The loading placeholder, mounted disabled exactly as the product mounts it.
      Converting SiteItem at its base reached this usage too, and without the
      `disabled` it would sit in the tab order as an empty control while the list
      loads. The spec measures that rather than trusting the markup.
    */}
    <McSiteItem data-testid='mc-site-item-loading' disabled>
      <span data-testid='mc-site-loading-name'>&nbsp;</span>
    </McSiteItem>

    <PlHeaderLeft data-testid='pl-header-wrapper'><h1 data-testid='pl-header'>Countries/Cities</h1></PlHeaderLeft>
    <PlTab data-testid='pl-tab'>Countries</PlTab>
    <PlCityName data-testid='pl-city-name'>Barcelona</PlCityName>
    <PlCountryName data-testid='pl-country-name'>Spain</PlCountryName>
    <PlActions data-testid='pl-actions'>Actions</PlActions>
    <PlEnable data-testid='pl-enable-wrapper'><span data-testid='pl-enable'>Enable</span></PlEnable>
    <PlActionSelector data-testid='pl-action-selector-wrapper'>
      <div><div><div className='dropdown-item' data-testid='pl-action-selector'>Edit</div></div></div>
    </PlActionSelector>
    <PlCheckbox data-testid='pl-checkbox-wrapper'>
      <svg data-testid='pl-checkbox-icon' viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
    </PlCheckbox>
    {/*
      `CityAdministrator` is preserved because its only uncommented usage in the
      product wraps a Skeleton and carries no text. It is mounted here EMPTY, the
      way the product mounts it, so the preservation can be measured without the
      fixture inventing a text node the product does not have.
    */}
    <PlCityAdministrator data-testid='pl-city-administrator'>&nbsp;</PlCityAdministrator>

    <ScSelectWrapper data-testid='sc-select-wrapper'>
      <label data-testid='sc-select-label'>Country</label>
      <p data-testid='sc-select-description'>Filter the list by country</p>
    </ScSelectWrapper>
    <ScSearchIcon data-testid='sc-search-icon-wrapper'>
      <svg data-testid='sc-search-icon' viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
    </ScSearchIcon>
    <ScCountrySearchInput data-testid='sc-search-input' defaultValue='Spa' />
    <ScCountryListItem data-testid='sc-list-item'>Spain</ScCountryListItem>

    <ZdHeader data-testid='zd-header-wrapper'><h1 data-testid='zd-header'>Zone</h1></ZdHeader>
    <ZdInputWrapper data-testid='zd-input-wrapper'>
      <label data-testid='zd-input-label'>Name</label>
      <div data-testid='zd-input-value'>Downtown</div>
    </ZdInputWrapper>
  </div>
)
