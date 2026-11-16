import React, { useEffect, useMemo, useState } from 'react'
import { EnterprisePromotionDetails } from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/EnterprisePromotionDetails'
import { ZoneDropdownDetails } from '../../../src/@/components-dashboard/src/ui/src/components/Settings/ZoneDropdownDetails'
import storeLogo from '../../../src/assets/images/dummies/store.png'

const cities = [{ id: 101, name: 'Northport', country_id: 1 }, { id: 102, name: 'Southport', country_id: 1 }]
const businesses = [{ id: 201, name: 'North store', logo: storeLogo }, { id: 202, name: 'South store', logo: null }]
const users = [{ id: 301, name: 'Avery', lastname: 'North' }, { id: 302, name: 'Sam', lastname: 'South' }]
const levels = [{ id: 401, name: 'Silver' }, { id: 402, name: 'Gold' }]
const sites = [{ id: 501, name: 'Web' }, { id: 502, name: 'Mobile' }]
const countries = [{ id: 1, name: 'Fixture country' }]

const CityList = ({ UIComponent, ...props }) => {
  const citiesList = useMemo(() => ({ cities: props.cities || cities, loading: false }), [props.cities])
  return <UIComponent {...props} citiesList={citiesList} />
}
const levelList = { levels, loading: false }
const PointsWalletLevels = ({ UIComponent, ...props }) => <UIComponent {...props} levelList={levelList} />
const UsersList = ({ UIComponent, ...props }) => {
  const { userSearch, searchUsers, pageUsers } = globalThis.__OD_ENTITY_CONSUMER_DATA__
  return <UIComponent {...props} usersList={{ users, loading: false }} paginationProps={{ currentPage: 1, totalPages: 2, from: 1, to: 2, total: 12 }} searchValue={userSearch} onSearch={searchUsers} getUsers={pageUsers} />
}
const selectId = (values, id, checked) => checked ? [...new Set([...values, id])] : values.filter(value => value !== id)

export const EntityConsumersFixture = () => {
  const [events, setEvents] = useState([])
  const [selectedSites, setSelectedSites] = useState([501])
  const [selectedBusinesses, setSelectedBusinesses] = useState([201])
  const [selectedUsers, setSelectedUsers] = useState([301])
  const [selectedLevels, setSelectedLevels] = useState([401])
  const [userSearch, setUserSearch] = useState('')
  const [changes, setChanges] = useState({ name: 'Fixture promotion' })
  const [zoneChanges, setZoneChanges] = useState({})
  const record = (name, ...args) => setEvents(current => [...current, [name, ...args]])
  globalThis.__OD_ENTITY_CONSUMER_CONTROLLERS__ = { CityList, PointsWalletLevels, UsersList }
  globalThis.__OD_ENTITY_CONSUMER_DATA__ = {
    userSearch,
    searchUsers: value => { setUserSearch(value); record('user-search', value) },
    pageUsers: (...args) => record('user-page', ...args)
  }
  globalThis.__OD_ENTITY_PROMOTION__ = {
    isAddMode: false,
    promotionState: { loading: false, promotion: { id: 701, name: 'Fixture promotion', enabled: true, rate_type: 1, rate: 10, condition_type: 1, type: 1, sponsor: 'business', auto: false, public: true } },
    formState: { changes },
    actionState: { loading: false, error: null },
    sitesState: { sites },
    businessesList: { businesses, loading: false },
    businessesPaginationProps: { currentPage: 1, totalPages: 2, from: 1, to: 2, total: 12 },
    selectedSitesIds: selectedSites,
    selectedBusinessIds: selectedBusinesses,
    selectedUserIds: selectedUsers,
    selectedLoyaltyLevelIds: selectedLevels,
    handleSelectSite: (checked, id) => { record('site', checked, id); setSelectedSites(values => selectId(values, id, checked)) },
    handleSelectBusiness: (id, checked) => { record('business', id, checked); setSelectedBusinesses(values => selectId(values, id, checked)) },
    handleSelectUser: (checked, id) => { record('user', checked, id); setSelectedUsers(values => selectId(values, id, checked)) },
    handleSelectLoyaltyLevel: (checked, id) => { record('level', checked, id); setSelectedLevels(values => selectId(values, id, checked)) },
    handleSelectAllSites: value => { record('all-sites', value); setSelectedSites(value ? sites.map(item => item.id) : []) },
    handleSelectAllBusiness: value => { record('all-businesses', value); setSelectedBusinesses(value ? businesses.map(item => item.id) : []) },
    handleSelectAllUsers: (...args) => { record('all-users', ...args); setSelectedUsers([]) },
    handleSelectAllLoyaltyLevels: ids => { record('all-levels', ids); setSelectedLevels(ids) },
    handleChangeItem: value => { record('change-item', value); setChanges(previous => ({ ...previous, ...value })) },
    handleChangeInput: event => setChanges(previous => ({ ...previous, [event.target.name]: event.target.value })),
    searchBusinesses: value => record('business-search', value),
    handleChangeBusinessPage: (...args) => record('business-page', ...args),
    handleChangeBusinessPageSize: (...args) => record('business-size', ...args),
    setMoveDistance: value => record('move', value),
    setSideBarWidth: value => record('sidebar-width', value),
    handleUpdateClick: () => record('save'),
    handleAddPromotion: () => record('add'),
    handleDeletePromotion: () => record('delete')
  }
  useEffect(() => () => {
    delete globalThis.__OD_ENTITY_CONSUMER_CONTROLLERS__
    delete globalThis.__OD_ENTITY_CONSUMER_DATA__
    delete globalThis.__OD_ENTITY_PROMOTION__
  }, [])
  return (
    <main style={{ padding: 16, maxWidth: '100%', display: 'grid', gap: 24 }}>
      <section data-testid='zone-consumer' style={{ maxWidth: 600 }}>
        <ZoneDropdownDetails zoneDropdown={{ id: 801, name: 'Fixture zone', enabled: true, city_id: '101', city: { country_id: '1' } }} cities={cities} countries={countries} changesState={zoneChanges} handleChangesState={(field, value) => { record('zone-change', field, value); setZoneChanges(previous => ({ ...previous, [field]: value })) }} handleSaveZone={() => record('zone-save', zoneChanges)} handleAddZone={() => record('zone-add')} />
      </section>
      <section data-testid='promotion-consumer' style={{ width: 'min(100%, 720px)' }}><EnterprisePromotionDetails /></section>
      <output data-testid='entity-consumer-events' style={{ overflowWrap: 'anywhere' }}>{JSON.stringify(events)}</output>
    </main>
  )
}
