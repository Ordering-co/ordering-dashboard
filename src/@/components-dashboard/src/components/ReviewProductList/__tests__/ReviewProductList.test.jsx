/* eslint-disable import/first */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// redesign reviews R1 (Q1-5): the controller of the products list only keeps the answer of the last request it made

const ordering = vi.hoisted(() => ({ value: null }))

vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [ordering.value] }))

import { ReviewProductList } from '../index'

/** The SDK chain `businesses(id).products()[.where(where)].get()`; every `get` waits for the test to settle it. */
const makeOrdering = () => {
  const requests = []
  const endpoint = (where) => ({
    where: (next) => endpoint(next),
    get: () => new Promise((resolve, reject) => {
      requests.push({ where, resolve, reject })
    })
  })
  return { requests, sdk: { businesses: vi.fn(() => ({ products: () => endpoint(null) })) } }
}

const ALL = [{ id: 1, name: 'Burger' }, { id: 2, name: 'Mac and cheese' }, { id: 3, name: 'Water' }]
const FILTERED = [{ id: 2, name: 'Mac and cheese' }]

let props
let requests
const UI = (uiProps) => {
  props = uiProps
  return null
}

const mount = () => render(<ReviewProductList UIComponent={UI} businessId={3} isSearchByName isSearchByDescription />)

beforeEach(() => {
  props = null
  const made = makeOrdering()
  requests = made.requests
  ordering.value = made.sdk
})

describe('ReviewProductList · the last request wins (Q1-5)', () => {
  it('a slow load without a search does not overwrite the answer of the search that came after it', async () => {
    mount()
    await waitFor(() => expect(requests).toHaveLength(1))
    act(() => props.handleChangeSearch('Mac'))
    await waitFor(() => expect(requests).toHaveLength(2))

    // the search answers first, then the old load, which is the last to arrive
    await act(async () => requests[1].resolve({ content: { error: false, result: FILTERED } }))
    await act(async () => requests[0].resolve({ content: { error: false, result: ALL } }))

    expect(props.productState.products).toEqual(FILTERED)
    expect(props.productState.loading).toBe(false)
  })

  it('an old load that fails does not turn a good answer into an error, nor stop the spinner of the newer request', async () => {
    mount()
    await waitFor(() => expect(requests).toHaveLength(1))
    act(() => props.handleChangeSearch('Mac'))
    await waitFor(() => expect(requests).toHaveLength(2))

    await act(async () => requests[0].reject(new Error('stale failure')))
    expect(props.productState.error).toBeNull()
    expect(props.productState.loading).toBe(true)

    await act(async () => requests[1].resolve({ content: { error: false, result: FILTERED } }))
    expect(props.productState.products).toEqual(FILTERED)
    expect(props.productState.error).toBeNull()
  })

  it('with a single request the list is that answer', async () => {
    mount()
    await waitFor(() => expect(requests).toHaveLength(1))
    await act(async () => requests[0].resolve({ content: { error: false, result: ALL } }))
    expect(props.productState.products).toEqual(ALL)
    expect(props.productState.loading).toBe(false)
  })

  it('the search is still sent encoded, in the name and in the description', async () => {
    mount()
    await waitFor(() => expect(requests).toHaveLength(1))
    act(() => props.handleChangeSearch('Mac'))
    await waitFor(() => expect(requests).toHaveLength(2))
    expect(requests[1].where).toEqual({
      conditions: [
        { attribute: 'name', value: { condition: 'ilike', value: '%25Mac%25' } },
        { attribute: 'description', value: { condition: 'ilike', value: '%25Mac%25' } }
      ],
      conector: 'OR'
    })
  })
})
