import React from 'react'

import {
  ActionSelectorWrapper as CmsActionSelector,
  EnableWrapper as CmsEnable,
  HeaderLeft as CmsHeaderLeft,
  PageListTable as CmsTable,
  PageTbody as CmsTbody
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/Cms/styles'
import {
  ActionGroup as LmActionGroup,
  HeaderTitleContainer as LmHeader,
  LanguageSelectorContainer as LmSelector,
  Option as LmOption,
  SelectContent as LmSelectContent,
  ViewIconWrapper as LmViewIcon
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/LanguageManager/styles'
import {
  FieldContainer as LsField,
  LanguageDetailsContainer as LsContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/LanguageSetting/styles'
import {
  TransSpreadContainer as TsContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/LanguageTransSpread/styles'
import {
  TableBody as TtBody,
  TableHeader as TtHeader
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/LanguageTransTable/styles'
import {
  AddNewButton as PeAddNew,
  AllSetting as PeAllSetting,
  ApiKeysListTable as PeTable,
  Description as PeDescription,
  DropdownButtonWrapper as PeDropdown,
  Header as PeHeader,
  Paragraph as PeParagraph,
  PickerExpressContainer as PeContainer,
  Tab as PeTab
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/PickerExpress/styles'

// Batch fixture for a5-settings-language-whitelabel, the last of Wave A.
//
// Mounts the migrated STYLES, not the controllers, for the same reason as a1
// through a4. (`PurchaseAddons` and `PurchaseAddonDetails`, PURCHASE screens, were
// here until the redesign of /purchase/addons deleted their styles.js: .
// Their Product CSS is covered by the literal guard and their unit tests.) SiteSettingDetails and
// SitesAuthSettings left the same way when moved them to Product pieces and deleted their styles.js.
//
// `SelectContent`'s trigger selector is mounted with the class the REAL select
// puts in the DOM. `LegacySelect` renders its root as `select-wrapper`, but the
// `select` token lives on `HeaderItem` — `legacy-select-styles.js` declares it as
// `styled.div.attrs({ className: 'od-legacy-select-trigger select' })`, and
// `LegacySelect.jsx:199` mounts the trigger with `render={<HeaderItem/>}`. One
// classifier read only the root class and called the selector dead; the shape
// below is the one that is actually rendered.
const SelectTrigger = ({ testid, children }) => (
  <div className='od-legacy-select-trigger select'>
    <div className='od-legacy-select-selected' data-testid={testid}>{children}</div>
  </div>
)

// `> div { > div { .dropdown-item } }`, the same two wrappers a2, a3 and a4 need.
const Dropdown = ({ testid, children }) => (
  <div><div><div className='dropdown-item' data-testid={testid}>{children}</div></div></div>
)

export const SettingsA5StylesFixture = () => (
  <div data-testid='settings-a5-styles' style={{ padding: 24, display: 'grid', gap: 12 }}>

    {/* Cms */}
    <CmsHeaderLeft data-testid='cms-header-wrapper'><h1 data-testid='cms-header'>Static Pages Manager</h1></CmsHeaderLeft>
    <CmsTable data-testid='cms-table'>
      <thead><tr><th data-testid='cms-th'>Name</th></tr></thead>
      <CmsTbody data-testid='cms-tbody'><tr><td data-testid='cms-td'>Terms and conditions</td></tr></CmsTbody>
    </CmsTable>
    <CmsEnable data-testid='cms-enable-wrapper'><span data-testid='cms-enable'>Enable</span></CmsEnable>
    <CmsActionSelector data-testid='cms-action-wrapper'><Dropdown testid='cms-action'>Edit</Dropdown></CmsActionSelector>

    {/* LanguageManager */}
    <LmHeader data-testid='lm-header-wrapper'><h1 data-testid='lm-header'>Language Manager</h1></LmHeader>
    {/* The view-mode pair: table-mode (active) and spread (inactive), as LanguageManager renders them */}
    <LmActionGroup data-testid='lm-action-group'>
      <LmViewIcon className='table-mode' active aria-pressed aria-label='List view' data-testid='lm-view-icon-wrapper'>
        <svg aria-hidden='true' data-testid='lm-view-icon' viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
      </LmViewIcon>
      <LmViewIcon aria-pressed={false} aria-label='Spreadsheet' data-testid='lm-view-icon-spread-wrapper'>
        <svg aria-hidden='true' data-testid='lm-view-icon-spread' viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
      </LmViewIcon>
    </LmActionGroup>
    <LmSelectContent data-testid='lm-select-content'>
      <SelectTrigger testid='lm-select-trigger'>Select a product</SelectTrigger>
    </LmSelectContent>
    <LmOption data-testid='lm-option'>Website</LmOption>
    <LmSelector data-testid='lm-selector'>
      <div className='options'><div data-testid='lm-selector-option'>English</div></div>
    </LmSelector>

    {/* LanguageSetting — FieldContainer is mounted with `isHeader`, because its
        `> div` rule lives inside that branch. a2 learned this the hard way: a
        default mount measures the user agent's size and calls it a pass. */}
    <LsContainer data-testid='ls-container-wrapper'><h1 data-testid='ls-container'>Language</h1></LsContainer>
    <LsField isHeader data-testid='ls-field-wrapper'>
      <div data-testid='ls-field-row'>English</div>
      <span className='name' data-testid='ls-field-name'>English</span>
      <span className='default'>
        <svg data-testid='ls-field-default-icon' viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
      </span>
    </LsField>

    {/* LanguageTransSpread / LanguageTransTable — the two translation grids.
        Both selectors are DESCENDANT selectors (`table th > div`, `table td`),
        so the cells sit in the ordinary thead/tbody nesting a browser builds. */}
    <TsContainer data-testid='ts-container'>
      <table>
        <thead><tr><th><div data-testid='ts-th'>Key</div></th></tr></thead>
        <tbody><tr><td data-testid='ts-td'>ACCEPT</td></tr></tbody>
      </table>
    </TsContainer>
    <table>
      <TtHeader data-testid='tt-header'><tr><th data-testid='tt-th'>Key</th></tr></TtHeader>
      <TtBody data-testid='tt-body'><tr><td data-testid='tt-td'>ACCEPT</td></tr></TtBody>
    </table>

    {/* PickerExpress — the sixth file of a4's connector family */}
    <PeContainer data-testid='pe-container'>
      <button type='button' className='all-setting'><span data-testid='pe-container-all-setting'>All settings</span></button>
    </PeContainer>
    <PeHeader data-testid='pe-header-wrapper'>
      <h1 data-testid='pe-header'>Connect with Picker Express</h1>
      <button type='button' data-testid='pe-header-button'>New</button>
    </PeHeader>
    <PeTable data-testid='pe-table'>
      <tbody><tr><th data-testid='pe-th'>Key</th><td data-testid='pe-td'>sk_test_0000</td></tr></tbody>
    </PeTable>
    <PeDropdown data-testid='pe-dropdown-wrapper'><Dropdown testid='pe-dropdown'>Delete</Dropdown></PeDropdown>
    <PeAddNew data-testid='pe-add-new'>Add new</PeAddNew>
    <PeAllSetting data-testid='pe-all-setting-wrapper'><span data-testid='pe-all-setting'>All settings</span></PeAllSetting>
    <PeDescription data-testid='pe-description'>Dispatch deliveries with Picker Express.</PeDescription>
    <PeTab data-testid='pe-tab'>General</PeTab>
    <PeParagraph data-testid='pe-paragraph'>
      <h2 data-testid='pe-paragraph-h2'>Requirements</h2>
      <p data-testid='pe-paragraph-p'>You need a Picker Express account.</p>
      <span data-testid='pe-paragraph-span'>$99 monthly</span>
      <a data-testid='pe-paragraph-a'>Read the guide</a>
    </PeParagraph>
  </div>
)
