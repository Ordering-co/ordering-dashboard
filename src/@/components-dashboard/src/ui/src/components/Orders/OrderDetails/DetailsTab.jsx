import React, { useContext, useId } from 'react'
import moment from 'moment'
import { useLanguage, useUtils, useConfig, Messages as MessagesController } from '../../../../../index'
import { getCurrenySymbol, getOrderStatusPrefix, getUserType } from '../../../utils'
import { buildOrderRoute, getRouteFlow, getStatusStage, ROUTE_MILESTONES } from '../../../utils/orderRoute'
import { getOrderStatusFamily } from '../../../utils/orderStatusFamily'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'
import { OrderRoute } from '../../Shared/Product/OrderRoute'
import { Ban, CircleAlert, CircleCheck } from '../../Shared/Icon'
import { formatOrderEta, getOrderEta, getOrderEtaMoment, SLA_PARSE_OPTIONS } from '../OrdersTable/orderEta'
import { ProductItemAccordion } from '../ProductItemAccordion'
import { useOrderMessages } from './OrderMessages'
import { OrderBill } from '../OrderBill'
import { OrderContactInformation } from '../OrderContactInformation'
import './details-tab.css'

// Statuses whose reject reason the old status block already showed (kept as they were).
const REJECT_REASON_STATUSES = [6, 9, 10, 11, 12, 14]
const CATERING_TYPES = [7, 8]
const SPOT_TYPES = [3, 4]

const EmptyValue = ({ label }) => (
  <>
    <span aria-hidden='true'>—</span>
    <span className='odc-sr-only'>{label}</span>
  </>
)

// The route note is a plain string painted by OrderRoute, so the ETA inside it is isolated with Unicode isolates
// (LRI ... PDI): a right-to-left note keeps «date, time» in reading order instead of reordering the pieces.
const isolateLtr = (value) => `\u2066${value}\u2069`

// «25 min», «2 h», «1 h 30 min», «1 d» or «6 d 4 h»: a length of time, with no empty part.
const formatDuration = (minutes, t) => {
  const total = Math.abs(Number(minutes))
  if (total < 60) return t('DURATION_MINUTES', '_min_ min').replace('_min_', total)
  if (total < 1440) {
    const rest = total % 60
    const hours = Math.floor(total / 60)
    return rest === 0
      ? t('DURATION_HOURS', '_h_ h').replace('_h_', hours)
      : t('DURATION_HOURS_MINUTES', '_h_ h _min_ min').replace('_h_', hours).replace('_min_', rest)
  }
  const days = Math.floor(total / 1440)
  const hours = Math.floor((total % 1440) / 60)
  return hours === 0
    ? t('DURATION_DAYS', '_d_ d').replace('_d_', days)
    : t('DURATION_DAYS_HOURS', '_d_ d _h_ h').replace('_d_', days).replace('_h_', hours)
}

/**
 * The route of the order (C5), written from real data only (C16): each milestone is reached
 * according to the order status, and its time is the time of a real status change of the
 * history (messages of type 1 with `change.attribute === 'status'`). The history comes from the
 * `Messages` controller (the same GET /orders/:id/messages as the Activity tab); this component
 * only receives `messages`. A step that has no event has no time.
 */
const OrderRouteFromMessages = ({ order, messages }) => {
  const [{ dictionary }, t] = useLanguage()
  const [{ parseDate }] = useUtils()
  const [{ configs }] = useConfig()
  const configFileState = useContext(ConfigFileContext)
  const prefixForVariable = configFileState?.[0]?.app_internal_name?.toUpperCase()

  const status = parseInt(order?.status)
  const family = getOrderStatusFamily(status)
  const closed = family === 'done' || family === 'cancel'
  const formatTime = configs?.format_time?.value
  const timeFormat = String(formatTime) === '12' ? 'hh:mm A' : 'HH:mm'
  const loading = !!messages?.loading

  const placedDay = parseDate(order?.created_at, { outputFormat: 'YYYY-MM-DD' })
  // redesign F6d (Q3-15): the written time (for the screen reader and the notes) stays one string; `atParts` remembers its date
  // and time so the route can draw them as two fixed lines instead of letting «Oct 1, 12:53 PM» wrap anywhere.
  const atParts = new Map()
  // Hours only, the way the route reads; the date joins the hour when it is not the day the order was placed.
  const formatAt = (value) => {
    const time = parseDate(value, { outputFormat: timeFormat })
    if (parseDate(value, { outputFormat: 'YYYY-MM-DD' }) === placedDay) {
      atParts.set(time, { time })
      return time
    }
    // redesign W0-4a (T0-13, decision 13): the date part of the project's dates_general_format, without the year (as before: «Oct 1»).
    const date = parseDate(value, { dateOnly: true, omitYear: true })
    const text = `${date}, ${time}`
    atParts.set(text, { date, time })
    return text
  }

  const events = loading
    ? []
    : (messages?.messages ?? [])
        .filter(message => message?.type === 1 && message?.change?.attribute === 'status' && message?.created_at)
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
        .map(message => ({ status: Number(message.change.new), at: formatAt(message.created_at), createdAt: message.created_at }))
        .filter(event => Number.isFinite(event.status))

  const statusLabel = (code) => {
    const label = getOrderStatusPrefix(code, dictionary ?? {}, prefixForVariable)
    return typeof label === 'string' ? label : String(label)
  }

  const labels = {
    placed: t('ROUTE_PLACED', 'Placed'),
    accepted: t('ROUTE_ACCEPTED', 'Accepted'),
    ready: t('ROUTE_READY', 'Ready'),
    pickedUp: t('ROUTE_PICKED_UP', 'Picked up'),
    delivered: t('ROUTE_DELIVERED', 'Delivered'),
    collected: t('ROUTE_COLLECTED', 'Collected'),
    completed: t('ROUTE_COMPLETED', 'Completed')
  }

  const { steps } = buildOrderRoute({
    status,
    deliveryType: order?.delivery_type,
    placedAt: loading || !order?.created_at ? null : formatAt(order.created_at),
    events,
    labels,
    stopLabel: statusLabel(status)
  })

  // The route hands back the steps it draws (with a node as `at`); what is read out comes from the written ones.
  const describeStep = (drawn) => {
    const step = steps.find(item => item.key === drawn.key) ?? drawn
    switch (step.state) {
      case 'done':
        return step.at
          ? t('ROUTE_STEP_DONE_AT', '_step_, done at _time_').replace('_step_', step.label).replace('_time_', step.at)
          : t('ROUTE_STEP_DONE', '_step_, done').replace('_step_', step.label)
      case 'next':
        return t('ROUTE_STEP_NEXT', '_step_, next step').replace('_step_', step.label)
      case 'stop':
        return t('ROUTE_STEP_STOP', '_step_, the order stopped here').replace('_step_', step.label)
      default:
        return t('ROUTE_STEP_TODO', '_step_, not reached').replace('_step_', step.label)
    }
  }

  const reasonText = order?.reject_reason && (family === 'cancel' || REJECT_REASON_STATUSES.includes(status))
    ? t('ROUTE_NOTE_REASON', 'Reason: _reason_').replace('_reason_', t(`REJECT_REASON_${order.reject_reason.toUpperCase()}`, order.reject_reason.replace(/_/g, ' ')))
    : null

  // «Delivered 25 min late (ETA 11:30).»: the real time of the closing event against the estimate.
  // Without that event or without an estimate (or if the event is not after it) it only says «Late.».
  const getLateNote = () => {
    const flow = getRouteFlow(order?.delivery_type)
    const milestones = ROUTE_MILESTONES[flow]
    const closing = events.find(event => getStatusStage(event.status, flow) === milestones.length - 1)
    const eta = getOrderEta(order, { parseDate })
    if (!closing || !eta) return t('ROUTE_NOTE_LATE', 'Late.')
    const closedAt = moment(parseDate(closing.createdAt, { outputFormat: 'YYYY-MM-DD HH:mm:ss' }))
    const minutesLate = Math.floor(closedAt.diff(eta, 'seconds') / 60)
    const etaText = formatOrderEta(order, { parseDate, formatTime })
    if (!closedAt.isValid() || minutesLate < 1 || !etaText) return t('ROUTE_NOTE_LATE', 'Late.')
    return t('ROUTE_NOTE_LATE_BY', '_step_ _time_ late (ETA _eta_).')
      .replace('_step_', labels[milestones[milestones.length - 1]])
      .replace('_time_', formatDuration(minutesLate, t))
      .replace('_eta_', isolateLtr(etaText.date ? `${etaText.date}, ${etaText.time}` : etaText.time))
  }

  const getNote = () => {
    if (family === 'cancel') {
      const stop = steps.find(step => step.state === 'stop')
      const stopped = stop?.at
        ? t('ROUTE_NOTE_STOPPED', '_status_ at _time_.').replace('_status_', statusLabel(status)).replace('_time_', stop.at)
        : t('ROUTE_NOTE_STOPPED_NO_TIME', '_status_.').replace('_status_', statusLabel(status))
      return { tone: 'stop', icon: Ban, children: [stopped, reasonText].filter(Boolean).join(' ') }
    }
    if (closed) {
      // redesign fix-qa E6 (main: OrderDetails/index.js:489-498): a closed order of the "done" family can
      // carry a reject reason too (status 11), and it is shown after the timing note.
      const closedReason = REJECT_REASON_STATUSES.includes(status) ? reasonText : null
      const timing = order?.time_status === 'in_time'
        ? { tone: 'ok', icon: CircleCheck, children: t('ROUTE_NOTE_ON_TIME', 'Completed on time.') }
        : order?.time_status === 'delayed'
          ? { tone: 'late', icon: CircleAlert, children: getLateNote() }
          : null
      if (timing && closedReason) return { ...timing, children: `${timing.children} ${closedReason}` }
      if (timing) return timing
      return closedReason ? { tone: 'late', icon: CircleAlert, children: closedReason } : null
    }
    if (order?.time_status === 'delayed') {
      const remaining = Math.ceil(getOrderEtaMoment(order, parseDate, SLA_PARSE_OPTIONS).diff( // redesign tramo A r2 (W0-PA1-04)
        moment().utc(), 'seconds') / 60)
      const eta = formatOrderEta(order, { parseDate, formatTime })
      const delayed = remaining < 0 && eta
        ? t('ROUTE_NOTE_DELAYED_BY', 'Delayed _time_ past the estimated delivery time (_eta_).')
          .replace('_time_', formatDuration(remaining, t))
          .replace('_eta_', isolateLtr(eta.date ? `${eta.date}, ${eta.time}` : eta.time))
        : t('ROUTE_NOTE_DELAYED', 'Delayed past the estimated delivery time.')
      return { tone: 'late', icon: CircleAlert, children: [delayed, reasonText].filter(Boolean).join(' ') }
    }
    if (reasonText) return { tone: 'late', icon: CircleAlert, children: reasonText }
    return null
  }

  // The route draws `at` inside its own mono span; a node is fine there (the screen reader reads `describeStep`).
  const drawnSteps = steps.map(step => {
    const parts = typeof step.at === 'string' ? atParts.get(step.at) : null
    if (!parts) return step
    return {
      ...step,
      at: (
        <span className='odt-route-at'>
          {parts.date && <span className='odt-route-date odc-figure' dir='ltr'>{parts.date}</span>}
          <span className='odt-route-clock odc-figure' dir='ltr'>{parts.time}</span>
        </span>
      )
    }
  })

  return (
    <OrderRoute
      steps={drawnSteps}
      label={t('ORDER_PROGRESS', 'Order progress')}
      describeStep={describeStep}
      note={getNote()}
    />
  )
}

// redesign F6g-2: a date or a time is one left-to-right run, so a right-to-left page does not reorder it
const ltr = (value) => <bdi dir='ltr'>{value}</bdi>
// redesign W0-3a (T0-9, decisión 11a): a date or an hour is a figure: the same left-to-right run in mono with tabular digits.
// The class goes on the run, never on the `Fact` label beside it. IDs, plates and counts keep `ltr`.
const figure = (value) => <bdi dir='ltr' className='odc-figure'>{value}</bdi>
// redesign F6h-3 (A2-04): what the API sends (a spot, a model, a comment, a name) is its own run, in its own direction
const data = (value) => <bdi>{value}</bdi>

const Fact = ({ label, children, wide }) => (
  <div data-wide={wide ? '' : undefined}>
    <dt>{label}</dt>
    <dd>{children}</dd>
  </div>
)

/**
 * The Details tab of the order panel (batch 5.3): the route, the customer with the address in
 * view, business and driver, the items with the bill, and the logistics. It is a view over the
 * controller props of `OrderDetailsUI`; it fetches nothing by itself (the route reads the
 * history through the `Messages` controller). `onSelectTab(key)` sends the user to a sibling
 * tab (the message button of the customer goes to Chat).
 */
export const DetailsTab = (props) => {
  const {
    isServiceOrder,
    customerInfoState,
    handleChangeCustomerInfoState,
    handleUpdateCustomerInfo,
    addressState,
    setAddressState,
    isTourOpen,
    setCurrentTourStep,
    actionStatus,
    handleRefundPaymentsStripe,
    handleRefundPaymentsPlugin,
    getPluginRefundProvider,
    handleOrderRefund,
    commentInfoState,
    setCommentInfostate,
    disableSocketRoomDriver,
    forterPluginInstalled,
    onSelectTab
  } = props
  const { order } = props.order ?? {}
  const sharedMessages = useOrderMessages()

  const [, t] = useLanguage()
  const [{ parseDate }] = useUtils()
  const [{ configs }] = useConfig()
  const studentHeadingId = useId()
  const itemsHeadingId = useId()
  const logisticsHeadingId = useId()
  const detailsHeadingId = useId()
  const readOnlyBusinessOwner = !getUserType('viewOnlyBusinessOwner') && getUserType('readOnlyBusinessOwner')
  const readOnlyDeliveryManager = getUserType('readOnlyDeliveryManager')
  const readOnlyAdmin = getUserType('readOnlyAdmin')

  if (!order || Object.keys(order).length === 0) return null

  const getFraudLabel = (fraudStatus) => {
    switch (fraudStatus) {
      case 'valid': return t('FRAUD_APPROVED', 'Approved')
      case 'invalid': return t('FRAUD_DECLINED', 'Declined')
      case 'error': return t('FRAUD_FAIL_OPEN', 'Fail-open')
      default: return ''
    }
  }

  const getLogisticTag = (status) => {
    switch (parseInt(status)) {
      case 0: return t('PENDING', 'Pending')
      case 1: return t('IN_PROGRESS', 'In progress')
      case 2: return t('IN_QUEUE', 'In queue')
      case 3: return t('EXPIRED', 'Expired')
      case 4: return t('RESOLVED', 'Resolved')
      default: return t('UNKNOWN', 'Unknown')
    }
  }

  const getPriorityTag = (priority) => {
    switch (parseInt(priority)) {
      case -1: return t('LOW', 'Low')
      case 0: return t('NORMAL', 'Normal')
      case 1: return t('HIGH', 'High')
      case 2: return t('URGENT', 'Urgent')
      default: return t('UNKNOWN', 'Unknown')
    }
  }

  const SPOT_DICTIONARY = {
    3: t('SPOT_NUMBER_EAT_IN', 'Table number'),
    4: t('SPOT_NUMBER_CURBSIDE', 'Spot number'),
    5: t('SPOT_NUMBER_DRIVE_THRU', 'Drive thru lane')
  }

  const noData = t('NO_DATA', 'No data')
  const viewOnly = readOnlyAdmin || readOnlyDeliveryManager || readOnlyBusinessOwner
  const isCatering = CATERING_TYPES.includes(order?.delivery_type)
  const products = order?.products ?? []
  const eta = formatOrderEta(order, { parseDate, formatTime: configs?.format_time?.value })
  const student = order?.student

  const facts = []
  if (order?.cloned_order_id) {
    facts.push(<Fact key='cloned' label={t('CLONED_FROM_ORDER_NO', 'Cloned from order No')}>{ltr(order.cloned_order_id)}</Fact>)
  }
  if (isCatering && order?.created_at) {
    facts.push(<Fact key='created' label={t('CREATED_AT', 'Created at')}>{figure(parseDate(order.created_at))}</Fact>)
  }
  if (order?.delivery_datetime_utc) {
    // redesign fix-qa E6 (main: OrderDetails/index.js:435-440): catering orders say "Placed to"
    facts.push(
      <Fact key='requested' label={isCatering ? t('PLACED_TO', 'Placed to') : t('REQUESTED_FOR', 'Requested for')}>
        {figure(parseDate(order.delivery_datetime_utc))}
      </Fact>
    )
  }
  if (order?.delivery_datetime) {
    facts.push(<Fact key='business-time' label={t('BUSINESS_TIME', 'Business time')}>{figure(parseDate(order.delivery_datetime, { utc: false }))}</Fact>)
  }
  if (order?.delivery_type === 9 && order?.reservation) {
    facts.push(
      <Fact key='reservation' label={t('RESERVATION_SCHEDULED_TO', 'Reservation scheduled to')}>
        {figure(parseDate(order.reservation.reserve_date, { utc: false }))}
      </Fact>,
      <Fact key='guests' label={t('GUESTS', 'Guests')}>{order.reservation.guests_reservation}</Fact>
    )
  }
  if (order?.place && SPOT_TYPES.includes(order?.delivery_type)) {
    facts.push(<Fact key='place' label={t('SPOT', 'Spot')}>{data(order.place.name)}</Fact>)
  }
  if (order?.spot_number) {
    facts.push(<Fact key='spot-number' label={SPOT_DICTIONARY[order?.delivery_type] ?? t('SPOT', 'Spot')}>{order.spot_number}</Fact>)
  }
  if (order?.vehicle) {
    facts.push(
      <Fact key='vehicle-type' label={`${t('ORDER_VEHICLE', 'Vehicle')}: ${t('ORDER_VEHICLE_TYPE', 'Type')}`}>{t(order.vehicle.type?.toUpperCase(), order.vehicle.type)}</Fact>,
      <Fact key='vehicle-model' label={t('ORDER_VEHICLE_MODEL', 'Model')}>{data(order.vehicle.model)}</Fact>,
      <Fact key='vehicle-registration' label={t('ORDER_VEHICLE_CAR_REGISTRATION', 'Car registration')}>{ltr(order.vehicle.car_registration)}</Fact>,
      <Fact key='vehicle-color' label={t('ORDER_VEHICLE_COLOR', 'Color')}>{data(order.vehicle.color)}</Fact>
    )
  }
  if (order?.comment) {
    facts.push(<Fact key='comment' label={t('COMMENT', 'Comment')} wide><p className='odt-note'>{data(order.comment)}</p></Fact>)
  }

  return (
    <div className='odt-tab odc-root'>
      {forterPluginInstalled && order?.fraud_status && order?.fraud_status !== 'void' && (
        <div
          className='odt-notice'
          role='status'
          data-tone={['invalid', 'error'].includes(order.fraud_status) ? order.fraud_status : undefined}
        >
          <b>{t('FRAUD', 'Fraud')}: {getFraudLabel(order.fraud_status)}</b>
          {order.fraud_status === 'invalid' && order.fraud_message && <p>{order.fraud_message}</p>}
        </div>
      )}

      <div className='odt-route-block'>
        {/* The panel's one Messages controller (OrderMessages); on its own the tab asks for the messages itself. */}
        {sharedMessages
          ? <OrderRouteFromMessages order={order} messages={sharedMessages.messages} />
          : (
            <MessagesController
              asDashboard
              orderId={order.id}
              order={order}
              UIComponent={OrderRouteFromMessages}
            />
            )}
      </div>

      <OrderContactInformation
        disableSocketRoomDriver={disableSocketRoomDriver}
        isServiceOrder={isServiceOrder}
        customerInfoState={customerInfoState}
        handleChangeCustomerInfoState={handleChangeCustomerInfoState}
        handleUpdateCustomerInfo={handleUpdateCustomerInfo}
        order={order}
        isTourOpen={isTourOpen}
        setCurrentTourStep={setCurrentTourStep}
        setAddressState={setAddressState}
        setCommentInfostate={setCommentInfostate}
        commentInfoState={commentInfoState}
        addressState={addressState}
        onSelectTab={onSelectTab}
      />

      {student && (
        <section className='odt-sec' aria-labelledby={studentHeadingId}>
          <h3 id={studentHeadingId}>{t('SCHOOL_STUDENT', 'Student')}</h3>
          <dl className='odt-kv'>
            <Fact label={t('NAME', 'Name')}>{data([student.name, student.lastname].filter(Boolean).join(' '))}</Fact>
            {student.classroom?.name && <Fact label={t('SCHOOL_CLASSROOM', 'Classroom')}>{data(student.classroom.name)}</Fact>}
            {student.grade?.name && <Fact label={t('SCHOOL_GRADE', 'Grade')}>{data(student.grade.name)}</Fact>}
            {!!student.allergies?.length && <Fact label={t('SCHOOL_ALLERGIES', 'Allergies')} wide>{student.allergies.join(', ')}</Fact>}
            {!!student.dietary_tags?.length && <Fact label={t('SCHOOL_DIETARY_TAGS', 'Dietary tags')} wide>{student.dietary_tags.join(', ')}</Fact>}
          </dl>
        </section>
      )}

      {/* redesign fix-qa E6: main always drew the bill, so Refund to wallet is there even with no products, total or payments */}
      <section className='odt-sec' aria-labelledby={itemsHeadingId}>
        <h3 id={itemsHeadingId}>
          {products.length > 0
            ? (
              <>
                {t('ITEMS', 'Items')}
                <span className='odt-sec-count'>{products.length}</span>
              </>
              )
            : t('EXPORT_SUMMARY', 'Summary')}
        </h3>
        {products.length > 0 && (
          <ul className='odt-items'>
            {products.map((product) => (
              <ProductItemAccordion
                key={product.id}
                variant='compact'
                product={product}
                currency={getCurrenySymbol(order?.currency)}
                toppingsRemoved={order?.toppings_removed?.[product?.code]}
              />
            ))}
          </ul>
        )}
        <OrderBill
          variant='panel'
          order={order}
          actionStatus={actionStatus}
          handleRefundPaymentsStripe={handleRefundPaymentsStripe}
          handleRefundPaymentsPlugin={handleRefundPaymentsPlugin}
          getPluginRefundProvider={getPluginRefundProvider}
          handleOrderRefund={handleOrderRefund}
          viewOnly={viewOnly}
        />
      </section>

      {/* redesign fix-qa E6: main showed the logistic status, attempts, priority and estimate on every order */}
      <section className='odt-sec' aria-labelledby={logisticsHeadingId}>
        <h3 id={logisticsHeadingId}>{t('LOGISTICS', 'Logistics')}</h3>
        <dl className='odt-kv'>
          <Fact label={t('ORDER_LOGISTIC_STATUS', 'Logistic status')}>{getLogisticTag(order?.logistic_status)}</Fact>
          <Fact label={t('ATTEMPTS', 'Attempts')}>
            {order?.logistic_attemps ?? <EmptyValue label={noData} />}
          </Fact>
          <Fact label={t('PRIORITY', 'Priority')}>{getPriorityTag(order?.priority)}</Fact>
          <Fact label={t('CHANNEL', 'Channel')}>{order?.app_id || <EmptyValue label={noData} />}</Fact>
          <Fact label={t('ESTIMATED_TIME', 'Estimated time')}>
            {Number(order?.eta_time) > 0
              ? formatDuration(order.eta_time, t)
              : <EmptyValue label={noData} />}
          </Fact>
          <Fact label={t('ETA', 'ETA')}>
            {eta ? figure(eta.date ? `${eta.date}, ${eta.time}` : eta.time) : <EmptyValue label={noData} />}
          </Fact>
        </dl>
      </section>

      {facts.length > 0 && (
        <section className='odt-sec' aria-labelledby={detailsHeadingId}>
          <h3 id={detailsHeadingId}>{t('ORDER_FACTS', 'Order details')}</h3>
          <dl className='odt-kv'>{facts}</dl>
        </section>
      )}
    </div>
  )
}
