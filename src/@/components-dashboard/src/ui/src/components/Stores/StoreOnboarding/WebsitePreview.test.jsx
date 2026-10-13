import React from 'react'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import { expect, it, vi, afterEach, beforeEach } from 'vitest'
import { ThemeProvider } from 'styled-components'
import theme from '~/theme.json'
import { WebsitePreview } from './WebsitePreview'
vi.mock('../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (_, fallback) => fallback] }))
vi.mock('../../Shared/Modal', () => ({ Modal: ({ open, children }) => open ? <section>{children}</section> : null }))
const source = { url: 'https://tenant.orderingplus.com', apiRoot: 'https://api.orderingplus.com/v400/es/tenant', code: 'website' }
const session = { origin: 'http://127.0.0.1:3200', channel: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }
const form = { name: 'Restaurant', email: 'private@example.com', token: 'private-token', categories: [{ name: 'Food', products: [{ name: 'Pizza', price: '12' }] }] }
beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => session }))))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const view = props => render(<ThemeProvider theme={theme}><WebsitePreview open form={form} appearance={{ preview: source }} {...props} /></ThemeProvider>)
const message = (iframe, type, override = {}) => fireEvent(window, new MessageEvent('message', { source: iframe.contentWindow, origin: session.origin, data: { channel: session.channel, type }, ...override }))
it('uses the actual isolated business route and changes native viewport widths without recreating the site', async () => {
  view()
  const iframe = await screen.findByTitle('Website preview')
  expect(iframe).toHaveAttribute('src', `${session.origin}/store/onboarding_preview`)
  expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin')
  expect(iframe).toHaveStyle({ width: '375px' })
  fireEvent.click(screen.getByRole('button', { name: 'Web' }))
  expect(iframe).toHaveStyle({ width: '1024px' })
  expect(screen.getByRole('button', { name: 'Web' })).toHaveAttribute('aria-pressed', 'true')
  expect(fetch.mock.calls.filter(([url]) => url.endsWith('/boot'))).toHaveLength(1)
  expect(screen.queryByText('Pizza')).toBeNull()
})
it('rejects forged ready messages and sends only the public draft to its owned frame', async () => {
  view()
  const iframe = await screen.findByTitle('Website preview')
  const post = vi.spyOn(iframe.contentWindow, 'postMessage')
  message(iframe, 'READY', { origin: 'https://evil.test' })
  message(iframe, 'READY', { source: window })
  expect(post).not.toHaveBeenCalled()
  message(iframe, 'READY')
  expect(post).toHaveBeenCalledOnce()
  expect(JSON.stringify(post.mock.calls[0])).not.toMatch(/private@example|private-token/)
  message(iframe, 'RENDERED')
  expect(screen.queryByRole('status')).toBeNull()
})
it('cycles focus across close and device controls and releases its isolated server on close', async () => {
  const rendered = view()
  await screen.findByTitle('Website preview')
  const close = screen.getByRole('button', { name: 'Close' })
  await waitFor(() => expect(close).toHaveFocus())
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
  expect(screen.getByRole('button', { name: 'Web' })).toHaveFocus()
  fireEvent.keyDown(screen.getByRole('button', { name: 'Web' }), { key: 'Tab' })
  expect(close).toHaveFocus()
  rendered.unmount()
  expect(fetch.mock.calls.find(([url]) => url.endsWith('/release'))[1].body).toBe(JSON.stringify({ channel: session.channel }))
})
it('offers retry after boot failure and retains appearance loading/error states', async () => {
  fetch.mockRejectedValueOnce(new Error('offline'))
  view()
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByTitle('Website preview')
  cleanup()
  const retry = vi.fn()
  const rendered = view({ appearance: { loading: true }, retryAppearance: retry })
  expect(screen.getByRole('status')).toBeVisible()
  rendered.rerender(<ThemeProvider theme={theme}><WebsitePreview open form={form} appearance={{ error: true }} retryAppearance={retry} /></ThemeProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(retry).toHaveBeenCalledOnce()
})

it('refreshes the native document on one server and ignores the previous frame window', async () => {
  const rendered = view()
  const first = await screen.findByTitle('Website preview')
  const previousWindow = first.contentWindow
  message(first, 'RENDERED')
  rendered.rerender(<ThemeProvider theme={theme}><WebsitePreview open form={{ ...form, name: 'Updated restaurant' }} appearance={{ preview: source }} /></ThemeProvider>)
  const current = screen.getByTitle('Website preview')
  expect(current).not.toBe(first)
  expect(fetch.mock.calls.filter(([url]) => url.endsWith('/boot'))).toHaveLength(1)
  const post = vi.spyOn(current.contentWindow, 'postMessage')
  fireEvent(window, new MessageEvent('message', { source: previousWindow, origin: session.origin, data: { channel: session.channel, type: 'READY' } }))
  expect(post).not.toHaveBeenCalled()
  message(current, 'READY')
  expect(post.mock.calls[0][0].business.name).toBe('Updated restaurant')
})

it('updates draft contents without booting more preview servers during rapid edits', async () => {
  const rendered = view()
  await screen.findByTitle('Website preview')
  for (let i = 0; i < 6; i++) rendered.rerender(<ThemeProvider theme={theme}><WebsitePreview open form={{ ...form, name: `Restaurant ${i}`, websiteColor: '#abcdef' }} appearance={{ preview: source }} /></ThemeProvider>)
  const frame = screen.getByTitle('Website preview')
  const post = vi.spyOn(frame.contentWindow, 'postMessage')
  message(frame, 'READY')
  expect(post.mock.calls.at(-1)[0]).toMatchObject({ business: { name: 'Restaurant 5' }, color: '#abcdef' })
  expect(fetch.mock.calls.filter(([url]) => url.endsWith('/boot'))).toHaveLength(1)
})

it('times out a refreshed native document on the same preview server and offers retry', async () => {
  const rendered = view()
  message(await screen.findByTitle('Website preview'), 'RENDERED')
  vi.useFakeTimers()
  try {
    rendered.rerender(<ThemeProvider theme={theme}><WebsitePreview open form={{ ...form, name: 'Stalled refresh' }} appearance={{ preview: source }} /></ThemeProvider>)
    await act(async () => { await vi.advanceTimersByTimeAsync(45000) })
    expect(screen.getByRole('alert')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/boot'))).toHaveLength(1)
  } finally { vi.useRealTimers() }
})
