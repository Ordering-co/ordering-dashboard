import React from 'react'

import {
  BusinessName,
  NoSelectedBrand
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessBrandBUSIDetail/styles'
import {
  FormControl,
  Label as BgLabel,
  SwitchWrapper as BgSwitchWrapper,
  ColorWrapper,
  ShapeWrapper,
  UploadImageIcon as BgUploadImageIcon,
  ShapeBoxWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessBrandGENDetail/styles'
import {
  HeaderTitleContainer as BlHeaderTitleContainer,
  BrandListTable,
  BrandBody,
  EnableWrapper,
  InfoBlock,
  DetailHeder,
  Tab as BlTab,
  ActionSelectorWrapper as BlActionSelectorWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessBrandListing/styles'
import {
  Header as SpdHeader,
  ActionSelectorWrapper as SpdActionSelectorWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessServiceProfessionalDetail/styles'
import {
  Header as SpHeader,
  UserInfo,
  AddBtn,
  ProfessionalItemContainer,
  CheckWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessServiceProfessionals/styles'

// Presentation-only fixture: the real Stores business-payments/brands/promos
// styled surfaces for batch b8-business-payments-brands-promos, no controller,
// SDK, account or network. Five source files are mounted; every colliding
// export (`Header`, `Label`, `Option`, `Thead`, `Tbody`, `CheckBoxWrapper`,
// `HeaderTitleContainer`, `ActionSelectorWrapper`, `SectionTitle`,
// `UploadImageIcon`, `Tab`, `EmptyWrapper`, `Badge`, `StatusWrapper`,
// `SwitchWrapper`, `Field` and `Table` — the last two collide too, beyond the
// set called out in the assignment) is aliased at the import site with a
// two-letter folder prefix matching its data-testid prefix (e.g. `Header as
// SpdHeader`). `FormControl` and `InfoBlock` were also flagged as possible
// collisions but only one of these five files exports each — imported
// plainly, no rename needed.
//
// Real-nesting notes and adaptations (checked against each source styles.js
// and its consuming index.js before mounting):
// - BusinessPaymentMethods/styles.js is gone (Lot 5.9, the payments
//   section moved to Product wrappers), so its section (pm- ids) is no longer
//   mounted here.
// - BusinessPaymentAccount/styles.js and BusinessWalletsList/styles.js are gone
//   (Lot 5.11, both screens moved onto Product pieces, the payment
//   account with its own CSS file and the wallets in line), so their sections
//   (pa- and wl- ids: 18 nodes, with the BusinessPaymentAccount probe
//   `pa-enabledwrapper-p` and the WalletOption button) are no longer mounted here.
// - BusinessFeeForm/styles.js, BusinessFees/styles.js and BusinessMarkups/styles.js
//   are gone (Lot 5.13, business fees, the fee form, markups and
//   their detail moved onto Product pieces with their own CSS files), so their
//   sections (ff-, fe- and mk- ids: 31 nodes, with the two "select all"
//   checkbox buttons, the fee event type icon and the orphaned FormHeader,
//   SectionTitle, Field and CheckboxRow) are no longer mounted here.
// - BusinessTaxAndFees/styles.js is gone (Lot 5.12, the tax & fees
//   screen moved onto Product wrappers with its own CSS file), so its section
//   (tf- ids: 8 nodes, with the orphaned `Option` and `OptionCenter`) is no
//   longer mounted here.
// - BusinessBrandBUSIDetail/styles.js's `BusinessName` sits inside a `<label>`
//   alongside an (out-of-scope) `WrapperImage`/`Image`, itself inside
//   `BusinessItemContainer` — mounted at that real depth with plain `div`s
//   standing in for the out-of-scope wrapper/image, matching the b7 fixture's
//   convention for the same shape.
// - BusinessBrandGENDetail/styles.js's `ColorWrapper`/`ShapeWrapper`'s `>
//   label` and `SwitchWrapper`'s `> span` are genuine direct children
//   (`<ColorWrapper><label>...</label><ColorPicker /></ColorWrapper>`,
//   `<SwitchWrapper><span>...</span><Switch /></SwitchWrapper>`).
//   `ShapeBoxWrapper`'s `svg` is a genuine descendant (`<div />` then either
//   `<RecordCircleFill />` or `<Circle />`) — mounted the same way.
// - BusinessBrandListing/styles.js's `DetailHeder` rule is `> div:first-child
//   { > span {...} }`: the first div is a genuine first child and its `span`
//   a genuine direct child — resolves without adaptation. `ActionSelectorWrapper`
//   wraps a real `DefaultSelect` (not a styles.js export in this batch), whose
//   `.select`/`.list`/`.list-wrapper` classes are reproduced with plain `div`s
//   carrying those literal classNames, the same convention used for
//   `SelectWrapper` in the b7 fixture. Both `Tab` instances are already
//   `as='button' type='button' aria-pressed={...}` in index.js.
// - BusinessPromotionCustomFields/styles.js, BusinessPromotionGeneralForm/styles.js
//   and BusinessPromotionList/styles.js are gone (Lot 5.14, the
//   promotions of a store, their form and the custom-fields editor moved onto
//   Product pieces with their own CSS files, the editor promoted to
//   Stores/MetaFieldsEditor), so their sections (pc-, pg- and pl- ids: 28 nodes,
//   with the glyph preservations of the camera, the upload icon and the date
//   chevron and the two promotion tabs) are no longer mounted here.
// - BusinessServiceProfessionalDetail/styles.js's `ActionSelectorWrapper` wraps
//   a react-bootstrap `DropdownButton`/`Dropdown.Item` (not a `DefaultSelect`),
//   whose real DOM is a `.dropdown` wrapper with a toggle `<button>` (containing
//   the title icon directly — rule `button > svg`) and a `.dropdown-menu` holding
//   `.dropdown-item` entries (rule `> div > div > .dropdown-item`) — mounted
//   with plain `div`/`button` elements carrying those literal classNames
//   rather than the b7/b8-BrandListing `.select` shape, since the underlying
//   component here is genuinely different.
// - BusinessServiceProfessionals/styles.js's `ProfessionalItemContainer`'s `>
//   svg` is the genuine direct-child `<ChevronRight />` sibling of
//   `CheckWrapper`. `AddBtn` is already `as='button' type='button'` in
//   index.js (no `aria-pressed` — it is a plain action button, not a toggle).
//   `CheckWrapper`'s `span > svg` checkbox marker is entirely COMMENTED OUT in
//   the live render (index.js:155-159 — only the `<label>` with
//   `WrapperImage`/`UserInfo` renders). Mounted the real `CheckWrapper` (label
//   only) AND, separately, a SYNTHETIC PROBE `<CheckWrapper><span><svg /></span>
//   </CheckWrapper>` carrying `sp-checkwrapper-span-svg`, per the assignment's
//   explicit instruction — this probe does not exist in the live UI.
export const StoresB8StylesFixture = () => {
  return (
    <main data-testid='stores-b8-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>

      <section data-testid='business-brand-busi-detail-group' aria-label='Brand businesses'>
        <div>
          <label>
            <div>
              <div />
            </div>
            <BusinessName data-testid='bb-businessname-root'>Sample Restaurant</BusinessName>
          </label>
        </div>
        <NoSelectedBrand data-testid='bb-noselectedbrand-root'>There is no selected brand</NoSelectedBrand>
      </section>

      <section data-testid='business-brand-gen-detail-group' aria-label='Brand general'>
        <FormControl>
          <BgLabel data-testid='bg-label-root'>Name</BgLabel>
          <input data-testid='bg-formcontrol-input' type='text' placeholder='Write a name' aria-label='Name' />
        </FormControl>
        <BgSwitchWrapper>
          <span data-testid='bg-switchwrapper-span'>Ribbon</span>
          <input type='checkbox' aria-label='Ribbon' readOnly />
        </BgSwitchWrapper>
        <ColorWrapper>
          <label data-testid='bg-colorwrapper-label'>Color</label>
        </ColorWrapper>
        <ShapeWrapper>
          <label data-testid='bg-shapewrapper-label'>Shape</label>
          <ShapeBoxWrapper active>
            <div />
            <svg data-testid='bg-shapeboxwrapper-svg' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><circle cx='8' cy='8' r='6' fill='none' stroke='currentColor' /></svg>
          </ShapeBoxWrapper>
        </ShapeWrapper>
        <BgUploadImageIcon>
          <svg viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><rect x='2' y='2' width='12' height='12' fill='none' stroke='currentColor' /></svg>
          <span data-testid='bg-uploadimageicon-span'>Drag and drop</span>
        </BgUploadImageIcon>
      </section>

      <section data-testid='business-brand-listing-group' aria-label='Brand listing'>
        <BlHeaderTitleContainer>
          <h1 data-testid='bl-headertitlecontainer-h1'>Brand manager</h1>
        </BlHeaderTitleContainer>
        <BrandListTable>
          <thead>
            <tr>
              <th data-testid='bl-brandlisttable-thead-th'>Name</th>
              <th>Actions</th>
            </tr>
          </thead>
          <BrandBody>
            <tr>
              <td>
                <div>
                  <div />
                  <InfoBlock>
                    <p data-testid='bl-infoblock-p'>Sample Restaurant</p>
                  </InfoBlock>
                </div>
              </td>
              <td data-testid='bl-brandbody-td'>
                <EnableWrapper className='brand_enable_control'>
                  <span data-testid='bl-enablewrapper-span'>Enable</span>
                  <input type='checkbox' aria-label='Enable' defaultChecked readOnly />
                </EnableWrapper>
              </td>
            </tr>
          </BrandBody>
        </BrandListTable>
        <DetailHeder>
          <div>
            <span data-testid='bl-detailheder-div-first-child-span'>Sample Brand</span>
          </div>
          <div>
            <BlActionSelectorWrapper>
              <div className='select'>
                <div>
                  <svg data-testid='bl-actionselectorwrapper-select-div-first-child-svg' viewBox='0 0 16 16' width='20' height='20' aria-hidden='true' focusable='false'><circle cx='2' cy='8' r='1.4' /><circle cx='8' cy='8' r='1.4' /><circle cx='14' cy='8' r='1.4' /></svg>
                </div>
                <div className='list'>
                  <div className='list-wrapper'>
                    <div data-testid='bl-actionselectorwrapper-select-list-list-wrapper-div'>Delete</div>
                  </div>
                </div>
              </div>
            </BlActionSelectorWrapper>
          </div>
        </DetailHeder>
        <div>
          <BlTab as='button' type='button' active aria-pressed='true' data-testid='bl-tab-root-14'>General</BlTab>
          <BlTab as='button' type='button' aria-pressed='false' data-testid='bl-tab-root-12'>Businesses</BlTab>
        </div>
      </section>

      <section data-testid='business-service-professional-detail-group' aria-label='Professional detail'>
        <SpdHeader>
          <h1 data-testid='spd-header-h1'>Ana Smith</h1>
          <div>
            <SpdActionSelectorWrapper>
              <div className='dropdown'>
                <button type='button' aria-label='More actions'>
                  <svg data-testid='spd-actionselectorwrapper-button-svg' viewBox='0 0 16 16' width='20' height='20' aria-hidden='true' focusable='false'><circle cx='2' cy='8' r='1.4' /><circle cx='8' cy='8' r='1.4' /><circle cx='14' cy='8' r='1.4' /></svg>
                </button>
                <div className='dropdown-menu'>
                  <button type='button' className='dropdown-item' data-testid='spd-actionselectorwrapper-div-div-dropdown-item'>Delete</button>
                </div>
              </div>
            </SpdActionSelectorWrapper>
            <button type='button' aria-label='Close'>
              <svg viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M2 2l12 12M14 2L2 14' fill='none' stroke='currentColor' /></svg>
            </button>
          </div>
        </SpdHeader>
      </section>

      <section data-testid='business-service-professionals-group' aria-label='Professionals'>
        <SpHeader>
          <h1 data-testid='sp-header-h1'>Professionals</h1>
          <button type='button'>Add professional</button>
        </SpHeader>
        <ProfessionalItemContainer>
          <CheckWrapper>
            <label>
              <div>
                <div />
              </div>
              <UserInfo>
                <h3 data-testid='sp-userinfo-h3'>Ana Smith</h3>
                <p data-testid='sp-userinfo-p'>ana@example.com</p>
              </UserInfo>
            </label>
          </CheckWrapper>
          <svg data-testid='sp-professionalitemcontainer-svg' viewBox='0 0 16 16' width='18' height='18' aria-hidden='true' focusable='false'><path d='M6 4l4 4-4 4' fill='none' stroke='currentColor' /></svg>
        </ProfessionalItemContainer>
        {/* SYNTHETIC PROBE — see file header: CheckWrapper's span>svg checkbox
            marker is fully commented out in the live render (index.js:155-159). */}
        <CheckWrapper>
          <span>
            <svg data-testid='sp-checkwrapper-span-svg' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M3 8l3 3 7-7' fill='none' stroke='currentColor' /></svg>
          </span>
        </CheckWrapper>
        <AddBtn as='button' type='button' data-testid='sp-addbtn-root'>Add professional</AddBtn>
      </section>

    </main>
  )
}
