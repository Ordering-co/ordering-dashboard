import { afterEach, describe, expect, it, vi } from 'vitest'
import reportWebVitals from '../reportWebVitals'

afterEach(() => {
  vi.doUnmock('web-vitals')
  vi.resetModules()
})

describe('reportWebVitals', () => {
  it('registers all five metrics with the supplied callback', async () => {
    const metrics = {
      getCLS: vi.fn(),
      getFID: vi.fn(),
      getFCP: vi.fn(),
      getLCP: vi.fn(),
      getTTFB: vi.fn()
    }
    vi.doMock('web-vitals', () => metrics)
    const callback = vi.fn()

    await reportWebVitals(callback)

    for (const register of Object.values(metrics)) {
      expect(register).toHaveBeenCalledExactlyOnceWith(callback)
    }
  })

  it('consumes an optional module load failure without calling the metric callback', async () => {
    vi.doMock('web-vitals', () => {
      throw new TypeError('Failed to fetch dynamically imported module')
    })
    const callback = vi.fn()

    await expect(reportWebVitals(callback)).resolves.toBeUndefined()
    expect(callback).not.toHaveBeenCalled()
  })

  it.each([undefined, null, false, 'callback', {}])('does not import metrics for invalid callback %s', async callback => {
    const load = vi.fn(() => ({}))
    vi.doMock('web-vitals', load)

    expect(reportWebVitals(callback)).toBeUndefined()
    await vi.dynamicImportSettled()

    expect(load).not.toHaveBeenCalled()
  })

  it('does not swallow errors from metric registration or its callback', async () => {
    const error = new Error('metric callback failed')
    vi.doMock('web-vitals', () => ({
      getCLS: callback => callback({ name: 'CLS', value: 0 }),
      getFID: vi.fn(),
      getFCP: vi.fn(),
      getLCP: vi.fn(),
      getTTFB: vi.fn()
    }))

    await expect(reportWebVitals(() => { throw error })).rejects.toBe(error)
  })
})
