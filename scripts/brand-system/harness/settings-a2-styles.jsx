import React from 'react'

import {
  AddressFieldsDetailsContainer as AfDetails,
  FieldContainer as AfFieldContainer,
  Header as AfHeader,
  SiteItem as AfSiteItem
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/AddressFieldsSetting/styles'
import {
  CardFieldsDetailsContainer as CfDetails,
  FieldContainer as CfFieldContainer,
  Header as CfHeader,
  SiteItem as CfSiteItem
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/CardFieldsSetting/styles'
import {
  CheckoutFieldsDetailsContainer as ChfDetails,
  FieldContainer as ChfFieldContainer,
  Header as ChfHeader,
  SiteItem as ChfSiteItem
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/CheckoutFieldsSetting/styles'
import {
  ActionSelectorWrapper as DolActionSelector,
  ActionsContainer as DolActions,
  CheckboxWrapper as DolCheckbox,
  CityName as DolCity,
  CountryName as DolCountry,
  DropdownOptionName as DolName,
  EnableWrapper as DolEnable
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/DropdownOptionList/styles'
import {
  AccordionTitle as EsAccordionTitle,
  Option as EsOption,
  SelectWrapper as EsSelectWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/EmailSetting/styles'
import {
  FieldContainer as GcfFieldContainer,
  InfoContent as GcfInfoContent,
  Option as GcfOption,
  SelectWrapper as GcfSelectWrapper,
  TitleWrapper as GcfTitleWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/GuestCheckoutFieldsSetting/styles'
import {
  CloseButton as IiCloseButton,
  InsertImageContainer as IiContainer,
  WrapperInput as IiWrapperInput
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/InsertImage/styles'
import {
  CheckboxWrapper as IlCheckboxWrapper,
  InsertLinkContainer as IlContainer,
  WrapperInput as IlWrapperInput
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/InsertLink/styles'
import {
  AccordionTitle as NsAccordionTitle,
  TitleWrapper as NsTitleWrapper,
  ToggleItemWrapper as NsToggleItem
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/NotificationSetting/styles'
import {
  CameraWrapper as PfCameraWrapper,
  Header as PfHeader,
  InputWrapper as PfInputWrapper,
  WrapperEditor as PfWrapperEditor,
  WrapperShortDescription as PfShortDescription
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/PageForm/styles'

// Batch fixture for a2-settings-fields.
//
// Same shape as a1's and for the same reason: it mounts the migrated STYLES, not
// the controllers, which keeps the batch inside the third-party boundary of the
// goal's section 5.1.
//
// `Settings/CustomOrder` is the exception and it is why this batch exists in the
// shape it does: it has no styles.js and declares its five styled components
// INSIDE index.js, where they are not exported. They cannot be imported here, so
// they are not mounted — that is a declared gap in this fixture's coverage, not
// an oversight, and the batch record names it.
export const SettingsA2StylesFixture = () => (
  <div data-testid='settings-a2-styles' style={{ padding: 24, display: 'grid', gap: 12 }}>

    {/* AddressFieldsSetting */}
    <AfHeader data-testid='af-header-wrapper'><h1 data-testid='af-header'>Address fields</h1></AfHeader>
    <AfSiteItem data-testid='af-site-item'>
      <span data-testid='af-site-name'>United States</span>
      <svg data-testid='af-site-chevron' viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
    </AfSiteItem>
    <AfDetails data-testid='af-details-wrapper'><h1 data-testid='af-details'>Settings</h1></AfDetails>
    <AfFieldContainer isHeader data-testid='af-field-wrapper'>
      <div data-testid='af-field-row'>Street</div>
      <span className='name' data-testid='af-field-name'>Street</span>
    </AfFieldContainer>

    {/* CardFieldsSetting */}
    <CfHeader data-testid='cf-header-wrapper'><h1 data-testid='cf-header'>Credit card fields</h1></CfHeader>
    <CfSiteItem data-testid='cf-site-item'>
      <span data-testid='cf-site-name'>United States</span>
      <svg data-testid='cf-site-chevron' viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
    </CfSiteItem>
    <CfDetails data-testid='cf-details-wrapper'><h1 data-testid='cf-details'>Settings</h1></CfDetails>
    <CfFieldContainer isHeader data-testid='cf-field-wrapper'>
      <div data-testid='cf-field-row'>Card number</div>
      <span className='name' data-testid='cf-field-name'>Card number</span>
    </CfFieldContainer>

    {/* CheckoutFieldsSetting */}
    <ChfHeader data-testid='chf-header-wrapper'><h1 data-testid='chf-header'>Cart and customer fields</h1></ChfHeader>
    <ChfSiteItem data-testid='chf-site-item'>
      <span data-testid='chf-site-name'>United States</span>
      <svg data-testid='chf-site-chevron' viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
    </ChfSiteItem>
    <ChfDetails data-testid='chf-details-wrapper'><h1 data-testid='chf-details'>Settings</h1></ChfDetails>
    <ChfFieldContainer isHeader data-testid='chf-field-wrapper'>
      <div data-testid='chf-field-row'>Email</div>
      <span className='name' data-testid='chf-field-name'>Email</span>
    </ChfFieldContainer>

    {/*
      `FieldContainer` is mounted with `isHeader` on purpose: its `> div` rule
      lives INSIDE that conditional branch and does not exist without it. A
      fixture that mounted the default state would measure a node the rule never
      reaches and report the user agent's size — which is exactly what it did
      before this prop was added.
    */}

    {/* DropdownOptionList — the four columns of one table, decided together */}
    <DolName data-testid='dol-name'>Downtown zone</DolName>
    <DolCity data-testid='dol-city'>City</DolCity>
    <DolCountry data-testid='dol-country'>Country</DolCountry>
    <DolActions data-testid='dol-actions'>Actions</DolActions>
    <DolEnable data-testid='dol-enable-wrapper'><span data-testid='dol-enable'>Enable</span></DolEnable>
    <DolActionSelector data-testid='dol-action-selector-wrapper'>
      <div><div><div className='dropdown-item' data-testid='dol-action-selector'>Edit</div></div></div>
    </DolActionSelector>
    <DolCheckbox data-testid='dol-checkbox-wrapper'>
      <svg data-testid='dol-checkbox-icon' viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
    </DolCheckbox>

    {/* EmailSetting */}
    <EsAccordionTitle data-testid='es-accordion-title'>General</EsAccordionTitle>
    <EsSelectWrapper data-testid='es-select-wrapper'>
      <label data-testid='es-select-label'>Email provider</label>
      <div><div data-testid='es-select-value'>Sendgrid</div></div>
    </EsSelectWrapper>
    <EsOption data-testid='es-option'>Yes</EsOption>

    {/* GuestCheckoutFieldsSetting */}
    <GcfSelectWrapper data-testid='gcf-select-wrapper'>
      <label data-testid='gcf-select-label'>Guest checkout</label>
      <div><div data-testid='gcf-select-value'>Enabled</div></div>
    </GcfSelectWrapper>
    <GcfOption data-testid='gcf-option'>Yes</GcfOption>
    <GcfFieldContainer isHeader data-testid='gcf-field-wrapper'>
      <div data-testid='gcf-field-row'>Phone</div>
      <span className='name' data-testid='gcf-field-name'>Phone</span>
    </GcfFieldContainer>
    {/* The only h1 of its screen, which is why it takes `title` where the three
        *FieldsDetailsContainer headings above take `section-title`. */}
    <GcfTitleWrapper data-testid='gcf-title-wrapper'><h1 data-testid='gcf-title'>Guest checkout fields</h1></GcfTitleWrapper>
    <GcfInfoContent data-testid='gcf-info-content'>Fields a guest must fill in</GcfInfoContent>

    {/* InsertImage / InsertLink */}
    <IiContainer data-testid='ii-container-wrapper'><h1 data-testid='ii-container'>Insert image</h1></IiContainer>
    <IiCloseButton data-testid='ii-close-wrapper'>
      <svg data-testid='ii-close-icon' viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
    </IiCloseButton>
    <IiWrapperInput data-testid='ii-input-wrapper'><label data-testid='ii-input-label'>Image URL</label></IiWrapperInput>
    <IlContainer data-testid='il-container-wrapper'><h1 data-testid='il-container'>Insert link</h1></IlContainer>
    <IlWrapperInput data-testid='il-input-wrapper'><label data-testid='il-input-label'>Link URL</label></IlWrapperInput>
    <IlCheckboxWrapper data-testid='il-checkbox-wrapper'><span data-testid='il-checkbox-label'>Open in a new window</span></IlCheckboxWrapper>

    {/* NotificationSetting */}
    {/* ContextAwareToggle renders the title inside ToggleItemWrapper; the second one is the open (active) state */}
    <NsToggleItem aria-expanded={false} data-testid='ns-toggle'>
      <NsAccordionTitle data-testid='ns-accordion-title'>Administrator</NsAccordionTitle>
    </NsToggleItem>
    <NsToggleItem active aria-expanded data-testid='ns-toggle-active'>
      <NsAccordionTitle data-testid='ns-accordion-title-active'>General</NsAccordionTitle>
    </NsToggleItem>
    <NsTitleWrapper data-testid='ns-title-wrapper'><label data-testid='ns-title-label'>Order notifications</label></NsTitleWrapper>

    {/* PageForm */}
    <PfHeader data-testid='pf-header-wrapper'><h1 data-testid='pf-header'>Page</h1></PfHeader>
    <PfInputWrapper data-testid='pf-input-wrapper'><label data-testid='pf-input-label'>Title</label></PfInputWrapper>
    <PfShortDescription data-testid='pf-short-wrapper'><label data-testid='pf-short-label'>Short description</label></PfShortDescription>
    <PfWrapperEditor data-testid='pf-editor-wrapper'>
      <div className='note-editor'>
        <div className='note-dropdown-menu'>
          <h1 data-testid='pf-editor-heading'>Heading 1</h1>
        </div>
      </div>
    </PfWrapperEditor>
    <PfCameraWrapper data-testid='pf-camera-wrapper'>
      <svg data-testid='pf-camera-icon' viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
    </PfCameraWrapper>
  </div>
)
