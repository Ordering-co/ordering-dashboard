/* eslint-disable import/first */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

// redesign CA-B1 (M-CA5, M-CA12, M-CA13): outcomes instead of silence, per-request overrides of the create payload
const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  session: { token: 'token' },
  ordering: { root: 'https://api.test' },
  fetch: null,
  post: null,
  del: null
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [mocks.session] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [mocks.ordering] }))
vi.mock('../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useToast: () => [null, { showToast: mocks.showToast }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [null, (_key, fallback) => fallback] }))

import { CampaignDetail } from '..'

const json = (body) => ({ json: async () => body })

// Routes by URL and method; create (POST /marketing_campaigns) and delete go through mocks.post / mocks.del.
const route = async (url, options = {}) => {
  if (url.endsWith('/marketing_campaigns/audience')) return json({ error: false, result: 0, pagination: {} })
  if (url.includes('/config_categories')) return json({ error: false, result: [] })
  if (options.method === 'POST' && url === 'https://api.test/marketing_campaigns') return mocks.post()
  if (options.method === 'DELETE') return mocks.del()
  return json({ error: false, result: {} })
}

const requestsOf = (method) => mocks.fetch.mock.calls.filter(([, options]) => options?.method === method)

const renderDetail = async (props = {}) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  const campaign = props.campaign ?? {}
  render(<CampaignDetail UIComponent={UIComponent} {...props} campaign={campaign} />)
  if (Object.keys(campaign).length === 0) {
    await waitFor(() => expect(ui.current.formState.changes.status).toBe('pending'))
  } else {
    await waitFor(() => expect(ui.current.campaignState.campaign.id).toBe(campaign.id))
  }
  return ui
}

describe('CampaignDetail · handleAddCampaign (CA-B1 / M-CA12 / M-CA13)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.post = vi.fn(async () => json({ error: false, result: { id: 11, name: 'Promo' } }))
    mocks.del = vi.fn(async () => json({ error: false, result: { id: 5 } }))
    mocks.fetch = vi.fn(route)
    vi.stubGlobal('fetch', mocks.fetch)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('without arguments the body is exactly today (pin), and it resolves { ok: true, error: null, result }', async () => {
    const onClose = vi.fn()
    const handleSuccessAddCampaign = vi.fn()
    const ui = await renderDetail({ onClose, handleSuccessAddCampaign })
    await act(async () => { ui.current.handleChangeItem('name', 'Promo') })
    await act(async () => { ui.current.handleChangeItem('scheduled_at', '2026-10-10 10:00:00') })
    await act(async () => { ui.current.handleChangeItem('contact_data', { subject: 'Hi' }) })

    let outcome
    await act(async () => { outcome = await ui.current.handleAddCampaign() })

    expect(outcome).toEqual({ ok: true, error: null, result: { id: 11, name: 'Promo' } })
    const [[url, options]] = requestsOf('POST').filter(([target]) => target === 'https://api.test/marketing_campaigns')
    expect(url).toBe('https://api.test/marketing_campaigns')
    expect(options.body).toBe(JSON.stringify({
      enabled: true,
      conditions: '[]',
      status: 'scheduled',
      name: 'Promo',
      scheduled_at: '2026-10-10 10:00:00',
      contact_data: '{"subject":"Hi"}'
    }))
    expect(handleSuccessAddCampaign).toHaveBeenCalledWith({ id: 11, name: 'Promo' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mocks.showToast).toHaveBeenCalledWith('INFO', 'Loading')
    expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Campaign added')
    expect(ui.current.formState.loading).toBe(false)
    expect(ui.current.formState.error).toBeNull()
  })

  it('overrides merge over formState.changes for that request only: null values travel in the body', async () => {
    const ui = await renderDetail()
    await act(async () => { ui.current.handleChangeItem('name', 'Promo') })
    const changesBefore = ui.current.formState.changes

    await act(async () => { await ui.current.handleAddCampaign({ scheduled_at: null, end_at: null }) })

    const [, options] = requestsOf('POST').find(([target]) => target === 'https://api.test/marketing_campaigns')
    expect(JSON.parse(options.body)).toEqual({
      enabled: true, conditions: '[]', status: 'pending', name: 'Promo', scheduled_at: null, end_at: null
    })
    expect(Object.keys(JSON.parse(options.body))).toEqual(expect.arrayContaining(['scheduled_at', 'end_at']))
    expect(ui.current.formState.changes).toEqual(changesBefore)
    expect(ui.current.formState.changes).not.toHaveProperty('end_at')
  })

  it('an override with value undefined removes that key from the body', async () => {
    const ui = await renderDetail()
    await act(async () => { ui.current.handleChangeItem('end_at', '2026-12-31 23:59:00') })
    await act(async () => { ui.current.handleChangeItem('scheduled_at', '2026-10-10 10:00:00') })
    expect(ui.current.formState.changes.end_at).toBe('2026-12-31 23:59:00')

    await act(async () => { await ui.current.handleAddCampaign({ end_at: undefined }) })

    const [, options] = requestsOf('POST').find(([target]) => target === 'https://api.test/marketing_campaigns')
    expect(options.body).not.toContain('end_at')
    expect(JSON.parse(options.body)).toHaveProperty('scheduled_at', '2026-10-10 10:00:00')
    expect(Object.keys(JSON.parse(options.body))).not.toContain('end_at')
    // the form keeps what the user typed
    expect(ui.current.formState.changes.end_at).toBe('2026-12-31 23:59:00')
  })

  it('object overrides are serialized like object changes', async () => {
    const ui = await renderDetail()
    await act(async () => { await ui.current.handleAddCampaign({ contact_data: { subject: 'Clean' }, conditions: [{ type: 'a' }] }) })

    const [, options] = requestsOf('POST').find(([target]) => target === 'https://api.test/marketing_campaigns')
    expect(JSON.parse(options.body)).toMatchObject({ contact_data: '{"subject":"Clean"}', conditions: '[{"type":"a"}]' })
  })

  it('resolves { ok: false, error } on an API error, keeps formState.error, and does not close or notify', async () => {
    mocks.post = vi.fn(async () => json({ error: true, result: ['Name is required'] }))
    const onClose = vi.fn()
    const handleSuccessAddCampaign = vi.fn()
    const ui = await renderDetail({ onClose, handleSuccessAddCampaign })

    let outcome
    await act(async () => { outcome = await ui.current.handleAddCampaign() })

    expect(outcome).toEqual({ ok: false, error: ['Name is required'] })
    expect(ui.current.formState.error).toEqual(['Name is required'])
    expect(ui.current.formState.loading).toBe(false)
    expect(handleSuccessAddCampaign).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(mocks.showToast).not.toHaveBeenCalledWith('SUCCESS', 'Campaign added')
  })

  it('resolves { ok: false, error: message } when the request throws, and records it in formState.error', async () => {
    mocks.post = vi.fn(async () => { throw new Error('network down') })
    const ui = await renderDetail()

    let outcome
    await act(async () => { outcome = await ui.current.handleAddCampaign() })

    expect(outcome).toEqual({ ok: false, error: 'network down' })
    expect(ui.current.formState.error).toBe('network down')
  })
})

describe('CampaignDetail · handleDeleteCampaign (CA-B1 / M-CA5)', () => {
  const campaign = { id: 5, name: 'Old', contact_type: 'email', conditions: [] }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.post = vi.fn(async () => json({ error: false, result: {} }))
    mocks.del = vi.fn(async () => json({ error: false, result: { id: 5 } }))
    mocks.fetch = vi.fn(route)
    vi.stubGlobal('fetch', mocks.fetch)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves { ok: true, error: null }, calls handleSuccessDeleteCampaign(id) and closes, as before', async () => {
    const onClose = vi.fn()
    const handleSuccessDeleteCampaign = vi.fn()
    const ui = await renderDetail({ campaign, onClose, handleSuccessDeleteCampaign })

    let outcome
    await act(async () => { outcome = await ui.current.handleDeleteCampaign() })

    expect(outcome).toEqual({ ok: true, error: null })
    expect(requestsOf('DELETE')[0][0]).toBe('https://api.test/marketing_campaigns/5')
    expect(handleSuccessDeleteCampaign).toHaveBeenCalledWith(5)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Campaign deleted')
  })

  it('resolves { ok: false, error } on an API error and does not remove the row', async () => {
    mocks.del = vi.fn(async () => json({ error: true, result: ['Cannot delete'] }))
    const onClose = vi.fn()
    const handleSuccessDeleteCampaign = vi.fn()
    const ui = await renderDetail({ campaign, onClose, handleSuccessDeleteCampaign })

    let outcome
    await act(async () => { outcome = await ui.current.handleDeleteCampaign() })

    expect(outcome).toEqual({ ok: false, error: ['Cannot delete'] })
    expect(ui.current.formState.error).toEqual(['Cannot delete'])
    expect(handleSuccessDeleteCampaign).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('resolves { ok: false, error: message } when the request throws', async () => {
    mocks.del = vi.fn(async () => { throw new Error('network down') })
    const ui = await renderDetail({ campaign, handleSuccessDeleteCampaign: vi.fn() })

    let outcome
    await act(async () => { outcome = await ui.current.handleDeleteCampaign() })

    expect(outcome).toEqual({ ok: false, error: 'network down' })
    expect(ui.current.formState.error).toBe('network down')
  })
})

// redesign (row 56 Q-P3): changing the channel with rules set recounts the audience (one extra read)
describe('CampaignDetail · audience recount on channel change (row 56)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetch = vi.fn(route)
    vi.stubGlobal('fetch', mocks.fetch)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const audienceRequests = () => requestsOf('POST').filter(([target]) => target.endsWith('/marketing_campaigns/audience'))

  it('requests the audience again, with the new contact_type, when the channel changes in add mode', async () => {
    const ui = await renderDetail()
    await act(async () => { ui.current.handleChangeType('contact_type', 'email') })
    await act(async () => { ui.current.handleChangeItem('conditions', [{ type: 'orders', operator: 'gt', value: 1 }]) })
    await waitFor(() => expect(audienceRequests()).toHaveLength(1))
    expect(JSON.parse(audienceRequests()[0][1].body).contact_type).toBe('email')

    await act(async () => { ui.current.handleChangeType('contact_type', 'sms') })

    await waitFor(() => expect(audienceRequests()).toHaveLength(2))
    expect(JSON.parse(audienceRequests()[1][1].body).contact_type).toBe('sms')
  })

  it('does not request the audience when the channel changes without rules', async () => {
    const ui = await renderDetail()
    await act(async () => { ui.current.handleChangeType('contact_type', 'email') })
    await act(async () => { ui.current.handleChangeType('contact_type', 'sms') })
    expect(audienceRequests()).toHaveLength(0)
  })
})
