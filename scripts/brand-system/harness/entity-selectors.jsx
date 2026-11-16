import React, { useCallback, useState } from 'react'

import { CitySelector } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/CitySelector'
import { RecipientSelect } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/RecipientSelect'
import { SelectBusinesses } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/SelectBusinesses'
import { SelectLoyaltyLevels } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/SelectLoyaltyLevels'
import { SelectSites } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/SelectSites'
import { SelectUsers } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/SelectUsers'

const rawLogo = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0iIzI2NkRGMCIvPjwvc3ZnPg=='
const cities = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  name: index === 10 ? 'A city with an exceptionally long localized display name' : `Fixture City ${index + 1}`
}))
const businesses = [
  { id: 101, name: 'Blue Plate', logo: rawLogo },
  { id: 102, name: 'Fallback Kitchen' },
  { id: 103, name: 'A business with an exceptionally long localized display name' }
]
const loyaltyLevels = [
  { id: 201, name: 'Bronze' },
  { id: 202, name: 'Silver' },
  { id: 203, name: 'A loyalty level with an exceptionally long localized display name' }
]
const initialSites = [
  { id: 301, name: 'Ordering web' },
  { id: 302, name: 'Ordering mobile' }
]
const users = [
  { id: 401, name: 'Ada', lastname: 'Lovelace' },
  { id: 402, name: 'Grace', lastname: 'Hopper' },
  { id: 403, name: 'A user with an exceptionally long localized', lastname: 'display name' }
]

const Section = ({ children, label, testId }) => (
  <section aria-label={label} data-testid={testId} className='entity-fixture-section'>
    <h2>{label}</h2>
    {children}
  </section>
)
const Cell = ({ children, label, testId }) => (
  <fieldset data-testid={testId} className='entity-fixture-cell'>
    <legend>{label}</legend>
    {children}
  </fieldset>
)

const CityCases = () => {
  const [events, setEvents] = useState([])
  const [receipts, setReceipts] = useState({})
  const [cityIds, setCityIds] = useState([1])
  const recordController = useCallback(id => value => setReceipts(current => ({ ...current, [id]: value })), [])
  const handleChange = useCallback((source, updateSelection = false) => (...args) => {
    setEvents(current => [...current, { args, source }])
    if (updateSelection) {
      const id = args[0]
      setCityIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])
    }
  }, [])
  return (
    <Section label='City selector contracts' testId='city-cases'>
      <div className='entity-fixture-grid'>
        <Cell label='Default city' testId='city-default'>
          <CitySelector isDefault defaultValue={2} position='left' optionInnerMaxHeight='160px' fixtureCitiesList={{ cities, loading: false }} fixtureControllerId='city-default' onFixtureControllerCapture={recordController('city-default')} handleChangeCity={handleChange('default')} />
        </Cell>
        <Cell label='Multiple cities' testId='city-multi'>
          <CitySelector filterValues={{ cityIds }} fixtureCitiesList={{ cities, loading: false }} fixtureControllerId='city-multi' onFixtureControllerCapture={recordController('city-multi')} handleChangeCity={handleChange('multi', true)} />
        </Cell>
        <Cell label='Add-mode filtered city' testId='city-add-mode'>
          <CitySelector isAddMode filterValues={{ cityIds: [] }} fixtureCitiesList={{ cities: [{ id: 91, name: 'Unfiltered first city' }, { id: 92, name: 'Only matching city' }], loading: false }} fixtureControllerId='city-add' onFixtureControllerCapture={recordController('city-add')} handleChangeCity={handleChange('add')} />
        </Cell>
        <Cell label='Loading cities' testId='city-loading'>
          <CitySelector isDefault fixtureCitiesList={{ cities: [], loading: true }} fixtureControllerId='city-loading' onFixtureControllerCapture={recordController('city-loading')} handleChangeCity={handleChange('loading')} />
        </Cell>
      </div>
      <output data-testid='city-events'>{JSON.stringify(events)}</output>
      <output data-testid='city-controller-receipts'>{JSON.stringify(receipts)}</output>
    </Section>
  )
}

const RecipientCases = () => {
  const [events, setEvents] = useState([])
  const record = source => value => setEvents(current => [...current, { source, value }])
  return (
    <Section label='Recipient selector contracts' testId='recipient-cases'>
      <div className='entity-fixture-grid'>
        <Cell label='Inherited recipient' testId='recipient-inherit'><RecipientSelect showInherit onChange={record('inherit')} /></Cell>
        <Cell label='Value precedence' testId='recipient-value'><RecipientSelect value='platform' defaultValue='business' onChange={record('value')} /></Cell>
        <Cell label='Sponsor recipient' testId='recipient-sponsor'><RecipientSelect showInherit labelKey='FIXTURE_SPONSOR' labelFallback='Sponsor' defaultValue='business' onChange={record('sponsor')} /></Cell>
        <Cell label='Disabled recipient' testId='recipient-disabled'><RecipientSelect disabled defaultValue='platform' onChange={record('disabled')} /></Cell>
      </div>
      <output data-testid='recipient-events'>{JSON.stringify(events)}</output>
    </Section>
  )
}

const BusinessCases = () => {
  const [selected, setSelected] = useState([101])
  const [events, setEvents] = useState([])
  const record = (kind, ...args) => setEvents(current => [...current, { args, kind }])
  const select = (id, checked) => { record('select', id, checked); setSelected(current => checked ? [...new Set([...current, id])] : current.filter(value => value !== id)) }
  const common = {
    allBusinesses: businesses,
    handleAddClick: (...args) => record('add', ...args),
    handleSelectAllBusinesses: (...args) => record('all', ...args),
    handleSelectBusiness: select,
    handleSelectNoneBusinesses: (...args) => record('none', ...args),
    handleUpdateClick: (...args) => record('save', ...args),
    selectedBusinessIds: selected
  }
  return (
    <Section label='Business selector contracts' testId='business-cases'>
      <div className='entity-fixture-grid'>
        <Cell label='Local businesses' testId='business-local'><SelectBusinesses {...common} /></Cell>
        <Cell label='Server businesses' testId='business-server'>
          <SelectBusinesses {...common} isAddMode businessesPaginationProps={{ currentPage: 2, pageSize: 10, totalPages: 3 }} searchBusinesses={(...args) => record('server-search', ...args)} handleChangeBusinessPage={(...args) => record('business-page', ...args)} handleChangeBusinessPageSize={(...args) => record('business-page-size', ...args)} />
        </Cell>
        <Cell label='Loading businesses' testId='business-loading'><SelectBusinesses {...common} isSkeleton isDisabled /></Cell>
      </div>
      <output data-testid='business-events'>{JSON.stringify(events)}</output>
      <output data-testid='business-selected'>{JSON.stringify(selected)}</output>
    </Section>
  )
}

const LoyaltyCases = () => {
  const [selected, setSelected] = useState([201])
  const [events, setEvents] = useState([])
  const [receipts, setReceipts] = useState({})
  const record = (kind, ...args) => setEvents(current => [...current, { args, kind }])
  const select = (checked, id) => { record('level', checked, id); setSelected(current => checked ? [...new Set([...current, id])] : current.filter(value => value !== id)) }
  const capture = useCallback(id => value => setReceipts(current => ({ ...current, [id]: value })), [])
  return (
    <Section label='Loyalty selector contracts' testId='loyalty-cases'>
      <div className='entity-fixture-grid'>
        <Cell label='Loyalty levels' testId='loyalty-main'><SelectLoyaltyLevels fixtureLevelList={{ levels: loyaltyLevels, loading: false }} fixtureControllerId='loyalty-main' onFixtureControllerCapture={capture('loyalty-main')} selectedLoyaltyLevelIds={selected} handleSelectLoyaltyLevel={select} handleSelectAllLoyaltyLevels={(...args) => record('levels-all', ...args)} handleAddPromotion={(...args) => record('level-add', ...args)} handleUpdateClick={(...args) => record('level-save', ...args)} /></Cell>
        <Cell label='Loading loyalty levels' testId='loyalty-loading'><SelectLoyaltyLevels fixtureLevelList={{ levels: [], loading: true }} fixtureControllerId='loyalty-loading' onFixtureControllerCapture={capture('loyalty-loading')} selectedLoyaltyLevelIds={[]} handleSelectLoyaltyLevel={select} handleSelectAllLoyaltyLevels={(...args) => record('loading-all', ...args)} handleAddPromotion={(...args) => record('loading-add', ...args)} handleUpdateClick={(...args) => record('loading-save', ...args)} isAddMode isDisabled /></Cell>
      </div>
      <output data-testid='loyalty-events'>{JSON.stringify(events)}</output>
      <output data-testid='loyalty-controller-receipts'>{JSON.stringify(receipts)}</output>
    </Section>
  )
}

const SiteCases = () => {
  const [allSites, setAllSites] = useState(initialSites)
  const [selected, setSelected] = useState([301])
  const [events, setEvents] = useState([])
  const record = (kind, ...args) => setEvents(current => [...current, { args, kind }])
  const select = (checked, id) => { record('site', checked, id); setSelected(current => checked ? [...new Set([...current, id])] : current.filter(value => value !== id)) }
  const common = { allSites, selectedSitesIds: selected, handleSelectSite: select, handleSelectAllSites: (...args) => record('sites-all', ...args), handleSelectNoneSites: (...args) => record('sites-none', ...args), handleAddClick: (...args) => record('site-add', ...args), handleUpdateClick: (...args) => record('site-save', ...args) }
  return (
    <Section label='Site selector contracts' testId='site-cases'>
      <div className='entity-fixture-grid'>
        <Cell label='Sites' testId='sites-main'><SelectSites {...common} /></Cell>
        <Cell label='Add sites' testId='sites-add'><SelectSites {...common} isAddMode /></Cell>
      </div>
      <button data-fixture-control type='button' onClick={() => setAllSites(current => [...current, { id: 303, name: 'Newly supplied site' }])}>Supply another site</button>
      <output data-testid='site-events'>{JSON.stringify(events)}</output>
      <output data-testid='site-selected'>{JSON.stringify(selected)}</output>
    </Section>
  )
}

const UserCases = () => {
  const [selected, setSelected] = useState([401])
  const [search, setSearch] = useState('')
  const [events, setEvents] = useState([])
  const [receipts, setReceipts] = useState({})
  const record = (kind, ...args) => setEvents(current => [...current, { args, kind }])
  const capture = useCallback(id => value => setReceipts(current => ({ ...current, [id]: value })), [])
  const select = (checked, id) => { record('user', checked, id); setSelected(current => checked ? [...new Set([...current, id])] : current.filter(value => value !== id)) }
  const common = { usersList: { loading: false, users }, paginationProps: { currentPage: 2, from: 11, totalPages: 3 }, getUsers: (...args) => record('get-users', ...args), searchValue: search, onSearch: value => { record('user-search', value); setSearch(value) }, selectedUserIds: selected, handleSelectUser: select, handleSelectAllUsers: (...args) => record('users-all', ...args), handleAddPromotion: (...args) => record('user-add', ...args), handleUpdateClick: (...args) => record('user-save', ...args), fixtureControllerId: 'users-main', onFixtureControllerCapture: capture('users-main') }
  return (
    <Section label='User selector contracts' testId='user-cases'>
      <div className='entity-fixture-grid'>
        <Cell label='Users' testId='users-main'><SelectUsers {...common} /></Cell>
        <Cell label='All users' testId='users-all'><SelectUsers {...common} fixtureControllerId='users-all' onFixtureControllerCapture={capture('users-all')} selectedUserIds={[]} /></Cell>
        <Cell label='Loading users' testId='users-loading'><SelectUsers {...common} fixtureControllerId='users-loading' onFixtureControllerCapture={capture('users-loading')} usersList={{ loading: true, users: [] }} isDisabled /></Cell>
        <Cell label='Add users' testId='users-add'><SelectUsers {...common} fixtureControllerId='users-add' onFixtureControllerCapture={capture('users-add')} isAddMode /></Cell>
      </div>
      <output data-testid='user-events'>{JSON.stringify(events)}</output>
      <output data-testid='user-controller-receipts'>{JSON.stringify(receipts)}</output>
    </Section>
  )
}

export const EntitySelectorsFixture = () => (
  <main data-testid='entity-selectors-fixture' className='entity-selectors-fixture'>
    <style>{`
      .entity-selectors-fixture { box-sizing: border-box; display: grid; gap: 20px; min-width: 0; padding: 24px; width: 100%; }
      .entity-selectors-fixture * { box-sizing: border-box; }
      .entity-selectors-fixture > h1, .entity-fixture-section > h2 { margin: 0; }
      .entity-fixture-section { border: 1px solid currentColor; border-radius: 8px; display: grid; gap: 16px; min-width: 0; padding: 16px; }
      .entity-fixture-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 290px), 1fr)); min-width: 0; }
      .entity-fixture-cell { border: 1px dashed currentColor; min-width: 0; padding: 12px; }
      .entity-fixture-cell legend { font-size: 14px; padding-inline: 6px; }
      .entity-selectors-fixture output { display: block; max-width: 100%; min-width: 0; overflow-wrap: anywhere; word-break: break-word; }
      .entity-selectors-fixture [data-fixture-control] { min-height: 44px; max-width: 100%; white-space: normal; }
      @media (max-width: 420px) { .entity-selectors-fixture { gap: 12px; padding: 12px; } .entity-fixture-section { padding: 12px; } }
    `}</style>
    <h1>Ordering.co entity selector fixtures</h1>
    <CityCases />
    <RecipientCases />
    <BusinessCases />
    <LoyaltyCases />
    <SiteCases />
    <UserCases />
  </main>
)
