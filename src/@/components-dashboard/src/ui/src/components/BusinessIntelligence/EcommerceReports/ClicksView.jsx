import React, { useEffect, useMemo, useRef } from 'react'

import { useLanguage } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { useAdvancedReport } from '../../../../../components/AdvancedReports/useAdvancedReport'
import { IconButton, InlineNotice, Menu, PageHeader, useProductDir } from '../../Shared/Product'
import { Info, Menu as MenuIcon } from '../../Shared/Icon'
import { todayDay } from '../../../../../utils/dateRange'
import { CLICK_TYPES, buildClicksParams, clickRows, clicksFilters, shownClickTypes } from '../../../../../utils/clicksReport'
import { ECOMMERCE_REPORT_TEXTS, getEcommerceReport } from '../../../../../utils/ecommerceReports'
import { ReportCard, ReportChannels, ReportFilterPills } from '../AnalyticsKit'
import { PeriodPill } from '../Reports/ReportView'
import { usePeriodText } from '../Reports/usePeriodText'
import { ClicksCard } from './ClicksCard'
import '../Reports/reports.css'
import '../Reports/report-body.css'

// redesign ecommerce FC (D5, D6, D8, D9, D10; C3): the clicks report of /intelligence/ecommerce_reports, with the frame of a report of
// /intelligence/reports (`ReportView`): the header with «Switch report», the bar of filters with the period first, the line of dates; then the
// row of channels of Business and one card per kind of click. It owns nothing the user chose: the filters, the country and the names the bar has
// learned are the page's (index.js), so changing report keeps them. Mounted with `key` per report, as `ReportView`.

const REPORT = getEcommerceReport(4)

/**
 * @param {object}   props
 * @param {object}   props.filters        The page's filters (`initialFilters` plus `app_id`).
 * @param {string}   props.countryCode    The page's country ('' = all).
 * @param {object}   props.names          The names the filter bar has learned (page state).
 * @param {Function} props.onChangeFilters `(updater) => void`: the page's `setFilters`.
 * @param {Function} props.onChangeCode   `(code) => void`: the page's country toggle.
 * @param {Function} props.onChangeNames  `(next) => void`: the page's setter of `names`.
 * @param {Function} props.onClearFilters `() => void`: «Clear filters», which clears every filter the page holds.
 * @param {Function} props.onBack         «All reports».
 * @param {Function} props.onSwitch       `(id) => void`: another report.
 * @param {Array}    props.switchReports  `[{ id, name, groupLabel }]`: the entries of «Switch report», in the order of the catalog.
 * @param {node}     [props.learn]        The help entry of the header.
 * @param {number}   [props.reportId]     The id this report has in `switchReports` (default 4, the ecommerce page's; 22 in Enterprise reports, n.º 21).
 */
export const ClicksView = ({ filters, countryCode, names, onChangeFilters, onChangeCode, onChangeNames, onClearFilters, onBack, onSwitch, switchReports, learn, reportId = REPORT.id }) => {
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const { rangeText } = usePeriodText()
  const dir = useProductDir()
  const headRef = useRef(null)
  const today = todayDay()
  const texts = ECOMMERCE_REPORT_TEXTS[REPORT.id](t)
  // redesign ecommerce FC (D5, D8): the same request as `main`'s `EcommerceAnalitycs`; the stores of reports 1 to 3 are not sent.
  // api-core filters tracking_events by country_code, so the chosen country travels too
  const sent = useMemo(() => clicksFilters(filters, countryCode), [filters, countryCode])
  const result = useAdvancedReport({ endpoint: REPORT.endpoint, filters: sent, buildParams: buildClicksParams, enabled: true })
  const rows = useMemo(() => Object.fromEntries(CLICK_TYPES.map(type => [type, clickRows(result?.data, type)])), [result?.data])
  const types = shownClickTypes(rows)
  // said only once the answer is in, so a load or an error does not pass for «not recorded»
  const noCategories = !result.loading && !result.error && !types.includes('Category')

  // opening the report puts the focus on its title (the h1 of the header, which takes it with tabindex -1; `headRef` is the page root,
  // whose first h1 is the header's)
  useEffect(() => {
    const title = headRef.current?.querySelector('h1')
    if (!title) return
    title.setAttribute('tabindex', '-1')
    title.focus()
  }, [])

  const switchItems = switchReports.map((item, index) => {
    const firstOfGroup = index === 0 || switchReports[index - 1].groupLabel !== item.groupLabel
    return {
      key: String(item.id),
      type: 'radio',
      checked: item.id === reportId,
      label: item.name,
      // the group is said once, on its first report
      description: firstOfGroup ? item.groupLabel : undefined,
      separatorBefore: firstOfGroup && index > 0,
      onSelect: () => onSwitch(item.id)
    }
  })

  return (
    <div ref={headRef} className='odc-root odc-rp-page' data-slot='clicks-view' data-report={reportId} dir={dir}>
      <PageHeader
        wideTitle
        title={texts.name}
        description={texts.description}
        backLabel={t('ENTERPRISE_REPORTS_ALL', 'All reports')}
        onBack={onBack}
        learn={learn}
        leading={isCollapse && (
          <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />
        )}
        actions={<Menu label={t('ENTERPRISE_REPORTS_SWITCH', 'Switch report')} items={switchItems} align='end' />}
      />
      <div className='odc-rp-controls'>
        <ReportFilterPills
          filterList={filters}
          // the bar hands back the whole object; only what its pills own becomes the page's (the period and the channel have their own controls)
          handleChangeFilterList={(next) => onChangeFilters(current => ({
            ...current,
            franchises_id: next.franchises_id ?? null,
            timeZone: next.timeZone ?? current.timeZone,
            businessIds: next.businessIds ?? null
          }))}
          countryCode={countryCode}
          handleChangeCode={onChangeCode}
          pills={REPORT.pills}
          countryWhenMany
          names={names}
          onNamesChange={onChangeNames}
          onClearFilters={onClearFilters}
          leading={<PeriodPill from={filters.from} to={filters.to} today={today} onApplyRange={(range) => onChangeFilters(current => ({ ...current, ...range }))} />}
        />
        <p className='odc-rp-period-line'>
          <bdi>{rangeText(filters.from, filters.to)}</bdi>
        </p>
        <ReportChannels
          filterList={{ app_id: filters.app_id }}
          handleChangeFilterList={(next) => onChangeFilters(current => ({ ...current, app_id: next.app_id }))}
        />
      </div>
      <div className='odc-rp-body'>
        {/* a live region that exists before it has text is the one a screen reader announces; empty, it takes no room */}
        <span className='odc-rp-updating' aria-live='polite'>{result.updating ? t('ENTERPRISE_REPORTS_UPDATING', 'Updating…') : null}</span>
        {/* redesign ecommerce R1 (review 2): the three kinds come in one answer, so a failed load is one block with one «Try again» */}
        {result.error && !result.loading
          ? <ReportCard title={texts.name} headingLevel={2} error={result.error} onRetry={result.retry} />
          : types.map(type => (
            <ClicksCard
              key={type}
              type={type}
              rows={rows[type]}
              loading={result.loading}
              updating={result.updating}
            />
          ))}
        {noCategories && (
          <InlineNotice tone='info' icon={Info} live={false}>
            {t('CLICKS_REPORT_NO_CATEGORY_CLICKS', 'Clicks on categories are not recorded yet.')}
          </InlineNotice>
        )}
      </div>
    </div>
  )
}
