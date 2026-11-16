import React, { useState } from 'react'

import { GroupWrapper as PaymethodGroup } from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/DriversGroupPaymethods/styles'
import {
  Header as ZoneHeader,
  Tab as ZoneTab,
  TabContainer as ZoneTabContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/DriversGroupsDeliveryZoneDetails/styles'
import {
  BorderWrapper,
  CheckBoxWrapper as GroupCheckbox,
  EnableWrapper as GroupEnable,
  GroupNameContainer,
  GroupsTable,
  InfoBlock as GroupInfoBlock,
  TableWrapper as GroupsTableWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/DriversGroupsList/styles'
import {
  DriversGroupsListingContainer,
  HeaderLeftContainer as GroupsHeaderLeft
} from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/DriversGroupsListing/styles'
import {
  Container as MarkAsBusyContainer,
  InputWrapper as MarkAsBusyInput,
  StepItem
} from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/DriversMarkAsBusy/styles'
import { GpsButtonStyle } from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/GoogleGpsButton/styles'
import {
  DriverGroupItem,
  DriverGroupListContainer,
  FormContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/UserAddForm/styles'
import { Camera } from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/UserProfileForm/styles'
import { Input } from '../../../src/@/components-dashboard/src/ui/src/styles'

export const Delivery3StylesFixture = () => {
  const [groupSelected, setGroupSelected] = useState(false)
  const [zoneTab, setZoneTab] = useState('information')

  return (
    <main data-testid='delivery-3-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>
      <section data-testid='groups-listing' aria-label='Driver groups listing'>
        <DriversGroupsListingContainer data-testid='groups-motion-surface'>
          <GroupsHeaderLeft><h1 data-testid='groups-title'>Driver groups</h1></GroupsHeaderLeft>
        </DriversGroupsListingContainer>
        <GroupsTableWrapper data-testid='groups-table-scroll'>
          <GroupsTable aria-label='Driver groups'>
            <thead>
              <tr>
                <th scope='col'>
                  <GroupCheckbox
                    type='button'
                    className='group-checkbox'
                    aria-label='Select all'
                    aria-pressed={groupSelected}
                    isChecked={groupSelected}
                    onClick={() => setGroupSelected(value => !value)}
                  >
                    <span aria-hidden='true'>✓</span>
                  </GroupCheckbox>
                </th>
                <th scope='col' data-testid='groups-th'>Group</th>
                <th scope='col'>Manager</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-testid='groups-td'>77</td>
                <th scope='row'>
                  <GroupNameContainer><p data-testid='group-name'>Downtown weekend couriers</p></GroupNameContainer>
                </th>
                <td>
                  <BorderWrapper data-testid='group-border'>Operations</BorderWrapper>
                  <GroupInfoBlock>
                    <p className='bold' data-testid='group-manager'>Marta Ruiz</p>
                    <p data-testid='group-manager-mail'>marta.ruiz@example.invalid</p>
                  </GroupInfoBlock>
                  <GroupEnable><span data-testid='group-enable'>Enabled</span></GroupEnable>
                </td>
              </tr>
            </tbody>
          </GroupsTable>
        </GroupsTableWrapper>
        <PaymethodGroup><p data-testid='paymethod-copy'>Cash on delivery</p></PaymethodGroup>
      </section>

      <section data-testid='zone-details' aria-label='Delivery zone details'>
        <ZoneHeader><h1 data-testid='zone-title'>Downtown delivery zone</h1></ZoneHeader>
        <ZoneTabContainer role='tablist' aria-label='Delivery zone'>
          {['information', 'drivers'].map(value => (
            <ZoneTab
              key={value}
              type='button'
              id={`delivery-zone-${value}-tab`}
              role='tab'
              aria-selected={zoneTab === value}
              aria-controls='delivery-zone-panel'
              tabIndex={zoneTab === value ? 0 : -1}
              active={zoneTab === value}
              onClick={() => setZoneTab(value)}
            >
              {value}
            </ZoneTab>
          ))}
        </ZoneTabContainer>
        <div id='delivery-zone-panel' role='tabpanel' aria-labelledby={`delivery-zone-${zoneTab}-tab`}>
          <p data-testid='zone-panel'>Zone {zoneTab}</p>
        </div>
      </section>

      <section data-testid='user-forms' aria-label='User forms'>
        <FormContainer onSubmit={event => event.preventDefault()}>
          <h1 data-testid='add-user-title'>Add driver</h1>
          <DriverGroupListContainer>
            <DriverGroupItem><span data-testid='assign-group'>Weekend delivery group</span></DriverGroupItem>
          </DriverGroupListContainer>
          <Camera data-testid='profile-camera'><span aria-hidden='true'>◎</span></Camera>
        </FormContainer>
      </section>

      <section data-testid='mark-as-busy' aria-label='Mark as busy'>
        <MarkAsBusyContainer>
          <h1 data-testid='busy-title'>Mark drivers as busy</h1>
          <MarkAsBusyInput><label htmlFor='fixture-busy-reason' data-testid='busy-label'>Reason</label><Input id='fixture-busy-reason' defaultValue='Vehicle maintenance' /></MarkAsBusyInput>
          <StepItem><div className='number' data-testid='step-number'>1</div><span data-testid='step-copy'>Select the drivers</span></StepItem>
        </MarkAsBusyContainer>
      </section>

      <section data-testid='gps' aria-label='Driver GPS'>
        <div style={{ position: 'relative', height: 64 }}>
          <GpsButtonStyle type='button' aria-label='Center the map on the driver' data-testid='gps-button'>GPS</GpsButtonStyle>
        </div>
      </section>
    </main>
  )
}
