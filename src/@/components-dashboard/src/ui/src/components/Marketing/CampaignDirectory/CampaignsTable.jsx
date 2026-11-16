import React, { useState } from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import {
  Button,
  ColumnManager,
  DataTable,
  EmptyState,
  Pagination,
  RecordCardList,
  Status,
  Switch
} from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { FilterX, Megaphone, TriangleAlert } from '../../Shared/Icon'
import { audienceLabel, campaignStatus, channelLabel, formatCount, formatWhen, hasOrderStats } from './campaignData'
import './campaigns-table.css'

// redesign CA-B4 (decision 2; defects M-CA4, M-CA5, M-CA6, M-CA8): the campaigns list as a Product DataTable (and RecordCards under
// 768px). It draws what the controller gives (`campaigns`, `pagination`) and what the host decides (the open campaign, the status
// switch from useCampaignEnabledToggle, the opens dialog); it fetches nothing and owns no dialog. What changes against `main`:
// every row opens, ended campaigns included (they open read-only); the channel and the audience are labels, never the raw value;
// the unlabeled last cell is the «Status» column; the unsubscribed and bounced columns stay hidden as today.

const PAGE_SIZES = [10, 25, 50] // S/Pagination's options
const DEFAULT_PAGE_SIZE = 10
const MANAGED = ['campaign', 'contact_type', 'audience', 'status', 'in_queue', 'sent_count', 'open_count', 'orders_count', 'orders_total']
const LOCKED = ['campaign', 'status']

// Width of the table's own scroller (px) under which the orders and the revenue step aside. Measured in the browser: the seven columns the
// list had before them need about 750px and scroll sideways under that; Orders takes 66px and Revenue 95px more. So Orders leaves first and
// Revenue (what a campaign is judged by) after it, and under 840px the table is the one it was before they existed.
const ORDERS_HIDE_BELOW = 910
const REVENUE_HIDE_BELOW = 840

const defaultColumns = () => MANAGED.map(id => ({ id, visible: true }))

// CM-1: the column choice is state of the host, so the manager can sit in the filter bar (its `tools` slot) while the table draws
// the result. `columns` is `{ id, visible }[]` in the order of the manager; the locked ones are forced visible where they are read.
export const useCampaignColumns = () => {
  const [columns, setColumns] = useState(defaultColumns)
  // the columns the table hides at its width: the manager says so next to each one
  const [widthHidden, setWidthHidden] = useState([])
  const change = (next) => setColumns(next.map(({ id, visible }) => ({ id, visible })))
  const reset = () => setColumns(defaultColumns())
  return { columns, widthHidden, setWidthHidden, change, reset }
}

const columnLabels = (t) => ({
  campaign: t('CAMPAIGN', 'Campaign'),
  contact_type: t('CAMPAIGNS_FILTER_CHANNEL', 'Channel'),
  audience: t('AUDIENCE', 'Audience'),
  status: t('STATUS', 'Status'),
  in_queue: t('IN_QUEUE', 'In queue'),
  sent_count: t('SENT', 'Sent'),
  open_count: t('OPENS', 'Opens'),
  orders_count: t('ORDERS', 'Orders'),
  orders_total: t('CAMPAIGNS_COL_REVENUE', 'Revenue')
})

// The column manager of the table, for the filter bar. Same columns (Campaign and Status locked), labels and notes as before it moved.
export const CampaignColumnManager = ({ state }) => {
  const [, t] = useLanguage()
  const labels = columnLabels(t)
  const managerColumns = state.columns.map(({ id, visible }) => ({ id, label: labels[id], visible: LOCKED.includes(id) || visible, locked: LOCKED.includes(id), widthHidden: state.widthHidden.includes(id) }))
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

// «_count_ in queue»: the number becomes an .odc-figure node (decision 11) and keeps its direction in RTL
const fillTemplate = (template, values, figure) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figure(values[name])}</React.Fragment> : part
})

const figureOf = (value) => <bdi dir='ltr' className='odc-figure'>{value}</bdi>

// The card is a link to `?id=`, as the order cards are: a middle click works; a plain click goes through `onOpen`.
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

// The arithmetic and the N/A rule of M/CampaignList:281-303, literally. Push campaigns are stored as "notification", so only
// «sms» and the literal «push» are N/A: a push campaign shows its sent and opens figures and the opens list (auditor #1).
const inQueueOf = (campaign) => (
  (typeof campaign?.audience_count !== 'undefined' && typeof campaign?.sent_count !== 'undefined')
    ? (campaign.audience_count - campaign.sent_count)
    : 0
)
const hasNoStats = (campaign) => campaign?.contact_type === 'sms' || campaign?.contact_type === 'push'

export const CampaignsTable = ({
  campaigns = [],
  loading = false,
  error = null,
  onRetry,
  activeId,
  onOpen,
  onOpenOpens,
  toggle,
  pagination,
  onPageChange,
  onPageSizeChange,
  hasFilters = false,
  onClearFilters,
  onNew,
  columnsState
}) => {
  const [languageState, t] = useLanguage()
  const [{ parseDate, parsePrice }] = useUtils()
  // redesign CA-R1 (live check): every count is written in the number format of the person's language («1,240» / «1.240»)
  const locale = languageState?.language?.code
  const fmt = (value) => formatCount(value, locale)
  const isPhone = useIsPhone()
  // the column choice is local, as today (no persistence); the host that draws the manager gives it (`columnsState`)
  const ownColumns = useCampaignColumns()
  const { columns: effective, setWidthHidden } = columnsState ?? ownColumns

  const pendingIds = toggle?.pendingIds ?? []
  const pageSize = Number(pagination?.pageSize) || DEFAULT_PAGE_SIZE
  const currentPage = Number(pagination?.currentPage) || 1
  const skeletonCount = pageSize
  const total = pagination?.totalItems != null && Number.isFinite(Number(pagination.totalItems)) ? Number(pagination.totalItems) : null

  // ---- the cells (the table and the cards draw the same ones) ----
  const na = () => <span className='odc-campaign-na'>{t('NA', 'N/A')}</span>

  const statusNode = (campaign, { withDate = true } = {}) => {
    const status = campaignStatus(campaign, t)
    if (status.toggle) {
      // The visible text is the status («Active» / «Paused»); the name adds the campaign, so a list of switches is not a list of «Active»
      const name = t('CAMPAIGNS_STATUS_SWITCH', '_status_, _name_').replace('_status_', status.label).replace('_name_', campaign.name ?? '')
      return (
        <span className='odc-campaign-control' data-odc-no-open=''>
          <Switch
            checked={!!campaign.enabled}
            busy={pendingIds.includes(campaign.id)}
            className='odc-campaign-status-label' // redesign CA-R2 (P4): the label never breaks mid-word
            aria-label={name}
            onCheckedChange={next => toggle?.setEnabled?.(campaign, next)}
          >
            {status.label}
          </Switch>
        </span>
      )
    }
    const when = withDate && campaign.status === 'scheduled' ? formatWhen(campaign.scheduled_at, parseDate) : null
    return (
      <span className='odc-campaign-status'>
        <Status family={status.family} label={status.label} className='odc-campaign-status-label' />
        {when && <bdi className='odc-figure odc-campaign-when'>{when}</bdi>}
      </span>
    )
  }

  const inQueueCell = (campaign) => figureOf(fmt(inQueueOf(campaign)))
  const sentCell = (campaign) => (hasNoStats(campaign) ? na() : figureOf(fmt(campaign?.sent_count || 0)))

  const opensCell = (campaign) => {
    if (hasNoStats(campaign)) return na()
    const count = campaign?.open_count || 0
    if (!(count > 0)) return figureOf(fmt(0))
    const name = t(count === 1 ? 'CAMPAIGNS_OPENS_LINK_ONE' : 'CAMPAIGNS_OPENS_LINK_OTHER', count === 1 ? '_count_ open of _name_' : '_count_ opens of _name_')
      .replace('_count_', fmt(count))
      .replace('_name_', campaign.name ?? '')
    return (
      <Button
        variant='link'
        size='sm'
        className='odc-campaign-opens-link'
        aria-label={name}
        data-odc-no-open=''
        onClick={event => {
          event.stopPropagation() // the row is not opened by the link that opens the list
          onOpenOpens?.(campaign)
        }}
      >
        {figureOf(fmt(count))}
      </Button>
    )
  }

  // Orders and revenue are attributed to emails (tagged links) and push notifications (opened in the app); the other channels have nothing to attribute, so they read N/A, not 0
  const ordersCell = (campaign) => (hasOrderStats(campaign) ? figureOf(fmt(campaign?.orders_count || 0)) : na())
  const revenueCell = (campaign) => (hasOrderStats(campaign) ? figureOf(parsePrice(Number(campaign?.orders_total) || 0)) : na())

  // ---- the states that are not rows ----
  const loadingLabel = t('CAMPAIGNS_LOADING', 'Loading campaigns')
  const listLabel = t('CAMPAIGNS_TITLE', 'Campaigns')

  const emptyState = () => {
    if (hasFilters) {
      return (
        <EmptyState
          icon={FilterX}
          title={t('CAMPAIGNS_NO_MATCH', 'No campaigns match these filters')}
          action={<Button onClick={() => onClearFilters?.()}>{t('CLEAR_FILTERS', 'Clear filters')}</Button>}
        />
      )
    }
    return (
      <EmptyState
        icon={Megaphone}
        title={t('CAMPAIGNS_EMPTY', 'No campaigns yet')}
        action={<Button variant='primary' onClick={() => onNew?.()}>{t('CAMPAIGNS_NEW', 'New campaign')}</Button>}
      />
    )
  }

  // A failure takes the place of the list, with the way to try again
  if (!loading && hasError(error)) {
    return (
      <EmptyState
        tone='error'
        icon={TriangleAlert}
        title={t('CAMPAIGNS_LOAD_ERROR', "We couldn't load campaigns.")}
        description={errorText(t, error)}
        action={<Button onClick={() => onRetry?.()}>{t('RETRY', 'Retry')}</Button>}
      />
    )
  }

  // ---- the foot: the pages, with today's sizes; nothing when there are no rows ----
  const showFoot = total != null ? total > 0 : campaigns.length > 0
  const foot = showFoot && (
    <div className='odc-campaign-foot'>
      <Pagination
        page={currentPage}
        pageSize={pageSize}
        total={total ?? undefined}
        hasMore={total == null && currentPage < (Number(pagination?.totalPages) || 1)}
        itemCount={campaigns.length}
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
        pageStatusLabel={(current, totalPages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(totalPages))}
      />
    </div>
  )

  // ---- phone: the same data as cards (every card carries the same data: auditor #18) ----
  if (isPhone) {
    const toCard = (campaign) => {
      const queue = inQueueOf(campaign)
      const sent = hasNoStats(campaign)
        ? t('CAMPAIGNS_SENT_NA', 'Sent: N/A')
        : fillTemplate(
          t((campaign.sent_count || 0) === 1 ? 'CAMPAIGNS_SENT_ONE' : 'CAMPAIGNS_SENT_OTHER', '_count_ sent'),
          { count: fmt(campaign.sent_count || 0) },
          figureOf
        )
      // redesign CA-R2 (P5, parity): main's phone table carried the opens count and the link to the list of opens; the card keeps both,
      // under the same N/A rule as the table («Opens: N/A») and the link only when there is something to open
      const opens = Number(campaign.open_count) || 0
      const opensText = hasNoStats(campaign)
        ? t('CAMPAIGNS_OPENS_NA', 'Opens: N/A')
        : fillTemplate(
          t(opens === 1 ? 'CAMPAIGNS_OPENS_COUNT_ONE' : 'CAMPAIGNS_OPENS_COUNT_OTHER', opens === 1 ? '_count_ open' : '_count_ opens'),
          { count: fmt(opens) },
          figureOf
        )
      // orders and revenue share the N/A rule of the table; without stats the card says so once and carries no revenue
      const orders = Number(campaign.orders_count) || 0
      const ordersText = hasOrderStats(campaign)
        ? (
          <>
            {fillTemplate(
              // one literal t() per key: a key picked inside the call is not found by the catalog scan and stays untranslated
              orders === 1 ? t('CAMPAIGNS_ORDERS_COUNT_ONE', '_count_ order') : t('CAMPAIGNS_ORDERS_COUNT_OTHER', '_count_ orders'),
              { count: fmt(orders) },
              figureOf
            )}
            {' · '}
            {figureOf(parsePrice(Number(campaign.orders_total) || 0))}
          </>
          )
        : t('CAMPAIGNS_ORDERS_NA', 'Orders: N/A')
      const nameId = `odc-campaign-card-name-${campaign.id}`
      const when = campaign.status === 'scheduled' ? formatWhen(campaign.scheduled_at, parseDate) : null
      return {
        id: campaign.id,
        href: hrefFor(campaign.id),
        label: t('CAMPAIGNS_OPEN_CAMPAIGN', 'Open _name_').replace('_name_', campaign.name ?? ''),
        title: <span id={nameId} className='odc-campaign-card-name' dir='auto'>{campaign.name}</span>,
        status: statusNode(campaign, { withDate: false }),
        from: (
          <span className='odc-campaign-card-kind'>
            {channelLabel(t, campaign.contact_type)}{' · '}{audienceLabel(t, campaign.audience_type)}
          </span>
        ),
        schedule: when ? [<bdi key='when' className='odc-figure'>{when}</bdi>] : [],
        indicator: (
          <span className='odc-campaign-card-figures'>
            {fillTemplate(t(queue === 1 ? 'CAMPAIGNS_IN_QUEUE_ONE' : 'CAMPAIGNS_IN_QUEUE_OTHER', '_count_ in queue'), { count: fmt(queue) }, figureOf)}
            {' · '}
            {sent}
            {' · '}
            {opensText}
            {' · '}
            {ordersText}
          </span>
        ),
        // the link opens the list of opens and never the card (`data-card-actions`: the card ignores what is inside); the name of the
        // campaign is its description, so a list of «View opens» buttons says whose each one is
        actions: !hasNoStats(campaign) && opens > 0
          ? (
            <div className='odc-order-card-actions' data-card-actions=''>
              <Button
                variant='link'
                aria-describedby={nameId}
                onClick={event => {
                  event.stopPropagation()
                  onOpenOpens?.(campaign)
                }}
              >
                {t('CAMPAIGNS_VIEW_OPENS', 'View opens')}
              </Button>
            </div>
            )
          : undefined,
        active: activeId != null && String(activeId) === String(campaign.id),
        onOpen: () => onOpen?.(campaign)
      }
    }
    return (
      <div className='odc-campaign-cards'>
        <RecordCardList
          label={listLabel}
          items={loading ? [] : campaigns.map(toCard)}
          loading={loading}
          loadingLabel={loadingLabel}
          skeletonCount={skeletonCount}
          empty={emptyState()}
        />
        {foot}
      </div>
    )
  }

  // ---- desktop: one table, one tab stop; arrows move between rows, Enter opens ----
  const labels = columnLabels(t)
  const DEFINITIONS = {
    campaign: { header: labels.campaign, rowHeader: true, wrap: true, locked: true, skeleton: { lines: 1, floor: 'var(--od-x-col-floor-campaign)' } /* redesign CA-R1 (live check: names cut to a few letters beside the panel) */, cell: campaign => <span className='odc-campaign-name' dir='auto' title={campaign.name}>{campaign.name}</span> },
    contact_type: { header: labels.contact_type, skeleton: { lines: 1 }, cell: campaign => channelLabel(t, campaign.contact_type) },
    audience: { header: labels.audience, skeleton: { lines: 1 }, cell: campaign => audienceLabel(t, campaign.audience_type) },
    // redesign CA-R2 (P4): beside the open panel this column was cut mid-word («Schedulec»); it names its floor (src/brand/candidates.css)
    status: { header: labels.status, locked: true, skeleton: { lines: 1, lead: 'dot', floor: 'var(--od-x-col-floor-campaign-status)' }, cell: statusNode },
    in_queue: { header: labels.in_queue, align: 'end', skeleton: { lines: 1 }, cell: inQueueCell },
    sent_count: { header: labels.sent_count, align: 'end', skeleton: { lines: 1 }, cell: sentCell },
    open_count: { header: labels.open_count, align: 'end', skeleton: { lines: 1 }, cell: opensCell },
    orders_count: { header: labels.orders_count, align: 'end', hideBelow: ORDERS_HIDE_BELOW, skeleton: { lines: 1 }, cell: ordersCell },
    orders_total: { header: labels.orders_total, align: 'end', hideBelow: REVENUE_HIDE_BELOW, skeleton: { lines: 1 }, cell: revenueCell }
  }
  const tableColumns = effective
    .filter(column => column.visible || LOCKED.includes(column.id))
    .map(({ id }) => ({ id, ...DEFINITIONS[id] }))

  return (
    <>
      <DataTable
        label={listLabel}
        columns={tableColumns}
        rows={campaigns}
        getRowId={campaign => campaign.id}
        activeRowId={activeId != null && activeId !== '' ? Number(activeId) : undefined}
        onOpenRow={campaign => onOpen?.(campaign)}
        onWidthHiddenChange={setWidthHidden}
        loading={loading}
        loadingLabel={loadingLabel}
        skeletonRows={skeletonCount}
        scrollLabel={t('CAMPAIGNS_TABLE_SCROLL_REGION', 'Campaigns table, scrolls sideways')}
        empty={emptyState()}
      />
      {foot}
    </>
  )
}
