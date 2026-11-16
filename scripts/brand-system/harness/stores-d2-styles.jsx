import React from 'react'

import {
  Container as SdContainer,
  UploadImageIcon as SdUploadImageIcon,
  InputWrapper as SdInputWrapper,
  Option as SdOption,
  SelectWrapper as SdSelectWrapper,
  TimeBlock as SdTimeBlock,
  PropertyOption as SdPropertyOption
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/ServiceDetail/styles'
import {
  HeaderContainer as BwlHeaderContainer,
  SectionTitle as BwlSectionTitle,
  EmptyWrapper as BwlEmptyWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BrandWhiteLabel/styles'

// Presentation-only fixture: the real Stores styled-components for batch
// d2-taxes-fees-markups-misc, no controller, SDK, account or network. Two
// source files are mounted — ServiceDetail,
// BrandWhiteLabel — one group per file, in the assignment
// table's order. Several export names repeat across these files
// (SectionTitle, EmptyWrapper, Option, HeaderContainer), so EVERY import in
// this file uses a folder-prefix alias matching its data-testid prefix, with
// no exceptions — the same uniform aliasing discipline stores-d1/c3 used at
// higher cardinality.
//
// Alias map (source file -> prefix -> testid prefix):
//   ServiceDetail     -> Sd*  -> sd-*   (8 nodes)
//   BrandWhiteLabel   -> Bwl* -> bwl-*  (4 nodes)
// Total: 12 table nodes.
// Lot 3.C: ChildMapplingList moved to Product and plain CSS and
// has no styles.js left to mount; its 2 nodes (cml-) are gone.
// Lot 5.1b: SeoOptions moved to Product and plain CSS and has no
// styles.js left to mount; its 4 nodes (seo-) are gone.
// Lot 5.12: EditTaxManager and CustomerFees moved onto Product
// wrappers and their own CSS files; their styles.js (and EditTaxManager's
// InputFields.js) are gone, so their 13 nodes (etm- and cf-, with the cf-
// native checkbox control) are no longer mounted here.
// Lot 5.13: MarkupForm moved onto Product pieces with its own CSS
// file; its styles.js is gone, so its 4 nodes (mf-) are no longer mounted here.
// Lot 5.16: SpoonityApiKey moved onto Product (SecretField, SaveBar)
// with its own CSS file; its styles.js is gone, so its 3 nodes (spk-) are no
// longer mounted here.
// the /stores/markups route (Stores/Markups/index.js) moved onto
// Product with its own markups-page.css; its styles.js is gone, so its 11 nodes
// (mk-, with the native checkbox control and the six orphan probes) are no
// longer mounted here.
//
// Every real/probe call below was verified by opening each file's own
// styles.js AND its consuming index.js (or, for ServiceDetail's SelectWrapper
// Select primitive, the sibling file that actually renders it) before
// mounting.
//
// This batch has no HERO/SIMULACION region.
export const StoresD2StylesFixture = () => {
  return (
    <main data-testid='stores-d2-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>

      <section data-testid='d2-taxes-fees-markups-misc' aria-label='Taxes, fees, markups and miscellaneous store settings surfaces'>

        {/* ServiceDetail/styles.js — 8 nodes, all genuine (real nesting
            confirmed in ServiceDetail/index.js).
            - Container's `> h1`: `<Container maxLimit={…}><h1>{t(
              'SERVICE_DETAILS', …)}</h1><FormInput>…</FormInput></Container>`
              — h1 is a direct child.
            - UploadImageIcon's `span`: `<UploadImageIcon><BiImage/><span>{t(
              'DRAG_DROP_IMAGE_HERE', …)}</span></UploadImageIcon>`.
            - InputWrapper's `label`: repeated `<InputWrapper><label>…
              </label><Input/|<TextArea/></InputWrapper>` pattern.
            - Option's `<root>`: genuine, handed as duration-select content:
              `<Option>15 <span>{t('MINUTES', …)}</span></Option>` (same
              "mount the leaf node handed to a Select" precedent stores-d1
              documented for PaymentOptionStripeLink's Option).
            - SelectWrapper's `label`: `<SelectWrapper><label>{t('DURATION',
              …)}</label><Select className='select' …/></SelectWrapper>`.
            - SelectWrapper's `> div > > div:first-child`: genuine but
              resolved through the shared `Select` (FirstSelect) primitive,
              not a literal child — opened FirstSelect.jsx directly: its root
              renders `<div className={'od-ui od-first-select-root ' +
              (className || 'select')}>`, and passing `className='select'`
              here (as ServiceDetail's index.js does) makes that root the
              `> div` the rule targets; its own first child is the trigger
              `<div className='od-first-select-trigger' role='button' …>`,
              which is the `div:first-child` the rule reaches. Mounted with
              literal divs reproducing that exact two-level shape and its
              real classNames.
            - TimeBlock's `> select`: genuine, `<TimeBlock><select>…</select>
              <span>:</span><select>…</select></TimeBlock>` — two real
              `<select>` elements (hour/minute); testid placed on the first,
              which the bare `> select` child combinator matches equally.
            - PropertyOption's `label`: `<PropertyOption><label>{t(
              'FEATURED', …)}</label><Switch/></PropertyOption>`. */}
        <div data-testid='sd-group' aria-label='Service detail form'>
          <SdContainer>
            <h1 data-testid='sd-container-h1'>Service details</h1>
          </SdContainer>

          <SdUploadImageIcon>
            <svg aria-hidden='true' focusable='false' viewBox='0 0 16 16' width='24' height='24'><rect x='2' y='2' width='12' height='12' fill='none' stroke='currentColor' /></svg>
            <span data-testid='sd-uploadimageicon-span'>Put your image here</span>
          </SdUploadImageIcon>

          <SdInputWrapper>
            <label data-testid='sd-inputwrapper-label'>Name</label>
            <input type='text' aria-label='Name' defaultValue='' readOnly />
          </SdInputWrapper>

          <SdOption data-testid='sd-option-root'>15 <span>minutes</span></SdOption>

          <SdSelectWrapper>
            <label data-testid='sd-selectwrapper-label'>Duration</label>
            <div className='od-ui od-first-select-root select'>
              <div className='od-first-select-trigger' role='button' tabIndex={0} aria-haspopup='listbox' aria-label='Select duration' data-testid='sd-selectwrapper-div-div-first-child'>Select an option</div>
            </div>
          </SdSelectWrapper>

          <SdTimeBlock>
            <select aria-label='Hour' defaultValue='' data-testid='sd-timeblock-select'><option value=''>00</option></select>
            <span>:</span>
            <select aria-label='Minute' defaultValue=''><option value=''>00</option></select>
          </SdTimeBlock>

          <SdPropertyOption>
            <label data-testid='sd-propertyoption-label'>Featured</label>
            <input type='checkbox' aria-label='Featured' readOnly />
          </SdPropertyOption>
        </div>

        {/* BrandWhiteLabel/styles.js — 4 nodes, all genuine (real nesting
            confirmed in BrandWhiteLabel/index.js).
            - HeaderContainer's `h1` and `p`: both real, `<HeaderContainer>
              <h1>{t('WHITE_LABEL', …)}</h1><p>{t('WHITE_LABEL_DESC_BRAND',
              …)}</p></HeaderContainer>`, both direct children.
            - SectionTitle's `<root>`: genuine, used standalone multiple
              times, e.g. `<SectionTitle>{t('SITE_AND_THEME', …)}
              </SectionTitle>`.
            - EmptyWrapper's `<root>`: genuine, used standalone for the
              no-site and loading-site states. */}
        <div data-testid='bwl-group' aria-label='Brand white label'>
          <BwlHeaderContainer>
            <h1 data-testid='bwl-headercontainer-h1'>White Label</h1>
            <p data-testid='bwl-headercontainer-p'>Customize the site and theme of this brand.</p>
          </BwlHeaderContainer>

          <BwlSectionTitle data-testid='bwl-sectiontitle-root'>Site and theme</BwlSectionTitle>

          <BwlEmptyWrapper data-testid='bwl-emptywrapper-root'>No site yet</BwlEmptyWrapper>
        </div>

      </section>

    </main>
  )
}
