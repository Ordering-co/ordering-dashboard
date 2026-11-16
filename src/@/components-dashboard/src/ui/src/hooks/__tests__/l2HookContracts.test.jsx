/* eslint-disable import/first */
import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ ordering: {}, user: {} }))
vi.mock('../../../../index', () => ({
  useApi: () => [runtime.ordering],
  useSession: () => [{ user: runtime.user }]
}))

import { useFeaturedRestriction } from '../useFeaturedRestriction'
import { useCountdownTimer } from '../useCountdownTimer'
import { useOnlineStatus } from '../useOnlineStatus'
import { useSelectedAccessRole } from '../useUserSelectedAccess'
import { useWindowSize } from '../useWindowSize'

const AccessProbe = () => <output>{JSON.stringify({ restriction: useFeaturedRestriction(), selected: useSelectedAccessRole() })}</output>
const CountdownProbe = ({ start }) => {
  const [count, setCount, reset] = useCountdownTimer(2, start)
  return <><output>{count}</output><button onClick={() => setCount(9)}>Set</button><button onClick={reset}>Reset</button></>
}
const BrowserProbe = () => <output>{JSON.stringify({ online: useOnlineStatus(), size: useWindowSize() })}</output>

beforeEach(() => {
  runtime.ordering = {}
  runtime.user = {}
})
afterEach(() => vi.useRealTimers())

describe('L2 hook contracts', () => {
  it.each([
    // main 581c89005 / 441a22ccd: Featured is the admin's alone (level 0), on every project; the EatStreet owner rule is gone
    ['eatstreet', 2, false, true],
    ['examplebackoffice', 5, true, true],
    ['eatstreet', 0, true, false],
    ['other', 2, true, true],
    ['other', 0, false, false]
  ])('keeps restriction and selected-access matrices', (project, level, selectedAccess, restriction) => {
    runtime.ordering = { project }
    runtime.user = { level, selected_access: selectedAccess }
    render(<AccessProbe />)
    expect(JSON.parse(screen.getByRole('status').textContent)).toEqual({ restriction, selected: level === 0 ? false : selectedAccess })
  })

  it('counts only while started, stops at zero and preserves setter/reset', () => {
    vi.useFakeTimers()
    const rendered = render(<CountdownProbe start={false} />)
    act(() => vi.advanceTimersByTime(2000))
    expect(screen.getByRole('status')).toHaveTextContent('2')
    rendered.rerender(<CountdownProbe start />)
    act(() => vi.advanceTimersByTime(3000))
    expect(screen.getByRole('status')).toHaveTextContent('0')
    fireEvent.click(screen.getByRole('button', { name: 'Set' }))
    expect(screen.getByRole('status')).toHaveTextContent('9')
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.getByRole('status')).toHaveTextContent('2')
  })

  it('tracks online/offline and resize changes during mount and cleans listeners', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 900 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 700 })
    const rendered = render(<BrowserProbe />)
    expect(JSON.parse(screen.getByRole('status').textContent)).toEqual({ online: true, size: { width: 900, height: 700 } })
    act(() => window.dispatchEvent(new Event('offline')))
    expect(JSON.parse(screen.getByRole('status').textContent).online).toBe(false)
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 640 })
    act(() => window.dispatchEvent(new Event('resize')))
    expect(JSON.parse(screen.getByRole('status').textContent).size.width).toBe(640)
    rendered.unmount()
    expect(remove).toHaveBeenCalledWith('online', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('offline', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
  })
})
