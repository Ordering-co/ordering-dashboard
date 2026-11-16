import { describe, expect, it } from 'vitest'
import {
  GOOGLE_ACTIONS_CURRENCY_SETTINGS_URL,
  GOOGLE_ACTIONS_REASON_SECTIONS,
  GOOGLE_ACTIONS_REASON_TABS,
  GOOGLE_ACTIONS_STATES,
  getDefaultGoogleSite,
  getGoogleActionsReasonLabels,
  getGoogleActionsState,
  getGoogleConsentAuthor,
  getGoogleSiteUrl,
  isGoogleActionsVisible,
  toGoogleActionsUtc
} from '../googleActions'

const custom = { id: 1, url: 'https://shop.ordering.co', domain: 'pedidos.marca.com', ssl_status: 'issued', business_url_template: 'store/:business_slug' }
const pending = { id: 2, url: 'https://marca.ordering.co', domain: 'nuevo.marca.com', ssl_status: 'pending' }
const http = { id: 3, url: 'http://insecure.test' }

describe('getGoogleActionsState', () => {
  it('shows the state the API gives, sent included', () => {
    expect(getGoogleActionsState({ google_actions_status: 'sent' })).toBe('sent')
    expect(getGoogleActionsState({ google_actions_status: 'ready' })).toBe('ready')
    expect(getGoogleActionsState({ google_actions_status: 'skipped', status_reason: 'no_schedule' })).toBe('skipped')
  })

  it('reads a store of the business list without google_actions as not activated', () => {
    expect(getGoogleActionsState({})).toBe('not_activated')
  })

  it('shows nothing for a store a project cannot activate yet, but keeps an activated one', () => {
    expect(getGoogleActionsState(null)).toBeNull()
    expect(getGoogleActionsState({ google_actions_status: 'not_activated', can_activate: false })).toBeNull()
    expect(getGoogleActionsState({ google_actions_status: 'sent', can_activate: false })).toBe('sent')
  })
})

describe('isGoogleActionsVisible', () => {
  it('shows the screens when the project can activate', () => {
    expect(isGoogleActionsVisible({ can_activate: true, counts: {} })).toBe(true)
  })

  it('keeps them while the project still has stores on Google', () => {
    expect(isGoogleActionsVisible({ can_activate: false, counts: { sent: 1 } })).toBe(true)
    expect(isGoogleActionsVisible({ can_activate: false, counts: { skipped: 2 } })).toBe(true)
  })

  it('hides them otherwise, and while there is no status', () => {
    expect(isGoogleActionsVisible({ can_activate: false, counts: { not_activated: 30 } })).toBe(false)
    expect(isGoogleActionsVisible(null)).toBe(false)
  })
})

describe('getGoogleSiteUrl', () => {
  it('builds the link as the API does', () => {
    expect(getGoogleSiteUrl(custom, 'centro')).toBe('https://pedidos.marca.com/store/centro')
    expect(getGoogleSiteUrl(pending, 'centro')).toBe('https://marca.ordering.co/centro')
  })

  it('has no link without https or without a slug', () => {
    expect(getGoogleSiteUrl(http, 'centro')).toBeNull()
    expect(getGoogleSiteUrl(custom, '')).toBeNull()
    expect(getGoogleSiteUrl(null, 'centro')).toBeNull()
  })
})

describe('getDefaultGoogleSite', () => {
  it('prefers the site with its own domain', () => {
    expect(getDefaultGoogleSite([http, pending, custom], 'centro')).toBe(custom)
  })

  it('falls back to the first usable site, or none', () => {
    expect(getDefaultGoogleSite([http, pending], 'centro')).toBe(pending)
    expect(getDefaultGoogleSite([http], 'centro')).toBeNull()
    expect(getDefaultGoogleSite(undefined, 'centro')).toBeNull()
  })
})

describe('the rest', () => {
  it('lists every state the API returns', () => {
    expect(GOOGLE_ACTIONS_STATES).toEqual(['sent', 'ready', 'processing', 'skipped', 'not_activated'])
  })

  it('points every fixable reason at a store section', () => {
    expect(GOOGLE_ACTIONS_REASON_SECTIONS.no_schedule).toBe('schedule')
    expect(GOOGLE_ACTIONS_REASON_SECTIONS.no_location).toBe('store_details')
    expect(GOOGLE_ACTIONS_REASON_SECTIONS.no_service).toBe('delivery_pickup_more')
  })

  it('opens the tab that holds what is missing, and no section for what no section edits', () => {
    expect(GOOGLE_ACTIONS_REASON_TABS.no_location).toBe('location')
    expect(GOOGLE_ACTIONS_REASON_TABS.no_name).toBe('information')
    expect(GOOGLE_ACTIONS_REASON_SECTIONS.no_currency).toBeNull()
  })

  it('sends a missing currency to the project setting, not to the store', () => {
    // the API reads only the project's stripe_currency
    expect(getGoogleActionsReasonLabels((key, fallback) => fallback).no_currency).toMatch(/^The project has no currency/)
    const url = new URL(GOOGLE_ACTIONS_CURRENCY_SETTINGS_URL, 'https://dashboard.test')
    expect(url.pathname).toBe('/settings')
    expect(Object.fromEntries(url.searchParams)).toEqual({ group: 'payments', category: 'stripe', focus: 'stripe_currency' })
  })

  it('sends a store without delivery or pickup time to where those times are set', () => {
    // Google rejects a service without lead_time
    expect(GOOGLE_ACTIONS_REASON_SECTIONS.no_lead_time).toBe('delivery_pickup_more')
    expect(getGoogleActionsReasonLabels((key, fallback) => fallback).no_lead_time).toMatch(/no delivery or pickup time/)
  })

  it('names who accepted the consent', () => {
    expect(getGoogleConsentAuthor({ consented_by_user: { name: 'Daniel', lastname: '' } })).toBe('Daniel')
    expect(getGoogleConsentAuthor({})).toBeNull()
  })
})

describe('toGoogleActionsUtc', () => {
  it('turns an API date into the UTC text getTimeAgo reads', () => {
    expect(toGoogleActionsUtc('2026-11-09T10:05:03-06:00')).toBe('2026-11-09 16:05:03')
    expect(toGoogleActionsUtc('2026-11-09 16:05:03')).toBe('2026-11-09 16:05:03')
  })

  it('gives nothing for a missing or invalid date', () => {
    expect(toGoogleActionsUtc(null)).toBeNull()
    expect(toGoogleActionsUtc('nope')).toBeNull()
  })
})
