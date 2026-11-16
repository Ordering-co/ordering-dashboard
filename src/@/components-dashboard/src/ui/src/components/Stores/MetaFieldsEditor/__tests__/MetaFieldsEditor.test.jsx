/* eslint-disable import/first */
// redesign stores 5.14 (K-1): the custom-fields editor promoted from the menu (5.6). The piece has no controller: it gets
// the fields and the three actions as props, so it is driven here with plain mocks. What belongs to the menu (the dialog, its own
// leave guard, the body with `menu_id`) is covered by Stores/BusinessMenuCustomFields.
import React, { useState } from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))
// the editor of today, reduced to a button that types `{ "a": 1 }` into it
vi.mock('jsoneditor-react', () => ({
  JsonEditor: ({ onChange }) => <button type='button' data-testid='json-editor' onClick={() => onChange({ a: 1 })}>edit json</button>
}))

import { LeaveGuardContext } from '../../../Shared/Product'
import { MetaFieldDeleteConfirm, MetaFieldsEditor, useMetaFieldDelete } from '../index'

const FIELDS = [
  { id: 1, key: 'color', value: 'red', value_type: 'text' },
  { id: 2, key: 'gift', value: '0', value_type: 'boolean' },
  { id: 3, key: 'allowed', value: '1', value_type: 'boolean' },
  { id: 4, key: 'weight', value: '12', value_type: 'integer' }
]
const EXTRA = { business_id: 7, offer_id: 21 }

const baseProps = (overrides = {}) => ({
  fields: FIELDS,
  loading: false,
  error: null,
  onReload: vi.fn(),
  onAdd: vi.fn().mockResolvedValue({ ok: true }),
  onDelete: vi.fn().mockResolvedValue({ ok: true }),
  extraBody: EXTRA,
  ...overrides
})

const renderEditor = (overrides = {}) => {
  const props = baseProps(overrides)
  const utils = render(<MetaFieldsEditor {...props} />)
  return { ...utils, props }
}

const keyInput = () => screen.getByRole('textbox', { name: /^Key/ })
const valueInput = () => screen.getByRole('textbox', { name: /^Value/ })
const typeSelect = () => screen.getByRole('combobox', { name: 'Type' })
const submit = (user) => user.click(screen.getByRole('button', { name: 'Add field' }))

afterEach(() => {
  cleanup()
})

describe('MetaFieldsEditor · the list', () => {
  it('shows the type, the key and the value as plain text, with True and False for a boolean', () => {
    renderEditor()
    const rows = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(rows).toHaveLength(4)
    expect(rows[0].textContent).toContain('Text')
    expect(rows[0].textContent).toContain('color')
    expect(rows[0].textContent).toContain('red')
    expect(rows[1].textContent).toContain('Boolean')
    expect(rows[1].textContent).toContain('False')
    expect(rows[2].textContent).toContain('True')
    expect(rows[3].textContent).toContain('Integer')
    expect(within(rows[0]).queryByRole('textbox')).toBeNull()
  })

  it('gives every row a named, focusable delete button', () => {
    renderEditor()
    const buttons = screen.getAllByRole('button', { name: /^Delete field / })
    expect(buttons.map(button => button.getAttribute('aria-label'))).toEqual(['Delete field color', 'Delete field gift', 'Delete field allowed', 'Delete field weight'])
    buttons[1].focus()
    expect(document.activeElement).toBe(buttons[1])
  })

  it('shows three skeleton rows and a Loading status while it loads', () => {
    renderEditor({ fields: [], loading: true })
    expect(screen.getByRole('status').textContent).toBe('Loading')
    expect(document.querySelectorAll('.odc-skeleton').length).toBeGreaterThanOrEqual(3)
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('says there are none yet, which is not the same as an error', () => {
    renderEditor({ fields: [] })
    expect(screen.getByText('No custom fields yet.')).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('says why it could not load, instead of saying there are none, and retries with Retry', async () => {
    const user = userEvent.setup()
    const { props } = renderEditor({ fields: [], error: ['Not authorized'] })
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Not authorized')
    expect(screen.queryByText('No custom fields yet.')).toBeNull()
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(props.onReload).toHaveBeenCalledTimes(1)
  })

  it('takes the error as a string too', () => {
    renderEditor({ fields: [], error: 'Boom' })
    expect(screen.getByRole('alert').textContent).toContain('Boom')
  })

  it('falls back to its own text when the error has no message', () => {
    const { unmount } = renderEditor({ fields: [], error: [] })
    expect(screen.getByRole('alert').textContent).toContain("We couldn't load the custom fields.")
    unmount()
    renderEditor({ fields: [], error: ['  '] })
    expect(screen.getByRole('alert').textContent).toContain("We couldn't load the custom fields.")
  })

  it('does not show the error while it is loading again', () => {
    renderEditor({ fields: [], loading: true, error: ['Not authorized'] })
    expect(screen.queryByText('Not authorized')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Loading')
  })

  it('puts the className on its root', () => {
    const { container } = renderEditor({ className: 'host-class' })
    expect(container.querySelector('.odc-mfe.host-class')).toBeTruthy()
  })
})

describe('MetaFieldsEditor · the add form', () => {
  it('has labelled controls: Type (text by default), Key and Value', () => {
    renderEditor()
    expect(typeSelect().value).toBe('text')
    expect([...typeSelect().options].map(option => option.textContent)).toEqual(['Integer', 'Decimal', 'Boolean', 'Text', 'JSON'])
    expect(keyInput()).toBeTruthy()
    expect(valueInput()).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add field' }).getAttribute('type')).toBe('submit')
  })

  it('asks for the key and the value, focuses the first invalid control and calls nothing', async () => {
    const user = userEvent.setup()
    const { props } = renderEditor()
    await submit(user)
    expect(screen.getByText('Enter a key.')).toBeTruthy()
    expect(screen.getByText('Enter a value.')).toBeTruthy()
    expect(props.onAdd).not.toHaveBeenCalled()
    await waitFor(() => expect(document.activeElement).toBe(keyInput()))
    expect(keyInput().getAttribute('aria-invalid')).toBe('true')
  })

  it('follows what is typed after the first attempt: the error goes away as it is fixed', async () => {
    const user = userEvent.setup()
    renderEditor()
    await submit(user)
    expect(screen.getByText('Enter a key.')).toBeTruthy()
    await user.type(keyInput(), 'season')
    expect(screen.queryByText('Enter a key.')).toBeNull()
    expect(screen.getByText('Enter a value.')).toBeTruthy()
  })

  it('wants a whole number for an integer', async () => {
    const user = userEvent.setup()
    const { props } = renderEditor()
    await user.selectOptions(typeSelect(), 'integer')
    await user.type(keyInput(), 'weight')
    await user.type(valueInput(), '1.5')
    await submit(user)
    expect(screen.getByText('Enter a whole number.')).toBeTruthy()
    expect(props.onAdd).not.toHaveBeenCalled()
    expect(valueInput().getAttribute('inputmode')).toBe('numeric')
  })

  it('wants a number for a decimal and accepts one', async () => {
    const user = userEvent.setup()
    const { props } = renderEditor()
    await user.selectOptions(typeSelect(), 'decimal')
    await user.type(keyInput(), 'ratio')
    await user.type(valueInput(), 'abc')
    await submit(user)
    expect(screen.getByText('Enter a number.')).toBeTruthy()
    expect(props.onAdd).not.toHaveBeenCalled()
    expect(valueInput().getAttribute('inputmode')).toBe('decimal')
    await user.clear(valueInput())
    await user.type(valueInput(), '-1.5e3')
    await submit(user)
    expect(props.onAdd).toHaveBeenCalledWith({ key: 'ratio', ...EXTRA, value: '-1.5e3', value_type: 'decimal' })
  })

  it('sends the typed values plus extraBody, nothing else, clears the form and focuses Key', async () => {
    const user = userEvent.setup()
    const { props } = renderEditor()
    await user.type(keyInput(), 'season')
    await user.type(valueInput(), 'summer')
    await submit(user)
    expect(props.onAdd).toHaveBeenCalledTimes(1)
    expect(props.onAdd.mock.calls[0][0]).toEqual({ key: 'season', business_id: 7, offer_id: 21, value: 'summer', value_type: 'text' })
    await waitFor(() => expect(keyInput().value).toBe(''))
    expect(valueInput().value).toBe('')
    await waitFor(() => expect(document.activeElement).toBe(keyInput()))
    expect(screen.queryByText('Enter a key.')).toBeNull()
  })

  it('sends only the typed values when there is no extraBody, and never lets extraBody replace them', async () => {
    const user = userEvent.setup()
    const { props, unmount } = renderEditor({ extraBody: undefined })
    await user.type(keyInput(), 'season')
    await user.type(valueInput(), 'summer')
    await submit(user)
    expect(props.onAdd.mock.calls[0][0]).toEqual({ key: 'season', value: 'summer', value_type: 'text' })
    unmount()
    const second = renderEditor({ extraBody: { key: 'other', value_type: 'json', menu_id: 11 } })
    await user.type(keyInput(), 'season')
    await user.type(valueInput(), 'summer')
    await submit(user)
    expect(second.props.onAdd.mock.calls[0][0]).toEqual({ key: 'season', menu_id: 11, value: 'summer', value_type: 'text' })
  })

  it('adds a boolean (True is 1 by default, False is 0)', async () => {
    const user = userEvent.setup()
    const { props } = renderEditor()
    await user.selectOptions(typeSelect(), 'boolean')
    const value = screen.getByRole('combobox', { name: /^Value/ })
    expect(value.value).toBe('1')
    expect([...value.options].map(option => option.textContent)).toEqual(['True', 'False'])
    await user.type(keyInput(), 'vip')
    await submit(user)
    expect(props.onAdd).toHaveBeenLastCalledWith({ key: 'vip', ...EXTRA, value: '1', value_type: 'boolean' })
    await waitFor(() => expect(keyInput().value).toBe(''))
    await user.selectOptions(screen.getByRole('combobox', { name: /^Value/ }), '0')
    await user.type(keyInput(), 'vip2')
    await submit(user)
    expect(props.onAdd).toHaveBeenLastCalledWith({ key: 'vip2', ...EXTRA, value: '0', value_type: 'boolean' })
  })

  it('adds a json value', async () => {
    const user = userEvent.setup()
    const { props } = renderEditor()
    await user.selectOptions(typeSelect(), 'json')
    await user.type(keyInput(), 'meta')
    await user.click(screen.getByTestId('json-editor'))
    await submit(user)
    expect(props.onAdd).toHaveBeenCalledWith({ key: 'meta', ...EXTRA, value: '{"a":1}', value_type: 'json' })
  })

  it('clears the value when the type changes', async () => {
    const user = userEvent.setup()
    renderEditor()
    await user.type(valueInput(), 'abc')
    await user.selectOptions(typeSelect(), 'integer')
    expect(valueInput().value).toBe('')
  })

  it('shows the failure of the API under the form and keeps what was typed', async () => {
    const user = userEvent.setup()
    renderEditor({ onAdd: vi.fn().mockResolvedValue({ ok: false, error: ['Key already exists'] }) })
    await user.type(keyInput(), 'season')
    await user.type(valueInput(), 'summer')
    await submit(user)
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Key already exists')
    expect(keyInput().value).toBe('season')
    expect(valueInput().value).toBe('summer')
    expect(screen.getByRole('button', { name: 'Add field' }).getAttribute('aria-busy')).toBeNull()
    // typing again takes the failure away
    await user.type(keyInput(), '2')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('falls back to its own text when the API gave no message, and when the call throws', async () => {
    const user = userEvent.setup()
    const { unmount } = renderEditor({ onAdd: vi.fn().mockResolvedValue({ ok: false }) })
    await user.type(keyInput(), 'season')
    await user.type(valueInput(), 'summer')
    await submit(user)
    expect((await screen.findByRole('alert')).textContent).toContain("We couldn't add this field. Try again.")
    unmount()
    renderEditor({ onAdd: vi.fn().mockRejectedValue(new Error('')) })
    await user.type(keyInput(), 'season')
    await user.type(valueInput(), 'summer')
    await submit(user)
    expect((await screen.findByRole('alert')).textContent).toContain("We couldn't add this field. Try again.")
  })

  it('is busy while it adds and does not send twice', async () => {
    const user = userEvent.setup()
    let release
    const onAdd = vi.fn(() => new Promise(resolve => { release = resolve }))
    renderEditor({ onAdd })
    await user.type(keyInput(), 'season')
    await user.type(valueInput(), 'summer')
    await submit(user)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add field' }).getAttribute('aria-busy')).toBe('true'))
    await submit(user)
    expect(onAdd).toHaveBeenCalledTimes(1)
    release({ ok: true })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add field' }).getAttribute('aria-busy')).toBeNull())
  })
})

describe('MetaFieldsEditor · Delete', () => {
  const deleteButton = (key = 'color') => screen.getByRole('button', { name: `Delete field ${key}` })

  it('asks first, with the key and the consequence, and Cancel has the focus', async () => {
    const user = userEvent.setup()
    const { props } = renderEditor()
    await user.click(deleteButton())
    const confirm = await screen.findByRole('alertdialog')
    expect(within(confirm).getByText('Delete field "color"?')).toBeTruthy()
    expect(within(confirm).getByText("This can't be undone.")).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(within(confirm).getByRole('button', { name: 'Cancel' })))
    expect(props.onDelete).not.toHaveBeenCalled()
  })

  it('does not delete on Cancel and gives the focus back to the button', async () => {
    const user = userEvent.setup()
    const { props } = renderEditor()
    await user.click(deleteButton('gift'))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(props.onDelete).not.toHaveBeenCalled()
    await waitFor(() => expect(document.activeElement).toBe(deleteButton('gift')))
  })

  it('confirms, calls onDelete with the id of the field and closes', async () => {
    const user = userEvent.setup()
    const { props } = renderEditor()
    await user.click(deleteButton('weight'))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete field' }))
    expect(props.onDelete).toHaveBeenCalledTimes(1)
    expect(props.onDelete).toHaveBeenCalledWith(4)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('stays open and says why when the delete fails; the field stays and nothing keeps spinning', async () => {
    const user = userEvent.setup()
    const { props } = renderEditor({ onDelete: vi.fn().mockResolvedValue({ ok: false, error: ['Field is in use'] }) })
    await user.click(deleteButton())
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete field' }))
    expect(props.onDelete).toHaveBeenCalledWith(1)
    const notice = await within(screen.getByRole('alertdialog')).findByRole('alert')
    expect(notice.textContent).toContain('Field is in use')
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete field' }).getAttribute('aria-busy')).toBeNull()
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(false)
    expect(document.body.textContent).toContain('color')
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()
  })

  it('falls back to its own text when the API gave no message, and when the call throws', async () => {
    const user = userEvent.setup()
    renderEditor({ onDelete: vi.fn().mockRejectedValue(new Error('')) })
    await user.click(deleteButton())
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete field' }))
    expect((await screen.findByRole('alert')).textContent).toContain("We couldn't delete this field. Try again.")
    expect(screen.getByRole('alertdialog')).toBeTruthy()
  })

  it('takes a plain message string from a refused delete', async () => {
    const user = userEvent.setup()
    renderEditor({ onDelete: vi.fn().mockResolvedValue({ ok: false, error: 'Nope' }) })
    await user.click(deleteButton())
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete field' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Nope')
  })

  it('clears the failure when the confirmation is closed and opened again', async () => {
    const user = userEvent.setup()
    renderEditor({ onDelete: vi.fn().mockResolvedValue({ ok: false, error: ['Field is in use'] }) })
    await user.click(deleteButton())
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete field' }))
    await within(screen.getByRole('alertdialog')).findByRole('alert')
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await user.click(deleteButton('gift'))
    const confirm = await screen.findByRole('alertdialog')
    expect(within(confirm).queryByRole('alert')).toBeNull()
  })

  it('puts the focus on a delete button of the list when the row left with the delete', async () => {
    const user = userEvent.setup()
    const Stateful = () => {
      const [fields, setFields] = useState(FIELDS)
      return (
        <MetaFieldsEditor
          {...baseProps({
            fields,
            onDelete: async (id) => {
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
    expect(screen.queryByText('gift')).toBeNull()
    await waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Delete field allowed'))
  })
})

describe('MetaFieldsEditor · Delete hosted outside (deletion)', () => {
  // A host that owns the flow, as the menu does: the confirmation is drawn BESIDE the editor, not by it.
  const Hosted = ({ onDelete, withConfirm = true }) => {
    const deletion = useMetaFieldDelete({ onDelete })
    return (
      <>
        <section data-testid='editor-host'>
          <MetaFieldsEditor {...baseProps()} deletion={deletion} />
        </section>
        {withConfirm && <MetaFieldDeleteConfirm {...deletion.confirm} />}
      </>
    )
  }

  it('does not draw the confirmation itself; the host draws it, outside the editor, from askDelete', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockResolvedValue({ ok: true })
    render(<Hosted onDelete={onDelete} />)
    await user.click(screen.getByRole('button', { name: 'Delete field gift' }))
    const confirm = await screen.findByRole('alertdialog')
    expect(within(confirm).getByText('Delete field "gift"?')).toBeTruthy()
    expect(screen.getByTestId('editor-host').contains(confirm)).toBe(false)
    await waitFor(() => expect(document.activeElement).toBe(within(confirm).getByRole('button', { name: 'Cancel' })))
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('draws no confirmation at all when the host does not, and the editor keeps no second one', async () => {
    const user = userEvent.setup()
    render(<Hosted onDelete={vi.fn()} withConfirm={false} />)
    await user.click(screen.getByRole('button', { name: 'Delete field gift' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(document.querySelectorAll('.odc-overlay-backdrop')).toHaveLength(0)
  })

  it('runs the host\'s onDelete, not the editor\'s prop, and closes', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn().mockResolvedValue({ ok: true })
    render(<Hosted onDelete={onDelete} />)
    await user.click(screen.getByRole('button', { name: 'Delete field weight' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete field' }))
    expect(onDelete).toHaveBeenCalledWith(4)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('keeps the confirmation open with the reason when the host\'s delete is refused, and gives the focus back to the button on Cancel', async () => {
    const user = userEvent.setup()
    render(<Hosted onDelete={vi.fn().mockResolvedValue({ ok: false, error: ['Field is in use'] })} />)
    await user.click(screen.getByRole('button', { name: 'Delete field allowed' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete field' }))
    const notice = await within(screen.getByRole('alertdialog')).findByRole('alert')
    expect(notice.textContent).toContain('Field is in use')
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete field allowed' })))
  })

  it('without `deletion` the editor draws its own confirmation inside itself, as before', async () => {
    const user = userEvent.setup()
    renderEditor()
    await user.click(screen.getByRole('button', { name: 'Delete field color' }))
    expect(await screen.findByRole('alertdialog')).toBeTruthy()
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1)
  })
})

describe('MetaFieldsEditor · the close guard', () => {
  const host = () => ({ register: vi.fn(() => () => {}), registerNested: vi.fn(() => () => {}), requestLeave: vi.fn() })

  it('hands registerCloseGuard a guard that lets go with nothing typed and asks the host with something typed', async () => {
    const user = userEvent.setup()
    const registerCloseGuard = vi.fn(() => () => {})
    const leave = host()
    render(
      <LeaveGuardContext.Provider value={leave}>
        <MetaFieldsEditor {...baseProps({ registerCloseGuard })} />
      </LeaveGuardContext.Provider>
    )
    expect(registerCloseGuard).toHaveBeenCalled()
    const guard = () => registerCloseGuard.mock.calls.at(-1)[0]
    const proceed = vi.fn()
    expect(guard()(proceed)).toBe(false)
    expect(leave.requestLeave).not.toHaveBeenCalled()
    await user.type(keyInput(), 'season')
    expect(guard()(proceed)).toBe(true)
    expect(leave.requestLeave).toHaveBeenCalledTimes(1)
    expect(leave.requestLeave.mock.calls[0][0]).toBe(proceed)
    expect(leave.register).toHaveBeenCalled()
  })

  it('unregisters the guard when it leaves', () => {
    const unregister = vi.fn()
    const registerCloseGuard = vi.fn(() => unregister)
    const { unmount } = render(
      <LeaveGuardContext.Provider value={host()}>
        <MetaFieldsEditor {...baseProps({ registerCloseGuard })} />
      </LeaveGuardContext.Provider>
    )
    unmount()
    expect(unregister).toHaveBeenCalled()
  })

  it('registers its form in the nearest host: Save adds what was typed, Discard empties the form', async () => {
    const user = userEvent.setup()
    const leave = host()
    const props = baseProps()
    render(
      <LeaveGuardContext.Provider value={leave}>
        <MetaFieldsEditor {...props} />
      </LeaveGuardContext.Provider>
    )
    const entryRef = leave.register.mock.calls[0][0]
    expect(entryRef.current.isDirty()).toBe(false)
    await user.type(keyInput(), 'season')
    await user.type(valueInput(), 'summer')
    expect(entryRef.current.isDirty()).toBe(true)
    expect(entryRef.current.count()).toBe(2)
    await act(async () => { await entryRef.current.save() })
    expect(props.onAdd.mock.calls[0][0]).toEqual({ key: 'season', ...EXTRA, value: 'summer', value_type: 'text' })
    await user.type(keyInput(), 'again')
    act(() => { entryRef.current.discard() })
    await waitFor(() => expect(keyInput().value).toBe(''))
  })
})

describe('MetaFieldsEditor · source', () => {
  const source = readFileSync(path.resolve(__dirname, '../index.jsx'), 'utf8')
  // the header comment names the ids the hosts pass; the code must not
  const code = source.split('\n').filter(line => !line.trim().startsWith('//')).join('\n')

  it('is Product only and knows neither a menu nor an offer', () => {
    expect(source).not.toMatch(/react-hook-form/)
    expect(source).not.toMatch(/SpinnerLoader|\bAlert\b/)
    expect(source).not.toMatch(/styled-components|from '\.\/styles'/)
    expect(source).not.toMatch(/react-loading-skeleton|@meronex/)
    expect(source).not.toMatch(/getElementById/)
    expect(code).not.toMatch(/menu_id|offer_id|businessId|menuId/)
  })

  it('does not use the VALUE key, whose catalog text is «Vlue»', () => {
    expect(source).not.toMatch(/t\('VALUE'/)
  })
})
