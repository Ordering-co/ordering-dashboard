import { getOrderStatusFamily } from './orderStatusFamily'

/**
 * The route of an order (C5): the real milestones of its flow, with the times
 * it really reached them. Domain logic only; it has no copy (the caller passes
 * `labels`) and it never invents a time (C16): a milestone with no event has
 * `at: null`.
 *
 * Flows by `delivery_type`:
 *  delivery  1, 6, 7        placed, accepted, ready, pickedUp, delivered
 *  pickup    2, 4, 5, 8     placed, accepted, ready, collected
 *  dinein    3, 9, unknown  placed, accepted, ready, completed
 * An unknown type gets the shortest flow: it is not given driver legs it may
 * not have.
 */
export const ROUTE_MILESTONES = {
  delivery: ['placed', 'accepted', 'ready', 'pickedUp', 'delivered'],
  pickup: ['placed', 'accepted', 'ready', 'collected'],
  dinein: ['placed', 'accepted', 'ready', 'completed']
}

const FLOW_BY_DELIVERY_TYPE = new Map([
  [1, 'delivery'], [6, 'delivery'], [7, 'delivery'],
  [2, 'pickup'], [4, 'pickup'], [5, 'pickup'], [8, 'pickup'],
  [3, 'dinein'], [9, 'dinein']
])

/** Name of the flow of a delivery type: 'delivery', 'pickup' or 'dinein'. */
export const getRouteFlow = deliveryType => FLOW_BY_DELIVERY_TYPE.get(Number(deliveryType)) ?? 'dinein'

const FIXED_STAGE = new Map([
  [0, 0], [13, 0],
  [7, 1], [8, 1], [25, 1], [22, 1], [24, 1], [14, 1], [18, 1], [3, 1], [20, 1], [21, 1],
  [4, 2]
])
// Picked up by the driver (9) or about to / arrived at the customer (23, 19, 26).
const PICKED_UP_STATUSES = new Set([9, 23, 19, 26])
const COMPLETED_STATUSES = new Set([11, 15, 1])

/**
 * Index of the milestone an order status has reached in a flow. `null` for the
 * cancel family (it has no stage of its own: it stops where the events say) and
 * for a code that is not an order status.
 */
export const getStatusStage = (status, flow) => {
  const keys = ROUTE_MILESTONES[flow] ?? ROUTE_MILESTONES.dinein
  const code = Number(status)
  if (COMPLETED_STATUSES.has(code)) return keys.length - 1
  // `ready` is index 2 in every flow; only delivery has a milestone after it before the end.
  if (PICKED_UP_STATUSES.has(code)) return Math.min(3, keys.length - 2)
  return FIXED_STAGE.get(code) ?? null
}

const isCancel = status => getOrderStatusFamily(status) === 'cancel'

/**
 * Builds the steps of an order's route.
 *
 * @param {object} order
 * @param {number} order.status        order status code
 * @param {number} order.deliveryType  delivery_type
 * @param {*} order.placedAt           time of the first milestone (passed through, not formatted)
 * @param {{status:number, at:*}[]} [order.events]  real status changes, chronological
 * @param {object} order.labels        text of every milestone key; the utility has no copy
 * @param {string} order.stopLabel     text of the stop step of a cancelled order
 * @returns {{ flow: string, steps: {key:string, label:string, state:string, at:*}[] }}
 */
export const buildOrderRoute = ({ status, deliveryType, placedAt, events = [], labels = {}, stopLabel }) => {
  const flow = getRouteFlow(deliveryType)
  const keys = ROUTE_MILESTONES[flow]
  const last = keys.length - 1

  const staged = events
    .map(event => ({ ...event, stage: getStatusStage(event.status, flow) }))
    .filter(event => event.stage !== null)
  const reachedByEvents = staged.reduce((max, event) => Math.max(max, event.stage), 0)

  // A milestone takes the time of the first event that reached exactly that
  // milestone. A milestone the order skipped (accepted → picked up) is done with
  // no time, and only a done step shows a time: it never borrows a later or an
  // undone one (C16).
  const timeOf = index => {
    if (index === 0) return placedAt ?? null
    const event = staged.find(candidate => candidate.stage === index)
    return event?.at ?? null
  }
  const stepAt = (key, index, state) => ({ key, label: labels[key], state, at: state === 'done' ? timeOf(index) : null })

  if (isCancel(status)) {
    const cancelEvent = [...events].reverse().find(event => Number(event.status) === Number(status)) ??
      [...events].reverse().find(event => isCancel(event.status))
    return {
      flow,
      steps: [
        ...keys.slice(0, reachedByEvents + 1).map((key, index) => stepAt(key, index, 'done')),
        { key: 'stop', label: stopLabel, state: 'stop', at: cancelEvent?.at ?? null }
      ]
    }
  }

  const stage = getStatusStage(status, flow) ?? reachedByEvents
  const closed = stage === last
  return {
    flow,
    steps: keys.map((key, index) => {
      let state = 'todo'
      if (index <= stage) state = 'done'
      else if (!closed && index === stage + 1) state = 'next'
      return stepAt(key, index, state)
    })
  }
}
