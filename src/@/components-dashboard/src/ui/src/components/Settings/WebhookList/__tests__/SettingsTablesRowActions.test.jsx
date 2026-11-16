/* eslint-disable import/first */
// (batch S, R8): the tables of Webhooks, Api Keys and Plugins in /settings. Two things are pinned:
// the webhooks table scrolls sideways inside its own region (it is wider than a phone, and the hub clips what overflows, so the
// Time column and the row menu were out of reach at 390), and the three-dots button of every row has an accessible name, a 44x44
// touch area and an id of its own. The controllers are stand-ins that mount their UIComponent with fixed props.
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({ props: {} }))

vi.mock('../../../../../../index', async () => {
  const react = await import('react')
  const Controller = ({ UIComponent, ...rest }) => react.createElement(UIComponent, { ...rest, ...runtime.props })
  return {
    useLanguage: () => [{ dictionary: {}, language: { code: 'en' } }, (_key, text) => text],
    useApi: () => [{ project: 'demo' }],
    useSession: () => [{ token: 'token' }],
    // #400 (main): PluginList opens plugin pages through usePluginPage, which toasts a page that cannot open
    useToast: () => [{}, { showToast: () => {} }],
    ToastType: { Error: 'error', Success: 'success', Info: 'info' },
    WebhookList: Controller,
    ApiKeysList: Controller,
    PluginList: Controller
  }
})
vi.mock('~ui', () => ({ Modal: () => null }))
vi.mock('../../WebhookDelaySelector', () => ({ WebhookDelaySelector: () => null }))
vi.mock('../../WebhookListSelector', () => ({ WebhookListSelector: () => null }))

import { WebhookList } from '../index'
import { ApiKeysList } from '../../ApiKeysList'
import { PluginList } from '../../PluginList'

const theme = { rtl: false, colors: new Proxy({}, { get: () => '#123456' }) }
const renderWith = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)

const noop = () => {}
const webhooks = [
  { id: 11, url: 'https://shop.example.test/hooks/orders', hook: 'orders_update', delay: 0 },
  { id: 12, url: 'https://shop.example.test/hooks/drivers', hook: 'drivers_update', delay: 0 }
]
const toggles = (container) => [...container.querySelectorAll('.dropdown-toggle')]
const styleOf = (node) => window.getComputedStyle(node)

describe('WebhookList table', () => {
  beforeEach(() => {
    runtime.props = {
      webhookListState: { loading: false, webhooks },
      isAddMode: false,
      setIsAddMode: noop,
      handleAddNewWebhook: noop,
      handleChangeAddState: noop,
      handleDeleteWebhook: noop,
      changesState: {},
      actionState: {}
    }
  })

  it('scrolls the table sideways inside a named, focusable region', () => {
    renderWith(<WebhookList />)
    const region = screen.getByRole('region', { name: 'Webhooks' })
    expect(region).toHaveAttribute('tabindex', '0')
    expect(styleOf(region).overflowX).toBe('auto')
    expect(within(region).getByRole('table')).toBeInTheDocument()
  })

  it('names every three-dots button after its row, with its own id and a 44x44 area', () => {
    const { container } = renderWith(<WebhookList />)
    const buttons = toggles(container)
    expect(buttons).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Actions for https://shop.example.test/hooks/orders' })).toBe(buttons[0])
    expect(screen.getByRole('button', { name: 'Actions for https://shop.example.test/hooks/drivers' })).toBe(buttons[1])
    expect(new Set(buttons.map(button => button.id)).size).toBe(2)
    buttons.forEach(button => {
      expect(styleOf(button).minWidth).toBe('44px')
      expect(styleOf(button).minHeight).toBe('44px')
    })
  })
})

// Owner decision 25 B: the row is named after its key's ending, or its position for a short key (never the key)
describe('ApiKeysList table', () => {
  it('names every three-dots button after its row, with its own id and a 44x44 area', () => {
    runtime.props = {
      apiKeysList: { loading: false, keys: [{ id: 1, key: 'key-alpha' }, { id: 2, key: 'key-beta' }] },
      actionState: {},
      handleDeleteApiKey: noop,
      handleAddApiKey: noop
    }
    const { container } = renderWith(<ApiKeysList />)
    const buttons = toggles(container)
    expect(buttons).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Actions for API key 1' })).toBe(buttons[0])
    expect(screen.getByRole('button', { name: 'Actions for API key 2' })).toBe(buttons[1])
    expect(new Set(buttons.map(button => button.id)).size).toBe(2)
    buttons.forEach(button => {
      expect(styleOf(button).minWidth).toBe('44px')
      expect(styleOf(button).minHeight).toBe('44px')
    })
  })
})

describe('PluginList table', () => {
  it('names every three-dots button after its row, with its own id and a 44x44 area', () => {
    runtime.props = {
      pluginListState: {
        loading: false,
        plugins: [
          { id: 1, name: 'Stripe sync', hooks: [], enabled: true, root: 'https://p.test/1', links: {} },
          { id: 2, name: 'Mailer', hooks: [1], enabled: false, root: 'https://p.test/2', links: {} }
        ],
        sysPlugins: []
      },
      isAddMode: false,
      setIsAddMode: noop,
      setNewUrl: noop,
      handleAddNewPlugin: noop,
      actionState: {},
      handleDeletePlugin: noop,
      handleUpdatePlugin: noop,
      handleInstallSysPlugin: noop
    }
    const { container } = renderWith(<PluginList />)
    const buttons = toggles(container)
    expect(buttons).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Actions for Stripe sync' })).toBe(buttons[0])
    expect(screen.getByRole('button', { name: 'Actions for Mailer' })).toBe(buttons[1])
    expect(new Set(buttons.map(button => button.id)).size).toBe(2)
    buttons.forEach(button => {
      expect(styleOf(button).minWidth).toBe('44px')
      expect(styleOf(button).minHeight).toBe('44px')
    })
  })
})
