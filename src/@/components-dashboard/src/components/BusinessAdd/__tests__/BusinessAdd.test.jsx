/* eslint-disable import/first */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign the store add controller. Same requests as main; every answer read; a retry never creates a second store.

const ROOT = 'https://api.test/v400/en/dev'
const ordering = vi.hoisted(() => ({ value: null }))
const showToast = vi.hoisted(() => vi.fn())

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'test-token', user: { id: 7, email: 'owner@example.com' } }] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [ordering.value] }))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (key, text) => text] }))

import { BusinessAdd } from '..'

const PAYMETHODS = [
  { id: 1, gateway: 'cash', name: 'Cash' },
  { id: 2, gateway: 'paypal', name: 'PayPal' },
  { id: 3, gateway: 'stripe_direct', name: 'Stripe direct' }
]
const COUNTRIES = [{ enabled: true, code: 'US', cities: [{ id: 11, name: 'New York' }, { id: 12, name: 'Boston' }] }]

const fetchMock = vi.fn()
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body })

const makeOrdering = (saveAnswers) => {
  const save = vi.fn(async () => ({ content: saveAnswers.length > 1 ? saveAnswers.shift() : saveAnswers[0] }))
  return {
    root: ROOT,
    appId: 'dashboard',
    appInternalName: 'dashboard',
    businesses: vi.fn(() => ({ save })),
    countries: vi.fn(() => ({ select: () => ({ get: async () => ({ content: { error: false, result: COUNTRIES } }) }) })),
    save
  }
}

let props
const UI = (uiProps) => { props = uiProps; return null }
const writes = () => fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST').map(([url, options]) => ({ url: url.replace(ROOT, ''), body: JSON.parse(options.body) }))

beforeEach(() => {
  props = null
  fetchMock.mockReset()
  showToast.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

const mount = async (extra = {}) => {
  render(<BusinessAdd UIComponent={UI} {...extra} />)
  await waitFor(() => expect(props.paymethodsList.loading).toBe(false))
  await waitFor(() => expect(props.citiesLoading).toBe(false))
}

const fill = () => act(() => { props.changeFields({ name: 'Pizza Place', slug: 'pizzaplace' }) })

describe('BusinessAdd controller', () => {
  it('starts with the user email held (G5-21), the first offered method and the first city (G5-24)', async () => {
    ordering.value = makeOrdering([{ error: false, result: { id: 90, slug: 'pizzaplace' } }])
    fetchMock.mockResolvedValue(json({ error: false, result: PAYMETHODS }))
    await mount()
    expect(props.form.email).toBe('owner@example.com')
    expect(props.paymethodsList.paymethods.map(p => p.gateway)).toEqual(['cash', 'paypal'])
    expect(props.paymethodIds).toEqual([1])
    expect(props.cityId).toBe(11)
  })

  // review: Google's photos and a pick of the user in the same tick both stay
  it('a gallery change given as a function applies to the latest gallery', async () => {
    ordering.value = makeOrdering([{ error: false, result: { id: 90, slug: 'pizzaplace' } }])
    fetchMock.mockResolvedValue(json({ error: false, result: PAYMETHODS }))
    await mount()
    act(() => {
      props.changeGallery(previous => [...previous, { temp_id: 'a', file: 'data:a' }])
      props.changeGallery(previous => [...previous, { temp_id: 'b', file: 'data:b' }])
    })
    expect(props.gallery.map(photo => photo.temp_id)).toEqual(['a', 'b'])
  })

  it('refuses to create with problems and says which (G5-20, SA-02)', async () => {
    ordering.value = makeOrdering([{ error: false, result: { id: 90, slug: 'pizzaplace' } }])
    fetchMock.mockResolvedValue(json({ error: false, result: PAYMETHODS }))
    await mount()
    let result
    await act(async () => { result = await props.submit() })
    expect(result.ok).toBe(false)
    expect(result.problems).toEqual({ name: 'required', slug: 'required' })
    expect(ordering.value.save).not.toHaveBeenCalled()
  })

  it('creates the store and its follow-up writes with main\'s bodies, then goes to Products', async () => {
    ordering.value = makeOrdering([{ error: false, result: { id: 90, slug: 'pizzaplace' } }])
    fetchMock.mockImplementation(async (url, options) => options?.method === 'POST'
      ? json({ error: false, result: { id: 1 } })
      : json({ error: false, result: PAYMETHODS }))
    const handleOpenCategory = vi.fn()
    await mount({ handleOpenCategory })
    fill()
    act(() => { props.changePaymethodIds([1, 2]) })
    act(() => { props.changeGallery([{ temp_id: 'a', file: 'data:image/png;base64,AA' }]) })
    act(() => { props.changeZone({ name: 'Downtown', type: 4, minimum: '0', price: '0' }) })
    await act(async () => { await props.submit() })
    const body = ordering.value.save.mock.calls[0][0]
    expect(body).toMatchObject({ name: 'Pizza Place', slug: 'pizzaplace', email: 'owner@example.com', minimum: 0, enabled: true, owner_id: 7, city_id: 11 })
    expect(body.schedule).toHaveLength(7)
    expect(writes()).toEqual([
      { url: '/business/90/paymethods', body: { enabled: true, paymethod_id: 1, sandbox: false } },
      { url: '/business/90/paymethods', body: { enabled: true, paymethod_id: 2, sandbox: true } },
      { url: '/business/90/gallery', body: { business_id: 90, file: 'data:image/png;base64,AA', type: 1 } },
      expect.objectContaining({ url: '/business/90/deliveryzones', body: expect.objectContaining({ name: 'Downtown', type: 4, minimum: '0', price: '0', enabled: true }) })
    ])
    expect(props.submitState.status).toBe('created')
    expect(handleOpenCategory).toHaveBeenCalledWith('pizzaplace')
    expect(showToast).toHaveBeenCalledWith('success', 'Business added')
  })

  it('says what failed after the store was created and retries only that, never creating a second store (G5-23, SA-01)', async () => {
    ordering.value = makeOrdering([{ error: false, result: { id: 90, slug: 'pizzaplace' } }])
    let failPayments = true
    fetchMock.mockImplementation(async (url, options) => {
      if (options?.method !== 'POST') return json({ error: false, result: PAYMETHODS })
      if (url.endsWith('/paymethods') && failPayments) throw new TypeError('Failed to fetch')
      return json({ error: false, result: { id: 1 } })
    })
    const handleOpenCategory = vi.fn()
    await mount({ handleOpenCategory })
    fill()
    act(() => { props.changeZone({ name: 'Downtown', type: 4, minimum: '1', price: '2' }) })
    await act(async () => { await props.submit() })
    expect(props.submitState.status).toBe('partial')
    expect(props.submitState.jobs.map(job => [job.key, job.status])).toEqual([['paymethod:1', 'failed'], ['zone', 'done']])
    expect(handleOpenCategory).not.toHaveBeenCalled()

    failPayments = false
    fetchMock.mockClear()
    await act(async () => { await props.submit() })
    expect(ordering.value.save).toHaveBeenCalledTimes(1)
    expect(writes().map(write => write.url)).toEqual(['/business/90/paymethods'])
    expect(props.submitState.status).toBe('created')
    expect(handleOpenCategory).toHaveBeenCalledWith('pizzaplace')
  })

  it('a retry does not repeat a write that reached the API (the method is already linked)', async () => {
    ordering.value = makeOrdering([{ error: false, result: { id: 90, slug: 'pizzaplace' } }])
    let linked = false
    fetchMock.mockImplementation(async (url, options) => {
      if (url.endsWith('/business/90/paymethods') && options?.method === 'GET') return json({ error: false, result: linked ? [{ id: 5, paymethod_id: 1 }] : [] })
      if (options?.method !== 'POST') return json({ error: false, result: PAYMETHODS })
      if (url.endsWith('/paymethods')) { linked = true; throw new TypeError('Failed to fetch') }
      return json({ error: false, result: { id: 1 } })
    })
    await mount({ handleOpenCategory: vi.fn() })
    fill()
    await act(async () => { await props.submit() })
    expect(props.submitState.status).toBe('partial')
    fetchMock.mockClear()
    await act(async () => { await props.retry() })
    expect(writes()).toEqual([])
    expect(props.submitState.status).toBe('created')
  })

  it('after a network failure of POST /business, the next try finds the store by its slug instead of creating it again', async () => {
    ordering.value = makeOrdering([{ error: false, result: { id: 90, slug: 'pizzaplace' } }])
    ordering.value.save.mockImplementationOnce(async () => { throw new TypeError('Failed to fetch') })
    fetchMock.mockImplementation(async (url, options) => {
      if (url.includes('/business?where=')) return json({ error: false, result: [{ id: 90, slug: 'pizzaplace', name: 'Pizza Place', owner_id: 7 }] })
      if (options?.method === 'POST') return json({ error: false, result: { id: 1 } })
      return json({ error: false, result: PAYMETHODS })
    })
    const handleOpenCategory = vi.fn()
    await mount({ handleOpenCategory })
    fill()
    await act(async () => { await props.submit() })
    expect(props.submitState).toMatchObject({ status: 'editing', error: { network: true } })
    await act(async () => { await props.submit() })
    expect(ordering.value.save).toHaveBeenCalledTimes(1)
    expect(writes().map(write => write.url)).toEqual(['/business/90/paymethods'])
    expect(handleOpenCategory).toHaveBeenCalledWith('pizzaplace')
  })

  it('after a network failure, a store of someone else with that slug is never taken; the attempt survives an edit (review 1-2)', async () => {
    ordering.value = makeOrdering([{ error: true, result: ['The slug has already been taken.'] }])
    ordering.value.save.mockImplementationOnce(async () => { throw new TypeError('Failed to fetch') })
    const lookups = []
    fetchMock.mockImplementation(async (url, options) => {
      if (url.includes('/business?where=')) { lookups.push(decodeURIComponent(url)); return json({ error: false, result: [{ id: 5, slug: 'pizzaplace', name: 'Pizza Place', owner_id: 99 }] }) }
      if (options?.method === 'POST') return json({ error: false, result: { id: 1 } })
      return json({ error: false, result: PAYMETHODS })
    })
    const handleOpenCategory = vi.fn()
    await mount({ handleOpenCategory })
    fill()
    await act(async () => { await props.submit() })
    act(() => { props.changeFields({ name: 'Pizza Palace', slug: 'pizzapalace' }) })
    expect(props.submitState.error).toBe(null)
    await act(async () => { await props.submit() })
    expect(lookups.some(url => url.includes('"pizzaplace"'))).toBe(true)
    expect(writes().map(write => write.url)).not.toContain('/business/5/paymethods')
    expect(ordering.value.save).toHaveBeenCalledTimes(2)
    expect(handleOpenCategory).not.toHaveBeenCalled()
  })

  // bugs E 40a: what the user edits after a network failure is applied to the store the failed attempt created
  describe('edits made after a network failure of POST /business (40a)', () => {
    const ownLookup = (url, options) => {
      if (url.includes('/business?where=')) return json({ error: false, result: [{ id: 90, slug: 'pizzaplace', name: 'Pizza Place', owner_id: 7 }] })
      if (options?.method === 'POST') return json({ error: false, result: { id: 1 } })
      return json({ error: false, result: PAYMETHODS })
    }
    const failFirst = async (extra = {}) => {
      ordering.value = makeOrdering([{ error: false, result: { id: 90, slug: 'pizzaplace' } }])
      ordering.value.save.mockImplementationOnce(async () => { throw new TypeError('Failed to fetch') })
      const handleOpenCategory = vi.fn()
      await mount({ handleOpenCategory, ...extra })
      fill()
      await act(async () => { await props.submit() })
      expect(props.submitState).toMatchObject({ status: 'editing', error: { network: true } })
      return handleOpenCategory
    }

    it('finds the store by what was sent, then saves what changed since (email, address, schedule, name and slug) on that store', async () => {
      fetchMock.mockImplementation(async (url, options) => ownLookup(url, options))
      const handleOpenCategory = await failFirst()
      const lookups = []
      fetchMock.mockImplementation(async (url, options) => { if (url.includes('/business?where=')) lookups.push(decodeURIComponent(url)); return ownLookup(url, options) })
      const schedule = props.schedule.map((day, index) => (index === 0 ? { ...day, enabled: false } : day))
      act(() => { props.changeFields({ name: 'Pizza Palace', slug: 'pizzapalace', email: 'new@example.com', address: '1 Main St' }) })
      act(() => { props.changeSchedule(schedule) })
      await act(async () => { await props.submit() })
      expect(lookups).toHaveLength(1)
      expect(lookups[0]).toContain('"pizzaplace"')
      expect(ordering.value.save).toHaveBeenCalledTimes(2)
      expect(ordering.value.businesses).toHaveBeenLastCalledWith(90)
      expect(ordering.value.save).toHaveBeenLastCalledWith(
        { name: 'Pizza Palace', slug: 'pizzapalace', email: 'new@example.com', address: '1 Main St', schedule },
        { accessToken: 'test-token' }
      )
      expect(writes().map(write => write.url)).toEqual(['/business/90/paymethods'])
      expect(props.submitState.status).toBe('created')
      expect(handleOpenCategory).toHaveBeenCalledWith('pizzapalace')
    })

    it('sends no update when nothing changed since the failed attempt', async () => {
      fetchMock.mockImplementation(async (url, options) => ownLookup(url, options))
      await failFirst()
      await act(async () => { await props.submit() })
      expect(ordering.value.save).toHaveBeenCalledTimes(1)
      expect(props.submitState.status).toBe('created')
    })

    it('an update that the API refuses counts as «created, this is missing»; Try again repeats only the update', async () => {
      fetchMock.mockImplementation(async (url, options) => ownLookup(url, options))
      const handleOpenCategory = await failFirst()
      ordering.value.save.mockImplementationOnce(async () => ({ content: { error: true, result: ['The slug has already been taken.'] } }))
      act(() => { props.changeFields({ slug: 'pizzapalace' }) })
      await act(async () => { await props.submit() })
      expect(props.submitState.status).toBe('partial')
      expect(props.submitState.business).toMatchObject({ id: 90, slug: 'pizzaplace' })
      expect(props.submitState.jobs.map(job => [job.key, job.status])).toEqual([['details', 'failed'], ['paymethod:1', 'done']])
      expect(props.submitState.jobs[0].error).toBe('The slug has already been taken.')
      expect(handleOpenCategory).not.toHaveBeenCalled()

      fetchMock.mockClear()
      await act(async () => { await props.retry() })
      expect(ordering.value.save).toHaveBeenCalledTimes(3)
      expect(ordering.value.save).toHaveBeenLastCalledWith({ slug: 'pizzapalace' }, { accessToken: 'test-token' })
      expect(writes()).toEqual([])
      expect(props.submitState.status).toBe('created')
      expect(handleOpenCategory).toHaveBeenCalledWith('pizzapalace')
    })

    it('an update that fails on the network also keeps the store and offers Try again', async () => {
      fetchMock.mockImplementation(async (url, options) => ownLookup(url, options))
      await failFirst()
      ordering.value.save.mockImplementationOnce(async () => { throw new TypeError('Failed to fetch') })
      act(() => { props.changeFields({ email: 'new@example.com' }) })
      await act(async () => { await props.submit() })
      expect(props.submitState.status).toBe('partial')
      expect(props.submitState.jobs.find(job => job.key === 'details')).toMatchObject({ status: 'failed' })
      await act(async () => { await props.submit() })
      expect(props.submitState.status).toBe('created')
      expect(ordering.value.save).toHaveBeenCalledTimes(3)
    })
  })

  it('when the lookup after a network failure fails too, nothing is sent again', async () => {
    ordering.value = makeOrdering([{ error: false, result: { id: 90, slug: 'pizzaplace' } }])
    ordering.value.save.mockImplementationOnce(async () => { throw new TypeError('Failed to fetch') })
    fetchMock.mockImplementation(async (url, options) => {
      if (url.includes('/business?where=')) throw new TypeError('Failed to fetch')
      if (options?.method === 'POST') return json({ error: false, result: { id: 1 } })
      return json({ error: false, result: PAYMETHODS })
    })
    await mount({ handleOpenCategory: vi.fn() })
    fill()
    await act(async () => { await props.submit() })
    await act(async () => { await props.submit() })
    expect(ordering.value.save).toHaveBeenCalledTimes(1)
    expect(props.submitState).toMatchObject({ status: 'editing', error: { network: true } })
  })

  it('finds its own store after a network failure even when the API trimmed the name and answers owner_id as text', async () => {
    ordering.value = makeOrdering([{ error: false, result: { id: 90, slug: 'pizzaplace' } }])
    ordering.value.save.mockImplementationOnce(async () => { throw new TypeError('Failed to fetch') })
    fetchMock.mockImplementation(async (url, options) => {
      if (url.includes('/business?where=')) return json({ error: false, result: [{ id: 90, slug: 'pizzaplace', name: 'pizza place', owner_id: '7' }] })
      if (options?.method === 'POST') return json({ error: false, result: { id: 1 } })
      return json({ error: false, result: PAYMETHODS })
    })
    const handleOpenCategory = vi.fn()
    await mount({ handleOpenCategory })
    act(() => { props.changeFields({ name: ' Pizza Place ', slug: 'pizzaplace' }) })
    await act(async () => { await props.submit() })
    await act(async () => { await props.submit() })
    expect(ordering.value.save).toHaveBeenCalledTimes(1)
    expect(handleOpenCategory).toHaveBeenCalledWith('pizzaplace')
  })

  it('an answer without a store is treated as unclear (looked up next time), and a navigation that throws keeps «created»', async () => {
    ordering.value = makeOrdering([{ error: false, result: null }, { error: false, result: { id: 92, slug: 'pizzaplace' } }])
    let lookups = 0
    fetchMock.mockImplementation(async (url, options) => {
      if (url.includes('/business?where=')) { lookups += 1; return json({ error: false, result: [] }) }
      if (options?.method === 'POST') return json({ error: false, result: { id: 1 } })
      return json({ error: false, result: PAYMETHODS })
    })
    const handleOpenCategory = vi.fn(() => { throw new Error('router') })
    await mount({ handleOpenCategory })
    fill()
    await act(async () => { await props.submit() })
    expect(props.submitState).toMatchObject({ status: 'editing', error: { network: true } })
    await act(async () => { await props.submit() })
    expect(lookups).toBe(1)
    expect(ordering.value.save).toHaveBeenCalledTimes(2)
    expect(props.submitState.status).toBe('created')
  })

  it('keeps the form and the API message when the store is refused; onCreated replaces the redirect', async () => {
    ordering.value = makeOrdering([{ error: true, result: ['The slug has already been taken.'] }, { error: false, result: { id: 91, slug: 'pizzaplace2' } }])
    fetchMock.mockImplementation(async (url, options) => options?.method === 'POST' ? json({ error: false, result: {} }) : json({ error: false, result: PAYMETHODS }))
    const onCreated = vi.fn()
    const handleOpenCategory = vi.fn()
    await mount({ onCreated, handleOpenCategory })
    fill()
    await act(async () => { await props.submit() })
    expect(props.submitState).toMatchObject({ status: 'editing', error: { messages: ['The slug has already been taken.'] } })
    expect(props.form.name).toBe('Pizza Place')
    act(() => { props.changeFields({ slug: 'pizzaplace2' }) })
    expect(props.submitState.error).toBe(null)
    await act(async () => { await props.submit() })
    expect(onCreated).toHaveBeenCalledWith({ id: 91, slug: 'pizzaplace2' })
    expect(handleOpenCategory).not.toHaveBeenCalled()
  })
})
