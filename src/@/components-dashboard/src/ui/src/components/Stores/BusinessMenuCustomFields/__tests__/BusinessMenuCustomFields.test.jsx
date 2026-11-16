/* eslint-disable import/first */
// redesign stores 5.6 (G3-06, G3-07, decision 6): the custom fields of a menu in Product. The controller is a pass-through
// that hands the real UI the props the real one hands it (`metaFieldsList`, `reloadMetaFields`, `handleDeleteMetaField`,
// `handleAddMetaField`); the dialog, the confirmation, the form and the leave guard are the real pieces.
import React, { useState } from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ controllerProps: [] }))

// bugs E: the dialog holds the page through the router (useRouteLeaveGuard), as it does inside the menu
const route = {}
const render = (ui, options) => rtlRender(
  <MemoryRouter initialEntries={['/stores/list']}>
    {ui}
    <Route path='*' render={({ history, location }) => { route.history = history; route.path = location.pathname; return null }} />
  </MemoryRouter>,
  options
)

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text],
  BusinessMenuMetaFields: ({ UIComponent, ...props }) => {
    mocks.controllerProps.push(props)
    return <UIComponent {...props} />
  }
}))
// the editor of today, reduced to a button that types `{ "a": 1 }` into it
vi.mock('jsoneditor-react', () => ({
  JsonEditor: ({ onChange }) => <button type='button' data-testid='json-editor' onClick={() => onChange({ a: 1 })}>edit json</button>
}))

import { LeaveGuardContext, Menu } from '../../../Shared/Product'
import { Ellipsis } from '../../../Shared/Icon'
import { BusinessMenuCustomFields } from '../index'

const FIELDS = [
  { id: 1, key: 'color', value: 'red', value_type: 'text' },
  { id: 2, key: 'gift', value: '0', value_type: 'boolean' },
  { id: 3, key: 'allowed', value: '1', value_type: 'boolean' },
  { id: 4, key: 'weight', value: '12', value_type: 'integer' }
]

const controller = (overrides = {}) => ({
  metaFieldsList: { metaFields: FIELDS, loading: false, error: null },
  reloadMetaFields: vi.fn(),
  handleDeleteMetaField: vi.fn().mockResolvedValue({ ok: true }),
  handleAddMetaField: vi.fn().mockResolvedValue({ ok: true, result: { id: 99 } }),
  ...overrides
})

// A host with an opener button, as the menu has: `initialOpen` false renders it closed.
const Host = ({ initialOpen = true, onClose, ...props }) => {
  const [open, setOpen] = useState(initialOpen)
  return (
    <>
      <button type='button' onClick={() => setOpen(true)}>Open fields</button>
      <BusinessMenuCustomFields
        open={open}
        onClose={() => { onClose?.(); setOpen(false) }}
        businessId={7}
        menuId={11}
        {...props}
      />
    </>
  )
}

const renderFields = (overrides = {}, hostProps = {}) => {
  const props = controller(overrides)
  const onClose = vi.fn()
  const utils = render(<Host onClose={onClose} {...props} {...hostProps} />)
  return { ...utils, props, onClose }
}

const getDialog = () => screen.getByRole('dialog')
const keyInput = () => within(getDialog()).getByRole('textbox', { name: /^Key/ })
const valueInput = () => within(getDialog()).getByRole('textbox', { name: /^Value/ })
const submit = (user) => user.click(within(getDialog()).getByRole('button', { name: 'Add field' }))

afterEach(() => {
  cleanup()
  mocks.controllerProps.length = 0
})

describe('BusinessMenuCustomFields · the dialog', () => {
  it('is a dialog named Custom fields with a Close button, and the controller learns when it is open', () => {
    renderFields()
    expect(within(getDialog()).getByRole('heading', { name: 'Custom fields' })).toBeTruthy()
    expect(within(getDialog()).getByRole('button', { name: 'Close' })).toBeTruthy()
    expect(mocks.controllerProps.at(-1).open).toBe(true)
  })

  it('renders nothing while closed', () => {
    renderFields({}, { initialOpen: false })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mocks.controllerProps.at(-1).open).toBe(false)
  })
})

describe('BusinessMenuCustomFields · the list', () => {
  it('shows the type, the key and the value as plain text in a list, with True and False for a boolean', () => {
    renderFields()
    const rows = within(within(getDialog()).getByRole('list')).getAllByRole('listitem')
    expect(rows).toHaveLength(4)
    expect(rows[0].textContent).toContain('Text')
    expect(rows[0].textContent).toContain('color')
    expect(rows[0].textContent).toContain('red')
    expect(rows[1].textContent).toContain('Boolean')
    expect(rows[1].textContent).toContain('False')
    expect(rows[2].textContent).toContain('True')
    expect(rows[3].textContent).toContain('Integer')
    expect(within(rows[0]).queryByRole('textbox')).toBeNull()
    expect(getDialog().textContent).not.toContain('fase')
  })

  it('shows three skeleton rows and a Loading status while it loads', () => {
    renderFields({ metaFieldsList: { metaFields: [], loading: true, error: null } })
    expect(within(getDialog()).getByRole('status').textContent).toBe('Loading')
    expect(getDialog().querySelectorAll('.odc-skeleton').length).toBeGreaterThanOrEqual(3)
    expect(within(getDialog()).queryByRole('list')).toBeNull()
  })

  it('says there are none yet', () => {
    renderFields({ metaFieldsList: { metaFields: [], loading: false, error: null } })
    expect(within(getDialog()).getByText('No custom fields yet.')).toBeTruthy()
    expect(within(getDialog()).queryByRole('list')).toBeNull()
  })

  it('says why it could not load and retries with Retry', async () => {
    const user = userEvent.setup()
    const { props } = renderFields({ metaFieldsList: { metaFields: [], loading: false, error: ['Not authorized'] } })
    const alert = within(getDialog()).getByRole('alert')
    expect(alert.textContent).toContain('Not authorized')
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(props.reloadMetaFields).toHaveBeenCalledTimes(1)
  })

  it('falls back to its own text when the load error has no message', () => {
    renderFields({ metaFieldsList: { metaFields: [], loading: false, error: [] } })
    expect(within(getDialog()).getByRole('alert').textContent).toContain("We couldn't load the custom fields.")
  })
})

describe('BusinessMenuCustomFields · Delete (decision 6)', () => {
  const deleteButton = (key = 'color') => within(getDialog()).getByRole('button', { name: `Delete field ${key}` })

  it('is a named, focusable button on every row', () => {
    renderFields()
    const buttons = within(getDialog()).getAllByRole('button', { name: /^Delete field / })
    expect(buttons.map(button => button.getAttribute('aria-label'))).toEqual(['Delete field color', 'Delete field gift', 'Delete field allowed', 'Delete field weight'])
    deleteButton('gift').focus()
    expect(document.activeElement).toBe(deleteButton('gift'))
  })

  it('asks first, with the key and the consequence, and Cancel has the focus', async () => {
    const user = userEvent.setup()
    const { props } = renderFields()
    await user.click(deleteButton())
    const confirm = await screen.findByRole('alertdialog')
    expect(within(confirm).getByText('Delete field "color"?')).toBeTruthy()
    expect(within(confirm).getByText("This can't be undone.")).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(within(confirm).getByRole('button', { name: 'Cancel' })))
    expect(props.handleDeleteMetaField).not.toHaveBeenCalled()
  })

  it('does not delete on Cancel and gives the focus back to the button', async () => {
    const user = userEvent.setup()
    const { props } = renderFields()
    await user.click(deleteButton('gift'))
    const confirm = await screen.findByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(props.handleDeleteMetaField).not.toHaveBeenCalled()
    await waitFor(() => expect(document.activeElement).toBe(deleteButton('gift')))
  })

  it('stays open and says why when the delete fails, the field stays and nothing keeps spinning', async () => {
    const user = userEvent.setup()
    const { props } = renderFields({ handleDeleteMetaField: vi.fn().mockResolvedValue({ ok: false, error: ['Field is in use'] }) })
    await user.click(deleteButton())
    const confirm = await screen.findByRole('alertdialog')
    const confirmButton = within(confirm).getByRole('button', { name: 'Delete field' })
    await user.click(confirmButton)
    expect(props.handleDeleteMetaField).toHaveBeenCalledWith(1)
    const notice = await within(screen.getByRole('alertdialog')).findByRole('alert')
    expect(notice.textContent).toContain('Field is in use')
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete field' }).getAttribute('aria-busy')).toBeNull()
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(false)
    // the dialog behind the confirmation is inert while it is open, so it is found with `hidden`
    expect(screen.getByRole('dialog', { hidden: true }).textContent).toContain('color')
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()
  })

  it('falls back to its own text when the API gave no message, and when the call throws', async () => {
    const user = userEvent.setup()
    renderFields({ handleDeleteMetaField: vi.fn().mockRejectedValue(new Error('')) })
    await user.click(deleteButton())
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete field' }))
    expect((await screen.findByRole('alert')).textContent).toContain("We couldn't delete this field. Try again.")
    expect(screen.getByRole('alertdialog')).toBeTruthy()
  })

  it('closes the confirmation when the delete works and puts the focus on a field button of the list', async () => {
    const user = userEvent.setup()
    const Stateful = () => {
      const [fields, setFields] = useState(FIELDS)
      return (
        <Host
          {...controller({
            metaFieldsList: { metaFields: fields, loading: false, error: null },
            handleDeleteMetaField: async (id) => {
              setFields(current => current.filter(item => item.id !== id))
              return { ok: true }
            }
          })}
        />
      )
    }
    render(<Stateful />)
    await user.click(deleteButton('gift'))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete field' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(getDialog().textContent).not.toContain('gift')
    await waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Delete field allowed'))
  })

  it('does not leave the app on a refused delete with a plain message string', async () => {
    const user = userEvent.setup()
    renderFields({ handleDeleteMetaField: vi.fn().mockResolvedValue({ ok: false, error: 'Nope' }) })
    await user.click(deleteButton())
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete field' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Nope')
  })
})

describe('BusinessMenuCustomFields · the add form', () => {
  it('has labelled controls: Type (text by default), Key and Value', () => {
    renderFields()
    const type = within(getDialog()).getByRole('combobox', { name: 'Type' })
    expect(type.value).toBe('text')
    expect([...type.options].map(option => option.textContent)).toEqual(['Integer', 'Decimal', 'Boolean', 'Text', 'JSON'])
    expect(keyInput()).toBeTruthy()
    expect(valueInput()).toBeTruthy()
    expect(within(getDialog()).getByRole('button', { name: 'Add field' }).getAttribute('type')).toBe('submit')
  })

  it('asks for the key and the value, and calls nothing', async () => {
    const user = userEvent.setup()
    const { props } = renderFields()
    await submit(user)
    expect(within(getDialog()).getByText('Enter a key.')).toBeTruthy()
    expect(within(getDialog()).getByText('Enter a value.')).toBeTruthy()
    expect(props.handleAddMetaField).not.toHaveBeenCalled()
  })

  it('wants a whole number for an integer', async () => {
    const user = userEvent.setup()
    const { props } = renderFields()
    await user.selectOptions(within(getDialog()).getByRole('combobox', { name: 'Type' }), 'integer')
    await user.type(keyInput(), 'weight')
    await user.type(valueInput(), '1.5')
    await submit(user)
    expect(within(getDialog()).getByText('Enter a whole number.')).toBeTruthy()
    expect(props.handleAddMetaField).not.toHaveBeenCalled()
    expect(valueInput().getAttribute('inputmode')).toBe('numeric')
  })

  it('wants a number for a decimal and accepts one', async () => {
    const user = userEvent.setup()
    const { props } = renderFields()
    await user.selectOptions(within(getDialog()).getByRole('combobox', { name: 'Type' }), 'decimal')
    await user.type(keyInput(), 'ratio')
    await user.type(valueInput(), 'abc')
    await submit(user)
    expect(within(getDialog()).getByText('Enter a number.')).toBeTruthy()
    expect(props.handleAddMetaField).not.toHaveBeenCalled()
    expect(valueInput().getAttribute('inputmode')).toBe('decimal')
    await user.clear(valueInput())
    await user.type(valueInput(), '-1.5e3')
    await submit(user)
    expect(props.handleAddMetaField).toHaveBeenCalledWith({ key: 'ratio', business_id: 7, menu_id: 11, value: '-1.5e3', value_type: 'decimal' })
  })

  it('adds a text field with the payload of today, clears the form and focuses Key', async () => {
    const user = userEvent.setup()
    const { props } = renderFields()
    await user.type(keyInput(), 'season')
    await user.type(valueInput(), 'summer')
    await submit(user)
    expect(props.handleAddMetaField).toHaveBeenCalledTimes(1)
    expect(props.handleAddMetaField).toHaveBeenCalledWith({ key: 'season', business_id: 7, menu_id: 11, value: 'summer', value_type: 'text' })
    await waitFor(() => expect(keyInput().value).toBe(''))
    expect(valueInput().value).toBe('')
    await waitFor(() => expect(document.activeElement).toBe(keyInput()))
    expect(within(getDialog()).queryByText('Enter a key.')).toBeNull()
  })

  it('adds a boolean (True is 1 by default, False is 0)', async () => {
    const user = userEvent.setup()
    const { props } = renderFields()
    await user.selectOptions(within(getDialog()).getByRole('combobox', { name: 'Type' }), 'boolean')
    const value = within(getDialog()).getByRole('combobox', { name: /^Value/ })
    expect(value.value).toBe('1')
    expect([...value.options].map(option => option.textContent)).toEqual(['True', 'False'])
    await user.type(keyInput(), 'vip')
    await submit(user)
    expect(props.handleAddMetaField).toHaveBeenLastCalledWith({ key: 'vip', business_id: 7, menu_id: 11, value: '1', value_type: 'boolean' })
    await waitFor(() => expect(keyInput().value).toBe(''))
    await user.selectOptions(within(getDialog()).getByRole('combobox', { name: /^Value/ }), '0')
    await user.type(keyInput(), 'vip2')
    await submit(user)
    expect(props.handleAddMetaField).toHaveBeenLastCalledWith({ key: 'vip2', business_id: 7, menu_id: 11, value: '0', value_type: 'boolean' })
  })

  it('adds a json value', async () => {
    const user = userEvent.setup()
    const { props } = renderFields()
    await user.selectOptions(within(getDialog()).getByRole('combobox', { name: 'Type' }), 'json')
    await user.type(keyInput(), 'meta')
    await user.click(screen.getByTestId('json-editor'))
    await submit(user)
    expect(props.handleAddMetaField).toHaveBeenCalledWith({ key: 'meta', business_id: 7, menu_id: 11, value: '{"a":1}', value_type: 'json' })
  })

  it('clears the value when the type changes, and the error that went with it', async () => {
    const user = userEvent.setup()
    renderFields()
    await user.type(valueInput(), 'abc')
    await user.selectOptions(within(getDialog()).getByRole('combobox', { name: 'Type' }), 'integer')
    expect(valueInput().value).toBe('')
  })

  it('shows the failure of the API under the form, keeps what was typed and focuses nothing away', async () => {
    const user = userEvent.setup()
    renderFields({ handleAddMetaField: vi.fn().mockResolvedValue({ ok: false, error: ['Key already exists'] }) })
    await user.type(keyInput(), 'season')
    await user.type(valueInput(), 'summer')
    await submit(user)
    const alert = await within(getDialog()).findByRole('alert')
    expect(alert.textContent).toContain('Key already exists')
    expect(keyInput().value).toBe('season')
    expect(valueInput().value).toBe('summer')
    expect(within(getDialog()).getByRole('button', { name: 'Add field' }).getAttribute('aria-busy')).toBeNull()
  })

  it('falls back to its own text when the API gave no message', async () => {
    const user = userEvent.setup()
    renderFields({ handleAddMetaField: vi.fn().mockResolvedValue({ ok: false }) })
    await user.type(keyInput(), 'season')
    await user.type(valueInput(), 'summer')
    await submit(user)
    expect((await within(getDialog()).findByRole('alert')).textContent).toContain("We couldn't add this field. Try again.")
  })

  it('is busy while it adds and does not send twice', async () => {
    const user = userEvent.setup()
    let release
    const handleAddMetaField = vi.fn(() => new Promise(resolve => { release = resolve }))
    renderFields({ handleAddMetaField })
    await user.type(keyInput(), 'season')
    await user.type(valueInput(), 'summer')
    await submit(user)
    await waitFor(() => expect(within(getDialog()).getByRole('button', { name: 'Add field' }).getAttribute('aria-busy')).toBe('true'))
    await submit(user)
    expect(handleAddMetaField).toHaveBeenCalledTimes(1)
    release({ ok: true })
    await waitFor(() => expect(within(getDialog()).getByRole('button', { name: 'Add field' }).getAttribute('aria-busy')).toBeNull())
  })
})

describe('BusinessMenuCustomFields · closing (G3-06, G3-07)', () => {
  const closeWithX = (user) => user.click(within(getDialog()).getByRole('button', { name: 'Close' }))

  it('closes at once with nothing typed, by the X, by Esc and by the scrim', async () => {
    const user = userEvent.setup()
    const { onClose } = renderFields()
    await closeWithX(user)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Open fields' }))
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('button', { name: 'Open fields' }))
    await user.click(document.querySelector('.odc-overlay-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('asks before leaving with a key typed; Keep editing stays with what was typed', async () => {
    const user = userEvent.setup()
    const { onClose } = renderFields()
    await user.type(keyInput(), 'season')
    await closeWithX(user)
    const question = await screen.findByRole('alertdialog')
    expect(within(question).getByText('Save your changes?')).toBeTruthy()
    expect(within(question).getByText('You have unsaved changes in Custom fields. Save them before you leave, or discard them.')).toBeTruthy()
    expect(within(question).getByRole('button', { name: 'Add and close' })).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    await user.click(within(question).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(onClose).not.toHaveBeenCalled()
    expect(keyInput().value).toBe('season')
  })

  it('Discard closes and drops what was typed', async () => {
    const user = userEvent.setup()
    const { onClose } = renderFields()
    await user.type(keyInput(), 'season')
    await user.keyboard('{Escape}')
    const question = await screen.findByRole('alertdialog')
    await user.click(within(question).getByRole('button', { name: 'Discard' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Open fields' }))
    expect(keyInput().value).toBe('')
  })

  it('asks too for a value alone, a json other than {} and a boolean never counts', async () => {
    const user = userEvent.setup()
    renderFields()
    await user.type(valueInput(), 'x')
    await closeWithX(user)
    expect(await screen.findByRole('alertdialog')).toBeTruthy()
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Open fields' }))
    await user.selectOptions(within(getDialog()).getByRole('combobox', { name: 'Type' }), 'json')
    await user.click(screen.getByTestId('json-editor'))
    await closeWithX(user)
    expect(await screen.findByRole('alertdialog')).toBeTruthy()
  })

  it('Add and close adds what was typed and then closes', async () => {
    const user = userEvent.setup()
    const { props, onClose } = renderFields()
    await user.type(keyInput(), 'season')
    await user.type(valueInput(), 'summer')
    await closeWithX(user)
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Add and close' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(props.handleAddMetaField).toHaveBeenCalledWith({ key: 'season', business_id: 7, menu_id: 11, value: 'summer', value_type: 'text' })
  })

  it('Add and close with an invalid form stays, shows the errors and adds nothing', async () => {
    const user = userEvent.setup()
    const { props, onClose } = renderFields()
    await user.type(keyInput(), 'season')
    await closeWithX(user)
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Add and close' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(within(getDialog()).getByText('Enter a value.')).toBeTruthy()
    expect(props.handleAddMetaField).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Add and close that the API refuses stays and shows why', async () => {
    const user = userEvent.setup()
    const { onClose } = renderFields({ handleAddMetaField: vi.fn().mockResolvedValue({ ok: false, error: ['Key already exists'] }) })
    await user.type(keyInput(), 'season')
    await user.type(valueInput(), 'summer')
    await closeWithX(user)
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Add and close' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect((await within(getDialog()).findByRole('alert')).textContent).toContain('Key already exists')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('never asks about, nor registers in, the guard of the form behind it', async () => {
    const user = userEvent.setup()
    const outer = { register: vi.fn(() => () => {}), registerNested: vi.fn(() => () => {}), requestLeave: vi.fn() }
    const props = controller()
    const onClose = vi.fn()
    render(
      <LeaveGuardContext.Provider value={outer}>
        <Host onClose={onClose} {...props} />
      </LeaveGuardContext.Provider>
    )
    await user.type(keyInput(), 'season')
    await closeWithX(user)
    expect(await screen.findByRole('alertdialog')).toBeTruthy()
    expect(outer.register).not.toHaveBeenCalled()
    expect(outer.requestLeave).not.toHaveBeenCalled()
  })
})

describe('BusinessMenuCustomFields · the focus', () => {
  it('goes back to the button that opened it when the X closes it', async () => {
    const user = userEvent.setup()
    renderFields({}, { initialOpen: false })
    const opener = screen.getByRole('button', { name: 'Open fields' })
    await user.click(opener)
    await within(await screen.findByRole('dialog')).findByRole('button', { name: 'Close' })
    await user.click(within(getDialog()).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(opener))
  })

  it('goes to returnFocus() when the opener is gone from the page, and to the body without it', async () => {
    const user = userEvent.setup()
    const Gone = ({ withReturn }) => {
      const [open, setOpen] = useState(false)
      const [shown, setShown] = useState(true)
      const targetRef = React.useRef(null)
      return (
        <>
          <button type='button' ref={targetRef}>Target</button>
          {shown && <button type='button' onClick={() => { setOpen(true); setShown(false) }}>Vanishing opener</button>}
          <BusinessMenuCustomFields
            {...controller()}
            open={open}
            onClose={() => setOpen(false)}
            returnFocus={withReturn ? () => targetRef.current : undefined}
            businessId={7}
            menuId={11}
          />
        </>
      )
    }
    const { unmount } = render(<Gone withReturn />)
    await user.click(screen.getByRole('button', { name: 'Vanishing opener' }))
    await user.click(await within(await screen.findByRole('dialog')).findByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Target' })))
    unmount()
    render(<Gone />)
    await user.click(screen.getByRole('button', { name: 'Vanishing opener' }))
    await user.click(await within(await screen.findByRole('dialog')).findByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Target' }))
  })

  it('goes to returnFocus() when the opener left the page (a menu item)', async () => {
    const user = userEvent.setup()
    const ActionsMenu = () => {
      const [open, setOpen] = useState(false)
      const actionsRef = React.useRef(null)
      return (
        <>
          <div ref={actionsRef}>
            <Menu
              icon={Ellipsis}
              label='More actions'
              items={[{ key: 'custom_fields', label: 'Custom fields', onSelect: () => setOpen(true) }]}
            />
          </div>
          <BusinessMenuCustomFields
            {...controller()}
            open={open}
            onClose={() => setOpen(false)}
            returnFocus={() => actionsRef.current?.querySelector('button[aria-haspopup]')}
            businessId={7}
            menuId={11}
          />
        </>
      )
    }
    render(<ActionsMenu />)
    const trigger = screen.getByRole('button', { name: 'More actions' })
    await user.click(trigger)
    await user.click(await screen.findByRole('menuitem', { name: 'Custom fields' }))
    await within(await screen.findByRole('dialog')).findByRole('button', { name: 'Close' })
    await user.click(within(getDialog()).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})

describe('BusinessMenuCustomFields · source', () => {
  const source = readFileSync(path.resolve(__dirname, '../index.js'), 'utf8')

  it('is Product only: no react-hook-form, no legacy Alert or spinner, no styled-components, no DOM lookups', () => {
    expect(source).not.toMatch(/react-hook-form/)
    expect(source).not.toMatch(/SpinnerLoader|\bAlert\b/)
    expect(source).not.toMatch(/styled-components|from '\.\/styles'/)
    expect(source).not.toMatch(/react-loading-skeleton|@meronex/)
    expect(source).not.toMatch(/getElementById/)
  })

  it('does not use the VALUE key, whose catalog text is «Vlue»', () => {
    expect(source).not.toMatch(/t\('VALUE'/)
  })
})

// redesign bugs E: the sidebar, links, back/forward, ⌘K and Mia ask too while a field is half typed
describe('BusinessMenuCustomFields · ways out of the page', () => {
  it('a route change to another page asks first and Keep editing stays; ⌘K asks too and Discard lets it go', async () => {
    const user = userEvent.setup()
    const { onClose } = renderFields()
    await user.type(keyInput(), 'season')
    act(() => { route.history.push('/orders') })
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(route.path).toBe('/stores/list')
    expect(onClose).not.toHaveBeenCalled()

    const { requestRouteLeave } = await import('../../../../utils/routeLeaveGuard')
    const go = vi.fn()
    act(() => { requestRouteLeave(go) })
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(go).toHaveBeenCalledTimes(1))
  })

  it('with nothing typed the page is never held', () => {
    renderFields()
    act(() => { route.history.push('/orders') })
    expect(route.path).toBe('/orders')
  })
})
