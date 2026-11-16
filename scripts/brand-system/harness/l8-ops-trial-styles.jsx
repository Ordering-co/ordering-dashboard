import React from 'react'

import { Button as DgsButton } from '../../../src/@/components-dashboard/src/ui/src/styles'
import { Container as DgsContainer } from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/DriversGroupSchedule/styles'
import {
  CheckboxContainer as SfCheckboxContainer,
  Description as SfDescription,
  HeaderWrapper as SfHeaderWrapper,
  InputWrapper as SfInputWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/DriversGroupAddForm/ScheduleForm/styles'
import {
  Container as BcContainer,
  EmptyState as BcEmptyState,
  SectionCard as BcSectionCard,
  SectionHeader as BcSectionHeader,
  SectionTitle as BcSectionTitle
} from '../../../src/@/components-dashboard/src/ui/src/components/Stores/BusinessConfigs/styles'
import {
  SecondaryLink as CeSecondaryLink,
  StatusText as CeStatusText,
  Wrapper as CeWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/TrialExtension/CalendlyInlineEmbed/styles'
import {
  Card as HcCard,
  Description as HcDescription,
  TextContent as HcTextContent,
  Title as HcTitle
} from '../../../src/@/components-dashboard/src/ui/src/components/TrialExtension/TrialExtensionHomeCard/styles'

// Batch fixture for l8-ops-trial (L8 3.3).
//
// It mounts the real STYLES with the product's markup, not the controllers:
// ScheduleForm, BusinessConfigs and the TrialExtension family reach drivers
// groups, project configuration and a booking flow, and none of that belongs
// behind a typography test.
//
// Two deliberate omissions, both for the network boundary:
//   - CalendlyInlineEmbed: only its own styled text components are mounted. The
//     iframe (`StyledIframe`) is NOT rendered, so nothing reaches Calendly.
//   - ScheduleForm's select: `.select` and `.list-wrapper` belong to FirstSelect
//     (Shared), not to ScheduleForm. The minimal class structure the selector
//     reaches is mounted instead (`.select > .list > .list-wrapper`, the
//     topology FirstSelect's own test pins). `isTimezone` is passed because the
//     `.list-wrapper` rule only exists behind that branch.
//
// One node per rule of l8-ops-trial-typography-rules.json, in rule order. The
// TrialExtensionBanner and TrialExtensionModal styled components are gone (both
// are plain CSS now), so the fixture no longer mounts them.
export const L8OpsTrialStylesFixture = () => (
  <div data-testid='l8-ops-trial-styles' style={{ padding: 24, display: 'grid', gap: 12 }}>

    {/* Delivery/DriversGroupAddForm/ScheduleForm */}
    <SfHeaderWrapper>
      <h2 data-testid='sf-header-title'>Schedule</h2>
      <SfCheckboxContainer>
        <input type='checkbox' aria-label='Always available' defaultChecked />
        <p data-testid='sf-checkbox-label'>Always available</p>
      </SfCheckboxContainer>
    </SfHeaderWrapper>
    <SfDescription data-testid='sf-description'>Each time range must start and end on the same day.</SfDescription>
    <SfInputWrapper isTimezone>
      <label data-testid='sf-timezone-label'>Timezone</label>
      <div className='select' data-testid='sf-select'>
        <div className='list'>
          <div className='list-wrapper' data-testid='sf-list-wrapper'>America/New_York</div>
        </div>
      </div>
    </SfInputWrapper>

    {/* Delivery/DriversGroupSchedule: the real Container with its Save button (L8 1.3-D).
        Same markup as the product: the form carries `disabled`, and while it is
        disabled it is also `inert` and `aria-disabled` (the empty string is how
        React 18 spells a true `inert`). The ScheduleForm fields are stood in for by
        plain inputs: only the form wrapper and the button are under test. */}
    <DgsContainer data-testid='dgs-form' onSubmit={e => e.preventDefault()}>
      <input data-testid='dgs-field' aria-label='Timezone' defaultValue='America/New_York' />
      <DgsButton data-testid='dgs-save' borderRadius='8px' color='primary' type='submit'>Save</DgsButton>
    </DgsContainer>
    <DgsContainer data-testid='dgs-form-disabled' disabled inert='' aria-disabled='true' onSubmit={e => e.preventDefault()}>
      <input data-testid='dgs-field-disabled' aria-label='Timezone (disabled)' defaultValue='America/New_York' />
      <DgsButton data-testid='dgs-save-disabled' borderRadius='8px' color='primary' type='submit'>Save</DgsButton>
    </DgsContainer>

    {/* Stores/BusinessConfigs */}
    <BcContainer>
      <h1 data-testid='bc-title'>Integrations settings</h1>
      <BcSectionCard>
        <BcSectionHeader>
          <BcSectionTitle data-testid='bc-section-title'>Payments</BcSectionTitle>
        </BcSectionHeader>
      </BcSectionCard>
      <BcEmptyState data-testid='bc-empty-state'>No integrations settings available for this business.</BcEmptyState>
    </BcContainer>

    {/* TrialExtension/CalendlyInlineEmbed (styles only, no iframe) */}
    <CeWrapper>
      <CeStatusText role='status' data-testid='ce-status-text'>Loading the calendar</CeStatusText>
      <CeSecondaryLink href='#calendar' data-testid='ce-secondary-link'>Open the calendar in a new tab</CeSecondaryLink>
    </CeWrapper>

    {/* TrialExtension/TrialExtensionHomeCard */}
    <HcCard aria-labelledby='fixture-l8-ops-trial-home-card'>
      <HcTextContent>
        <HcTitle id='fixture-l8-ops-trial-home-card' data-testid='hc-title'>Extend your trial</HcTitle>
        <HcDescription data-testid='hc-description'>Book a short call and get more time to evaluate.</HcDescription>
      </HcTextContent>
    </HcCard>
  </div>
)
