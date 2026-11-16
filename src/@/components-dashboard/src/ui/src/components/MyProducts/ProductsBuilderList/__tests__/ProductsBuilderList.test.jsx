/* eslint-disable import/first */
// redesign my-products B2 (D7, M-MP-07): ProductsBuilderList, the loader of /my-products/<product>?id=. Covered: the same GET
// (the app's URL and the bearer token) and the same `addQueryToUrl({ id })`; the type by `getType` (`app` before `web`) choosing
// AppUI or OrderingWebsite with the same props; a code that is neither says so (main painted a blank page); loading is a busy status
// with a hidden «Loading»; an error shows the WHOLE message in an alert (main showed `result[0]` of a text, its first letter).
// The two editors are stand-ins that show what they were given.
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mockState = vi.hoisted(() => ({ addQueryToUrl: null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text],
  useApi: () => [{ root: 'https://api.example.test' }],
  useSession: () => [{ token: 'token-1' }]
}))
vi.mock('../../../../utils', () => {
  mockState.addQueryToUrl = vi.fn()
  return { addQueryToUrl: mockState.addQueryToUrl }
})
vi.mock('../../AppUI', () => ({
  AppUI: (props) => <div data-testid='app-ui' data-product-id={props.productId} data-code={props.app?.base?.code} />
}))
vi.mock('../../OrderingWebsite', () => ({
  OrderingWebsite: (props) => <div data-testid='ordering-website' data-product-id={props.productId} data-code={props.app?.base?.code} data-app-id={props.appId ?? ''} />
}))

import { ProductsBuilderList } from '../index'

const answer = (body) => {
  global.fetch = vi.fn(() => Promise.resolve({ json: async () => body }))
}

const mount = (props = {}) => renderWithProviders(<ProductsBuilderList productId='677' {...props} />)

beforeEach(() => {
  mockState.addQueryToUrl.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ProductsBuilderList · the request', () => {
  it('asks for the product with the same GET and writes `?id=` to the URL', async () => {
    answer({ error: false, result: { id: 677, base: { code: 'app_driver_x' } } })
    mount()
    await screen.findByTestId('app-ui')
    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [url, options] = global.fetch.mock.calls[0]
    expect(url).toBe('https://api.example.test/builder/apps/677')
    expect(options).toEqual({
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-1' }
    })
    expect(mockState.addQueryToUrl).toHaveBeenCalledWith({ id: '677' })
  })
})

describe('ProductsBuilderList · the type picks the editor', () => {
  it('an app code goes to AppUI with the app and the page props', async () => {
    answer({ error: false, result: { id: 677, base: { code: 'app_driver_x' } } })
    mount()
    const editor = await screen.findByTestId('app-ui')
    expect(editor).toHaveAttribute('data-code', 'app_driver_x')
    expect(editor).toHaveAttribute('data-product-id', '677')
    expect(screen.queryByTestId('ordering-website')).toBeNull()
  })

  it('a web code goes to OrderingWebsite with the app and the page props', async () => {
    answer({ error: false, result: { id: 12, base: { code: 'web_marketplace_26' } } })
    mount({ productId: '12' })
    const editor = await screen.findByTestId('ordering-website')
    expect(editor).toHaveAttribute('data-code', 'web_marketplace_26')
    expect(editor).toHaveAttribute('data-product-id', '12')
    expect(screen.queryByTestId('app-ui')).toBeNull()
  })

  it('`app` is looked for before `web`: a code with both is an app', async () => {
    answer({ error: false, result: { id: 9, base: { code: 'web_app_x' } } })
    mount()
    expect(await screen.findByTestId('app-ui')).toBeInTheDocument()
    expect(screen.queryByTestId('ordering-website')).toBeNull()
  })

  it('a code that is neither says the product cannot be edited here (main painted a blank page)', async () => {
    answer({ error: false, result: { id: 5, base: { code: 'kiosk_screen' } } })
    mount()
    expect(await screen.findByText("This product can't be edited here")).toBeInTheDocument()
    expect(screen.queryByTestId('app-ui')).toBeNull()
    expect(screen.queryByTestId('ordering-website')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('ProductsBuilderList · loading', () => {
  it('while the request is open it is a busy status with a hidden «Loading» and no editor', async () => {
    global.fetch = vi.fn(() => new Promise(() => {}))
    mount()
    const status = await screen.findByRole('status')
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(status).toHaveTextContent('Loading')
    expect(status.querySelector('.odc-sr-only')).toHaveTextContent('Loading')
    expect(status.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(screen.queryByTestId('app-ui')).toBeNull()
  })

  it('the skeleton is gone once the product arrives', async () => {
    answer({ error: false, result: { id: 677, base: { code: 'app_driver_x' } } })
    mount()
    await screen.findByTestId('app-ui')
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('ProductsBuilderList · errors (M-MP-07)', () => {
  it('a text error is shown whole (main showed its first letter, «N»)', async () => {
    answer({ error: true, result: 'Not found' })
    mount()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("We couldn't open this app")
    expect(alert).toHaveTextContent('Not found')
    expect(alert).not.toHaveTextContent(/^N$/)
    expect(screen.queryByTestId('app-ui')).toBeNull()
    expect(screen.queryByTestId('ordering-website')).toBeNull()
  })

  it('a list error shows its first message', async () => {
    answer({ error: true, result: ['Nope', 'Second'] })
    mount()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Nope')
    expect(alert).not.toHaveTextContent('Second')
  })

  it('a request that fails shows its message in the same alert', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network down')))
    mount()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("We couldn't open this app")
    expect(alert).toHaveTextContent('Network down')
  })

  it('an error with no text still says the app could not be opened', async () => {
    answer({ error: true, result: [] })
    mount()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("We couldn't open this app")
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })
})

// Owner decision 20 B (2026-10-21): the website editor edits the site whose code is the app's code (`base.code`, as AppUI does).
describe('ProductsBuilderList · which site a website product edits (owner decision 20)', () => {
  it('gives the website editor the app code as `appId`', async () => {
    answer({ error: false, result: { id: 678, base: { code: 'web_ordering_x' } } })
    mount({ productId: '678' })
    const editor = await screen.findByTestId('ordering-website')
    expect(editor).toHaveAttribute('data-app-id', 'web_ordering_x')
  })
})
