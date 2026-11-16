import React from 'react'

import {
  InfoConatiner as BusinessDetailInfoContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessDetail/styles'
import {
  Header as PlaceHeader,
  ActionSelectorWrapper as PlaceActionSelectorWrapper,
  Content as PlaceContent
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessPlace/styles'
import {
  Header as PlaceGroupHeader,
  ActionSelectorWrapper as PlaceGroupActionSelectorWrapper,
  Content as PlaceGroupContent,
  CheckWrapper as PlaceGroupCheckWrapper,
  PlaceItemContainer as PlaceGroupItemContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessPlaceGroup/styles'
import {
  Header as PlaceGroupListHeader,
  CheckWrapper as PlaceGroupListCheckWrapper,
  PlaceItemContainer as PlaceGroupListItemContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessPlaceGroupList/styles'

// Presentation-only fixture: the real Stores (business detail / info tab)
// styled surfaces for batch b3-business-detail-info, no controller, SDK,
// account or network. Every interactive node here is mounted exactly as it
// exists in today's source: a styled `div`/`span` (or a native `<p>`/`<span>`)
// with `onClick` stays that element (never promoted to `<button>` and never
// given invented `type='button'`/`aria-pressed` attributes) — the coordinator
// converts these and aligns the fixture itself, per this batch's explicit
// instruction. `Stores/BusinessDetails/styles.js` (plural) declares no
// font-size and is out of this batch's mount list; `Stores/BusinessDetail`
// (singular, mounted below) is a distinct file.
//
// Four source `styles.js` files are mounted below. BusinessInformation, BusinessEmail
//, BusinessInfoSettingList, BusinessLocation, BusinessImages and BusinessVideos
//, BusinessCategoryInfoSettingList, BusinessFrontLayout,
// BusinessWhiteLabel and BusinessCustomFields moved to
// Product wrappers and plain CSS and have no styles.js left to mount. Several export
// names collide across the remaining files (`Container`, `Tab`, `Header`,
// `ActionSelectorWrapper`, `Content`, `CheckWrapper`, `PlaceItemContainer`),
// so every import is aliased at the import
// site, e.g. `Header as PlaceGroupHeader`. Ancestors that carry no font-size
// declaration of their own (`Container`, `FormInput`, `SocialItemWrapper`,
// …) are omitted: none of the declarations mounted
// here depend on them for the CSS to resolve, since each rule is scoped to
// its own styled-component's generated class.
//
// Real-nesting adaptations (checked against each source styles.js and its
// consuming index.js before mounting):
// - BusinessDetail/styles.js's `InfoConatiner` rule is a bare descendant `h1
//   { font-size: 20px }`: BusinessDetail/index.js renders the h1 as a direct
//   child (alongside `BusinessInfoSettingList` and the conditional tab
//   panels), mounted the same way.
// - BusinessPlace/styles.js's `Header` rule is `h1 { font-size: 20px; …}`:
//   index.js renders the h1 as a direct child (alongside `ActionBlock`),
//   mounted the same way.
// - BusinessPlace/styles.js's `ActionSelectorWrapper` carries `button
//   { … svg { font-size: 20px } }` and `> div { > div { … .dropdown-item
//   { font-size: 12px } … } }`. index.js renders a `react-bootstrap`
//   `DropdownButton` whose toggle renders as a real `<button>` containing
//   the `title={<ThreeDots/>}` icon directly as a child, and whose menu
//   (`Dropdown.Item`) resolves to a real item element two direct-child divs
//   deep (the library's own wrapper div, then its menu div). Mounted here
//   with a plain `<button>` standing in for the toggle (icon as its direct
//   child) and a plain `div > div > div.dropdown-item` standing in for the
//   menu shape, matching the a1/b2 convention for facade internals.
// - BusinessPlace/styles.js's `Content` rule is a bare descendant `label
//   { font-size: 14px }`: index.js renders the label as a direct child
//   (alongside `Input`/`HideSubmitBtn`), mounted the same way.
// - BusinessPlaceGroup/styles.js's `Header`, `ActionSelectorWrapper` and
//   `Content` are separate styled-components from `BusinessPlace`'s
//   (distinct file, identical shape and consuming index.js pattern),
//   mounted the same way as their `BusinessPlace` counterparts above.
// - BusinessPlaceGroup/styles.js's `CheckWrapper` carries `span { svg
//   { font-size: 16px } }` and `> label { font-size: 14px }`.
//   `PlaceItemContainer`'s own rule is `> svg { font-size: 16px }`. index.js
//   renders `<PlaceItemContainer key={i} active={…} onClick={(e) =>
//   handlePlaceClick(e, place)}><CheckWrapper><span className='check-box'
//   onClick={() => handleCheckBoxChange(place)}>{icon}</span>
//   <label>{place?.name}</label></CheckWrapper><ChevronRight/>
//   </PlaceItemContainer>`. `PlaceItemContainer` is a `styled.div` with a
//   real `onClick`, kept as a plain `div`, unconverted; its native
//   `<span className='check-box' onClick={…}>` child is likewise kept as a
//   plain `span` with `onClick`, unconverted. `CheckWrapper` and the
//   `ChevronRight` icon are mounted as direct-child siblings inside
//   `PlaceItemContainer`, matching that exact nesting — a sibling
//   `CheckWrapper` mounted outside `PlaceItemContainer` would NOT be the
//   real shape and would miss the point of the `> svg` combinator.
// - BusinessPlaceGroupList/styles.js's `Header`, `CheckWrapper` and
//   `PlaceItemContainer` are separate styled-components from
//   `BusinessPlaceGroup`'s (distinct file; `BusinessPlaceGroupList` has no
//   `ActionSelectorWrapper`/`Content` of its own), mounted the same way:
//   `Header`'s `h1` as its direct child, and `CheckWrapper` nested inside
//   `PlaceItemContainer` alongside the `> svg` sibling, matching index.js's
//   `<PlaceItemContainer key={i} active={…} onClick={(e) =>
//   handlePlaceClick(e, placeGroup)}><CheckWrapper>…</CheckWrapper>
//   <ChevronRight/></PlaceItemContainer>`.
export const StoresB3StylesFixture = () => {
  return (
    <main data-testid='stores-b3-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>

      <section data-testid='business-detail-group' aria-label='Business detail'>
        <BusinessDetailInfoContainer>
          <h1 data-testid='business-detail-info-heading'>Store details</h1>
        </BusinessDetailInfoContainer>
      </section>

      <section data-testid='business-place-group' aria-label='Business place editor'>
        <PlaceHeader>
          <h1 data-testid='business-place-header-title'>New option</h1>
        </PlaceHeader>

        <PlaceActionSelectorWrapper>
          <button type='button'>
            <svg data-testid='business-place-action-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><circle cx='8' cy='2' r='1' fill='currentColor' /><circle cx='8' cy='8' r='1' fill='currentColor' /><circle cx='8' cy='14' r='1' fill='currentColor' /></svg>
          </button>
          <div>
            <div>
              <div className='dropdown-item' data-testid='business-place-dropdown-item'>Delete</div>
            </div>
          </div>
        </PlaceActionSelectorWrapper>

        <PlaceContent>
          <label data-testid='business-place-name-label'>Name</label>
        </PlaceContent>
      </section>

      <section data-testid='business-place-group-editor-group' aria-label='Business place group editor'>
        <PlaceGroupHeader>
          <h1 data-testid='place-group-header-title'>New place</h1>
        </PlaceGroupHeader>

        <PlaceGroupActionSelectorWrapper>
          <button type='button'>
            <svg data-testid='place-group-action-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><circle cx='8' cy='2' r='1' fill='currentColor' /><circle cx='8' cy='8' r='1' fill='currentColor' /><circle cx='8' cy='14' r='1' fill='currentColor' /></svg>
          </button>
          <div>
            <div>
              <div className='dropdown-item' data-testid='place-group-dropdown-item'>Delete</div>
            </div>
          </div>
        </PlaceGroupActionSelectorWrapper>

        <PlaceGroupContent>
          <label data-testid='place-group-name-label'>Name</label>
        </PlaceGroupContent>

        <PlaceGroupItemContainer onClick={() => {}}>
          <PlaceGroupCheckWrapper>
            <span className='check-box' onClick={() => {}}>
              <svg data-testid='place-group-check-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><rect x='2' y='2' width='12' height='12' rx='2' fill='none' stroke='currentColor' /></svg>
            </span>
            <label data-testid='place-group-check-label'>Bacon</label>
          </PlaceGroupCheckWrapper>
          <svg data-testid='place-group-item-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M6 4l4 4-4 4' fill='none' stroke='currentColor' /></svg>
        </PlaceGroupItemContainer>
      </section>

      <section data-testid='business-place-group-list-group' aria-label='Business place group list'>
        <PlaceGroupListHeader>
          <h1 data-testid='place-group-list-header-title'>Places</h1>
        </PlaceGroupListHeader>

        <PlaceGroupListItemContainer onClick={() => {}}>
          <PlaceGroupListCheckWrapper>
            <span className='check-box' onClick={() => {}}>
              <svg data-testid='place-group-list-check-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><rect x='2' y='2' width='12' height='12' rx='2' fill='none' stroke='currentColor' /></svg>
            </span>
            <label data-testid='place-group-list-check-label'>Downtown</label>
          </PlaceGroupListCheckWrapper>
          <svg data-testid='place-group-list-item-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M6 4l4 4-4 4' fill='none' stroke='currentColor' /></svg>
        </PlaceGroupListItemContainer>
      </section>

    </main>
  )
}
