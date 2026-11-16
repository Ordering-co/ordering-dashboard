/* eslint-disable import/first */
// redesign stores 5.4: the printer list failed with the Error object in `printersListState.error`, which the UI
// cannot print, and the controller gave the UI no way to ask again. Now the error is `[message]` and `getPrinters()` is passed
// down: it asks again, the error goes back to null while it loads and a good answer clears it.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn()
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', loading: false }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test' }]
}))

import { BusinessGprsPrinters } from '../index'

let ui
const draw = () => {
  ui = null
  const UI = (props) => {
    ui = props
    return null
  }
  return render(<BusinessGprsPrinters UIComponent={UI} />)
}

const answer = (body) => ({ json: async () => body })
const PRINTERS = [{ id: 1, name: 'Model A' }, { id: 2, name: 'Model B' }]

beforeEach(() => {
  mocks.fetch.mockReset()
  vi.stubGlobal('fetch', mocks.fetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BusinessGprsPrinters controller', () => {
  it('loads the printers on mount and passes getPrinters to the UI', async () => {
    mocks.fetch.mockResolvedValue(answer({ error: false, result: PRINTERS }))
    draw()
    await waitFor(() => expect(ui.printersListState.loading).toBe(false))
    expect(ui.printersListState).toEqual({ loading: false, printers: PRINTERS, error: null })
    expect(mocks.fetch).toHaveBeenCalledWith('https://api.test/printers', expect.objectContaining({ method: 'GET' }))
    expect(typeof ui.getPrinters).toBe('function')
  })

  it('keeps the message of a failed request as [message]', async () => {
    mocks.fetch.mockRejectedValue(new Error('Network down'))
    draw()
    await waitFor(() => expect(ui.printersListState.loading).toBe(false))
    expect(ui.printersListState.error).toEqual(['Network down'])
    expect(ui.printersListState.printers).toEqual([])
  })

  it('getPrinters() asks again, clears the error while it loads and keeps the list when it goes well', async () => {
    mocks.fetch.mockRejectedValueOnce(new Error('Network down'))
    draw()
    await waitFor(() => expect(ui.printersListState.error).toEqual(['Network down']))

    let release
    mocks.fetch.mockReturnValueOnce(new Promise(resolve => { release = resolve }))
    let pending
    act(() => { pending = ui.getPrinters() })
    expect(ui.printersListState.loading).toBe(true)
    expect(ui.printersListState.error).toBe(null)
    await act(async () => {
      release(answer({ error: false, result: PRINTERS }))
      await pending
    })
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(ui.printersListState).toEqual({ loading: false, printers: PRINTERS, error: null })
  })
})
