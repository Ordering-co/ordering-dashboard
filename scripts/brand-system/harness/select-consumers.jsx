import React, { useCallback, useMemo, useState } from 'react'
import { RecipientSelect } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/RecipientSelect'
import { UserTypeSelector } from '../../../src/@/components-dashboard/src/ui/src/components/Users/UserTypeSelector'
import { DriverSelector } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/DriverSelector'
import { CompanySelector } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CompanySelector'
import { OccupationSelector } from '../../../src/@/components-dashboard/src/ui/src/components/Users/OccupationSelector'
import { SettingsSelectUI } from '../../../src/@/components-dashboard/src/ui/src/components/Settings/SettingsSelectUI'
import driverPhoto from '../../../src/assets/images/avatars/noDriver.png'
// (O-7): the open lists need the --od-x-layer-* roles; loaded when the surface mounts (layer-roles.jsx)
import { withLayerRoles } from './layer-roles'

const singleDrivers = {
  loading: false,
  drivers: [
    { id: 21, name: 'Ada', lastname: 'Fixture', photo: driverPhoto, enabled: true, available: true, busy: false, assigned_orders_count: 0 },
    { id: 22, name: 'Ben', lastname: 'Fixture', photo: driverPhoto, enabled: true, available: true, busy: true, assigned_orders_count: 2 }
  ]
}
const companies = {
  loading: false,
  companys: [
    { id: 31, name: 'Orbit Delivery', logo: driverPhoto, busy: false },
    { id: 32, name: 'Harbor Delivery', logo: driverPhoto, busy: false }
  ]
}
const order = { id: 9700 }
const customizableConfig = {
  key: 'fixture_code_language',
  name: 'Customizable setting',
  customizable: true,
  options: [{ value: 'javascript', text: 'javascript' }, { value: 'html', text: 'html' }]
}

const SelectConsumersFixtureBody = () => {
  const firstSelect = new URLSearchParams(window.location.search).get('firstSelect') === 'true'
  const [recipient, setRecipient] = useState(null)
  const [primaryType, setPrimaryType] = useState(3)
  const [typeEvent, setTypeEvent] = useState(null)
  const [driverAssignment, setDriverAssignment] = useState(null)
  const [companyAssignment, setCompanyAssignment] = useState(null)
  const [occupationId, setOccupationId] = useState(null)
  const [occupationCreation, setOccupationCreation] = useState(null)
  const [occupations, setOccupations] = useState([{ id: 91, name: 'Manager' }, { id: 92, name: 'Support' }])
  const [searchConsumerCounts, setSearchConsumerCounts] = useState({ driver: 0, company: 0, occupation: 0, create: 0 })
  const count = key => setSearchConsumerCounts(current => ({ ...current, [key]: current[key] + 1 }))
  const [customConfigValue, setCustomConfigValue] = useState('javascript')
  const [customConfigCalls, setCustomConfigCalls] = useState(0)
  const customConfig = useMemo(() => ({ ...customizableConfig, value: customConfigValue }), [customConfigValue])
  const handleCustomConfig = useCallback(value => {
    setCustomConfigValue(value)
    setCustomConfigCalls(current => current + 1)
  }, [])
  return (
    <main style={{ padding: 24, maxWidth: 700, display: 'grid', gap: 24, minWidth: 0 }}>
      <h1>Selector consumer fixtures</h1>
      <div data-testid='recipient-consumer'>
        <RecipientSelect showInherit value={recipient} onChange={setRecipient} />
      </div>
      <div data-testid='recipient-disabled-consumer'>
        <RecipientSelect disabled defaultValue='business' onChange={() => setRecipient('unexpected-disabled-event')} />
      </div>
      <div data-testid='primary-type-consumer'>
        <UserTypeSelector isPrimary defaultUserType={primaryType} handleChangeUserType={setPrimaryType} />
      </div>
      <div data-testid='user-type-consumer'>
        <UserTypeSelector userId={901} defaultUserType={3} handleChangeUserType={setTypeEvent} />
      </div>
      <div data-testid='driver-single-consumer'>
        <DriverSelector isFirstSelect={firstSelect} driversList={singleDrivers} order={order} defaultValue={driverAssignment?.driverId ?? 'default'} handleAssignDriver={value => { count('driver'); setDriverAssignment(value) }} />
      </div>
      <div data-testid='company-single-consumer'>
        <CompanySelector isFirstSelect={firstSelect} companysList={companies} order={order} defaultValue={companyAssignment?.companyId ?? 'default'} handleAssignDriverCompany={value => { count('company'); setCompanyAssignment(value) }} />
      </div>
      <div data-testid='occupation-consumer'>
        <OccupationSelector
          occupationId={occupationId}
          occupations={occupations}
          actionState={{ loading: false }}
          handleChangeOccupation={value => { count('occupation'); setOccupationId(value) }}
          handleAddOccupation={value => {
            count('create')
            setOccupationCreation(value)
            setOccupations(current => [...current, { id: 94, ...value }])
            setOccupationId(94)
          }}
        />
      </div>
      <div data-testid='custom-setting-consumer'>
        <SettingsSelectUI config={customConfig} handleSelectChange={handleCustomConfig} />
      </div>
      <output data-testid='select-consumer-events' style={{ overflowWrap: 'anywhere' }}>{JSON.stringify({ recipient, primaryType, typeEvent, driverAssignment, companyAssignment, occupationId, occupationCreation, searchConsumerCounts, customConfigValue, customConfigCalls })}</output>
    </main>
  )
}

export const SelectConsumersFixture = withLayerRoles(SelectConsumersFixtureBody)
