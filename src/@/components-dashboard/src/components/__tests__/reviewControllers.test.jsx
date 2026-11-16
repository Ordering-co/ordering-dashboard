/* eslint-disable import/first */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign reviews FB (D4, D5, RV-04, RV-08): the controllers of /intelligence/reviews

const ROOT = 'https://api.test/v400/en/dev'
const ordering = vi.hoisted(() => ({ value: null }))
const showToast = vi.hoisted(() => vi.fn())

vi.mock('../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'test-token' }] }))
vi.mock('../../contexts/ApiContext', () => ({ useApi: () => [ordering.value] }))
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (key, text) => text] }))

import { BusinessReviews } from '../BusinessReviews'
import { UserReviewDetails } from '../UserReviewDetails'
import { ProductReviews } from '../ProductReviews'

const fetchMock = vi.fn()

/** The ordering SDK for `businesses(id).select([...]).get({ cancelToken })`; `answers` are used in order, the last repeats. */
const makeOrdering = (answers = []) => {
  const get = vi.fn(async ({ cancelToken } = {}) => {
    if (cancelToken) cancelToken.cancel = () => {}
    const answer = answers.length > 1 ? answers.shift() : answers[0]
    if (typeof answer === 'function') return answer()
    return { content: answer }
  })
  const chain = { select: vi.fn(() => chain), get }
  const sdk = {
    root: ROOT,
    get,
    setAccessToken: vi.fn(() => sdk),
    businesses: vi.fn(() => chain),
    users: vi.fn(() => chain)
  }
  return sdk
}

const review = (id, createdAt, extra = {}) => ({ id, enabled: true, created_at: createdAt, comment: `c${id}`, ...extra })
const REVIEWS = [
  review(1, '2026-10-01 10:00:00'),
  review(2, '2026-10-03 10:00:00'),
  review(3, '2026-10-02 10:00:00')
]

let props
const UI = (uiProps) => {
  props = uiProps
  return null
}

beforeEach(() => {
  props = null
  fetchMock.mockReset()
  showToast.mockReset()
  ordering.value = makeOrdering([{ result: { id: 9, reviews: { reviews: REVIEWS } } }])
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BusinessReviews: handleChangeReviewEnabled', () => {
  const mountWithReviews = () => {
    const reviews = REVIEWS.map(item => ({ ...item }))
    render(<BusinessReviews UIComponent={UI} businessId={9} business={{ id: 9, name: 'Shop' }} reviews={reviews} />)
    return reviews
  }

  it('sends the same PUT as before and answers { ok: true }', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ error: false, result: { id: 2, enabled: false } }) })
    mountWithReviews()

    let answer
    await act(async () => {
      answer = await props.handleChangeReviewEnabled(2, false)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe(`${ROOT}/business/9/reviews/2`)
    expect(options.method).toBe('PUT')
    expect(options.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer test-token' })
    expect(JSON.parse(options.body)).toEqual({ enabled: false })
    expect(answer).toEqual({ ok: true })
  })

  it('updates the review of the list with a copy, without mutating the objects it received', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ error: false, result: { id: 2, enabled: false, comment: 'edited' } }) })
    const received = mountWithReviews()
    const before = received.map(item => ({ ...item }))
    const listBefore = props.reviewsList.reviews
    const reviewBefore = listBefore.find(item => item.id === 2)

    await act(async () => {
      await props.handleChangeReviewEnabled(2, false)
    })

    const listAfter = props.reviewsList.reviews
    expect(listAfter.map(item => item.id)).toEqual([2, 3, 1]) // newest first, as before
    expect(listAfter.find(item => item.id === 2)).toMatchObject({ enabled: false, comment: 'edited' })
    expect(listAfter.find(item => item.id === 2)).not.toBe(reviewBefore)
    // the old objects are untouched
    expect(reviewBefore.enabled).toBe(true)
    expect(reviewBefore.comment).toBe('c2')
    expect(received).toEqual(before)
    // the other reviews keep their identity
    expect(listAfter.find(item => item.id === 1)).toBe(listBefore.find(item => item.id === 1))
    expect(props.reviewsList.loading).toBe(false)
  })

  it('toasts «Review updated» on success and never «Loading»', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ error: false, result: { id: 2, enabled: false } }) })
    mountWithReviews()

    await act(async () => {
      await props.handleChangeReviewEnabled(2, false)
    })

    expect(showToast).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenCalledWith('success', 'Review updated')
    expect(showToast.mock.calls.some(([, text]) => text === 'Loading')).toBe(false)
  })

  it('answers { ok: false, error } with the API error, without toast, and leaves the list', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ error: true, result: ['NOT_ALLOWED'] }) })
    mountWithReviews()
    const listBefore = props.reviewsList.reviews

    let answer
    await act(async () => {
      answer = await props.handleChangeReviewEnabled(2, false)
    })

    expect(answer).toEqual({ ok: false, error: ['NOT_ALLOWED'] })
    expect(showToast).not.toHaveBeenCalled()
    expect(props.reviewsList.reviews).toEqual(listBefore)
    expect(props.reviewsList.reviews.find(item => item.id === 2).enabled).toBe(true)
    expect(props.actionState).toEqual({ loading: false, error: ['NOT_ALLOWED'] })
  })

  // redesign reviews R1 (Q1-7): a network failure answers `{ ok: false, error: null }` so the switch says its own «The review wasn't
  // updated.» and not «Failed to fetch»; `actionState.error` still carries the message of the exception
  it('answers { ok: false, error: null } when the request throws (no raw «Failed to fetch» for the switch), without toast', async () => {
    fetchMock.mockRejectedValue(new Error('Failed to fetch'))
    mountWithReviews()

    let answer
    await act(async () => {
      answer = await props.handleChangeReviewEnabled(2, false)
    })

    expect(answer).toEqual({ ok: false, error: null })
    expect(showToast).not.toHaveBeenCalled()
    expect(props.actionState).toEqual({ loading: false, error: ['Failed to fetch'] })
  })

  it('answers { ok: false, error: null } when the response is not JSON (it throws too), and leaves the list', async () => {
    fetchMock.mockResolvedValue({ json: async () => { throw new SyntaxError('Unexpected token <') } })
    mountWithReviews()
    const listBefore = props.reviewsList.reviews

    let answer
    await act(async () => {
      answer = await props.handleChangeReviewEnabled(2, false)
    })

    expect(answer).toEqual({ ok: false, error: null })
    expect(props.reviewsList.reviews).toEqual(listBefore)
  })
})

describe('BusinessReviews: load', () => {
  const mountFetching = () => render(<BusinessReviews UIComponent={UI} businessId={9} fetchReviewsFromApi />)

  it('loads the reviews of the business, newest first', async () => {
    mountFetching()
    await waitFor(() => expect(props.reviewsList.loading).toBe(false))
    expect(props.reviewsList.error).toBeNull()
    expect(props.reviewsList.reviews.map(item => item.id)).toEqual([2, 3, 1])
  })

  it('puts the API error in reviewsList.error and stops loading', async () => {
    ordering.value = makeOrdering([{ error: true, result: ['SERVER_ERROR'] }])
    mountFetching()
    await waitFor(() => expect(props.reviewsList.loading).toBe(false))
    expect(props.reviewsList.error).toEqual(['SERVER_ERROR'])
    expect(props.reviewsList.reviews).toEqual([])
  })

  it('puts the message of an exception in reviewsList.error and stops loading', async () => {
    ordering.value = makeOrdering([() => { throw new Error('Network down') }])
    mountFetching()
    await waitFor(() => expect(props.reviewsList.loading).toBe(false))
    expect(props.reviewsList.error).toEqual(['Network down'])
  })

  it('ignores the cancellation of a request', async () => {
    class Cancel extends Error {}
    ordering.value = makeOrdering([() => { throw new Cancel('cancelled') }])
    mountFetching()
    await waitFor(() => expect(ordering.value.get).toHaveBeenCalled())
    await act(async () => {})
    expect(props.reviewsList.error).toBeNull()
  })

  it('reloadReviews asks again and clears the error', async () => {
    ordering.value = makeOrdering([
      { error: true, result: ['SERVER_ERROR'] },
      { result: { id: 9, reviews: { reviews: REVIEWS } } }
    ])
    mountFetching()
    await waitFor(() => expect(props.reviewsList.error).toEqual(['SERVER_ERROR']))
    expect(typeof props.reloadReviews).toBe('function')

    await act(async () => {
      props.reloadReviews()
    })
    await waitFor(() => expect(props.reviewsList.loading).toBe(false))

    expect(ordering.value.get).toHaveBeenCalledTimes(2)
    expect(props.reviewsList.error).toBeNull()
    expect(props.reviewsList.reviews.map(item => item.id)).toEqual([2, 3, 1])
  })

  it('reloadReviews with the reviews in props reads them again', async () => {
    const reviews = REVIEWS.map(item => ({ ...item }))
    render(<BusinessReviews UIComponent={UI} businessId={9} business={{ id: 9 }} reviews={reviews} />)
    await act(async () => {
      props.reloadReviews()
    })
    expect(props.reviewsList.reviews.map(item => item.id)).toEqual([2, 3, 1])
    expect(props.reviewsList.loading).toBe(false)
  })
})

describe('UserReviewDetails', () => {
  const USER = { id: 5, name: 'Ana' }
  const mount = () => render(<UserReviewDetails UIComponent={UI} userId={5} user={USER} />)

  it('loads the reviews of the user with the same GET', async () => {
    const result = [{ id: 1, qualification: 5, comment: 'ok' }]
    fetchMock.mockResolvedValue({ json: async () => ({ error: false, result }) })
    mount()
    await waitFor(() => expect(props.userReviewState.reviews).toEqual(result))

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe(`${ROOT}/users/5/user_reviews?params=reviewer`)
    expect(options.method).toBe('GET')
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(props.userReviewState).toEqual({ reviews: result, loading: false, error: null })
  })

  it('with content.error stops loading and carries the error', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ error: true, result: ['NOT_FOUND'] }) })
    mount()
    await waitFor(() => expect(props.userReviewState.error).toEqual(['NOT_FOUND']))
    expect(props.userReviewState).toEqual({ reviews: [], loading: false, error: ['NOT_FOUND'] })
  })

  it('with an exception stops loading and carries the message', async () => {
    fetchMock.mockRejectedValue(new Error('Network down'))
    mount()
    await waitFor(() => expect(props.userReviewState.error).toEqual(['Network down']))
    expect(props.userReviewState.loading).toBe(false)
  })

  it('reloadReviews asks again and clears the error', async () => {
    const result = [{ id: 1, qualification: 4 }]
    fetchMock
      .mockResolvedValueOnce({ json: async () => ({ error: true, result: ['NOT_FOUND'] }) })
      .mockResolvedValueOnce({ json: async () => ({ error: false, result }) })
    mount()
    await waitFor(() => expect(props.userReviewState.error).toEqual(['NOT_FOUND']))

    await act(async () => {
      props.reloadReviews()
    })
    await waitFor(() => expect(props.userReviewState.reviews).toEqual(result))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(props.userReviewState).toEqual({ reviews: result, loading: false, error: null })
  })

  // the reviews come with who wrote each one
  it('asks params=reviewer', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ error: false, result: [] }) })
    render(<UserReviewDetails UIComponent={UI} userId={5} user={USER} />)
    await waitFor(() => expect(props.userReviewState.loading).toBe(false))
    expect(fetchMock.mock.calls[0][0]).toBe(`${ROOT}/users/5/user_reviews?params=reviewer`)
  })
})

describe('ProductReviews', () => {
  const PRODUCT = { id: 3, name: 'Pizza' }
  const mount = () => render(<ProductReviews UIComponent={UI} businessId={9} categoryId={4} productId={3} product={PRODUCT} />)

  it('loads the reviews of the product with the same GET', async () => {
    const result = [{ id: 1, qualification: 5, comment: 'ok' }]
    fetchMock.mockResolvedValue({ json: async () => ({ error: false, result }) })
    mount()
    await waitFor(() => expect(props.productReviewList.reviews).toEqual(result))
    expect(fetchMock.mock.calls[0][0]).toBe(`${ROOT}/business/9/product_reviews/3/reviews`)
    expect(props.productReviewList).toEqual({ reviews: result, loading: false, error: null })
  })

  it('reloadReviews asks again and clears the error', async () => {
    const result = [{ id: 1, qualification: 3 }]
    fetchMock
      .mockResolvedValueOnce({ json: async () => ({ error: true }) })
      .mockResolvedValueOnce({ json: async () => ({ error: false, result }) })
    mount()
    await waitFor(() => expect(props.productReviewList.error).toBe(true))

    await act(async () => {
      props.reloadReviews()
    })
    await waitFor(() => expect(props.productReviewList.reviews).toEqual(result))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(props.productReviewList).toEqual({ reviews: result, loading: false, error: null })
  })
})
