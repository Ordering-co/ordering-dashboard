import React, { useEffect, useId, useRef, useState } from 'react'

import { useConfig, useLanguage } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { Button, EmptyState, IconButton, PageHeader, SearchField, useProductDir } from '../../Shared/Product'
import {
  Banknote,
  Bike,
  Calendar,
  Clock,
  Eye,
  MapPin,
  Menu as MenuIcon,
  Navigation,
  Package,
  Receipt,
  Search,
  ShoppingBag,
  Star,
  Store,
  Timer,
  Truck,
  UserRound,
  Wallet
} from '../../Shared/Icon'
import { ADVANCED_REPORTS, ADVANCED_REPORT_GROUPS, GROUP_TEXTS, REPORT_TEXTS, reportSearchText } from '../../../../../utils/advancedReports'
import { getEcommerceLegacyAliases } from '../../../../../utils/ecommerceReports'
import { normalizeSettingsSearch } from '../../../../../utils/settingsIa'
import { figure, fillTemplate } from '../AnalyticsKit/reportPillParts'
import { distanceUnitOf } from '../AnalyticsKit/pivotFormat'
import './reports.css'

// redesign reports FC1 (D2, RP-01, RP-02, RP-17; auditor 4): the catalog of /intelligence/reports. The five groups, the 22 reports
// always on view as native buttons (Tab reaches each one), a name that says what it measures and a real description, and «Find a
// report», which looks in the name, the description, the name of `main` (translated) and the Spanish aliases of ⌘K. It paints; the
// page (index.js) owns the route.

// redesign reports FC1 (D2): a small decorative Lucide icon per report (the registry is data, with no React)
const REPORT_ICONS = {
  1: Navigation,
  2: MapPin,
  3: Timer,
  4: Clock,
  5: Timer,
  6: Truck,
  7: Calendar,
  8: ShoppingBag,
  9: MapPin,
  10: Bike,
  11: Timer,
  12: Bike,
  13: ShoppingBag,
  14: Banknote,
  15: UserRound,
  16: Star,
  17: Wallet,
  18: Receipt,
  19: Store,
  20: Package,
  21: Clock,
  // redesign (n.º 21): the set has no pointer for the clicks, so the eye the ecommerce catalog used
  22: Eye
}

// redesign ecommerce FC (D1): exported, with an optional `icon` that wins over the registry's, for /intelligence/ecommerce_reports
export const ReportItem = ({ report, texts, icon, onOpen }) => {
  const nameId = useId()
  const descriptionId = useId()
  const Icon = icon ?? REPORT_ICONS[report.id] ?? Search
  return (
    <li>
      <button
        type='button'
        className='odc-rp-item'
        data-report-id={report.id}
        aria-labelledby={nameId}
        aria-describedby={descriptionId}
        onClick={() => onOpen(report.id)}
      >
        <Icon className='odc-rp-item-icon' />
        <span className='odc-rp-item-text'>
          <span id={nameId} className='odc-rp-item-name'>{texts.name}</span>
          <span id={descriptionId} className='odc-rp-item-description'>{texts.description}</span>
        </span>
      </button>
    </li>
  )
}

export const Section = ({ title, children }) => {
  const headingId = useId()
  return (
    <section className='odc-rp-section' aria-labelledby={headingId}>
      <h2 id={headingId} className='odc-rp-section-title'>{title}</h2>
      <ul className='odc-rp-list'>{children}</ul>
    </section>
  )
}

/**
 * @param {object}   props
 * @param {Function} props.onOpen          `(id) => void`: opens a report (the page pushes its `?id`).
 * @param {number}   [props.restoreFocusId] The report the user comes back from: its button gets the focus when the catalog opens.
 */
export const ReportsCatalog = ({ onOpen, restoreFocusId }) => {
  const [, t] = useLanguage()
  const [configState] = useConfig() || []
  // redesign the distance reports say «in miles» instead of «in km» in a miles project
  const distanceUnit = distanceUnitOf(configState?.configs)
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const dir = useProductDir()
  const rootRef = useRef(null)
  const [query, setQuery] = useState('')

  // redesign reports FC1 (D1): back from a report, the focus goes to that report's button
  useEffect(() => {
    if (restoreFocusId == null) return
    rootRef.current?.querySelector(`[data-report-id="${restoreFocusId}"]`)?.focus()
  }, [])

  const terms = normalizeSettingsSearch(query).split(/\s+/).filter(Boolean)
  // redesign the search terms of the retired Ecommerce page (reports 1-3 and 22), the same ones ⌘K searches
  const ecommerceAliases = getEcommerceLegacyAliases(t)
  const entries = ADVANCED_REPORTS.map(report => {
    const texts = REPORT_TEXTS[report.id](t, distanceUnit)
    // the new name and description as the user reads them (translated), plus the registry's search text (the name of main, the aliases)
    const haystack = `${reportSearchText(report, t, ecommerceAliases[report.id])} ${normalizeSettingsSearch(texts.name)} ${normalizeSettingsSearch(texts.description)}`
    return { report, texts, found: terms.every(term => haystack.includes(term)) }
  })
  const shown = entries.filter(entry => entry.found)

  const searchLabel = t('ENTERPRISE_REPORTS_SEARCH', 'Find a report')
  const clearSearch = () => setQuery('')

  return (
    <div ref={rootRef} className='odc-root odc-rp-page' data-slot='reports-catalog' dir={dir}>
      <PageHeader
        title={t('ENTERPRISE_REPORTS', 'Enterprise reports')}
        description={fillTemplate(
          t('ENTERPRISE_REPORTS_DESCRIPTION', '_count_ reports on sales, stores, delivery, drivers and customers. Open one to choose the period and filters.'),
          { count: ADVANCED_REPORTS.length },
          figure
        )}
        leading={isCollapse && (
          <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />
        )}
      />
      <SearchField
        className='odc-rp-search'
        value={query}
        onChange={setQuery}
        label={searchLabel}
        placeholder={searchLabel}
        clearLabel={t('CLEAR_SEARCH', 'Clear search')}
      />
      {shown.length === 0
        ? (
          <EmptyState
            icon={Search}
            title={t('ENTERPRISE_REPORTS_SEARCH_EMPTY', 'No reports match “_query_”').replace('_query_', () => query.trim())}
            action={<Button variant='secondary' onClick={clearSearch}>{t('CLEAR_SEARCH', 'Clear search')}</Button>}
          />
          )
        : ADVANCED_REPORT_GROUPS.map(group => {
          const inGroup = shown.filter(entry => entry.report.group === group)
          if (inGroup.length === 0) return null
          return (
            <Section key={group} title={GROUP_TEXTS[group](t)}>
              {inGroup.map(({ report, texts }) => <ReportItem key={report.id} report={report} texts={texts} onOpen={onOpen} />)}
            </Section>
          )
        })}
    </div>
  )
}
