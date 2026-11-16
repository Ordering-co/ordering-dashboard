import React, { useState } from 'react'

import { useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { formatWait, PAGE_SIZES, ruleWait } from '../../../../../utils/recoveryRules'
import {
  AsyncSwitch,
  Button,
  ColumnManager,
  DataTable,
  EmptyState,
  Pagination,
  RecordCardList,
  Skeleton
} from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { Inbox, Search, TriangleAlert } from '../../Shared/Icon'
import { channelLabel } from './channelLabel'
import { RESULT_KEYS, ResultFigure, resultLabels, resultsStatus, useResultFormatters } from './RuleResults'
import './recovery-rules-list.css'

// redesign RA-B2 (decision 2; M-RA1, M-RA2, M-RA3, M-RA4, M-RA5, M-RA8, M-RA17): the cart recovery rules list as a Product DataTable (and
// RecordCards under 768px). It draws what the controller gives (`rules`, `channelsByRule`, `pagination`) and what the host decides (the open
// rule, the switch that saves the rule, the panel); it fetches nothing and owns no dialog. What changes against `main`: no drag handle
// (the API has no order), two new columns (Sends after, Channels: a chip per channel, the ones that are off struck out), the Status
// column is a switch that does not lie when the save fails, no «Add new recovery action» at the foot, and a failed load has its «Retry».
// The results of each rule (Sent, Recovered, Revenue recovered) sit between Channels and Status; they come from a request of their own, so
// a failure leaves «—» in those cells and never touches the rows.
//
// @param {object[]} props.rules            The rules of the page (`{ id, name, description, enabled, times }`).
// @param {boolean}  [props.loading]        The page is loading: skeleton rows (cards on a phone).
// @param {*}        [props.error]          The load failed: a string, `{ message }` or a list of either; it takes the place of the list.
// @param {Function} [props.onRetry]        `() => void`: «Retry» of the failed load.
// @param {object}   [props.channelsByRule] `{ [ruleId]: { loading, channels, error } }`; a rule with no entry is read as loading.
// @param {Function} [props.onRetryChannels] `(ruleId) => void`: «Retry» of one row whose channels failed.
// @param {object}   [props.statsByRule]    `{ [ruleId]: { loading, error, sent_count, recovered_count, recovered_total } }`; a rule with no entry
//                                     (or no map) shows «—».
// @param {*}        [props.activeId]       The id of the open rule.
// @param {Function} [props.onOpen]         `(rule) => void`.
// @param {Function} [props.onToggle]       `(rule, next) => Promise<{ ok, error }>`: saves `enabled`; `ok: false` is the switch's failure.
// @param {Function} [props.confirmTurnOn] `(rule) => boolean | Promise<boolean>`: the host's question before a rule is turned ON (the switch's
//                                     `confirmChange`). redesign D-76 (owner, 2026-10-19): turning OFF stays immediate. Without it the switch saves at once.
// @param {object}   [props.pagination]     `{ currentPage, totalPages, totalItems, pageSize }` (the controller's paginationProps).
// @param {Function} [props.onPageChange]   `(page) => void`.
// @param {Function} [props.onPageSizeChange] `(size, page) => void`.
// @param {object}   [props.columnsState]  What `useRulesColumns()` returns. CM-1: the host keeps it because the column manager lives in
//                                     the filter bar of the header, not in the table; without it the table keeps its own (every column shown).
// @param {Function} [props.onNew]          `() => void`: «New rule» of the empty state.
// @param {string|boolean} [props.searching] The search text in force ('' or false: none). With text, an empty list is «No rules match "x"».

const DEFAULT_PAGE_SIZE = PAGE_SIZES[0]
const MANAGED = ['name', 'description', 'wait', 'channels', 'sent', 'recovered', 'revenue', 'status']

// Width of the table's own scroller (px) under which a column steps aside. Rule, Sends after and Status never do.
// Measured in the browser, not estimated: Sends after, Channels and Status take 292px, and the three results 286px (Sent 52, Recovered 90,
// Revenue recovered 144, the width of their headers). The order they leave in is what a person scans the list for: Description goes first
// (it is prose, and the panel shows it), then Sent, Recovered and Revenue recovered one by one, each while Rule would drop under 250px,
// and Channels last. Description hides under 1140, so a 1440px screen (a 1144px table) keeps every column. With the panel open at 1280
// the table is 544px and shows Rule, Sends after, Channels and Status, as it did before the results existed. This is the only place they live.
const DESCRIPTION_HIDE_BELOW = 1140
const SENT_HIDE_BELOW = 830
const RECOVERED_HIDE_BELOW = 780
const REVENUE_HIDE_BELOW = 690
const CHANNELS_HIDE_BELOW = 520

const defaultColumns = () => MANAGED.map(id => ({ id, visible: true }))

// CM-1: the column choice (what is shown, what the table hides at its width) is state of the host, so the manager can sit in the
// filter bar of the header (its `tools` slot) while the table draws the result. `columns` is `{ id, visible }[]` in the order of the manager.
export const useRulesColumns = () => {
  const [columns, setColumns] = useState(defaultColumns)
  const [widthHidden, setWidthHidden] = useState([])
  const change = (next) => setColumns(next.map(({ id, visible }) => ({ id, visible })))
  const reset = () => setColumns(defaultColumns())
  return { columns, widthHidden, setWidthHidden, change, reset }
}

const columnLabels = (t) => ({
  name: t('RECOVERY_RULES_COL_RULE', 'Rule'),
  description: t('DESCRIPTION', 'Description'),
  wait: t('RECOVERY_RULES_COL_SENDS_AFTER', 'Sends after'),
  channels: t('CHANNELS', 'Channels'),
  ...resultLabels(t),
  status: t('STATUS', 'Status')
})

// The column manager of the table, for the header's filter bar. Same columns (none locked), labels and notes as before it moved.
export const RulesColumnManager = ({ state }) => {
  const [, t] = useLanguage()
  const labels = columnLabels(t)
  const managerColumns = state.columns.map(({ id, visible }) => ({ id, label: labels[id], visible, locked: false, widthHidden: state.widthHidden.includes(id) }))
  return (
    <ColumnManager
      columns={managerColumns}
      onChange={state.change}
      onReset={state.reset}
      triggerLabel={t('MANAGE_COLUMNS', 'Manage columns')}
      title={t('MANAGE_COLUMNS', 'Manage columns')}
      resetLabel={t('COLUMNS_RESET', 'Reset')}
      lockedNote={t('COLUMN_ALWAYS_SHOWN', 'Always shown')}
      widthHiddenNote={t('COLUMN_HIDDEN_AT_WIDTH', 'Hidden at this width')}
      moveUpLabel={label => t('MOVE_COLUMN_UP', 'Move _column_ up').replace('_column_', label)}
      moveDownLabel={label => t('MOVE_COLUMN_DOWN', 'Move _column_ down').replace('_column_', label)}
    />
  )
}

// «of _total_» / «Showing _from_–_to_ of _total_»: the number becomes an .odc-figure node (decision 11)
const fillTemplate = (template, values, figure) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figure(values[name])}</React.Fragment> : part
})

const figureOf = (value) => <bdi dir='ltr' className='odc-figure'>{value}</bdi>

// The card is a link to `?id=`, as the order and campaign cards are: a middle click works; a plain click goes through `onOpen`.
const hrefFor = (id) => {
  if (typeof window === 'undefined') return `?id=${id}`
  const params = new URLSearchParams(window.location.search)
  params.set('id', id)
  return `${window.location.pathname}?${params}`
}

const hasError = (error) => (Array.isArray(error) ? error.length > 0 : Boolean(error))

const errorText = (t, error) => {
  const first = (Array.isArray(error) ? error.flat(Infinity) : [error])
    .map(item => (typeof item === 'string' ? item : item?.message))
    .find(Boolean)
  return translateApiMessage(t, first, undefined)
}

const plain = (template, values) => template.replace(/_([a-z]+)_/g, (match, name) => (values[name] !== undefined ? values[name] : match))

// The switch of a rule. It is Product's AsyncSwitch (it goes back and says why when the save fails); the visible «On» / «Off» follows what
// the switch shows, so while it saves the word and the track agree.
const RuleSwitch = ({ rule, onToggle, confirmTurnOn, t }) => {
  const [pending, setPending] = useState(null)
  const shown = pending ?? Boolean(rule.enabled)
  const name = rule.name ?? ''
  const handleToggle = async (next) => {
    setPending(next)
    try {
      return await onToggle?.(rule, next)
    } finally {
      setPending(null)
    }
  }
  return (
    <AsyncSwitch
      label={name}
      aria-label={name}
      checked={Boolean(rule.enabled)}
      onToggle={handleToggle}
      // redesign D-76 (owner, 2026-10-19): turning ON asks first (a rule starts sending); the switch does not look flipped while it asks
      confirmChange={confirmTurnOn ? (next) => !next || confirmTurnOn(rule) : undefined}
      failureText={t('RECOVERY_RULES_TOGGLE_FAILED', "We couldn't change this rule. Try again.")}
    >
      {shown ? t('RECOVERY_RULES_ON', 'On') : t('RECOVERY_RULES_OFF', 'Off')}
    </AsyncSwitch>
  )
}

// One chip per channel, in the order of the API (repeats included). A channel that is off is struck out and dimmed, and its name says so
// («SMS, off»): the strike is never the only sign. `inline` is the card's line, where the chips read as words with a dot between them.
const ChannelChips = ({ channels, t, inline = false }) => (
  <ul className='odc-ra-chips' data-inline={inline ? '' : undefined} role='list'>
    {channels.map((item, index) => {
      const name = channelLabel(t, item.channel, { short: true })
      const off = !item.enabled
      return (
        <React.Fragment key={item.id ?? `${item.channel}-${index}`}>
          {inline && index > 0 && <li className='odc-ra-sep' role='presentation' aria-hidden='true'> · </li>}
          <li
            className='odc-ra-chip'
            data-off={off ? '' : undefined}
            aria-label={off ? t('RECOVERY_RULES_CHANNEL_OFF', '_channel_, off').replace('_channel_', () => name) : undefined}
          >
            {name}
          </li>
        </React.Fragment>
      )
    })}
  </ul>
)

// What the channels of a rule are: loading (a skeleton), failed (its own «Retry», named for the rule), none, or the chips.
const ChannelsOf = ({ rule, state, onRetryChannels, t, inline = false }) => {
  if (!state || state.loading) {
    return (
      <span className='odc-ra-channels' data-inline={inline ? '' : undefined} aria-busy='true'>
        <Skeleton size='calc(var(--od-x-type-title-size) * 6)' />
        <span className='odc-sr-only'>{t('RECOVERY_RULES_CHANNELS_LOADING', 'Loading channels')}</span>
      </span>
    )
  }
  if (hasError(state.error)) {
    return (
      <Button
        variant='link'
        size='sm'
        className='odc-ra-retry'
        data-odc-no-open=''
        aria-label={t('RECOVERY_RULES_CHANNELS_RETRY', 'Retry loading the channels of _name_').replace('_name_', () => rule.name ?? '')}
        onClick={(event) => {
          event.stopPropagation() // the row is not opened by the button that asks again
          onRetryChannels?.(rule.id)
        }}
      >
        {t('RETRY', 'Retry')}
      </Button>
    )
  }
  const channels = Array.isArray(state.channels) ? state.channels : []
  if (channels.length === 0) return <span className='odc-ra-none'>{t('RECOVERY_RULES_NO_MESSAGES', 'No messages')}</span>
  return <ChannelChips channels={channels} t={t} inline={inline} />
}

export const RulesTable = ({
  rules = [],
  loading = false,
  error = null,
  onRetry,
  channelsByRule,
  onRetryChannels,
  statsByRule,
  activeId,
  onOpen,
  onToggle,
  confirmTurnOn,
  pagination,
  onPageChange,
  onPageSizeChange,
  columnsState,
  onNew,
  searching = ''
}) => {
  const [languageState, t] = useLanguage()
  const locale = languageState?.language?.code
  const isPhone = useIsPhone()
  const formatResult = useResultFormatters()
  // the column choice is local, as today (no persistence); the host that draws the manager gives it (`columnsState`)
  const ownColumns = useRulesColumns()
  const { columns: effective, setWidthHidden } = columnsState ?? ownColumns

  const pageSize = Number(pagination?.pageSize) || DEFAULT_PAGE_SIZE
  const currentPage = Number(pagination?.currentPage) || 1
  const total = pagination?.totalItems != null && Number.isFinite(Number(pagination.totalItems)) ? Number(pagination.totalItems) : null
  const query = typeof searching === 'string' ? searching.trim() : ''
  const hasSearch = Boolean(query) || searching === true

  const loadingLabel = t('RECOVERY_RULES_LOADING', 'Loading rules')
  const listLabel = t('CART_RECOVERY_RULES', 'Cart recovery rules')

  // ---- the cells (the table and the cards draw the same ones) ----
  const waitText = (rule) => {
    const seconds = ruleWait(rule)
    return seconds == null ? '—' : formatWait(seconds, locale)
  }
  const waitNode = (rule) => figureOf(waitText(rule))
  const channelsNode = (rule, inline) => (
    <ChannelsOf rule={rule} state={channelsByRule?.[rule.id]} onRetryChannels={onRetryChannels} t={t} inline={inline} />
  )
  const resultNode = (kind, rule) => (
    <ResultFigure kind={kind} stats={statsByRule?.[rule.id]} format={formatResult} t={t} />
  )
  // The card's line: the three results together, a single skeleton while they load, and nothing when they are not known (a card must stay quiet)
  const resultsLine = (rule) => {
    const stats = statsByRule?.[rule.id]
    const status = resultsStatus(stats)
    if (status === 'loading') return <ResultFigure kind='sent' stats={stats} format={formatResult} t={t} skeletonSize='calc(var(--od-x-type-title-size) * 8)' />
    if (status !== 'ready') return null
    const names = resultLabels(t)
    return RESULT_KEYS.map((kind, index) => (
      <React.Fragment key={kind}>
        {index > 0 && ' · '}
        {names[kind]}
        {' '}
        <ResultFigure kind={kind} stats={stats} format={formatResult} t={t} />
      </React.Fragment>
    ))
  }
  const statusNode = (rule) => (
    // the click on the switch (and on the notice of a failure) is its own: it never opens the rule
    <span className='odc-ra-control' data-odc-no-open=''>
      <RuleSwitch rule={rule} onToggle={onToggle} confirmTurnOn={confirmTurnOn} t={t} />
    </span>
  )

  // ---- the states that are not rows ----
  const emptyState = () => {
    if (hasSearch) {
      return (
        <EmptyState
          icon={Search}
          title={query
            ? t('RECOVERY_RULES_NO_MATCH', 'No rules match "_query_"').replace('_query_', () => query)
            : t('RECOVERY_RULES_NO_MATCH_ANY', 'No rules match your search')}
        />
      )
    }
    return (
      <EmptyState
        icon={Inbox}
        title={t('RECOVERY_RULES_EMPTY', 'No recovery rules yet')}
        action={<Button variant='primary' onClick={() => onNew?.()}>{t('RECOVERY_RULES_NEW', 'New rule')}</Button>}
      />
    )
  }

  // A failure takes the place of the list, with the way to try again (M-RA4)
  if (!loading && hasError(error)) {
    return (
      <EmptyState
        tone='error'
        icon={TriangleAlert}
        title={t('RECOVERY_RULES_LOAD_ERROR', "We couldn't load the rules.")}
        description={errorText(t, error)}
        action={<Button onClick={() => onRetry?.()}>{t('RETRY', 'Retry')}</Button>}
      />
    )
  }

  // ---- the foot: the pages, with today's sizes; nothing when there are no rows ----
  const showFoot = total != null ? total > 0 : rules.length > 0
  const foot = showFoot && (
    <div className='odc-ra-foot'>
      <Pagination
        page={currentPage}
        pageSize={pageSize}
        total={total ?? undefined}
        hasMore={total == null && currentPage < (Number(pagination?.totalPages) || 1)}
        itemCount={rules.length}
        pageSizeOptions={PAGE_SIZES}
        onPageChange={page => onPageChange?.(page)}
        onPageSizeChange={(size, page) => onPageSizeChange?.(size, page)}
        busy={loading}
        showPageInput
        label={t('PAGINATION', 'Pagination')}
        previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
        nextLabel={t('NEXT_PAGE', 'Next page')}
        pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
        pageLabel={t('PAGE', 'Page')}
        pageOfLabel={(totalPages, figure) => fillTemplate(t('PAGE_OF_TOTAL', 'of _total_'), { total: totalPages }, figure)}
        rangeLabel={(from, to, count, figure) => fillTemplate(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from, to, total: count }, figure)}
        pageStatusLabel={(current, totalPages) => plain(t('PAGE_STATUS', 'Page _page_ of _total_'), { page: String(current), total: String(totalPages) })}
      />
    </div>
  )

  // ---- phone: the same data as cards ----
  if (isPhone) {
    const toCard = (rule) => {
      const results = resultsLine(rule)
      return {
        id: rule.id,
        href: hrefFor(rule.id),
        label: t('RECOVERY_RULES_OPEN_RULE', 'Open _name_').replace('_name_', () => rule.name ?? ''),
        title: <span className='odc-ra-card-name' dir='auto'>{rule.name || '—'}</span>,
        from: rule.description ? <span className='odc-ra-description' dir='auto' title={rule.description}>{rule.description}</span> : undefined,
        indicator: (
        <span className='odc-ra-card-stack'>
          <span className='odc-ra-card-line'>
            {waitNode(rule)}
            {' · '}
            {channelsNode(rule, true)}
          </span>
          {results && <span className='odc-ra-card-line'>{results}</span>}
        </span>
        ),
        // the switch is the action of the card; whatever is inside `data-card-actions` never opens it
        actions: <div className='odc-ra-card-actions' data-card-actions=''>{statusNode(rule)}</div>,
        active: activeId != null && activeId !== '' && String(activeId) === String(rule.id),
        onOpen: () => onOpen?.(rule)
      }
    }
    return (
      <div className='odc-ra-cards'>
        <RecordCardList
          label={listLabel}
          items={loading ? [] : rules.map(toCard)}
          loading={loading}
          loadingLabel={loadingLabel}
          skeletonCount={pageSize}
          empty={emptyState()}
        />
        {foot}
      </div>
    )
  }

  // ---- desktop: one table, one tab stop; arrows move between rows, Enter opens ----
  const labels = columnLabels(t)
  const DEFINITIONS = {
    name: {
      header: labels.name,
      rowHeader: true,
      wrap: true,
      skeleton: { lines: 2 },
      cell: rule => <span className='odc-ra-name' dir='auto' title={rule.name}>{rule.name || '—'}</span>
    },
    description: {
      header: labels.description,
      wrap: true,
      hideBelow: DESCRIPTION_HIDE_BELOW,
      skeleton: { lines: 2 },
      cell: rule => <span className='odc-ra-description' dir='auto' title={rule.description || undefined}>{rule.description}</span>
    },
    wait: { header: labels.wait, skeleton: { lines: 1 }, cell: waitNode },
    channels: { header: labels.channels, hideBelow: CHANNELS_HIDE_BELOW, skeleton: { lines: 1 }, cell: rule => channelsNode(rule, false) },
    sent: { header: labels.sent, hideBelow: SENT_HIDE_BELOW, skeleton: { lines: 1 }, cell: rule => resultNode('sent', rule) },
    recovered: { header: labels.recovered, hideBelow: RECOVERED_HIDE_BELOW, skeleton: { lines: 1 }, cell: rule => resultNode('recovered', rule) },
    revenue: { header: labels.revenue, hideBelow: REVENUE_HIDE_BELOW, skeleton: { lines: 1 }, cell: rule => resultNode('revenue', rule) },
    status: { header: labels.status, skeleton: { lines: 1 }, cell: statusNode }
  }
  const tableColumns = effective.filter(column => column.visible).map(({ id }) => ({ id, ...DEFINITIONS[id] }))

  return (
    <>
      <DataTable
        label={listLabel}
        columns={tableColumns}
        rows={rules}
        getRowId={rule => rule.id}
        getRowAttributes={rule => ({ 'data-row-id': rule.id })} // listFocus finds the row by it
        activeRowId={activeId != null && activeId !== '' ? Number(activeId) : undefined}
        onOpenRow={rule => onOpen?.(rule)}
        onWidthHiddenChange={setWidthHidden}
        loading={loading}
        loadingLabel={loadingLabel}
        skeletonRows={pageSize}
        scrollLabel={t('RECOVERY_RULES_TABLE_SCROLL_REGION', 'Rules table, scrolls sideways')}
        empty={emptyState()}
      />
      {foot}
    </>
  )
}
