import React from 'react'

import {
  Tab as ActiveStateTab,
  UserActiveStateFilterContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Users/UserActiveStateFilter/styles'
import { FormContainer } from '../../../src/@/components-dashboard/src/ui/src/components/Users/UserAddForm/styles'
import {
  ActionSelectorWrapper,
  DetailsHeader,
  RightHeader,
  UserName,
  VerifiedItem as DetailsVerifiedItem,
  VerifiedItemsWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Users/UserDetails/styles'
import {
  Tab as DetailsMenuTab,
  UserDetailsMenuContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Users/UserDetailsMenu/styles'
import {
  Container as FilterContainer,
  FormControl,
  FormGroup,
  Option as FilterOption,
  RangeSelectWrapper,
  SwitchWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Users/UserFilterGroup/styles'
import {
  DriverZoneRestrictionWrapper,
  InputWrapper,
  TogglePassword,
  WrapperPassword
} from '../../../src/@/components-dashboard/src/ui/src/components/Users/UserFormDetails/styles'
import {
  MetaAddContainer,
  MetaContainer,
  NoMetaField,
  RoundBorder,
  WrapMetaFields
} from '../../../src/@/components-dashboard/src/ui/src/components/Users/UserMetaFields/styles'
import { Camera } from '../../../src/@/components-dashboard/src/ui/src/components/Users/UserProfileForm/styles'
import { Option as TypeSelectorOption } from '../../../src/@/components-dashboard/src/ui/src/components/Users/UserTypeSelector/styles'
import {
  HeaderTitleContainer,
  InfoContent
} from '../../../src/@/components-dashboard/src/ui/src/components/Users/UsersListingHeader/styles'

// Presentation-only fixture: the real Users styled surfaces, no controller,
// SDK, account or network. Every interactive node here is a native <button>
// with an accessible name, matching what the adopted screens now render.
export const UsersA1StylesFixture = () => {
  return (
    <main data-testid='users-a1-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>
      <UserActiveStateFilterContainer data-testid='active-state-filter'>
        <ActiveStateTab as='button' type='button' active aria-pressed='true' data-testid='active-state-tab-active'>Active</ActiveStateTab>
        <ActiveStateTab as='button' type='button' aria-pressed='false' data-testid='active-state-tab-inactive'>Inactive</ActiveStateTab>
      </UserActiveStateFilterContainer>

      <UserDetailsMenuContainer data-testid='details-menu'>
        <DetailsMenuTab as='button' type='button' active aria-pressed='true' data-testid='details-menu-tab-active'>Profile</DetailsMenuTab>
        <DetailsMenuTab as='button' type='button' aria-pressed='false' data-testid='details-menu-tab-inactive'>Orders</DetailsMenuTab>
      </UserDetailsMenuContainer>

      <FormContainer data-testid='add-form-container'>
        <h1 data-testid='add-form-title'>Add user</h1>
      </FormContainer>

      <DetailsHeader data-testid='details-header'>
        <UserName data-testid='details-user-name'>
          <span data-testid='details-user-name-text'>Ada Lovelace</span>
        </UserName>
        <RightHeader>
          <VerifiedItemsWrapper>
            <DetailsVerifiedItem data-testid='details-verified'>
              <svg data-testid='details-verified-icon' viewBox='0 0 16 16' width='12' height='12' aria-hidden='true' focusable='false'><path d='M3 8l3 3 7-7' fill='none' stroke='currentColor' strokeWidth='2' /></svg>
              <span data-testid='details-verified-label'>Verified</span>
            </DetailsVerifiedItem>
          </VerifiedItemsWrapper>
          <ActionSelectorWrapper data-testid='details-action-selector'>
            <button type='button' aria-label='User actions' aria-haspopup='true' aria-expanded='false'>
              <svg data-testid='details-action-icon' viewBox='0 0 16 16' width='20' height='20' aria-hidden='true' focusable='false'><circle cx='8' cy='3' r='1.2' /><circle cx='8' cy='8' r='1.2' /><circle cx='8' cy='13' r='1.2' /></svg>
            </button>
          </ActionSelectorWrapper>
        </RightHeader>
      </DetailsHeader>

      <FilterContainer data-testid='filter-group'>
        <FormGroup data-testid='filter-form-group'>
          <FormControl data-testid='filter-form-control'>
            <label htmlFor='fixture-filter-status' data-testid='filter-control-label'>Order status</label>
            <div data-testid='filter-control-value'>Delivered</div>
          </FormControl>
          <RangeSelectWrapper data-testid='filter-range-select'>
            <div className='select'>
              <div data-testid='filter-range-select-head'>Amount</div>
            </div>
            <input id='fixture-filter-status' aria-label='Minimum amount' data-testid='filter-range-input' />
          </RangeSelectWrapper>
        </FormGroup>
        <FilterOption data-testid='filter-option'>All users</FilterOption>
        <SwitchWrapper data-testid='filter-switch'>
          <label htmlFor='fixture-filter-switch' data-testid='filter-switch-label'>Show disabled users</label>
          <input id='fixture-filter-switch' type='checkbox' />
        </SwitchWrapper>
      </FilterContainer>

      <DriverZoneRestrictionWrapper data-testid='driver-zone-restriction'>
        <span data-testid='driver-zone-restriction-copy'>Restrict driver to zone</span>
        <input type='checkbox' aria-label='Restrict driver to zone' />
      </DriverZoneRestrictionWrapper>

      <WrapperPassword data-testid='password-wrapper'>
        <input type='password' aria-label='Password' readOnly value='xxxxxxxx' />
        <TogglePassword as='button' type='button' aria-label='Show password' data-testid='toggle-password'>
          <svg viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z' fill='none' stroke='currentColor' strokeWidth='1.5' /></svg>
        </TogglePassword>
      </WrapperPassword>

      <InputWrapper isTimezone data-testid='form-input-wrapper'>
        {/* The real .list-wrapper is nested inside .select, not a sibling of it. */}
        <div className='select' data-testid='form-select-control'>
          <div>UTC-05:00 America/New_York</div>
          <div className='list-wrapper' data-testid='form-select-list'>UTC-05:00 America/New_York</div>
        </div>
      </InputWrapper>

      <WrapMetaFields data-testid='meta-fields'>
        <MetaContainer data-testid='meta-row'>
          <div className='meta_type' data-testid='meta-type'>Text</div>
          <div className='meta_key'>preferred_language</div>
          <div className='meta_value' data-testid='meta-value'>
            <div data-testid='meta-value-text'>en-US</div>
            <svg data-testid='meta-value-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M2 2h12v12H2z' fill='none' stroke='currentColor' /></svg>
          </div>
        </MetaContainer>
        <MetaAddContainer data-testid='meta-add-row'>
          <div className='meta_type'>Text</div>
          <div className='meta_key'>
            <input aria-label='Meta key' placeholder='Key' />
          </div>
          <div className='meta_value'>
            <input aria-label='Meta value' placeholder='Value' data-testid='meta-add-input' />
          </div>
        </MetaAddContainer>
        <RoundBorder data-testid='meta-round-border'>{'{"locale":"en-US"}'}</RoundBorder>
        <NoMetaField data-testid='meta-empty'>No metafields yet</NoMetaField>
      </WrapMetaFields>

      <div style={{ position: 'relative', width: 48, height: 48 }}>
        <Camera data-testid='profile-camera'>
          <svg data-testid='profile-camera-icon' viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><rect x='2' y='4' width='12' height='9' rx='1' fill='none' stroke='currentColor' /></svg>
        </Camera>
      </div>

      <TypeSelectorOption padding data-testid='type-selector-option'>Driver</TypeSelectorOption>

      <HeaderTitleContainer data-testid='listing-header-title-container'>
        <h1 data-testid='listing-header-title'>Users</h1>
        <button type='button' aria-label='Open filters' data-testid='listing-header-filter-button'>
          <svg viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><path d='M2 4h12M4 8h8M6 12h4' stroke='currentColor' strokeWidth='1.5' /></svg>
        </button>
      </HeaderTitleContainer>

      <div style={{ position: 'relative' }}>
        <button type='button' aria-label='User count info' data-testid='listing-header-info-trigger'>i</button>
        <InfoContent data-testid='listing-header-info-content'>Includes disabled accounts</InfoContent>
      </div>
    </main>
  )
}
