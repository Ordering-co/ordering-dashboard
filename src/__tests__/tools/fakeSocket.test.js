// redesign W0-9c (T0-38)
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createSession,
  decodePacket,
  encodeAck,
  encodeConnect,
  encodeConnectError,
  encodeEvent,
  encodeOpen,
  fakeBuildChange,
  fakeDriverChanges,
  fakeDriverLocations,
  fakeDriverUpdate,
  fakeMessage,
  fakeOrder,
  fakeOrderUpdate,
  fakeSiteUpdate,
  messageRecord,
  roomKey,
  utcStamp,
  EVENT_CONTRACT,
  MESSAGE_RECORD_KEYS
} from '../../../scripts/redesign/tools/fake-socket.mjs'

const connect = (session, frame = '40') => session.handle(frame)

describe('fake socket: packets', () => {
  it('encodes the Engine.IO open packet with the fields the client reads', () => {
    const frame = encodeOpen({ sid: 'abc', pingInterval: 1000, pingTimeout: 2000, maxPayload: 5 })
    expect(frame[0]).toBe('0')
    expect(JSON.parse(frame.slice(1))).toEqual({ sid: 'abc', upgrades: [], pingInterval: 1000, pingTimeout: 2000, maxPayload: 5 })
  })

  it('encodes connect, connect error, event and ack frames', () => {
    expect(encodeConnect('s1')).toBe('40{"sid":"s1"}')
    expect(encodeConnect('s1', '/admin')).toBe('40/admin,{"sid":"s1"}')
    expect(encodeConnectError('nope')).toBe('44{"message":"nope"}')
    expect(encodeEvent('update_order', [{ id: 1 }])).toBe('42["update_order",{"id":1}]')
    expect(encodeEvent('update_order', [{ id: 1 }], { id: 7 })).toBe('427["update_order",{"id":1}]')
    expect(encodeEvent('x', [], { nsp: '/admin' })).toBe('42/admin,["x"]')
    expect(encodeAck(7, ['ok'])).toBe('437["ok"]')
  })

  it('decodes what it encodes', () => {
    expect(decodePacket('42["join","orders_9"]')).toEqual({ kind: 'event', nsp: '/', id: undefined, data: ['join', 'orders_9'] })
    expect(decodePacket('4213["join",{"room":"drivers"}]')).toEqual({ kind: 'event', nsp: '/', id: 13, data: ['join', { room: 'drivers' }] })
    expect(decodePacket('42/admin,["x",1]')).toEqual({ kind: 'event', nsp: '/admin', id: undefined, data: ['x', 1] })
    expect(decodePacket('40')).toEqual({ kind: 'connect', nsp: '/', id: undefined, data: undefined })
    expect(decodePacket('40{"token":"t"}').data).toEqual({ token: 't' })
    expect(decodePacket('41')).toMatchObject({ kind: 'disconnect', nsp: '/' })
    expect(decodePacket('2')).toMatchObject({ kind: 'ping' })
    expect(decodePacket('3')).toMatchObject({ kind: 'pong' })
    expect(decodePacket('1')).toEqual({ kind: 'close' })
  })

  it('refuses frames it cannot read instead of guessing', () => {
    for (const raw of ['', 'x', '4', '49', '42{not json', '42{"a":1}', 7, null]) {
      expect(decodePacket(raw).kind, String(raw)).toBe('invalid')
    }
  })
})

describe('fake socket: session', () => {
  it('opens with the Engine.IO open packet', () => {
    const [open] = createSession({ sid: 'abc' }).open()
    expect(open.startsWith('0{')).toBe(true)
    expect(JSON.parse(open.slice(1)).sid).toBe('abc')
  })

  it('needs a sid', () => {
    expect(() => createSession()).toThrow(/sid/)
  })

  it('answers 40 with 40{sid} and marks the namespace connected', () => {
    const session = createSession({ sid: 'abc' })
    const out = connect(session)
    expect(out.connected).toBe(true)
    expect(out.send).toHaveLength(1)
    expect(out.send[0]).toMatch(/^40\{"sid":"[^"]+"\}$/)
    expect(session.state.connected).toBe(true)
  })

  it('also accepts the connect packet with an auth payload', () => {
    const session = createSession({ sid: 'abc' })
    expect(connect(session, '40{"token":"t"}').connected).toBe(true)
    expect(session.state.auth).toEqual({ token: 't' })
  })

  it('refuses a namespace it does not have, as a real server does', () => {
    const session = createSession({ sid: 'abc' })
    const out = connect(session, '40/other,')
    expect(out.send).toEqual(['44/other,{"message":"Invalid namespace"}'])
    expect(session.state.connected).toBe(false)
  })

  it('answers a client ping with a pong and keeps the payload (probe)', () => {
    const session = createSession({ sid: 'abc' })
    expect(session.handle('2').send).toEqual(['3'])
    expect(session.handle('2probe').send).toEqual(['3probe'])
  })

  it('ignores a pong, and events before the namespace is connected', () => {
    const session = createSession({ sid: 'abc' })
    expect(session.handle('3')).toMatchObject({ send: [], events: [] })
    expect(session.handle('42["join","orders"]').events).toEqual([])
    expect(session.state.rooms.size).toBe(0)
  })

  it('records the events the client emits', () => {
    const session = createSession({ sid: 'abc' })
    connect(session)
    const out = session.handle('42["hello",{"a":1},2]')
    expect(out.events).toEqual([{ event: 'hello', args: [{ a: 1 }, 2] }])
  })

  it('acks an event that carries an id', () => {
    const session = createSession({ sid: 'abc' })
    connect(session)
    expect(session.handle('425["hello"]').send).toEqual(['435[]'])
  })

  it('tracks rooms the way the app names them: strings and objects, once each', () => {
    const session = createSession({ sid: 'abc' })
    connect(session)
    const manager = { room: 'orders', user_id: 4, role: 'manager', project: 'p' }
    expect(session.handle(`42["join",${JSON.stringify(manager)}]`).joined).toEqual([manager])
    expect(session.handle('42["join","p_orders_4"]').joined).toEqual(['p_orders_4'])
    // the same room with the keys in another order is the same room
    expect(session.handle('42["join",{"project":"p","role":"manager","user_id":4,"room":"orders"}]').joined).toEqual([])
    expect([...session.state.rooms.values()]).toEqual([manager, 'p_orders_4'])
    expect(session.handle('42["leave","p_orders_4"]').left).toEqual(['p_orders_4'])
    expect(session.handle('42["leave","p_orders_4"]').left).toEqual([])
    expect([...session.state.rooms.values()]).toEqual([manager])
  })

  it('forgets the rooms when the client disconnects the namespace or closes', () => {
    const session = createSession({ sid: 'abc' })
    connect(session)
    session.handle('42["join","r"]')
    session.handle('41')
    expect(session.state.connected).toBe(false)
    expect(session.state.rooms.size).toBe(0)
    expect(session.handle('1').closed).toBe(true)
  })

  it('roomKey is the same for the same object in any key order', () => {
    expect(roomKey({ a: 1, b: 2 })).toBe(roomKey({ b: 2, a: 1 }))
    expect(roomKey('x')).toBe('x')
    expect(roomKey({ a: 1 })).not.toBe(roomKey('a'))
  })
})

describe('fake socket: payload factories', () => {
  it('has a contract for every event the dashboard listens to', () => {
    expect(Object.keys(EVENT_CONTRACT).sort()).toEqual([
      'app_build_change', 'batch_driver_changes', 'batch_driver_locations', 'drivers_update',
      'message', 'orders_register', 'sites_update', 'update_order'
    ])
  })

  it('fakeOrder carries what the list and the panel read, and takes overrides', () => {
    const order = fakeOrder({ id: 5, status: 3, customer_id: 9 })
    expect(order).toMatchObject({ id: 5, status: 3, customer_id: 9, delivery_type: 1, unread_count: 0 })
    expect(order.customer.name).toBeTruthy()
    expect(order.business.name).toBeTruthy()
    expect(order.summary.total).toBeGreaterThan(0)
    expect(Array.isArray(order.products)).toBe(true)
  })

  it('fakeOrderUpdate is a partial order whose history carries the status change as an array', () => {
    const update = fakeOrderUpdate({ id: 5, from: 0, to: 7 })
    expect(update.id).toBe(5)
    expect(update.status).toBe(7) // the handlers return early when status is undefined
    expect(update.history[0].data).toEqual([{ attribute: 'status', old: 0, new: 7 }])
    expect(update).not.toHaveProperty('customer')
  })

  it('fakeMessage matches both ways the listeners read the order and the author level', () => {
    const message = fakeMessage({ orderId: 5, type: 2, level: 0 })
    expect(message.order).toEqual({ id: 5 })
    expect(message.order_id).toBe(5)
    expect(message.type).toBe(2)
    expect(message.author.level).toBe(0)
    expect(fakeMessage().author.level).not.toBe(0)
  })
})

// redesign B1c (W1-QB1-07): the chat draws `message.can_see.includes(...)`, `message.author.name`, `message.author_id` and
// `getTimeAgo(message.created_at)` of every message it receives; a message without them does not render "incomplete", it
// makes the whole route fall to the error boundary. These tests read the message the way the chat does.
describe('fake socket: fakeMessage has the API\'s shape (W1-QB1-07)', () => {
  afterEach(() => { vi.useRealTimers() })
  const UTC = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/

  it.each([
    ['customer, direct', { type: 2, level: 3 }],
    ['staff, direct', { type: 2, level: 0 }],
    ['customer, general', { type: 1, level: 3 }],
    ['customer, image', { type: 3, level: 3, source: 'https://example.invalid/a.png' }]
  ])('%s carries every key of the API\'s message', (_, options) => {
    const message = fakeMessage({ orderId: 5, ...options })
    for (const key of MESSAGE_RECORD_KEYS) expect(message, key).toHaveProperty(key)
    // what the chat reads, the way it reads it
    expect(() => [2, 3, 4].map(level => message.can_see.includes(level))).not.toThrow()
    expect(`${message.author.name} ${message.author.lastname}`).toMatch(/\S/)
    expect(Number.isInteger(message.author.id)).toBe(true)
    expect(message.author_id).toBe(message.author.id)
    expect(message.created_at).toMatch(UTC)
    expect(message.updated_at).toMatch(UTC)
  })

  it('can_see is a string of levels, like the API\'s, and the chat\'s includes(2) finds the business in it', () => {
    expect(fakeMessage().can_see).toBe('3,0,2')
    expect(typeof fakeMessage().can_see).toBe('string')
    expect(fakeMessage().can_see.includes(2)).toBe(true)
    expect(fakeMessage().can_see.includes(4)).toBe(false)
    expect(fakeMessage({ canSee: [3, 4] }).can_see).toBe('3,4')
    expect(fakeMessage({ can_see: '3' }).can_see).toBe('3')
  })

  it('created_at is now in UTC (a fixed date would hide every time-zone defect of the relative hours)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-08T03:04:05.678Z'))
    expect(fakeMessage().created_at).toBe('2026-10-08 03:04:05')
    expect(fakeMessage().updated_at).toBe('2026-10-08 03:04:05')
    expect(fakeMessage({ createdAt: Date.UTC(2026, 0, 2, 3, 4, 5) }).created_at).toBe('2026-01-02 03:04:05')
    expect(fakeMessage({ createdAt: '2020-02-03 04:05:06' }).created_at).toBe('2020-02-03 04:05:06')
    expect(utcStamp(Date.UTC(2026, 11, 31, 23, 59, 59))).toBe('2026-12-31 23:59:59')
  })

  it('the author follows the level, and author_id follows the author', () => {
    expect(fakeMessage({ level: 0 }).author).toMatchObject({ id: 1, level: 0 })
    expect(fakeMessage({ level: 0 }).author_id).toBe(1)
    expect(fakeMessage({ level: 3 }).author).toMatchObject({ id: 961001, level: 3 })
    expect(fakeMessage({ level: 4 }).author.level).toBe(4)
    const other = fakeMessage({ level: 0, author: { id: 77, name: 'Else', lastname: 'Staff', level: 0 } })
    expect(other.author_id).toBe(77)
    expect(fakeMessage({ author_id: 5 }).author_id).toBe(5)
  })

  it('the unread flag is false by default and the image of a type 3 goes in source', () => {
    expect(fakeMessage().read).toBe(false)
    expect(fakeMessage({ type: 3, source: 'https://example.invalid/a.png' }).source).toBe('https://example.invalid/a.png')
    expect(fakeMessage().source).toBe(null)
  })

  it('messageRecord is the shape without the socket-only `order`', () => {
    const record = messageRecord({ id: 7, orderId: 9, type: 2, comment: 'x' })
    expect(Object.keys(record).sort()).toEqual([...MESSAGE_RECORD_KEYS].sort())
    expect(record).toMatchObject({ id: 7, order_id: 9, type: 2, comment: 'x' })
    expect(record).not.toHaveProperty('order')
  })

  it('the message contract says what the chat needs', () => {
    expect(EVENT_CONTRACT.message.reads).toMatch(/can_see/)
    expect(EVENT_CONTRACT.message.reads).toMatch(/author_id/)
    expect(EVENT_CONTRACT.message.reads).toMatch(/created_at/)
  })
})

describe('fake socket: other payload factories', () => {
  it('fakeDriverLocations and fakeDriverChanges have the batch shapes', () => {
    expect(fakeDriverLocations([{ driver_id: 1, lat: 1.5, lng: 2.5 }])).toEqual([{ driver_id: 1, location: { lat: 1.5, lng: 2.5 } }])
    expect(fakeDriverChanges([
      { driver_id: 1, attribute: 'available', old: true, new: false },
      { driver_id: 1, attribute: 'busy', old: false, new: true },
      { driver_id: 2, attribute: 'enabled', old: true, new: false }
    ])).toEqual([
      { driver_id: 1, changes: [{ attribute: 'available', old: true, new: false }, { attribute: 'busy', old: false, new: true }] },
      { driver_id: 2, changes: [{ attribute: 'enabled', old: true, new: false }] }
    ])
  })

  it('fakeDriverUpdate, fakeSiteUpdate and fakeBuildChange have the shapes the listeners read', () => {
    expect(fakeDriverUpdate({ id: 3, available: true })).toEqual({ id: 3, enabled: true, available: true, busy: false })
    expect(fakeSiteUpdate({ id: 8, name: 'New' })).toEqual({ id: 8, name: 'New' })
    expect(fakeBuildChange({ builderAppId: 4, platform: 'ios', new: 'failed' })).toEqual({
      builder_app_id: 4, platform: 'ios', changes: [{ attribute: 'status', old: 'pending', new: 'failed' }]
    })
  })
})
