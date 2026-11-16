import io from 'socket.io-client'

const MANUAL_RECONNECT_BASE_MS = 1000
const MANUAL_RECONNECT_MAX_MS = 60000
const RANDOMIZATION_FACTOR = 0.5
const STABLE_CONNECTION_MS = 30000

export class Socket {
  constructor ({ url, project, accessToken }) {
    this.url = url
    this.project = project
    this.accessToken = accessToken
    this.queue = []
    this.socketChangeListeners = new Set()
    // Rooms in use: key -> { param, count }. The server forgets every room when the connection drops, so this
    // is what is sent again on each (re)connection.
    this.rooms = new Map()
    this.replaying = false
    this.replayed = new Set()
    this.closed = false
    this.reconnectTimeout = null
    this.manualReconnectAttempts = 0
    this.connectedAt = null
  }

  connect () {
    this.closed = false
    this.clearReconnectTimeout()
    const ioSocket = io(this.url, {
      extraHeaders: {
        Authorization: `Bearer ${this.accessToken}`
      },
      query: `token=${this.accessToken}&project=${this.project}`,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: RANDOMIZATION_FACTOR
    })
    this.socket = ioSocket
    // These two listeners are registered first, so they run before any listener a consumer adds. Consumers that
    // re-join from their own `connect` or `disconnect` listener (an old pattern) call join() while they run: see
    // `replaying`.
    ioSocket.on('connect', () => {
      this.clearReconnectTimeout()
      this.connectedAt = Date.now()
      this.openReplayWindow()
      this.rooms.forEach(({ param }, key) => {
        this.replayed.add(key)
        ioSocket.emit('join', param)
      })
      let item
      while ((item = this.queue.shift()) !== undefined) {
        if (item.action === 'on') {
          this.on(item.event, item.func)
        } else if (item.action === 'off') {
          this.off(item.event, item.func)
        }
      }
    })
    ioSocket.on('disconnect', (reason) => {
      this.openReplayWindow()
      this.rooms.forEach((_room, key) => this.replayed.add(key))
      // After `io server disconnect` socket.io does not reconnect by itself: handleDisconnect retries with backoff.
      this.handleDisconnect(ioSocket, reason)
    })
    this.socketChangeListeners.forEach(listener => listener(this.socket))
  }

  handleDisconnect (ioSocket, reason) {
    if (ioSocket !== this.socket) return
    if (this.connectedAt && Date.now() - this.connectedAt >= STABLE_CONNECTION_MS) {
      this.manualReconnectAttempts = 0
    }
    this.connectedAt = null
    if (this.closed || reason !== 'io server disconnect') return
    if (this.reconnectTimeout) return
    const base = Math.min(
      MANUAL_RECONNECT_BASE_MS * Math.pow(2, this.manualReconnectAttempts),
      MANUAL_RECONNECT_MAX_MS
    )
    const jitter = base * RANDOMIZATION_FACTOR * (Math.random() * 2 - 1)
    this.manualReconnectAttempts += 1
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null
      if (!this.closed && ioSocket === this.socket && !ioSocket.connected) {
        ioSocket.connect()
      }
    }, Math.round(base + jitter))
  }

  clearReconnectTimeout () {
    if (!this.reconnectTimeout) return
    clearTimeout(this.reconnectTimeout)
    this.reconnectTimeout = null
  }

  /**
   * Subscribe to the socket.io instance being replaced by connect().
   * `this.socket` is a plain property, so React cannot observe the swap on its own.
   * @returns {Function} unsubscribe
   */
  onSocketChange (listener) {
    this.socketChangeListeners.add(listener)
    return () => this.socketChangeListeners.delete(listener)
  }

  getId () {
    return this.socket?.id
  }

  close () {
    this.closed = true
    this.clearReconnectTimeout()
    this.manualReconnectAttempts = 0
    this.connectedAt = null
    if (this.socket) {
      this.socket.close()
    }
  }

  /**
   * The room as the server names it, and the key that counts its users. Object rooms are copied (the
   * caller's object is left alone) and counted by content, not by identity.
   */
  getRoomParam (room) {
    if (room && typeof room === 'object') {
      const { project, ...rest } = room
      const param = { ...rest, project: this.project }
      const key = JSON.stringify(Object.keys(param).sort().map(name => [name, param[name]]))
      return { key, param }
    }
    const param = `${this.project}_${room}`
    return { key: param, param }
  }

  /**
   * The replay window is the synchronous run of the `connect` / `disconnect` listeners. A join() for a room
   * that is already in use, made inside it, is a consumer re-joining by itself: it is not a new user.
   */
  openReplayWindow () {
    this.replaying = true
    this.replayed.clear()
    Promise.resolve().then(() => {
      this.replaying = false
      this.replayed.clear()
    })
  }

  /**
   * Join a room. Rooms are reference counted: the server hears `join` only for the first user, so a second
   * component that needs the same room (the order panel's route and its chat) never makes the first one leave
   * it. Offline, nothing is sent now: the connection replays every room in use.
   */
  join (room) {
    const { key, param } = this.getRoomParam(room)
    if (this.replaying && this.replayed.has(key)) return this
    const entry = this.rooms.get(key)
    if (entry) {
      entry.count += 1
      return this
    }
    this.rooms.set(key, { param, count: 1 })
    if (this.socket?.connected) this.socket.emit('join', param)
    return this
  }

  /**
   * Leave a room: the server hears `leave` only when the last user goes. A room nobody joined is still
   * announced when connected (a harmless no-op on the server, what this always did).
   */
  leave (room) {
    const { key, param } = this.getRoomParam(room)
    const entry = this.rooms.get(key)
    if (entry && entry.count > 1) {
      entry.count -= 1
      return this
    }
    this.rooms.delete(key)
    if (this.socket?.connected) this.socket.emit('leave', param)
    return this
  }

  on (event, func = () => {}) {
    if (this.socket?.connected) {
      this.socket.on(event, func)
    } else {
      this.queue.push({ action: 'on', event, func })
    }
    return this
  }

  off (event, func = () => {}) {
    if (this.socket?.connected) {
      this.socket.off(event, func)
    } else {
      this.queue.push({ action: 'off', event, func })
    }
    return this
  }
}
