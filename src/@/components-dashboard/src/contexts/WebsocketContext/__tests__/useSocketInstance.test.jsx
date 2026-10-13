/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'

vi.mock('../../SessionContext', () => ({
  useSession: () => [{}]
}))
vi.mock('../../EventContext', () => ({
  useEvent: () => [{ emit: vi.fn() }]
}))
vi.mock('socket.io-client', () => ({
  default: () => ({
    connected: false,
    on: vi.fn(),
    off: vi.fn(),
    close: vi.fn()
  })
}))

import { useSocketInstance } from '..'
import { Socket } from '../socket'

describe('useSocketInstance', () => {
  it('re-renders with the socket.io instance created or replaced by connect()', () => {
    const socket = new Socket({ url: 'wss://socket.test', project: 'cityeat', accessToken: 'token' })
    const seen = []
    const Probe = () => {
      seen.push(useSocketInstance(socket))
      return null
    }

    const { unmount } = render(<Probe />)
    expect(seen[seen.length - 1]).toBeUndefined()

    act(() => socket.connect())
    const first = socket.socket
    expect(seen[seen.length - 1]).toBe(first)

    act(() => socket.connect())
    expect(socket.socket).not.toBe(first)
    expect(seen[seen.length - 1]).toBe(socket.socket)

    unmount()
    expect(socket.socketChangeListeners.size).toBe(0)
  })
})
