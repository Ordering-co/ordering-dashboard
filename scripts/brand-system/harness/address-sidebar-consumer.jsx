import React, { useEffect, useRef, useState } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'

import { AddressFieldsSetting } from '../../../src/@/components-dashboard/src/ui/src/components/Settings/AddressFieldsSetting'

const sites = [
  { id: 1, code: 'app_marketplace_x' },
  { id: 2, code: 'web_dashboard_x' }
]

const fields = [
  { id: 101, site_id: 1, validation_field_id: 201, required: true, enabled: true, validation_field: { code: 'address', name: 'Address' } },
  { id: 102, site_id: 1, validation_field_id: 202, required: false, enabled: true, validation_field: { code: 'address_note', name: 'Address note' } },
  { id: 103, site_id: 1, validation_field_id: 203, required: false, enabled: true, validation_field: { code: 'internal_number', name: 'Internal number' } },
  { id: 104, site_id: 1, validation_field_id: 204, required: true, enabled: false, validation_field: { code: 'zipcode', name: 'Zipcode' } }
]

const SyntheticAddressFieldsSetting = ({ UIComponent, onFieldChange, onSelectedSiteChange, ...props }) => {
  const [selectedSiteId, setSelectedSiteIdState] = useState(null)
  const setSelectedSiteId = value => {
    setSelectedSiteIdState(value)
    onSelectedSiteChange(value)
  }

  return (
    <UIComponent
      {...props}
      actionState={{ loading: false, error: null }}
      handleChangeFieldSetting={(fieldId, siteId, changes) => onFieldChange({ changes, fieldId, siteId })}
      selectedSiteId={selectedSiteId}
      setSelectedSiteId={setSelectedSiteId}
      sitesState={{ loading: false, sites }}
      validationFieldState={{ loading: false, fields }}
    />
  )
}

const LocationReceipt = () => {
  const location = useLocation()
  return <output data-testid='address-location'>{JSON.stringify({ pathname: location.pathname, search: location.search })}</output>
}

const AddressSidebarSurface = () => {
  const outerExclusionRef = useRef(null)
  const [fieldEvents, setFieldEvents] = useState([])
  const [moveDistance, setMoveDistance] = useState(0)
  const [selectedSiteId, setSelectedSiteId] = useState(null)

  globalThis.__OD_ADDRESS_FIELDS_CONTROLLER__ = SyntheticAddressFieldsSetting
  useEffect(() => () => {
    delete globalThis.__OD_ADDRESS_FIELDS_CONTROLLER__
  }, [])

  return (
    <main data-testid='address-sidebar-consumer' style={{ boxSizing: 'border-box', minWidth: 0, padding: 24, width: '100%' }}>
      <h1>Address fields sidebar consumer</h1>
      <div ref={outerExclusionRef} data-testid='address-outer-exclusion'>
        <button type='button'>Protected outer target</button>
      </div>
      <AddressFieldsSetting
        avoidExpand
        onFieldChange={event => setFieldEvents(current => [...current, event])}
        onSelectedSiteChange={setSelectedSiteId}
        setMoveDistance={setMoveDistance}
        sidebarSettingContainer={outerExclusionRef}
      />
      <button type='button'>Genuine outside target</button>
      <LocationReceipt />
      <output data-testid='address-sidebar-state' style={{ display: 'block', overflowWrap: 'anywhere' }}>
        {JSON.stringify({ fieldEvents, moveDistance, selectedSiteId })}
      </output>
    </main>
  )
}

export const AddressSidebarConsumerFixture = () => (
  <MemoryRouter initialEntries={[`${window.location.pathname}?category=user_information`]}>
    <AddressSidebarSurface />
  </MemoryRouter>
)
