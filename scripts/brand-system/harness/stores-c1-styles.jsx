import React from 'react'

import {
  PropertyOption,
  Option,
  OptionCenter,
  LabelCustom,
  WeightWrapper,
  PricePerUnit
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/ProductDetailsAdvanced/styles'
import {
  Container as PdcContainer,
  HeaderTitleContainer,
  InfoWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/ProductDetailsCategories/styles'
import {
  UploadImageIcon,
  InputWrapper,
  InventoryWrapper,
  Wrapper,
  RegularWrapper,
  ColorWrapper,
  ShapeWrapper,
  ShapeBoxWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/ProductDetatilsInformation/styles'
import {
  Container as PmdContainer,
  Tab as PmdTab
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/ProductMainDetails/styles'
import {
  MetaTitle,
  MetaContainer,
  MetaAddContainer,
  RoundBorder,
  NoMetaField
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/ProductMetaFields/styles'
import {
  ModalHeader,
  ProductFormTitle,
  SkuContent,
  SectionTitle,
  Tab as PdpTab,
  IngredientContainer,
  ProductInfo,
  OptionTitle,
  OptionFlag,
  IconControl,
  SuoptionText,
  QuantityControl,
  PositionControl,
  SuboptionPrice,
  ProductActions
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/ProductDesktopPreview/styles'

// Presentation-only fixture: the real Stores product-core styled surfaces for
// batch c1-product-core, no controller, SDK, account or network. Six source
// files are mounted (eight before main deleted ProductStep, , and
// deleted ProductSummary as dead code); the only colliding export across them is `Container`
// (ProductDetailsCategories vs. ProductMainDetails) and `Tab`
// (ProductMainDetails vs. ProductDesktopPreview) — both aliased at the import
// site with a two-letter folder prefix matching their data-testid prefix
// (`Container as PdcContainer` / `PmdContainer`, `Tab as PmdTab` / `PdpTab`).
// `ProductFormTitle` is also imported from ProductDesktopPreview/styles even
// though it carries no testid of its own — it is the real, undisturbed parent
// of `ProductInfo`'s `h1`/`.price-wrapper`/`p` and of `SkuContent` in that
// component's live render, and reproducing it costs nothing.
//
// Real-nesting notes and adaptations (checked against each source styles.js
// and its consuming index.js before mounting):
// - ProductDetailsAdvanced/styles.js's `PropertyOption`'s `label:first-child`
//   is a genuine first child in every real call site
//   (`<PropertyOption><label>...</label><Switch /></PropertyOption>`) —
//   mounted the same way with a literal checkbox input standing in for
//   `Switch` (out of batch), matching the b8 fixture's convention for
//   `Switch`. `Option`/`OptionCenter` are mounted as bare content, matching
//   their real usage as inline `<Option>{...}</Option>` / `<OptionCenter
//   onClick={...}>{...}</OptionCenter>` select-option content — no onClick is
//   attached here since this fixture carries no real handlers.
//   `WeightWrapper`'s `.select` rule targets the real `<Select notAsync
//   .../>` rendered as its second child; `Select`'s own root genuinely
//   carries a literal `select` className (verified in
//   `styles/Select/FirstSelect/index.test.jsx`: `expect(root).toHaveClass
//   ('select')`), so a `div.select` stands in for it, the same convention
//   `PricePerUnit` below and the b7/b8 fixtures use for that same shared
//   `Select`.
// - ProductDetailsAdvanced/styles.js's `PricePerUnit` is a DEAD EXPORT per
//   the assignment: grepping the repo shows it is never imported anywhere.
//   Mounted anyway, per its declared CSS shape (`label` then `.select` as
//   plain descendants), with this note — no live consumer to check nesting
//   against.
// - ProductDetailsCategories/styles.js's `Container`'s `h1` and
//   `HeaderTitleContainer`'s `h2` are ORPHANED SELECTORS per the assignment:
//   ProductDetailsCategories/index.js renders no `<h1>` or `<h2>` anywhere
//   (`<Container><HeaderTitleContainer><InfoWrapper><InfoCircle
//   /><span>...</span></InfoWrapper></HeaderTitleContainer><CategoriesWrapper
//   >...</CategoriesWrapper></Container>`). Mounted SYNTHETIC PROBES for both,
//   plus the real `InfoWrapper > span` (a genuine descendant, second child
//   after the icon) at its real depth.
// - ProductDetatilsInformation/styles.js's `UploadImageIcon > span`,
//   `InputWrapper > label`, `InventoryWrapper > span` and `RegularWrapper >
//   span` are all genuine descendants/direct children in index.js
//   (`<UploadImageIcon><BiImage /><span>...</span></UploadImageIcon>`,
//   `<InputWrapper><label>...</label><Input /></InputWrapper>`,
//   `<InventoryWrapper><span>...</span><Switch /></InventoryWrapper>` used
//   twice, `<RegularWrapper><span>...</span><Switch /></RegularWrapper>`) —
//   mounted the same way, with literal checkbox inputs standing in for
//   `Switch`. `ColorWrapper > label` and `ShapeWrapper > label` (`ShapeWrapper
//   = styled(ColorWrapper)`) are genuine direct children
//   (`<ColorWrapper><label>...</label><ColorPicker /></ColorWrapper>`,
//   `<ShapeWrapper><label>...</label><ShapeContentWrapper>...
//   </ShapeContentWrapper></ShapeWrapper>`), mounted with plain `div`s
//   standing in for the out-of-batch `ColorPicker`/`ShapeContentWrapper`.
//   `ShapeBoxWrapper svg` is a genuine descendant
//   (`<ShapeBoxWrapper><div />{cond ? <RecordCircleFill /> : <Circle
//   />}</ShapeBoxWrapper>`) — mounted the same way.
// - ProductDetatilsInformation/styles.js's `Wrapper` is a DEAD EXPORT per the
//   assignment: its import is commented out in index.js
//   (`// Wrapper,`). Mounted anyway, per its declared CSS shape (`button`
//   then `> span` as a genuine direct-child pair per the rule text) with this
//   note — no live consumer to check nesting against.
// - ProductMainDetails/styles.js's `Container > h1` is a genuine direct child
//   (`<Container maxLimit={...}><h1>...</h1><TabsConatiner>...
//   </TabsConatiner>{...}</Container>`). `Tab` is already `as='button'
//   type='button' aria-pressed={...}` in index.js — mounted the same way,
//   matching the assignment's required conversion. This is the ONE control in
//   this batch converted to a native button in the source; the visually
//   similar `Tab` in ProductDesktopPreview below was NOT converted and is
//   preserved as-is (see the SIMULACION section note).
// - ProductMetaFields/styles.js's `MetaContainer .meta_type` and
//   `.meta_value > svg` are genuine descendants
//   (`<MetaContainer><div className='meta_type'>{...}</div><div
//   className='meta_key'><RoundBorder>{...}</RoundBorder></div><div
//   className='meta_value'><RoundBorder>{...}</RoundBorder><BsTrash
//   onClick={...} /></div></MetaContainer>`) — mounted the same way with a
//   decorative svg standing in for `BsTrash`. `RoundBorder` and `NoMetaField`
//   are mounted as bare content, matching their real usage.
// - ProductMetaFields/styles.js's `MetaAddContainer` declares `font-size`
//   TWICE inside the SAME `input {}` rule (16px, then a second `font-size:
//   var(--od-type-control-value-size)` — 14px per the assignment's table —
//   further down the same block): by CSS cascade only the second (14px)
//   declaration ever paints. Per the assignment's explicit instruction,
//   mounted ONE real `<input>` (in the real `.meta_key` div, matching
//   index.js's `<div className='meta_key'><input id='meta_key' .../></div>`)
//   carrying `pmf-metaaddcontainer-input-14`, plus a second sibling `<input>`
//   carrying `pmf-metaaddcontainer-input-16` that documents the declaration
//   which never paints.
// - (main sync, ): ProductStep/styles.js's `ImportMenuContainer`
//   HERO text (`h2` 24px / `p` 20px) is no longer mounted: main deleted
//   ProductStep on purpose, so its two hero preservations left the ruleset.
//
// SIMULACION — ProductDesktopPreview/styles.js is NOT part of the b8/c1
// migration surface: it is a simulation of the product modal the END
// CUSTOMER sees on the storefront, rendered here inside the admin dashboard's
// product-preview modal (`ProductEditorHeader` opens it via `<Modal><
// ProductDesktopPreview .../></Modal>`; `ProductSummary` did on main). Its 22 declarations are preserved
// WHOLE, unmigrated, exactly as `Stores/BusinessPreview` was preserved in
// batch b2 — this is a contract, not an oversight. They are mounted in a
// separate, separately-capturable section (`c1-storefront-simulation`,
// distinct from `c1-dashboard-surfaces`) so a screenshot of one can never be
// byte-identical to the other purely for lack of a scoped region, the exact
// failure the b2 review flagged.
// - `ProductInfo`'s `h1`, `.price-wrapper > span`, `.price-wrapper >
//   .price-discount` and `p` are all genuine, at the real depth: index.js
//   nests them inside `ProductFormTitle`, itself `ProductInfo`'s real first
//   child (`<ProductInfo><ProductFormTitle><h1>...</h1><div
//   className='price-wrapper'><span>...</span><span
//   className='price-discount'>...</span></div><p>...</p><SkuContent>...
//   </SkuContent></ProductFormTitle>...</ProductInfo>`) — mounted at that
//   real depth rather than as direct children of `ProductInfo`, even though
//   `ProductInfo`'s own selectors are plain descendant selectors that would
//   technically resolve one level shallower too.
// - `SkuContent`'s `h2`/`p` are the real direct-child pair inside
//   `ProductFormTitle` shown above — mounted at that real depth.
// - `ModalHeader svg`, `IngredientContainer > span`, `OptionFlag`,
//   `SuoptionText`, `SuboptionPrice` and `ProductActions div.price`/
//   `button.add` are each genuine, but their own ancestor chain in index.js
//   (`ProductEdition` > tab container > `.extra` div > `OptionContainer` >
//   `WrapperSubOption` > `ProductSuboptionContainer`, etc.) carries no
//   selector that any of the 22 assigned testids depend on, so — matching the
//   b8 fixture's convention of mounting each leaf styled surface standalone
//   once ITS OWN internal rule is satisfied — those intermediate simulation
//   containers are not reproduced here. `ModalHeader`'s `svg` stands in for
//   `XLg`, `IngredientContainer`'s `> span` is the real sibling of a
//   `Checkbox` (`<IngredientContainer><Checkbox .../><span>{ingredient.name}
//   </span></IngredientContainer>`, mounted with a literal checkbox input),
//   `ProductActions`'s `div.price` and `button.add` are the real `<div
//   className='price'>{...}</div>` and the real `Button
//   className='add'>{...}</Button>` (mounted with a literal `<button
//   className='add'>`, `Button` being out of batch).
// - `QuantityControl` and `PositionControl` both declare their OWN root
//   font-size directly (12px / 18px, not nested rules) alongside a nested
//   `svg {}` rule — both root and icon are genuine: `<QuantityControl>
//   <BsDashCircle />{quantity}<BsPlusCircle /></QuantityControl>` and
//   `<PositionControl><BsCircleHalf /><BsCircleFill /><BsCircleHalf
//   /></PositionControl>` — mounted with decorative svgs standing in for
//   those `react-bootstrap-icons` components.
// - `OptionTitle`'s `<root>` (14px, on the `h3` itself) is genuine
//   (`<OptionTitle><span>{option.name}</span></OptionTitle>`), but its
//   `span > &:not(:first-child)` rule NEVER RESOLVES in the live render: this
//   is the ONLY place index.js ever places a child inside `OptionTitle`, and
//   it is always exactly ONE `<span>` — there is never a second sibling for
//   `:not(:first-child)` to match. Mounted the real single span for the root
//   testid, plus a SYNTHETIC PROBE second sibling span carrying
//   `pdp-optiontitle-span-not-first-child` — this second span does not exist
//   in the live UI.
// - `IconControl`'s `svg {}` rule ALSO NEVER RESOLVES in the live render:
//   index.js only ever places a `Checkbox` or a `RadioButton` inside
//   `IconControl` (`<IconControl>{cond ? <Checkbox .../> : <RadioButton
//   .../>}</IconControl>`), and both render as a native `<input
//   type='checkbox'>` (`components/Shared/UI/Checkbox.jsx`'s
//   `NativeInput`-based `Checkbox`/`RadioButton`) — never an `<svg>`. Mounted
//   a SYNTHETIC PROBE `<IconControl><svg /></IconControl>` carrying
//   `pdp-iconcontrol-svg` — this svg does not exist in the live UI.
// - `Tab` here is NOT converted to a native button, unlike
//   `ProductMainDetails`'s `Tab` above: index.js renders it as a plain
//   `<Tab active={...} onClick={...}>{...}</Tab>` div with no button
//   semantics, no `aria-pressed` and no keyboard handling. Per the
//   SIMULACION contract ("preservada entera"), it is mounted as the real
//   plain `<div>`-based control it is in production, with no `onClick`
//   attached (this fixture carries no real handlers) — it is intentionally
//   NOT "fixed" into an accessible control the way `ProductMainDetails`'s
//   `Tab` genuinely was in the source.
export const StoresC1StylesFixture = () => {
  return (
    <main data-testid='stores-c1-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>

      <section data-testid='c1-dashboard-surfaces' aria-label='Product core dashboard surfaces'>

        <div data-testid='product-details-advanced-group' aria-label='Product details advanced'>
          <PropertyOption>
            <label data-testid='pda-propertyoption-label-first-child'>Featured</label>
            <input type='checkbox' aria-label='Featured' defaultChecked readOnly />
          </PropertyOption>
          <Option data-testid='pda-option-root'>No apply</Option>
          <OptionCenter data-testid='pda-optioncenter-root'>Add new tax</OptionCenter>
          <LabelCustom data-testid='pda-labelcustom-root' htmlFor='sku'>SKU</LabelCustom>
          <WeightWrapper>
            <input type='text' aria-label='Weight' placeholder='0.00' readOnly />
            <div className='select' data-testid='pda-weightwrapper-select'>grams</div>
          </WeightWrapper>
          {/* PricePerUnit is a DEAD EXPORT — see file header. Mounted per its declared CSS shape. */}
          <PricePerUnit>
            <label data-testid='pda-priceperunit-label'>Price per unit</label>
            <div className='select' data-testid='pda-priceperunit-select'>kg</div>
          </PricePerUnit>
        </div>

        <PdcContainer>
          {/* SYNTHETIC PROBE — see file header: ProductDetailsCategories/index.js renders no <h1> anywhere. */}
          <h1 data-testid='pdc-container-h1'>Synthetic probe heading</h1>
          <HeaderTitleContainer>
            {/* SYNTHETIC PROBE — see file header: index.js renders no <h2> anywhere either. */}
            <h2 data-testid='pdc-headertitlecontainer-h2'>Synthetic probe subheading</h2>
            <InfoWrapper>
              <svg viewBox='0 0 16 16' width='14' height='14' aria-hidden='true' focusable='false'><circle cx='8' cy='8' r='6' fill='none' stroke='currentColor' /></svg>
              <span data-testid='pdc-infowrapper-span'>Search and move your products between categories or subcategories</span>
            </InfoWrapper>
          </HeaderTitleContainer>
        </PdcContainer>

        <div data-testid='product-detatils-information-group' aria-label='Product information'>
          <UploadImageIcon>
            <svg viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><rect x='2' y='2' width='12' height='12' fill='none' stroke='currentColor' /></svg>
            <span data-testid='pdi-uploadimageicon-span'>Put your image here</span>
          </UploadImageIcon>
          <InputWrapper>
            <label data-testid='pdi-inputwrapper-label'>Name</label>
            <input type='text' aria-label='Name' defaultValue='' readOnly />
          </InputWrapper>
          <InventoryWrapper>
            <span data-testid='pdi-inventorywrapper-span'>Inventory</span>
            <input type='checkbox' aria-label='Inventory' readOnly />
          </InventoryWrapper>
          {/* Wrapper is a DEAD EXPORT (import commented out in index.js) — see file header. Mounted per its declared CSS shape. */}
          <Wrapper>
            <button type='button'>Change</button>
            <span data-testid='pdi-wrapper-span'>Synthetic label</span>
          </Wrapper>
          <RegularWrapper>
            <span data-testid='pdi-regularwrapper-span'>Regular Price</span>
            <input type='checkbox' aria-label='Regular Price' readOnly />
          </RegularWrapper>
          <ColorWrapper>
            <label data-testid='pdi-colorwrapper-label'>Color</label>
            <div />
          </ColorWrapper>
          <ShapeWrapper>
            <label data-testid='pdi-shapewrapper-label'>Shape</label>
            <div>
              <ShapeBoxWrapper active>
                <div />
                <svg data-testid='pdi-shapeboxwrapper-svg' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><circle cx='8' cy='8' r='6' fill='none' stroke='currentColor' /></svg>
              </ShapeBoxWrapper>
            </div>
          </ShapeWrapper>
        </div>

        <PmdContainer>
          <h1 data-testid='pmd-container-h1'>Product details</h1>
          <div>
            <PmdTab as='button' type='button' active aria-pressed='true' data-testid='pmd-tab-root'>Information</PmdTab>
            <PmdTab as='button' type='button' aria-pressed='false'>Advanced</PmdTab>
          </div>
        </PmdContainer>

        <div data-testid='product-meta-fields-group' aria-label='Custom fields'>
          <MetaTitle data-testid='pmf-metatitle-root'>Custom Fields</MetaTitle>
          <MetaContainer>
            <div className='meta_type' data-testid='pmf-metacontainer-meta-type'>text</div>
            <div className='meta_key'>
              <RoundBorder data-testid='pmf-roundborder-root'>event_key</RoundBorder>
            </div>
            <div className='meta_value'>
              <RoundBorder>Sample value</RoundBorder>
              <svg data-testid='pmf-metacontainer-meta-value-svg' viewBox='0 0 16 16' width='20' height='20' aria-hidden='true' focusable='false'><path d='M3 4h10M6 4V2h4v2M4 4l1 10h6l1-10' fill='none' stroke='currentColor' /></svg>
            </div>
          </MetaContainer>
          {/* MetaAddContainer's real input{} rule declares font-size twice — see file header. Only the 14px sibling paints. */}
          <MetaAddContainer>
            <div className='meta_type'>text</div>
            <div className='meta_key'>
              <input data-testid='pmf-metaaddcontainer-input-14' type='text' placeholder='key' aria-label='key' />
              <input data-testid='pmf-metaaddcontainer-input-16' type='text' placeholder='key (never paints — see file header)' aria-label='key (duplicate declaration, never paints)' />
            </div>
          </MetaAddContainer>
          <NoMetaField data-testid='pmf-nometafield-root'>No MetaField</NoMetaField>
        </div>

      </section>

      {/*
        SIMULACION — ProductDesktopPreview mounts the preserved-whole storefront
        product-modal simulation. See the file header for why this batch does not
        migrate it and why it is captured as its own scoped region.
      */}
      <section data-testid='c1-storefront-simulation' aria-label='Storefront product preview simulation'>

        <ModalHeader>
          <svg data-testid='pdp-modalheader-svg' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M2 2l12 12M14 2L2 14' fill='none' stroke='currentColor' /></svg>
        </ModalHeader>

        <ProductInfo>
          <ProductFormTitle>
            <h1 data-testid='pdp-productinfo-h1'>Veggie Burger Deluxe</h1>
            <div className='price-wrapper'>
              <span data-testid='pdp-productinfo-price-wrapper-span'>$12.00</span>
              <span className='price-discount' data-testid='pdp-productinfo-price-wrapper-price-discount'>$15.00</span>
            </div>
            <p data-testid='pdp-productinfo-p'>A synthetic description for preview purposes.</p>
            <SkuContent>
              <h2 data-testid='pdp-skucontent-h2'>Sku</h2>
              <p data-testid='pdp-skucontent-p'>SKU-1234</p>
            </SkuContent>
          </ProductFormTitle>
        </ProductInfo>

        <SectionTitle data-testid='pdp-sectiontitle-root'>Ingredients</SectionTitle>

        <IngredientContainer>
          <input type='checkbox' aria-label='Tomato' readOnly />
          <span data-testid='pdp-ingredientcontainer-span'>Tomato</span>
        </IngredientContainer>

        <div>
          <PdpTab active data-testid='pdp-tab-root'>All</PdpTab>
          <PdpTab>Ingredients</PdpTab>
        </div>

        <OptionTitle data-testid='pdp-optiontitle-root'>
          <span>Extra cheese</span>
          {/* SYNTHETIC PROBE — see file header: OptionTitle only ever renders one real span child. */}
          <span data-testid='pdp-optiontitle-span-not-first-child'>synthetic sibling label</span>
        </OptionTitle>

        <OptionFlag data-testid='pdp-optionflag-root'>Required</OptionFlag>

        {/* SYNTHETIC PROBE — see file header: IconControl only ever renders a Checkbox/RadioButton (native input), never an svg. */}
        <IconControl>
          <svg data-testid='pdp-iconcontrol-svg' viewBox='0 0 16 16' width='25' height='25' aria-hidden='true' focusable='false'><circle cx='8' cy='8' r='6' fill='none' stroke='currentColor' /></svg>
        </IconControl>

        <SuoptionText data-testid='pdp-suoptiontext-root'>
          <div><label htmlFor='synthetic-suboption'>Extra cheese</label></div>
        </SuoptionText>

        <QuantityControl data-testid='pdp-quantitycontrol-root'>
          <svg data-testid='pdp-quantitycontrol-svg' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><circle cx='8' cy='8' r='6' fill='none' stroke='currentColor' /></svg>
          1
          <svg viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M8 3v10M3 8h10' fill='none' stroke='currentColor' /></svg>
        </QuantityControl>

        <PositionControl data-testid='pdp-positioncontrol-root'>
          <svg data-testid='pdp-positioncontrol-svg' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M8 2a6 6 0 000 12z' /></svg>
          <svg viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><circle cx='8' cy='8' r='6' /></svg>
          <svg viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M8 2a6 6 0 010 12z' /></svg>
        </PositionControl>

        <SuboptionPrice data-testid='pdp-suboptionprice-root'>+ $2.00</SuboptionPrice>

        <ProductActions>
          <div className='price' data-testid='pdp-productactions-div-price'>$12.00</div>
          <button type='button' className='add' data-testid='pdp-productactions-button-add'>Add</button>
        </ProductActions>

      </section>

    </main>
  )
}
