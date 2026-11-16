/* eslint-disable import/first */
// redesign stores 5.14 (; E4, S-12): the custom fields of a promotion are S/MetaFieldsEditor inline in the tab of the detail,
// wired to the BusinessPromotionMetaFields controller. Covered: the editor gets the controller's list, loading and error (a failed GET
// is not an empty list), Retry asks the controller again, the add goes to the controller with the body of `main`
// (`{ key, business_id, value, value_type, offer_id }`) and its answer comes back to the form, the delete goes through the confirmation,
// and the editor registers its leave guard in the SectionSplit it lives in. The controller is a stand-in; the editor is the real one.
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const probe = vi.hoisted(() => ({
  controllerProps: null,
  metaFieldsList: { metaFields: [], loading: false, error: null },
  spies: { reload: null, add: null, remove: null },
  answers: {}
}))

const mockModule = vi.hoisted(() => async () => {
  const ReactModule = await import('react')
  return {
    useLanguage: () => [{}, (_key, text) => text],
    BusinessPromotionMetaFields: ({ UIComponent, ...props }) => {
      probe.controllerProps = props
      return ReactModule.createElement(UIComponent, {
        ...props,
        metaFieldsList: probe.metaFieldsList,
        actionState: { loading: false, result: { error: false } },
        reloadMetaFields: (...args) => probe.spies.reload?.(...args),
        handleAddMetaField: async (values) => {
          probe.spies.add?.(values)
          return probe.answers.add ?? { ok: true, result: { id: 50, ...values } }
        },
        handeAddMetaField: () => {},
        handleDeleteMetaField: async (id) => {
          probe.spies.remove?.(id)
          return probe.answers.remove ?? { ok: true }
        }
      })
    }
  }
})
// `~components` and the relative index are the same module: both mocks must say the same
vi.mock('../../../../../../index', mockModule)
vi.mock('~components', mockModule)
// the editor of today, reduced to a button that types `{ "a": 1 }` into it
vi.mock('jsoneditor-react', () => ({
  JsonEditor: ({ onChange }) => <button type='button' data-testid='json-editor' onClick={() => onChange({ a: 1 })}>edit json</button>
}))

import { LeaveDialog, LeaveGuardContext, SectionSplit, useLeaveGuardHost } from '../../../Shared/Product'
import { BusinessPromotionCustomFields } from '../index'

const FIELDS = [
  { id: 1, key: 'color', value: 'red', value_type: 'text' },
  { id: 2, key: 'gift', value: '0', value_type: 'boolean' }
]

const renderFields = () => render(<BusinessPromotionCustomFields businessId={7} offerId={21} />)

beforeEach(() => {
  probe.controllerProps = null
  probe.metaFieldsList = { metaFields: FIELDS, loading: false, error: null }
  probe.spies = { reload: vi.fn(), add: vi.fn(), remove: vi.fn() }
  probe.answers = {}
})

describe('BusinessPromotionCustomFields', () => {
  it('wires the controller of the promotion with the ids and as dashboard, and draws its fields in the editor', () => {
    renderFields()
    expect(probe.controllerProps).toMatchObject({ businessId: 7, offerId: 21, asDashboard: true })
    const rows = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('color')
    expect(rows[1]).toHaveTextContent('False') // a boolean reads as True / False
    expect(screen.getByRole('form', { name: 'Add field' })).toBeInTheDocument()
  })

  it('says it is empty only when it is', () => {
    probe.metaFieldsList = { metaFields: [], loading: false, error: null }
    renderFields()
    expect(screen.getByText('No custom fields yet.')).toBeInTheDocument()
  })

  it('shows a skeleton while it loads, not the empty text', () => {
    probe.metaFieldsList = { metaFields: [], loading: true, error: null }
    const { container } = renderFields()
    expect(screen.queryByText('No custom fields yet.')).toBeNull()
    expect(container.querySelector('.odc-mfe-skeleton')).not.toBeNull()
  })

  it('says why it could not load, with Retry, and is not the empty text', async () => {
    const user = userEvent.setup()
    probe.metaFieldsList = { metaFields: [], loading: false, error: 'Server down' }
    renderFields()
    const notice = screen.getByRole('alert')
    expect(notice).toHaveTextContent('Server down')
    expect(screen.queryByText('No custom fields yet.')).toBeNull()
    await user.click(within(notice).getByRole('button', { name: 'Retry' }))
    expect(probe.spies.reload).toHaveBeenCalledTimes(1)
  })

  it('adds a field through the controller with the same body as before: key, business_id, value, value_type and offer_id', async () => {
    const user = userEvent.setup()
    renderFields()
    await user.type(screen.getByRole('textbox', { name: /^Key/ }), 'size')
    await user.type(screen.getByRole('textbox', { name: /^Value/ }), 'large')
    await user.click(screen.getByRole('button', { name: 'Add field' }))
    await waitFor(() => expect(probe.spies.add).toHaveBeenCalledTimes(1))
    // toEqual does not care about the order of the keys; the body is the one of `main` (`offer_id`, never `menu_id`)
    expect(probe.spies.add.mock.calls[0][0]).toEqual({ key: 'size', business_id: 7, value: 'large', value_type: 'text', offer_id: 21 })
    expect(Object.keys(probe.spies.add.mock.calls[0][0]).sort()).toEqual(['business_id', 'key', 'offer_id', 'value', 'value_type'])
    // a success empties the form
    await waitFor(() => expect(screen.getByRole('textbox', { name: /^Key/ })).toHaveValue(''))
  })

  it('keeps what was typed and says why when the API refuses the add', async () => {
    const user = userEvent.setup()
    probe.answers.add = { ok: false, error: 'Key already exists' }
    renderFields()
    await user.type(screen.getByRole('textbox', { name: /^Key/ }), 'color')
    await user.type(screen.getByRole('textbox', { name: /^Value/ }), 'blue')
    await user.click(screen.getByRole('button', { name: 'Add field' }))
    expect(await screen.findByText('Key already exists')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^Key/ })).toHaveValue('color')
  })

  it('asks before deleting and deletes through the controller', async () => {
    const user = userEvent.setup()
    renderFields()
    await user.click(screen.getByRole('button', { name: 'Delete field color' }))
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText('Delete field "color"?')).toBeInTheDocument()
    expect(probe.spies.remove).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Delete field' }))
    await waitFor(() => expect(probe.spies.remove).toHaveBeenCalledWith(1))
  })

  it('registers the add form in the SectionSplit it lives in: closing the detail with a typed field asks first', async () => {
    const user = userEvent.setup()
    const ref = React.createRef()
    // the host the editor panel provides: it owns the question
    const Host = ({ children }) => {
      const leave = useLeaveGuardHost()
      return (
        <LeaveGuardContext.Provider value={leave.context}>
          {children}
          <LeaveDialog
            open={leave.dialog.open}
            saving={leave.dialog.saving}
            onKeep={leave.dialog.onKeep}
            onDiscard={leave.dialog.onDiscard}
            onSave={leave.dialog.onSave}
            returnFocus={leave.dialog.returnFocus}
            title='Save your changes?'
            description='You have unsaved changes.'
            keepLabel='Keep editing'
            saveLabel='Add and close'
            discardLabel='Discard'
            closeLabel='Close'
          />
        </LeaveGuardContext.Provider>
      )
    }
    render(
      <Host>
        <SectionSplit
          ref={ref}
          open
          detailKey={21}
          onClose={() => {}}
          detailTitle='Summer sale'
          closeLabel='Close'
          backLabel='Back'
          list={<div>list</div>}
          detail={<BusinessPromotionCustomFields businessId={7} offerId={21} />}
        />
      </Host>
    )
    const proceed = vi.fn()
    // nothing typed: the way out is free
    act(() => ref.current.requestLeave(proceed))
    expect(proceed).toHaveBeenCalledTimes(1)
    await user.type(screen.getByRole('textbox', { name: /^Key/ }), 'size')
    const blocked = vi.fn()
    act(() => ref.current.requestLeave(blocked))
    expect(blocked).not.toHaveBeenCalled() // the guard took over: it asks before it lets go
    const question = await screen.findByRole('alertdialog')
    expect(within(question).getByText('Save your changes?')).toBeInTheDocument()
    await user.click(within(question).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(blocked).toHaveBeenCalledTimes(1))
  })
})
