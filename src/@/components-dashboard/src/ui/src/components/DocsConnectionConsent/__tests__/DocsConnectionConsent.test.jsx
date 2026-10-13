/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../index.js', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { DocsConnectionConsent, getDocsConnectContext, getDocsConnectCopy } from '..'

const translate = (key, fallback) => `${key}:${fallback}`

const baseProps = {
  loaded: true,
  auth: true,
  ready: true,
  requested: true,
  approved: false,
  connected: false,
  expired: false,
  purpose: 'docs',
  project: 'demo',
  user: { id: 1, email: 'owner@demo.test' }
}

const renderConsent = (props = {}) => {
  const connect = vi.fn()
  const changeAccount = vi.fn()
  renderWithProviders(
    <DocsConnectionConsent
      {...baseProps}
      connect={connect}
      changeAccount={changeAccount}
      signInElement={<p>Login form</p>}
      {...props}
    />
  )
  return { connect, changeAccount }
}

describe('docs-connect consent copy', () => {
  it('uses the agent copy only for the agent purpose', () => {
    expect(getDocsConnectCopy('agent', translate)).toEqual({
      title: 'DOCS_CONNECT_PAGE_TITLE_AGENT:Connect your AI agent',
      scope: 'DOCS_CONNECT_SCOPE_AGENT:Create an MCP key for your AI agent with the access you choose'
    })
    const docs = {
      title: 'DOCS_CONNECT_PAGE_TITLE_DOCS:Connect to Ordering.co docs',
      scope: 'DOCS_CONNECT_SCOPE_DOCS:Test API requests and manage your API keys with your current permissions'
    }
    expect(getDocsConnectCopy('docs', translate)).toEqual(docs)
    expect(getDocsConnectCopy(undefined, translate)).toEqual(docs)
    expect(getDocsConnectCopy('Agent', translate)).toEqual(docs)
  })

  it('names the site, project and account', () => {
    expect(getDocsConnectContext('demo', 'owner@demo.test')).toBe('docs.ordering.co · demo · owner@demo.test')
    expect(getDocsConnectContext('demo', undefined)).toBe('docs.ordering.co · demo')
  })
})

describe('DocsConnectionConsent', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders nothing while the dashboard boots', () => {
    const { container } = renderWithProviders(<DocsConnectionConsent {...baseProps} loaded={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the login form when signed out', () => {
    renderConsent({ auth: false, ready: false })
    expect(screen.getByText('Login form')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Connect this account' })).toBeNull()
  })

  it('shows the focused consent card with its three actions', () => {
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    const { connect, changeAccount } = renderConsent()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Connect to Ordering.co docs')
    expect(screen.getByText('docs.ordering.co · demo · owner@demo.test')).toBeInTheDocument()
    expect(screen.getByText('Test API requests and manage your API keys with your current permissions')).toBeInTheDocument()
    expect(screen.getByText('Only continue if you started this from docs.ordering.co just now.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Connect this account' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use another project or account' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(connect).toHaveBeenCalledTimes(1)
    expect(changeAccount).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('uses the agent copy for purpose=agent', () => {
    renderConsent({ purpose: 'agent' })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Connect your AI agent')
    expect(screen.getByText('Create an MCP key for your AI agent with the access you choose')).toBeInTheDocument()
  })

  it('waits for the docs request before allowing connect', () => {
    renderConsent({ requested: false })
    expect(screen.getByRole('button', { name: 'Connect this account' })).toBeDisabled()
    expect(screen.getByText('Waiting for docs.ordering.co…')).toBeInTheDocument()
  })

  it('shows progress after approval', () => {
    renderConsent({ approved: true })
    expect(screen.getByRole('button', { name: 'Connecting…' })).toBeDisabled()
  })

  it('confirms the connection and tries to close the window', () => {
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    renderConsent({ connected: true })
    expect(screen.getByText('Connected. You can close this window and return to docs.ordering.co.')).toBeInTheDocument()
    expect(close).toHaveBeenCalled()
  })

  it('explains an expired request', () => {
    renderConsent({ expired: true })
    expect(screen.getByRole('alert')).toHaveTextContent('This request expired. Start again from docs.ordering.co.')
  })

  it('shows a preparing state until the project is ready', () => {
    renderConsent({ ready: false })
    expect(screen.getByText('Preparing your account…')).toBeInTheDocument()
  })
})
