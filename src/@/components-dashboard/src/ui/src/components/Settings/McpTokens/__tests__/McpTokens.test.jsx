import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, defaultTheme } from '~/__tests__/helpers/testUtils'
import themeJson from '~/theme.json'

const session = vi.hoisted(() => ({ user: { id: 7, level: 0 }, token: 'jwt' }))
const language = vi.hoisted(() => ({ code: 'en' }))

vi.mock('../../../../../../contexts/SessionContext', () => ({
  useSession: () => [session]
}))

vi.mock('../../../../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test/v400/en/demo' }]
}))

vi.mock('../../../../../../index', async () => {
  const { McpTokens } = await vi.importActual('../../../../../../components/McpTokens')
  return {
    McpTokens,
    useLanguage: () => [{ language: { code: language.code } }, (_key, fallback) => fallback],
    useUtils: () => [{ parseDate: (value) => `date(${value})` }],
    useSession: () => [session],
    Popup: ({ UIComponent, open, ...props }) => (open ? <UIComponent {...props} open={open} /> : null)
  }
})

import { McpTokens } from '../index'

const STATUS = {
  enabled: true,
  url: 'https://api.ordering.co/mcp/demo',
  scopes: ['read', 'write'],
  expires_in_days: { default: 7, max: 365 },
  data_notice_version: '2026-10-02',
  tools: ['whoami', 'search_operations', 'describe_operation', 'read_operation', 'write_operation']
}

const key = (overrides = {}) => ({
  id: 1,
  user_id: 7,
  name: 'Claude Code – laptop',
  prefix: 'ord_mcp_ab12',
  scope: 'read',
  expires_at: '2099-01-01 00:00:00',
  last_used_at: null,
  revoked_at: null,
  created_at: '2026-09-28 10:00:00',
  updated_at: '2026-09-28 10:00:00',
  ...overrides
})

/**
 * Answers by method + path. Each handler returns the JSON body.
 */
const mockApi = (handlers) => {
  global.fetch = vi.fn((url, options = {}) => {
    const method = options.method || 'GET'
    const path = url.replace('https://api.test/v400/en/demo', '').split('?')[0]
    const handler = handlers[`${method} ${path}`]
    if (!handler) return Promise.reject(new Error(`Unexpected ${method} ${path}`))
    const body = handler({ url, options, body: options.body ? JSON.parse(options.body) : null })
    return Promise.resolve({ ok: !body.error, status: body.error ? 400 : 200, json: async () => body })
  })
}

const calls = (method, path) => global.fetch.mock.calls.filter(([url, options = {}]) =>
  (options.method || 'GET') === method && url.replace('https://api.test/v400/en/demo', '').split('?')[0] === path
)

const theme = { ...defaultTheme, colors: { ...themeJson.colors } }

const render = () => renderWithProviders(<McpTokens />, {
  theme,
  initialEntries: ['/settings?group=developers&category=developers&id=mcpTokens']
})

describe('McpTokens', () => {
  beforeEach(() => {
    session.user = { id: 7, level: 0 }
    language.code = 'en'
    Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.resolve()) } })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('tells other levels that MCP keys are not for them and asks nothing', () => {
    session.user = { id: 7, level: 3 }
    global.fetch = vi.fn()
    render()

    expect(screen.getByText('Only administrators and business managers can use MCP keys.')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('shows Coming soon without keys or guide when the project has no MCP', async () => {
    mockApi({
      'GET /mcp/status': () => ({ error: false, result: { ...STATUS, enabled: false, url: null, scopes: [], tools: [] } })
    })
    render()

    expect(await screen.findByTestId('mcp-coming-soon')).toBeInTheDocument()
    expect(screen.queryByText('Your MCP keys')).not.toBeInTheDocument()
    expect(screen.queryByText('Setup guide')).not.toBeInTheDocument()
    expect(calls('GET', '/users/7/mcp_tokens')).toHaveLength(0)
  })

  it('works for business managers too', async () => {
    session.user = { id: 9, level: 2 }
    mockApi({
      'GET /mcp/status': () => ({ error: false, result: STATUS }),
      'GET /users/9/mcp_tokens': () => ({ error: false, result: [], pagination: { current_page: 1, total_pages: 1, total: 0 } })
    })
    render()

    expect(await screen.findByText('You have no MCP keys yet')).toBeInTheDocument()
  })

  it('lists only the session user keys with their status, and fills the guide with the status URL', async () => {
    mockApi({
      'GET /mcp/status': () => ({ error: false, result: STATUS }),
      'GET /users/7/mcp_tokens': () => ({
        error: false,
        result: [
          key(),
          key({ id: 2, name: 'Old laptop', expires_at: '2020-01-01 00:00:00' }),
          key({ id: 3, name: 'Codex', scope: 'write', revoked_at: '2026-09-28 12:00:00' })
        ],
        pagination: { current_page: 1, total_pages: 1, total: 3 }
      })
    })
    render()

    const [active] = await screen.findAllByTestId('mcp-token')
    expect(screen.getAllByTestId('mcp-token')).toHaveLength(1)
    expect(within(active).getByText('Active')).toBeInTheDocument()
    expect(within(active).getByText('ord_mcp_ab12…')).toBeInTheDocument()
    expect(within(active).getByText('Never used')).toBeInTheDocument()
    expect(within(active).getByTestId('mcp-token-expires')).toHaveTextContent(/^Expires in \d+ years$/)
    expect(within(active).getByTestId('mcp-token-expires')).toHaveAttribute('title', 'date(2099-01-01 00:00:00)')

    // Revoked and expired keys stay folded while there is an active one.
    expect(screen.queryByTestId('mcp-inactive-tokens')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Revoked and expired keys (2)'))
    const cards = within(screen.getByTestId('mcp-inactive-tokens')).getAllByTestId('mcp-token')
    expect(cards).toHaveLength(2)
    expect(within(cards[0]).getByText('Expired')).toBeInTheDocument()
    expect(within(cards[0]).getByTestId('mcp-token-expired')).toHaveTextContent(/^Expired \d+ years ago$/)
    expect(within(cards[0]).getByText('Create a replacement')).toBeInTheDocument()
    expect(within(cards[1]).getByText('Revoked')).toBeInTheDocument()
    expect(within(cards[1]).getByTestId('mcp-token-revoked')).toHaveTextContent(/^Revoked /)
    expect(within(cards[1]).getByText('Read and write')).toBeInTheDocument()
    expect(within(cards[1]).queryByText('Revoke')).not.toBeInTheDocument()

    const [url, options] = calls('GET', '/users/7/mcp_tokens')[0]
    expect(url).toContain('page=1')
    expect(url).toContain('page_size=20')
    expect(url).toContain('orderBy=-id')
    expect(options.headers.Authorization).toBe('Bearer jwt')

    expect(screen.getByTestId('mcp-server-url')).toHaveTextContent(STATUS.url)
    const guide = screen.getByTestId('mcp-guide-claude')
    expect(guide).toHaveTextContent(`"url": "${STATUS.url}"`)
    expect(guide).toHaveTextContent('"Authorization": "Bearer ${ORDERING_MCP_KEY}"') // eslint-disable-line no-template-curly-in-string

    fireEvent.click(screen.getByRole('tab', { name: 'Codex' }))
    expect(screen.getByTestId('mcp-guide-codex')).toHaveTextContent('bearer_token_env_var = "ORDERING_MCP_KEY"')
    expect(screen.getByText('Who am I in Ordering?')).toBeInTheDocument()
    expect(screen.getByText('List the last 5 orders')).toBeInTheDocument()
  })

  it('creates a key only after the notice is accepted and shows the secret once', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const log = vi.spyOn(console, 'log')
    mockApi({
      'GET /mcp/status': () => ({ error: false, result: STATUS }),
      'GET /users/7/mcp_tokens': () => ({ error: false, result: [], pagination: { current_page: 1, total_pages: 1, total: 0 } }),
      'POST /users/7/mcp_tokens': ({ body }) => ({
        error: false,
        result: { ...key({ id: 5, name: body.name, scope: body.scope }), token: 'ord_mcp_ab12SECRETSECRET' }
      })
    })
    render()

    fireEvent.click((await screen.findAllByText('Create key'))[0])
    const form = await screen.findByTestId('mcp-create-form')
    const create = within(form).getByRole('button', { name: 'Create' })
    expect(create).toBeDisabled()

    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: '  Claude Code – laptop  ' } })
    expect(create).toBeDisabled()
    fireEvent.click(within(form).getByLabelText(/I understand that the data/))
    expect(create).not.toBeDisabled()

    fireEvent.click(create)

    const secret = await screen.findByTestId('mcp-secret')
    expect(within(secret).getByTestId('mcp-secret-value')).toHaveTextContent('ord_mcp_ab12SECRETSECRET')
    expect(within(secret).getByText('Copy this key now. You will not see this key again.')).toBeInTheDocument()

    const [, options] = calls('POST', '/users/7/mcp_tokens')[0]
    expect(JSON.parse(options.body)).toEqual({
      name: 'Claude Code – laptop',
      expires_in_days: 7,
      scope: 'read',
      data_notice_version: '2026-10-02',
      data_notice_language: 'en'
    })

    fireEvent.click(within(secret).getByRole('button', { name: /Copy the key/ }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ord_mcp_ab12SECRETSECRET')

    fireEvent.click(within(secret).getByText('I saved my key'))
    await waitFor(() => expect(screen.queryByTestId('mcp-secret')).not.toBeInTheDocument())
    expect(screen.queryByText('ord_mcp_ab12SECRETSECRET')).not.toBeInTheDocument()
    expect(document.body.innerHTML).not.toContain('SECRETSECRET')

    fireEvent.click(screen.getByRole('button', { name: 'Copy to LLM' }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2))
    const setupPrompt = navigator.clipboard.writeText.mock.calls[1][0]
    expect(setupPrompt).toContain(STATUS.url)
    expect(setupPrompt).not.toContain('SECRETSECRET')
    expect(setupPrompt).not.toContain('Bearer jwt')

    const cards = screen.getAllByTestId('mcp-token')
    expect(cards).toHaveLength(1)
    expect(within(cards[0]).getByText('Claude Code – laptop')).toBeInTheDocument()

    expect(setItem.mock.calls.flat().join(' ')).not.toContain('SECRETSECRET')
    expect(log.mock.calls.flat().join(' ')).not.toContain('SECRETSECRET')
  })

  it('sends the chosen scope and expiration', async () => {
    mockApi({
      'GET /mcp/status': () => ({ error: false, result: STATUS }),
      'GET /users/7/mcp_tokens': () => ({ error: false, result: [], pagination: { current_page: 1, total_pages: 1, total: 0 } }),
      'POST /users/7/mcp_tokens': () => ({ error: false, result: { ...key({ id: 6 }), token: 'ord_mcp_x' } })
    })
    render()

    fireEvent.click((await screen.findAllByText('Create key'))[0])
    const form = await screen.findByTestId('mcp-create-form')
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Codex' } })
    fireEvent.click(within(form).getByText('90 days'))
    fireEvent.click(within(form).getByLabelText(/Read and write/))
    fireEvent.click(within(form).getByLabelText(/I understand that the data/))
    fireEvent.click(within(form).getByRole('button', { name: 'Create' }))

    await screen.findByTestId('mcp-secret')
    const [, options] = calls('POST', '/users/7/mcp_tokens')[0]
    expect(JSON.parse(options.body)).toMatchObject({ expires_in_days: 90, scope: 'write' })
  })

  it('shows the notice text from code in the user language and records that language', async () => {
    language.code = 'es-MX'
    mockApi({
      'GET /mcp/status': () => ({ error: false, result: STATUS }),
      'GET /users/7/mcp_tokens': () => ({ error: false, result: [], pagination: { current_page: 1, total_pages: 1, total: 0 } }),
      'POST /users/7/mcp_tokens': () => ({ error: false, result: { ...key({ id: 6 }), token: 'ord_mcp_x' } })
    })
    render()

    fireEvent.click((await screen.findAllByText('Create key'))[0])
    const form = await screen.findByTestId('mcp-create-form')
    expect(within(form).getByText(/Ordering le pide al asistente que te confirme cada cambio/)).toBeInTheDocument()
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Codex' } })
    fireEvent.click(within(form).getByLabelText(/Declaro que la empresa titular de este proyecto/))
    fireEvent.click(within(form).getByRole('button', { name: 'Create' }))

    await screen.findByTestId('mcp-secret')
    const [, options] = calls('POST', '/users/7/mcp_tokens')[0]
    expect(JSON.parse(options.body)).toMatchObject({ data_notice_version: '2026-10-02', data_notice_language: 'es' })
  })

  it('does not create a key while the notice versions differ', async () => {
    mockApi({
      'GET /mcp/status': () => ({ error: false, result: { ...STATUS, data_notice_version: '2026-12-01' } }),
      'GET /users/7/mcp_tokens': () => ({ error: false, result: [], pagination: { current_page: 1, total_pages: 1, total: 0 } })
    })
    render()

    fireEvent.click((await screen.findAllByText('Create key'))[0])
    const form = await screen.findByTestId('mcp-create-form')
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Codex' } })
    fireEvent.click(within(form).getByLabelText(/I understand that the data/))

    expect(within(form).getByText('This notice is being updated. Reload the page in a few minutes to create a key.')).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Create' })).toBeDisabled()
    expect(calls('POST', '/users/7/mcp_tokens')).toHaveLength(0)
  })

  it('shows API validation errors in the form', async () => {
    mockApi({
      'GET /mcp/status': () => ({ error: false, result: STATUS }),
      'GET /users/7/mcp_tokens': () => ({ error: false, result: [], pagination: { current_page: 1, total_pages: 1, total: 0 } }),
      'POST /users/7/mcp_tokens': () => ({ error: true, result: ['The selected data notice version is invalid.'] })
    })
    render()

    fireEvent.click((await screen.findAllByText('Create key'))[0])
    const form = await screen.findByTestId('mcp-create-form')
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Codex' } })
    fireEvent.click(within(form).getByLabelText(/I understand that the data/))
    fireEvent.click(within(form).getByRole('button', { name: 'Create' }))

    expect(await within(form).findByText('The selected data notice version is invalid.')).toBeInTheDocument()
    expect(screen.queryByTestId('mcp-secret')).not.toBeInTheDocument()
  })

  it('revokes a key after confirming and keeps it as Revoked', async () => {
    mockApi({
      'GET /mcp/status': () => ({ error: false, result: STATUS }),
      'GET /users/7/mcp_tokens': () => ({ error: false, result: [key()], pagination: { current_page: 1, total_pages: 1, total: 1 } }),
      'DELETE /users/7/mcp_tokens/1': () => ({ error: false, result: key({ revoked_at: '2026-09-29 12:00:00' }) })
    })
    render()

    const [card] = await screen.findAllByTestId('mcp-token')
    fireEvent.click(within(card).getByText('Revoke'))
    expect(calls('DELETE', '/users/7/mcp_tokens/1')).toHaveLength(0)

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(2))
    fireEvent.click(screen.getAllByRole('button', { name: 'Revoke' })[1])

    await waitFor(() => expect(within(screen.getByTestId('mcp-token')).getByText('Revoked')).toBeInTheDocument())
    expect(calls('DELETE', '/users/7/mcp_tokens/1')).toHaveLength(1)
  })

  it('translates ERROR_MCP_TOKEN_NOT_FOUND when revoking fails', async () => {
    mockApi({
      'GET /mcp/status': () => ({ error: false, result: STATUS }),
      'GET /users/7/mcp_tokens': () => ({ error: false, result: [key()], pagination: { current_page: 1, total_pages: 1, total: 1 } }),
      'DELETE /users/7/mcp_tokens/1': () => ({ error: true, result: ['ERROR_MCP_TOKEN_NOT_FOUND'] })
    })
    render()

    const [card] = await screen.findAllByTestId('mcp-token')
    fireEvent.click(within(card).getByText('Revoke'))
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(2))
    fireEvent.click(screen.getAllByRole('button', { name: 'Revoke' })[1])

    expect(await screen.findByText('This MCP key does not exist or is already revoked.')).toBeInTheDocument()
  })

  it('shows an error with retry when the status fails', async () => {
    mockApi({
      'GET /mcp/status': () => ({ error: true, result: ['You do not have permission.'] })
    })
    render()

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load the MCP status of this project. You do not have permission.')
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })
})
