/* eslint-disable import/first */
// (from Tiendas 5.16, ): the custom fields of a store in /connect/pos-menu?id=…&section=custom_fields. Seen live:
// the title said «Custom fields» twice (the Dialog's and the h1 of S/BusinessCustomFields) and the delete confirmation drew no scrim of
// its own (inside the Dialog's React tree Base UI takes it for a nested dialog). The fix is in PosStorePanel, which now hosts the delete
// flow beside its Dialog as the menu does (S/BusinessMenuCustomFields). The controller of the fields is a pass-through stub; the
// Product wrappers and S/MetaFieldsEditor are the real ones. «Two backdrops» is the observable difference of a scrim of its own.
import React from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ state: null, fields: null, deleteField: null, addField: null }))

vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' }, dictionary: {} }, (_key, text) => text],
  useSession: () => [{ user: { id: 1, level: 0 }, token: 'tok-1' }],
  useApi: () => [{ project: 'proj-1' }],
  useUtils: () => [{ parseDate: (value) => `on ${value}`, optimizeImage: (url) => url }],
  useToast: () => [{}, { showToast: vi.fn() }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' },
  PosMenuBusinessDetails: ({ UIComponent, ...props }) => <UIComponent {...props} {...mocks.state} />,
  // the controller of the fields: what it is given, and the list and the actions it hands its UI
  BusinessMetaFields: ({ UIComponent, ...props }) => {
    mocks.fields = props
    return (
      <UIComponent
        {...props}
        metaFieldsList={{ metaFields: props.metafields, loading: false, error: null }}
        reloadMetaFields={vi.fn()}
        handleDeleteMetaField={mocks.deleteField}
        handleAddMetaField={mocks.addField}
      />
    )
  }
}))
vi.mock('jsoneditor-react', () => ({ JsonEditor: () => null }))
// before the fix the panel mounted S/BusinessCustomFields from the Stores barrel: the real one, without the barrel's whole tree
vi.mock('../../../Stores', async () => ({
  BusinessCustomFields: (await vi.importActual('../../../Stores/BusinessCustomFields')).BusinessCustomFields,
  BusinessSchedule: () => <div data-testid='schedule' />
}))
vi.mock('../../../Shared', () => ({ IntegrationLogs: () => <div data-testid='logs' /> }))

import { PosStorePanel } from '../PosStorePanel'

const FIELDS = [
  { id: 1, key: 'color', value: 'red', value_type: 'text' },
  { id: 2, key: 'gift', value: '0', value_type: 'boolean' }
]
const business = { id: 7, name: 'Fast Bite', enabled: true, city: { name: 'Miami' }, metafields: FIELDS, third_party_integrations: [] }

const renderPanel = () => render(
  <PosStorePanel
    businessId={7}
    business={business}
    integrationsList={{ loading: false, error: null, thirdPartyIntegrations: [] }}
    getIntegrations={vi.fn()}
    handleInstallPosIntegration={vi.fn()}
    installingPluginRoot={null}
    handleSucessUpdateBusiness={vi.fn()}
    initialSection='custom_fields'
    onSectionChange={vi.fn()}
    expanded={false}
    onExpandedChange={vi.fn()}
    onClose={vi.fn()}
  />
)

const backdrops = () => document.querySelectorAll('.odc-overlay-backdrop')

beforeEach(() => {
  mocks.fields = null
  mocks.deleteField = vi.fn().mockResolvedValue({ ok: true })
  mocks.addField = vi.fn().mockResolvedValue({ ok: true })
  mocks.state = {
    businessState: { loading: false, error: null, business },
    actionStatus: { loading: false, error: null },
    formState: { loading: false, changes: {}, result: { error: false } },
    setFormState: vi.fn(),
    handleChangeActiveBusiness: vi.fn().mockResolvedValue(undefined),
    handleConnectBusiness: vi.fn().mockResolvedValue(undefined),
    handleDisconnectBusiness: vi.fn().mockResolvedValue(undefined),
    handlePushAction: vi.fn().mockResolvedValue(undefined),
    handleSync: vi.fn().mockResolvedValue(''),
    handleUpdateBusinessState: vi.fn(),
    handleSuccessAddBusinessItem: vi.fn(),
    handleSuccessDeleteBusinessItem: vi.fn(),
    updateBusiness: vi.fn()
  }
})

afterEach(() => {
  cleanup()
})

describe('PosStorePanel · Custom fields', () => {
  it('says «Custom fields» once: the title of the dialog, no second heading inside it', async () => {
    renderPanel()
    const dialog = await screen.findByRole('dialog', { name: 'Custom fields' })
    expect(within(dialog).getAllByText('Custom fields')).toHaveLength(1)
    expect(within(dialog).getAllByRole('heading')).toHaveLength(1)
    // the list is still there
    expect(within(dialog).getByRole('button', { name: 'Delete field color' })).toBeInTheDocument()
  })

  it('gives the fields controller the props of before: the store, its fields and the two success callbacks', async () => {
    renderPanel()
    await screen.findByRole('dialog', { name: 'Custom fields' })
    expect(mocks.fields.businessId).toBe(7)
    expect(mocks.fields.metafields).toBe(FIELDS)
    expect(mocks.fields.asDashboard).toBe(true)
    mocks.fields.handleSuccessAddMetaFields({ id: 3 })
    expect(mocks.state.handleSuccessAddBusinessItem).toHaveBeenCalledWith('metafields', { id: 3 })
    mocks.fields.handleSuccessDeleteBusinessMetaFields(1)
    expect(mocks.state.handleSuccessDeleteBusinessItem).toHaveBeenCalledWith('metafields', 1)
  })

  it('asks before a delete with a confirmation that draws its own scrim over the dialog', async () => {
    const user = userEvent.setup()
    renderPanel()
    const dialog = await screen.findByRole('dialog', { name: 'Custom fields' })
    expect(backdrops()).toHaveLength(1)
    await user.click(within(dialog).getByRole('button', { name: 'Delete field color' }))
    const confirm = await screen.findByRole('alertdialog')
    await waitFor(() => expect(backdrops()).toHaveLength(2))
    const behind = screen.getByRole('dialog', { name: 'Custom fields', hidden: true })
    expect(behind.contains(confirm)).toBe(false)
    for (const backdrop of backdrops()) expect(behind.contains(backdrop)).toBe(false)
    // only Confirm deletes, with the id of the field, through the controller's action
    expect(mocks.deleteField).not.toHaveBeenCalled()
    await user.click(within(confirm).getByRole('button', { name: 'Delete field' }))
    expect(mocks.deleteField).toHaveBeenCalledWith(1)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(backdrops()).toHaveLength(1))
  })

  it('keeps the confirmation open with the reason when the API refuses the delete', async () => {
    const user = userEvent.setup()
    mocks.deleteField = vi.fn().mockResolvedValue({ ok: false, error: 'Field in use' })
    renderPanel()
    const dialog = await screen.findByRole('dialog', { name: 'Custom fields' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete field gift' }))
    const confirm = await screen.findByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: 'Delete field' }))
    expect(mocks.deleteField).toHaveBeenCalledWith(2)
    expect(await within(confirm).findByText('Field in use')).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(within(screen.getByRole('dialog', { name: 'Custom fields' })).getByRole('button', { name: 'Delete field gift' })).toBeInTheDocument()
  })
})
