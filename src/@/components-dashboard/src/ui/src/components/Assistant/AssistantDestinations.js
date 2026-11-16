import React, { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../../../../index'
import { useDashboardDestinations } from '../../contexts/DashboardDestinationsContext'
import { useCommandPalette } from '../../contexts/CommandPaletteContext'
import { Button } from '../Shared/Product'
import { LoaderCircle } from '../Shared/Icon'
import './assistant-destinations.css'
import {
  ASSISTANT_NAV_CHOOSE_STORE,
  ASSISTANT_NAV_GO_TO,
  ASSISTANT_NAV_NOT_FOUND,
  ASSISTANT_NAV_SEARCH,
  ASSISTANT_NAVIGATION,
  ASSISTANT_NAVIGATION_ERROR,
  ASSISTANT_DESTINATIONS_PARTIAL,
  LOADING
} from '../../../../../../../../i18n/translations.json'

const localTranslations = {
  ASSISTANT_NAV_CHOOSE_STORE,
  ASSISTANT_NAV_GO_TO,
  ASSISTANT_NAV_NOT_FOUND,
  ASSISTANT_NAV_SEARCH,
  ASSISTANT_NAVIGATION,
  ASSISTANT_NAVIGATION_ERROR,
  ASSISTANT_DESTINATIONS_PARTIAL,
  LOADING
}

export const AssistantDestinations = ({ result }) => {
  const [languageState, translate] = useLanguage()
  const locale = (languageState?.language?.code || 'en').toLowerCase().split(/[-_]/)[0]
  const t = (key, fallback) => translate(key, localTranslations[key]?.[locale] || fallback)
  const { open, chooseBusiness, scope } = useDashboardDestinations()
  const palette = useCommandPalette()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const requestRef = useRef(null)

  useEffect(() => {
    setBusy(false)
    setError(false)
    return () => {
      requestRef.current?.abort()
      requestRef.current = null
    }
  }, [result, scope])

  const select = async (item) => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setBusy(true)
    setError(false)
    try {
      const options = { scope: result.scope, revision: result.revision, signal: controller.signal }
      const next = await (item.requires_business ? chooseBusiness(item, options) : open(item, options))
      if (requestRef.current !== controller || controller.signal.aborted) return
      if (!['opened', 'needs_business'].includes(next?.status)) setError(true)
    } catch (err) {
      if (requestRef.current === controller && !controller.signal.aborted) setError(true)
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null
        setBusy(false)
      }
    }
  }

  if (!result || result.scope !== scope) return null
  const items = result.status === 'unavailable' ? [] : (result.items || []).slice(0, 3)
  const label = (item) => {
    if (items.length > 1) return `${item.title}${item.subtitle ? ` · ${item.subtitle}` : ''}`
    return (item.requires_business
      ? t('ASSISTANT_NAV_CHOOSE_STORE', 'Choose store for {{title}}')
      : t('ASSISTANT_NAV_GO_TO', 'Go to {{title}}')).replace('{{title}}', item.title)
  }

  // redesign J5 row 51 (assistant P-3, ): the destinations are P/Button (secondary; the single one keeps the discreet main-action
  // border of AS-C D4) and «Search the Dashboard» is the link variant. The vendored registry button (styles/Ordering-Ui) has no
  // consumer left; decision 32 removes it.
  return (
    <section className='odc-as-destinations' aria-label={t('ASSISTANT_NAVIGATION', 'Dashboard navigation')} aria-busy={busy}>
      {items.map(item => (
        <div key={item.id} className='odc-as-destination-item'>
          <Button
            type='button'
            variant='secondary'
            className={`odc-as-dest-btn${items.length === 1 ? ' odc-as-dest-single' : ''}`}
            disabled={busy}
            onClick={() => select(item)}
          >
            {label(item)}
          </Button>
          {items.length === 1 && item.subtitle && <p className='odc-as-subtitle'>{item.subtitle}</p>}
        </div>
      ))}
      {busy && <div role='status' className='odc-as-note'><LoaderCircle className='odc-icon odc-as-spin' aria-hidden='true' /> {t('LOADING', 'Loading')}</div>}
      {error && <p role='alert' className='odc-as-note odc-as-note-error'>{t('ASSISTANT_NAVIGATION_ERROR', 'This destination is no longer available. Search the Dashboard again.')}</p>}
      {!items.length && <p role='status' className='odc-as-note'>{t('ASSISTANT_NAV_NOT_FOUND', 'No available destination was found.')}</p>}
      {result.status === 'partial' && <p role='status' className='odc-as-note'>{t('ASSISTANT_DESTINATIONS_PARTIAL', 'Some results could not be loaded.')}</p>}
      {palette.isAvailable && (
        <Button type='button' variant='link' className='odc-as-dest-search' disabled={busy} onClick={() => palette.open({ query: result.query, fromAssistant: true })}>
          {t('ASSISTANT_NAV_SEARCH', 'Search the Dashboard')}
        </Button>
      )}
    </section>
  )
}
