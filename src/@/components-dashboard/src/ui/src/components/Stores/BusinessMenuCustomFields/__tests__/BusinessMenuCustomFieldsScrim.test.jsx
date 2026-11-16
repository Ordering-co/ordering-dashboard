/* eslint-disable import/first */
// redesign stores 5.14 (K-1): the menu must look as it did in 5.6, and in 5.6 the delete confirmation was a SIBLING of the
// «Custom fields» Dialog, so it drew its own scrim over it. When the editor was promoted to S/MetaFieldsEditor the confirmation moved
// inside the Dialog's React tree, Base UI took it for a nested dialog and skipped its scrim (seen live). The menu hosts the delete flow
// again; this pins that the confirmation is not inside the Dialog's tree. Base UI draws one backdrop per top-level dialog and none for a
// nested one, so «two backdrops» is the observable difference.
import React from 'react'
import { cleanup, render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

// bugs E: the dialog holds the page through the router (useRouteLeaveGuard), as it does inside the menu
const render = (ui, options) => rtlRender(<MemoryRouter initialEntries={['/stores/list']}>{ui}</MemoryRouter>, options)

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text],
  BusinessMenuMetaFields: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
vi.mock('jsoneditor-react', () => ({
  JsonEditor: () => null
}))

import { BusinessMenuCustomFields } from '../index'

const FIELDS = [
  { id: 1, key: 'color', value: 'red', value_type: 'text' },
  { id: 2, key: 'gift', value: '0', value_type: 'boolean' }
]

const renderFields = () => render(
  <BusinessMenuCustomFields
    open
    onClose={vi.fn()}
    businessId={7}
    menuId={11}
    metaFieldsList={{ metaFields: FIELDS, loading: false, error: null }}
    reloadMetaFields={vi.fn()}
    handleDeleteMetaField={vi.fn().mockResolvedValue({ ok: true })}
    handleAddMetaField={vi.fn().mockResolvedValue({ ok: true })}
  />
)

const backdrops = () => document.querySelectorAll('.odc-overlay-backdrop')

afterEach(() => {
  cleanup()
})

describe('BusinessMenuCustomFields · the delete confirmation darkens the dialog behind it', () => {
  it('is a sibling of the Custom fields dialog: it draws its own backdrop, a second one over the dialog', async () => {
    const user = userEvent.setup()
    renderFields()
    expect(backdrops()).toHaveLength(1)
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete field color' }))
    const confirm = await screen.findByRole('alertdialog')
    await waitFor(() => expect(backdrops()).toHaveLength(2))
    // the dialog behind it is inert, as in 5.6, and does not contain the confirmation
    const dialog = screen.getByRole('dialog', { hidden: true })
    expect(dialog.contains(confirm)).toBe(false)
    expect(confirm.contains(dialog)).toBe(false)
    // its backdrop is the one of the confirmation, not a child of the dialog's popup
    for (const backdrop of backdrops()) expect(dialog.contains(backdrop)).toBe(false)
  })

  it('takes its backdrop away when it closes, and the dialog behind is usable again', async () => {
    const user = userEvent.setup()
    renderFields()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete field gift' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(backdrops()).toHaveLength(1))
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete field gift' })).toBeTruthy()
  })
})
