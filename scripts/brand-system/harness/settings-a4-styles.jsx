import React from 'react'

import {
  ApiKeysListTable as AkTable,
  DropdownButtonWrapper as AkDropdown,
  Header as AkHeader
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/ApiKeysList/styles'
import {
  AddNewButton as BcAddNew,
  AllSetting as BcAllSetting,
  ApiKeysListTable as BcTable,
  Description as BcDescription,
  DoordashConnectContainer as BcContainer,
  DropdownButtonWrapper as BcDropdown,
  Header as BcHeader,
  Paragraph as BcParagraph,
  Tab as BcTab
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/BacCredomatic/styles'
import {
  AddNewButton as DlAddNew,
  AllSetting as DlAllSetting,
  ApiKeysListTable as DlTable,
  DeliverectContainer as DlContainer,
  Description as DlDescription,
  DropdownButtonWrapper as DlDropdown,
  GetStarted as DlGetStarted,
  Header as DlHeader,
  Tab as DlTab
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/Deliverect/styles'
import {
  AddNewButton as DdAddNew,
  AllSetting as DdAllSetting,
  ApiKeysListTable as DdTable,
  Description as DdDescription,
  DoordashConnectContainer as DdContainer,
  DropdownButtonWrapper as DdDropdown,
  Header as DdHeader,
  Paragraph as DdParagraph,
  Tab as DdTab
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/DoordashConnect/styles'
import {
  CategorySection as IlCategory,
  Header as IlHeader,
  IconWrapper as IlIconWrapper,
  SettingItemContainer as IlItemContainer,
  SettingItemContent as IlItemContent,
  Tab as IlTab
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/IntegrationListing/styles'
import {
  AddNewButton as IcAddNew,
  ApiKeysListTable as IcTable,
  Description as IcDescription,
  DropdownButtonWrapper as IcDropdown,
  GetStarted as IcGetStarted,
  Header as IcHeader,
  ItsaCheckmateContainer as IcContainer,
  Tab as IcTab
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/ItsaCheckmate/styles'
import {
  AddNewButton as LmAddNew,
  AllSetting as LmAllSetting,
  ApiKeysListTable as LmTable,
  Description as LmDescription,
  DropdownButtonWrapper as LmDropdown,
  Header as LmHeader,
  LalaMoveConnectContainer as LmContainer,
  Paragraph as LmParagraph,
  Tab as LmTab
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/LalaMoveConnect/styles'
import {
  ActionSelectorWrapper as PlActionSelector,
  EnableWrapper as PlEnable,
  Header as PlHeader,
  PluginTbody as PlTbody,
  PluginsTable as PlTable
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/PluginList/styles'
import {
  DropdownButtonWrapper as WhDropdown,
  Header as WhHeader,
  WebhookListTable as WhTable
} from '../../../src/@/components-dashboard/src/ui/src/components/Settings/WebhookList/styles'

// Batch fixture for a4-settings-integrations. Mounts the migrated STYLES, not
// the controllers, for the same reason as a1 through a3: these screens talk to
// Stripe, DoorDash, Lalamove, Deliverect and ItsaCheckmate, and section 5.1 of
// the goal forbids reaching any of them. Nothing here performs a request.
//
// Four components of this batch — ApiKeysListTable, DropdownButtonWrapper,
// AddNewButton and AllSetting — are DEAD EXPORTS in the connector files: the
// index.js of BacCredomatic, Deliverect and DoordashConnect never renders them.
// They are migrated and mounted anyway, under the distinction this layer already
// applies: a dead EXPORT can still be mounted by a fixture and therefore
// measured, while a dead SELECTOR inside a live component cannot. The spec
// measures them here exactly as it measures the live ones.
//
// A `dropdown` shape appears three times (AkDropdown, the connector dropdowns and
// PlActionSelector). Its rule lives under `> div { > div { .dropdown-item } }`,
// so each mount needs the two wrapper divs; a flatter mount would measure the
// user agent's size and report it as a pass.
const Dropdown = ({ testid, children }) => (
  <div><div><div className='dropdown-item' data-testid={testid}>{children}</div></div></div>
)

// `tr > th, td` and `th, td` both require the cells to sit inside a table row,
// which is also the only markup the browser will keep: a <th> outside a <tr> is
// dropped by the HTML parser before any measurement happens.
const CellRow = ({ thTestid, tdTestid }) => (
  <tbody>
    <tr>
      <th data-testid={thTestid}>Key</th>
      <td data-testid={tdTestid}>sk_test_0000</td>
    </tr>
  </tbody>
)

export const SettingsA4StylesFixture = () => (
  <div data-testid='settings-a4-styles' style={{ padding: 24, display: 'grid', gap: 12 }}>

    {/* ApiKeysList */}
    <AkHeader data-testid='ak-header-wrapper'><h1 data-testid='ak-header'>API keys</h1></AkHeader>
    <AkTable data-testid='ak-table'><CellRow thTestid='ak-th' tdTestid='ak-td' /></AkTable>
    <AkDropdown data-testid='ak-dropdown-wrapper'><Dropdown testid='ak-dropdown'>Delete</Dropdown></AkDropdown>

    {/* BacCredomatic */}
    <BcContainer data-testid='bc-container'>
      <button type='button' className='all-setting'><span data-testid='bc-container-all-setting'>All settings</span></button>
    </BcContainer>
    <BcHeader data-testid='bc-header-wrapper'><h1 data-testid='bc-header'>BAC Credomatic</h1></BcHeader>
    <BcTable data-testid='bc-table'><CellRow thTestid='bc-th' tdTestid='bc-td' /></BcTable>
    <BcDropdown data-testid='bc-dropdown-wrapper'><Dropdown testid='bc-dropdown'>Delete</Dropdown></BcDropdown>
    <BcAddNew data-testid='bc-add-new'>Add new</BcAddNew>
    <BcAllSetting data-testid='bc-all-setting-wrapper'><span data-testid='bc-all-setting'>All settings</span></BcAllSetting>
    <BcDescription data-testid='bc-description'>Accept card payments through BAC Credomatic.</BcDescription>
    <BcTab data-testid='bc-tab'>Settings</BcTab>
    <BcParagraph data-testid='bc-paragraph'>
      <h3 data-testid='bc-paragraph-h3'>Before you start</h3>
      <p data-testid='bc-paragraph-p'>You need a merchant account.</p>
      <span data-testid='bc-paragraph-span'>Contact your account manager.</span>
      <a data-testid='bc-paragraph-a'>Read the guide</a>
    </BcParagraph>

    {/* Deliverect */}
    <DlContainer data-testid='dl-container'>
      <button type='button' className='all-setting'><span data-testid='dl-container-all-setting'>All settings</span></button>
    </DlContainer>
    <DlHeader data-testid='dl-header-wrapper'>
      <h1 data-testid='dl-header'>Deliverect</h1>
      <button type='button' data-testid='dl-header-button'>Disconnect</button>
    </DlHeader>
    <DlTable data-testid='dl-table'><CellRow thTestid='dl-th' tdTestid='dl-td' /></DlTable>
    <DlDropdown data-testid='dl-dropdown-wrapper'><Dropdown testid='dl-dropdown'>Delete</Dropdown></DlDropdown>
    <DlAddNew data-testid='dl-add-new'>Add new</DlAddNew>
    <DlAllSetting data-testid='dl-all-setting-wrapper'><span data-testid='dl-all-setting'>All settings</span></DlAllSetting>
    <DlDescription data-testid='dl-description'>Send orders to Deliverect.</DlDescription>
    <DlTab data-testid='dl-tab'>Settings</DlTab>
    <DlGetStarted data-testid='dl-get-started'>
      <h2 data-testid='dl-get-started-h2'>Get started</h2>
      <p data-testid='dl-get-started-p'>Connect your Deliverect account.</p>
    </DlGetStarted>

    {/* DoordashConnect */}
    <DdContainer data-testid='dd-container'>
      <button type='button' className='all-setting'><span data-testid='dd-container-all-setting'>All settings</span></button>
    </DdContainer>
    <DdHeader data-testid='dd-header-wrapper'><h1 data-testid='dd-header'>DoorDash Drive</h1></DdHeader>
    <DdTable data-testid='dd-table'><CellRow thTestid='dd-th' tdTestid='dd-td' /></DdTable>
    <DdDropdown data-testid='dd-dropdown-wrapper'><Dropdown testid='dd-dropdown'>Delete</Dropdown></DdDropdown>
    <DdAddNew data-testid='dd-add-new'>Add new</DdAddNew>
    <DdAllSetting data-testid='dd-all-setting-wrapper'><span data-testid='dd-all-setting'>All settings</span></DdAllSetting>
    <DdDescription data-testid='dd-description'>Dispatch deliveries with DoorDash Drive.</DdDescription>
    <DdTab data-testid='dd-tab'>Settings</DdTab>
    {/*
      DoordashConnect's Paragraph heading is an h2 and BacCredomatic's is an h3.
      That single line is the only difference between the two files, and both
      take `section-title` — the role follows the job of the text, not the tag.
    */}
    <DdParagraph data-testid='dd-paragraph'>
      <h2 data-testid='dd-paragraph-h2'>Before you start</h2>
      <p data-testid='dd-paragraph-p'>You need a DoorDash developer account.</p>
      <span data-testid='dd-paragraph-span'>Contact your account manager.</span>
      <a data-testid='dd-paragraph-a'>Read the guide</a>
    </DdParagraph>

    {/* IntegrationListing */}
    <IlHeader data-testid='il-header-wrapper'><h1 data-testid='il-header'>Integrations</h1></IlHeader>
    <IlCategory data-testid='il-category'><h2 data-testid='il-category-h2'>Payments</h2></IlCategory>
    <IlItemContent data-testid='il-item-content'>
      <h5 data-testid='il-item-title'>Stripe</h5>
      <p data-testid='il-item-description'>Accept cards online.</p>
    </IlItemContent>
    <IlTab data-testid='il-tab'>All</IlTab>
    {/*
      The THREE preservations of this batch size an icon glyph, not readable text,
      and each is mounted so the spec can measure that it stayed at its literal
      size rather than assert the absence of a rule:
        - IconWrapper svg, 24px: the glyph of the card icon (default markup);
        - SettingItemContainer > svg, 18px: the chevron of the stacked row, a
          DIRECT child of the container (`$stack`), as index.js renders it;
        - IconWrapper svg, 16px: the glyph of the compact icon (`$compact`), as
          index.js renders it for the same stacked row.
      The three use the real styled components of the product, with the same
      transient props index.js passes (`$stack`, `$compact`).
    */}
    <IlIconWrapper data-testid='il-icon-wrapper'>
      <svg data-testid='il-icon' viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
    </IlIconWrapper>
    <IlItemContainer data-testid='il-stack-container' $stack>
      <IlIconWrapper data-testid='il-icon-compact-wrapper' $compact>
        <svg data-testid='il-icon-compact' viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
      </IlIconWrapper>
      <IlItemContent data-testid='il-stack-content' $stack>
        <h5>Stripe</h5>
        <p>Accept cards online.</p>
      </IlItemContent>
      <svg data-testid='il-chevron' viewBox='0 0 16 16' width='1em' height='1em'><path d='M6 3l5 5-5 5' /></svg>
    </IlItemContainer>

    {/* ItsaCheckmate */}
    <IcContainer data-testid='ic-container'>
      <button type='button' className='all-setting'><span data-testid='ic-container-all-setting'>All settings</span></button>
    </IcContainer>
    <IcHeader data-testid='ic-header-wrapper'>
      <h1 data-testid='ic-header'>ItsaCheckmate</h1>
      <button type='button' data-testid='ic-header-button'>Disconnect</button>
    </IcHeader>
    <IcTable data-testid='ic-table'><CellRow thTestid='ic-th' tdTestid='ic-td' /></IcTable>
    <IcDropdown data-testid='ic-dropdown-wrapper'><Dropdown testid='ic-dropdown'>Delete</Dropdown></IcDropdown>
    <IcAddNew data-testid='ic-add-new'>Add new</IcAddNew>
    <IcDescription data-testid='ic-description'>
      Sync your menus with ItsaCheckmate.
      <div className='sub-header' data-testid='ic-description-sub-header'>What you get</div>
      <div className='menu-item'>
        <svg viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
        <p data-testid='ic-description-menu-item'>One menu across every channel</p>
      </div>
    </IcDescription>
    <IcTab data-testid='ic-tab'>Settings</IcTab>
    <IcGetStarted data-testid='ic-get-started'>
      <h2 data-testid='ic-get-started-h2'>Get started</h2>
      <p data-testid='ic-get-started-p'>Connect your ItsaCheckmate account.</p>
    </IcGetStarted>

    {/* LalaMoveConnect */}
    <LmContainer data-testid='lm-container'>
      <button type='button' className='all-setting'><span data-testid='lm-container-all-setting'>All settings</span></button>
    </LmContainer>
    <LmHeader data-testid='lm-header-wrapper'>
      <h1 data-testid='lm-header'>Lalamove</h1>
      <button type='button' data-testid='lm-header-button'>Disconnect</button>
    </LmHeader>
    <LmTable data-testid='lm-table'><CellRow thTestid='lm-th' tdTestid='lm-td' /></LmTable>
    <LmDropdown data-testid='lm-dropdown-wrapper'><Dropdown testid='lm-dropdown'>Delete</Dropdown></LmDropdown>
    <LmAddNew data-testid='lm-add-new'>Add new</LmAddNew>
    <LmAllSetting data-testid='lm-all-setting-wrapper'><span data-testid='lm-all-setting'>All settings</span></LmAllSetting>
    <LmDescription data-testid='lm-description'>Dispatch deliveries with Lalamove.</LmDescription>
    <LmTab data-testid='lm-tab'>Settings</LmTab>
    <LmParagraph data-testid='lm-paragraph'>
      <h2 data-testid='lm-paragraph-h2'>Before you start</h2>
      <p data-testid='lm-paragraph-p'>You need a Lalamove partner account.</p>
      <span data-testid='lm-paragraph-span'>Contact your account manager.</span>
      <a data-testid='lm-paragraph-a'>Read the guide</a>
    </LmParagraph>

    {/* PluginList */}
    <PlHeader data-testid='pl-header-wrapper'><h1 data-testid='pl-header'>Plugins</h1></PlHeader>
    <PlTable data-testid='pl-table'>
      <thead><tr><th data-testid='pl-th'>Name</th></tr></thead>
      <PlTbody data-testid='pl-tbody'><tr><td data-testid='pl-td'>Analytics</td></tr></PlTbody>
    </PlTable>
    <PlEnable data-testid='pl-enable-wrapper'><span data-testid='pl-enable'>Enable</span></PlEnable>
    <PlActionSelector data-testid='pl-action-selector-wrapper'><Dropdown testid='pl-action-selector'>Edit</Dropdown></PlActionSelector>

    {/* WebhookList */}
    <WhHeader data-testid='wh-header-wrapper'><h1 data-testid='wh-header'>Webhooks</h1></WhHeader>
    <WhTable data-testid='wh-table'><CellRow thTestid='wh-th' tdTestid='wh-td' /></WhTable>
    <WhDropdown data-testid='wh-dropdown-wrapper'><Dropdown testid='wh-dropdown'>Delete</Dropdown></WhDropdown>
  </div>
)
