/* eslint-disable import/first */
// redesign SC-A: the connected card with kind='sales_channel' (Push menu, editable external id). ConnectedPosCard is the
// real one, mounted with a link, an integration and vi.fn() handlers; the Product wrappers are the real ones. Logs is a stub.
import React from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

// the words the stubbed t knows (empty: it answers the English default, as an untranslated key does)
const lang = vi.hoisted(() => ({ words: {} }))

vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' }, dictionary: {} }, (key, text) => lang.words[key] ?? text],
  useSession: () => [{ user: { id: 1, level: 0 }, token: 'tok-1' }],
  useApi: () => [{ project: 'proj-1' }],
  // main #394/#400: the card dates the state and opens plugin pages through usePluginPage
  useUtils: () => [{ parseDate: (value) => `on ${value}` }],
  useToast: () => [{}, { showToast: () => {} }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../Shared', () => ({
  IntegrationLogs: () => <div data-testid='logs' />
}))

import { ConnectedPosCard } from '../ConnectedPosCard'

const uberEats = {
  id: 100,
  key: 'uber_eats_integration',
  name: 'Uber Eats',
  type: 'sales_channel',
  logo: 'https://logo.example/uber.png',
  plugin_id: 9,
  plugin_root: 'https://uber.example',
  plugin: { name: 'Uber Eats', root: 'https://uber.example', links: { general_settings: '/general' } }
}
const link = { business_id: 7, third_party_integration_id: 100, enabled: true, external_id: 'store-123', setup_status: 'completed' }
const business = { id: 7, name: 'Fast Bite', third_party_integrations: [link, { business_id: 7, third_party_integration_id: 200, external_id: 'other' }] }

let handlers
const setup = (props = {}) => {
  handlers = {
    setFormState: vi.fn(),
    handleConnectBusiness: vi.fn().mockResolvedValue(undefined),
    handleDisconnectBusiness: vi.fn().mockResolvedValue(undefined),
    handlePushAction: vi.fn().mockResolvedValue(undefined),
    handleSync: vi.fn().mockResolvedValue('https://uber.example/setup'),
    handleUpdateBusinessState: vi.fn(),
    getIntegrations: vi.fn(),
    updateBusiness: vi.fn(),
    onRequestError: vi.fn()
  }
  const ui = (extra = {}) => (
    <ConnectedPosCard
      business={business}
      link={link}
      integration={uberEats}
      canSetup={false}
      formState={{ loading: false, changes: {} }}
      kind='sales_channel'
      {...handlers}
      {...props}
      {...extra}
    />
  )
  const view = render(ui())
  return { ...view, rerenderWith: (extra) => view.rerender(ui(extra)) }
}

afterEach(() => {
  lang.words = {}
  cleanup()
  document.getElementById('app-modals')?.remove()
})

describe('ConnectedPosCard kind=sales_channel actions', () => {
  it('has Push menu and neither Sync menu nor Sync business; the rest stays', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Push menu' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sync menu' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sync business' })).toBeNull()
    expect(screen.getByRole('button', { name: 'General settings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Logs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More for Uber Eats' })).toBeInTheDocument()
  })

  // main: Push menu follows the POS sync rules
  it('Push menu is off, with the reason, while the connection is pending or the plugin is off', () => {
    const { rerenderWith } = setup({ link: { ...link, setup_status: 'pending' } })
    expect(screen.getByRole('button', { name: 'Push menu' })).toBeDisabled()
    expect(screen.getByText('Available once the sales channel is connected.')).toBeInTheDocument()
    rerenderWith({ link, integration: { ...uberEats, plugin: { ...uberEats.plugin, enabled: false } } })
    expect(screen.getByRole('button', { name: 'Push menu' })).toBeDisabled()
  })

  it('says a connected sales channel is a sales channel, not a POS', () => {
    setup()
    expect(screen.getByText('The sales channel is connected and syncing with this store.')).toBeInTheDocument()
    expect(screen.queryByText(/The POS is connected/)).not.toBeInTheDocument()
  })

  it('Push menu is the primary action', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Push menu' })).toHaveAttribute('data-variant', 'primary')
  })

  it('Push menu asks first, with the focus on Cancel, and Cancel calls nothing', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Push menu' }))
    const dialog = await screen.findByRole('alertdialog', { name: "Push Fast Bite's menu to Uber Eats?" })
    expect(within(dialog).getByText("Ordering sends this store's menu to Uber Eats. The menu customers see on Uber Eats can change.")).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Push menu to Uber Eats' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(handlers.handlePushAction).not.toHaveBeenCalled()
    expect(handlers.setFormState).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('confirming calls handlePushAction with push_menu and the done message', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Push menu' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Push menu to Uber Eats' }))
    expect(handlers.handlePushAction).toHaveBeenCalledTimes(1)
    expect(handlers.handlePushAction).toHaveBeenCalledWith(100, 'push_menu', 'Menu push started. It can take a few minutes.')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })
})

// redesign D-8 (owner, 2026-10-19): Disconnect asks first on a sales channel too, with the channel's name
describe('ConnectedPosCard kind=sales_channel Disconnect', () => {
  const openDisconnect = async (user) => {
    await user.click(screen.getByRole('button', { name: 'More for Uber Eats' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Disconnect' }))
    return screen.findByRole('alertdialog', { name: 'Disconnect Fast Bite from Uber Eats?' })
  }

  it('asks first with the channel named, with the focus on Cancel, and Cancel calls nothing', async () => {
    const user = userEvent.setup()
    setup()
    const dialog = await openDisconnect(user)
    expect(within(dialog).getByText('Fast Bite stops syncing with Uber Eats. To connect it again you will need its credentials.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Disconnect Uber Eats' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(handlers.handleDisconnectBusiness).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('confirming disconnects the channel', async () => {
    const user = userEvent.setup()
    setup()
    const dialog = await openDisconnect(user)
    await user.click(within(dialog).getByRole('button', { name: 'Disconnect Uber Eats' }))
    expect(handlers.handleDisconnectBusiness).toHaveBeenCalledTimes(1)
    expect(handlers.handleDisconnectBusiness).toHaveBeenCalledWith(100, expect.any(Function))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })
})

describe('ConnectedPosCard kind=sales_channel external id', () => {
  const field = () => screen.getByRole('textbox', { name: 'External ID' })

  it('shows the saved value in a field, not as text', () => {
    setup()
    expect(field()).toHaveValue('store-123')
    expect(document.querySelector('.psp-card-data')).toBeNull()
  })

  it('an empty external id is an empty field', () => {
    setup({ link: { ...link, external_id: null } })
    expect(field()).toHaveValue('')
  })

  it('Save sends the draft with the enabled flag, and the callback gives the controller the store with the link changed', async () => {
    const user = userEvent.setup()
    setup()
    await user.clear(field())
    await user.type(field(), 'nuevo')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(handlers.handleConnectBusiness).toHaveBeenCalledTimes(1)
    expect(handlers.handleConnectBusiness).toHaveBeenCalledWith(
      100,
      { external_id: 'nuevo', enabled: true },
      expect.any(Function),
      'Integration updated successfully'
    )
    expect(handlers.handleUpdateBusinessState).not.toHaveBeenCalled()
    handlers.handleConnectBusiness.mock.calls[0][2]()
    expect(handlers.handleUpdateBusinessState).toHaveBeenCalledTimes(1)
    const next = handlers.handleUpdateBusinessState.mock.calls[0][0]
    expect(next.third_party_integrations[0]).toEqual({ ...link, external_id: 'nuevo', enabled: true })
    expect(next.third_party_integrations[1]).toEqual(business.third_party_integrations[1])
  })

  it('Enter in the field saves too', async () => {
    const user = userEvent.setup()
    setup()
    await user.clear(field())
    await user.type(field(), 'nuevo{Enter}')
    expect(handlers.handleConnectBusiness).toHaveBeenCalledTimes(1)
    expect(handlers.handleConnectBusiness).toHaveBeenCalledWith(
      100,
      { external_id: 'nuevo', enabled: true },
      expect.any(Function),
      'Integration updated successfully'
    )
  })

  it('a call that throws goes to onRequestError', async () => {
    const user = userEvent.setup()
    setup()
    const failure = new Error('boom')
    handlers.handleConnectBusiness.mockRejectedValue(failure)
    await user.type(field(), '9')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(handlers.onRequestError).toHaveBeenCalledWith(failure))
  })

  // main: Save only once the external id changed
  it('Save is disabled until the external id changes, and again when it is typed back', async () => {
    const user = userEvent.setup()
    setup()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    await user.type(field(), 'x')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    await user.type(field(), '{Backspace}')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('Save is disabled while the form is loading', () => {
    setup({ formState: { loading: true, changes: {} } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('the draft starts again when the saved external id changes', async () => {
    const user = userEvent.setup()
    const { rerenderWith } = setup()
    await user.type(field(), 'x')
    expect(field()).toHaveValue('store-123x')
    rerenderWith({ link: { ...link, external_id: 'server-456' } })
    expect(field()).toHaveValue('server-456')
  })

  it('the on/off switch sends the saved external id, not the draft', async () => {
    const user = userEvent.setup()
    setup()
    await user.type(field(), 'draft')
    await user.click(screen.getByRole('switch', { name: 'Turn Uber Eats on or off' }))
    await waitFor(() => expect(handlers.handleConnectBusiness).toHaveBeenCalledTimes(1))
    expect(handlers.handleConnectBusiness).toHaveBeenCalledWith(
      100,
      { external_id: 'store-123', enabled: false },
      expect.any(Function),
      'Integration updated successfully'
    )
  })
})

describe('ConnectedPosCard without kind (pos)', () => {
  it('still shows Sync menu and Sync business, and no Push menu', () => {
    setup({ kind: undefined })
    expect(screen.getByRole('button', { name: 'Sync menu' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sync business' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Push menu' })).toBeNull()
  })

  it('still shows the external id as text, with no field and no Save', () => {
    setup({ kind: undefined })
    expect(screen.queryByRole('textbox', { name: 'External ID' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.getByText('store-123')).toBeInTheDocument()
  })

  it('kind pos is the same as no kind', () => {
    setup({ kind: 'pos' })
    expect(screen.getByRole('button', { name: 'Sync menu' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'External ID' })).toBeNull()
  })
})

// redesign bugs-d row 84: the plugin link button was t('general_settings', …), a key the catalog never had, so it showed English in every language
describe('ConnectedPosCard plugin link labels', () => {
  it('General settings is translated through PLUGIN_LINK_GENERAL_SETTINGS', () => {
    lang.words = { PLUGIN_LINK_GENERAL_SETTINGS: 'Configuración general' }
    setup()
    expect(screen.getByRole('button', { name: 'Configuración general' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'General settings' })).toBeNull()
  })

  it('a link key with no entry keeps the dynamic label: its own key, capitalized', () => {
    setup({ integration: { ...uberEats, plugin: { ...uberEats.plugin, links: { menu_rules: '/rules' } } } })
    expect(screen.getByRole('button', { name: 'Menu rules' })).toBeInTheDocument()
  })
})

// main, Calendly is for administrators, but main exempts sales channels (`!fromSalesChannels`)
describe('ConnectedPosCard kind=sales_channel is not restricted by Calendly (main , )', () => {
  const calendlyChannel = {
    ...uberEats,
    plugin: { ...uberEats.plugin, setup_url: 'https://calendly.com/team/setup', links: { help: 'https://calendly.com/team/help', general_settings: '/general' } }
  }

  it('a Calendly link and a Calendly setup keep their buttons for someone who is not an administrator', async () => {
    const user = userEvent.setup()
    setup({ integration: calendlyChannel, canSetup: true, isAdmin: false })
    expect(screen.queryByRole('button', { name: /Contact admin/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Setup' })).toBeEnabled()
    const help = screen.getByRole('button', { name: 'Help' })
    expect(help).toBeEnabled()
    await user.click(help)
    expect(within(await screen.findByRole('dialog', { name: 'Uber Eats' })).getByTitle('Uber Eats')).toHaveAttribute('src', 'https://calendly.com/team/help')
  })
})
