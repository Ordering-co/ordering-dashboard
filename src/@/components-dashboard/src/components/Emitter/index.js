export class Emitter {
  constructor () {
    this._events = {}
  }

  on (name, listener) {
    if (!this._events[name]) {
      this._events[name] = []
    }

    this._events[name].push(listener)
  }

  off (name, listenerToRemove) {
    if (!this._events[name]) {
      return
    }

    const filterListeners = (listener) => listener !== listenerToRemove

    this._events[name] = this._events[name].filter(filterListeners)
  }

  emit (name, ...data) {
    if (!this._events[name]) {
      return
    }

    const fireCallbacks = (callback) => {
      callback(...data)
    }

    this._events[name].forEach(fireCallbacks)
  }
}
