import React, { useMemo, useState } from 'react'
import { ThemeProvider, useTheme } from 'styled-components'

// redesign the Product wrappers of /profile read the --od-x-* candidates, which the app loads from src/index.js
import '../../../src/brand/candidates.css'
import profilePhoto from '../../../src/assets/images/avatars/courier.png'
import googleCalendarIcon from '../../../src/assets/images/google-calendar-icon.png'
import { InfoShareContext } from '../../../src/@/components-dashboard/src/ui/src/contexts/InfoShareContext'
import { ProfilePage } from '../../../src/@/components-dashboard/src/ui/src/components/Profile/ProfilePage'
import { Sessions } from '../../../src/@/components-dashboard/src/ui/src/components/Profile/Sessions'
import { ProfileSessionProvider, useProfileFixtureSession } from './profile-sessions-language'

const FixtureBody = ({ collapseCalls, isCollapse, view }) => {
  const [{ user }, { setFixtureUser }] = useProfileFixtureSession()
  return (
    // redesign data-od-theme scopes the dark --od-x-* candidates (e.g. the danger fill) the way the Pilot surfaces do
    <main data-testid='profile-sessions-fixture' data-ordering-brand data-od-theme={new URLSearchParams(window.location.search).get('mode') || 'light'} style={{ minWidth: 0, width: '100%' }}>
      <style>{'.profile-fixture-controls button { min-height: 44px; } #profile-fixture-user-output { overflow-wrap: anywhere; }'}</style>
      <div className='profile-fixture-controls' style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 12 }}>
        <button type='button' onClick={() => setFixtureUser(current => ({ ...current, session_strategy: current.session_strategy === 'jwt_session' ? 'jwt' : 'jwt_session' }))}>Toggle session strategy</button>
        <button type='button' onClick={() => setFixtureUser(current => ({ ...current, photo: current.photo ? null : profilePhoto }))}>Toggle profile photo</button>
        <button type='button' onClick={() => setFixtureUser(current => ({ ...current, cellphone: current.cellphone ? null : '+1 555 0100' }))}>Toggle cellphone</button>
        <button type='button' onClick={() => setFixtureUser(current => ({ ...current, level: current.level === 8 ? 0 : 8 }))}>Toggle professional level</button>
      </div>
      <output id='profile-fixture-user-output' data-testid='profile-user-state'>{JSON.stringify(user)}</output>
      <output data-testid='profile-collapse-state'>{String(isCollapse)}</output>
      <output data-testid='profile-collapse-calls'>{JSON.stringify(collapseCalls)}</output>
      {view === 'sessions' ? <Sessions /> : <ProfilePage />}
    </main>
  )
}

export const ProfileSessionsFixture = () => {
  const outerTheme = useTheme()
  const query = new URLSearchParams(window.location.search)
  const [isCollapse, setIsCollapse] = useState(query.get('collapsed') === '1')
  const [collapseCalls, setCollapseCalls] = useState([])
  const handleMenuCollapse = value => {
    setIsCollapse(value)
    setCollapseCalls(current => [...current, value])
  }
  const useSerifFont = query.get('font') === 'serif'
  const theme = useMemo(() => ({
    ...outerTheme,
    fonts: useSerifFont ? { ...outerTheme.fonts, primary: { ...outerTheme.fonts?.primary, family: 'Georgia, serif' } } : outerTheme.fonts,
    images: {
      ...outerTheme.images,
      general: { ...outerTheme.images?.general, googleCalendarIcon }
    }
  }), [outerTheme, useSerifFont])
  const initialUser = {
    id: 81,
    level: Number(query.get('level') ?? 8),
    name: 'Professional Profile With A Long Fixture Name',
    lastname: 'Example',
    email: 'professional@example.com',
    cellphone: query.get('cell') === '0' ? null : '+1 555 0100',
    photo: query.get('photo') === '1' ? profilePhoto : null,
    session_strategy: query.get('strategy') === 'old' ? 'jwt' : 'jwt_session'
  }
  return (
    <ThemeProvider theme={theme}>
      <InfoShareContext.Provider value={[{ isCollapse }, { handleMenuCollapse }]}>
        <ProfileSessionProvider initialUser={initialUser}>
          <FixtureBody collapseCalls={collapseCalls} isCollapse={isCollapse} view={query.get('view') || 'profile'} />
        </ProfileSessionProvider>
      </InfoShareContext.Provider>
    </ThemeProvider>
  )
}
