// redesign W0-9c (T0-38)
// A fake realtime server for the live review session, so the controllers' socket listeners can be seen working.
//
// How the dashboard connects (src/@/components-dashboard/src/contexts/WebsocketContext/socket.js:12-17):
// socket.io-client 4.x (Engine.IO v4), `transports: ['websocket']` only, so there is never an HTTP polling
// phase to answer: the whole conversation is one WebSocket, which Playwright's `routeWebSocket` serves without
// touching the network. The token and project travel in the query string of that WebSocket URL; the
// namespace is the default `/`. The URL comes from `__CONFIG__.socket.url` (WebsocketContext/index.js:25, and
// OrderingContext/index.js:40): while it is empty the provider never connects, which is why the session left it
// blank.
//
// Wire format (Engine.IO v4 + socket.io v5 protocol, text frames only, no binary attachments):
//   server -> client  0{"sid","upgrades":[],"pingInterval","pingTimeout","maxPayload"}   open
//   client -> server  40            (or 40{auth})                                        connect to namespace /
//   server -> client  40{"sid"}                                                          namespace connected
//   either way        42["event", payload]       event;   42<id>[...] asks an ack, answered with 43<id>[...]
//   server -> client  2   ping every pingInterval;  client -> server 3  pong
//   client -> server  41   leave the namespace
//
// The pure pieces (encode*/decodePacket/createSession) are pinned by src/__tests__/tools/fakeSocket.test.js; the
// real client against this server by scripts/redesign/tools/fake-socket.check.mjs.

export const ENGINE = { OPEN: '0', CLOSE: '1', PING: '2', PONG: '3', MESSAGE: '4', UPGRADE: '5', NOOP: '6' }
export const SOCKET = { CONNECT: 0, DISCONNECT: 1, EVENT: 2, ACK: 3, CONNECT_ERROR: 4 }
export const DEFAULT_URL = 'https://fake-socket.invalid'
export const DEFAULTS = { pingInterval: 25000, pingTimeout: 20000, maxPayload: 1000000 }

const nspPrefix = nsp => (nsp && nsp !== '/' ? `${nsp},` : '')

/** `0{...}`: the Engine.IO open packet, the first thing a client hears. */
export const encodeOpen = ({ sid, pingInterval = DEFAULTS.pingInterval, pingTimeout = DEFAULTS.pingTimeout, maxPayload = DEFAULTS.maxPayload }) =>
  `${ENGINE.OPEN}${JSON.stringify({ sid, upgrades: [], pingInterval, pingTimeout, maxPayload })}`

/** `40{"sid"}`: the namespace connect acknowledgement. */
export const encodeConnect = (sid, nsp = '/') => `${ENGINE.MESSAGE}${SOCKET.CONNECT}${nspPrefix(nsp)}${JSON.stringify({ sid })}`

/** `44{"message"}`: what a real server answers to a namespace it does not have. */
export const encodeConnectError = (message, nsp = '/') => `${ENGINE.MESSAGE}${SOCKET.CONNECT_ERROR}${nspPrefix(nsp)}${JSON.stringify({ message })}`

/** `42["event", ...args]`, or `42<id>[...]` when the sender wants an ack. */
export const encodeEvent = (event, args = [], { nsp = '/', id } = {}) =>
  `${ENGINE.MESSAGE}${SOCKET.EVENT}${nspPrefix(nsp)}${id === undefined ? '' : id}${JSON.stringify([event, ...args])}`

/** `43<id>[...]`: the answer to an event that carried an id. */
export const encodeAck = (id, args = [], nsp = '/') => `${ENGINE.MESSAGE}${SOCKET.ACK}${nspPrefix(nsp)}${id}${JSON.stringify(args)}`

export const encodePing = () => ENGINE.PING
const encodeDisconnectFrame = () => `${ENGINE.MESSAGE}${SOCKET.DISCONNECT}`
export const encodePong = () => ENGINE.PONG

/**
 * Decode one text frame. Returns `{ kind, ... }`:
 *   engine packets: open | close | ping | pong | upgrade | noop
 *   socket.io packets (inside Engine.IO `message`): connect | disconnect | event | ack | connect_error
 *     with `{ nsp, id, data }` (`data` is the parsed JSON: an array for event/ack, an object for connect).
 * Anything it cannot read is `{ kind: 'invalid', raw }`; binary attachments (types 5 and 6) are not spoken.
 */
export function decodePacket (raw) {
  if (typeof raw !== 'string' || raw.length === 0) return { kind: 'invalid', raw }
  const engine = raw[0]
  const rest = raw.slice(1)
  switch (engine) {
    case ENGINE.OPEN: return { kind: 'open', data: safeJson(rest) }
    case ENGINE.CLOSE: return { kind: 'close' }
    case ENGINE.PING: return { kind: 'ping', data: rest || undefined }
    case ENGINE.PONG: return { kind: 'pong', data: rest || undefined }
    case ENGINE.UPGRADE: return { kind: 'upgrade' }
    case ENGINE.NOOP: return { kind: 'noop' }
    case ENGINE.MESSAGE: break
    default: return { kind: 'invalid', raw }
  }
  const type = Number(rest[0])
  const kinds = ['connect', 'disconnect', 'event', 'ack', 'connect_error']
  if (!Number.isInteger(type) || type < 0 || type >= kinds.length) return { kind: 'invalid', raw }
  let i = 1
  let nsp = '/'
  if (rest[i] === '/') {
    const comma = rest.indexOf(',', i)
    nsp = comma === -1 ? rest.slice(i) : rest.slice(i, comma)
    i = comma === -1 ? rest.length : comma + 1
  }
  let digits = ''
  while (/\d/.test(rest[i] || '')) digits += rest[i++]
  const id = digits === '' ? undefined : Number(digits)
  const body = rest.slice(i)
  const data = body === '' ? undefined : safeJson(body)
  if (body !== '' && data === INVALID) return { kind: 'invalid', raw }
  if ((type === SOCKET.EVENT || type === SOCKET.ACK) && !Array.isArray(data)) return { kind: 'invalid', raw }
  return { kind: kinds[type], nsp, id, data }
}

const INVALID = Symbol('invalid-json')
function safeJson (text) {
  try { return JSON.parse(text) } catch { return INVALID }
}

/**
 * The key that counts a room, the same way the app counts it (WebsocketContext/socket.js getRoomParam):
 * a string room is itself, an object room is its sorted [name, value] pairs.
 */
export const roomKey = param => (param && typeof param === 'object'
  ? JSON.stringify(Object.keys(param).sort().map(name => [name, param[name]]))
  : String(param))

/**
 * One client connection as a pure state machine: no sockets, no timers.
 *   open()          -> frames to send when the WebSocket opens
 *   handle(frame)   -> { send, events, joined, left, connected, closed } for one frame from the client
 * It tracks whether the default namespace is connected and which rooms the client joined (`join` / `leave`
 * events, the app's room protocol). Namespaces other than `/` are refused with 44, as a real server would.
 */
export function createSession ({ sid, ...options } = {}) {
  if (!sid) throw new Error('createSession needs a sid')
  const state = { sid, socketSid: `${sid}-ns`, connected: false, closed: false, rooms: new Map(), auth: undefined }
  const empty = () => ({ send: [], events: [], joined: [], left: [], connected: false, closed: false })
  return {
    state,
    open: () => [encodeOpen({ sid, ...options })],
    handle (frame) {
      const out = empty()
      const packet = decodePacket(frame)
      switch (packet.kind) {
        case 'ping': out.send.push(packet.data === undefined ? encodePong() : `${ENGINE.PONG}${packet.data}`); break
        case 'close': state.closed = true; state.connected = false; out.closed = true; break
        case 'connect':
          if (packet.nsp !== '/') { out.send.push(encodeConnectError('Invalid namespace', packet.nsp)); break }
          state.connected = true
          state.auth = packet.data
          out.connected = true
          out.send.push(encodeConnect(state.socketSid))
          break
        case 'disconnect':
          if (packet.nsp === '/') { state.connected = false; state.rooms.clear() }
          break
        case 'event': {
          if (packet.nsp !== '/' || !state.connected) break
          const [event, ...args] = packet.data
          out.events.push({ event, args })
          if (packet.id !== undefined) out.send.push(encodeAck(packet.id, []))
          if (event === 'join' && args.length) {
            const key = roomKey(args[0])
            if (!state.rooms.has(key)) { state.rooms.set(key, args[0]); out.joined.push(args[0]) }
          } else if (event === 'leave' && args.length) {
            if (state.rooms.delete(roomKey(args[0]))) out.left.push(args[0])
          }
          break
        }
        default: break // pong, ack, upgrade, noop, invalid: nothing to answer
      }
      return out
    }
  }
}

const matchesRoom = (param, wanted) => {
  if (wanted === undefined) return true
  if (typeof wanted === 'string') return typeof param === 'string' ? param === wanted : param?.room === wanted
  return Object.entries(wanted).every(([name, value]) => param && typeof param === 'object' && param[name] === value)
}

/**
 * Serve the fake realtime server on a Playwright browser context.
 *
 * @param context  Playwright BrowserContext
 * @param options  { url, pingInterval, pingTimeout, maxPayload }
 * @returns {{ url: string, fakeSocket: FakeSocketController }} put `url` in `__CONFIG__.socket.url` so the
 *   app connects to it. Playwright tries WebSocket routes newest first and runs only the first match, so call
 *   this AFTER any catch-all route that closes every WebSocket, or that one answers first.
 *
 * Controller:
 *   emit(event, payload, { room? }) -> number of connections that got it (room narrows to those that joined it:
 *     a string matches `room` strings and `{ room }` objects; an object matches by fields)
 *   rooms()      -> the rooms joined across connections, as the client sent them (strings or objects)
 *   received()   -> [{ event, args, sid, at }] every event the client emitted, `join` and `leave` included
 *   connected()  -> true while some client holds the default namespace
 *   connections() -> [{ sid, connected, query, rooms }]
 *   waitFor(predicate, timeoutMs) -> resolves when predicate(controller) is truthy, rejects on timeout
 *   dropAll()    -> close every connection from the server, like a network drop (the client reconnects and
 *                   replays its rooms by itself)
 */
export async function installFakeSocket (context, options = {}) {
  const url = options.url || DEFAULT_URL
  const host = new URL(url).host
  const live = new Map() // sid -> { session, ws, query, timer }
  const log = []
  let counter = 0

  const controller = {
    url,
    emit (event, payload, { room } = {}) {
      let delivered = 0
      for (const { session, ws } of live.values()) {
        if (!session.state.connected) continue
        if (room !== undefined && ![...session.state.rooms.values()].some(param => matchesRoom(param, room))) continue
        ws.send(encodeEvent(event, payload === undefined ? [] : [payload]))
        delivered += 1
      }
      return delivered
    },
    rooms () {
      const seen = new Map()
      for (const { session } of live.values()) session.state.rooms.forEach((param, key) => seen.set(key, param))
      return [...seen.values()]
    },
    received: () => log.map(entry => ({ ...entry })),
    connected: () => [...live.values()].some(({ session }) => session.state.connected),
    connections: () => [...live.values()].map(({ session, query }) => ({
      sid: session.state.sid, connected: session.state.connected, query, rooms: [...session.state.rooms.values()]
    })),
    async waitFor (predicate, timeoutMs = 10000) {
      const start = Date.now()
      while (!predicate(controller)) {
        if (Date.now() - start > timeoutMs) throw new Error(`fakeSocket.waitFor timed out after ${timeoutMs}ms`)
        await new Promise(resolve => setTimeout(resolve, 25))
      }
    },
    dropAll () {
      const all = [...live.entries()]
      for (const [sid, { ws, session, timer }] of all) {
        // forget it now: the close event reaches us later, and a send in between would go to a dead socket
        clearInterval(timer)
        live.delete(sid)
        session.handle(encodeDisconnectFrame())
        ws.close({ code: 1006, reason: 'fake network drop' })
      }
      return all.length
    }
  }

  await context.routeWebSocket(target => target.host === host, ws => {
    counter += 1
    const sid = `fake-sid-${String(counter).padStart(4, '0')}`
    const target = new URL(ws.url())
    const query = Object.fromEntries(target.searchParams)
    const session = createSession({ sid, pingInterval: options.pingInterval, pingTimeout: options.pingTimeout, maxPayload: options.maxPayload })
    const timer = setInterval(() => ws.send(encodePing()), options.pingInterval ?? DEFAULTS.pingInterval)
    timer.unref?.()
    live.set(sid, { session, ws, query, timer })
    ws.onMessage(message => {
      const result = session.handle(typeof message === 'string' ? message : message.toString())
      result.events.forEach(({ event, args }) => log.push({ event, args, sid, at: Date.now() }))
      result.send.forEach(frame => ws.send(frame))
    })
    ws.onClose(() => {
      clearInterval(timer)
      live.delete(sid)
    })
    session.open().forEach(frame => ws.send(frame))
  })
  return { url, fakeSocket: controller }
}

// ---- payload factories -------------------------------------------------------------------------------------
// The shape each listener reads, with the file:line where it reads it (verified against the tree on 2026-10-07).
// All paths are under src/@/components-dashboard/src/components/.
export const EVENT_CONTRACT = {
  update_order: {
    reads: 'a partial order with `id` and `status` (handlers return early without status); `history[].data` is an array of {attribute, old, new}; unknown ids are added to the list when their status is visible',
    listeners: ['DashboardOrdersList/index.js:1134,1279', 'OrderList/index.js:446,537', 'OrderDetails/index.js:556,571 (id must match the open order)', 'OrdersOverview/index.js:145,158 (reads history[].data for the status counters)', 'DriverStoreStatus/index.js:198,220 (payload or payload.order)']
  },
  orders_register: {
    reads: 'a whole new order; OrderList forces status 0, OrdersOverview only counts it',
    listeners: ['DashboardOrdersList/index.js:1198,1280', 'OrderList/index.js:489,538', 'OrdersOverview/index.js:152,159', 'OrderNotification/index.js:18,21 (becomes the `order_added` event)', 'DriverStoreStatus/index.js:198,221']
  },
  message: {
    // redesign B1c (W1-QB1-07): the chat (O/Messages/index.js) calls `message.can_see.includes(...)` and `message.author.name` on every
    // message it draws, so a message without them is not "incomplete": it makes the whole route fall to its error boundary. The shape is
    // the API's own (MESSAGE_RECORD_KEYS); `fakeMessage` fills all of it.
    reads: '{ id, order: { id } | order_id, type (1 general, 2 direct, 3 image), author_id (the chat tells own from other messages with user.id === author_id), author: { id, name, lastname, level } (level 0 does not count as unread; the chat draws author.name), can_see (a string such as "3,0,2": the chat calls .includes on it), comment, source (the image url of a type 3), created_at (UTC "YYYY-MM-DD HH:mm:ss": getTimeAgo and parseDate read it), read }',
    listeners: ['DashboardOrdersList/index.js:1220,1281', 'OrderList/index.js:507,539', 'Messages/index.js:184,195 (matches order.id or order_id)', 'ui/Orders/Messages/index.js (draws can_see, author, created_at of each message in the list)']
  },
  batch_driver_locations: {
    reads: '[{ driver_id, location: { lat, lng } }]',
    listeners: ['OrdersManage/index.js:473,519', 'DriversList/index.js:517,543']
  },
  batch_driver_changes: {
    reads: '[{ driver_id, changes: [{ attribute, old, new }] }]',
    listeners: ['OrdersManage/index.js:457,520', 'DriversList/index.js:501,544', 'DriverStoreStatus/index.js:185,219']
  },
  drivers_update: {
    reads: '{ id, enabled, available, busy }',
    listeners: ['UsersList/index.js:1049,1067']
  },
  sites_update: {
    reads: '{ id, ...site fields }; ignored unless id is the open site',
    listeners: ['OrderingWebsite/index.js:537,558']
  },
  app_build_change: {
    reads: '{ builder_app_id, platform, changes: [{ attribute, old, new }] }',
    listeners: ['BuildApps/index.js:187,246']
  }
}

// Rooms the app joins (client -> server `join`), for `fakeSocket.emit(..., { room })`:
//   OrderContext/index.js:1311-1321 `{room:'orders', user_id, role:'manager'}`, `orders_<userId>`, `messages_orders_<userId>`
//   OrdersManage/index.js:419-429 and DriversList/index.js:562-572 `{room:'driver_locations'|'drivers', ...}`
//   Messages/index.js:204-207 `messages_orders_<orderId>_<level>`
//   OrderingWebsite/index.js:544-551 `{room:'sites'}`, BuildApps/index.js:255-262 `{room:'builder_app_builds'}`

const stamp = (offsetMinutes = 0) => new Date(Date.UTC(2026, 9, 7, 15, 0, 0) + offsetMinutes * 60000).toISOString().slice(0, 19).replace('T', ' ')

/** A full order as the list and the panel render it. Override anything. */
export function fakeOrder ({ id = 960001, status = 0, ...overrides } = {}) {
  return {
    id,
    uuid: `fake-order-${id}`,
    external_id: `FAKE-ORDER-${id}`,
    status,
    created_at: stamp(),
    delivery_datetime: stamp(30),
    delivery_datetime_utc: stamp(30),
    delivery_type: 1,
    time_status: 'in_time',
    customer_id: 961001,
    business_id: 962001,
    driver_id: null,
    driver: null,
    products: [{ id: 963001, code: 'FAKE-PRODUCT-1', name: 'Synthetic burger', quantity: 1, price: 9, total: 9, valid: true, valid_menu: true, valid_quantity: true, ingredients: [], options: [], comment: '' }],
    payment_events: [],
    business: { id: 962001, name: 'Synthetic Store Alpha', slug: 'synthetic-store-alpha', logo: null, city: { id: 964001, name: 'Fixture City' } },
    customer: { id: 961001, name: 'Realtime', lastname: 'Customer', email: 'realtime.customer@example.invalid', cellphone: '+15550000100', orders_count: 1 },
    summary: { subtotal: 9, subtotal_with_discount: 9, discount: 0, tax: 0, service_fee: 0, driver_tip: 0, total: 9 },
    currency: 'USD',
    logistic_status: 'pending',
    logistic_attemps: 0,
    priority: 0,
    unread_count: 0,
    unread_general_count: 0,
    unread_direct_count: 0,
    last_message_at: null,
    history: [],
    ...overrides
  }
}

/** `update_order` payload: the order moves from `from` to `to`. Merged by the client into the order it has. */
export function fakeOrderUpdate ({ id = 960001, from = 0, to = 7, ...overrides } = {}) {
  return {
    id,
    status: to,
    history: [{ id: 965000 + id % 1000, order_id: id, type: 1, data: [{ attribute: 'status', old: from, new: to }], created_at: stamp(1), author: { id: 1, name: 'System', level: 0 } }],
    ...overrides
  }
}

/** The API's UTC clock, as the API writes it: "YYYY-MM-DD HH:mm:ss". `at` is a Date, a number of ms or an already-written string. */
export const utcStamp = (at = Date.now()) => (typeof at === 'string' ? at : new Date(at).toISOString().slice(0, 19).replace('T', ' '))

/**
 * redesign B1c (W1-QB1-07): the keys of a message as `GET /orders/:id/messages` returns it (taken from the live project on
 * 2026-10-07; evidence/w1/qa/tramo-b-r1/05-shape.json). A message built here must carry every one of them.
 */
export const MESSAGE_RECORD_KEYS = [
  'id', 'order_id', 'author_id', 'type', 'change', 'source', 'comment', 'driver_id', 'ip', 'can_see', 'location',
  'user_agent', 'app_id', 'created_at', 'updated_at', 'read', 'driver', 'author'
]

/** The author of a staff message (level 0) and of a customer message, as the chat draws them. */
export const MESSAGE_AUTHORS = {
  staff: { id: 1, name: 'Operator', lastname: '', level: 0 },
  customer: { id: 961001, name: 'Realtime', lastname: 'Customer', level: 3 }
}

/**
 * redesign B1c (W1-QB1-07): a message record in the API's own shape, the one both the realtime `message` event and the answer to
 * `POST /orders/:id/messages` carry. `canSee` is the comma-joined list of levels that can read it (3 customer, 0 administrator,
 * 2 business, 4 driver), a STRING as the API sends it. `createdAt` defaults to now in UTC: a fixed date would hide every
 * time-zone defect of the relative hours. Anything else can be overridden.
 */
export function messageRecord ({ id = 966001, orderId = 960001, type = 1, comment = 'Hello from the realtime fake', canSee = '3,0,2', author, authorId, source = null, read = false, createdAt, ...overrides } = {}) {
  const who = author || MESSAGE_AUTHORS.customer
  const stampedAt = utcStamp(createdAt)
  return {
    id,
    order_id: orderId,
    author_id: authorId === undefined ? who.id : authorId,
    type,
    change: null,
    source,
    comment,
    driver_id: null,
    ip: '203.0.113.7',
    can_see: Array.isArray(canSee) ? canSee.join(',') : String(canSee),
    location: null,
    user_agent: 'Synthetic fake-socket',
    app_id: null,
    created_at: stampedAt,
    updated_at: stampedAt,
    read,
    driver: null,
    author: who,
    ...overrides
  }
}

/**
 * `message` payload. `type` 1 is the general chat, 2 the direct one, 3 an image; `level` 0 is staff (never unread).
 * Its default staff author has id 1, the test project's administrator, which is also the session's user: a level-0 message
 * therefore reads as the user's OWN message (right side, no unread). To see a staff message from someone else pass
 * `author` (and `author_id` follows it). Every key the chat reads is present (messageRecord); `order` is added for the
 * listeners that read the order from there.
 */
export function fakeMessage ({ id = 966001, orderId = 960001, type = 1, level = 3, comment = 'Hello from the realtime fake', author, canSee, createdAt, source, read, ...overrides } = {}) {
  const base = level === 0 ? MESSAGE_AUTHORS.staff : MESSAGE_AUTHORS.customer
  return {
    ...messageRecord({ id, orderId, type, comment, canSee, createdAt, source, read, author: author || { ...base, level } }),
    order: { id: orderId },
    ...overrides
  }
}

/** `batch_driver_locations` payload: `[{ driver_id, lat, lng }]` in, `[{ driver_id, location: { lat, lng } }]` out. */
export const fakeDriverLocations = (drivers = [{ driver_id: 970001, lat: 40.7744, lng: -73.9678 }]) =>
  drivers.map(({ driver_id: driverId, lat, lng }) => ({ driver_id: driverId, location: { lat, lng } }))

/** `batch_driver_changes` payload: `{ driver_id: 970001, available: [true, false] }` style changes -> [{attribute, old, new}]. */
export function fakeDriverChanges (changes = [{ driver_id: 970001, attribute: 'available', old: true, new: false }]) {
  const byDriver = new Map()
  for (const { driver_id: driverId, attribute, old, new: next } of changes) {
    if (!byDriver.has(driverId)) byDriver.set(driverId, { driver_id: driverId, changes: [] })
    byDriver.get(driverId).changes.push({ attribute, old, new: next })
  }
  return [...byDriver.values()]
}

/** `drivers_update` payload. */
export const fakeDriverUpdate = ({ id = 970001, enabled = true, available = false, busy = false, ...overrides } = {}) => ({ id, enabled, available, busy, ...overrides })

/** `sites_update` payload: only the fields that changed, plus the id. */
export const fakeSiteUpdate = ({ id = 971001, ...overrides } = {}) => ({ id, ...overrides })

/** `app_build_change` payload: one platform's build moves to a new status. */
export const fakeBuildChange = ({ builderAppId = 972001, platform = 'android', attribute = 'status', old = 'pending', new: next = 'done', ...overrides } = {}) => ({
  builder_app_id: builderAppId,
  platform,
  changes: [{ attribute, old, new: next }],
  ...overrides
})

export const payloads = { fakeOrder, fakeOrderUpdate, fakeMessage, fakeDriverLocations, fakeDriverChanges, fakeDriverUpdate, fakeSiteUpdate, fakeBuildChange }
