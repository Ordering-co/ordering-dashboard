import React, { useRef, useState } from 'react'

import {
  ButtonsContainer,
  Container as GroupAddForm,
  SectionContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/DriversGroupAddForm/styles'
import {
  CheckboxContainer as AdvancedCheckbox,
  OrderStatusGroup,
  OrderStatusWrapper,
  RadioButton,
  SubSectionContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/DriversGroupAddForm/AdvancedLogisticsForm/styles'
import { BusinessWrapper as AddBusinessWrapper } from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/DriversGroupAddForm/BusinessesForm/styles'
import { InputWrapper as AddGeneralInput } from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/DriversGroupAddForm/GeneralForm/styles'
import { GroupWrapper as AddPaymethodWrapper } from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/DriversGroupAddForm/PaymethodsForm/styles'
import {
  AutoassignContainer,
  AutoassignItem,
  CheckboxWrapper as AutoassignCheckbox,
  FieldContainer,
  ForcedAssignSettingWrapper,
  MaxDistanceCustomerContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/DriversGroupAutoassign/styles'
import { BusinessWrapper as GroupBusinessWrapper } from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/DriversGroupBusinesses/styles'
import { GroupWrapper as GroupCompanyWrapper } from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/DriversGroupCompanies/styles'
import {
  ErrorText,
  FormControl as ZoneFormControl,
  MapStage,
  WrapperMap
} from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/DriversGroupDeliveryZoneInformation/styles'
import { Button as ProductButton } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Product'
// the Product button reads the --od-x-* candidates, which the app loads from src/index.js
import '../../../src/brand/candidates.css'
import {
  AddDeliveryZoneButton,
  DeliveryZonesTable,
  ZoneOpenButton,
  ZoneRow
} from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/DriversGroupDeliveryZoneList/styles'
import {
  ActionSelectorWrapper,
  Header as GroupDetailsHeader,
  MenusContainer,
  Tab,
  TabPanel
} from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/DriversGroupDetails/styles'
import {
  DriverInfoContainer,
  DriverTemporaryContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/DriversGroupDrivers/styles'
import {
  CheckboxContainer as GeneralCheckbox,
  InputWrapper as GroupGeneralInput,
  ManagerInfoContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/DriversGroupGeneralForm/styles'
import {
  LogisticsConfigItem,
  LogisticsConfigsContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/DriversGroupLogistics/styles'
import {
  DateTimeWrapper,
  EventTypeContainer,
  NoData,
  SeeChanges,
  Table as LogsTable,
  TableWrapper as LogsTableWrapper,
  UserInfoContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/DriversGroupLogs/styles'
import {
  FieldWrapper,
  GroupOrdersContainer,
  MapsApiDescriptionContainer,
  UseMapsApiCheckboxContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/DriversGroupOrders/styles'

export const Delivery2StylesFixture = () => {
  const [startInStatus, setStartInStatus] = useState(7)
  const startInStatusOptions = [{ status: 7, label: 'Accepted by Business.' }, { status: 4, label: 'Preparation Completed' }]
  const startInStatusRefs = useRef([])

  const handleStartInStatusKeyDown = (event, index) => {
    let nextIndex = index
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % startInStatusOptions.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + startInStatusOptions.length) % startInStatusOptions.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = startInStatusOptions.length - 1
    else return
    event.preventDefault()
    setStartInStatus(startInStatusOptions[nextIndex].status)
    startInStatusRefs.current[nextIndex]?.focus()
  }
  const [tab, setTab] = useState('general')
  const [config, setConfig] = useState('GROUP_ORDERS')

  return (
    <main data-testid='delivery-2-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>
      <GroupAddForm data-testid='group-add-form' onSubmit={event => event.preventDefault()}>
        <SectionContainer>
          <h2 data-testid='add-section-title'>General</h2>
          <AddGeneralInput>
            <label htmlFor='fixture-group-name'>Name</label>
            <input id='fixture-group-name' defaultValue='Downtown couriers' />
            <div className='select' data-testid='add-select-value'>In house drivers</div>
          </AddGeneralInput>
          <AddBusinessWrapper>
            <input id='fixture-add-business' type='checkbox' defaultChecked />
            <label htmlFor='fixture-add-business' data-testid='add-business-name'>North Operations Store With A Long Name</label>
          </AddBusinessWrapper>
          <AddPaymethodWrapper>
            <input id='fixture-add-paymethod' type='checkbox' defaultChecked />
            <label htmlFor='fixture-add-paymethod' data-testid='add-paymethod-name'>Cash</label>
          </AddPaymethodWrapper>
        </SectionContainer>
        <SectionContainer data-testid='advanced-logistics'>
          <AdvancedCheckbox>
            <input id='fixture-use-advanced' type='checkbox' defaultChecked />
            <label htmlFor='fixture-use-advanced' data-testid='advanced-toggle-label'>Use advanced logistic</label>
          </AdvancedCheckbox>
          <OrderStatusGroup role='radiogroup' aria-label='Start group in status'>
            {startInStatusOptions.map((option, index) => (
              <OrderStatusWrapper
                key={option.status}
                as='button'
                type='button'
                role='radio'
                aria-checked={startInStatus === option.status}
                tabIndex={startInStatus === option.status ? 0 : -1}
                onClick={() => setStartInStatus(option.status)}
                onKeyDown={event => handleStartInStatusKeyDown(event, index)}
                ref={element => { startInStatusRefs.current[index] = element }}
              >
                <RadioButton active={startInStatus === option.status}><span data-testid={`status-glyph-${option.status}`}>●</span></RadioButton>
                <span data-testid={`status-label-${option.status}`}>{option.label}</span>
              </OrderStatusWrapper>
            ))}
          </OrderStatusGroup>
          <SubSectionContainer><div><h1 data-testid='subsection-title'>Group orders</h1></div></SubSectionContainer>
        </SectionContainer>
        <ButtonsContainer>
          <button type='submit' data-testid='add-submit'>Add</button>
          <button type='button' data-testid='add-cancel'>Cancel</button>
        </ButtonsContainer>
      </GroupAddForm>

      <AutoassignContainer data-testid='autoassign'>
        <h1 data-testid='autoassign-title'>Autoassign settings</h1>
        <AutoassignItem as='button' type='button' aria-pressed='true' active>
          <div aria-hidden='true' style={{ width: 24, height: 24 }} />
          <span data-testid='autoassign-mode-caption'>One by one</span>
        </AutoassignItem>
        <ForcedAssignSettingWrapper>
          <input id='fixture-forced-assignment' type='checkbox' defaultChecked />
          <label htmlFor='fixture-forced-assignment' data-testid='autoassign-forced-label'>Forced assignment</label>
        </ForcedAssignSettingWrapper>
        <MaxDistanceCustomerContainer>
          <div>
            <label htmlFor='fixture-max-distance' data-testid='autoassign-distance-label'>Max distance between customer and business</label>
            <p id='fixture-max-distance-hint' data-testid='autoassign-distance-hint'>Empty or 0 to disable</p>
          </div>
          <input id='fixture-max-distance' aria-describedby='fixture-max-distance-hint' defaultValue='1500' />
        </MaxDistanceCustomerContainer>
        <AutoassignCheckbox>
          <input id='fixture-autoaccept' type='checkbox' />
          <label htmlFor='fixture-autoaccept' data-testid='autoassign-checkbox-label'>Accepted by Driver</label>
        </AutoassignCheckbox>
        <FieldContainer as='fieldset'>
          <legend data-testid='autoassign-legend'>Auto reject Orders After</legend>
          <input aria-label='Hours' defaultValue='00' />
        </FieldContainer>
      </AutoassignContainer>

      <section data-testid='group-selection' aria-label='Group selection'>
        <GroupBusinessWrapper>
          <input id='fixture-group-business' type='checkbox' defaultChecked />
          <label htmlFor='fixture-group-business' data-testid='group-business-name'>North Operations Store</label>
        </GroupBusinessWrapper>
        <GroupCompanyWrapper>
          <input id='fixture-group-company' type='checkbox' defaultChecked />
          <label htmlFor='fixture-group-company' data-testid='group-company-name'>Long Fleet Company Name</label>
        </GroupCompanyWrapper>
        <DriverInfoContainer>
          <p data-testid='driver-name'>Alexandra Operations Driver</p>
          <p data-testid='driver-email'>driver@example.invalid</p>
        </DriverInfoContainer>
        <DriverTemporaryContainer>
          <button type='button' data-testid='driver-temporal'>Temporal driver</button>
        </DriverTemporaryContainer>
        <GroupGeneralInput>
          <label htmlFor='fixture-general-name'>Name</label>
          <input id='fixture-general-name' defaultValue='Weekend group' />
          <div className='select' data-testid='general-select-value'>Normal</div>
        </GroupGeneralInput>
        <ManagerInfoContainer>
          <p data-testid='manager-name'>Manager Name</p>
          <p data-testid='manager-email'>manager@example.invalid</p>
        </ManagerInfoContainer>
        <GeneralCheckbox>
          <input id='fixture-general-advanced' type='checkbox' />
          <label htmlFor='fixture-general-advanced' data-testid='general-checkbox-label'>Use advanced logistic</label>
        </GeneralCheckbox>
      </section>

      <section data-testid='delivery-zones' aria-label='Delivery zones'>
        <ZoneFormControl>
          <label htmlFor='fixture-zone-name' data-testid='zone-field-label'>Name</label>
          <input id='fixture-zone-name' defaultValue='Downtown polygon' />
        </ZoneFormControl>
        {/* the zone type is P/SelectField now; TypeSelectWrapper and its typography rule went with the legacy select */}
        {/* The structure of D/DriversGroupDeliveryZoneInformation today: WrapperMap (the slot) > MapStage > the Product button
            «Clear shape» and the map's div. The 44px rule used to be `WrapperMap > button`; it lives on MapStage and on the button. */}
        <WrapperMap data-testid='zone-map' style={{ background: '#dfe5eb' }}>
          <MapStage>
            <ProductButton data-testid='zone-map-clear'>Clear shape</ProductButton>
            <div />
          </MapStage>
        </WrapperMap>
        <ErrorText data-testid='zone-empty-copy'>Google Maps api key is required</ErrorText>
        <div data-testid='zone-table-scroll' style={{ overflow: 'auto' }}>
          <DeliveryZonesTable aria-label='Delivery zones'>
            <thead>
              <tr>
                <th scope='col'>Select</th>
                <th scope='col' data-testid='zone-column-header'>Name</th>
                <th scope='col'>Minimum</th>
                <th scope='col'>Price</th>
                <th scope='col'>Actions</th>
              </tr>
            </thead>
            <tbody>
              <ZoneRow active>
                <td><input aria-labelledby='fixture-zone-row-name' type='checkbox' defaultChecked /></td>
                <th scope='row'><ZoneOpenButton id='fixture-zone-row-name' type='button' data-testid='zone-open'>Downtown polygon</ZoneOpenButton></th>
                <td data-testid='zone-cell'>10</td>
                <td>3</td>
                <td className='arrow' data-testid='zone-arrow'>›</td>
              </ZoneRow>
            </tbody>
          </DeliveryZonesTable>
        </div>
        <AddDeliveryZoneButton type='button' data-testid='zone-add'>Add delivery zone</AddDeliveryZoneButton>
      </section>

      <section data-testid='group-details' aria-label='Group details'>
        <GroupDetailsHeader><div><h1 data-testid='details-title'>Downtown couriers</h1></div></GroupDetailsHeader>
        <MenusContainer role='tablist' aria-label='Driver group settings'>
          {['general', 'businesses', 'logs'].map(value => (
            <Tab key={value} type='button' role='tab' active={tab === value} aria-selected={tab === value} onClick={() => setTab(value)}>{value}</Tab>
          ))}
        </MenusContainer>
        <TabPanel role='tabpanel'>
          <ActionSelectorWrapper>
            <button type='button' aria-label='Actions'><svg data-testid='details-actions-glyph' viewBox='0 0 16 16' width='1em' height='1em' aria-hidden='true'><circle cx='3' cy='8' r='1.5' /><circle cx='8' cy='8' r='1.5' /><circle cx='13' cy='8' r='1.5' /></svg></button>
            <div><div><span className='dropdown-item' data-testid='details-menu-item'>Delete</span></div></div>
          </ActionSelectorWrapper>
          <LogisticsConfigsContainer>
            {['GROUP_ORDERS', 'AUTOASSIGN_SETTINGS'].map(value => (
              <LogisticsConfigItem
                key={value}
                as='button'
                type='button'
                active={config === value}
                aria-expanded={config === value}
                onClick={() => setConfig(value)}
              >
                <span data-testid={`config-label-${value}`}>{value}</span>
                <svg data-testid={`config-glyph-${value}`} viewBox='0 0 16 16' width='1em' height='1em' aria-hidden='true'><path d='M6 3l5 5-5 5' fill='none' stroke='currentColor' /></svg>
              </LogisticsConfigItem>
            ))}
          </LogisticsConfigsContainer>
        </TabPanel>
      </section>

      <section data-testid='group-logs' aria-label='Group logs'>
        <LogsTableWrapper data-testid='logs-table-scroll'>
          <LogsTable aria-label='Logs'>
            <thead><tr><th scope='col' data-testid='logs-column-header'>Users</th><th scope='col'>Events type</th><th scope='col'>New</th><th scope='col'>Date</th></tr></thead>
            <tbody>
              <tr>
                <td><UserInfoContainer><p data-testid='logs-user-name'>Operations Manager</p><p data-testid='logs-user-email'>manager@example.invalid</p></UserInfoContainer></td>
                <th scope='row'><EventTypeContainer data-testid='logs-event-type'><p>driver_group_updated</p></EventTypeContainer></th>
                <td data-testid='logs-cell'><SeeChanges type='button' data-testid='logs-see-changes'>See changes</SeeChanges></td>
                <td><DateTimeWrapper data-testid='logs-time'>2026-09-15 15:30:42</DateTimeWrapper></td>
              </tr>
            </tbody>
          </LogsTable>
        </LogsTableWrapper>
        <NoData data-testid='logs-empty'>No Data</NoData>
      </section>

      <GroupOrdersContainer data-testid='group-orders'>
        <h1 data-testid='orders-title'>Group orders</h1>
        <FieldWrapper>
          <label htmlFor='fixture-max-orders' data-testid='orders-field-label'>Maxiumum number of orders</label>
          <input id='fixture-max-orders' defaultValue='4' />
        </FieldWrapper>
        <FieldWrapper>
          <UseMapsApiCheckboxContainer>
            <input id='fixture-use-maps-api' type='checkbox' aria-describedby='fixture-use-maps-api-hint' />
            <MapsApiDescriptionContainer>
              <label htmlFor='fixture-use-maps-api' data-testid='orders-maps-label'>Use maps api</label>
              <p id='fixture-use-maps-api-hint' data-testid='orders-maps-hint'>Using this, generates extra charges on yout Google Maps usage.</p>
            </MapsApiDescriptionContainer>
          </UseMapsApiCheckboxContainer>
        </FieldWrapper>
      </GroupOrdersContainer>
    </main>
  )
}
