import React, { useEffect, useMemo, useState } from 'react'
import { useTheme } from 'styled-components'
import tenantLogo from '../../../src/assets/images/ordering-lockup-color.svg'
import { publicAssetUrl } from '../../../src/utils/publicAssetUrl'

import { HelmetTags } from '../../../src/components/HelmetTags'
import { orderingAssets } from '../../../src/brand/assets'
import { createDashboardLogoDefaults, getDashboardThemeLogo } from '../../../src/brand/identity'
import {
  getDashboardFaviconUrl,
  getDashboardLogoUrl,
  getDashboardNotificationIconUrl,
  isOfficialOrderingDashboardHost
} from '../../../src/utils/dashboardBranding'

const officialHost = 'dashboard.ordering.co'
const customHost = 'tenant.example.com'
const tenantFavicon = '/brand/ordering/1.3.0/assets/icons/ordering-app-icon-192.png'
const iconRels = ['icon', 'shortcut-icon', 'apple-touch-icon', 'android-touch-icon', 'windows-touch-icon']

const readHeadIcons = () => iconRels.map(rel => {
  const link = document.head.querySelector(`link[rel="${rel}"]`)
  return {
    rel,
    href: link?.getAttribute('href'),
    sizes: link?.getAttribute('sizes'),
    type: link?.getAttribute('type'),
    ordering: link?.dataset.orderingIcon
  }
})

const Asset = ({ alt, className, label, src }) => (
  <figure className={className}>
    <div className='identity-asset-field'><img alt={alt} src={publicAssetUrl(src)} /></div>
    <figcaption>{label}</figcaption>
  </figure>
)

export const IdentityFixture = () => {
  const outerTheme = useTheme()
  const query = new URLSearchParams(window.location.search)
  const defaults = useMemo(() => createDashboardLogoDefaults(), [])
  const [mode, setMode] = useState(query.get('mode') || 'light')
  const [hostname, setHostname] = useState(officialHost)
  const [configs, setConfigs] = useState({})
  const [headIcons, setHeadIcons] = useState([])
  const [syncRevision, setSyncRevision] = useState(0)
  const [poweredDisabled, setPoweredDisabled] = useState(false)
  const identityTheme = useMemo(() => ({
    ...outerTheme,
    ordering: { ...outerTheme.ordering, mode },
    images: { ...outerTheme.images, logos: defaults }
  }), [defaults, mode, outerTheme])
  const themeLogo = getDashboardThemeLogo(identityTheme)
  const resolved = {
    favicon: getDashboardFaviconUrl(configs, hostname),
    logo: getDashboardLogoUrl(configs, themeLogo, hostname),
    notification: getDashboardNotificationIconUrl(configs, defaults.isotype, hostname)
  }

  useEffect(() => {
    // main dropped the client-side icon sync; App.js sets the favicon itself.
    setHeadIcons(readHeadIcons())
  }, [configs, hostname, syncRevision])

  const setPowered = disabled => {
    globalThis.__CONFIG__ = { ...(globalThis.__CONFIG__ || {}), disable_powered_by: disabled }
    setPoweredDisabled(disabled)
  }

  return (
    <main className='identity-fixture' data-testid='identity-fixture'>
      <HelmetTags
        page='login'
        helmetTitle='Identity fixture'
        description='Identity fixture description.'
      />
      <style>{`
        .identity-fixture { background: ${outerTheme.ordering?.semantic?.background}; color: ${outerTheme.ordering?.semantic?.text?.default}; box-sizing: border-box; display: grid; gap: 20px; min-width: 0; padding: 24px; width: 100%; }
        .identity-fixture * { box-sizing: border-box; }
        .identity-fixture h1, .identity-fixture h2, .identity-fixture figure { margin: 0; }
        .identity-controls { display: flex; flex-wrap: wrap; gap: 8px; }
        .identity-controls button { min-height: 44px; }
        .identity-section { border: 1px solid currentColor; border-radius: 8px; display: grid; gap: 12px; min-width: 0; padding: 16px; }
        .identity-assets { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); }
        .identity-asset-field { align-items: center; background: #fff; border: 1px solid #b1bccc; display: flex; justify-content: center; min-height: 96px; padding: 12px; }
        .identity-asset-dark .identity-asset-field { background: #151b26; }
        .identity-lockup img { display: block; height: auto; max-height: 80px; max-width: 150px; width: 150px; }
        .identity-symbol img { display: block; height: 44px; width: 44px; }
        .identity-fixture output { display: block; max-width: 100%; overflow-wrap: anywhere; white-space: pre-wrap; }
        @media (max-width: 420px) { .identity-fixture { gap: 12px; padding: 12px; } .identity-section { padding: 12px; } }
      `}</style>
      <h1>Ordering.co identity resolver fixture</h1>
      <p>This fixture uses an explicit simulated hostname: <strong data-testid='identity-host'>{hostname}</strong>.</p>

      <div className='identity-controls'>
        <button type='button' onClick={() => setHostname(officialHost)}>Use official host</button>
        <button type='button' onClick={() => setHostname(customHost)}>Use custom host</button>
        <button type='button' onClick={() => setMode(current => current === 'light' ? 'dark' : 'light')}>Toggle identity mode</button>
        <button type='button' onClick={() => setSyncRevision(current => current + 1)}>Sync icons again</button>
        <button type='button' onClick={() => setConfigs({ dashboard_logo: { value: tenantLogo }, dashboard_favicon: { value: tenantFavicon } })}>Apply tenant identity</button>
        <button type='button' onClick={() => setConfigs({})}>Clear tenant identity</button>
        <button type='button' onClick={() => setPowered(true)}>Disable powered by</button>
        <button type='button' onClick={() => setPowered(false)}>Enable powered by</button>
      </div>

      <section className='identity-section' aria-label='Resolver state'>
        <h2>Resolver state</h2>
        <output data-testid='identity-state'>{JSON.stringify({
          configs,
          hostname,
          isOfficial: isOfficialOrderingDashboardHost(hostname),
          mode,
          poweredDisabled,
          resolved,
          themeLogo
        })}</output>
        <output data-testid='identity-defaults'>{JSON.stringify(defaults)}</output>
        <output data-testid='identity-head-icons'>{JSON.stringify(headIcons)}</output>
      </section>

      <section className='identity-section' aria-label='Approved identity assets'>
        <h2>Approved identity assets</h2>
        <div className='identity-assets'>
          <Asset className='identity-lockup' alt='Ordering.co full color logo' label='Full color on Light' src={orderingAssets.logos.light} />
          <Asset className='identity-lockup identity-asset-dark' alt='Ordering.co reversed logo' label='Reversed on Dark' src={orderingAssets.logos.dark} />
          <Asset className='identity-lockup' alt='Ordering.co on white logo' label='On White' src={orderingAssets.logos.onLight} />
          <Asset className='identity-lockup identity-asset-dark' alt='Ordering.co on dark logo' label='On Dark' src={orderingAssets.logos.onDark} />
          <Asset className='identity-lockup' alt='Ordering.co print logo' label='Print PNG' src={orderingAssets.logos.print} />
          <Asset className='identity-symbol' alt='Ordering.co contained Light symbol' label='Contained symbol Light' src={orderingAssets.symbols.light} />
          <Asset className='identity-symbol identity-asset-dark' alt='Ordering.co contained Dark symbol' label='Contained symbol Dark' src={orderingAssets.symbols.dark} />
        </div>
      </section>

      <section className='identity-section' aria-label='Current resolved logo'>
        <h2>Current resolved logo</h2>
        {resolved.logo === publicAssetUrl('/default-logo.png')
          ? <p data-testid='identity-neutral-logo'>Neutral custom-domain placeholder: {resolved.logo}</p>
          : <Asset className={`identity-lockup ${mode === 'dark' ? 'identity-asset-dark' : ''}`} alt='Current resolved dashboard logo' label={`${mode} resolved logo`} src={resolved.logo} />}
      </section>
    </main>
  )
}
