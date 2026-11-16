import React, { useMemo } from 'react'
// redesign W1-6 (T1-6-4): the P/ Tabs and SegmentedControl read the --od-x-* candidates (the app loads them in src/index.js)
import '../../../src/brand/candidates.css'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider, useTheme } from 'styled-components'

import noDriver from '../../../src/assets/images/avatars/noDriver.png'
import businessLogo from '../../../src/assets/images/dummies/store.png'
import { MessagesListing } from '../../../src/@/components-dashboard/src/ui/src/components/Messages/MessagesListing'
import { ChatContactList } from '../../../src/@/components-dashboard/src/ui/src/components/Messages/ChatContactList'
import { ConfigFileContext } from '../../../src/@/components-dashboard/src/ui/src/contexts/ConfigFileContext'
import { ChatBusinessesList } from '../../../src/@/components-dashboard/src/ui/src/components/Messages/ChatBusinessesList'

export const MessagesShellFixture = () => {
  const outerTheme = useTheme()
  const query = new URLSearchParams(window.location.search)
  const view = query.get('view') || 'listing'
  const theme = useMemo(() => ({
    ...outerTheme,
    images: {
      ...outerTheme.images,
      icons: { ...outerTheme.images?.icons, noDriver },
      dummies: { ...outerTheme.images?.dummies, businessLogo }
    }
  }), [outerTheme])
  const route = `/messages${query.get('id') ? `?id=${query.get('id')}` : ''}`
  return (
    <ThemeProvider theme={theme}>
      {/* redesign messages FASE 3 (decision 2A): the list rows and the conversation header read the app's config file (status prefix) */}
      <ConfigFileContext.Provider value={[{}]}>
      <MemoryRouter initialEntries={[route]}>
        <main data-testid='messages-shell-fixture' style={{ background: theme.ordering?.semantic?.background, color: theme.ordering?.semantic?.text?.default, height: 760, minWidth: 0, width: '100%' }}>
          <div data-testid='messages-shell-view'>{view}</div>
          {view === 'listing' && <MessagesListing isUseQuery />}
          {view === 'contacts' && <ChatContactList {...(query.get('contact') === 'customer' ? { isCustomer: true } : { isDriver: true })} />}
          {view === 'businesses' && <ChatBusinessesList />}
        </main>
      </MemoryRouter>
      </ConfigFileContext.Provider>
    </ThemeProvider>
  )
}
