/* eslint-disable import/first */
import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const runtime = vi.hoisted(() => ({
  controllerProps: null,
  paginationProps: [],
  parseDate: vi.fn((value, options) => `${value}:${String(options.utc)}`)
}))

vi.mock('../../../../../index', () => ({
  IntegrationLogs: props => {
    runtime.controllerProps = props
    return <div data-testid='integration-controller' />
  },
  useLanguage: () => [{}, (key, fallback) => fallback || key],
  useUtils: () => [{ parseDate: runtime.parseDate }]
}))

vi.mock('react-loading-skeleton', () => ({
  default: props => <span data-testid='skeleton' data-count={props.count} />
}))

vi.mock('react-syntax-highlighter', () => ({
  default: ({ children, language, style }) => (
    <pre data-testid='syntax' data-language={language} data-palette={style?.hljs?.background || 'palette'}>{children}</pre>
  )
}))

// IntegrationLogs imports Modal and Pagination by file, like PushTokens.
vi.mock('../Modal', () => ({
  Modal: ({ children, onClose, open, title }) => open && (
    <div role='dialog' aria-label={title}>
      <button type='button' onClick={onClose}>Close modal</button>
      {children}
    </div>
  )
}))

vi.mock('../Pagination', () => ({
  Pagination: props => {
    runtime.paginationProps.push(props)
    return (
      <div data-testid='pagination'>
        <button type='button' onClick={() => props.handleChangePage(2)}>Page 2</button>
        {props.handleChangePageSize && <button type='button' onClick={() => props.handleChangePageSize(25)}>Size 25</button>}
      </div>
    )
  }
}))

import { IntegrationLogs, IntegrationLogsUI } from './IntegrationLogs'
import { PushTokens } from './PushTokens'
// Copy decision 4 (user, 2026-10-06): shared labels in sentence case; only the names these tests look up changed.

const lightTheme = createDashboardTheme(theme)
const darkTheme = createDashboardTheme(theme, { mode: 'dark' })
const renderWithTheme = (content, currentTheme = lightTheme) => render(
  <ThemeProvider theme={currentTheme}>{content}</ThemeProvider>
)

const baseLog = {
  id: 4,
  type: 'warning',
  model: 'Order',
  model_id: 82,
  event: 'order.updated',
  created_at: '2026-09-14T12:00:00Z'
}

const integrationProps = overrides => ({
  logsList: { error: false, loading: false, logs: [baseLog] },
  paginationProps: { currentPage: 1, from: 1, totalPages: 3 },
  getLogs: vi.fn(),
  selectedLogState: { loading: false, log: baseLog },
  setSelectedLogState: vi.fn(),
  relatedGroupEvent: '',
  setRelatedGroupEvent: vi.fn(),
  ...overrides
})

beforeEach(() => {
  runtime.controllerProps = null
  runtime.paginationProps = []
  runtime.parseDate.mockClear()
})

describe('L2d-C14 IntegrationLogs', () => {
  it('preserves controller wiring and pagination payloads', async () => {
    const user = userEvent.setup()
    const props = integrationProps()
    renderWithTheme(<IntegrationLogsUI {...props} />)

    const root = screen.getByRole('button', { name: 'View details: order.updated' }).closest('[data-slot="integration-logs"]')
    expect(root).toHaveAttribute('dir', 'ltr')
    expect(root.querySelector('[data-slot="integration-log-scrollport"]')).toBeInTheDocument()
    expect(root.querySelector('[data-slot="integration-log-table"]')).toBeInTheDocument()
    expect(screen.getByText('Model')).toBeInTheDocument()
    expect(screen.getByText('Model ID')).toBeInTheDocument()
    expect(runtime.parseDate).toHaveBeenCalledWith(baseLog.created_at, { utc: true })

    await user.click(screen.getByRole('button', { name: 'Page 2' }))
    await user.click(screen.getByRole('button', { name: 'Size 25' }))
    expect(props.getLogs).toHaveBeenNthCalledWith(1, 2, 10)
    expect(props.getLogs).toHaveBeenNthCalledWith(2, 1, 25)

    renderWithTheme(<IntegrationLogs marker='wired' />)
    expect(runtime.controllerProps).toMatchObject({ marker: 'wired', UIComponent: IntegrationLogsUI })
  })

  it('preserves empty last-page fallback branches', async () => {
    const getLogs = vi.fn()
    const rendered = renderWithTheme(
      <IntegrationLogsUI {...integrationProps({ logsList: { loading: false, logs: [] }, getLogs, paginationProps: { currentPage: 3, from: 21, totalPages: 3 } })} />
    )
    await waitFor(() => expect(getLogs).toHaveBeenCalledWith(2, 10))
    getLogs.mockClear()
    rendered.rerender(
      <ThemeProvider theme={lightTheme}>
        <IntegrationLogsUI {...integrationProps({ logsList: { loading: false, logs: [] }, getLogs, paginationProps: { currentPage: 2, from: 11, totalPages: 3 } })} />
      </ThemeProvider>
    )
    await waitFor(() => expect(getLogs).toHaveBeenCalledWith(2, 10))
  })

  it('keeps row mouse selection and emits once through the keyboard action', async () => {
    const user = userEvent.setup()
    const props = integrationProps()
    renderWithTheme(<IntegrationLogsUI {...props} />)
    const row = screen.getByRole('button', { name: 'View details: order.updated' }).closest('[data-slot="integration-log-row"]')
    expect(row).toHaveAttribute('data-severity', 'warning')

    fireEvent.click(row)
    expect(props.setSelectedLogState).toHaveBeenCalledWith({ ...props.selectedLogState, log: baseLog })
    expect(props.setSelectedLogState).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Close modal' }))
    props.setSelectedLogState.mockClear()
    const action = screen.getByRole('button', { name: 'View details: order.updated' })
    action.focus()
    await user.keyboard('{Enter}')
    expect(props.setSelectedLogState).toHaveBeenCalledOnce()
    expect(props.setSelectedLogState).toHaveBeenCalledWith({ ...props.selectedLogState, log: baseLog })
  })

  it('guards mouse and keyboard paths when actions are disabled', async () => {
    const user = userEvent.setup()
    const props = integrationProps({ actionDisabled: true })
    renderWithTheme(<IntegrationLogsUI {...props} />)
    const root = document.querySelector('[data-slot="integration-logs"]')
    const action = screen.getByRole('button', { name: 'View details: order.updated' })
    expect(root).toHaveAttribute('inert')
    expect(action).toBeDisabled()
    fireEvent.click(action.closest('[data-slot="integration-log-row"]'))
    await user.click(action)
    expect(props.setSelectedLogState).not.toHaveBeenCalled()
  })

  it('uses a single-open collapsible Base accordion and preserves dynamic trace formatting', async () => {
    const user = userEvent.setup()
    const trace = [
      { class: 'Worker', type: 'Job', function: 'run', file: '/app/job.js', line: 9 },
      'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'
    ]
    const log = {
      ...baseLog,
      group_key: 'group-4',
      exception: { execution_time: 12, trace },
      request: { method: 'POST', payload_type: 'json', payload: JSON.stringify({ lines: Array.from({ length: 12 }, (_, index) => index) }, null, 2) },
      response: { content_type: 'text', content: 'ok' }
    }
    const props = integrationProps({ logsList: { error: false, loading: false, logs: [log] }, selectedLogState: { loading: false, log } })
    renderWithTheme(<IntegrationLogsUI {...props} />, darkTheme)
    await user.click(screen.getByRole('button', { name: 'View details: order.updated' }))

    const dialog = screen.getByRole('dialog', { name: 'Log' })
    const exception = within(dialog).getByRole('button', { name: /Exception/ })
    const request = within(dialog).getByRole('button', { name: /Request/ })
    expect(exception).toHaveAttribute('aria-expanded', 'false')
    await user.click(exception)
    expect(exception).toHaveAttribute('aria-expanded', 'true')
    const exceptionPanel = document.getElementById(exception.getAttribute('aria-controls'))
    expect(dialog).toHaveTextContent('Worker::Job::run (/app/job.js:9)')
    expect(dialog).toHaveTextContent('Show more (2 more)')
    expect(dialog).not.toHaveTextContent('seventh')
    await user.click(within(dialog).getByRole('button', { name: 'Show more (2 more)' }))
    expect(dialog).toHaveTextContent('seventh')

    await user.click(request)
    expect(exception).toHaveAttribute('aria-expanded', 'false')
    expect(request).toHaveAttribute('aria-expanded', 'true')
    const requestPanel = document.getElementById(request.getAttribute('aria-controls'))
    expect(exceptionPanel).toHaveAttribute('inert')
    expect(exceptionPanel).toHaveAttribute('aria-hidden', 'true')
    await waitFor(() => expect(exceptionPanel).toHaveAttribute('hidden'))
    expect(within(requestPanel).getByTestId('syntax')).toHaveAttribute('data-language', 'json')
    expect(within(requestPanel).getByText('Show More', { selector: 'button' })).toBeInTheDocument()
    await user.click(exception)
    expect(request).toHaveAttribute('aria-expanded', 'false')
    expect(exception).toHaveAttribute('aria-expanded', 'true')
    expect(dialog).toHaveTextContent('seventh')
    expect(within(exceptionPanel).getByRole('button', { name: 'Show less' })).toBeVisible()
    await user.click(exception)
    expect(exception).toHaveAttribute('aria-expanded', 'false')
  })

  it('preserves invalid JSON fallback and exact related-group callbacks', async () => {
    const user = userEvent.setup()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const log = { ...baseLog, group_key: 'related-9', request: { payload_type: 'json', payload: '{invalid' } }
    const props = integrationProps({ logsList: { error: false, loading: false, logs: [log] }, selectedLogState: { loading: false, log } })
    renderWithTheme(<IntegrationLogsUI {...props} />)
    await user.click(screen.getByRole('button', { name: 'View details: order.updated' }))
    await user.click(screen.getByRole('button', { name: /Request/ }))
    expect(screen.getByTestId('syntax')).toHaveTextContent('{invalid')
    expect(consoleError).toHaveBeenCalledWith('Invalid JSON content:', expect.any(Error))

    await user.click(screen.getByRole('button', { name: 'View group related events' }))
    expect(props.setRelatedGroupEvent).toHaveBeenCalledWith('related-9')
    expect(props.setSelectedLogState).toHaveBeenLastCalledWith(expect.any(Function))
    const update = props.setSelectedLogState.mock.calls.at(-1)[0]
    expect(update({ loading: false, log })).toEqual({ loading: false, log: {} })
    consoleError.mockRestore()
  })
})

describe('L2d-C14 PushTokens', () => {
  const makeTokens = count => Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    user_id: 31,
    token: index === 0 ? '<img src=x onerror=alert(1)>' : `fake-token-${index + 1}`,
    app: 'dashboard',
    created_at: `created-${index + 1}`,
    updated_at: `updated-${index + 1}`
  }))

  it('clones/sorts descending, paginates ten and renders token strings as text', async () => {
    const user = userEvent.setup()
    const pushTokens = makeTokens(12)
    const originalOrder = pushTokens.map(token => token.id)
    renderWithTheme(<PushTokens userId={31} pushTokens={pushTokens} />)

    const root = document.querySelector('[data-slot="push-tokens"]')
    expect(root.querySelector('[data-slot="push-token-scrollport"]')).toBeInTheDocument()
    expect(root.querySelectorAll('[data-slot="push-token-row"]')).toHaveLength(10)
    expect(within(root.querySelector('[data-slot="push-token-row"]')).getByText('fake-token-12')).toBeInTheDocument()
    expect(pushTokens.map(token => token.id)).toEqual(originalOrder)
    expect(runtime.paginationProps.at(-1).totalPages).toBe(2)
    expect(runtime.parseDate).toHaveBeenCalledWith('created-12', { utc: false })
    expect(runtime.parseDate).toHaveBeenCalledWith('updated-12', { utc: false })

    await user.click(screen.getByRole('button', { name: 'Page 2' }))
    expect(root.querySelectorAll('[data-slot="push-token-row"]')).toHaveLength(2)
    expect(root).toHaveTextContent('<img src=x onerror=alert(1)>')
    expect(root.querySelector('img')).not.toBeInTheDocument()
  })

  it('resets page only when userId changes', async () => {
    const user = userEvent.setup()
    const firstTokens = makeTokens(12)
    const rendered = renderWithTheme(<PushTokens userId={1} pushTokens={firstTokens} />)
    await user.click(screen.getByRole('button', { name: 'Page 2' }))
    expect(document.querySelectorAll('[data-slot="push-token-row"]')).toHaveLength(2)

    const nextTokens = makeTokens(13)
    rendered.rerender(<ThemeProvider theme={lightTheme}><PushTokens userId={1} pushTokens={nextTokens} /></ThemeProvider>)
    expect(document.querySelectorAll('[data-slot="push-token-row"]')).toHaveLength(3)
    rendered.rerender(<ThemeProvider theme={lightTheme}><PushTokens userId={2} pushTokens={nextTokens} /></ThemeProvider>)
    await waitFor(() => expect(document.querySelectorAll('[data-slot="push-token-row"]')).toHaveLength(10))
  })

  it('shows the original empty copy and no pagination', () => {
    renderWithTheme(<PushTokens userId={1} pushTokens={[]} />)
    expect(screen.getByText('No data')).toBeInTheDocument()
    expect(screen.queryByTestId('pagination')).not.toBeInTheDocument()
  })
})
