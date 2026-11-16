import { describe, expect, it } from 'vitest'

import { buildOrderRoute, getRouteFlow, getStatusStage } from '../orderRoute'

const labels = {
  placed: 'Placed',
  accepted: 'Accepted',
  ready: 'Ready',
  pickedUp: 'Picked up',
  delivered: 'Delivered',
  collected: 'Collected',
  completed: 'Completed'
}
const stopLabel = 'Stopped'

const keysOf = route => route.steps.map(step => step.key)
const statesOf = route => route.steps.map(step => step.state)

describe('getRouteFlow (C5: milestones by delivery type)', () => {
  it.each([
    [1, 'delivery'],
    [6, 'delivery'],
    [7, 'delivery'],
    [2, 'pickup'],
    [4, 'pickup'],
    [5, 'pickup'],
    [8, 'pickup'],
    [3, 'dinein'],
    [9, 'dinein']
  ])('delivery_type %i is the %s flow', (deliveryType, flow) => {
    expect(getRouteFlow(deliveryType)).toBe(flow)
  })

  it('reads a numeric string the same as the number', () => {
    expect(getRouteFlow('2')).toBe('pickup')
  })

  it.each([[0], [10], [99], [undefined], [null], ['x']])('gives an unknown type (%j) the dine-in flow, with no driver legs (C16)', deliveryType => {
    expect(getRouteFlow(deliveryType)).toBe('dinein')
  })

  it('builds the milestones of each flow', () => {
    const route = flow => keysOf(buildOrderRoute({ status: 0, deliveryType: flow, labels, stopLabel }))
    expect(route(1)).toEqual(['placed', 'accepted', 'ready', 'pickedUp', 'delivered'])
    expect(route(2)).toEqual(['placed', 'accepted', 'ready', 'collected'])
    expect(route(3)).toEqual(['placed', 'accepted', 'ready', 'completed'])
    expect(route(42)).toEqual(['placed', 'accepted', 'ready', 'completed'])
    expect(buildOrderRoute({ status: 0, deliveryType: 42, labels, stopLabel }).flow).toBe('dinein')
  })
})

describe('getStatusStage (milestone reached by status code)', () => {
  const CANCEL = [2, 5, 6, 10, 12, 16, 17]
  const DELIVERY = {
    0: 0, 1: 4, 3: 1, 4: 2, 7: 1, 8: 1, 9: 3, 11: 4, 13: 0, 14: 1, 15: 4, 18: 1, 19: 3, 20: 1, 21: 1, 22: 1, 23: 3, 24: 1, 25: 1, 26: 3
  }
  const PICKUP = {
    0: 0, 1: 3, 3: 1, 4: 2, 7: 1, 8: 1, 9: 2, 11: 3, 13: 0, 14: 1, 15: 3, 18: 1, 19: 2, 20: 1, 21: 1, 22: 1, 23: 2, 24: 1, 25: 1, 26: 2
  }

  it.each(Array.from({ length: 27 }, (_, status) => [status]))('status %i in delivery', status => {
    expect(getStatusStage(status, 'delivery')).toBe(CANCEL.includes(status) ? null : DELIVERY[status])
  })

  it.each(Array.from({ length: 27 }, (_, status) => [status]))('status %i in pickup', status => {
    expect(getStatusStage(status, 'pickup')).toBe(CANCEL.includes(status) ? null : PICKUP[status])
  })

  it('treats the dine-in flow like pickup (ready is 2, the last milestone is 3)', () => {
    expect(getStatusStage(9, 'dinein')).toBe(2)
    expect(getStatusStage(11, 'dinein')).toBe(3)
  })

  it('has no stage of its own for the cancel family or an unknown code', () => {
    CANCEL.forEach(status => expect(getStatusStage(status, 'delivery')).toBeNull())
    expect(getStatusStage(99, 'delivery')).toBeNull()
  })
})

describe('buildOrderRoute', () => {
  it('highlights the NEXT milestone, not the last completed one (C5)', () => {
    const route = buildOrderRoute({ status: 4, deliveryType: 1, placedAt: '15:51', labels, stopLabel })
    expect(statesOf(route)).toEqual(['done', 'done', 'done', 'next', 'todo'])
    expect(route.steps[3]).toMatchObject({ key: 'pickedUp', label: 'Picked up' })
  })

  it('uses the labels it is given and has no copy of its own', () => {
    const route = buildOrderRoute({ status: 0, deliveryType: 1, labels: { placed: 'Creada', accepted: 'Aceptada', ready: 'Lista', pickedUp: 'Recogida', delivered: 'Entregada' }, stopLabel: 'Parada' })
    expect(route.steps.map(step => step.label)).toEqual(['Creada', 'Aceptada', 'Lista', 'Recogida', 'Entregada'])
  })

  it('a pending order has only the first milestone done and acceptance next', () => {
    const route = buildOrderRoute({ status: 0, deliveryType: 2, placedAt: '15:51', labels, stopLabel })
    expect(statesOf(route)).toEqual(['done', 'next', 'todo', 'todo'])
    expect(route.steps[0].at).toBe('15:51')
  })

  it('a delivered order is all done, with no next milestone', () => {
    const events = [
      { status: 7, at: '15:58' },
      { status: 4, at: '16:20' },
      { status: 9, at: '16:31' },
      { status: 11, at: '16:51' }
    ]
    const route = buildOrderRoute({ status: 11, deliveryType: 1, placedAt: '15:51', events, labels, stopLabel })
    expect(statesOf(route)).toEqual(['done', 'done', 'done', 'done', 'done'])
    expect(route.steps.map(step => step.at)).toEqual(['15:51', '15:58', '16:20', '16:31', '16:51'])
  })

  it.each([[15], [1]])('a closed order in status %i is all done on the pickup flow', status => {
    const route = buildOrderRoute({ status, deliveryType: 2, labels, stopLabel })
    expect(statesOf(route)).toEqual(['done', 'done', 'done', 'done'])
  })

  it('takes each time from the first event that reached the milestone, and the first from placedAt', () => {
    const events = [
      { status: 7, at: '15:58' },
      { status: 14, at: '16:05' },
      { status: 4, at: '16:20' },
      { status: 4, at: '16:25' }
    ]
    const route = buildOrderRoute({ status: 4, deliveryType: 1, placedAt: '15:51', events, labels, stopLabel })
    expect(route.steps.map(step => step.at)).toEqual(['15:51', '15:58', '16:20', null, null])
  })

  it('never invents a time: a milestone with no event has at null', () => {
    const route = buildOrderRoute({ status: 4, deliveryType: 1, placedAt: '15:51', labels, stopLabel })
    expect(route.steps.map(step => step.at)).toEqual(['15:51', null, null, null, null])
    const noPlaced = buildOrderRoute({ status: 0, deliveryType: 1, labels, stopLabel })
    expect(noPlaced.steps[0].at).toBeNull()
  })

  it('a cancelled order stops where it got to, with the stop step and no later milestones', () => {
    const events = [
      { status: 7, at: '04:10' },
      { status: 5, at: '04:12' }
    ]
    const route = buildOrderRoute({ status: 5, deliveryType: 1, placedAt: '04:08', events, labels, stopLabel })
    expect(keysOf(route)).toEqual(['placed', 'accepted', 'stop'])
    expect(statesOf(route)).toEqual(['done', 'done', 'stop'])
    expect(route.steps[2]).toEqual({ key: 'stop', label: 'Stopped', state: 'stop', at: '04:12' })
    expect(route.steps.map(step => step.at)).toEqual(['04:08', '04:10', '04:12'])
  })

  it('a cancelled order with no events stops right after the first milestone, with no time', () => {
    const route = buildOrderRoute({ status: 16, deliveryType: 2, placedAt: '10:00', labels, stopLabel })
    expect(keysOf(route)).toEqual(['placed', 'stop'])
    expect(route.steps[1]).toEqual({ key: 'stop', label: 'Stopped', state: 'stop', at: null })
  })

  it('a cancelled order after preparation keeps the milestones it reached', () => {
    const events = [
      { status: 7, at: '12:01' },
      { status: 4, at: '12:20' },
      { status: 17, at: '12:50' }
    ]
    const route = buildOrderRoute({ status: 17, deliveryType: 2, placedAt: '11:56', events, labels, stopLabel })
    expect(keysOf(route)).toEqual(['placed', 'accepted', 'ready', 'stop'])
    expect(statesOf(route)).toEqual(['done', 'done', 'done', 'stop'])
  })

  it('a step back (status 14) puts the next milestone where the status says', () => {
    const regress = buildOrderRoute({ status: 14, deliveryType: 1, placedAt: '15:51', labels, stopLabel })
    expect(statesOf(regress)).toEqual(['done', 'done', 'next', 'todo', 'todo'])
  })

  it('reads a numeric string status like the number', () => {
    const route = buildOrderRoute({ status: '4', deliveryType: '1', labels, stopLabel })
    expect(statesOf(route)).toEqual(['done', 'done', 'done', 'next', 'todo'])
  })

  it('an unknown status code falls back to the events, not to done', () => {
    const route = buildOrderRoute({ status: 99, deliveryType: 1, placedAt: '15:51', events: [{ status: 7, at: '15:58' }], labels, stopLabel })
    expect(statesOf(route)).toEqual(['done', 'done', 'next', 'todo', 'todo'])
  })
})

describe('buildOrderRoute — times are never borrowed (C16)', () => {
  it('leaves a skipped milestone done with no time instead of the time of a later event', () => {
    const { steps } = buildOrderRoute({
      status: 11,
      deliveryType: 1,
      placedAt: '15:51',
      events: [{ status: 7, at: '15:58' }, { status: 9, at: '16:31' }, { status: 11, at: '16:51' }],
      labels
    })
    expect(steps.map(step => [step.key, step.state, step.at])).toEqual([
      ['placed', 'done', '15:51'],
      ['accepted', 'done', '15:58'],
      ['ready', 'done', null],
      ['pickedUp', 'done', '16:31'],
      ['delivered', 'done', '16:51']
    ])
  })

  it('gives no time to the next or later milestones, even after a step back', () => {
    const { steps } = buildOrderRoute({
      status: 14,
      deliveryType: 1,
      placedAt: '08:20',
      events: [{ status: 7, at: '08:26' }, { status: 4, at: '08:40' }, { status: 14, at: '08:44' }],
      labels
    })
    expect(steps.map(step => [step.key, step.state, step.at])).toEqual([
      ['placed', 'done', '08:20'],
      ['accepted', 'done', '08:26'],
      ['ready', 'next', null],
      ['pickedUp', 'todo', null],
      ['delivered', 'todo', null]
    ])
  })
})
