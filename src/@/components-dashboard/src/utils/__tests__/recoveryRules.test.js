import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CHANNELS_PAGE_SIZE,
  CHANNEL_CONCURRENCY,
  MAX_PAGES,
  PAGE_SIZES,
  WAIT_UNITS,
  clampPageSize,
  countRulesOn,
  fetchAllPages,
  formatWait,
  mapWithConcurrency,
  ruleWait,
  splitWait,
  toSeconds,
  waitParts
} from '../recoveryRules'

// redesign RA-B1 (decision 4, decision 2; M-RA11): the wait of a rule as amount + unit, and the channel fan-out

describe('constants', () => {
  it('pins the contract', () => {
    expect(WAIT_UNITS).toEqual(['seconds', 'minutes', 'hours', 'days'])
    expect(PAGE_SIZES).toEqual([10, 25, 50])
    expect(CHANNEL_CONCURRENCY).toBe(6)
    expect(CHANNELS_PAGE_SIZE).toBe(50)
    expect(MAX_PAGES).toBe(20)
  })
})

describe('ruleWait', () => {
  it('reads times[0] as a number', () => {
    expect(ruleWait({ times: [260] })).toBe(260)
    expect(ruleWait({ times: ['430'] })).toBe(430)
    expect(ruleWait({ times: [0] })).toBe(0)
  })

  it('is null when it is missing or not finite', () => {
    expect(ruleWait(null)).toBeNull()
    expect(ruleWait({})).toBeNull()
    expect(ruleWait({ times: [] })).toBeNull()
    expect(ruleWait({ times: [null] })).toBeNull()
    expect(ruleWait({ times: ['abc'] })).toBeNull()
    expect(ruleWait({ times: [Infinity] })).toBeNull()
    expect(ruleWait({ times: '[]' })).toBeNull()
  })

  // redesign R2-F2 (R1-10): the PUT sends `times: "[260]"` and the API may answer with that very text
  it('reads times as JSON text too ("[260]"), as the PUT sends it', () => {
    expect(ruleWait({ times: '[260]' })).toBe(260)
    expect(ruleWait({ times: '[5260]' })).toBe(5260)
    expect(ruleWait({ times: '[0]' })).toBe(0)
    expect(ruleWait({ times: '["430"]' })).toBe(430)
    expect(ruleWait({ times: '[260, 600]' })).toBe(260)
  })

  it('is null for text that is not JSON of numbers', () => {
    expect(ruleWait({ times: '260' })).toBeNull() // JSON, but not a list
    expect(ruleWait({ times: 'abc' })).toBeNull()
    expect(ruleWait({ times: '[abc]' })).toBeNull()
    expect(ruleWait({ times: '{"a":1}' })).toBeNull()
    expect(ruleWait({ times: '["x"]' })).toBeNull()
    expect(ruleWait({ times: '[null]' })).toBeNull()
    expect(ruleWait({ times: '' })).toBeNull()
  })
})

describe('splitWait', () => {
  it('takes the largest unit that represents the value exactly', () => {
    expect(splitWait(260)).toEqual({ amount: 260, unit: 'seconds' })
    expect(splitWait(5)).toEqual({ amount: 5, unit: 'seconds' })
    expect(splitWait(60)).toEqual({ amount: 1, unit: 'minutes' })
    expect(splitWait(430)).toEqual({ amount: 430, unit: 'seconds' })
    expect(splitWait(7200)).toEqual({ amount: 2, unit: 'hours' })
    expect(splitWait(172800)).toEqual({ amount: 2, unit: 'days' })
    expect(splitWait(108000)).toEqual({ amount: 30, unit: 'hours' })
  })

  it('0 and null are minutes', () => {
    expect(splitWait(0)).toEqual({ amount: 0, unit: 'minutes' })
    expect(splitWait(null)).toEqual({ amount: null, unit: 'minutes' })
    expect(splitWait(undefined)).toEqual({ amount: null, unit: 'minutes' })
    expect(splitWait(NaN)).toEqual({ amount: null, unit: 'minutes' })
  })
})

describe('toSeconds', () => {
  it('multiplies by the unit', () => {
    expect(toSeconds(260, 'seconds')).toBe(260)
    expect(toSeconds(4, 'minutes')).toBe(240)
    expect(toSeconds(2, 'hours')).toBe(7200)
    expect(toSeconds(2, 'days')).toBe(172800)
    expect(toSeconds(0, 'days')).toBe(0)
    expect(toSeconds('30', 'minutes')).toBe(1800)
  })

  it('is null for anything but an integer >= 0 with a known unit', () => {
    expect(toSeconds(-1, 'minutes')).toBeNull()
    expect(toSeconds(1.5, 'minutes')).toBeNull()
    expect(toSeconds('', 'minutes')).toBeNull()
    expect(toSeconds(null, 'minutes')).toBeNull()
    expect(toSeconds(NaN, 'minutes')).toBeNull()
    expect(toSeconds(5, 'weeks')).toBeNull()
  })

  it('round-trips with splitWait', () => {
    for (const seconds of [0, 5, 60, 260, 430, 7200, 90000, 172800]) {
      const { amount, unit } = splitWait(seconds)
      expect(toSeconds(amount, unit)).toBe(seconds)
    }
  })
})

describe('waitParts', () => {
  it('breaks the value down without zeros', () => {
    expect(waitParts(260)).toEqual([{ value: 4, unit: 'minute' }, { value: 20, unit: 'second' }])
    expect(waitParts(172800)).toEqual([{ value: 2, unit: 'day' }])
    expect(waitParts(60)).toEqual([{ value: 1, unit: 'minute' }])
    expect(waitParts(90061)).toEqual([
      { value: 1, unit: 'day' },
      { value: 1, unit: 'hour' },
      { value: 1, unit: 'minute' },
      { value: 1, unit: 'second' }
    ])
  })

  it('0 is one zero second part, and no value has no parts', () => {
    expect(waitParts(0)).toEqual([{ value: 0, unit: 'second' }])
    expect(waitParts(null)).toEqual([])
    expect(waitParts(undefined)).toEqual([])
  })
})

describe('formatWait', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('formats in English', () => {
    expect(formatWait(260, 'en')).toBe('4 min 20 sec')
    expect(formatWait(172800, 'en')).toBe('2 days')
    expect(formatWait(60, 'en')).toBe('1 min')
    expect(formatWait(0, 'en')).toBe('0 sec')
  })

  it('formats in Spanish', () => {
    expect(formatWait(260, 'es')).toBe('4 min 20 s')
    expect(formatWait(172800, 'es')).toBe('2 d')
    expect(formatWait(7200, 'es')).toBe('2 h')
    expect(formatWait(0, 'es')).toBe('0 s')
  })

  it('is empty when there is no value', () => {
    expect(formatWait(null, 'en')).toBe('')
    expect(formatWait(undefined, 'es')).toBe('')
  })

  it('falls back to "value unit" without Intl', () => {
    vi.stubGlobal('Intl', undefined)
    expect(formatWait(260, 'en')).toBe('4 minute 20 second')
    expect(formatWait(172800, 'en')).toBe('2 day')
    expect(formatWait(null, 'en')).toBe('')
  })
})

describe('countRulesOn', () => {
  it('counts the enabled rules over the total', () => {
    expect(countRulesOn([{ enabled: true }, { enabled: false }, { enabled: true }, {}])).toEqual({ on: 2, total: 4 })
    expect(countRulesOn([])).toEqual({ on: 0, total: 0 })
  })

  it('tolerates a missing list', () => {
    expect(countRulesOn(null)).toEqual({ on: 0, total: 0 })
    expect(countRulesOn(undefined)).toEqual({ on: 0, total: 0 })
  })
})

describe('clampPageSize', () => {
  it('keeps the allowed sizes', () => {
    expect(clampPageSize(10)).toBe(10)
    expect(clampPageSize(25)).toBe(25)
    expect(clampPageSize(50)).toBe(50)
  })

  it('goes to the nearest allowed value above', () => {
    expect(clampPageSize(11)).toBe(25)
    expect(clampPageSize(26)).toBe(50)
    expect(clampPageSize(5)).toBe(10)
    expect(clampPageSize('25')).toBe(25)
  })

  it('999 is 50', () => {
    expect(clampPageSize(999)).toBe(50)
  })

  it('invalid is 10', () => {
    expect(clampPageSize(NaN)).toBe(10)
    expect(clampPageSize('abc')).toBe(10)
    expect(clampPageSize(undefined)).toBe(10)
    expect(clampPageSize(null)).toBe(10)
    expect(clampPageSize(0)).toBe(10)
    expect(clampPageSize(-5)).toBe(10)
  })
})

describe('mapWithConcurrency', () => {
  const makeWorker = () => {
    const state = { running: 0, max: 0, started: [] }
    const worker = vi.fn(async (item) => {
      state.started.push(item)
      state.running += 1
      state.max = Math.max(state.max, state.running)
      await new Promise(resolve => setTimeout(resolve, 5))
      state.running -= 1
      return item * 2
    })
    return { state, worker }
  }

  it('never runs more than `limit` at once and keeps the order of the results', async () => {
    const { state, worker } = makeWorker()
    const items = Array.from({ length: 20 }, (_, index) => index + 1)
    const results = await mapWithConcurrency(items, CHANNEL_CONCURRENCY, worker)
    expect(results).toEqual(items.map(item => item * 2))
    expect(state.max).toBe(6)
    expect(worker).toHaveBeenCalledTimes(20)
  })

  it('passes the item and its index', async () => {
    const worker = vi.fn(async (item, index) => `${item}:${index}`)
    expect(await mapWithConcurrency(['a', 'b'], 2, worker)).toEqual(['a:0', 'b:1'])
  })

  it('an empty list answers an empty list', async () => {
    expect(await mapWithConcurrency([], 6, vi.fn())).toEqual([])
  })

  it('an aborted signal launches nothing else', async () => {
    const { state, worker } = makeWorker()
    const controller = new AbortController()
    const items = Array.from({ length: 20 }, (_, index) => index + 1)
    const promise = mapWithConcurrency(items, 3, worker, { signal: controller.signal })
    await new Promise(resolve => setTimeout(resolve, 1))
    controller.abort()
    const results = await promise
    expect(state.started).toHaveLength(3)
    expect(results).toHaveLength(20)
    expect(results.slice(0, 3)).toEqual([2, 4, 6])
    expect(results[5]).toBeUndefined()
  })

  it('a signal aborted from the start launches nothing', async () => {
    const worker = vi.fn(async () => 1)
    const controller = new AbortController()
    controller.abort()
    await mapWithConcurrency([1, 2, 3], 3, worker, { signal: controller.signal })
    expect(worker).not.toHaveBeenCalled()
  })

  it('rejects with the error of a worker and stops launching', async () => {
    const worker = vi.fn(async (item) => {
      if (item === 1) throw new Error('boom')
      await new Promise(resolve => setTimeout(resolve, 5))
      return item
    })
    await expect(mapWithConcurrency([1, 2, 3, 4, 5, 6], 1, worker)).rejects.toThrow('boom')
    expect(worker).toHaveBeenCalledTimes(1)
  })
})

describe('fetchAllPages', () => {
  const answer = (current, totalPages, result) => ({ error: false, result, pagination: { current_page: current, total_pages: totalPages } })

  it('reads from page 1 while current_page < total_pages and concatenates the results', async () => {
    const requestPage = vi.fn(async (page) => answer(page, 3, [`a${page}`, `b${page}`]))
    await expect(fetchAllPages(requestPage)).resolves.toEqual({ error: false, result: ['a1', 'b1', 'a2', 'b2', 'a3', 'b3'] })
    expect(requestPage.mock.calls.map(([page]) => page)).toEqual([1, 2, 3])
  })

  it('a single page asks once', async () => {
    const requestPage = vi.fn(async (page) => answer(page, 1, [1]))
    await expect(fetchAllPages(requestPage)).resolves.toEqual({ error: false, result: [1] })
    expect(requestPage).toHaveBeenCalledTimes(1)
  })

  it('an answer without pagination is one page', async () => {
    const requestPage = vi.fn(async () => ({ error: false, result: [1, 2] }))
    await expect(fetchAllPages(requestPage)).resolves.toEqual({ error: false, result: [1, 2] })
    expect(requestPage).toHaveBeenCalledTimes(1)
  })

  it('a result that is not a list adds nothing', async () => {
    await expect(fetchAllPages(async () => ({ error: false, result: null }))).resolves.toEqual({ error: false, result: [] })
    await expect(fetchAllPages(async (page) => answer(page, 2, page === 1 ? { id: 1 } : [2]))).resolves.toEqual({ error: false, result: [2] })
  })

  it('the first answer with error stops and comes back as the failure, without the pages read before', async () => {
    const requestPage = vi.fn(async (page) => (page === 2 ? { error: true, result: ['No access'] } : answer(page, 4, [page])))
    await expect(fetchAllPages(requestPage)).resolves.toEqual({ error: true, result: ['No access'] })
    expect(requestPage).toHaveBeenCalledTimes(2)
  })

  it('a rejection of requestPage reaches the caller', async () => {
    await expect(fetchAllPages(async () => { throw new Error('network down') })).rejects.toThrow('network down')
  })

  it('stops at MAX_PAGES when total_pages never ends, and at a custom maxPages', async () => {
    const requestPage = vi.fn(async (page) => answer(page, 999999, [page]))
    const all = await fetchAllPages(requestPage)
    expect(requestPage).toHaveBeenCalledTimes(MAX_PAGES)
    expect(all.result).toHaveLength(MAX_PAGES)

    requestPage.mockClear()
    await fetchAllPages(requestPage, { maxPages: 3 })
    expect(requestPage).toHaveBeenCalledTimes(3)
  })

  it('an aborted signal rejects with an AbortError and asks nothing more', async () => {
    const controller = new AbortController()
    const requestPage = vi.fn(async (page) => {
      if (page === 2) controller.abort()
      return answer(page, 5, [page])
    })
    await expect(fetchAllPages(requestPage, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(requestPage).toHaveBeenCalledTimes(2)

    requestPage.mockClear()
    await expect(fetchAllPages(requestPage, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(requestPage).not.toHaveBeenCalled()
  })
})
