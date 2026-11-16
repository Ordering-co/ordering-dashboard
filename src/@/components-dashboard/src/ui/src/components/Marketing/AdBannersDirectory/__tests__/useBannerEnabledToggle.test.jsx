/* eslint-disable import/first */
// redesign AB-B2 (decision 1; defect M-AB06): the switch of a banner (On / Off), shared by the rows of the list and the header of the
// panel. No confirmation, as `main`. `handleUpdateBanner(payload, bannerId)` is the contract of AB-B1 (resolves `{ ok, error }`),
// mocked here. The Product AsyncSwitch is real.
// redesign AB-B5 (follow-up of the B2-B4 reports): the hook no longer returns an `alert`. AsyncSwitch already says why under the switch
// that was pressed (a row or the panel header); the extra dialog made two notices for one failure.
import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))

import { AsyncSwitch } from '../../../Shared/Product'
import { useBannerEnabledToggle } from '../useBannerEnabledToggle'

const burger = { id: 1, name: 'Burger week', enabled: true }
const pizza = { id: 2, name: 'Pizza night', enabled: false }

// The host: an AsyncSwitch per banner controlled by `banner.enabled` (the list does not move it until the controller says so)
const Host = ({ banners = [burger, pizza], handleUpdateBanner }) => {
  const { setEnabled, pendingIds } = useBannerEnabledToggle({ handleUpdateBanner })
  return (
    <>
      {banners.map(banner => (
        <AsyncSwitch
          key={banner.id}
          checked={!!banner.enabled}
          failureText='Switch failed'
          label={`${banner.name} status`}
          onToggle={next => setEnabled(banner, next)}
        />
      ))}
      <output data-testid='pending'>{pendingIds.join(',')}</output>
    </>
  )
}

const control = name => screen.getByRole('switch', { name, hidden: true })
const deferred = () => {
  let settle
  const promise = new Promise(resolve => { settle = resolve })
  return { promise, resolve: settle }
}

// the hook on its own, to read what setEnabled resolves
const probe = (handleUpdateBanner) => {
  const seen = {}
  const Probe = () => {
    Object.assign(seen, useBannerEnabledToggle({ handleUpdateBanner }))
    return null
  }
  render(<Probe />)
  return seen
}

afterEach(() => document.getElementById('app-modals')?.remove())

describe('useBannerEnabledToggle', () => {
  it('turning a banner on or off calls the controller at once, with the new value and its id, and no dialog', async () => {
    const handle = vi.fn().mockResolvedValue({ ok: true, error: null })
    render(<Host handleUpdateBanner={handle} />)
    await userEvent.click(control('Pizza night status'))
    expect(handle).toHaveBeenCalledWith({ enabled: true }, 2)
    await userEvent.click(control('Burger week status'))
    expect(handle).toHaveBeenLastCalledWith({ enabled: false }, 1)
    expect(handle).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('the id is pending while the call is in flight and clears when it settles', async () => {
    const call = deferred()
    const handle = vi.fn().mockReturnValue(call.promise)
    render(<Host handleUpdateBanner={handle} />)
    await userEvent.click(control('Pizza night status'))
    expect(screen.getByTestId('pending')).toHaveTextContent('2')
    expect(control('Pizza night status')).toHaveAttribute('aria-busy', 'true')
    await act(async () => { call.resolve({ ok: true, error: null }) })
    expect(screen.getByTestId('pending')).toHaveTextContent('')
  })

  it('a second call for the same banner while the first is in flight sends no second request', async () => {
    const call = deferred()
    const handle = vi.fn().mockReturnValue(call.promise)
    const seen = probe(handle)
    let first
    let second
    await act(async () => {
      first = seen.setEnabled(pizza, true)
      second = seen.setEnabled(pizza, true)
    })
    expect(handle).toHaveBeenCalledTimes(1)
    await act(async () => { call.resolve({ ok: true, error: null }) })
    await expect(first).resolves.toMatchObject({ ok: true })
    await expect(second).resolves.toMatchObject({ ok: true })
  })

  it('two different banners can be in flight at the same time', async () => {
    const handle = vi.fn().mockReturnValue(new Promise(() => {}))
    const seen = probe(handle)
    await act(async () => {
      seen.setEnabled(burger, false)
      seen.setEnabled(pizza, true)
    })
    expect(handle).toHaveBeenCalledTimes(2)
    expect(seen.pendingIds).toEqual([1, 2])
  })

  it('a failure keeps the old value (the switch is controlled by banner.enabled) and says why in the switch that was pressed, with no dialog', async () => {
    const handle = vi.fn().mockResolvedValue({ ok: false, error: ['Not allowed', 'Try later'] })
    render(<Host handleUpdateBanner={handle} />)
    await userEvent.click(control('Pizza night status'))
    // setEnabled resolved the failure, so the AsyncSwitch has its own notice
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed')
    expect(document.querySelectorAll('.odc-async-switch[data-failed]')).toHaveLength(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(control('Pizza night status')).not.toBeChecked()
    expect(screen.getByTestId('pending')).toHaveTextContent('')
  })

  it('setEnabled resolves { ok: false, error } on a failure and { ok: true } on success', async () => {
    const handle = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: ['Nope'] })
      .mockResolvedValueOnce({ ok: true, error: null })
    const seen = probe(handle)
    let failed
    await act(async () => { failed = await seen.setEnabled(pizza, true) })
    expect(failed).toEqual({ ok: false, error: ['Nope'] })
    let done
    await act(async () => { done = await seen.setEnabled(pizza, true) })
    expect(done).toMatchObject({ ok: true })
  })

  it('a failure with no reason lets the switch say its own sentence; a thrown error counts as a failure', async () => {
    const handle = vi.fn().mockResolvedValueOnce({ ok: false, error: null }).mockRejectedValueOnce(new Error('network'))
    render(<Host handleUpdateBanner={handle} />)
    await userEvent.click(control('Pizza night status'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Switch failed')
    await userEvent.click(control('Burger week status'))
    await waitFor(() => expect(document.querySelectorAll('.odc-async-switch[data-failed]')).toHaveLength(2))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(control('Burger week status')).toBeChecked()
  })

  it('a controller that resolves nothing (a legacy one) counts as done', async () => {
    const handle = vi.fn().mockResolvedValue(undefined)
    const seen = probe(handle)
    let result
    await act(async () => { result = await seen.setEnabled(pizza, true) })
    expect(result).toMatchObject({ ok: true })
  })

  it('ignores a call with no banner', async () => {
    const handle = vi.fn()
    const seen = probe(handle)
    await act(async () => { await seen.setEnabled(undefined, true) })
    expect(handle).not.toHaveBeenCalled()
  })

  it('renders nothing itself, starts with no pending id and returns no alert (AB-B5)', () => {
    let seen
    const Probe = () => {
      seen = useBannerEnabledToggle({ handleUpdateBanner: vi.fn() })
      return null
    }
    const { container } = render(<Probe />)
    expect(container).toBeEmptyDOMElement()
    expect(seen.pendingIds).toEqual([])
    expect(Object.keys(seen).sort()).toEqual(['pendingIds', 'setEnabled'])
    expect(typeof seen.setEnabled).toBe('function')
  })
})
