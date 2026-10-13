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
    ioSocket.on('connect', () => {
      this.clearReconnectTimeout()
      this.connectedAt = Date.now()
      let item
      while ((item = this.queue.shift()) !== undefined) {
        if (item.action === 'on') {
          this.on(item.event, item.func)
        } else if (item.action === 'join') {
          this.join(item.room)
        } else if (item.action === 'leave') {
          this.leave(item.room)
        } else if (item.action === 'off') {
          this.off(item.event, item.func)
        }
      }
    })
    ioSocket.on('disconnect', (reason) => this.handleDisconnect(ioSocket, reason))
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

  join (room) {
    if (this.socket?.connected) {
      let paramRoom = null
      if (typeof room === 'object') {
        room.project = this.project
        paramRoom = room
      } else {
        paramRoom = `${this.project}_${room}`
      }
      this.socket.emit('join', paramRoom)
    } else {
      this.queue.push({ action: 'join', room })
    }
    return this
  }

  leave (room) {
    if (this.socket?.connected) {
      let paramRoom = null
      if (typeof room === 'object') {
        room.project = this.project
        paramRoom = room
      } else {
        paramRoom = `${this.project}_${room}`
      }
      this.socket.emit('leave', paramRoom)
    } else {
      this.queue.push({ action: 'leave', room })
    }
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
