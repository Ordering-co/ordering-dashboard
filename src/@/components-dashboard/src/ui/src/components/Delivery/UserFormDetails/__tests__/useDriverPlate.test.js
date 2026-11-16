/* eslint-disable import/first */
// `useDriverPlate`, the license plate of a driver kept as the `plate` metafield.
// «Today» tests pin what main does and the hook keeps (endpoints, bodies, upper-casing, the dirty flag); the rest pins what
// M-UF18 fixes: a non-2xx answer is an error, the error is always a text, and a late answer for another user or after the
// component left is ignored.
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => {
  const lang = [{ dictionary: {} }, (_key, fallback) => fallback ?? _key]
  const api = { root: 'https://api.example.test/v1' }
  const session = { token: 'tok' }
  return {
    useApi: () => [api],
    useSession: () => [session],
    useLanguage: () => lang
  }
})

import { useDriverPlate, DRIVER_PLATE_KEY } from '../useDriverPlate'

const fallbackText = 'We couldn\'t save the changes. Try again.'
const HEADERS = { 'Content-Type': 'application/json', Authorization: 'Bearer tok' }
const reply = (body, { ok = true, status = 200 } = {}) => ({ ok, status, json: async () => body })
const deferred = () => {
  let release
  const promise = new Promise(resolve => { release = resolve })
  return { promise, resolve: release }
}
const methods = () => global.fetch.mock.calls.map(([, init]) => init.method)
const urls = () => global.fetch.mock.calls.map(([url]) => url)

let fetchMock
beforeEach(() => {
  fetchMock = vi.fn()
  global.fetch = fetchMock
})
afterEach(() => {
  vi.restoreAllMocks()
})

// the hook, already read: the metafield list answers `fields`
const ready = async (fields = [], userId = 5) => {
  fetchMock.mockResolvedValueOnce(reply({ error: false, result: fields }))
  const view = renderHook(({ id }) => useDriverPlate(id), { initialProps: { id: userId } })
  await waitFor(() => expect(view.result.current.plateState.loading).toBe(false))
  return view
}

describe('useDriverPlate · reading', () => {
  it('asks for the metafields of the user on mount and keeps the value of `plate`', async () => {
    const { result } = await ready([{ id: 1, key: 'other', value: 'x' }, { id: 31, key: DRIVER_PLATE_KEY, value: 'AB12' }])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/v1/users/5/metafields', { method: 'GET', headers: HEADERS })
    expect(result.current.plate).toBe('AB12')
    expect(result.current.isPlateDirty).toBe(false)
    expect(result.current.plateState).toEqual({ loading: false, error: null })
  })

  it('without a user it asks for nothing', async () => {
    renderHook(() => useDriverPlate(null))
    await act(async () => {})
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('no plate metafield is an empty plate', async () => {
    const { result } = await ready([])
    expect(result.current.plate).toBe('')
    expect(result.current.isPlateDirty).toBe(false)
  })

  it('is dirty when the trimmed, upper-cased text differs from the saved one', async () => {
    const { result } = await ready([{ id: 31, key: 'plate', value: 'AB12' }])
    act(() => result.current.setPlate(' ab12 '))
    expect(result.current.isPlateDirty).toBe(false)
    act(() => result.current.setPlate('ab13'))
    expect(result.current.isPlateDirty).toBe(true)
  })

  it('is loading while it reads', async () => {
    const gate = deferred()
    fetchMock.mockReturnValueOnce(gate.promise)
    const { result } = renderHook(() => useDriverPlate(5))
    expect(result.current.plateState.loading).toBe(true)
    await act(async () => { gate.resolve(reply({ error: false, result: [] })) })
    expect(result.current.plateState.loading).toBe(false)
  })
})

describe('useDriverPlate · saving', () => {
  it('writes nothing when nothing changed', async () => {
    const { result } = await ready([{ id: 31, key: 'plate', value: 'AB12' }])
    let saved
    await act(async () => { saved = await result.current.savePlate() })
    expect(saved).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('a new plate is a POST with the upper-cased value, then a PUT to the id it answered', async () => {
    const { result } = await ready([])
    act(() => result.current.setPlate('  ab 12 '))
    fetchMock.mockResolvedValueOnce(reply({ error: false, result: { id: 77 } }))
    let saved
    await act(async () => { saved = await result.current.savePlate() })
    expect(saved).toBe(true)
    expect(fetchMock).toHaveBeenLastCalledWith('https://api.example.test/v1/users/5/metafields', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ key: 'plate', value: 'AB 12', value_type: 'text' })
    })
    expect(result.current.plate).toBe('AB 12')
    expect(result.current.isPlateDirty).toBe(false)
    act(() => result.current.setPlate('cd34'))
    fetchMock.mockResolvedValueOnce(reply({ error: false, result: { id: 77 } }))
    await act(async () => { await result.current.savePlate() })
    expect(methods().slice(1)).toEqual(['POST', 'PUT'])
    expect(urls().at(-1)).toBe('https://api.example.test/v1/users/5/metafields/77')
  })

  it('an existing plate is a PUT to its id', async () => {
    const { result } = await ready([{ id: 31, key: 'plate', value: 'OLD1' }])
    act(() => result.current.setPlate('new2'))
    fetchMock.mockResolvedValueOnce(reply({ error: false, result: { id: 31 } }))
    await act(async () => { await result.current.savePlate() })
    expect(fetchMock).toHaveBeenLastCalledWith('https://api.example.test/v1/users/5/metafields/31', {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify({ key: 'plate', value: 'NEW2', value_type: 'text' })
    })
  })

  it('an emptied plate is a DELETE, and the next one is a POST again', async () => {
    const { result } = await ready([{ id: 31, key: 'plate', value: 'OLD1' }])
    act(() => result.current.setPlate('   '))
    fetchMock.mockResolvedValueOnce(reply({ error: false, result: {} }))
    await act(async () => { await result.current.savePlate() })
    expect(fetchMock).toHaveBeenLastCalledWith('https://api.example.test/v1/users/5/metafields/31', { method: 'DELETE', headers: HEADERS })
    expect(result.current.plate).toBe('')
    act(() => result.current.setPlate('again'))
    fetchMock.mockResolvedValueOnce(reply({ error: false, result: { id: 90 } }))
    await act(async () => { await result.current.savePlate() })
    expect(methods().at(-1)).toBe('POST')
  })

  it('is loading while it saves', async () => {
    const { result } = await ready([])
    act(() => result.current.setPlate('abc'))
    const gate = deferred()
    fetchMock.mockReturnValueOnce(gate.promise)
    let pending
    act(() => { pending = result.current.savePlate() })
    expect(result.current.plateState.loading).toBe(true)
    await act(async () => { gate.resolve(reply({ error: false, result: { id: 1 } })); await pending })
    expect(result.current.plateState.loading).toBe(false)
  })

  it('resetPlate puts back the saved plate', async () => {
    const { result } = await ready([{ id: 31, key: 'plate', value: 'AB12' }])
    act(() => result.current.setPlate('zzz'))
    expect(result.current.isPlateDirty).toBe(true)
    act(() => result.current.resetPlate())
    expect(result.current.plate).toBe('AB12')
    expect(result.current.isPlateDirty).toBe(false)
  })
})

describe('useDriverPlate · errors are always a text (M-UF5, M-UF18)', () => {
  const failing = async (answer) => {
    const view = await ready([])
    act(() => view.result.current.setPlate('abc'))
    if (typeof answer === 'function') fetchMock.mockImplementationOnce(answer)
    else fetchMock.mockResolvedValueOnce(answer)
    let saved
    await act(async () => { saved = await view.result.current.savePlate() })
    return { saved, error: view.result.current.plateState.error, loading: view.result.current.plateState.loading }
  }

  it.each([
    ['a text', 'Plate already used', 'Plate already used'],
    ['a list of texts', ['Plate already used', 'Other'], 'Plate already used'],
    ['an object', { code: 500 }, fallbackText],
    ['an empty list', [], fallbackText],
    ['nothing', undefined, fallbackText]
  ])('an API error that is %s', async (_label, result, expected) => {
    const { saved, error, loading } = await failing(reply({ error: true, result }))
    expect(saved).toBe(false)
    expect(error).toBe(expected)
    expect(loading).toBe(false)
  })

  it('a non-2xx answer whose body has no `error` is an error', async () => {
    const { saved, error } = await failing(reply({ message: 'Bad gateway' }, { ok: false, status: 502 }))
    expect(saved).toBe(false)
    expect(typeof error).toBe('string')
    expect(error).not.toBe('')
  })

  it('a non-2xx answer with a body that is not JSON is an error too', async () => {
    const { saved, error } = await failing({ ok: false, status: 500, json: async () => { throw new SyntaxError('Unexpected token <') } })
    expect(saved).toBe(false)
    expect(error).toBe('Unexpected token <')
  })

  it('a request that fails to leave says why', async () => {
    const { saved, error } = await failing(() => Promise.reject(new Error('Failed to fetch')))
    expect(saved).toBe(false)
    expect(error).toBe('Failed to fetch')
  })

  it('an error object without a message is the generic text', async () => {
    const { error } = await failing(() => Promise.reject({ code: 1 })) // eslint-disable-line prefer-promise-reject-errors
    expect(error).toBe(fallbackText)
  })

  it('reading follows the same rules: a non-2xx answer is an error and the plate stays empty', async () => {
    fetchMock.mockResolvedValueOnce(reply({ message: 'Down' }, { ok: false, status: 503 }))
    const { result } = renderHook(() => useDriverPlate(5))
    await waitFor(() => expect(result.current.plateState.loading).toBe(false))
    expect(typeof result.current.plateState.error).toBe('string')
    expect(result.current.plateState.error).not.toBe('')
    expect(result.current.plate).toBe('')
  })

  it('a new save starts without the old error', async () => {
    const view = await ready([])
    act(() => view.result.current.setPlate('abc'))
    fetchMock.mockResolvedValueOnce(reply({ error: true, result: 'Nope' }))
    await act(async () => { await view.result.current.savePlate() })
    expect(view.result.current.plateState.error).toBe('Nope')
    fetchMock.mockResolvedValueOnce(reply({ error: false, result: { id: 1 } }))
    await act(async () => { await view.result.current.savePlate() })
    expect(view.result.current.plateState.error).toBeNull()
  })
})

describe('useDriverPlate · late answers are ignored (M-UF18)', () => {
  it('an answer for the user before is dropped when the user changed', async () => {
    const late = deferred()
    fetchMock.mockReturnValueOnce(late.promise)
    const view = renderHook(({ id }) => useDriverPlate(id), { initialProps: { id: 5 } })
    fetchMock.mockResolvedValueOnce(reply({ error: false, result: [{ id: 2, key: 'plate', value: 'SIX' }] }))
    view.rerender({ id: 6 })
    await waitFor(() => expect(view.result.current.plate).toBe('SIX'))
    await act(async () => { late.resolve(reply({ error: false, result: [{ id: 1, key: 'plate', value: 'FIVE' }] })) })
    expect(view.result.current.plate).toBe('SIX')
    expect(view.result.current.plateState).toEqual({ loading: false, error: null })
  })

  it('a late error for the user before does not show on the new one', async () => {
    const late = deferred()
    fetchMock.mockReturnValueOnce(late.promise)
    const view = renderHook(({ id }) => useDriverPlate(id), { initialProps: { id: 5 } })
    fetchMock.mockResolvedValueOnce(reply({ error: false, result: [] }))
    view.rerender({ id: 6 })
    await waitFor(() => expect(view.result.current.plateState.loading).toBe(false))
    await act(async () => { late.resolve(reply({ error: true, result: 'Old failure' })) })
    expect(view.result.current.plateState.error).toBeNull()
  })

  it('the plate of the user before is not shown while the new one loads', async () => {
    const view = await ready([{ id: 1, key: 'plate', value: 'FIVE' }])
    const gate = deferred()
    fetchMock.mockReturnValueOnce(gate.promise)
    view.rerender({ id: 6 })
    expect(view.result.current.plate).toBe('')
    expect(view.result.current.isPlateDirty).toBe(false)
    await act(async () => { gate.resolve(reply({ error: false, result: [] })) })
  })

  it('a save that answers after the user changed does not touch the new user', async () => {
    const view = await ready([])
    act(() => view.result.current.setPlate('abc'))
    const late = deferred()
    fetchMock.mockReturnValueOnce(late.promise)
    let pending
    act(() => { pending = view.result.current.savePlate() })
    fetchMock.mockResolvedValueOnce(reply({ error: false, result: [{ id: 2, key: 'plate', value: 'SIX' }] }))
    view.rerender({ id: 6 })
    await waitFor(() => expect(view.result.current.plate).toBe('SIX'))
    await act(async () => { late.resolve(reply({ error: false, result: { id: 99 } })); await pending })
    expect(view.result.current.plate).toBe('SIX')
    expect(view.result.current.isPlateDirty).toBe(false)
    // the next save goes to the new user's own metafield
    act(() => view.result.current.setPlate('seven'))
    fetchMock.mockResolvedValueOnce(reply({ error: false, result: { id: 2 } }))
    await act(async () => { await view.result.current.savePlate() })
    expect(urls().at(-1)).toBe('https://api.example.test/v1/users/6/metafields/2')
  })

  it('leaving before the answer arrives is harmless', async () => {
    const late = deferred()
    fetchMock.mockReturnValueOnce(late.promise)
    const view = renderHook(() => useDriverPlate(5))
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    view.unmount()
    await act(async () => { late.resolve(reply({ error: true, result: 'Too late' })) })
    expect(errors).not.toHaveBeenCalled()
  })
})
