import React, { useState } from 'react'
// Batch 5.1: the redesigned sidebar reads the --od-x-* candidates (the app loads them in src/index.js).
import '../../../src/brand/candidates.css'
import { MemoryRouter } from 'react-router-dom'
import { useTheme } from 'styled-components'

import { InfoShareContext } from '../../../src/@/components-dashboard/src/ui/src/contexts/InfoShareContext'
import { ProjectContext } from '../../../src/@/components-dashboard/src/ui/src/contexts/ProjectContext'
import { Layout } from '../../../src/@/components-dashboard/src/ui/src/components/Layout'
import { LanguageSelector } from '../../../src/@/components-dashboard/src/ui/src/components/LanguageSelector'
import { LogoutButton } from '../../../src/@/components-dashboard/src/ui/src/components/LogoutButton'
import { SidebarMenu } from '../../../src/@/components-dashboard/src/ui/src/components/SidebarMenu'

const fixtureLanguages = [
  { code: 'en', name: 'English', default: true },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' }
]

const StandaloneControls = () => {
  const [languageCalls, setLanguageCalls] = useState([])
  const [logoutCalls, setLogoutCalls] = useState(0)
  return (
    <main className='shell-control-fixture' data-testid='shell-control-fixture'>
      <style>{`
        .shell-control-fixture { box-sizing: border-box; display: grid; gap: 20px; min-width: 0; padding: 24px; width: 100%; }
        .shell-control-fixture section { border: 1px solid currentColor; border-radius: 8px; display: grid; gap: 12px; min-width: 0; padding: 16px; }
        .shell-control-fixture h1, .shell-control-fixture h2 { margin: 0; }
        @media (max-width: 420px) { .shell-control-fixture { gap: 12px; padding: 12px; } .shell-control-fixture section { padding: 12px; } }
      `}</style>
      <h1>Ordering.co shell controls</h1>
      <section aria-label='Multiple languages' data-testid='languages-many'>
        <h2>Multiple languages</h2>
        <LanguageSelector languages={fixtureLanguages} currentLanguage='en' onChangeLanguage={(...args) => setLanguageCalls(current => [...current, args])} />
      </section>
      <section aria-label='One language' data-testid='languages-one'>
        <h2>One language</h2>
        <LanguageSelector languages={[fixtureLanguages[1]]} currentLanguage='es' />
      </section>
      <section aria-label='No languages' data-testid='languages-zero'>
        <h2>No languages</h2>
        <LanguageSelector languages={[]} />
      </section>
      <section aria-label='Logout control' data-testid='logout-control'>
        <h2>Logout control</h2>
        <LogoutButton handleSuccessLogout={() => setLogoutCalls(current => current + 1)} />
      </section>
      <output data-testid='language-calls'>{JSON.stringify(languageCalls)}</output>
      <output data-testid='logout-calls'>{logoutCalls}</output>
    </main>
  )
}

export const ShellNavigationFixture = () => {
  const query = new URLSearchParams(window.location.search)
  const theme = useTheme()
  const [isCollapse, setIsCollapse] = useState(false)
  const [collapseCalls, setCollapseCalls] = useState([])
  const handleMenuCollapse = value => {
    setIsCollapse(value)
    setCollapseCalls(current => [...current, value])
  }
  if (query.get('case') === 'controls') return <StandaloneControls />
  const path = query.get('path') || '/orders'
  return (
    <MemoryRouter initialEntries={[path]}>
      <InfoShareContext.Provider value={[{ isCollapse }, { handleMenuCollapse }]}>
        <ProjectContext.Provider value={[{ loading: false, project: { id: 18 }, plan: { upgrade_plan_id: 44 } }, { getProjectStatus: () => {} }]}>
          <main
            className='shell-navigation-fixture'
            data-testid='shell-navigation-fixture'
            style={{ background: theme.ordering?.semantic?.background, color: theme.ordering?.semantic?.text?.default }}
          >
            <style>{`
              .shell-navigation-fixture { box-sizing: border-box; min-height: 100vh; min-width: 0; width: 100%; }
              .shell-navigation-fixture * { box-sizing: border-box; }
              .shell-navigation-content { min-width: 0; padding: 24px; }
              .shell-navigation-content button { min-height: 44px; }
              .shell-navigation-fixture output { display: block; max-width: 100%; overflow-wrap: anywhere; }
              @media (max-width: 420px) { .shell-navigation-content { padding: 12px; } }
            `}</style>
            <Layout pt={Number(query.get('pt') ?? 6)}>
              <SidebarMenu billingUrl='/__brand-fixture__/billing-disabled' setShowBillingPayment={() => {}} />
              <section className='shell-navigation-content' aria-label='Shell content'>
                <h1>Shell navigation fixture</h1>
                <button type='button' onClick={() => handleMenuCollapse(false)}>Open navigation</button>
                <output data-testid='shell-collapse-state'>{String(isCollapse)}</output>
                <output data-testid='shell-collapse-calls'>{JSON.stringify(collapseCalls)}</output>
                <output data-testid='shell-events'>{JSON.stringify(globalThis.__OD_SHELL_EVENTS__ || [])}</output>
              </section>
            </Layout>
          </main>
        </ProjectContext.Provider>
      </InfoShareContext.Provider>
    </MemoryRouter>
  )
}
