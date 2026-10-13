import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchMenuImportSync,
  getMenuImportSyncLogUrl,
  logMenuImportSync,
  parseStoredSourceUrl,
  resolveMenuImportSourceUrl
} from '../logMenuImportSync'

describe('resolveMenuImportSourceUrl', () => {
  it('resolves DoorDash and Uber Eats urls', () => {
    expect(resolveMenuImportSourceUrl('doordash', {
      doordashUrl: 'https://www.doordash.com/store/a'
    })).toBe('https://www.doordash.com/store/a')
    expect(resolveMenuImportSourceUrl('ubereats', {
      url: 'https://www.ubereats.com/store/b'
    })).toBe('https://www.ubereats.com/store/b')
  })

  it('builds a synthetic ordering-plus ref when structured ids are used', () => {
    expect(resolveMenuImportSourceUrl('ordering', {
      orderingPlusProjectId: 'demo',
      orderingBusinessSegment: 'pizza'
    })).toBe('ordering-plus://demo/pizza')
  })
})

describe('parseStoredSourceUrl', () => {
  it('parses ordering-plus refs into structured fields', () => {
    expect(parseStoredSourceUrl('ordering-plus://demo/pizza')).toEqual({
      url: '',
      orderingPlusProjectId: 'demo',
      orderingBusinessSegment: 'pizza'
    })
  })

  it('keeps normal urls in the url field', () => {
    expect(parseStoredSourceUrl('https://www.ubereats.com/store/b')).toEqual({
      url: 'https://www.ubereats.com/store/b',
      orderingPlusProjectId: '',
      orderingBusinessSegment: ''
    })
  })
})

describe('logMenuImportSync', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.test')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    vi.stubEnv('VITE_MENU_IMPORT_SYNC_LOG_URL', '')
    global.fetch = vi.fn().mockResolvedValue({ ok: true })
  })

  it('posts gloriafood restaurant + master keys as upsert without source_url', () => {
    expect(getMenuImportSyncLogUrl()).toBe(
      'https://supabase.test/functions/v1/menu-import-sync-log'
    )

    logMenuImportSync({
      token: 'ordering-jwt',
      source: 'gloriafood',
      params: {
        businessIds: [99],
        project: 'demo',
        orderingApiBaseUrl: 'https://api.example.com',
        gloriafoodRestaurantKey: 'res-1',
        gloriafoodMasterKey: 'mas-1'
      }
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/menu-import-sync-log',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer anon-key',
          apikey: 'anon-key',
          'x-finitless-token': 'ordering-jwt'
        }),
        body: JSON.stringify({
          action: 'upsert',
          business_id: 99,
          project: 'demo',
          source: 'gloriafood',
          ordering_api_base_url: 'https://api.example.com',
          gloriafood_restaurant_key: 'res-1',
          gloriafood_master_key: 'mas-1'
        })
      })
    )
  })

  it('skips when supabase env is missing', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    logMenuImportSync({
      token: 'ordering-jwt',
      source: 'doordash',
      params: {
        businessIds: [1],
        project: 'demo',
        orderingApiBaseUrl: 'https://api.example.com',
        doordashUrl: 'https://www.doordash.com/store/a'
      }
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe('fetchMenuImportSync', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.test')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    global.fetch = vi.fn()
  })

  it('returns the saved event for business+project+source', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        event: {
          source: 'ubereats',
          source_url: 'https://www.ubereats.com/store/b'
        }
      })
    })

    const event = await fetchMenuImportSync({
      token: 'ordering-jwt',
      businessId: 2806,
      project: 'luisv4plus',
      source: 'ubereats',
      orderingApiBaseUrl: 'https://api.example.com'
    })

    expect(event.source_url).toBe('https://www.ubereats.com/store/b')
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({
      action: 'get',
      business_id: 2806,
      project: 'luisv4plus',
      source: 'ubereats',
      ordering_api_base_url: 'https://api.example.com'
    })
  })
})
