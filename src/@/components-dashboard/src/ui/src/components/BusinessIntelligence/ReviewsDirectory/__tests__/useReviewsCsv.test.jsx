/* eslint-disable import/first */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign reviews FB (D9, RV-03): the CSV download hook of /intelligence/reviews

const TEXTS = vi.hoisted(() => ({ SOME_API_MESSAGE: 'Translated message' }))
const t = vi.hoisted(() => vi.fn((key, text) => TEXTS[key] || text))

vi.mock('../../../../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token' }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, t]
}))

import { useReviewsCsv } from '../useReviewsCsv'

const REQUEST = {
  url: 'https://api.test/v400/en/dev/users/user_reviews.csv?where=%5B%5D',
  filename: 'driver_reviews_2026-09-09_2026-10-09.csv'
}

describe('useReviewsCsv', () => {
  const fetchMock = vi.fn()
  let clicked
  let clickSpy
  let revokeMock

  beforeEach(() => {
    fetchMock.mockReset()
    t.mockClear()
    clicked = []
    vi.stubGlobal('fetch', fetchMock)
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      clicked.push({ download: this.download, href: this.href, attached: this.isConnected })
    })
    URL.createObjectURL = vi.fn(() => 'blob:csv')
    revokeMock = vi.fn()
    URL.revokeObjectURL = revokeMock
  })

  afterEach(() => {
    clickSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('starts idle', () => {
    const { result } = renderHook(() => useReviewsCsv())
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(typeof result.current.download).toBe('function')
    expect(typeof result.current.reset).toBe('function')
  })

  it('asks for the file with the token and saves it through a link with the name', async () => {
    const blob = new Blob(['id,comment'])
    fetchMock.mockResolvedValue({ ok: true, blob: async () => blob })
    const { result } = renderHook(() => useReviewsCsv())

    let answer
    await act(async () => {
      answer = await result.current.download(REQUEST)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(REQUEST.url, {
      method: 'GET',
      headers: { Authorization: 'Bearer test-token' }
    })
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
    expect(clicked).toEqual([{ download: REQUEST.filename, href: 'blob:csv', attached: true }])
    expect(document.querySelector('a[download]')).toBeNull()
    expect(revokeMock).toHaveBeenCalledWith('blob:csv')
    expect(answer).toEqual({ ok: true })
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('is loading while the file comes', async () => {
    let resolveFetch
    fetchMock.mockReturnValue(new Promise(resolve => { resolveFetch = resolve }))
    const { result } = renderHook(() => useReviewsCsv())

    let pending
    act(() => {
      pending = result.current.download(REQUEST)
    })
    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolveFetch({ ok: true, blob: async () => new Blob(['x']) })
      await pending
    })
    expect(result.current.loading).toBe(false)
  })

  it('shows the first message of the API, translated, when the answer is not ok', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: true, result: ['SOME_API_MESSAGE', 'other'] })
    })
    const { result } = renderHook(() => useReviewsCsv())

    let answer
    await act(async () => {
      answer = await result.current.download(REQUEST)
    })

    expect(answer).toEqual({ ok: false, error: 'Translated message' })
    expect(result.current.error).toBe('Translated message')
    expect(result.current.loading).toBe(false)
    expect(clicked).toEqual([])
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('says «Download failed» when the failing answer has no body', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => { throw new Error('no body') } })
    const { result } = renderHook(() => useReviewsCsv())

    let answer
    await act(async () => {
      answer = await result.current.download(REQUEST)
    })

    expect(answer).toEqual({ ok: false, error: 'Download failed' })
    expect(result.current.error).toBe('Download failed')
  })

  it('says «Download failed» when the failing answer has no message', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: true, result: [] }) })
    const { result } = renderHook(() => useReviewsCsv())

    let answer
    await act(async () => {
      answer = await result.current.download(REQUEST)
    })

    expect(answer).toEqual({ ok: false, error: 'Download failed' })
  })

  it('answers with the error when the request throws', async () => {
    fetchMock.mockRejectedValue(new Error('Network down'))
    const { result } = renderHook(() => useReviewsCsv())

    let answer
    await act(async () => {
      answer = await result.current.download(REQUEST)
    })

    expect(answer).toEqual({ ok: false, error: 'Network down' })
    expect(result.current.error).toBe('Network down')
    expect(result.current.loading).toBe(false)
  })

  // redesign a request that never reaches the server rejects with a TypeError whose text is the browser's; it is not a message for a person
  it.each([
    ['Failed to fetch'],
    ['NetworkError when attempting to fetch resource.'],
    ['Load failed']
  ])('says the translated fallback, not «%s», when the network fails', async (message) => {
    fetchMock.mockRejectedValue(new TypeError(message))
    const { result } = renderHook(() => useReviewsCsv())

    let answer
    await act(async () => {
      answer = await result.current.download(REQUEST)
    })

    expect(answer).toEqual({ ok: false, error: 'The report could not be downloaded. Try again.' })
    expect(result.current.error).toBe('The report could not be downloaded. Try again.')
    expect(t).toHaveBeenCalledWith('REVIEWS_DOWNLOAD_NETWORK_FAILED', 'The report could not be downloaded. Try again.')
  })

  it('ignores a second call while one is going', async () => {
    let resolveFetch
    fetchMock.mockReturnValue(new Promise(resolve => { resolveFetch = resolve }))
    const { result } = renderHook(() => useReviewsCsv())

    let first
    let second
    act(() => {
      first = result.current.download(REQUEST)
      second = result.current.download(REQUEST)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFetch({ ok: true, blob: async () => new Blob(['x']) })
      await first
    })
    expect(await second).toBeUndefined()
    expect(clicked).toHaveLength(1)

    // once it is done, a new call goes through
    fetchMock.mockResolvedValue({ ok: true, blob: async () => new Blob(['y']) })
    await act(async () => {
      await result.current.download(REQUEST)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('reset clears the error', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => null })
    const { result } = renderHook(() => useReviewsCsv())

    await act(async () => {
      await result.current.download(REQUEST)
    })
    expect(result.current.error).toBe('Download failed')

    act(() => {
      result.current.reset()
    })
    expect(result.current.error).toBeNull()
  })

  it('clears the previous error when a new download starts', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => null })
    const { result } = renderHook(() => useReviewsCsv())
    await act(async () => {
      await result.current.download(REQUEST)
    })
    expect(result.current.error).toBe('Download failed')

    fetchMock.mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['z']) })
    await act(async () => {
      await result.current.download(REQUEST)
    })
    expect(result.current.error).toBeNull()
  })
})
