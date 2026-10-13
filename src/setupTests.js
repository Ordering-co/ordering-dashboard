import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

expect.extend(matchers)

// Git-hosted package path breaks vite-node (encoded "/" in store path).
vi.mock('react-phone-number-input', () => ({
  default: () => null,
  parsePhoneNumber: () => null,
  isValidPhoneNumber: () => true,
  formatPhoneNumber: (v) => v,
  formatPhoneNumberIntl: (v) => v
}))
vi.mock('react-phone-number-input/min', () => ({
  default: () => null
}))
vi.mock('react-phone-number-input/input', () => ({
  default: () => null
}))

// Node 22+ experimental localStorage can replace jsdom's Storage and omit clear().
// Always install a complete in-memory Storage for Vitest.
const createMemoryStorage = () => {
  const store = new Map()
  return {
    get length () {
      return store.size
    },
    clear () {
      store.clear()
    },
    getItem (key) {
      return store.has(String(key)) ? store.get(String(key)) : null
    },
    key (index) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem (key) {
      store.delete(String(key))
    },
    setItem (key, value) {
      store.set(String(key), String(value))
    }
  }
}

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  writable: true,
  value: createMemoryStorage()
})
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  writable: true,
  value: window.localStorage
})

// jsdom does not implement matchMedia / IntersectionObserver used by some UI
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

global.IntersectionObserver = class IntersectionObserver {
  observe () {}
  unobserve () {}
  disconnect () {}
}

global.ResizeObserver = class ResizeObserver {
  observe () {}
  unobserve () {}
  disconnect () {}
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
