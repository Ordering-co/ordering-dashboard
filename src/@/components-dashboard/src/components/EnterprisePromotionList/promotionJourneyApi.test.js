import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import {
  deletePromotionJourney,
  getAllPromotionBusinesses,
  getPromotionLoyaltyLevels,
  savePromotionJourney,
  updatePromotionJourneyStatus
} from './promotionJourneyApi'

describe('promotion journey API', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('creates a disabled draft and can atomically create an active promotion', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: false, result: { id: 7, enabled: false } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: false, result: { id: 8, enabled: true } }) })

    await savePromotionJourney({ root: 'https://api.test', token: 'token', payload: { name: 'Draft' }, enabled: false })
    await savePromotionJourney({ root: 'https://api.test', token: 'token', payload: { name: 'Active' }, enabled: true })

    expect(fetch.mock.calls[0][0]).toBe('https://api.test/offers')
    expect(JSON.parse(fetch.mock.calls[0][1].body).enabled).toBe(false)
    expect(JSON.parse(fetch.mock.calls[1][1].body).enabled).toBe(true)
  })

  test('updates only the supplied promotion fields and its intended status', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { id: 7, enabled: true, rate: 20 } }) })
    await savePromotionJourney({ root: 'https://api.test', token: 'token', payload: { rate: 20 }, promotionId: 7, enabled: true })
    expect(fetch).toHaveBeenCalledWith('https://api.test/offers/7', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ rate: 20, enabled: true })
    }))
  })

  test('can explicitly disable an existing promotion', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ error: false, result: { id: 7, enabled: false } }) })
    await updatePromotionJourneyStatus({ root: 'https://api.test', token: 'token', promotionId: 7, enabled: false })
    expect(fetch).toHaveBeenCalledWith('https://api.test/offers/7', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ enabled: false })
    }))
  })

  test('deletes an existing promotion and accepts an empty successful response', async () => {
    fetch.mockResolvedValue({ ok: true, status: 204 })
    await expect(deletePromotionJourney({ root: 'https://api.test', token: 'token', promotionId: 7 })).resolves.toEqual({ id: 7 })
    expect(fetch).toHaveBeenCalledWith('https://api.test/offers/7', expect.objectContaining({ method: 'DELETE' }))
  })

  test('keeps API errors explicit for the builder', async () => {
    fetch.mockResolvedValue({ ok: false, json: async () => ({ error: true, result: ['Invalid scope'] }) })
    await expect(savePromotionJourney({ root: 'https://api.test', token: 'token', payload: {} })).rejects.toThrow('Invalid scope')
  })

  test('loads loyalty levels through the existing endpoint', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ error: false, result: [{ id: 2, name: 'Gold' }] }) })
    await expect(getPromotionLoyaltyLevels({ root: 'https://api.test', token: 'token' })).resolves.toEqual([{ id: 2, name: 'Gold' }])
  })

  test('loads every page of businesses and surfaces a failed page for retry', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: false, result: [{ id: 10 }], pagination: { total_pages: 2 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: false, result: [{ id: 11 }], pagination: { total_pages: 2 } }) })

    const ordering = { root: 'https://api.test' }
    await expect(getAllPromotionBusinesses({ ordering, token: 'token', userLevel: 0, pageSize: 34 })).resolves.toEqual([{ id: 10 }, { id: 11 }])
    expect(fetch.mock.calls[1][0]).toContain('page=2&page_size=34')

    fetch.mockReset()
    fetch.mockResolvedValue({ ok: false, json: async () => ({ result: ['Businesses unavailable'] }) })
    await expect(getAllPromotionBusinesses({ ordering, token: 'token', userLevel: 0 })).rejects.toThrow('Businesses unavailable')
  })
})
