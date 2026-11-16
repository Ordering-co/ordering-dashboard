import React from 'react'

import {
  BusinessDetailsContainer,
  FormControl as BusinessDetailsFormControl,
  GoogleMapContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessAdd/BusinessDetails/styles'
import {
  AddressWrapper,
  MomentWrapper,
  OrderTypeWrapper,
  CartWrapper,
  BusinessInfoItem,
  BusinessDetail,
  BusinessMoreDetail,
  Tab as BusinessPreviewTab,
  CardInfo,
  PriceWrapper,
  SoldOut,
  WrapAllCategories,
  EmptyCart,
  EmptyBtnWrapper,
  MobileCartViewWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessPreview/styles'

// Presentation-only fixture: the real Stores (business add wizard + business
// preview) styled surfaces for batch b2-business-add-wizard, no controller,
// SDK, account or network. Every interactive node here is mounted exactly as
// it exists in today's source: a styled `div`/`span` with `onClick` stays
// that element (never promoted to `<button>` and never given invented
// `type='button'`/`aria-pressed` attributes) — the coordinator converts these
// and aligns the fixture itself, per this batch's explicit instruction. A
// node that is ALREADY a real `<button>` in source keeps `type='button'` and
// its existing accessible name; nothing new is invented for it either.
//
// Reduced by (batch 2.5-A): /stores/add was rewritten on Product, so
// the wizard `styles.js` files (BusinessAdd/styles.js and the Images, Photos,
// Schedule, PaymentMethods, ReceiveOrders, OrderTypePriceLevel and DeliveryZone
// cards) are deleted and no longer mounted here. What remains:
// `Stores/BusinessAdd/BusinessDetails` (still used by the onboarding) and
// `Stores/BusinessPreview` (the live preview pane). `Stores/BusinessAddStore`
// was deleted.
// Colliding export names
// (`Container`, `FormControl`, `Tab`) are aliased at the import site.
//
// BusinessAdd/OtherDetails/styles.js was deleted as dead code; other-details-* rows (15 -> 13 role sizes) went with it.
//
// Real-nesting adaptations (checked against each source styles.js and its
// consuming index.js before mounting):
// - BusinessDetails/styles.js's `BusinessDetailsContainer` rule is a bare
//   descendant `h2 { font-size: 16px }`: index.js renders the h2 as a direct
//   child, mounted the same way.
// - BusinessDetails/styles.js's `FormControl` carries `label
//   { font-size: 14px; sup { font-size: 13px } }` and two class rules,
//   `.select { font-size: 14px }` and `.input-autocomplete
//   { font-size: 14px }`. `label`/`sup` are mounted matching index.js's
//   `<FormControl><label>…<sup>*</sup></label>…</FormControl>` shape.
//   `.input-autocomplete` is real: index.js applies
//   `className='input-autocomplete'` directly to the `<input>` rendered by
//   `GoogleAutocompleteInput` (verified in
//   `src/@/components-dashboard/src/components/GoogleAutocompleteInput/index.js`,
//   which spreads an unfiltered `className` onto its root `<input>`).
//   `.select`, however, is unreached: the only `.select`-shaped consumer in
//   this `FormControl` is the Vertical `<SecondSelect>` (schools-feature
//   gated), and `SecondSelect` resolves to
//   `Shared/UI/LegacySelect.jsx`'s `className={classNames('od-ui',
//   'od-legacy-select-root', className || 'select-wrapper')}` — no caller in
//   this file passes `className='select'`, so its root class is always
//   `select-wrapper`, a distinct token from `.select`, which never matches.
//   Mounted here as a literal `<div className='select'>` for declaration
//   verification only; the evidence should record this as dead CSS pointing
//   at a shape the real markup does not produce.
// - BusinessDetails/styles.js's `GoogleMapContainer` carries two independent
//   bare descendant rules, `label { font-size: 14px }` and `p
//   { font-size: 14px }`: index.js renders both as direct children
//   (`<GoogleMapContainer><label>…</label><p>…</p>…</GoogleMapContainer>`),
//   mounted the same way.
// - BusinessPreview/styles.js's `AddressWrapper`, `MomentWrapper`,
//   `OrderTypeWrapper` and `CartWrapper` each carry a single bare descendant
//   `span { font-size: 12px }`, each reached as the direct-child `<span>`
//   sibling of an icon in index.js's Content header row; only the
//   font-size-bearing `<span>` is mounted per wrapper (the sibling icons
//   carry no font-size rule and are omitted).
// - BusinessPreview/styles.js's `BusinessInfoItem` carries three
//   independent rules: a direct `h2 { font-size: 20px }`, a `.type
//   { font-size: 12px }` and a `.preorder-Reviews { span { font-size: 12px;
//   &.dot { font-size: 12px } } }`. index.js renders
//   `<BusinessInfoItem><h2 className='bold'>…</h2><p
//   className='type'>…</p><BusinessDetail>…</BusinessDetail><div
//   className='preorder-Reviews'><span>Preorder</span><span
//   className='dot'>•</span>…</div></BusinessInfoItem>`: the h2 and p.type
//   are mounted as direct children, and `div.preorder-Reviews` is mounted
//   as a direct child holding both a plain `<span>` (matches the general
//   rule only) and a `<span className='dot'>` (matches both the general
//   rule and its more-specific `&.dot` variant — same 12px value in source,
//   so no cascade conflict; each gets its own test id since they are
//   distinct DOM nodes).
// - BusinessPreview/styles.js's `BusinessDetail` carries four independent
//   rules: a direct `h5 { font-size: 12px }`, `.review { svg
//   { font-size: 15px } p { font-size: 12px } }` and a bare `.dot
//   { font-size: 12px }`. index.js renders one representative `<h5>` direct
//   child, a `<div className='review'><StarFill/><p>…</p></div>` direct
//   child (icon and p as its direct-child siblings), and one representative
//   `<span className='dot'>•</span>` direct child (index.js renders several
//   `.dot` spans as siblings of the `h5`s; one is mounted here, distinct
//   from the `.preorder-Reviews span.dot` node above, which lives inside
//   `BusinessInfoItem`, not `BusinessDetail`).
// - BusinessPreview/styles.js's `BusinessMoreDetail` rule is a bare
//   descendant `svg { font-size: 20px }`: index.js renders
//   `<BusinessMoreDetail><BsInfoCircle /></BusinessMoreDetail>` with no
//   `onClick` in this index.js (the `cursor: pointer` in its CSS is
//   currently decorative only), the icon mounted as a direct child with a
//   plain inline svg standing in for `BsInfoCircle`.
// - BusinessPreview/styles.js's `Tab` (aliased `BusinessPreviewTab`) declares
//   `font-size: 12px` on itself. It is a `styled.div` with a real `onClick`
//   in index.js (`<Tab onClick={() => setSelectedCateogry(category)}>`),
//   kept as a plain `div`, unconverted, mounted as a leaf with its own
//   visible text.
// - BusinessPreview/styles.js's `CardInfo` carries three independent rules:
//   a direct `h1 { font-size: 12px }`, a bare `p { font-size: 8px; @media
//   (min-width:1024px) { font-size: 10px } }` and a bare `span
//   { font-size: 10px; @media (min-width:1024px) { font-size: 12px } }`.
//   The `SingleProductCard` sub-component (same file, outside this batch's
//   `styles.js` list but the only real consumer) renders
//   `<CardInfo><h1>…</h1><PriceWrapper><span>…</span></PriceWrapper>
//   <p>…</p></CardInfo>`: h1 and p are mounted as direct children, and the
//   `span` is mounted nested inside an actual `<PriceWrapper>` (imported
//   below) two levels down — required because `CardInfo`'s bare `span` rule
//   is scoped to `CardInfo`'s own generated class and matches any
//   descendant regardless of depth, but the real price `<span>` genuinely
//   lives inside `PriceWrapper`, not as a direct child of `CardInfo`. One
//   test id per node; the two responsive values (8px/10px and 10px/12px)
//   are two declarations on the same physical node, not two nodes.
// - BusinessPreview/styles.js's `PriceWrapper` rule is `.off-price
//   { font-size: 10px; @media (min-width:1024px) { font-size: 13px } }`.
//   Grepping the whole `components-dashboard` tree for `off-price` finds
//   exactly one real consumer, and it is a *different* component entirely:
//   `Orders/CreateCustomOrder/SingleProductCard/index.js` (its own,
//   unrelated `styles.js` also defines `.off-price`). The `SingleProductCard`
//   inside *this* file (`BusinessPreview/index.js`) never renders an
//   `.off-price`-classed element — only the plain price `<span>` above.
//   Mounted here as a literal `<span className='off-price'>` inside the
//   real `<PriceWrapper>` for declaration verification only; the evidence
//   should record this as dead CSS in this component (the class is live,
//   but only in a sibling component outside this batch's scope).
// - BusinessPreview/styles.js's `SoldOut` declares `font-size: 10px` on
//   itself (a `styled.span`, no `onClick`), mounted as a leaf with its real
//   text content, matching `SingleProductCard`'s
//   `{(isSoldOut) && <SoldOut>{t('SOLD_OUT', …)}</SoldOut>}`.
// - BusinessPreview/styles.js's `WrapAllCategories` rule is a bare
//   descendant `h3 { font-size: 18px }`: index.js renders the h3 as a
//   direct-child sibling of `div.category-title`, mounted the same way.
// - BusinessPreview/styles.js's `EmptyCart` rule is `.empty-content { svg
//   { font-size: 35px } p { font-size: 12px } }`: index.js renders
//   `<EmptyCart><div className='empty-content'><Cart3 /><p>…</p></div>
//   <EmptyBtnWrapper>…</EmptyBtnWrapper></EmptyCart>`, the icon and p
//   mounted as direct-child siblings of `div.empty-content`, matching that
//   shape (a plain inline svg stands in for `Cart3`).
// - BusinessPreview/styles.js's `EmptyBtnWrapper` carries two independent
//   bare descendant sibling rules, `span { font-size: 14px }` and `button
//   { font-size: 12px }`. index.js renders
//   `<EmptyBtnWrapper><span>$0.00</span><Button>{t('EMPTY_CART', …)}
//   </Button></EmptyBtnWrapper>`: the span is mounted as a direct child, and
//   `Button` (which resolves to a real `<button>`) is mounted as a plain `<button type='button'>`
//   with its visible "Empty cart" text supplying the accessible name.
// - BusinessPreview/styles.js's `MobileCartViewWrapper` rule is a bare
//   descendant `span { font-size: 14px }` (its sibling `button` rule
//   carries no font-size, so that button is not a mount target here):
//   index.js renders the span as a direct-child sibling of a `<Button
//   color='primary'>`, mounted the same way with only the span present.
export const StoresB2StylesFixture = () => {
  return (
    <main data-testid='stores-b2-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>

      <BusinessDetailsContainer data-testid='business-details-container'>
        <h2 data-testid='business-details-heading'>Business details</h2>
      </BusinessDetailsContainer>

      <BusinessDetailsFormControl data-testid='business-details-form-control'>
        <label htmlFor='fixture-business-name' data-testid='business-details-form-label'>Business Name<sup data-testid='business-details-form-label-required'>*</sup></label>
        <input id='fixture-business-name' aria-label='Business Name' />
        {/* Dead selector: production only renders SecondSelect here, whose
            legacy facade defaults its root class to `select-wrapper`, never
            `select`. Mounted literally to verify the declaration resolves. */}
        <div className='select' data-testid='business-details-form-select'>Store</div>
        <input className='input-autocomplete' aria-label='Address' data-testid='business-details-form-autocomplete-input' />
      </BusinessDetailsFormControl>

      <GoogleMapContainer data-testid='business-details-map-container'>
        <label htmlFor='fixture-place-id' data-testid='business-details-map-label'>Google place ID</label>
        <p data-testid='business-details-map-place-id'>ChIJ_fixture_place_id</p>
      </GoogleMapContainer>

      {/* The whole BusinessPreview simulation lives inside this section so the
          spec can capture it on its own, instead of a full-page shot that would
          be byte-identical to the propagation screenshot. */}
      <section data-testid='preview-simulation' aria-label='Storefront preview simulation'>
      <AddressWrapper data-testid='preview-address-wrapper'>
        <span data-testid='preview-address-label'>New York</span>
      </AddressWrapper>

      <MomentWrapper data-testid='preview-moment-wrapper'>
        <span data-testid='preview-moment-label'>ASAP</span>
      </MomentWrapper>

      <OrderTypeWrapper data-testid='preview-order-type-wrapper'>
        <span data-testid='preview-order-type-label'>Delivery</span>
      </OrderTypeWrapper>

      <CartWrapper data-testid='preview-cart-wrapper'>
        <span data-testid='preview-cart-count'>0</span>
      </CartWrapper>

      <BusinessInfoItem data-testid='preview-business-info-item'>
        <h2 data-testid='preview-business-name'>Fresh Cuts Salon</h2>
        <p className='type' data-testid='preview-business-type'>Restaurant</p>
        <div className='preorder-Reviews' data-testid='preview-preorder-reviews'>
          <span data-testid='preview-preorder-label'>Preorder</span>
          <span className='dot' data-testid='preview-preorder-dot'>&bull;</span>
        </div>
      </BusinessInfoItem>

      <BusinessDetail data-testid='preview-business-detail'>
        <h5 data-testid='preview-detail-fee'>Delivery fee $2.00</h5>
        <span className='dot' data-testid='preview-detail-dot'>&bull;</span>
        <div className='review' data-testid='preview-review'>
          <svg data-testid='preview-review-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M8 1l2 4 4 .6-3 3 .7 4.4L8 11l-3.7 2 .7-4.4-3-3L6 5z' fill='currentColor' /></svg>
          <p data-testid='preview-review-count'>128</p>
        </div>
      </BusinessDetail>

      <BusinessMoreDetail data-testid='preview-more-detail'>
        <svg data-testid='preview-more-detail-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><circle cx='8' cy='8' r='6' fill='none' stroke='currentColor' /></svg>
      </BusinessMoreDetail>

      <BusinessPreviewTab onClick={() => {}} active data-testid='preview-category-tab'>All</BusinessPreviewTab>

      <CardInfo data-testid='preview-card-info'>
        <h1 data-testid='preview-card-name'>Cheeseburger</h1>
        <PriceWrapper data-testid='preview-price-wrapper'>
          <span data-testid='preview-card-price'>$8.00</span>
          {/* Dead selector in this component: `.off-price` is only ever
              rendered by the unrelated Orders/CreateCustomOrder
              SingleProductCard, never by this file's own SingleProductCard.
              Mounted literally to verify the declaration resolves. */}
          <span className='off-price' data-testid='preview-card-off-price'>$10.00</span>
        </PriceWrapper>
        <p data-testid='preview-card-description'>Grilled beef patty with cheddar.</p>
      </CardInfo>

      <SoldOut data-testid='preview-sold-out-badge'>SOLD OUT</SoldOut>

      <WrapAllCategories data-testid='preview-category-wrapper'>
        <div className='category-title'>
          <h3 data-testid='preview-category-title'>Burgers</h3>
        </div>
      </WrapAllCategories>

      <EmptyCart data-testid='preview-empty-cart'>
        <div className='empty-content'>
          <svg data-testid='preview-empty-cart-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M2 2h2l1 9h8l1-6H5' fill='none' stroke='currentColor' /></svg>
          <p data-testid='preview-empty-cart-text'>Add products in your cart</p>
        </div>
      </EmptyCart>

      <EmptyBtnWrapper data-testid='preview-empty-btn-wrapper'>
        <span data-testid='preview-empty-cart-total'>$0.00</span>
        <button type='button' data-testid='preview-empty-cart-button'>Empty cart</button>
      </EmptyBtnWrapper>

      <MobileCartViewWrapper data-testid='preview-mobile-cart-view-wrapper'>
        <span data-testid='preview-mobile-cart-total'>$0.00</span>
      </MobileCartViewWrapper>

    </section>
      </main>
  )
}
