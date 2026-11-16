/* eslint-disable import/first */
// redesign DL-B2 (decision 4; M-DL3): the three switches of a driver (enabled, available, busy) are immediate unless the host asks
// for the confirmation of deactivating (`confirmDeactivate`, the drivers list and, n.º 26, the managers list with `managers`);
// redesign D-1 (owner, 2026-10-19, decision 25 C8): with it, `enabled: false` asks first in a ConfirmDialog; none moves
// until the API says ok; a failure opens an alert and the switch (controlled by the row) stays where it was. The controllers
// (`handleChangeActiveUser`, `handleChangeAvailable`, `handleChangeBusyUser`) resolve `{ ok, error }` (DL-B1), mocked here.
// The Product Switch and AlertDialog are real.
import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))

import { Switch } from '../../../Shared/Product'
import { useDriverToggles } from '../useDriverToggles'

const ana = { id: 7, name: 'Ana', lastname: 'Ruiz', enabled: true, available: true, busy: true }
const marco = { id: 8, name: 'Marco', lastname: 'Toss', enabled: false, available: false, busy: false }

const ATTRIBUTES = ['enabled', 'available', 'busy']

// The host: three switches per driver, each controlled by the row (the list does not move one until the controller says so)
const Host = ({ users = [ana, marco], handlers = {}, onUpdated, confirmDeactivate, managers }) => {
  const { onToggle, pendingKeys, dialogs } = useDriverToggles({ ...handlers, onUpdated, confirmDeactivate, managers })
  return (
    <>
      {users.map(user => ATTRIBUTES.map(attribute => (
        <Switch
          key={`${user.id}:${attribute}`}
          checked={!!user[attribute]}
          busy={pendingKeys.includes(`${user.id}:${attribute}`)}
          onCheckedChange={next => onToggle(user, attribute, next)}
        >
          {`${user.name} ${attribute}`}
        </Switch>
      )))}
      <output data-testid='pending'>{pendingKeys.join(',')}</output>
      {dialogs}
    </>
  )
}

// `hidden`: while a modal dialog is open the page behind it is inert and out of the accessibility tree
const toggle = name => screen.getByRole('switch', { name, hidden: true })
const deferred = () => {
  let settle
  const promise = new Promise(resolve => { settle = resolve })
  return { promise, resolve: settle }
}
const okHandlers = () => ({
  handleChangeActiveUser: vi.fn().mockResolvedValue({ ok: true, error: null }),
  handleChangeAvailable: vi.fn().mockResolvedValue({ ok: true, error: null }),
  handleChangeBusyUser: vi.fn().mockResolvedValue({ ok: true, error: null })
})

afterEach(() => document.getElementById('app-modals')?.remove())

describe('useDriverToggles: immediate calls', () => {
  // redesign D-1: without `confirmDeactivate` (as in `main`) Active is immediate both ways
  it('without confirmDeactivate, Active goes to handleChangeActiveUser({ id, enabled }), on and off, with no confirmation', async () => {
    const handlers = okHandlers()
    render(<Host handlers={handlers} />)
    await userEvent.click(toggle('Marco enabled'))
    expect(handlers.handleChangeActiveUser).toHaveBeenLastCalledWith({ id: 8, enabled: true })
    await userEvent.click(toggle('Ana enabled'))
    expect(handlers.handleChangeActiveUser).toHaveBeenLastCalledWith({ id: 7, enabled: false })
    expect(handlers.handleChangeActiveUser).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('Online goes to handleChangeAvailable({ id, available }) at once', async () => {
    const handlers = okHandlers()
    render(<Host handlers={handlers} />)
    await userEvent.click(toggle('Ana available'))
    expect(handlers.handleChangeAvailable).toHaveBeenCalledWith({ id: 7, available: false })
    await userEvent.click(toggle('Marco available'))
    expect(handlers.handleChangeAvailable).toHaveBeenLastCalledWith({ id: 8, available: true })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('Busy goes to handleChangeBusyUser({ id, busy }) at once; turning it off releases the driver', async () => {
    const handlers = okHandlers()
    render(<Host handlers={handlers} />)
    await userEvent.click(toggle('Ana busy'))
    expect(handlers.handleChangeBusyUser).toHaveBeenCalledWith({ id: 7, busy: false })
    expect(handlers.handleChangeActiveUser).not.toHaveBeenCalled()
    expect(handlers.handleChangeAvailable).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('ignores a call with no user and an unknown attribute', async () => {
    const handlers = okHandlers()
    let api
    const Probe = () => {
      api = useDriverToggles(handlers)
      return null
    }
    render(<Probe />)
    await act(async () => { api.onToggle(null, 'enabled', true) })
    await act(async () => { api.onToggle(ana, 'nonsense', true) })
    expect(handlers.handleChangeActiveUser).not.toHaveBeenCalled()
    expect(handlers.handleChangeAvailable).not.toHaveBeenCalled()
    expect(handlers.handleChangeBusyUser).not.toHaveBeenCalled()
    expect(api.pendingKeys).toEqual([])
  })
})

// redesign D-1 (owner, 2026-10-19, decision 25 C8): deactivating a driver asks first; the rest stays immediate
describe('useDriverToggles: confirmDeactivate', () => {
  const dialogOf = () => screen.findByRole('alertdialog')

  it('deactivating asks first: title with the name, one-sentence body, «Deactivate driver», initial focus on Cancel, nothing called', async () => {
    const handlers = okHandlers()
    render(<Host handlers={handlers} confirmDeactivate />)
    await userEvent.click(toggle('Ana enabled'))
    const dialog = await dialogOf()
    expect(handlers.handleChangeActiveUser).not.toHaveBeenCalled()
    expect(within(dialog).getByText('Deactivate Ana Ruiz?')).toBeInTheDocument()
    expect(within(dialog).getByText('The account becomes inactive. You can activate it again at any time.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Deactivate driver' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(toggle('Ana enabled')).toHaveAttribute('aria-checked', 'true')
  })

  // redesign (n.º 26, D-86): the managers list asks too, with its own button text
  it('with managers, the button says «Deactivate driver manager» and only it calls the controller; activating stays immediate', async () => {
    const handlers = okHandlers()
    render(<Host handlers={handlers} confirmDeactivate managers />)
    await userEvent.click(toggle('Marco enabled'))
    expect(handlers.handleChangeActiveUser).toHaveBeenLastCalledWith({ id: 8, enabled: true })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await userEvent.click(toggle('Ana enabled'))
    const dialog = await dialogOf()
    expect(handlers.handleChangeActiveUser).toHaveBeenCalledTimes(1)
    expect(within(dialog).queryByRole('button', { name: 'Deactivate driver' })).toBeNull()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate driver manager' }))
    expect(handlers.handleChangeActiveUser).toHaveBeenLastCalledWith({ id: 7, enabled: false })
  })

  it('«Deactivate driver» is the only thing that calls the controller with enabled false, and onUpdated hears it', async () => {
    const handlers = okHandlers()
    const onUpdated = vi.fn()
    render(<Host handlers={handlers} onUpdated={onUpdated} confirmDeactivate />)
    await userEvent.click(toggle('Ana enabled'))
    await userEvent.click(within(await dialogOf()).getByRole('button', { name: 'Deactivate driver' }))
    expect(handlers.handleChangeActiveUser).toHaveBeenCalledTimes(1)
    expect(handlers.handleChangeActiveUser).toHaveBeenCalledWith({ id: 7, enabled: false })
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(7, { enabled: false }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('Cancel writes nothing and the switch stays on', async () => {
    const handlers = okHandlers()
    const onUpdated = vi.fn()
    render(<Host handlers={handlers} onUpdated={onUpdated} confirmDeactivate />)
    await userEvent.click(toggle('Ana enabled'))
    await userEvent.click(within(await dialogOf()).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(handlers.handleChangeActiveUser).not.toHaveBeenCalled()
    expect(onUpdated).not.toHaveBeenCalled()
    expect(toggle('Ana enabled')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('pending')).toHaveTextContent('')
  })

  it('activating, Online and Busy stay immediate', async () => {
    const handlers = okHandlers()
    render(<Host handlers={handlers} confirmDeactivate />)
    await userEvent.click(toggle('Marco enabled'))
    expect(handlers.handleChangeActiveUser).toHaveBeenLastCalledWith({ id: 8, enabled: true })
    await userEvent.click(toggle('Ana available'))
    expect(handlers.handleChangeAvailable).toHaveBeenCalledWith({ id: 7, available: false })
    await userEvent.click(toggle('Ana busy'))
    expect(handlers.handleChangeBusyUser).toHaveBeenCalledWith({ id: 7, busy: false })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('a failure after confirming opens the status alert and the switch stays on', async () => {
    const handlers = { ...okHandlers(), handleChangeActiveUser: vi.fn().mockResolvedValue({ ok: false, error: ['Has active orders'] }) }
    render(<Host handlers={handlers} confirmDeactivate />)
    await userEvent.click(toggle('Ana enabled'))
    await userEvent.click(within(await dialogOf()).getByRole('button', { name: 'Deactivate driver' }))
    expect(await screen.findByText('Has active orders')).toBeInTheDocument()
    expect(toggle('Ana enabled')).toHaveAttribute('aria-checked', 'true')
  })

  it('a driver with no name is asked about by «No name»', async () => {
    render(<Host users={[{ id: 9, name: '', enabled: true }]} handlers={okHandlers()} confirmDeactivate />)
    await userEvent.click(toggle('enabled'))
    expect(within(await dialogOf()).getByText('Deactivate No name?')).toBeInTheDocument()
  })
})

describe('useDriverToggles: never optimistic', () => {
  it('a failure ({ ok: false, error }) opens the alert with the API messages, flattened, and the switch keeps its value', async () => {
    const handlers = { ...okHandlers(), handleChangeAvailable: vi.fn().mockResolvedValue({ ok: false, error: [['Not allowed'], 'Try later'] }) }
    const onUpdated = vi.fn()
    render(<Host handlers={handlers} onUpdated={onUpdated} />)
    await userEvent.click(toggle('Ana available'))
    const alert = await screen.findByRole('alertdialog')
    expect(within(alert).getByText("The status didn't change")).toBeInTheDocument()
    expect(within(alert).getByText('Not allowed')).toBeInTheDocument()
    expect(within(alert).getByText('Try later')).toBeInTheDocument()
    expect(toggle('Ana available')).toHaveAttribute('aria-checked', 'true')
    expect(onUpdated).not.toHaveBeenCalled()
    await userEvent.click(within(alert).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('a failure with no message says «Something went wrong. Try again.»; so does a controller that throws', async () => {
    const handlers = {
      ...okHandlers(),
      handleChangeActiveUser: vi.fn()
        .mockResolvedValueOnce({ ok: false, error: null })
        .mockRejectedValueOnce(new Error('network'))
    }
    render(<Host handlers={handlers} />)
    await userEvent.click(toggle('Marco enabled'))
    let alert = await screen.findByRole('alertdialog')
    expect(within(alert).getByText('Something went wrong. Try again.')).toBeInTheDocument()
    await userEvent.click(within(alert).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())

    await userEvent.click(toggle('Marco enabled'))
    alert = await screen.findByRole('alertdialog')
    expect(within(alert).getByText("The status didn't change")).toBeInTheDocument()
    expect(within(alert).getByText('Something went wrong. Try again.')).toBeInTheDocument()
    expect(toggle('Marco enabled')).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByTestId('pending')).toHaveTextContent('')
  })

  it('a failed Busy release leaves the switch on', async () => {
    const handlers = { ...okHandlers(), handleChangeBusyUser: vi.fn().mockResolvedValue({ ok: false, error: ['Has active orders'] }) }
    render(<Host handlers={handlers} />)
    await userEvent.click(toggle('Ana busy'))
    expect(await screen.findByText('Has active orders')).toBeInTheDocument()
    expect(toggle('Ana busy')).toHaveAttribute('aria-checked', 'true')
  })
})

describe('useDriverToggles: pending keys', () => {
  it('the key «id:attribute» is pending while the call runs, the switch is busy, and a second press on it is ignored', async () => {
    const pending = deferred()
    const handlers = { ...okHandlers(), handleChangeAvailable: vi.fn().mockReturnValue(pending.promise) }
    render(<Host handlers={handlers} />)
    expect(screen.getByTestId('pending')).toHaveTextContent('')
    await userEvent.click(toggle('Marco available'))
    expect(screen.getByTestId('pending')).toHaveTextContent('8:available')
    expect(toggle('Marco available')).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(toggle('Marco available'))
    expect(handlers.handleChangeAvailable).toHaveBeenCalledTimes(1)
    await act(async () => { pending.resolve({ ok: true, error: null }) })
    expect(screen.getByTestId('pending')).toHaveTextContent('')
    expect(toggle('Marco available')).not.toHaveAttribute('aria-busy')
  })

  it('the guard is synchronous: two presses before the render still make one call', async () => {
    const pending = deferred()
    const handlers = { ...okHandlers(), handleChangeBusyUser: vi.fn().mockReturnValue(pending.promise) }
    let api
    const Probe = () => {
      api = useDriverToggles(handlers)
      return null
    }
    render(<Probe />)
    await act(async () => {
      api.onToggle(ana, 'busy', false)
      api.onToggle(ana, 'busy', false)
    })
    expect(handlers.handleChangeBusyUser).toHaveBeenCalledTimes(1)
    await act(async () => { pending.resolve({ ok: true, error: null }) })
  })

  it('another switch of the same driver, or the same one of another driver, is not blocked', async () => {
    const pending = deferred()
    const handlers = { ...okHandlers(), handleChangeAvailable: vi.fn().mockReturnValue(pending.promise) }
    render(<Host handlers={handlers} />)
    await userEvent.click(toggle('Ana available'))
    await userEvent.click(toggle('Ana enabled'))
    await userEvent.click(toggle('Marco available'))
    expect(handlers.handleChangeActiveUser).toHaveBeenCalledTimes(1)
    expect(handlers.handleChangeAvailable).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('pending')).toHaveTextContent('7:available')
    expect(screen.getByTestId('pending')).toHaveTextContent('8:available')
    await act(async () => { pending.resolve({ ok: true, error: null }) })
  })

  it('the key frees after a failure, so the person can try again', async () => {
    const handlers = {
      ...okHandlers(),
      handleChangeAvailable: vi.fn()
        .mockResolvedValueOnce({ ok: false, error: ['No'] })
        .mockResolvedValueOnce({ ok: true, error: null })
    }
    render(<Host handlers={handlers} />)
    await userEvent.click(toggle('Marco available'))
    const alert = await screen.findByRole('alertdialog')
    await userEvent.click(within(alert).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await userEvent.click(toggle('Marco available'))
    expect(handlers.handleChangeAvailable).toHaveBeenCalledTimes(2)
  })
})

describe('useDriverToggles: onUpdated', () => {
  it('fires after an ok with the driver id and only the attribute that changed', async () => {
    const handlers = okHandlers()
    const onUpdated = vi.fn()
    render(<Host handlers={handlers} onUpdated={onUpdated} />)
    await userEvent.click(toggle('Marco available'))
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(8, { available: true }))
    await userEvent.click(toggle('Ana busy'))
    await waitFor(() => expect(onUpdated).toHaveBeenLastCalledWith(7, { busy: false }))
    await userEvent.click(toggle('Ana enabled'))
    await waitFor(() => expect(onUpdated).toHaveBeenLastCalledWith(7, { enabled: false }))
    expect(onUpdated).toHaveBeenCalledTimes(3)
  })

  // the controllers resolve `{ ok, error, user }`; the page hears the state the API returned, not the one asked for
  it.each([
    ['enabled', 'Ana enabled', 'handleChangeActiveUser', 7, true],
    ['available', 'Marco available', 'handleChangeAvailable', 8, false],
    ['busy', 'Ana busy', 'handleChangeBusyUser', 7, true]
  ])('announces %s as the API returned it, even when it is not what was asked', async (attribute, name, route, id, returned) => {
    const handlers = { ...okHandlers(), [route]: vi.fn().mockResolvedValue({ ok: true, error: null, user: { id, [attribute]: returned } }) }
    const onUpdated = vi.fn()
    render(<Host handlers={handlers} onUpdated={onUpdated} />)
    await userEvent.click(toggle(name))
    expect(handlers[route]).toHaveBeenCalledWith({ id, [attribute]: !returned })
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(id, { [attribute]: returned }))
    expect(onUpdated).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it.each([
    ['no user', { ok: true, error: null }],
    ['a user without the attribute', { ok: true, error: null, user: { id: 8 } }],
    ['an attribute that is not a boolean', { ok: true, error: null, user: { id: 8, available: null } }],
    ['a user that is not an object', { ok: true, error: null, user: 'ok' }]
  ])('falls back to what was asked when the API returns %s', async (_case, outcome) => {
    const handlers = { ...okHandlers(), handleChangeAvailable: vi.fn().mockResolvedValue(outcome) }
    const onUpdated = vi.fn()
    render(<Host handlers={handlers} onUpdated={onUpdated} />)
    await userEvent.click(toggle('Marco available'))
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(8, { available: true }))
  })

  it('waits for the API: nothing is announced while the call is in flight', async () => {
    const pending = deferred()
    const handlers = { ...okHandlers(), handleChangeActiveUser: vi.fn().mockReturnValue(pending.promise) }
    const onUpdated = vi.fn()
    render(<Host handlers={handlers} onUpdated={onUpdated} />)
    await userEvent.click(toggle('Marco enabled'))
    expect(onUpdated).not.toHaveBeenCalled()
    await act(async () => { pending.resolve({ ok: true, error: null }) })
    expect(onUpdated).toHaveBeenCalledWith(8, { enabled: true })
  })

  it('a controller that resolves nothing (today\'s one) counts as done: no alert, onUpdated fires', async () => {
    const handlers = { ...okHandlers(), handleChangeBusyUser: vi.fn().mockResolvedValue(undefined) }
    const onUpdated = vi.fn()
    render(<Host handlers={handlers} onUpdated={onUpdated} />)
    await userEvent.click(toggle('Ana busy'))
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(7, { busy: false }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByTestId('pending')).toHaveTextContent('')
  })

  it('works without onUpdated', async () => {
    const handlers = okHandlers()
    render(<Host handlers={handlers} />)
    await userEvent.click(toggle('Marco enabled'))
    await waitFor(() => expect(screen.getByTestId('pending')).toHaveTextContent(''))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('survives unmount: a call that settles after the host is gone sets no state and does not throw', async () => {
    const pending = deferred()
    const handlers = { ...okHandlers(), handleChangeAvailable: vi.fn().mockReturnValue(pending.promise) }
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = render(<Host handlers={handlers} />)
    await userEvent.click(toggle('Marco available'))
    unmount()
    await act(async () => { pending.resolve({ ok: false, error: ['late'] }) })
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })
})
