import React from 'react'

import {
  SelectWrapper as OccupationSelectorWrapper,
  Option as OccupationSelectorOption
} from '../../../src/@/components-dashboard/src/ui/src/components/Users/OccupationSelector/styles'
import {
  Container as OccupationsFilterContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Users/OccupationsFilter/styles'
import {
  BusinessItemContainer,
  CheckWrapper as BusinessServiceCheckWrapper,
  BusinessName
} from '../../../src/@/components-dashboard/src/ui/src/components/Users/ProfessionalBusinessService/styles'
import {
  AccordionItem,
  CheckboxWrapper as CategoryTreeNodeCheckboxWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Users/ProfessionalCategoryTreeNode/styles'
import {
  UserName as ProfessionalDetailUserName,
  ActionSelectorWrapper as ProfessionalDetailActionSelectorWrapper,
  SideBarWrapper as ProfessionalDetailSideBarWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Users/ProfessionalDetail/styles'
import {
  UsersTable,
  CheckBoxWrapper as ProfessionalListCheckBoxWrapper,
  InfoBlock,
  UserTypeWrapper,
  UserEnableWrapper,
  VerifiedItem as ProfessionalListVerifiedItem
} from '../../../src/@/components-dashboard/src/ui/src/components/Users/ProfessionalList/styles'
import {
  DateRangeWrapper,
  RangeItem,
  ScheduleWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Users/ProfessionalSchedule/styles'
import {
  Container as ProfessionalServicesContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Users/ProfessionalServices/styles'

// Presentation-only fixture: the real Users (professionals) styled surfaces, no
// controller, SDK, account or network. Every interactive node here is a
// native <button> with an accessible name.
//
// `Users/ProfessionalListing/styles.js` has no `font-size` declaration at all,
// so it is not imported here (per the scope given for this batch).
//
// Real-nesting adaptations (checked against each source styles.js and its
// consuming index.js before mounting, per the a2 batch lesson):
// - OccupationSelector/styles.js's `.select` / `.header` / `.list .option`
//   font-size rules target plain CSS classNames, not styled-components. The
//   real Select this component renders (`~ui/src/styles/Select` -> the
//   `Shared/UI/Select` facade) no longer emits any of `.select-wrapper`,
//   `.select`, `.header`, `.list`, `.option` or `.custom-option` (grepped:
//   no match). Like `EqualWrapper` in the a2 fixture, these three sites are
//   mounted as plain classed divs directly under `SelectWrapper` only to
//   verify their declarations resolve; the evidence records them as
//   unreached by the current Select markup (dead CSS pointing at a
//   pre-facade DOM shape). `Option` is a separate, still-live styled
//   component (rendered as the Select's `placeholder`), so it is mounted
//   standalone rather than nested inside `SelectWrapper`.
// - ProfessionalBusinessService/styles.js's `BusinessItemContainer` has its
//   `> svg { font-size }` rule as a *sibling* of `CheckWrapper`, matching
//   index.js (`<BusinessItemContainer><CheckWrapper>…</CheckWrapper><ChevronRight
//   /></BusinessItemContainer>`) — the chevron svg is mounted as a sibling of
//   CheckWrapper, not nested inside it.
// - ProfessionalBusinessService/styles.js's `CheckWrapper` rule is
//   `span { svg { font-size } }`: the svg is mounted nested inside
//   `span.check-box`, matching index.js's
//   `<span className='check-box'><CheckSquareFill/></span>`.
// - ProfessionalCategoryTreeNode/styles.js's `AccordionItem` rule is
//   `> div { span { font-size } }`: a direct-child div wraps the span,
//   matching index.js's `<AccordionItem><div><span>…</span></div>
//   <GoTriangleDown/></AccordionItem>`. The `isProduct` variant only flips
//   `font-weight` (400 vs 600), never `font-size`, so both the category and
//   the product AccordionItem are mounted with the same nesting.
// - ProfessionalDetail/styles.js's `ActionSelectorWrapper` carries two
//   independent rules: `button { svg { font-size } }` and
//   `> div { > div { .dropdown-item { font-size } } }`. index.js renders this
//   through react-bootstrap's `DropdownButton`/`Dropdown.Item`, which is the
//   same toggle-button + two-nested-div dropdown-menu shape already
//   documented for `CustomerDetails` in the a2 fixture. It is mounted the
//   same way here: a direct-child `div.dropdown` containing the toggle
//   `button` (with the svg inside it) and a direct-child `div.dropdown-menu`
//   containing the `.dropdown-item` anchors.
// - ProfessionalDetail/styles.js's `UserName` rule is `> span { font-size }`:
//   index.js renders the name span as a direct child of `UserName`
//   (alongside a conditionally rendered `Switch`), so it is mounted as a
//   direct child here too.
// - ProfessionalDetail/styles.js's `SideBarWrapper` rule is
//   `> h1 { font-size }`: index.js wraps the h1 in a `<>…</>` Fragment
//   alongside `UserMetaFields`, which does not add a DOM node, so the h1
//   stays a direct child of SideBarWrapper.
// - ProfessionalList/styles.js's `UsersTable` rule is `td, th { font-size }`:
//   mounted with real `<thead><tr><th>` / `<tbody><tr><td>` table nesting
//   rather than bare td/th, since UsersTable is a `styled.table`.
// - ProfessionalList/styles.js's `InfoBlock` has two font-size rules on the
//   same element type — plain `p` (12px) and the higher-specificity
//   `p.bold` (14px) — both mounted as direct children, matching index.js's
//   `<InfoBlock><p className='bold'>…</p><p>…</p></InfoBlock>`.
// - ProfessionalList/styles.js's `VerifiedItem` rule has font-size on the
//   styled component itself AND on a nested `svg` (the Phone/Envelope
//   icon rendered as its direct child in index.js).
// - ProfessionalSchedule/styles.js's `ScheduleWrapper` is not imported by
//   `ProfessionalSchedule/index.js` itself — it is imported and rendered one
//   level down, by `ProfessionalSchedule/Schedule/index.js`
//   (`<ScheduleWrapper><h1>…</h1><ScheduleContentWrapper>…</ScheduleContentWrapper
//   ></ScheduleWrapper>`). The h1 is mounted as its direct child accordingly.
// - ProfessionalSchedule/styles.js's `RangeItem` rule is `> label
//   { font-size }` and is used twice in index.js with different sibling
//   content (an `<input>` for the "days into the future" row, none for the
//   "indefinitely" row); both instances are mounted since the label is a
//   direct child in both, with no change in nesting.
export const UsersA3StylesFixture = () => {
  return (
    <main data-testid='users-a3-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>
      <OccupationSelectorWrapper data-testid='occupation-select-wrapper'>
        {/* Legacy classNames: the current Select facade renders none of these
            classes. Mounted only to verify the declarations resolve, same
            rationale as `EqualWrapper` in the a2 fixture. */}
        <div className='select-wrapper'>
          <div className='select' data-testid='occupation-select-legacy-select'>
            <div className='header' data-testid='occupation-select-legacy-header'>Search occupations</div>
          </div>
          <div className='list'>
            <div className='option' data-testid='occupation-select-legacy-option'>Barber</div>
          </div>
        </div>
      </OccupationSelectorWrapper>
      <OccupationSelectorOption data-testid='occupation-select-option'>Select occupation</OccupationSelectorOption>

      <OccupationsFilterContainer data-testid='occupations-filter-container'>
        <button type='button' data-testid='occupations-filter-button'>All</button>
      </OccupationsFilterContainer>

      <BusinessItemContainer data-testid='business-item-container'>
        <BusinessServiceCheckWrapper data-testid='business-item-check-wrapper'>
          <span className='check-box'>
            <svg data-testid='business-item-check-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><rect x='2' y='2' width='12' height='12' rx='2' fill='none' stroke='currentColor' /></svg>
          </span>
          <label htmlFor='fixture-business-id'>
            <BusinessName data-testid='business-item-name'>Fresh Cuts Salon</BusinessName>
          </label>
        </BusinessServiceCheckWrapper>
        <svg data-testid='business-item-chevron-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M6 4l4 4-4 4' fill='none' stroke='currentColor' strokeWidth='1.5' /></svg>
      </BusinessItemContainer>

      <AccordionItem data-testid='category-tree-node-accordion-item'>
        <div>
          <span data-testid='category-tree-node-category-label'>Hair services</span>
        </div>
      </AccordionItem>

      <AccordionItem isProduct data-testid='category-tree-node-accordion-item-product'>
        <div>
          <span data-testid='category-tree-node-product-label'>Haircut</span>
        </div>
      </AccordionItem>

      <CategoryTreeNodeCheckboxWrapper as='button' type='button' role='checkbox' aria-checked='true' aria-label='Margherita pizza' active data-testid='category-tree-node-checkbox-wrapper'>
        <svg data-testid='category-tree-node-checkbox-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><rect x='2' y='2' width='12' height='12' rx='2' fill='none' stroke='currentColor' /></svg>
      </CategoryTreeNodeCheckboxWrapper>

      <ProfessionalDetailUserName data-testid='professional-detail-user-name-wrapper'>
        <span className='customer-name' data-testid='professional-detail-name'>Jordan Lee</span>
      </ProfessionalDetailUserName>

      <ProfessionalDetailActionSelectorWrapper data-testid='professional-detail-action-selector'>
        <div className='dropdown'>
          <button type='button' aria-label='Professional actions' aria-haspopup='true' aria-expanded='false'>
            <svg data-testid='professional-detail-action-toggle-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><circle cx='8' cy='3' r='1.2' /><circle cx='8' cy='8' r='1.2' /><circle cx='8' cy='13' r='1.2' /></svg>
          </button>
          <div className='dropdown-menu'>
            <a className='dropdown-item' href='#' data-testid='professional-detail-action-dropdown-item'>Custom fields</a>
          </div>
        </div>
      </ProfessionalDetailActionSelectorWrapper>

      <ProfessionalDetailSideBarWrapper data-testid='professional-detail-sidebar-wrapper'>
        <h1 data-testid='professional-detail-sidebar-title'>Custom fields</h1>
      </ProfessionalDetailSideBarWrapper>

      <UsersTable data-testid='professional-list-table'>
        <thead>
          <tr>
            <th data-testid='professional-list-table-header-cell'>User</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <ProfessionalListCheckBoxWrapper as='button' type='button' role='checkbox' aria-checked='false' aria-label='Select a user' data-testid='professional-list-checkbox-wrapper'>
                <svg data-testid='professional-list-checkbox-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><rect x='2' y='2' width='12' height='12' rx='2' fill='none' stroke='currentColor' /></svg>
              </ProfessionalListCheckBoxWrapper>
              <InfoBlock data-testid='professional-list-info-block'>
                <p className='bold' data-testid='professional-list-info-primary'>Jane Doe</p>
                <p data-testid='professional-list-info-secondary'>Barber</p>
              </InfoBlock>
              <ProfessionalListVerifiedItem data-testid='professional-list-verified-badge'>
                <svg data-testid='professional-list-verified-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M3 8l3 3 7-7' fill='none' stroke='currentColor' strokeWidth='2' /></svg>
                Verified
              </ProfessionalListVerifiedItem>
            </td>
            <td>
              <UserTypeWrapper data-testid='professional-list-user-type-wrapper'>
                <p data-testid='professional-list-email'>jane@example.com</p>
              </UserTypeWrapper>
            </td>
            <td>
              <UserEnableWrapper data-testid='professional-list-user-enable-wrapper'>
                <span data-testid='professional-list-enable-label'>Enable</span>
              </UserEnableWrapper>
            </td>
          </tr>
        </tbody>
      </UsersTable>

      <DateRangeWrapper data-testid='professional-schedule-daterange-wrapper'>
        <h1 data-testid='professional-schedule-daterange-title'>Date range</h1>
        <p data-testid='professional-schedule-daterange-description'>Customers can schedule…</p>
      </DateRangeWrapper>

      <RangeItem data-testid='professional-schedule-range-item-days'>
        <span>
          <svg viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><circle cx='8' cy='8' r='6' fill='none' stroke='currentColor' /></svg>
        </span>
        <input aria-label='Maximum days in future' defaultValue='' />
        <label data-testid='professional-schedule-range-item-label-days'>days into the future</label>
      </RangeItem>

      <RangeItem data-testid='professional-schedule-range-item-indefinite'>
        <span>
          <svg viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><circle cx='8' cy='8' r='6' fill='none' stroke='currentColor' /></svg>
        </span>
        <label data-testid='professional-schedule-range-item-label-indefinite'>Indefinitely into the future</label>
      </RangeItem>

      <ScheduleWrapper data-testid='professional-schedule-schedule-wrapper'>
        <h1 data-testid='professional-schedule-schedule-title'>Schedule</h1>
      </ScheduleWrapper>

      <ProfessionalServicesContainer data-testid='professional-services-container'>
        <h1 data-testid='professional-services-title'>Services</h1>
      </ProfessionalServicesContainer>
    </main>
  )
}
