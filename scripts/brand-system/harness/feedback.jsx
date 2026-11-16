import React, { useState } from 'react'
import { useTheme } from 'styled-components'

import { NotFoundSource } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/NotFoundSource'
import { ProgressRing } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/ProgressRing'
import { SimpleSpinner } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/SimpleSpinner'
import { SpinnerLoader } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/SpinnerLoader'
import { Toast } from '../../../src/@/components-dashboard/src/ui/src/styles/Toast'
import { Banners } from '../../../src/@/components-dashboard/src/ui/src/components/Banners'
import { WebsocketConnectionBanner } from '../../../src/@/components-dashboard/src/ui/src/components/WebsocketConnectionBanner'
import { DisabledFeatureAlert } from '../../../src/@/components-dashboard/src/ui/src/components/DisabledFeatureAlert'
import { NotNetworkConnectivity } from '../../../src/@/components-dashboard/src/ui/src/components/NotNetworkConnectivity'
import { PageNotFound } from '../../../src/@/components-dashboard/src/ui/src/components/PageNotFound'
import { FeedbackFixtureProvider, ToastType, useEvent, useToast } from './feedback-language'
// redesign NF: the 404 is on Product, which reads the --od-x-* candidates (as profile-sessions.jsx)
import '../../../src/brand/candidates.css'

const query = new URLSearchParams(window.location.search)
const mountCount = Number(window.sessionStorage.getItem('feedback-fixture-mounts') || 0) + 1
window.sessionStorage.setItem('feedback-fixture-mounts', String(mountCount))

const Section = ({ children, label, testId }) => (
  <section aria-label={label} data-testid={testId} className='feedback-fixture-section'>
    <h2>{label}</h2>
    {children}
  </section>
)

const NotFoundCases = () => {
  const [events, setEvents] = useState([])
  return (
    <Section label='Legacy empty-state contracts' testId='not-found-cases'>
      <div data-testid='not-found-action'>
        <NotFoundSource
          content='No matching orders'
          btnTitle='Clear filters'
          onClickButton={(...args) => setEvents(current => [...current, args])}
        >
          <span data-testid='callback-losing-child'>This child must not replace the callback action</span>
        </NotFoundSource>
      </div>
      <div data-testid='not-found-child'>
        <NotFoundSource content='No exports yet'><a href='#create-export'>Create an export</a></NotFoundSource>
      </div>
      <div data-testid='not-found-empty'><NotFoundSource /></div>
      <output data-testid='not-found-events'>{JSON.stringify(events)}</output>
    </Section>
  )
}

const ProgressCases = () => (
  <Section label='Legacy progress and loading contracts' testId='progress-cases'>
    <div className='feedback-progress-grid'>
      <div data-testid='progress-direct'><h3>Direct percentage</h3><ProgressRing percent={37.6} size={120} lineWidth={12} progressColor='#123456' trackColor='#ABCDEF' caps='round' isShowPercent spin transitionDuration={450} percentColor='#654321' fontSize='18px' /></div>
      <div data-testid='progress-below'><h3>Below range</h3><ProgressRing percent={-25} size={80} lineWidth={8} progressColor='#2456A4' trackColor='#D4DAE4' isShowPercent /></div>
      <div data-testid='progress-above'><h3>Above range</h3><ProgressRing percent={150} size={80} lineWidth={8} progressColor='#2456A4' trackColor='#D4DAE4' isShowPercent /></div>
      <div data-testid='progress-numeric'><h3>Numeric font size</h3><ProgressRing percent={25} size={80} lineWidth={8} progressColor='#2456A4' trackColor='#D4DAE4' isShowPercent fontSize={18} /></div>
      <div><h3>Default spinner</h3><SimpleSpinner data-testid='simple-spinner-default' /></div>
      <div data-testid='simple-spinner-case'><h3>Simple spinner</h3><SimpleSpinner data-testid='simple-spinner' width='36px' height='28px' btc='rgb(18, 52, 86)' style={{ marginInlineStart: '7px' }} /></div>
    </div>
    <div className='feedback-loader-grid'>
      <div data-testid='spinner-normal'><SpinnerLoader content='Preparing report' /></div>
      <div data-testid='spinner-logo'><SpinnerLoader logotype={useTheme().images?.general?.logotype} content='Loading workspace' /></div>
      <div data-testid='spinner-compact'><SpinnerLoader style={{ width: 170, height: 90, transform: 'scale(0.3)', transformOrigin: 'top left' }} /></div>
      <div data-testid='spinner-falsy'><SpinnerLoader content={0} logotype='' /></div>
    </div>
  </Section>
)

const ToastCases = () => {
  const [mounted, setMounted] = useState(true)
  const [toastConfig, { hideToast, showToast }] = useToast()
  const longMessage = 'A very long notification explains what happened, preserves every word, and remains readable without escaping the viewport in either text direction.'
  return (
    <Section label='Semantic notification states' testId='toast-cases'>
      {mounted && <Toast />}
      <div className='feedback-controls'>
        <button data-fixture-control type='button' onClick={() => showToast(ToastType.Info, 'Information saved')}>Show info</button>
        <button data-fixture-control type='button' onClick={() => showToast(ToastType.Error, 'Unable to save')}>Show error</button>
        <button data-fixture-control type='button' onClick={() => showToast(ToastType.Success, 'Changes saved')}>Show success</button>
        <button data-fixture-control type='button' onClick={() => showToast('UNKNOWN', 'Unknown notification')}>Show unknown</button>
        <button data-fixture-control type='button' onClick={() => showToast(ToastType.Info, ['Array ', '<strong>content</strong>'], 3000)}>Show array HTML</button>
        <button data-fixture-control type='button' onClick={() => showToast(ToastType.Success, 'Saved with <strong>verified details</strong>', 3000)}>Show supported HTML</button>
        <button data-fixture-control type='button' onClick={() => { showToast(ToastType.Info, 'First notification', 60000); showToast(ToastType.Error, 'Replacement notification', 60000) }}>Replace rapidly</button>
        <button data-fixture-control type='button' onClick={() => showToast(ToastType.Info, longMessage, 60000)}>Show long notification</button>
        <button data-fixture-control type='button' onClick={() => showToast(ToastType.Success, 'Short notification', 120)}>Show short notification</button>
        <button data-fixture-control type='button' onClick={hideToast}>Hide notification</button>
        <button data-fixture-control type='button' onClick={() => setMounted(value => !value)}>Toggle notification mount</button>
      </div>
      <output data-testid='toast-state'>{JSON.stringify({ mounted, toastConfig })}</output>
    </Section>
  )
}

const BannerCases = () => {
  const [billing, setBilling] = useState({ open: false, from: 'fixture', retained: 'yes' })
  const [events] = useEvent()
  return (
    <Section label='Semantic feedback banners' testId='banner-cases'>
      <div data-testid='past-due-banner'><Banners setShowBillingPayment={setBilling} /></div>
      <output data-testid='billing-state'>{JSON.stringify(billing)}</output>
      <div className='feedback-controls'>
        <button data-fixture-control type='button' onClick={() => events.emit('websocket_connection_failed')}>Emit connection failed</button>
        <button data-fixture-control type='button' onClick={() => events.emit('websocket_connection_restored')}>Emit connection restored</button>
      </div>
      <div data-testid='websocket-banner'><WebsocketConnectionBanner /></div>
      <div data-testid='disabled-feature'><DisabledFeatureAlert /></div>
    </Section>
  )
}

const IllustrationCases = () => (
  <Section label='Semantic illustrated states' testId='illustration-cases'>
    <div data-testid='network-state'><NotNetworkConnectivity /></div>
    <div data-testid='page-not-found'><PageNotFound /></div>
  </Section>
)

const FeedbackContents = () => {
  if (query.get('view') === 'primary-loader') {
    return <main data-testid='primary-loader-case'><span data-testid='feedback-mount-count'>{mountCount}</span><SpinnerLoader primary content='Loading dashboard' logotype={useTheme().images?.general?.logotype} /></main>
  }
  return (
    <main data-testid='feedback-fixture' className='feedback-fixture'>
      <style>{`
        .feedback-fixture { box-sizing: border-box; display: grid; gap: 20px; min-width: 0; padding: 24px; width: 100%; }
        .feedback-fixture * { box-sizing: border-box; }
        .feedback-fixture > h1, .feedback-fixture-section > h2, .feedback-fixture h3 { margin: 0; }
        .feedback-fixture-section { border: 1px solid currentColor; border-radius: 8px; display: grid; gap: 16px; min-width: 0; padding: 16px; position: relative; }
        .feedback-progress-grid, .feedback-loader-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); min-width: 0; }
        .feedback-progress-grid > div, .feedback-loader-grid > div { min-width: 0; }
        .feedback-controls { display: flex; flex-wrap: wrap; gap: 8px; min-width: 0; }
        .feedback-fixture [data-fixture-control] { min-height: 44px; max-width: 100%; overflow-wrap: anywhere; white-space: normal; }
        .feedback-fixture output { display: block; max-width: 100%; min-width: 0; overflow-wrap: anywhere; word-break: break-word; }
        @media (max-width: 420px) { .feedback-fixture { gap: 12px; padding: 12px; } .feedback-fixture-section { padding: 12px; } }
      `}</style>
      <h1>Ordering.co feedback and loading fixtures</h1>
      <span data-testid='feedback-mount-count'>{mountCount}</span>
      <NotFoundCases />
      <ProgressCases />
      <ToastCases />
      <BannerCases />
      <IllustrationCases />
    </main>
  )
}

export const FeedbackFixture = () => <FeedbackFixtureProvider><FeedbackContents /></FeedbackFixtureProvider>
