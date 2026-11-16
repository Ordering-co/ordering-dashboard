import React from 'react'

import {
  CategoryEnableWrapper as SbceCategoryEnableWrapper,
  ActionSelectorWrapper as SbceActionSelectorWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/SingleBusinessCategoryEdit/styles'
import {
  BusinessGeneralInfo as SbpBusinessGeneralInfo,
  InfoBlock as SbpInfoBlock,
  BusinessEnableWrapper as SbpBusinessEnableWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/SingleBusinessProduct/styles'
import {
  AccordionItem as SbscAccordionItem
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/SingleBusinessSubCateogries/styles'
import {
  AccordionItem as SbplAccordionItem
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/SingleBusinessSubCateogries/ProductLayout/styles'
import {
  Title as BifTitle,
  ConditionTitle as BifConditionTitle,
  Conditions as BifConditions,
  ImageIssue as BifImageIssue
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BatchImageForm/styles'
import {
  TurtorialEndContainier as WbTurtorialEndContainier,
  FirstStoreContainer as WbFirstStoreContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/WizardBusiness/styles'

// Presentation-only fixture: the real Stores styled-components for batch
// d3-importers-single-guides, the LAST batch of L4, no controller, SDK,
// account or network. Seven source files are mounted — SingleBusinessCategoryEdit, SingleBusinessProduct,
// SingleBusinessSubCateogries, its ProductLayout child,
// BatchImageForm, WizardBusiness — one group per file, in the assignment
// table's order.
// Several export names repeat across these files (Title, InputWrapper,
// InfoBlock, AccordionItem, BusinessEnableWrapper), so EVERY import in this file
// uses a folder-prefix alias matching its data-testid prefix, with no
// exceptions — the same uniform
// aliasing discipline stores-d1/c3/d2 used at comparable cardinality.
//
// Alias map (source file -> prefix -> testid prefix):
//   SingleBusinessCategoryEdit            -> Sbce* -> sbce-* (3 rows)
//   SingleBusinessProduct                 -> Sbp*  -> sbp-*  (4 rows)
//   SingleBusinessSubCateogries           -> Sbsc* -> sbsc-* (1 row)
//   SingleBusinessSubCateogries/ProductLayout -> Sbpl* -> sbpl-* (1 row)
//   BatchImageForm                        -> Bif*  -> bif-*  (8 rows)
//   WizardBusiness                        -> Wb*   -> wb-*   (3 rows)
// Table total: 25 rows. THREE of those rows are the "media variant" half of
// a responsive pair (see below) and get NO data-testid of their own — the
// base variant's node is the same DOM node at both widths. So this fixture
// mounts 22 distinct data-testid attributes for the table's 25 rows, plus
// one extra synthetic-sibling testid for the sbce duplicate-declaration
// case documented below (23 attributes total on the page).
//
// Lot 3.C: ImporterForm, ImporterJobForm, ImportersList and
// ImportersListing moved to Product wrappers and plain CSS and have no
// styles.js left to mount; their 21 rows (if-, ijf-, il-, ilg-) are gone.
//
// ImporterHelpContent (never reachable) and SingleBusiness (the old
// stores list row) were deleted as dead code; their 11 rows (ihc-, sb-) and the
// two glyph preservations are gone, with the InfoBlock `> span` orphan probe.
//
// Every real/orphan/probe/conversion call below was verified by opening
// each file's own styles.js AND its consuming index.js (confirming, where
// relevant, that the folder has no other file that could import the
// export instead) before mounting.
//
// THREE RESPONSIVE PAIRS (BatchImageForm), pre-briefed: Title's `h2`,
// ConditionTitle's own root, and Conditions' `li` each carry a base
// declaration plus a second one nested under
// `@media (min-width: 768px)` targeting the exact same selector. In the
// real file every one of those six declarations resolves the SAME CSS
// custom property (`var(--od-type-title-size)` for the Title pair,
// `var(--od-type-content-size)` for the other two) in both the base rule
// and the media-query rule — the component's own `@media` block never
// swaps to a different var() reference, it just repeats the same one (and,
// for Title/Conditions, additionally tweaks an unrelated property:
// margin-bottom / padding-left / line-height). That confirms the table's
// framing: there is exactly ONE rendered node per pair, and whatever pixel
// swap happens between the base and 768px+ variants happens through that
// custom property's own resolution, not through two different elements or
// two different rules on this component. Each pair is mounted ONCE below,
// carrying only the BASE variant's testid (bif-title-h2,
// bif-conditiontitle-root, bif-conditions-li) — the spec widens the
// viewport against that same node to check the other variant, so no
// `-media-min-width-768px-` testid is ever attached to a second element.
//
// TWO orphaned/probed sites, pre-briefed:
//  - SingleBusinessCategoryEdit/CategoryEnableWrapper and
//    /ActionSelectorWrapper: SingleBusinessCategoryEdit/index.js (the
//    folder's only other file) imports only SingleCategoryContainer,
//    CategoryContent, CategoryContentInside, ImageContainer from its own
//    styles.js — neither CategoryEnableWrapper nor ActionSelectorWrapper
//    is ever rendered. Both mounted as SYNTHETIC PROBES.
//  - SingleBusinessCategoryEdit/CategoryEnableWrapper's `span` ALSO has a
//    duplicate-declaration quirk layered on top of being orphaned: its own
//    rule declares `font-size: var(--od-type-control-size)` TWICE inside
//    the same `span { }` block (once near the top, once again three lines
//    later, both referencing the identical custom property). Per normal
//    CSS cascade, the second declaration of the same property always wins
//    over the first — so if this selector were ever satisfied, only the
//    SECOND declaration would ever paint. The table names this the
//    "12px"/"14px" split (its pre-migration shape apparently held two
//    different literal values before both were folded onto the same
//    design token); today both declarations are textually identical, but
//    the cascade rule that makes only the second one matter still holds.
//    Mounted below as TWO sibling spans inside the same (already-orphaned)
//    wrapper: `sbce-categoryenablewrapper-span-12` for the real,
//    always-second, always-painting declaration, and a SYNTHETIC SIBLING
//    `sbce-categoryenablewrapper-span-14` documented as never painting.
//
// (main sync, ): main deleted RestaurantSelectGuide,
// SelectPosGuide and UploadMenuGuide with their flows (Ordering Network
// import, PDF upload, POS request email); their styles.js are gone, so their
// 24 rows (rsg-, spg-, umg-) are no longer mounted and the former
// SelectPosGuide orphan (`label`) went with them.
//
// This batch has no HERO/SIMULACION region.
export const StoresD3StylesFixture = () => {
  return (
    <main data-testid='stores-d3-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>

      <section data-testid='d3-importers-single-guides' aria-label='Importer, single-business and onboarding guide surfaces'>

        {/* SingleBusinessCategoryEdit/styles.js — 3 nodes, ALL orphaned:
            CategoryEnableWrapper (both spans) and ActionSelectorWrapper are
            pre-briefed component-level orphans (see file header), and
            CategoryEnableWrapper's own `span` rule additionally has the
            pre-briefed duplicate-declaration quirk documented at the top of
            this file. All three mounted as SYNTHETIC PROBES. */}
        <div data-testid='sbce-group' aria-label='Single business category edit (all orphaned)'>
          {/* SYNTHETIC PROBE (component-level orphan) — sbce-categoryenablewrapper-span-12
              carries the declaration that would actually paint if this component
              were ever rendered (the second, same-property, cascade-winning
              font-size: var(--od-type-control-size)); see file header. */}
          <SbceCategoryEnableWrapper>
            <span data-testid='sbce-categoryenablewrapper-span-12'>Enable</span>
            {/* SYNTHETIC SIBLING — sbce-categoryenablewrapper-span-14 stands for
                the FIRST font-size declaration in the same `span {}` rule, which
                CSS cascade rules mean never wins over the second. It never paints
                even on its own (already orphaned) terms — see file header. */}
            <span data-testid='sbce-categoryenablewrapper-span-14' aria-hidden='true'>Synthetic sibling — superseded declaration, never paints</span>
          </SbceCategoryEnableWrapper>

          {/* SYNTHETIC PROBE — sbce-actionselectorwrapper-dropdown-item is orphaned, see file header. */}
          <SbceActionSelectorWrapper>
            <div className='dropdown'>
              <button type='button' aria-label='Category actions'>&#8942;</button>
              <div className='dropdown-menu'>
                <a className='dropdown-item' href='#top' data-testid='sbce-actionselectorwrapper-dropdown-item'>Synthetic probe — edit category</a>
              </div>
            </div>
          </SbceActionSelectorWrapper>
        </div>

        {/* SingleBusinessProduct/styles.js — 4 nodes, all genuine (real
            nesting confirmed in SingleBusinessProduct/index.js).
            - BusinessGeneralInfo's `div.product_name`: `<
              BusinessGeneralInfo><ProductTypeImage>…</ProductTypeImage>
              {product?.name && <div className='product_name'>{…}</div>}
              </BusinessGeneralInfo>`.
            - InfoBlock's `div` (base, content-size): genuine via the
              `product_price` div, which carries no font-size override of
              its own and so inherits the base `div {font-size: content-
              size}` rule — `<InfoBlock><div className='product_price'>
              {parsePrice(…)}</div></InfoBlock>`.
            - InfoBlock's `div > &.product_description` (secondary-size
              override): genuine — `<InfoBlock><div className=
              'product_description'>{…}</div></InfoBlock>`.
            - BusinessEnableWrapper's `span` is genuine: `<
              BusinessEnableWrapper className='product_enable_control'>
              {product?.enabled ? <span>{t('ENABLE', …)}</span> : <span>
              {t('DISABLE', …)}</span>}<Switch/></BusinessEnableWrapper>`. */}
        <div data-testid='sbp-group' aria-label='Single business product row'>
          <SbpBusinessGeneralInfo>
            <div className='product_name' data-testid='sbp-businessgeneralinfo-div-product-name'>Cheeseburger deluxe</div>
          </SbpBusinessGeneralInfo>

          <SbpInfoBlock>
            <div className='product_price' data-testid='sbp-infoblock-div'>$8.50</div>
          </SbpInfoBlock>

          <SbpInfoBlock>
            <div className='product_description' data-testid='sbp-infoblock-div-product-description'>Grilled beef patty with cheddar and pickles.</div>
          </SbpInfoBlock>

          <SbpBusinessEnableWrapper className='product_enable_control'>
            <span data-testid='sbp-businessenablewrapper-span'>Enable</span>
            <input type='checkbox' aria-label='Enable' defaultChecked readOnly />
          </SbpBusinessEnableWrapper>
        </div>

        {/* SingleBusinessSubCateogries/styles.js — 1 node, genuine: `<
            AccordionItem margin={…} active={…} …><div><img .../>
            {hasSubcategories && <CaretRightFill/>}<span>{category.name}
            </span></div><Switch/></AccordionItem>` — span is the direct
            child div's own last child, div is AccordionItem's first child. */}
        <div data-testid='sbsc-group' aria-label='Single business subcategory accordion item'>
          <SbscAccordionItem>
            <div>
              <svg aria-hidden='true' focusable='false' viewBox='0 0 16 16' width='16' height='16'><path d='M6 3l5 5-5 5' fill='none' stroke='currentColor' /></svg>
              <span data-testid='sbsc-accordionitem-div-span'>Appetizers</span>
            </div>
            <input type='checkbox' aria-label='Enabled' defaultChecked readOnly />
          </SbscAccordionItem>
        </div>

        {/* SingleBusinessSubCateogries/ProductLayout/styles.js — 1 node,
            genuine: `<AccordionItem margin={…} …><div>{hasSubcategories &&
            <CaretRightFill/>}<CheckWrapper>…</CheckWrapper><span>{category.
            name}</span></div></AccordionItem>` — the plain category-name
            span is a direct child of the div (a sibling of CheckWrapper's
            own internal `span.radio`, not nested inside it), div is
            AccordionItem's first child. */}
        <div data-testid='sbpl-group' aria-label='Product layout subcategory accordion item'>
          <SbplAccordionItem>
            <div>
              <svg aria-hidden='true' focusable='false' viewBox='0 0 16 16' width='16' height='16'><path d='M6 3l5 5-5 5' fill='none' stroke='currentColor' /></svg>
              <span className='radio' role='button' tabIndex={0} onClick={() => {}} aria-label='Toggle selection'>&#9675;</span>
              <span data-testid='sbpl-accordionitem-div-span'>Appetizers</span>
            </div>
          </SbplAccordionItem>
        </div>

        {/* BatchImageForm/styles.js — 8 nodes: 6 real single-node rows
            (Title, ConditionTitle, Conditions, ImageIssue p/ul>li) plus the
            THREE RESPONSIVE PAIRS documented at the top of this file, which
            collapse Title's h2, ConditionTitle's root and Conditions' li
            into three mounted nodes carrying only their base testid instead
            of six. Real nesting confirmed in BatchImageForm/index.js.
            - Title's `h2` (RESPONSIVE PAIR): `<Title><h2>{t(
              'BATCH_UPLOADE_FORM_TITLE', …)}</h2></Title>`.
            - ConditionTitle's `<root>` (RESPONSIVE PAIR): `<ConditionTitle>
              <b>{t('BATCH_UPLOAD_CONDITION_TITLE', …)}</b></ConditionTitle>`.
            - Conditions' `li` (RESPONSIVE PAIR): `<Conditions>
              {uploadConditions.map((list, i) => <li key={i}>{list}</li>)}
              </Conditions>`.
            - ImageIssue's `p` and `ul > li` are genuine: `<ImageIssue><p>
              <b>Issues with images:</b></p>{invalidImages.length > 0 ? <
              IssueBoard><ul>{invalidImages.map((img, i) => <li key={i}>
              {img}</li>)}</ul></IssueBoard> : <IssueBoard emptyboard/>}
              </ImageIssue>` — the `ul li` rule is a descendant selector,
              satisfied regardless of the IssueBoard wrapper in between. */}
        <div data-testid='bif-group' aria-label='Batch image upload form'>
          <BifTitle>
            <h2 data-testid='bif-title-h2'>Upload images in batch</h2>
          </BifTitle>

          <BifConditionTitle data-testid='bif-conditiontitle-root'><b>Here you can upload multiple product images.</b></BifConditionTitle>

          <BifConditions>
            <li data-testid='bif-conditions-li'>Use JPG or PNG files</li>
            <li>Maximum size 2 MB per image</li>
          </BifConditions>

          <BifImageIssue>
            <p data-testid='bif-imageissue-p'><b>Issues with images:</b></p>
            <ul>
              <li data-testid='bif-imageissue-ul-li'>burger.png — file too large</li>
            </ul>
          </BifImageIssue>
        </div>

        {/* WizardBusiness/styles.js — 3 nodes, all genuine (real nesting
            confirmed in WizardBusiness/index.js): `<TurtorialEndContainier>
            <h1>{t('NEW_STORE', …)}</h1><FirstStoreContainer><img .../><h1>
            {t('CONGRATULATIONS', …)}</h1><p>{t('FIRST_STORE_IS_REDAY', …)}
            </p><Button>…</Button></FirstStoreContainer>
            </TurtorialEndContainier>` — both `h1`s are direct children of
            their own wrapper (TurtorialEndContainier's own h1 is its first
            child; FirstStoreContainer nests as TurtorialEndContainier's
            second child and its own h1/p are its own direct children). */}
        <div data-testid='wb-group' aria-label='Wizard business tutorial end'>
          <WbTurtorialEndContainier>
            <h1 data-testid='wb-turtorialendcontainier-h1'>New store</h1>
            <WbFirstStoreContainer>
              <img src='' alt='' />
              <h1 data-testid='wb-firststorecontainer-h1'>Congratulations!</h1>
              <p data-testid='wb-firststorecontainer-p'>Your first store is ready.</p>
              <button type='button'>Go to store list</button>
            </WbFirstStoreContainer>
          </WbTurtorialEndContainier>
        </div>

      </section>

    </main>
  )
}
