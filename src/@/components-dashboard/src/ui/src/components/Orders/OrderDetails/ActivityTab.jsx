import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  useLanguage,
  useUtils,
  useConfig,
  Messages as MessagesController,
  Logistics as LogisticsController,
  LogisticInformation as LogisticInformationController
} from '../../../../../index'
import { addQueryToUrl } from '../../../utils'
import { useOrderMessages } from './OrderMessages'
import { buildOrderPlacedForViaHtml, getOrderPlacedViaCopy } from '../Messages/orderPlacedHistory'
import { ActivityTimeline, Button, Dialog, EmptyState, SegmentedControl, Skeleton } from '../../Shared/Product'
import { ArrowLeft, History, RotateCw, TriangleAlert } from '../../Shared/Icon'
import './activity-tab.css'
import './image-preview.css'

/**
 * Activity tab (C9, batch 5.3): history and logistics of the order on ONE timeline, newest first,
 * with a `Show` filter and the technical facts folded away. It replaces the Order History /
 * Logistics / Logistics information strip of the old third panel.
 *
 * Sources are the existing controllers, each with its own UIComponent (no fetch here):
 *  - history: `Messages` (GET /orders/:id/messages?mode=dashboard), types 0 and 1 only,
 *    text from `getHistoryComment`;
 *  - logistics: `Logistics` (GET /orders/:id/logs), text from `parseLog`;
 *  - logistics information: `LogisticInformation`, reached from the Logistics filter.
 */

// `?tab=` values that exist today; the filter only adds Status and Payments, which share order_history.
const TAB_HISTORY = 'order_history'
const TAB_LOGISTICS = 'logistics'
const TAB_INFORMATION = 'logistic_information'

// `history` is the old "Order History" view (main: Messages/index.js:363-372): the order's own events
// alone, with no logistics events and no /logs request. `all` adds the logistics on top of it.
const MODE_HISTORY = 'history'
// Views of the history that keep the same `?tab=order_history` URL when the filter writes it
const HISTORY_FAMILY = ['all', 'status', 'payments', MODE_HISTORY]

const modeFromTab = (tab) => {
  if (tab === TAB_HISTORY) return MODE_HISTORY
  if (tab === TAB_LOGISTICS) return 'logistics'
  if (tab === TAB_INFORMATION) return 'info'
  return 'all'
}

const tabFromMode = (mode) => mode === 'logistics' ? TAB_LOGISTICS : TAB_HISTORY

// History attributes that belong to a filter. Everything else is only in "All".
const STATUS_ATTRIBUTES = ['status', 'reject_reason']
const LOGISTICS_ATTRIBUTES = ['logistic_status', 'driver_id', 'distance', 'vehicle']
const PAYMENT_ATTRIBUTE = /refund|pay|paid|transaction|tip|summary\./
// Order statuses that close the story well (completed by admin, delivered, picked up): the node is filled.
const COMPLETED_STATUSES = [1, 11, 15]

// getHistoryComment appends `<br>-<br>…` (app id, author, user agent, location map, IP) for levels 0 and 2.
// That tail is the technical block: it goes into the fold, the title keeps the rest.
const TECHNICAL_MARKER = '<br>-<br>'

export const splitTechnicalBlock = (html) => {
  const text = String(html ?? '')
  const index = text.indexOf(TECHNICAL_MARKER)
  if (index === -1) return { title: text, technical: '' }
  return { title: text.slice(0, index), technical: text.slice(index + TECHNICAL_MARKER.length) }
}

const HTML_ENTITIES = { '&amp;': '&', '&#39;': '\'', '&quot;': '"', '&lt;': '<', '&gt;': '>' }

/** The static map of the technical block is an escaped <img>; take its URL back, https only. */
export const extractMapSrc = (technical) => {
  const match = /<img src="([^"]+)"/.exec(String(technical ?? ''))
  if (!match) return null
  const src = match[1].replace(/&(?:amp|#39|quot|lt|gt);/g, entity => HTML_ENTITIES[entity])
  return src.startsWith('https://') ? src : null
}

const toTime = (value) => {
  const text = String(value ?? '')
  const iso = text.includes('T') ? text : text.replace(' ', 'T')
  const milliseconds = Date.parse(/(?:z|[+-]\d\d:?\d\d)$/i.test(iso) ? iso : `${iso}Z`)
  return Number.isNaN(milliseconds) ? 0 : milliseconds
}

// redesign tramo A r3 (W0-QA1-09): the machine value of an event time, the `dateTime` of its <time> (ISO 8601; the text stays the project's format).
const datetime = (value) => (toTime(value) ? new Date(toTime(value)).toISOString() : undefined)

// redesign F6g-2: an event time is one left-to-right run, so a right-to-left feed does not reorder it
const ltr = (value) => <bdi dir='ltr'>{value}</bdi>
// redesign W0-3a (T0-9, decisión 11a): the time of an attempt in a sentence is a figure; the sentence around it is not.
// (The timeline's own `<time>` already carries `odc-figure`, so the `at` runs above keep plain `ltr`.)
const figure = (value) => <bdi dir='ltr' className='odc-figure'>{value}</bdi>

const fullName = (person) => [person?.name, person?.lastname].filter(Boolean).join(' ')

/** App id, user agent, IP and the location map: what the fold of a timeline event holds. */
export const TechnicalFacts = ({ appId, author, userAgent, ip, mapSrc }) => {
  const [, t] = useLanguage()
  return (
    <dl className='odt-facts'>
      {appId != null && appId !== '' && (
        <>
          <dt>{t('APP_ID', 'App id')}</dt>
          <dd className='odc-mono'>{appId}</dd>
        </>
      )}
      {author != null && author !== '' && (
        <>
          <dt>{t('AUTHOR', 'Author')}</dt>
          <dd>{author}</dd>
        </>
      )}
      {userAgent != null && userAgent !== '' && (
        <>
          <dt>{t('USER_AGENT', 'User agent')}</dt>
          <dd className='odc-mono'>{userAgent}</dd>
        </>
      )}
      {ip != null && ip !== '' && (
        <>
          <dt>{t('IP', 'IP')}</dt>
          <dd className='odc-mono'>{ip}</dd>
        </>
      )}
      {mapSrc && (
        <>
          <dt>{t('LOCATION', 'Location')}</dt>
          <dd><img className='odt-facts-map' src={mapSrc} alt={t('LOCATION', 'Location')} loading='lazy' /></dd>
        </>
      )}
    </dl>
  )
}

const HtmlText = ({ html }) => <div className='odt-act-title' dangerouslySetInnerHTML={{ __html: html }} />

// Who sees what is the one of main, untouched: the placed event (type 0) shows app, author, user agent
// and IP at any level; the technical tail of a type 1 event only exists for levels 0 and 2, because
// getHistoryComment only appends it for them. So nothing here checks the level.
const buildItems = ({ order, messages, logs, getHistoryComment, parseLog, parseDate, t, onPreview }) => {
  const items = []
  const appLabel = (appId) => appId ? t(String(appId).toUpperCase(), appId) : ''
  const authorLine = (message) => {
    const author = message?.author ? fullName(message.author) : t('AUTHOR_SYSTEM', 'System')
    const app = appLabel(message?.app_id)
    return t('ACTIVITY_BY', 'by _author_').replace('_author_', app ? `${author} · ${app}` : author)
  }
  const factsOf = (message, mapSrc) => (
    <TechnicalFacts appId={message?.app_id} userAgent={message?.user_agent} ip={message?.ip} mapSrc={mapSrc} />
  )

  const viaCopy = getOrderPlacedViaCopy(order?.app_id)

  messages.forEach((message) => {
    if (message.type === 0) {
      items.push({
        id: `message-${message.id}`,
        sort: toTime(message.created_at),
        kind: 'other',
        item: {
          at: ltr(parseDate(message.created_at)),
          datetime: datetime(message.created_at),
          key: true,
          title: (
            <HtmlText
              html={buildOrderPlacedForViaHtml({
                template: t('ORDER_PLACED_FOR_VIA', 'Order placed for _for_ via _via_.'),
                deliveryDatetimeUtc: order?.delivery_datetime_utc,
                parseUtcDate: () => parseDate(order?.delivery_datetime_utc),
                parseLocalDate: () => parseDate(order?.delivery_datetime, { utc: false }),
                viaLabel: t(viaCopy.key, viaCopy.fallback)
              })}
            />
          ),
          by: authorLine(message),
          details: factsOf(message)
        }
      })
      return
    }
    if (message.type !== 1) return
    const comment = getHistoryComment(message)
    if (!comment) return
    const { title, technical } = splitTechnicalBlock(comment)
    const attribute = message?.change?.attribute || ''
    const kind = STATUS_ATTRIBUTES.includes(attribute)
      ? 'status'
      : LOGISTICS_ATTRIBUTES.includes(attribute)
        ? 'logistics'
        : PAYMENT_ATTRIBUTE.test(attribute) ? 'payments' : 'other'
    items.push({
      id: `message-${message.id}`,
      sort: toTime(message.created_at),
      kind,
      item: {
        at: ltr(parseDate(message.created_at)),
        datetime: datetime(message.created_at),
        key: attribute === 'status' && COMPLETED_STATUSES.includes(Number(message.change?.new)),
        title: (
          <>
            <HtmlText html={title} />
            {message.source && (
              // main opened the picture in a preview (Messages/index.js:510-512), not in a new tab
              <button
                type='button'
                className='odt-chat-thumb'
                aria-label={t('CLICK_TO_EXPAND', 'Click to expand')}
                title={t('CLICK_TO_EXPAND', 'Click to expand')}
                onClick={() => onPreview?.(message.source)}
              >
                <img src={message.source} alt={t('IMAGE', 'Image')} loading='lazy' />
              </button>
            )}
          </>
        ),
        by: technical ? authorLine(message) : undefined,
        details: technical ? factsOf(message, extractMapSrc(technical)) : undefined
      }
    })
  })

  logs.forEach((log) => {
    items.push({
      id: `log-${log.id}`,
      sort: toTime(log.updated_at),
      kind: 'logistics',
      item: {
        at: ltr(parseDate(log.updated_at)),
        datetime: datetime(log.updated_at),
        title: (
          <>
            <HtmlText html={parseLog(log)} />
            {log.event === 'logistic_expired' && (
              <div className='odt-act-reason'>{t('REASON', 'Reason')}: {log?.data?.reason}</div>
            )}
          </>
        )
      }
    })
  })

  return items
    .sort((a, b) => (b.sort - a.sort) || String(b.id).localeCompare(String(a.id)))
}

const ActivitySkeleton = () => {
  const [, t] = useLanguage()
  return (
    <div className='odt-act-skeleton' aria-busy='true'>
      <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
      {['60%', '85%', '40%', '70%', '55%'].map((size, index) => (
        <div key={index} className='odt-act-skeleton-row'>
          <Skeleton size='30%' />
          <Skeleton size={size} />
        </div>
      ))}
    </div>
  )
}

const ActivityFeed = (props) => {
  const {
    historyState,
    getHistoryComment,
    logisticList,
    parseLog,
    getLogistics,
    order,
    mode,
    onFilterChange,
    onOpenInformation
  } = props
  const [, t] = useLanguage()
  const [{ parseDate }] = useUtils()
  const [previewImage, setPreviewImage] = useState(null)

  const loading = !!historyState?.loading || !!logisticList?.loading
  const historyError = !historyState?.loading && historyState?.error
  const logisticsError = !logisticList?.loading && logisticList?.error
  const messages = Array.isArray(historyState?.messages) ? historyState.messages : []
  const logs = Array.isArray(logisticList?.logs) ? logisticList.logs : []

  const everything = loading
    ? []
    : buildItems({
      order,
      messages,
      logs,
      getHistoryComment,
      parseLog,
      parseDate,
      t,
      onPreview: setPreviewImage
    })
  const visible = (mode === 'all' || mode === MODE_HISTORY) ? everything : everything.filter(entry => entry.kind === mode)

  const filter = (
    <div className='odt-act-toolbar'>
      <div className='odt-act-seg'>
        <SegmentedControl
          label={t('SHOW', 'Show')}
          value={mode}
          onValueChange={onFilterChange}
          options={[
            { value: 'all', label: t('ALL', 'All') },
            { value: 'status', label: t('STATUS', 'Status') },
            { value: 'logistics', label: t('LOGISTICS', 'Logistics') },
            { value: 'payments', label: t('PAYMENTS', 'Payments') }
          ]}
        />
      </div>
      {/* redesign fix-qa E8: Reload is there with every filter (All, Status, Logistics, Payments), not only two of them;
          the history-only view asks for no logistics events, so it has nothing to reload. */}
      {mode !== MODE_HISTORY && (
        <Button size='sm' icon={RotateCw} onClick={() => getLogistics()}>
          {t('RELOAD', 'Reload')}
        </Button>
      )}
    </div>
  )

  let empty
  if (loading) {
    empty = <ActivitySkeleton />
  } else if (historyError && mode !== 'logistics') {
    empty = (
      <EmptyState
        tone='error'
        icon={TriangleAlert}
        title={t('ACTIVITY_LOAD_ERROR', 'Couldn\'t load the order activity')}
        description={t('ACTIVITY_LOAD_ERROR_HINT', 'Close the panel and open the order again to retry.')}
      />
    )
  } else if (logisticsError && mode === 'logistics') {
    empty = (
      <EmptyState
        tone='error'
        icon={TriangleAlert}
        title={t('LOGISTICS_LOAD_ERROR', 'Couldn\'t load the logistics events')}
        action={<Button size='sm' icon={RotateCw} onClick={() => getLogistics()}>{t('RELOAD', 'Reload')}</Button>}
      />
    )
  } else if (everything.length === 0) {
    empty = <EmptyState icon={History} title={t('NO_ACTIVITY_YET', 'No activity yet')} />
  } else {
    empty = <EmptyState icon={History} title={t('NO_ACTIVITY_FILTERED', 'No events match this view')} />
  }

  return (
    <>
      {mode === MODE_HISTORY && (
        <p className='odt-act-more'>
          {t('ACTIVITY_HISTORY_ONLY', 'Showing the order history only.')}{' '}
          <Button variant='link' onClick={() => onFilterChange('all')}>
            {t('ACTIVITY_SHOW_LOGISTICS', 'Show logistics')}
          </Button>
        </p>
      )}
      <ActivityTimeline
        label={t('ORDER_ACTIVITY', 'Order activity')}
        detailsLabel={t('TECHNICAL_DETAILS', 'Technical details')}
        filter={filter}
        items={visible.map(entry => ({ id: entry.id, ...entry.item }))}
        empty={empty}
      />
      {mode === 'logistics' && !loading && (
        <div className='odt-act-more'>
          <Button variant='link' onClick={onOpenInformation}>
            {t('LOGISTIC_INFORMATION', 'Logistics information')}
          </Button>
        </div>
      )}
      {!loading && logisticsError && !historyError && mode === 'all' && visible.length > 0 && (
        <p className='odt-act-alert' role='alert'>
          <TriangleAlert className='odc-icon' />
          {t('LOGISTICS_LOAD_ERROR', 'Couldn\'t load the logistics events')}
        </p>
      )}
      <Dialog
        open={!!previewImage}
        onOpenChange={(open) => { if (!open) setPreviewImage(null) }}
        title={t('IMAGE_PREVIEW', 'Image preview')}
        closeLabel={t('CLOSE', 'Close')}
        size='lg'
        className='odc-image-dialog'
      >
        {previewImage && (
          <div className='odt-chat-preview'>
            <img src={previewImage} alt={t('IMAGE', 'Image')} />
            <a href={previewImage} target='_blank' rel='noopener noreferrer'>
              {t('OPEN_ORIGINAL_IMAGE', 'Open original image')}
            </a>
          </div>
        )}
      </Dialog>
    </>
  )
}

// History controller UI: hands its state to the logistics controller, which renders the merged feed.
const NO_LOGS = { loading: false, error: null, logs: [] }
const noReload = () => {}

const ActivityHistoryUI = (props) => {
  const { messages, getHistoryComment, order, mode, onFilterChange, onOpenInformation } = props
  // The history alone asks for no logistics events at all: the feed gets an empty list instead of the controller.
  if (mode === MODE_HISTORY) {
    return (
      <ActivityFeed
        order={order}
        historyState={messages}
        logisticList={NO_LOGS}
        getLogistics={noReload}
        getHistoryComment={getHistoryComment}
        mode={mode}
        onFilterChange={onFilterChange}
        onOpenInformation={onOpenInformation}
      />
    )
  }
  return (
    <LogisticsController
      orderId={order.id}
      order={order}
      UIComponent={ActivityFeed}
      historyState={messages}
      getHistoryComment={getHistoryComment}
      mode={mode}
      onFilterChange={onFilterChange}
      onOpenInformation={onOpenInformation}
    />
  )
}

const ORDER_STATUS_KEYS = [
  [0, 'PENDING', 'Pending'],
  [1, 'COMPLETED_BY_ADMIN', 'Completed by admin'],
  [2, 'REJECTED_BY_ADMIN', 'Rejected by admin'],
  [3, 'ORDER_STATUS_IN_BUSINESS', 'Driver arrived to business'],
  [4, 'PREPARATION_COMPLETED', 'Preparation completed'],
  [5, 'REJECTED_BY_BUSINESS', 'Rejected by business'],
  [6, 'REJECTED_BY_DRIVER', 'Rejected by driver'],
  [7, 'ACCEPTED_BY_BUSINESS', 'Accepted by business'],
  [8, 'ACCEPTED_BY_DRIVER', 'Accepted by driver'],
  [9, 'PICK_UP_COMPLETED_BY_DRIVER', 'Pick up completed by driver'],
  [10, 'PICK_UP_FAILED_BY_DRIVER', 'Pick up failed by driver'],
  [11, 'DELIVERY_COMPLETED_BY_DRIVER', 'Delivery completed by driver'],
  [12, 'DELIVERY_FAILED_BY_DRIVER', 'Delivery failed by driver'],
  [13, 'PREORDER', 'Preorder'],
  [14, 'ORDER_NOT_READY', 'Order not ready'],
  [15, 'ORDER_PICKEDUP_COMPLETED_BY_CUSTOMER', 'Pickup completed by customer'],
  [16, 'ORDER_STATUS_CANCELLED_BY_CUSTOMER', 'Cancelled by customer'],
  [17, 'ORDER_NOT_PICKEDUP_BY_CUSTOMER', 'Not picked by customer'],
  [18, 'ORDER_DRIVER_ALMOST_ARRIVED_BUSINESS', 'Driver almost arrived to business'],
  [19, 'ORDER_DRIVER_ALMOST_ARRIVED_CUSTOMER', 'Driver almost arrived to customer'],
  [20, 'ORDER_CUSTOMER_ALMOST_ARRIVED_BUSINESS', 'Customer almost arrived to business'],
  [21, 'ORDER_CUSTOMER_ARRIVED_BUSINESS', 'Customer arrived to business'],
  [22, 'ORDER_LOOKING_FOR_DRIVER', 'Looking for driver'],
  [23, 'ORDER_DRIVER_ON_WAY', 'Driver on way'],
  [24, 'ORDER_STATUS_DRIVER_WAITING_FOR_ORDER', 'Driver waiting for order'],
  [25, 'ORDER_STATUS_ACCEPTED_BY_DRIVER_COMPANY', 'Accepted by driver company'],
  [26, 'ORDER_DRIVER_ARRIVED_CUSTOMER', 'Driver arrived to customer']
]

// Logistics information controller UI: the same facts the old tab showed, as sections and key-value lists.
const InformationUI = (props) => {
  const { logisticInformation, getLogistics, onBack } = props
  const [, t] = useLanguage()
  const [{ parseDate, parseNumber }] = useUtils()
  const [configState] = useConfig()

  const statusLabel = (status) => {
    const found = ORDER_STATUS_KEYS.find(([key]) => key === status)
    return found ? t(found[1], found[2]) : ''
  }

  const distanceLabel = (distance) => {
    const meters = parseFloat(distance) || 0
    let unit = 'KM'
    if (configState?.configs?.distance_unit_km?.value === '1') unit = 'KM'
    if (configState?.configs?.distance_unit?.value) unit = configState.configs.distance_unit.value
    if (unit.toUpperCase() === 'MI') {
      return `${parseNumber(meters * 0.621371 / 1000)} ${t('MI', 'mi')}`
    }
    return `${parseNumber(meters / 1000)} ${t('KM', 'km')}`
  }

  const data = logisticInformation?.data
  const queues = Array.isArray(data?.queues) ? data.queues : []
  const attempts = Array.isArray(data?.logistic_attempts) ? data.logistic_attempts : []

  const toolbar = (
    <div className='odt-act-toolbar'>
      <Button variant='link' icon={ArrowLeft} onClick={onBack}>
        {t('BACK_TO_ACTIVITY', 'Back to activity')}
      </Button>
      <Button size='sm' icon={RotateCw} onClick={() => getLogistics()}>
        {t('RELOAD', 'Reload')}
      </Button>
    </div>
  )

  if (logisticInformation?.loading) {
    return (
      <>
        {toolbar}
        <ActivitySkeleton />
      </>
    )
  }

  if (logisticInformation?.error !== null && logisticInformation?.error !== undefined) {
    return (
      <>
        {toolbar}
        <EmptyState
          tone='error'
          icon={TriangleAlert}
          title={t('LOGISTIC_INFORMATION_ERROR', 'Couldn\'t load the logistics information')}
          description={[].concat(logisticInformation.error).filter(Boolean).join(' ') || undefined}
        />
      </>
    )
  }

  return (
    <>
      {toolbar}
      <section className='odt-info' aria-label={t('LOGISTIC_INFORMATION', 'Logistics information')}>
        <h3 className='odt-info-title'>{t('LOGISTIC_DISTANCE', 'Distance from customer to business')}</h3>
        <p className='odt-info-value'>{distanceLabel(data?.distance_customer_from_business)}</p>

        <h3 className='odt-info-title'>{t('QUEUES', 'Queues')}</h3>
        {queues.length === 0
          ? <p className='odt-info-muted'>{t('WITHOUT_QUEUES', 'Without queues')}</p>
          : queues.map((queue, index) => (
            <article key={queue.id} className='odt-info-card'>
              {queue.name && <h4 className='odt-info-card-title'>{index + 1}. {queue.name}</h4>}
              <dl className='odt-kv'>
                <dt>{t('AVAILABLE_DRIVERS', 'Available drivers')}</dt>
                <dd>{queue.drivers?.length ?? 0}</dd>
                <dt>{t('PRIORITY', 'Priority')}</dt>
                <dd>{queue.priority}</dd>
                <dt>{t('START_IN', 'Start in')}</dt>
                <dd>{statusLabel(queue.orders_group_start_in_status)}</dd>
              </dl>
              {queue.orders?.length > 0
                ? (
                  <ol className='odt-info-orders'>
                    {queue.orders.map((queued) => (
                      <li key={queued.id}>
                        <span className='odc-mono'>{queued.id}</span>
                        {queued?.waiting_for_preorder && <span className='odt-info-muted'> ({t('WAITING_FOR_PREORDER', 'waiting for preorder')})</span>}
                      </li>
                    ))}
                  </ol>
                  )
                : <p className='odt-info-muted'>{t('WITHOUT_ORDERS', 'Without orders')}</p>}
            </article>
          ))}

        <h3 className='odt-info-title'>{t('HISTORY_ATTEMPTS', 'Attempts history')}</h3>
        {attempts.length === 0
          ? <p className='odt-info-muted'>{t('WITHOUT_HISTORY_ATTEMPTS', 'Without history attempts')}</p>
          : (
            <ul className='odt-info-attempts'>
              {attempts.map((attempt) => (
                <li key={attempt.id}>
                  <strong>{t('DRIVER_GROUP', 'Driver group')}</strong> <span className='odc-mono'>{attempt?.driver_group_id}</span> {t('AT', 'at')} {figure(parseDate(attempt?.created_at))}
                </li>
              ))}
            </ul>
            )}
      </section>
    </>
  )
}

export const ActivityTab = (props) => {
  const order = props.order?.order
  const sharedMessages = useOrderMessages()
  const search = useLocation().search
  // inside a user's record `?tab=` is the record's section (staff: ?tab=orders): the filter lives in memory there
  const ownsUrl = !props.isSelectedOrders
  const tab = ownsUrl ? new URLSearchParams(search).get('tab') : null
  const writeTab = (value) => { if (ownsUrl) addQueryToUrl({ tab: value }) }
  const [mode, setMode] = useState(() => modeFromTab(tab))

  // The tab can also arrive from outside (the command palette, a deep link): follow it.
  useEffect(() => {
    if (!tab) return
    setMode(previous => {
      // The filter writes `order_history` for All, Status and Payments: those stay as they are. Arriving
      // from Logistics (the palette, a deep link) means the history alone.
      if (tab === TAB_HISTORY) return HISTORY_FAMILY.includes(previous) ? previous : MODE_HISTORY
      return modeFromTab(tab)
    })
  }, [tab])

  if (!order?.id) return null

  const handleFilterChange = (value) => {
    setMode(value)
    writeTab(tabFromMode(value))
  }
  const handleOpenInformation = () => {
    setMode('info')
    writeTab(TAB_INFORMATION)
  }
  const handleBack = () => {
    setMode('logistics')
    writeTab(TAB_LOGISTICS)
  }

  return (
    <div className='odc-root odt-activity'>
      {mode === 'info'
        ? (
          <LogisticInformationController
            orderId={order.id}
            UIComponent={InformationUI}
            onBack={handleBack}
          />
          )
        : (
          // The panel's one Messages controller (OrderMessages); on its own the tab asks for the messages itself.
            sharedMessages
              ? (
              <ActivityHistoryUI
                order={order}
                messages={sharedMessages.messages}
                getHistoryComment={sharedMessages.getHistoryComment}
                mode={mode}
                onFilterChange={handleFilterChange}
                onOpenInformation={handleOpenInformation}
              />
                )
              : (
              <MessagesController
                orderId={order.id}
                order={order}
                asDashboard
                UIComponent={ActivityHistoryUI}
                mode={mode}
                onFilterChange={handleFilterChange}
                onOpenInformation={handleOpenInformation}
              />
                ))}
    </div>
  )
}
