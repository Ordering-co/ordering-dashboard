/* eslint-disable import/first */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

// redesign RA-B1 (decision 2; M-RA3, M-RA13, auditor #6): channels per row, outcomes instead of silence, clamped pageSize
const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  session: { token: 'token' },
  ordering: { root: 'https://api.test' },
  fetch: null
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [mocks.session] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [mocks.ordering] }))
vi.mock('../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useToast: () => [null, { showToast: mocks.showToast }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [null, (_key, fallback) => fallback] }))

import { RecoveryActionListing } from '..'
import { MAX_PAGES } from '../../../utils/recoveryRules'

const makeRules = (count = 2) => Array.from({ length: count }, (_, index) => ({
  id: index + 1,
  name: `Rule ${index + 1}`,
  description: `Description ${index + 1}`,
  times: [260],
  enabled: false
}))
const paginationOf = (count) => ({ current_page: 1, total_pages: 1, total: count, page_size: 10, from: 1, to: count })
const listResponse = (rules) => ({ json: async () => ({ error: false, result: rules, pagination: paginationOf(rules.length) }) })
const channelsResponseResult = (ruleId) => [{ id: ruleId * 10, channel: 'email', title: 'Hi', body: 'Hello', enabled: true, event_rule_id: ruleId }]
const channelsResponse = (ruleId) => ({ json: async () => ({ error: false, result: channelsResponseResult(ruleId) }) })

const CHANNELS_URL = /\/event_rules\/(\d+)\/channels\?page=(\d+)&page_size=50$/
const isChannelCall = (url) => CHANNELS_URL.test(url)
// The counters ride on their own requests: the page (GET /event_rules?…&params=id,sent_count,…) and one rule (GET /event_rules/:id?params=…)
const STATS_PARAMS = 'id,sent_count,recovered_count,recovered_total'
const isPageStatsCall = (url) => /\/event_rules\?.*params=id,sent_count/.test(url)
const isRuleStatsCall = (url) => /\/event_rules\/\d+\?params=id,sent_count/.test(url)
const statsCalls = () => mocks.fetch.mock.calls.filter(([url]) => isPageStatsCall(url))
const ruleStatsCalls = () => mocks.fetch.mock.calls.filter(([url]) => isRuleStatsCall(url))
const channelCalls = () => mocks.fetch.mock.calls.filter(([url]) => isChannelCall(url))
const ruleCalls = () => mocks.fetch.mock.calls.filter(([url]) => /\/event_rules\?/.test(url) && !isPageStatsCall(url))
// redesign RA-I1: on mount the controller reads the summary (page=1&page_size=50) and the page. Both are GET /event_rules?…, and with
// ?pageSize=50 they are the same URL, so they are told apart by order: the summary effect is declared first and its request goes first.
const summaryCalls = () => ruleCalls().slice(0, 1)
const listCalls = () => ruleCalls().slice(1)

// A router for the rule list and the per-rule channels; `channelHandler` decides the answer of the channels. The first request to
// /event_rules? is the summary (RA-I1): `summaryHandler(url, options)` answers it, by default with the same rules as the page.
const statsRowsOf = (rules) => rules.map(rule => ({ id: rule.id, sent_count: rule.id * 10, recovered_count: rule.id, recovered_total: rule.id * 2.5 }))

const installFetch = ({
  rules = makeRules(),
  channelHandler = async (_ruleId) => channelsResponse(_ruleId),
  summaryHandler = null,
  statsHandler = async (url) => ({ json: async () => ({ error: false, result: statsRowsOf(rules) }) }),
  ruleStatsHandler = async (url) => ({ json: async () => ({ error: true, result: ['Not found'] }) })
} = {}) => {
  let ruleReads = 0
  mocks.fetch = vi.fn(async (url, options = {}) => {
    if (isChannelCall(url)) {
      const [, ruleId, page] = CHANNELS_URL.exec(url)
      return channelHandler(Number(ruleId), options, Number(page))
    }
    if (isPageStatsCall(url)) return statsHandler(url, options)
    if (isRuleStatsCall(url)) return ruleStatsHandler(url, options)
    if (/\/event_rules\?/.test(url)) {
      ruleReads += 1
      if (ruleReads === 1 && summaryHandler) return summaryHandler(url, options)
      return listResponse(rules)
    }
    throw new Error(`unexpected request ${options.method || 'GET'} ${url}`)
  })
  vi.stubGlobal('fetch', mocks.fetch)
}

const renderListing = async (props = {}, expected = 2) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  const view = render(<RecoveryActionListing UIComponent={UIComponent} {...props} />)
  await waitFor(() => expect(ui.current.recoveryActionList.actions).toHaveLength(expected))
  return { ui, view }
}

const abortable = (options) => new Promise((resolve, reject) => {
  options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
})

describe('RecoveryActionListing · pageSize (RA-B1 / auditor #6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installFetch()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('?pageSize=999 reaches the request and the pagination as 50', async () => {
    const { ui } = await renderListing({ paginationSettings: { initialPage: 1, pageSize: 999, controlType: 'pages' } })
    expect(ui.current.paginationProps.pageSize).toBe(50)
    expect(listCalls()[0][0]).toBe('https://api.test/event_rules?page=1&page_size=50&params=channels')
  })

  it('an invalid size is 10 and an allowed one is kept', async () => {
    const { ui } = await renderListing({ paginationSettings: { initialPage: 1, pageSize: 'abc', controlType: 'pages' } })
    expect(ui.current.paginationProps.pageSize).toBe(10)
    expect(listCalls()[0][0]).toBe('https://api.test/event_rules?page=1&page_size=10&params=channels')
  })

  it('keeps 25', async () => {
    const { ui } = await renderListing({ paginationSettings: { initialPage: 1, pageSize: 25, controlType: 'pages' } })
    expect(ui.current.paginationProps.pageSize).toBe(25)
  })
})

// redesign (row 83 R1-12): «Items per page» sticks. The UI sets the size and loads; the answer used to spread the stale props
describe('RecoveryActionListing · chosen page size sticks (row 83 R1-12)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installFetch()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const choose = async (ui, pageSize) => {
    await act(async () => {
      ui.current.setPaginationProps({ ...ui.current.paginationProps, pageSize })
      ui.current.getRecoveryList(1, pageSize)
    })
  }

  it('keeps the chosen size in paginationProps after the answer, and the next request carries it', async () => {
    const { ui } = await renderListing()
    expect(ui.current.paginationProps.pageSize).toBe(10)

    await choose(ui, 25)
    await waitFor(() => expect(listCalls()).toHaveLength(2))
    await waitFor(() => expect(ui.current.paginationProps.totalItems).toBe(2))
    expect(listCalls()[1][0]).toBe('https://api.test/event_rules?page=1&page_size=25&params=channels')
    expect(ui.current.paginationProps.pageSize).toBe(25)

    await act(async () => { ui.current.handleChangeSearch('rule') })
    await waitFor(() => expect(listCalls()).toHaveLength(3))
    expect(listCalls()[2][0]).toContain('page_size=25')
  })

  it('clamps the chosen size to the options of the pagination', async () => {
    const { ui } = await renderListing()
    await choose(ui, 30)
    await waitFor(() => expect(listCalls()).toHaveLength(2))
    await waitFor(() => expect(ui.current.paginationProps.totalItems).toBe(2))
    expect(ui.current.paginationProps.pageSize).toBe(50)
  })
})

describe('RecoveryActionListing · channels per row (RA-B1 / decision 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks GET /event_rules/:id/channels for every rule of the page and exposes channelsByRule', async () => {
    installFetch()
    const { ui } = await renderListing()
    await waitFor(() => expect(ui.current.channelsByRule[2]?.loading).toBe(false))
    expect(channelCalls().map(([url]) => url)).toEqual([
      'https://api.test/event_rules/1/channels?page=1&page_size=50',
      'https://api.test/event_rules/2/channels?page=1&page_size=50'
    ])
    expect(channelCalls()[0][1].method).toBe('GET')
    expect(ui.current.channelsByRule[1]).toEqual({
      loading: false,
      channels: [{ id: 10, channel: 'email', title: 'Hi', body: 'Hello', enabled: true, event_rule_id: 1 }],
      error: null
    })
  })

  // an api-core that embeds the channels in the list (params=channels) answers the page in one request
  it('takes the channels embedded in the list and asks none per rule', async () => {
    const rules = makeRules().map(rule => ({ ...rule, channels: rule.id === 1 ? channelsResponseResult(1) : [] }))
    installFetch({ rules })
    const { ui } = await renderListing()
    await waitFor(() => expect(ui.current.channelsByRule[2]).toEqual({ loading: false, channels: [], error: null }))
    expect(ui.current.channelsByRule[1]).toEqual({ loading: false, channels: channelsResponseResult(1), error: null })
    expect(channelCalls()).toHaveLength(0)
    expect(listCalls()[0][0]).toBe('https://api.test/event_rules?page=1&page_size=10&params=channels')
  })

  it('asks per rule when one rule of the page comes without channels', async () => {
    installFetch({ rules: makeRules().map(rule => rule.id === 1 ? { ...rule, channels: [] } : rule) })
    const { ui } = await renderListing()
    await waitFor(() => expect(ui.current.channelsByRule[2]?.loading).toBe(false))
    expect(channelCalls()).toHaveLength(2)
  })

  it('shows loading while a rule waits for its channels', async () => {
    installFetch({ channelHandler: (_id, options) => abortable(options) })
    const { ui } = await renderListing()
    await waitFor(() => expect(channelCalls()).toHaveLength(2))
    expect(ui.current.channelsByRule[1]).toEqual({ loading: true, channels: [], error: null })
    expect(ui.current.recoveryActionList.loading).toBe(false)
  })

  it('never has more than 6 channel requests in flight', async () => {
    const rules = makeRules(10)
    const state = { running: 0, max: 0 }
    installFetch({
      rules,
      channelHandler: async (ruleId) => {
        state.running += 1
        state.max = Math.max(state.max, state.running)
        await new Promise(resolve => setTimeout(resolve, 5))
        state.running -= 1
        return channelsResponse(ruleId)
      }
    })
    const { ui } = await renderListing({}, 10)
    await waitFor(() => expect(Object.values(ui.current.channelsByRule).filter(entry => !entry.loading)).toHaveLength(10))
    expect(state.max).toBe(6)
    expect(channelCalls()).toHaveLength(10)
  })

  it('aborts the channel requests of the previous load when another load starts', async () => {
    const signals = []
    installFetch({
      rules: makeRules(10),
      channelHandler: (_id, options) => {
        signals.push(options.signal)
        return abortable(options)
      }
    })
    const { ui } = await renderListing({}, 10)
    await waitFor(() => expect(signals).toHaveLength(6))
    expect(signals.every(signal => !signal.aborted)).toBe(true)

    await act(async () => { ui.current.handleChangeSearch('promo') })
    await waitFor(() => expect(listCalls()).toHaveLength(2))
    expect(signals.slice(0, 6).every(signal => signal.aborted)).toBe(true)
    // the aborted requests never write an error
    await waitFor(() => expect(channelCalls().length).toBeGreaterThan(6))
    expect(Object.values(ui.current.channelsByRule).every(entry => entry.error === null)).toBe(true)
  })

  it('aborts them on unmount', async () => {
    const signals = []
    installFetch({
      channelHandler: (_id, options) => {
        signals.push(options.signal)
        return abortable(options)
      }
    })
    const { view } = await renderListing()
    await waitFor(() => expect(signals).toHaveLength(2))
    view.unmount()
    expect(signals.every(signal => signal.aborted)).toBe(true)
  })

  it('a failing channel request gives that rule its own error and reloadRuleChannels recovers it', async () => {
    let fail = true
    installFetch({
      channelHandler: async (ruleId) => {
        if (ruleId === 2 && fail) return { json: async () => ({ error: true, result: ['No access'] }) }
        if (ruleId === 1 && fail) throw new Error('network down')
        return channelsResponse(ruleId)
      }
    })
    const { ui } = await renderListing()
    await waitFor(() => expect(ui.current.channelsByRule[2]?.loading).toBe(false))
    await waitFor(() => expect(ui.current.channelsByRule[1]?.loading).toBe(false))
    expect(ui.current.channelsByRule[1]).toEqual({ loading: false, channels: [], error: ['network down'] })
    expect(ui.current.channelsByRule[2]).toEqual({ loading: false, channels: [], error: ['No access'] })
    expect(ui.current.recoveryActionList.error).toBeNull()

    fail = false
    await act(async () => { await ui.current.reloadRuleChannels(2) })
    expect(ui.current.channelsByRule[2].error).toBeNull()
    expect(ui.current.channelsByRule[2].channels).toHaveLength(1)
    expect(ui.current.channelsByRule[1].error).toEqual(['network down'])
  })

  it('setRuleChannels replaces the channels of one rule', async () => {
    installFetch()
    const { ui } = await renderListing()
    await waitFor(() => expect(ui.current.channelsByRule[1]?.loading).toBe(false))
    await act(async () => { ui.current.setRuleChannels(1, [{ id: 99, channel: 'sms', enabled: false }]) })
    expect(ui.current.channelsByRule[1]).toEqual({ loading: false, channels: [{ id: 99, channel: 'sms', enabled: false }], error: null })
    expect(ui.current.channelsByRule[2].channels).toHaveLength(1)
  })
})

describe('RecoveryActionListing · counters per rule', () => {
  const PAGE_STATS_URL = `https://api.test/event_rules?page=1&page_size=10&params=${STATS_PARAMS}`
  const pendingEntry = { loading: true, error: null, sent_count: null, recovered_count: null, recovered_total: null }

  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('leaves the list request exactly as it was: the counters never ride on it', async () => {
    installFetch()
    await renderListing()
    expect(listCalls()[0][0]).toBe('https://api.test/event_rules?page=1&page_size=10&params=channels')
    expect(listCalls()[0][0]).not.toContain('sent_count')
  })

  it('asks the counters of the same page in a second request, and with the search where', async () => {
    installFetch()
    const { ui } = await renderListing()
    await waitFor(() => expect(statsCalls()).toHaveLength(1))
    expect(statsCalls()[0][0]).toBe(PAGE_STATS_URL)
    expect(statsCalls()[0][1].method).toBe('GET')
    expect(statsCalls()[0][1].headers.Authorization).toBe('Bearer token')

    await act(async () => { ui.current.handleChangeSearch('promo') })
    await waitFor(() => expect(statsCalls()).toHaveLength(2))
    expect(listCalls()[1][0]).toContain('&params=channels&where=')
    const listWhere = listCalls()[1][0].split('&where=')[1]
    expect(statsCalls()[1][0]).toBe(`${PAGE_STATS_URL}&where=${listWhere}`)
  })

  it('asks no counters for a page with no rules', async () => {
    installFetch({ rules: [] })
    const { ui } = await renderListing({}, 0)
    await waitFor(() => expect(listCalls()).toHaveLength(1))
    await waitFor(() => expect(ui.current.recoveryActionList.loading).toBe(false))
    expect(statsCalls()).toHaveLength(0)
    expect(ui.current.statsByRule).toEqual({})
  })

  it('the stats request carries the page and size of the list request', async () => {
    installFetch()
    const { ui } = await renderListing()
    await act(async () => { await ui.current.getRecoveryList(3, 25) })
    await waitFor(() => expect(statsCalls()).toHaveLength(2))
    expect(listCalls()[1][0]).toBe('https://api.test/event_rules?page=3&page_size=25&params=channels')
    expect(statsCalls()[1][0]).toBe(`https://api.test/event_rules?page=3&page_size=25&params=${STATS_PARAMS}`)
  })

  it('puts the numbers in statsByRule by id, loading until they arrive', async () => {
    let release
    installFetch({ statsHandler: () => new Promise(resolve => { release = resolve }) })
    const { ui } = await renderListing()
    await waitFor(() => expect(ui.current.statsByRule[1]).toEqual(pendingEntry))
    expect(ui.current.statsByRule[2]).toEqual(pendingEntry)

    // the answer comes in another order, with a text number and a rule missing
    await act(async () => {
      release({ json: async () => ({ error: false, result: [{ id: 2, sent_count: '7', recovered_count: 3, recovered_total: 12.5 }] }) })
    })
    expect(ui.current.statsByRule[2]).toEqual({ loading: false, error: null, sent_count: 7, recovered_count: 3, recovered_total: 12.5 })
    expect(ui.current.statsByRule[1]).toEqual({ loading: false, error: null, sent_count: null, recovered_count: null, recovered_total: null })
  })

  it('a value that is not a finite number stays null', async () => {
    installFetch({
      statsHandler: async () => ({ json: async () => ({ error: false, result: [{ id: 1, sent_count: 'abc', recovered_count: null, recovered_total: 4 }, { id: 2, sent_count: 0, recovered_count: 0, recovered_total: 0 }] }) })
    })
    const { ui } = await renderListing()
    await waitFor(() => expect(ui.current.statsByRule[1]?.loading).toBe(false))
    expect(ui.current.statsByRule[1]).toEqual({ loading: false, error: null, sent_count: null, recovered_count: null, recovered_total: 4 })
    expect(ui.current.statsByRule[2]).toEqual({ loading: false, error: null, sent_count: 0, recovered_count: 0, recovered_total: 0 })
  })

  it.each([
    ['an API error', () => ({ json: async () => ({ error: true, result: ['No table'] }) }), ['No table']],
    ['a request that throws', () => { throw new Error('network down') }, ['network down']]
  ])('%s leaves the list intact, sets the error on every rule and shows no toast', async (_name, answer, error) => {
    installFetch({ statsHandler: async () => answer() })
    const { ui } = await renderListing()
    await waitFor(() => expect(ui.current.statsByRule[1]?.loading).toBe(false))
    const failed = { loading: false, error, sent_count: null, recovered_count: null, recovered_total: null }
    expect(ui.current.statsByRule).toEqual({ 1: failed, 2: failed })
    expect(ui.current.recoveryActionList.error).toBeNull()
    expect(ui.current.recoveryActionList.actions).toHaveLength(2)
    expect(mocks.showToast).not.toHaveBeenCalled()
  })

  it('drops the stats answer of an older page when a newer load has started', async () => {
    const releases = []
    installFetch({ statsHandler: () => new Promise(resolve => releases.push(resolve)) })
    const { ui } = await renderListing()
    await waitFor(() => expect(releases).toHaveLength(1))
    await act(async () => { await ui.current.getRecoveryList(2, 10) })
    await waitFor(() => expect(releases).toHaveLength(2))

    // the newer answer first, then the stale one
    await act(async () => { releases[1]({ json: async () => ({ error: false, result: [{ id: 1, sent_count: 5, recovered_count: 1, recovered_total: 1 }] }) }) })
    await act(async () => { releases[0]({ json: async () => ({ error: false, result: [{ id: 1, sent_count: 999, recovered_count: 999, recovered_total: 999 }] }) }) })
    expect(ui.current.statsByRule[1].sent_count).toBe(5)

    // a stale failure is dropped too
    await act(async () => { await ui.current.getRecoveryList(3, 10) })
    await waitFor(() => expect(releases).toHaveLength(3))
    await act(async () => { releases[2]({ json: async () => ({ error: false, result: statsRowsOf(makeRules()) }) }) })
    expect(ui.current.statsByRule[1].error).toBeNull()
  })

  it('writes nothing after unmount', async () => {
    let release
    installFetch({ statsHandler: () => new Promise(resolve => { release = resolve }) })
    const { ui, view } = await renderListing()
    await waitFor(() => expect(release).toBeDefined())
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    view.unmount()
    await act(async () => { release({ json: async () => ({ error: false, result: statsRowsOf(makeRules()) }) }) })
    expect(ui.current.statsByRule[1]).toEqual(pendingEntry)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  describe('reloadRuleStats', () => {
    it('reads one rule and writes only its entry', async () => {
      installFetch({
        ruleStatsHandler: async () => ({ json: async () => ({ error: false, result: { id: 9, sent_count: 4, recovered_count: 2, recovered_total: 30 } }) })
      })
      const { ui } = await renderListing()
      await waitFor(() => expect(ui.current.statsByRule[1]?.loading).toBe(false))
      const untouched = ui.current.statsByRule[1]

      await act(async () => { await ui.current.reloadRuleStats(9) })

      expect(ruleStatsCalls().map(([url]) => url)).toEqual([`https://api.test/event_rules/9?params=${STATS_PARAMS}`])
      expect(ruleStatsCalls()[0][1].method).toBe('GET')
      expect(ui.current.statsByRule[9]).toEqual({ loading: false, error: null, sent_count: 4, recovered_count: 2, recovered_total: 30 })
      expect(ui.current.statsByRule[1]).toBe(untouched)
    })

    it('shows loading while it waits', async () => {
      let release
      installFetch({ ruleStatsHandler: () => new Promise(resolve => { release = resolve }) })
      const { ui } = await renderListing()
      let done
      await act(async () => { done = ui.current.reloadRuleStats(9) })
      expect(ui.current.statsByRule[9]).toEqual(pendingEntry)
      await act(async () => { release({ json: async () => ({ error: false, result: { id: 9, sent_count: 1, recovered_count: 0, recovered_total: 0 } }) }); await done })
      expect(ui.current.statsByRule[9].loading).toBe(false)
    })

    it('an API error or a thrown request sets the error, resolves and keeps the other entries; a retry recovers it', async () => {
      let mode = 'api'
      installFetch({
        ruleStatsHandler: async () => {
          if (mode === 'throw') throw new Error('network down')
          if (mode === 'api') return { json: async () => ({ error: true, result: ['Not found'] }) }
          return { json: async () => ({ error: false, result: { id: 9, sent_count: 2, recovered_count: 1, recovered_total: 5 } }) }
        }
      })
      const { ui } = await renderListing()
      await waitFor(() => expect(ui.current.statsByRule[2]?.loading).toBe(false))
      const other = ui.current.statsByRule[2]

      await act(async () => { await ui.current.reloadRuleStats(9) })
      expect(ui.current.statsByRule[9]).toEqual({ loading: false, error: ['Not found'], sent_count: null, recovered_count: null, recovered_total: null })

      mode = 'throw'
      await act(async () => { await ui.current.reloadRuleStats(9) })
      expect(ui.current.statsByRule[9].error).toEqual(['network down'])

      mode = 'ok'
      await act(async () => { await ui.current.reloadRuleStats(9) })
      expect(ui.current.statsByRule[9]).toEqual({ loading: false, error: null, sent_count: 2, recovered_count: 1, recovered_total: 5 })
      expect(ui.current.statsByRule[2]).toBe(other)
      expect(mocks.showToast).not.toHaveBeenCalled()
    })
  })
})

describe('RecoveryActionListing · every page of the channels of a rule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const channelsOf = (ruleId, from, to) => Array.from({ length: to - from + 1 }, (_, index) => ({ id: ruleId * 1000 + from + index, channel: 'email', enabled: true }))
  const pageAnswer = (page, totalPages, items) => ({
    json: async () => ({ error: false, result: items, pagination: { current_page: page, total_pages: totalPages, total: 0, page_size: 50, from: 1, to: items.length } })
  })

  it('reads page after page and concatenates them', async () => {
    installFetch({
      channelHandler: async (ruleId, _options, page) => pageAnswer(page, 3, channelsOf(ruleId, page * 100, page * 100 + 1))
    })
    const { ui } = await renderListing()
    await waitFor(() => expect(ui.current.channelsByRule[1]?.loading).toBe(false))
    expect(channelCalls().filter(([url]) => url.includes('/event_rules/1/')).map(([url]) => url)).toEqual([
      'https://api.test/event_rules/1/channels?page=1&page_size=50',
      'https://api.test/event_rules/1/channels?page=2&page_size=50',
      'https://api.test/event_rules/1/channels?page=3&page_size=50'
    ])
    expect(ui.current.channelsByRule[1].channels.map(channel => channel.id)).toEqual([1100, 1101, 1200, 1201, 1300, 1301])
  })

  it('an answer without pagination is one page', async () => {
    installFetch({ channelHandler: async (ruleId) => ({ json: async () => ({ error: false, result: channelsOf(ruleId, 1, 2) }) }) })
    const { ui } = await renderListing()
    await waitFor(() => expect(ui.current.channelsByRule[1]?.loading).toBe(false))
    expect(channelCalls()).toHaveLength(2)
    expect(ui.current.channelsByRule[1].channels).toHaveLength(2)
  })

  it('a page that fails gives the rule that error and no partial channels', async () => {
    installFetch({
      channelHandler: async (ruleId, _options, page) => (ruleId === 1 && page === 2
        ? { json: async () => ({ error: true, result: ['No access'] }) }
        : pageAnswer(page, 2, channelsOf(ruleId, page, page)))
    })
    const { ui } = await renderListing()
    await waitFor(() => expect(ui.current.channelsByRule[1]?.loading).toBe(false))
    await waitFor(() => expect(ui.current.channelsByRule[2]?.loading).toBe(false))
    expect(ui.current.channelsByRule[1]).toEqual({ loading: false, channels: [], error: ['No access'] })
    expect(ui.current.channelsByRule[2].channels).toHaveLength(2)
  })

  it('stops at the page cap when total_pages is wrong', async () => {
    installFetch({
      rules: makeRules(1),
      channelHandler: async (ruleId, _options, page) => pageAnswer(page, 9999, channelsOf(ruleId, page, page))
    })
    const { ui } = await renderListing({}, 1)
    await waitFor(() => expect(ui.current.channelsByRule[1]?.loading).toBe(false))
    expect(channelCalls()).toHaveLength(MAX_PAGES)
  })
})

describe('RecoveryActionListing · outcomes (RA-B1 / M-RA3, M-RA13)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installFetch()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const putOnce = (answer) => {
    const base = mocks.fetch.getMockImplementation()
    mocks.fetch.mockImplementation(async (url, options = {}) => {
      if (options.method === 'PUT') return answer(url, options)
      return base(url, options)
    })
  }

  it('handleUpdateAction resolves { ok: true, error: null }, replaces the row by a copy and keeps the success toast', async () => {
    const { ui } = await renderListing()
    const previousList = ui.current.recoveryActionList.actions
    const previousRow = previousList[0]
    putOnce(async () => ({ json: async () => ({ error: false, result: { id: 1, enabled: true } }) }))

    let outcome
    await act(async () => { outcome = await ui.current.handleUpdateAction(1, { enabled: true }) })

    // redesign R2-F1 (R1-01): it also hands back what the API answered, for a panel whose rule is no longer a row of this page
    expect(outcome).toEqual({ ok: true, error: null, rule: { id: 1, enabled: true } })
    const [url, options] = mocks.fetch.mock.calls[mocks.fetch.mock.calls.length - 1]
    expect(url).toBe('https://api.test/event_rules/1')
    expect(options.method).toBe('PUT')
    expect(options.body).toBe(JSON.stringify({ enabled: true }))
    expect(ui.current.recoveryActionList.actions[0]).toMatchObject({ id: 1, enabled: true, name: 'Rule 1', times: [260] })
    expect(ui.current.recoveryActionList.actions[1]).toBe(previousList[1])
    expect(previousRow.enabled).toBe(false)
    expect(ui.current.recoveryActionList.actions[0]).not.toBe(previousRow)
    expect(ui.current.recoveryActionList.actions).not.toBe(previousList)
    expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Recovery action saved')
    expect(mocks.showToast).not.toHaveBeenCalledWith('INFO', 'Loading')
  })

  it('a rule that is no longer on the page still gets its saved record back (the row cannot carry it)', async () => {
    const { ui } = await renderListing()
    const before = ui.current.recoveryActionList.actions
    putOnce(async () => ({ json: async () => ({ error: false, result: { id: 77, enabled: true, name: 'Elsewhere' } }) }))

    let outcome
    await act(async () => { outcome = await ui.current.handleUpdateAction(77, { enabled: true }) })

    expect(outcome).toEqual({ ok: true, error: null, rule: { id: 77, enabled: true, name: 'Elsewhere' } })
    expect(ui.current.recoveryActionList.actions.map(row => row.id)).toEqual(before.map(row => row.id))
  })

  it('a failing update resolves { ok: false, error } and does not write recoveryActionList.error', async () => {
    const { ui } = await renderListing()
    const before = ui.current.recoveryActionList.actions
    putOnce(async () => ({ json: async () => ({ error: true, result: ['Not allowed'] }) }))

    let outcome
    await act(async () => { outcome = await ui.current.handleUpdateAction(1, { enabled: true }) })

    expect(outcome).toEqual({ ok: false, error: ['Not allowed'] })
    expect(ui.current.recoveryActionList.error).toBeNull()
    expect(ui.current.recoveryActionList.actions).toBe(before)
    expect(ui.current.recoveryActionList.actions[0].enabled).toBe(false)
    expect(mocks.showToast).not.toHaveBeenCalledWith('SUCCESS', 'Recovery action saved')
  })

  it('a request that throws resolves { ok: false, error: [message] } and does not write recoveryActionList.error', async () => {
    const { ui } = await renderListing()
    putOnce(async () => { throw new Error('network down') })

    let outcome
    await act(async () => { outcome = await ui.current.handleUpdateAction(1, { enabled: true }) })

    expect(outcome).toEqual({ ok: false, error: ['network down'] })
    expect(ui.current.recoveryActionList.error).toBeNull()
  })

  it('handleSuccessAddRecoveryAction appends the rule, bumps totalItems and to (not total) and starts its channels empty', async () => {
    const { ui } = await renderListing()
    expect(ui.current.paginationProps.totalItems).toBe(2)

    await act(async () => { ui.current.handleSuccessAddRecoveryAction({ id: 3, name: 'New' }) })

    expect(ui.current.paginationProps.totalItems).toBe(3)
    expect(ui.current.paginationProps.to).toBe(3)
    expect(ui.current.paginationProps.total).toBeUndefined()
    expect(ui.current.recoveryActionList.actions.map(item => item.id)).toEqual([1, 2, 3])
    expect(ui.current.channelsByRule[3]).toEqual({ loading: false, channels: [], error: null })
    // a rule just created has sent nothing
    expect(ui.current.statsByRule[3]).toEqual({ loading: false, error: null, sent_count: 0, recovered_count: 0, recovered_total: 0 })
  })

  it('handleSuccessDeleteRecoveryAction removes the rule and lowers totalItems and to (not total)', async () => {
    const { ui } = await renderListing()

    await act(async () => { ui.current.handleSuccessDeleteRecoveryAction(1) })

    expect(ui.current.paginationProps.totalItems).toBe(1)
    expect(ui.current.paginationProps.to).toBe(1)
    expect(ui.current.paginationProps.total).toBeUndefined()
    expect(ui.current.recoveryActionList.actions.map(item => item.id)).toEqual([2])
    expect(ui.current.channelsByRule[1]).toBeUndefined()
    expect(ui.current.statsByRule[1]).toBeUndefined()
    expect(ui.current.statsByRule[2]).toBeDefined()
  })

  it('keeps exposing what the old components use', async () => {
    const { ui } = await renderListing()
    for (const name of [
      'searchValue', 'paginationProps', 'recoveryActionList', 'getRecoveryList', 'setFilterValues', 'setPaginationProps',
      'handleChangeSearch', 'handleUpdateAction', 'handleSuccessAddRecoveryAction', 'handleSuccessUpdateRecoveryAction',
      'handleSuccessDeleteRecoveryAction'
    ]) {
      expect(ui.current[name], name).not.toBeUndefined()
    }
    await act(async () => { ui.current.handleSuccessUpdateRecoveryAction([{ id: 7 }]) })
    expect(ui.current.recoveryActionList.actions).toEqual([{ id: 7 }])
  })
})

// redesign RA-I1 (decision 2): «N of M rules on» counts every rule, as open carts does: one GET /event_rules?page=1&page_size=50 on mount,
// never the page or the search. null: not known yet; { on, total }; { error } when it could not be read.
describe('RecoveryActionListing · rules summary (RA-I1)', () => {
  const rulesOn = (count, onIds = []) => makeRules(count).map(item => ({ ...item, enabled: onIds.includes(item.id) }))
  const summaryResponse = (rules, total = rules.length) => ({
    json: async () => ({ error: false, result: rules, pagination: { ...paginationOf(rules.length), total } })
  })
  // `page` is what the list shows; `summary` is every rule the summary read finds
  const setupSummary = async ({ page = rulesOn(2, [1]), summary = rulesOn(4, [1]), total } = {}) => {
    installFetch({ rules: page, summaryHandler: async () => summaryResponse(summary, total) })
    const view = await renderListing({}, page.length)
    await waitFor(() => expect(view.ui.current.rulesSummary).not.toBeNull())
    return view
  }
  const answerPut = (answer) => {
    const base = mocks.fetch.getMockImplementation()
    mocks.fetch.mockImplementation(async (url, options = {}) => (options.method === 'PUT' ? answer(url, options) : base(url, options)))
  }
  const putResult = (result) => answerPut(async () => ({ json: async () => ({ error: false, result }) }))
  const update = (ui, id, changes) => act(async () => { await ui.current.handleUpdateAction(id, changes) })

  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('reading it', () => {
    it('asks GET /event_rules?page=1&page_size=50 once on mount, before the page, and does not ask again', async () => {
      const { ui } = await setupSummary()
      expect(summaryCalls()).toHaveLength(1)
      const [url, options] = summaryCalls()[0]
      expect(url).toBe('https://api.test/event_rules?page=1&page_size=50')
      expect(options.method).toBe('GET')
      expect(options.headers.Authorization).toBe('Bearer token')
      // the page is the other request: its own size, asked after the summary
      expect(ruleCalls()).toHaveLength(2)
      expect(ruleCalls()[1][0]).toBe('https://api.test/event_rules?page=1&page_size=10&params=channels')
      expect(ui.current.recoveryActionList.actions).toHaveLength(2)
    })

    it('is null until the read answers, then { on, total }', async () => {
      let release
      installFetch({ summaryHandler: () => new Promise(resolve => { release = resolve }) })
      const { ui } = await renderListing()
      expect(ui.current.rulesSummary).toBeNull()
      await act(async () => { release(summaryResponse(rulesOn(5, [2, 3]))) })
      expect(ui.current.rulesSummary).toEqual({ on: 2, total: 5 })
    })

    it('counts every rule even when the page shows fewer (2 on the page, 3 of 7 on in all)', async () => {
      const { ui } = await setupSummary({ page: rulesOn(2), summary: rulesOn(7, [1, 2, 5]) })
      expect(ui.current.recoveryActionList.actions).toHaveLength(2)
      expect(ui.current.recoveryActionList.actions.some(item => item.enabled)).toBe(false)
      expect(ui.current.rulesSummary).toEqual({ on: 3, total: 7 })
    })

    it('takes total from the pagination when there are more rules than the read brings (on counts what it read)', async () => {
      const { ui } = await setupSummary({ page: rulesOn(2), summary: rulesOn(50, [1, 2, 3, 4]), total: 120 })
      expect(ui.current.rulesSummary).toEqual({ on: 4, total: 120 })
    })

    it('falls back to the length of the result when the answer has no pagination', async () => {
      installFetch({ summaryHandler: async () => ({ json: async () => ({ error: false, result: rulesOn(3, [1]) }) }) })
      const { ui } = await renderListing()
      await waitFor(() => expect(ui.current.rulesSummary).not.toBeNull())
      expect(ui.current.rulesSummary).toEqual({ on: 1, total: 3 })
    })

    it('the search and the page do not change it nor ask again', async () => {
      const { ui } = await setupSummary({ page: rulesOn(2), summary: rulesOn(7, [1, 2, 5]) })
      await act(async () => { ui.current.handleChangeSearch('promo') })
      await waitFor(() => expect(ruleCalls()).toHaveLength(3))
      expect(ruleCalls()[2][0]).toContain('where=')
      await act(async () => { await ui.current.getRecoveryList(2, 10) })
      expect(ruleCalls()).toHaveLength(4)
      expect(summaryCalls()).toHaveLength(1)
      expect(ui.current.rulesSummary).toEqual({ on: 3, total: 7 })
    })
  })

  describe('when it cannot be read', () => {
    it('an API error leaves { error } and the list still loads', async () => {
      installFetch({ summaryHandler: async () => ({ json: async () => ({ error: true, result: ['No access'] }) }) })
      const { ui } = await renderListing()
      await waitFor(() => expect(ui.current.rulesSummary).not.toBeNull())
      expect(ui.current.rulesSummary).toEqual({ error: ['No access'] })
      expect(ui.current.recoveryActionList.error).toBeNull()
      expect(ui.current.recoveryActionList.actions).toHaveLength(2)
    })

    it('a request that throws leaves { error: [message] } and the list still loads', async () => {
      installFetch({ summaryHandler: async () => { throw new Error('network down') } })
      const { ui } = await renderListing()
      await waitFor(() => expect(ui.current.rulesSummary).not.toBeNull())
      expect(ui.current.rulesSummary).toEqual({ error: ['network down'] })
      expect(ui.current.recoveryActionList.error).toBeNull()
      expect(ui.current.recoveryActionList.actions).toHaveLength(2)
    })

    // «N of M rules on» was read once, so after «Retry» of a failed page the line stayed out until a switch
    it('Retry of the list reads the summary again when it had failed, and brings the line back', async () => {
      installFetch({ rules: makeRules(4), summaryHandler: async () => ({ json: async () => ({ error: true, result: ['No access'] }) }) })
      const { ui } = await renderListing({}, 4)
      await waitFor(() => expect(ui.current.rulesSummary).toEqual({ error: ['No access'] }))
      const before = ruleCalls().length
      await act(async () => { await ui.current.getRecoveryList(1, 10) })
      // the list page and the summary (page_size=50)
      await waitFor(() => expect(ruleCalls()).toHaveLength(before + 2))
      await waitFor(() => expect(ui.current.rulesSummary).toEqual({ on: 0, total: 4 }))
    })

    it('Retry of the list does not ask for the summary again when it is known', async () => {
      const { ui } = await setupSummary()
      const before = ruleCalls().length
      await act(async () => { await ui.current.getRecoveryList(1, 10) })
      await waitFor(() => expect(ruleCalls()).toHaveLength(before + 1))
      expect(ui.current.rulesSummary).toEqual({ on: 1, total: 4 })
    })

    it('a switch, a create and a delete leave the error as it is', async () => {
      installFetch({ summaryHandler: async () => ({ json: async () => ({ error: true, result: ['No access'] }) }) })
      const { ui } = await renderListing()
      await waitFor(() => expect(ui.current.rulesSummary).not.toBeNull())
      putResult({ id: 1, enabled: true })
      await update(ui, 1, { enabled: true })
      await act(async () => { ui.current.handleSuccessAddRecoveryAction({ id: 3, name: 'New', enabled: true }) })
      await act(async () => { ui.current.handleSuccessDeleteRecoveryAction(2) })
      expect(ui.current.rulesSummary).toEqual({ error: ['No access'] })
    })

    it('a switch made before the read answers leaves it null', async () => {
      let release
      installFetch({ summaryHandler: () => new Promise(resolve => { release = resolve }) })
      const { ui } = await renderListing()
      putResult({ id: 1, enabled: true })
      await update(ui, 1, { enabled: true })
      expect(ui.current.rulesSummary).toBeNull()
      await act(async () => { release(summaryResponse(rulesOn(4, [1, 2]))) })
      expect(ui.current.rulesSummary).toEqual({ on: 2, total: 4 })
    })
  })

  describe('a switch moves it by one', () => {
    it('turning a rule on of the page: on + 1, total stays', async () => {
      const { ui } = await setupSummary()
      expect(ui.current.rulesSummary).toEqual({ on: 1, total: 4 })
      putResult({ id: 2, enabled: true })
      await update(ui, 2, { enabled: true })
      expect(ui.current.rulesSummary).toEqual({ on: 2, total: 4 })
    })

    it('turning a rule off of the page: on - 1, total stays', async () => {
      const { ui } = await setupSummary()
      putResult({ id: 1, enabled: false })
      await update(ui, 1, { enabled: false })
      expect(ui.current.rulesSummary).toEqual({ on: 0, total: 4 })
    })

    it('on and off again comes back to where it was', async () => {
      const { ui } = await setupSummary()
      putResult({ id: 2, enabled: true })
      await update(ui, 2, { enabled: true })
      putResult({ id: 2, enabled: false })
      await update(ui, 2, { enabled: false })
      expect(ui.current.rulesSummary).toEqual({ on: 1, total: 4 })
    })

    it('a save that does not change `enabled` leaves it (a rename, or the same state)', async () => {
      const { ui } = await setupSummary()
      putResult({ id: 2, name: 'Renamed' })
      await update(ui, 2, { name: 'Renamed' })
      putResult({ id: 1, enabled: true })
      await update(ui, 1, { enabled: true })
      expect(ui.current.rulesSummary).toEqual({ on: 1, total: 4 })
    })

    it('the state the server answers wins over the one asked for', async () => {
      const { ui } = await setupSummary()
      putResult({ id: 2, enabled: false })
      await update(ui, 2, { enabled: true })
      expect(ui.current.rulesSummary).toEqual({ on: 1, total: 4 })
    })

    it('a failing save (API error or thrown) leaves it', async () => {
      const { ui } = await setupSummary()
      answerPut(async () => ({ json: async () => ({ error: true, result: ['Not allowed'] }) }))
      await update(ui, 2, { enabled: true })
      answerPut(async () => { throw new Error('network down') })
      await update(ui, 2, { enabled: true })
      expect(ui.current.rulesSummary).toEqual({ on: 1, total: 4 })
    })

    // redesign R2-I5 (live check of R1-01): a rule that is not on the page (opened by ?id=, or hidden by the search) was not counted and the
    // line said «0 of 8» with the rule on. Its previous state is unknown here, so the summary is read again.
    it('a rule that is not in the list reads the summary again', async () => {
      const { ui } = await setupSummary()
      putResult({ id: 4, enabled: true })
      const base = mocks.fetch.getMockImplementation()
      mocks.fetch.mockImplementation(async (url, options = {}) => (/event_rules\?page=1&page_size=50$/.test(String(url)) ? summaryResponse(rulesOn(4, [1, 4])) : base(url, options)))
      await update(ui, 4, { enabled: true })
      await waitFor(() => expect(ui.current.rulesSummary).toEqual({ on: 2, total: 4 }))
      expect(ruleCalls().filter(([url]) => String(url).includes('page_size=50'))).toHaveLength(2)
    })

    it('deleting a rule that is not in the list reads the summary again', async () => {
      const { ui } = await setupSummary()
      const base = mocks.fetch.getMockImplementation()
      mocks.fetch.mockImplementation(async (url, options = {}) => (/event_rules\?page=1&page_size=50$/.test(String(url)) ? summaryResponse(rulesOn(3, [1])) : base(url, options)))
      await act(async () => { ui.current.handleSuccessDeleteRecoveryAction(4) })
      await waitFor(() => expect(ui.current.rulesSummary).toEqual({ on: 1, total: 3 }))
    })
  })

  describe('a create and a delete move it', () => {
    it('a new rule that is on: total + 1 and on + 1', async () => {
      const { ui } = await setupSummary()
      await act(async () => { ui.current.handleSuccessAddRecoveryAction({ id: 5, name: 'New', enabled: true }) })
      expect(ui.current.rulesSummary).toEqual({ on: 2, total: 5 })
    })

    it('a new rule that is off, or without `enabled`: total + 1 only', async () => {
      const { ui } = await setupSummary()
      await act(async () => { ui.current.handleSuccessAddRecoveryAction({ id: 5, name: 'New', enabled: false }) })
      expect(ui.current.rulesSummary).toEqual({ on: 1, total: 5 })
      await act(async () => { ui.current.handleSuccessAddRecoveryAction({ id: 6, name: 'Newer' }) })
      expect(ui.current.rulesSummary).toEqual({ on: 1, total: 6 })
    })

    it('deleting a rule that is on: total - 1 and on - 1', async () => {
      const { ui } = await setupSummary()
      await act(async () => { ui.current.handleSuccessDeleteRecoveryAction(1) })
      expect(ui.current.rulesSummary).toEqual({ on: 0, total: 3 })
    })

    it('deleting a rule that is off: total - 1 only', async () => {
      const { ui } = await setupSummary()
      await act(async () => { ui.current.handleSuccessDeleteRecoveryAction(2) })
      expect(ui.current.rulesSummary).toEqual({ on: 1, total: 3 })
    })

    it('a rule switched on and then deleted leaves on where it started', async () => {
      const { ui } = await setupSummary()
      putResult({ id: 2, enabled: true })
      await update(ui, 2, { enabled: true })
      await act(async () => { ui.current.handleSuccessDeleteRecoveryAction(2) })
      expect(ui.current.rulesSummary).toEqual({ on: 1, total: 3 })
    })

    it('never goes below zero', async () => {
      // redesign R2-I5: both rules are on the page (a rule that is not reads the summary again, see above)
      const { ui } = await setupSummary({ page: rulesOn(2, [1, 2]), summary: rulesOn(1, [1]) })
      await act(async () => { ui.current.handleSuccessDeleteRecoveryAction(1) })
      expect(ui.current.rulesSummary).toEqual({ on: 0, total: 0 })
      await act(async () => { ui.current.handleSuccessDeleteRecoveryAction(2) })
      expect(ui.current.rulesSummary).toEqual({ on: 0, total: 0 })
    })
  })
})
