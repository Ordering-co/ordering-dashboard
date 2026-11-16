/* eslint-disable import/first */
// redesign deliveries F2-B2 (decision 3): the request that assigns a driver from the board, the same one the order panel sends.
import React from 'react'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ save: null, configs: {}, dictionary: {}, showToast: null }))

vi.mock('../../../../../../index', () => {
  const ordering = {
    setAccessToken: (token) => ({
      orders: (id) => ({ save: (payload) => mocks.save(id, payload, token) })
    })
  }
  const t = (key, fallback) => mocks.dictionary[key] ?? fallback
  return {
    useLanguage: () => [null, t],
    useConfig: () => [{ configs: mocks.configs }],
    useApi: () => [ordering],
    useSession: () => [{ token: 'token' }]
  }
})

import { useAssignDriver } from '../useAssignDriver'
import { ToastContext, ToastType } from '../../../../../../contexts/ToastContext'

const wrapper = ({ children }) => (
  <ToastContext.Provider value={[null, { showToast: mocks.showToast, hideToast: () => {} }]}>
    {children}
  </ToastContext.Provider>
)

const order = { id: 31 }
const driver = { id: 7, name: 'Ada' }
const ok = { content: { error: false, result: {} } }

beforeEach(() => {
  mocks.save = vi.fn(async () => ok)
  mocks.showToast = vi.fn()
  mocks.configs = {}
  mocks.dictionary = {}
})

describe('useAssignDriver', () => {
  it('saves { driver_id } once, is busy for that driver meanwhile, toasts and calls onAssigned', async () => {
    let release
    mocks.save = vi.fn(() => new Promise(resolve => { release = () => resolve(ok) }))
    const onAssigned = vi.fn()
    const { result } = renderHook(() => useAssignDriver({ onAssigned }), { wrapper })
    expect(result.current.isBusy(order, driver)).toBe(false)
    act(() => { result.current.assign(order, driver) })
    expect(mocks.save).toHaveBeenCalledTimes(1)
    expect(mocks.save).toHaveBeenCalledWith(31, { driver_id: 7 }, 'token')
    expect(result.current.isBusy(order, driver)).toBe(true)
    expect(result.current.isBusy(order, { id: 8 })).toBe(false)
    act(() => { result.current.assign(order, driver) })
    act(() => { result.current.assign(order, { id: 8 }) })
    expect(mocks.save).toHaveBeenCalledTimes(1)
    await act(async () => { release() })
    expect(result.current.isBusy(order, driver)).toBe(false)
    expect(onAssigned).toHaveBeenCalledWith(order, driver)
    expect(mocks.showToast).toHaveBeenCalledWith(ToastType.Success, 'Driver assigned to order')
    expect(result.current.error).toBeNull()
  })

  // redesign deliveries R1 (finding 4): the dock puts the focus back when the request ends, so it needs to know when one is in flight
  it('says busy for any assignment while it is in flight, and no more once it settles (success or failure)', async () => {
    let release
    mocks.save = vi.fn(() => new Promise(resolve => { release = resolve }))
    const { result } = renderHook(() => useAssignDriver(), { wrapper })
    expect(result.current.busy).toBe(false)
    act(() => { result.current.assign(order, driver) })
    expect(result.current.busy).toBe(true)
    await act(async () => { release({ content: { error: true, result: ['nope'] } }) })
    expect(result.current.busy).toBe(false)
    expect(result.current.error).not.toBeNull()
  })

  it('opens the comment dialog instead of saving when the project requires a comment', async () => {
    mocks.configs = { manual_driver_assignment_comment_enabled: { value: '1' } }
    const onAssigned = vi.fn()
    const { result } = renderHook(() => useAssignDriver({ onAssigned }), { wrapper })
    expect(result.current.comment.open).toBe(false)
    act(() => { result.current.assign(order, driver) })
    expect(result.current.comment.open).toBe(true)
    expect(mocks.save).not.toHaveBeenCalled()
    await act(async () => { result.current.comment.onSubmit('   ') })
    expect(mocks.save).not.toHaveBeenCalled()
    expect(result.current.comment.open).toBe(true)
    await act(async () => { result.current.comment.onSubmit('Closest to the store') })
    expect(mocks.save).toHaveBeenCalledTimes(1)
    expect(mocks.save).toHaveBeenCalledWith(31, { manual_driver_assignment_comment: 'Closest to the store', driver_id: 7 }, 'token')
    expect(result.current.comment.open).toBe(false)
    expect(onAssigned).toHaveBeenCalledWith(order, driver)
  })

  it('does not ask for a comment when the config is anything but «1»', async () => {
    mocks.configs = { manual_driver_assignment_comment_enabled: { value: '0' } }
    const { result } = renderHook(() => useAssignDriver(), { wrapper })
    await act(async () => { result.current.assign(order, driver) })
    expect(result.current.comment.open).toBe(false)
    expect(mocks.save).toHaveBeenCalledWith(31, { driver_id: 7 }, 'token')
  })

  it('cancelling the comment dialog sends nothing', () => {
    mocks.configs = { manual_driver_assignment_comment_enabled: { value: '1' } }
    const { result } = renderHook(() => useAssignDriver(), { wrapper })
    act(() => { result.current.assign(order, driver) })
    act(() => { result.current.comment.onCancel() })
    expect(result.current.comment.open).toBe(false)
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('keeps a translated error and retries the very same call, comment included', async () => {
    mocks.configs = { manual_driver_assignment_comment_enabled: { value: '1' } }
    mocks.dictionary = { DRIVER_NOT_AVAILABLE: 'El repartidor no está disponible' }
    mocks.save = vi.fn()
      .mockResolvedValueOnce({ content: { error: true, result: ['DRIVER_NOT_AVAILABLE'] } })
      .mockResolvedValueOnce(ok)
    const onAssigned = vi.fn()
    const { result } = renderHook(() => useAssignDriver({ onAssigned }), { wrapper })
    act(() => { result.current.assign(order, driver) })
    await act(async () => { result.current.comment.onSubmit('Because') })
    expect(result.current.error.message).toBe('El repartidor no está disponible')
    expect(onAssigned).not.toHaveBeenCalled()
    expect(mocks.showToast).not.toHaveBeenCalled()
    await act(async () => { result.current.retry() })
    expect(mocks.save).toHaveBeenCalledTimes(2)
    expect(mocks.save.mock.calls[1]).toEqual(mocks.save.mock.calls[0])
    expect(result.current.error).toBeNull()
    expect(onAssigned).toHaveBeenCalledTimes(1)
  })

  it('turns a thrown request into the same error, and an answer without text into a generic one', async () => {
    mocks.save = vi.fn()
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce({ content: { error: true, result: null } })
    const { result } = renderHook(() => useAssignDriver(), { wrapper })
    await act(async () => { result.current.assign(order, driver) })
    expect(result.current.error.message).toBe('Network down')
    await act(async () => { result.current.assign(order, driver) })
    expect(result.current.error.message).toBe('An error has occurred')
  })

  it('clears the error when a new assignment starts or it is dismissed', async () => {
    mocks.save = vi.fn()
      .mockResolvedValueOnce({ content: { error: true, result: ['Nope'] } })
      .mockResolvedValueOnce(ok)
    const { result } = renderHook(() => useAssignDriver(), { wrapper })
    await act(async () => { result.current.assign(order, driver) })
    expect(result.current.error).not.toBeNull()
    act(() => { result.current.dismissError() })
    expect(result.current.error).toBeNull()
  })
})
