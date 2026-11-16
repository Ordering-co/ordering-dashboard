import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { useLanguage, useConfig, SettingsLogs as SettingsLogsController } from '../../../../../index'
import { useSettingsCatalog } from '../../../../../components/CommandPalette/useSettingsCatalog'
import { findSettingsConfigLocation } from '../../../../../utils/settingsIa'
import { buildSettingsPath } from '../../../../../utils/settingsRedirects'
import { getSettingsChangeName } from '../../../../../utils/settingsCustomSections'
import { describeSettingValue } from '../../../../../utils/settingsLogValue'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { ChangeLogView, formatValue, humanize, sideOf } from '../../Shared/ChangeLog'
import { Menu as MenuIcon, Search, TriangleAlert } from '../../Shared/Icon'
import { Button, IconButton, InlineNotice, PageHeader } from '../../Shared/Product'
import { SettingsLogsFilters } from './SettingsLogsFilters'
import { useSettingsLogsQuery, writeFilters, writePage, writeRecord } from './settingsLogsQuery'
import './settings-logs.css'

// redesign settings-logs: the project's settings logs on Product, on the same view as the store's logs
// (Shared/ChangeLog, promoted from Stores/BusinessLogs), in place of the legacy table, Modal and Pagination.
// - P/PageHeader with the count of changes; the table adds a «Setting» column after Event (the setting's name, as the hub names it:
//   `config.name`, else its key in words) (M-SL10). Cards under 768px take the setting as their title.
// - Changes (M-SL1…M-SL3): one line per change, «old → new». A change of the setting's `value` is not prefixed with «Value:» (the
//   setting is its own column; main's «Details» said «Vlue»); its sides are named as the hub names them (`describeSettingValue`:
//   «0 → 1» reads «No → Yes»). Any other attribute keeps «Name: old → new», and a schedule keeps its «See changes» dialog.
// - Nothing is cut or folded (`complete`): main's table showed every field, so the table does not clamp the changes and a card
//   under 768px carries the event, the email, every change whole and the user agent (audit F1: nothing behind a tap on the phone).
// - The detail adds the stored values (raw) under «Technical details» and «Find in Settings», a link to the setting's field in the
//   hub (its group, category and focus), else to the hub's search for its key (only when the project has that setting).
// - G2-33 (M-SL5): a failure is said, never «No data». its headline is this page's own sentence («The settings changes could
//   not be loaded.»), the API's text goes under it as the secondary line, and the button is «Retry».
// - in a right-to-left language the arrow of a change points left (from the old value to the new one, in the reading
//   direction) and each side is isolated, so a value in another script does not reorder the line.
// - the page, the filters and the open log live in the address (settingsLogsQuery: ?page= ?pageSize= ?config= ?author=
//   ?from= ?to= ?id=), so a reload, a link or «Back» from «Find in Settings» bring the same list and log. The bar filters by setting,
//   user and date (the API applies `where`); a link to a log outside the page asks
//   the API for it. Filtered and empty is «No changes match these filters» with «Clear filters». The detail is the shared view's,
//   held here (`detailLog`): the store and group logs keep their own, since their `?id=` is the store or the group.

// the lines of the change log are plain text (the shared view prints them as a string and as a title). A right-to-left
// line starts with a right-to-left mark, so `dir='auto'` reads it right to left whatever the first value is, and each value sits inside
// a first-strong isolate (what `<bdi>` is in markup), so Arabic next to Latin keeps its order.
const RLM = '\u200F'
const FSI = '\u2068'
const PDI = '\u2069'
const changeText = (prefix, oldText, newText, rtl) => (
  rtl ? `${RLM}${prefix}${FSI}${oldText}${PDI} ← ${FSI}${newText}${PDI}` : `${prefix}${oldText} → ${newText}`
)

const plain = (template, count) => template.replace('_count_', () => String(count))
const plural = (count, one, other) => (count === 1 ? one : other)

/** The name of the setting a log is about, as the hub names it (the decision 32 map first, then the API's
 * `config.name`), else its key in words, else «-». */
const settingName = (log, t) => {
  const name = String((log?.config ? getSettingsChangeName(log.config, t) : '') ?? '').trim()
  return name || humanize(log?.config?.key) || '-'
}

// row 85 (Q-03): the link goes to the field (group + category + focus, as the ⌘K palette builds it) once the hub catalog
// knows it; while it loads, on a failure or for a key it does not place, it stays the hub search. A component of its own, so the
// catalog request happens only when a detail with this link is open, not when the list loads.
const FindInSettingsLink = ({ settingKey, label }) => {
  const { hub } = useSettingsCatalog({ enabled: true })
  const location = findSettingsConfigLocation(hub || [], settingKey)
  const to = location
    ? buildSettingsPath({ group: location.groupKey, category: location.sectionKey, focus: settingKey })
    : buildSettingsPath({ q: settingKey })
  return (
    <Link className='odc-btn' data-variant='secondary' data-size='md' to={to}>
      <Search className='odc-icon' />
      {label}
    </Link>
  )
}

export const SettingsLogsUI = (props) => {
  const {
    logsList,
    paginationProps,
    getSettingsLogs,
    reload,
    filters,
    changeFilters,
    getSettingsLog,
    authorsList,
    syncUrl,
    initialLogId
  } = props

  const [languageState, t] = useLanguage()
  const rtl = Boolean(languageState?.language?.rtl)
  const [{ configs }] = useConfig()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()

  const title = t('SETTINGS_LOGS_TITLE', 'Settings logs')
  const total = Number(paginationProps?.totalItems)
  const known = !logsList?.error && Number.isFinite(total) && paginationProps?.totalItems != null
  const countLabel = known
    ? plain(plural(total, t('SETTINGS_LOGS_COUNT_ONE', '_count_ change'), t('SETTINGS_LOGS_COUNT_OTHER', '_count_ changes')), total)
    : undefined

  // a side of a change of the setting's value, as the hub names it; anything else as the shared view writes it
  const valueSide = (log, item, side) => {
    const direct = item?.[side]
    if (direct != null && typeof direct !== 'object') {
      return describeSettingValue({ config: log?.config, value: direct, t }) ?? formatValue(direct, t)
    }
    return sideOf(item, side, t)
  }

  const getChanges = (log, { defaultChanges }) => {
    const lines = defaultChanges(log)
    return lines.map(line => {
      if (line.schedule) return line
      if (line.attribute !== 'value') {
        // «Name: old → new» is the shared view's; only the right-to-left reading is rewritten here
        if (!rtl || !line.raw) return line
        return { ...line, text: changeText(`${line.name}: `, sideOf(line.raw, 'old', t), sideOf(line.raw, 'new', t), true) }
      }
      return { ...line, text: changeText('', valueSide(log, line.raw, 'old'), valueSide(log, line.raw, 'new'), rtl) }
    })
  }

  const header = (
    <PageHeader
      title={title}
      count={known ? total : undefined}
      countLabel={countLabel}
      leading={isCollapse && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />}
    />
  )

  // the stored values of the setting's value changes, as the API keeps them (the table and the cards show their names)
  const detailTechnical = (entry) => {
    const lines = entry.changes.filter(line => line.attribute === 'value' && line.raw)
    if (lines.length === 0) return null
    return lines.map((line, index) => (
      <span key={index} className='odc-cl-raw odc-mono' dir='ltr'>
        {`${t('STORED_VALUE', 'Stored value')}: `}
        <bdi>{formatValue(line.raw.old, t)}</bdi>
        {' → '}
        <bdi>{formatValue(line.raw.new, t)}</bdi>
      </span>
    ))
  }

  // a real link (role link, middle click, open in a new tab) with P/Button's look: its class and data-variant / data-size, not a
  // Base UI button rendered as an anchor (that one says role=button)
  const detailFoot = (entry) => {
    const key = String(entry.log?.config?.key ?? '').trim()
    if (!key || !configs?.[key]) return null
    return (
      <div className='odc-cl-detail-foot'>
        <FindInSettingsLink settingKey={key} label={t('FIND_IN_SETTINGS', 'Find in Settings')} />
      </div>
    )
  }

  // ---- filters, pages and the open log, in the address when the page is wired (`syncUrl`) ----
  const filtered = Boolean(filters && (filters.configIds?.length || filters.authorIds?.length || filters.from || filters.to))
  const settingItems = Object.values(configs || {})
    .filter(config => Number.isInteger(config?.id))
    .map(config => ({ id: config.id, name: settingName({ config }, t), keywords: [config.key].filter(Boolean) }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const authorItems = {
    items: (authorsList?.users || []).map(user => ({
      id: user.id,
      name: [user.name, user.lastname].filter(Boolean).join(' ').trim() || user.email || String(user.id),
      secondary: user.email
    })),
    loading: Boolean(authorsList?.loading)
  }
  // the address keeps only the filters the list applies: without `where`, ?author= ?from= ?to= (and a second setting) go away
  useEffect(() => {
    if (syncUrl && filters) writeFilters(filters, { keepPage: true })
  }, [])
  const onFiltersChange = (next) => {
    changeFilters?.(next)
    if (syncUrl) writeFilters(next)
  }
  const onPageChange = (page, size) => {
    getSettingsLogs?.(page, size)
    if (syncUrl) writePage(page, size)
  }

  const [detailLog, setDetailLog] = useState(null)
  const changeDetail = (log) => {
    setDetailLog(log)
    if (syncUrl) writeRecord(log?.id ?? null)
  }
  // ?id= of the first load: the log on the page, else the API's (it may be on another page); a log that does not exist leaves the address
  const pendingId = useRef(initialLogId)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])
  useEffect(() => {
    const id = pendingId.current
    if (!id || logsList?.loading || logsList?.error) return
    pendingId.current = null
    const found = (logsList?.logs || []).find(log => log?.id === id)
    if (found) {
      setDetailLog(found)
      return
    }
    Promise.resolve(getSettingsLog?.(id)).then(log => {
      if (!mounted.current) return
      if (log) setDetailLog(log)
      else if (syncUrl) writeRecord(null)
    })
  }, [logsList?.loading, logsList?.error])

  const filterBar = changeFilters && filters && (
    <SettingsLogsFilters
      filters={filters}
      onChange={onFiltersChange}
      settings={settingItems}
      authors={authorItems}
    />
  )

  // a failed load (not while a retry is loading) is drawn here, not by the shared view, which shows only the API's text
  const loading = Boolean(logsList?.loading)
  const error = loading ? null : logsList?.error
  const retryRef = useRef(null)
  const retrying = useRef(false)
  const retry = () => {
    retrying.current = true
    return reload ? reload() : getSettingsLogs?.(Number(paginationProps?.currentPage) >= 1 ? Number(paginationProps.currentPage) : 1, paginationProps?.pageSize)
  }
  // the focus follows a retry: the button it was on is gone while the page loads, so it goes back to «Retry» if the retry failed again,
  // else to the first row (as the shared view does for its own «Try again»)
  useEffect(() => {
    if (loading || !retrying.current) return
    retrying.current = false
    const active = document.activeElement
    if (active && active !== document.body) return
    if (error) retryRef.current?.focus()
    else document.querySelector('.odc-cl tr[tabindex="0"], .odc-cl .odc-order-card-link')?.focus()
  }, [loading, error])

  if (error) {
    const headline = t('SETTINGS_LOGS_LOAD_FAILED', 'The settings changes could not be loaded.')
    const raw = typeof error === 'string' ? error : error?.message
    const detail = translateApiMessage(t, raw, '')
    return (
      <div className='odc-root odc-cl' data-frame='page'>
        {header}
        {filterBar}
        <InlineNotice
          tone='danger'
          role='alert'
          icon={TriangleAlert}
          className='odc-cl-notice'
          action={<Button ref={retryRef} size='sm' onClick={retry}>{t('RETRY', 'Retry')}</Button>}
        >
          <span className='odc-sl-error-title'>{headline}</span>
          {detail && detail !== headline && <span className='odc-sl-error-detail'>{detail}</span>}
        </InlineNotice>
      </div>
    )
  }

  return (
    <ChangeLogView
      frame='page'
      header={<>{header}{filterBar}</>}
      logsList={logsList}
      paginationProps={paginationProps}
      onPageChange={onPageChange}
      onReload={reload}
      listLabel={title}
      scrollLabel={t('SETTINGS_LOGS_TABLE_SCROLL_REGION', 'Settings logs table, scrolls sideways')}
      emptyTitle={filtered
        ? t('SETTINGS_LOGS_EMPTY_FILTERED', 'No changes match these filters')
        : t('SETTINGS_LOGS_EMPTY', 'No settings changes yet')}
      emptyDescription={filtered
        ? t('SETTINGS_LOGS_EMPTY_FILTERED_DESCRIPTION', 'Try other filters, or clear them to see every change.')
        : t('SETTINGS_LOGS_EMPTY_DESCRIPTION', 'Changes made to the project settings will appear here.')}
      emptyAction={filtered
        ? <Button variant='secondary' onClick={() => onFiltersChange({ configIds: [], authorIds: [], from: null, to: null })}>{t('CLEAR_FILTERS', 'Clear filters')}</Button>
        : undefined}
      detailLog={syncUrl ? detailLog : undefined}
      onDetailChange={changeDetail}
      loadFailedLabel={t('SETTINGS_LOGS_LOAD_FAILED', 'The settings changes could not be loaded.')}
      getChanges={getChanges}
      subjectColumn={{
        id: 'setting',
        header: t('SETTING', 'Setting'),
        cell: entry => <span className='odc-cl-subject' dir='auto'>{settingName(entry.log, t)}</span>
      }}
      cardTitle={entry => <span className='odc-cl-event' dir='auto'>{settingName(entry.log, t)}</span>}
      cardLabel={entry => settingName(entry.log, t)}
      complete
      detailTechnical={detailTechnical}
      detailFoot={detailFoot}
    />
  )
}

export const SettingsLogs = (props) => {
  const query = useSettingsLogsQuery()
  const settingsLogsProps = {
    ...props,
    UIComponent: SettingsLogsUI
  }
  return (
    <SettingsLogsController
      {...settingsLogsProps}
      paginationSettings={{ initialPage: query.page, pageSize: query.pageSize, controlType: 'pages' }}
      initialFilters={query.filters}
      initialLogId={query.id}
      syncUrl
    />
  )
}
