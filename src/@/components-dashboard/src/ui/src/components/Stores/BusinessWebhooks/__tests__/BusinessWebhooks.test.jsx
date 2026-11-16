/* eslint-disable import/first */
// redesign stores 5.16 (; G2-39, G2-40): Store details › Webhooks on Product. Covered: each webhook reads as text (its
// event and its URL are not inputs), only its delay is editable, and a change of delay calls the controller for THAT webhook with
// only that row busy; a failed change puts the old delay back and says why in that row; delete asks first; the add form needs an
// event and a URL, sends the delay only when one was chosen, and says under the form why an add failed.
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const probe = vi.hoisted(() => ({
  Controller: null,
  add: null,
  delay: null,
  remove: null,
  adding: false,
  savingIds: [],
  deletingId: null
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  BusinessWebhooks: (props) => probe.Controller(props)
}))
vi.mock('~components', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  BusinessWebhooks: (props) => probe.Controller(props)
}))

import { BusinessWebhooks } from '../index'
import { LeaveGuardContext } from '../../../Shared/Product'

// A stand-in for the controller: it keeps the add form's draft and hands the UI the same props the real one does. Like the real
// one it flags a row (`savingIds`, and `savingId` for old readers) from the moment its change starts until the answer.
const FakeController = ({ UIComponent, ...props }) => {
  const [changes, setChanges] = React.useState({})
  const [saving, setSaving] = React.useState([])
  const savingIds = [...probe.savingIds, ...saving]
  const changeDelay = async (value, webhook) => {
    setSaving(current => [...current, webhook.id])
    try {
      return await probe.delay(value, webhook)
    } finally {
      setSaving(current => current.filter(id => id !== webhook.id))
    }
  }
  return (
    <UIComponent
      {...props}
      hookFormState={{ changes, result: { error: false } }}
      adding={probe.adding}
      savingId={savingIds.length ? savingIds[savingIds.length - 1] : null}
      savingIds={savingIds}
      deletingId={probe.deletingId}
      handleChangeSelect={(value, name) => setChanges(current => ({ ...current, [name]: value }))}
      handleChangeInput={(event) => setChanges(current => ({ ...current, [event.target.name]: event.target.value }))}
      handleUpdateAddClick={async () => {
        const result = await probe.add(changes)
        if (result?.ok) setChanges({})
        return result
      }}
      handleChangeDelay={changeDelay}
      handleDeleteWebhook={(...args) => probe.remove(...args)}
    />
  )
}

const STORE = {
  id: 2,
  webhooks: [
    { id: 11, hook: 'orders_register', url: 'https://a.test/hook', delay: '0' },
    { id: 12, hook: 'orders_pending', url: 'https://b.test/hook', delay: '300' },
    { id: 13, hook: 'custom_event', url: 'https://c.test/hook', delay: null }
  ]
}

const row = (name) => within(screen.getByRole('list', { name: 'Webhooks' })).getAllByRole('listitem')
  .find(item => within(item).queryByText(name) != null)

beforeEach(() => {
  probe.Controller = FakeController
  probe.add = vi.fn().mockResolvedValue({ ok: true, result: {} })
  probe.delay = vi.fn().mockResolvedValue({ ok: true })
  probe.remove = vi.fn().mockResolvedValue({ ok: true })
  probe.adding = false
  probe.savingIds = []
  probe.deletingId = null
})

describe('Store details › Webhooks › list', () => {
  it('has a page heading and lists each webhook with its event and URL as text, not inputs (G2-39)', () => {
    render(<BusinessWebhooks business={STORE} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Webhooks' })).toBeTruthy()
    const list = screen.getByRole('list', { name: 'Webhooks' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(within(list).getByText('New order').tagName).not.toBe('INPUT')
    expect(within(list).getByText('https://a.test/hook').closest('input')).toBeNull()
    // the event and the URL are not controls: the only ones in a row are the delay and the delete button
    expect(within(list).queryAllByRole('textbox')).toHaveLength(0)
    expect(within(list).getAllByRole('combobox')).toHaveLength(3)
    // an event this dashboard does not know shows as the API sent it
    expect(within(list).getByText('custom_event')).toBeTruthy()
  })

  it('names each row\'s delay and delete after its event, so the rows tell apart', () => {
    render(<BusinessWebhooks business={STORE} />)
    expect(screen.getByRole('combobox', { name: 'Delay for Order pending' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Delay for New order' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete webhook Order pending' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete webhook custom_event' })).toBeTruthy()
  })

  // redesign bugs F row 37: two webhooks of the same event used to get identical names
  it('adds the URL to the names of the rows that share an event, so every control name is unique', () => {
    render(<BusinessWebhooks business={{
      id: 2,
      webhooks: [
        { id: 21, hook: 'orders_register', url: 'https://a.test/hook', delay: '0' },
        { id: 22, hook: 'orders_register', url: 'https://b.test/hook', delay: '300' },
        { id: 23, hook: 'orders_pending', url: 'https://c.test/hook', delay: '0' }
      ]
    }} />)
    const list = within(screen.getByRole('list', { name: 'Webhooks' }))
    const names = [...list.getAllByRole('combobox'), ...list.getAllByRole('button')]
      .map(control => control.getAttribute('aria-label'))
    expect(names).toHaveLength(6)
    expect(new Set(names).size).toBe(6)
    expect(screen.getByRole('combobox', { name: 'Delay for New order (https://a.test/hook)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete webhook New order (https://b.test/hook)' })).toBeTruthy()
    // a row whose event is alone keeps the short name
    expect(screen.getByRole('button', { name: 'Delete webhook Order pending' })).toBeTruthy()
  })

  it('shows each saved delay selected, and «Select a delay» when there is none', () => {
    render(<BusinessWebhooks business={STORE} />)
    expect(screen.getByRole('combobox', { name: 'Delay for New order' }).value).toBe('0')
    expect(screen.getByRole('combobox', { name: 'Delay for Order pending' }).value).toBe('300')
    expect(screen.getByRole('combobox', { name: 'Delay for custom_event' }).value).toBe('')
  })

  it('says when the store has no webhooks yet', () => {
    render(<BusinessWebhooks business={{ id: 2, webhooks: [] }} />)
    expect(screen.getByText('No webhooks yet')).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Webhooks' })).toBeNull()
    // and a store without the key at all
    render(<BusinessWebhooks business={{ id: 3 }} />)
    expect(screen.getAllByText('No webhooks yet')).toHaveLength(2)
  })
})

describe('Store details › Webhooks › delay', () => {
  it('changing a delay asks the controller about that webhook only', async () => {
    const user = userEvent.setup()
    render(<BusinessWebhooks business={STORE} />)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Delay for Order pending' }), 'pickup_time')
    expect(probe.delay).toHaveBeenCalledTimes(1)
    expect(probe.delay).toHaveBeenCalledWith('pickup_time', STORE.webhooks[1])
    expect(screen.getByRole('combobox', { name: 'Delay for Order pending' }).value).toBe('pickup_time')
    expect(screen.getByRole('combobox', { name: 'Delay for New order' }).value).toBe('0')
  })

  it('offers the same eight delays as before', () => {
    render(<BusinessWebhooks business={STORE} />)
    const select = screen.getByRole('combobox', { name: 'Delay for New order' })
    expect([...select.options].map(option => [option.value, option.textContent])).toEqual([
      ['', 'Select a delay'],
      ['0', 'Immediately'],
      ['300', '5 Minutes'],
      ['600', '10 Minutes'],
      ['900', '15 Minutes'],
      ['delivery_time', 'Delivery time'],
      ['pickup_time', 'Pickup time'],
      ['preparation_time', 'Preparation time']
    ])
  })

  it('only the rows that are saving are busy, and a busy select stays focusable (aria-disabled, never disabled)', () => {
    probe.savingIds = [12]
    render(<BusinessWebhooks business={STORE} />)
    const saving = screen.getByRole('combobox', { name: 'Delay for Order pending' })
    expect(saving.disabled).toBe(false)
    expect(saving.getAttribute('aria-busy')).toBe('true')
    expect(saving.getAttribute('aria-disabled')).toBe('true')
    const other = screen.getByRole('combobox', { name: 'Delay for New order' })
    expect(other.disabled).toBe(false)
    expect(other.getAttribute('aria-busy')).toBeNull()
    expect(other.getAttribute('aria-disabled')).toBeNull()
  })

  it('two rows saving at once are both busy', () => {
    probe.savingIds = [11, 12]
    render(<BusinessWebhooks business={STORE} />)
    for (const name of ['Delay for New order', 'Delay for Order pending']) {
      expect(screen.getByRole('combobox', { name }).getAttribute('aria-busy')).toBe('true')
    }
    expect(screen.getByRole('combobox', { name: 'Delay for custom_event' }).getAttribute('aria-busy')).toBeNull()
  })

  it('keeps the focus on the select while the change saves and after it is accepted', async () => {
    const user = userEvent.setup()
    let release
    probe.delay = vi.fn(() => new Promise(resolve => { release = resolve }))
    render(<BusinessWebhooks business={STORE} />)
    const select = screen.getByRole('combobox', { name: 'Delay for Order pending' })
    await user.selectOptions(select, '900')
    await waitFor(() => expect(select.getAttribute('aria-busy')).toBe('true'))
    expect(select.disabled).toBe(false)
    expect(document.activeElement).toBe(select)
    await act(async () => { release({ ok: true }) })
    await waitFor(() => expect(select.getAttribute('aria-busy')).toBeNull())
    expect(document.activeElement).toBe(select)
    expect(select.value).toBe('900')
  })

  it('keeps the focus on the select after a failed save that puts the old delay back', async () => {
    const user = userEvent.setup()
    let release
    probe.delay = vi.fn(() => new Promise(resolve => { release = resolve }))
    render(<BusinessWebhooks business={STORE} />)
    const select = screen.getByRole('combobox', { name: 'Delay for Order pending' })
    await user.selectOptions(select, '900')
    await waitFor(() => expect(select.getAttribute('aria-busy')).toBe('true'))
    // a disabled select loses the focus in a real browser (jsdom keeps it): it must never be disabled
    expect(select.disabled).toBe(false)
    expect(document.activeElement).toBe(select)
    await act(async () => { release({ ok: false, error: ['Not allowed'] }) })
    await waitFor(() => expect(select.value).toBe('300'))
    expect(await within(row('Order pending')).findByRole('alert')).toBeTruthy()
    expect(select.getAttribute('aria-busy')).toBeNull()
    expect(document.activeElement).toBe(select)
  })

  it('ignores another change while that row saves: the select snaps back to the current value', async () => {
    const user = userEvent.setup()
    let release
    probe.delay = vi.fn(() => new Promise(resolve => { release = resolve }))
    render(<BusinessWebhooks business={STORE} />)
    const select = screen.getByRole('combobox', { name: 'Delay for Order pending' })
    await user.selectOptions(select, '900')
    await waitFor(() => expect(select.getAttribute('aria-busy')).toBe('true'))
    fireEvent.change(select, { target: { value: '600' } })
    expect(probe.delay).toHaveBeenCalledTimes(1)
    expect(select.value).toBe('900')
    await act(async () => { release({ ok: true }) })
    await waitFor(() => expect(select.getAttribute('aria-busy')).toBeNull())
    // and once it is free a change goes through again
    await user.selectOptions(select, '600')
    expect(probe.delay).toHaveBeenCalledTimes(2)
  })

  it('one row saving does not stop the change of another row', async () => {
    const user = userEvent.setup()
    probe.delay = vi.fn(() => new Promise(() => {}))
    render(<BusinessWebhooks business={STORE} />)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Delay for Order pending' }), '900')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Delay for New order' }), '600')
    expect(probe.delay).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('combobox', { name: 'Delay for Order pending' }).getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('combobox', { name: 'Delay for New order' }).getAttribute('aria-busy')).toBe('true')
  })

  it('puts the old delay back and says why in that row when the change fails', async () => {
    const user = userEvent.setup()
    probe.delay = vi.fn().mockResolvedValue({ ok: false, error: ['Not allowed'] })
    render(<BusinessWebhooks business={STORE} />)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Delay for Order pending' }), '900')
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Delay for Order pending' }).value).toBe('300'))
    const alert = within(row('Order pending')).getByRole('alert')
    expect(alert.textContent).toContain('Not allowed')
    expect(within(row('New order')).queryByRole('alert')).toBeNull()
  })

  it('says the generic reason when the change fails without a message', async () => {
    const user = userEvent.setup()
    probe.delay = vi.fn().mockResolvedValue({ ok: false, error: [] })
    render(<BusinessWebhooks business={STORE} />)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Delay for New order' }), '600')
    expect(await within(row('New order')).findByText('The webhook could not be updated.')).toBeTruthy()
  })

  it('takes the error away when the next change goes through', async () => {
    const user = userEvent.setup()
    probe.delay = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: ['Not allowed'] })
      .mockResolvedValueOnce({ ok: true })
    render(<BusinessWebhooks business={STORE} />)
    const select = screen.getByRole('combobox', { name: 'Delay for Order pending' })
    await user.selectOptions(select, '900')
    await within(row('Order pending')).findByRole('alert')
    await user.selectOptions(select, '600')
    await waitFor(() => expect(within(row('Order pending')).queryByRole('alert')).toBeNull())
    expect(select.value).toBe('600')
  })
})

describe('Store details › Webhooks › delete', () => {
  it('asks first, naming the event and the URL, and only «Delete» calls the controller', async () => {
    const user = userEvent.setup()
    render(<BusinessWebhooks business={STORE} />)
    await user.click(screen.getByRole('button', { name: 'Delete webhook Order pending' }))
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText('Delete this webhook?')).toBeTruthy()
    expect(within(dialog).getByText('Order pending')).toBeTruthy()
    expect(within(dialog).getByText('https://b.test/hook')).toBeTruthy()
    expect(probe.remove).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Delete webhook' }))
    expect(probe.remove).toHaveBeenCalledTimes(1)
    expect(probe.remove).toHaveBeenCalledWith(12)
  })

  it('Cancel closes the question and deletes nothing', async () => {
    const user = userEvent.setup()
    render(<BusinessWebhooks business={STORE} />)
    await user.click(screen.getByRole('button', { name: 'Delete webhook New order' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    expect(probe.remove).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('a failed delete says why above the list and leaves the list as it was', async () => {
    const user = userEvent.setup()
    probe.remove = vi.fn().mockResolvedValue({ ok: false, error: ['Not allowed'] })
    render(<BusinessWebhooks business={STORE} />)
    await user.click(screen.getByRole('button', { name: 'Delete webhook New order' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete webhook' }))
    const notice = await screen.findByText('Not allowed')
    expect(notice.closest('[role="alert"]')).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Webhooks' })).getAllByRole('listitem')).toHaveLength(3)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('says the generic reason when the delete fails without a message', async () => {
    const user = userEvent.setup()
    probe.remove = vi.fn().mockResolvedValue({ ok: false, error: [] })
    render(<BusinessWebhooks business={STORE} />)
    await user.click(screen.getByRole('button', { name: 'Delete webhook New order' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete webhook' }))
    expect(await screen.findByText('The webhook could not be deleted.')).toBeTruthy()
  })

  it('shows the confirmation busy while it deletes', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<BusinessWebhooks business={STORE} />)
    await user.click(screen.getByRole('button', { name: 'Delete webhook New order' }))
    probe.deletingId = 11
    rerender(<BusinessWebhooks business={STORE} />)
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete webhook' }).getAttribute('aria-busy')).toBe('true')
  })
})

describe('Store details › Webhooks › delete › where the focus goes', () => {
  // A shell that takes the deleted webhook out of the store, as the real one does after the controller answers.
  const Shell = ({ webhooks = STORE.webhooks, answer = { ok: true } }) => {
    const [store, setStore] = React.useState({ ...STORE, webhooks })
    probe.remove = vi.fn(async (id) => {
      if (answer.ok) setStore(current => ({ ...current, webhooks: current.webhooks.filter(item => item.id !== id) }))
      return answer
    })
    return <BusinessWebhooks business={store} />
  }
  const confirm = async (user, name) => {
    await user.click(screen.getByRole('button', { name }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete webhook' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  }

  it('goes to the delete button of the row that took its place', async () => {
    const user = userEvent.setup()
    render(<Shell />)
    await confirm(user, 'Delete webhook Order pending')
    expect(within(screen.getByRole('list', { name: 'Webhooks' })).getAllByRole('listitem')).toHaveLength(2)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete webhook custom_event' })))
  })

  it('goes to the previous row\'s delete button when the last row was deleted', async () => {
    const user = userEvent.setup()
    render(<Shell />)
    await confirm(user, 'Delete webhook custom_event')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete webhook Order pending' })))
  })

  it('goes to the first row\'s delete button when the first row was deleted', async () => {
    const user = userEvent.setup()
    render(<Shell />)
    await confirm(user, 'Delete webhook New order')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete webhook Order pending' })))
  })

  it('goes to the add form\'s Event select when no row is left', async () => {
    const user = userEvent.setup()
    render(<Shell webhooks={[STORE.webhooks[0]]} />)
    await confirm(user, 'Delete webhook New order')
    expect(screen.getByText('No webhooks yet')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('combobox', { name: /^Event/ })))
  })

  it('a failed delete keeps the focus where it was: the delete button that asked', async () => {
    const user = userEvent.setup()
    render(<Shell answer={{ ok: false, error: ['Not allowed'] }} />)
    await confirm(user, 'Delete webhook Order pending')
    expect(await screen.findByText('Not allowed')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete webhook Order pending' })))
  })

  it('Cancel keeps the focus on the delete button that asked', async () => {
    const user = userEvent.setup()
    render(<Shell />)
    await user.click(screen.getByRole('button', { name: 'Delete webhook New order' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete webhook New order' })))
  })
})

describe('Store details › Webhooks › leave guard (decision 4)', () => {
  const host = () => ({ register: vi.fn(() => () => {}), registerNested: vi.fn(() => () => {}), requestLeave: vi.fn() })
  const drawn = (leave) => render(
    <LeaveGuardContext.Provider value={leave}>
      <BusinessWebhooks business={STORE} />
    </LeaveGuardContext.Provider>
  )
  const event = () => screen.getByRole('combobox', { name: /^Event/ })
  const url = () => screen.getByLabelText(/^Url/)

  it('registers the add form in the nearest host: clean at first, dirty once a URL is typed, one change per filled field', async () => {
    const user = userEvent.setup()
    const leave = host()
    drawn(leave)
    expect(leave.register).toHaveBeenCalledTimes(1)
    const entry = leave.register.mock.calls[0][0]
    expect(entry.current.isDirty()).toBe(false)
    await user.type(url(), 'https://d.test/hook')
    expect(entry.current.isDirty()).toBe(true)
    expect(entry.current.count()).toBe(1)
    await user.selectOptions(event(), 'orders_rejected')
    expect(entry.current.count()).toBe(2)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Delay' }), '900')
    expect(entry.current.count()).toBe(3)
  })

  it('an event or a delay alone is also unsaved work', async () => {
    const user = userEvent.setup()
    const leave = host()
    drawn(leave)
    const entry = leave.register.mock.calls[0][0]
    await user.selectOptions(event(), 'orders_rejected')
    expect(entry.current.isDirty()).toBe(true)
    await user.selectOptions(event(), '')
    expect(entry.current.isDirty()).toBe(false)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Delay' }), '900')
    expect(entry.current.isDirty()).toBe(true)
  })

  it('Discard empties the three fields and the notices', async () => {
    const user = userEvent.setup()
    const leave = host()
    drawn(leave)
    const entry = leave.register.mock.calls[0][0]
    await user.selectOptions(event(), 'orders_rejected')
    await user.type(url(), 'https://d.test/hook')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Delay' }), '900')
    act(() => { entry.current.discard() })
    await waitFor(() => expect(url().value).toBe(''))
    expect(event().value).toBe('')
    expect(screen.getByRole('combobox', { name: 'Delay' }).value).toBe('')
    expect(entry.current.isDirty()).toBe(false)
  })

  it('Save adds what was typed and says it went through', async () => {
    const user = userEvent.setup()
    const leave = host()
    drawn(leave)
    const entry = leave.register.mock.calls[0][0]
    await user.selectOptions(event(), 'orders_rejected')
    await user.type(url(), 'https://d.test/hook')
    let result
    await act(async () => { result = await entry.current.save() })
    expect(probe.add).toHaveBeenCalledWith({ hook: 'orders_rejected', url: 'https://d.test/hook' })
    expect(result).toEqual({ ok: true })
  })

  it('Save answers { ok: false } when the form is not valid, shows what is missing and adds nothing', async () => {
    const user = userEvent.setup()
    const leave = host()
    drawn(leave)
    const entry = leave.register.mock.calls[0][0]
    await user.type(url(), 'https://d.test/hook')
    let result
    await act(async () => { result = await entry.current.save() })
    expect(result.ok).toBe(false)
    expect(probe.add).not.toHaveBeenCalled()
    expect(event().getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(event())
  })

  it('Save answers { ok: false } and says why when the API refuses, so the user stays', async () => {
    const user = userEvent.setup()
    probe.add = vi.fn().mockResolvedValue({ ok: false, error: ['Invalid url'] })
    const leave = host()
    drawn(leave)
    const entry = leave.register.mock.calls[0][0]
    await user.selectOptions(event(), 'orders_rejected')
    await user.type(url(), 'nope')
    let result
    await act(async () => { result = await entry.current.save() })
    expect(result).toEqual({ ok: false })
    expect(await screen.findByText('Invalid url')).toBeTruthy()
    expect(url().value).toBe('nope')
  })

  it('without a host it is a no-op', () => {
    render(<BusinessWebhooks business={STORE} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Webhooks' })).toBeTruthy()
  })
})

describe('Store details › Webhooks › add', () => {
  const event = () => screen.getByRole('combobox', { name: /^Event/ })
  const url = () => screen.getByLabelText(/^Url/)
  const add = () => screen.getByRole('button', { name: 'Add' })

  it('has a labelled event, URL and delay and an «Add» button', () => {
    render(<BusinessWebhooks business={STORE} />)
    expect(event().options[0].textContent).toBe('Select a hook')
    expect(event().options).toHaveLength(19)
    expect(url().getAttribute('type')).toBe('url')
    const delay = screen.getByRole('combobox', { name: 'Delay' })
    expect(delay.options[0].textContent).toBe('Select a delay')
    expect(delay.options).toHaveLength(8)
    expect(add().getAttribute('type')).toBe('submit')
  })

  // «Add» has no `disabled`; while it adds, a click on the busy button does not submit the form again.
  it('a click on «Add» while it adds does not submit the form', async () => {
    const user = userEvent.setup()
    probe.adding = true
    render(<BusinessWebhooks business={STORE} />)
    const submits = vi.fn()
    add().closest('form').addEventListener('submit', submits)
    expect(add()).toHaveAttribute('aria-busy', 'true')
    await user.dblClick(add())
    expect(submits).not.toHaveBeenCalled()
    expect(probe.add).not.toHaveBeenCalled()
  })

  it('needs an event and a URL, says which is missing and focuses the first', async () => {
    const user = userEvent.setup()
    render(<BusinessWebhooks business={STORE} />)
    await user.click(add())
    expect(probe.add).not.toHaveBeenCalled()
    expect(event().getAttribute('aria-invalid')).toBe('true')
    expect(url().getAttribute('aria-invalid')).toBe('true')
    expect(screen.getAllByText('Value is required')).toHaveLength(2)
    expect(document.activeElement).toBe(event())
  })

  it('asks for the URL alone when only the event is chosen, and focuses it', async () => {
    const user = userEvent.setup()
    render(<BusinessWebhooks business={STORE} />)
    await user.selectOptions(event(), 'orders_rejected')
    await user.click(add())
    expect(probe.add).not.toHaveBeenCalled()
    expect(event().getAttribute('aria-invalid')).toBeNull()
    expect(url().getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(url())
  })

  it('does not take a URL of blank spaces', async () => {
    const user = userEvent.setup()
    render(<BusinessWebhooks business={STORE} />)
    await user.selectOptions(event(), 'orders_rejected')
    await user.type(url(), '   ')
    await user.click(add())
    expect(probe.add).not.toHaveBeenCalled()
  })

  it('sends the event and the URL, with no delay when none was chosen, then clears the three fields', async () => {
    const user = userEvent.setup()
    render(<BusinessWebhooks business={STORE} />)
    await user.selectOptions(event(), 'orders_rejected')
    await user.type(url(), 'https://d.test/hook')
    await user.click(add())
    expect(probe.add).toHaveBeenCalledTimes(1)
    expect(probe.add).toHaveBeenCalledWith({ hook: 'orders_rejected', url: 'https://d.test/hook' })
    await waitFor(() => expect(url().value).toBe(''))
    expect(event().value).toBe('')
    expect(screen.getByRole('combobox', { name: 'Delay' }).value).toBe('')
  })

  it('sends the delay too when one was chosen', async () => {
    const user = userEvent.setup()
    render(<BusinessWebhooks business={STORE} />)
    await user.selectOptions(event(), 'orders_rejected')
    await user.type(url(), 'https://d.test/hook')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Delay' }), '900')
    await user.click(add())
    expect(probe.add).toHaveBeenCalledWith({ hook: 'orders_rejected', url: 'https://d.test/hook', delay: '900' })
  })

  it('does not check the URL format: main takes any non-empty value', async () => {
    const user = userEvent.setup()
    render(<BusinessWebhooks business={STORE} />)
    await user.selectOptions(event(), 'orders_rejected')
    await user.type(url(), 'not a url')
    await user.click(add())
    expect(probe.add).toHaveBeenCalledWith({ hook: 'orders_rejected', url: 'not a url' })
  })

  it('says why an add failed under the form and keeps what was typed', async () => {
    const user = userEvent.setup()
    probe.add = vi.fn().mockResolvedValue({ ok: false, error: ['Invalid url'] })
    render(<BusinessWebhooks business={STORE} />)
    await user.selectOptions(event(), 'orders_rejected')
    await user.type(url(), 'https://d.test/hook')
    await user.click(add())
    const notice = await screen.findByText('Invalid url')
    expect(notice.closest('[role="alert"]')).toBeTruthy()
    expect(url().value).toBe('https://d.test/hook')
    expect(event().value).toBe('orders_rejected')
  })

  it('says the generic reason when an add fails without a message', async () => {
    const user = userEvent.setup()
    probe.add = vi.fn().mockResolvedValue({ ok: false, error: [] })
    render(<BusinessWebhooks business={STORE} />)
    await user.selectOptions(event(), 'orders_rejected')
    await user.type(url(), 'https://d.test/hook')
    await user.click(add())
    expect(await screen.findByText('The webhook could not be added.')).toBeTruthy()
  })

  it('shows «Add» busy while adding', () => {
    probe.adding = true
    render(<BusinessWebhooks business={STORE} />)
    expect(add().getAttribute('aria-busy')).toBe('true')
  })
})
