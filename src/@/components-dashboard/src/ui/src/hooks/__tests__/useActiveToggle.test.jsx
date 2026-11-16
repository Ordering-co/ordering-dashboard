/* eslint-disable import/first */
// redesign BO-B2 (a): the generic status switch. `confirmDeactivate: null` makes deactivating as immediate as activating; a
// `{ title, body, confirmLabel }` keeps the confirmation dialog of the customers; the alert texts come from the caller.
// The customers' own texts and flows stay covered by Users/CustomersDirectory/__tests__/useCustomerActiveToggle.test.jsx.
import React from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))

import { Switch } from '../../components/Shared/Product'
import { useActiveToggle } from '../useActiveToggle'

const ana = { id: 7, name: 'Ana', lastname: 'Ruiz', enabled: true }
const marco = { id: 8, name: 'Marco', lastname: 'Toss', enabled: false }

const owner = {
  failureTitle: "The owner's status didn't change",
  failureFallback: 'The owner could not be updated.'
}
const ask = {
  title: (user) => `Deactivate ${user?.name ?? ''}?`,
  body: 'They lose access until you activate them again.',
  confirmLabel: 'Deactivate owner'
}

// The host: a switch per user, controlled by `user.enabled` (the list does not move it until the controller says so)
const Host = ({ users = [ana, marco], ...options }) => {
  const { onToggleActive, pendingIds, dialogs } = useActiveToggle({ ...owner, ...options })
  return (
    <>
      {users.map(user => (
        <Switch
          key={user.id}
          checked={!!user.enabled}
          busy={pendingIds.includes(user.id)}
          onCheckedChange={next => onToggleActive(user, next)}
        >
          {`${user.name} status`}
        </Switch>
      ))}
      <output data-testid='pending'>{pendingIds.join(',')}</output>
      {dialogs}
    </>
  )
}

// `hidden`: while a modal dialog is open the page behind it is inert and out of the accessibility tree
const statusSwitch = name => screen.getByRole('switch', { name, hidden: true })
const deferred = () => {
  let settle
  const promise = new Promise(resolve => { settle = resolve })
  return { promise, resolve: settle }
}

afterEach(() => document.getElementById('app-modals')?.remove())

describe('useActiveToggle · confirmDeactivate: null', () => {
  it('turning a user off calls the controller at once, with no dialog', async () => {
    const handle = vi.fn().mockResolvedValue({ ok: true, error: null })
    render(<Host handleChangeActiveUser={handle} confirmDeactivate={null} />)
    await userEvent.click(statusSwitch('Ana status'))
    expect(handle).toHaveBeenCalledTimes(1)
    expect(handle).toHaveBeenCalledWith({ id: 7, enabled: false })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('turning a user on is just as immediate', async () => {
    const handle = vi.fn().mockResolvedValue({ ok: true, error: null })
    render(<Host handleChangeActiveUser={handle} confirmDeactivate={null} />)
    await userEvent.click(statusSwitch('Marco status'))
    expect(handle).toHaveBeenCalledWith({ id: 8, enabled: true })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('not passing the option at all is the same as null', async () => {
    const handle = vi.fn().mockResolvedValue({ ok: true, error: null })
    render(<Host handleChangeActiveUser={handle} />)
    await userEvent.click(statusSwitch('Ana status'))
    expect(handle).toHaveBeenCalledWith({ id: 7, enabled: false })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('a failure ({ ok: false, error: [\'Nope\'] }) opens the alert with «Nope» and the title of the caller; the switch keeps its value', async () => {
    const handle = vi.fn().mockResolvedValue({ ok: false, error: ['Nope'] })
    render(<Host handleChangeActiveUser={handle} confirmDeactivate={null} />)
    await userEvent.click(statusSwitch('Ana status'))
    const alert = await screen.findByRole('alertdialog')
    expect(within(alert).getByText("The owner's status didn't change")).toBeInTheDocument()
    expect(within(alert).getByText('Nope')).toBeInTheDocument()
    expect(statusSwitch('Ana status')).toHaveAttribute('aria-checked', 'true') // it does not lie
    await userEvent.click(within(alert).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('a failure with no message, or a controller that throws, says the fallback of the caller', async () => {
    const handle = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: null })
      .mockRejectedValueOnce(new Error('network'))
    render(<Host handleChangeActiveUser={handle} confirmDeactivate={null} />)
    await userEvent.click(statusSwitch('Marco status'))
    let alert = await screen.findByRole('alertdialog')
    expect(within(alert).getByText('The owner could not be updated.')).toBeInTheDocument()
    await userEvent.click(within(alert).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())

    await userEvent.click(statusSwitch('Marco status'))
    alert = await screen.findByRole('alertdialog')
    expect(within(alert).getByText('The owner could not be updated.')).toBeInTheDocument()
    expect(screen.getByTestId('pending')).toHaveTextContent('')
  })

  it('two presses in a row make one call: the id is pending until the controller answers', async () => {
    const pending = deferred()
    const handle = vi.fn().mockReturnValue(pending.promise)
    render(<Host handleChangeActiveUser={handle} confirmDeactivate={null} />)
    await userEvent.click(statusSwitch('Ana status'))
    expect(screen.getByTestId('pending')).toHaveTextContent('7')
    expect(statusSwitch('Ana status')).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(statusSwitch('Ana status'))
    expect(handle).toHaveBeenCalledTimes(1)
    await act(async () => { pending.resolve({ ok: true, error: null }) })
    expect(screen.getByTestId('pending')).toHaveTextContent('')
    expect(statusSwitch('Ana status')).not.toHaveAttribute('aria-busy')
  })

  it('a controller that resolves nothing counts as done, not as a failure', async () => {
    const handle = vi.fn().mockResolvedValue(undefined)
    render(<Host handleChangeActiveUser={handle} confirmDeactivate={null} />)
    await userEvent.click(statusSwitch('Ana status'))
    await waitFor(() => expect(screen.getByTestId('pending')).toHaveTextContent(''))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('useActiveToggle · with confirmDeactivate', () => {
  it('turning a user off calls nothing until confirmed: the dialog uses the caller\'s title, body and label, and focuses Cancel', async () => {
    const handle = vi.fn().mockResolvedValue({ ok: true, error: null })
    render(<Host handleChangeActiveUser={handle} confirmDeactivate={ask} />)
    await userEvent.click(statusSwitch('Ana status'))
    const dialog = await screen.findByRole('alertdialog')
    expect(handle).not.toHaveBeenCalled()
    expect(within(dialog).getByText('Deactivate Ana?')).toBeInTheDocument()
    expect(within(dialog).getByText('They lose access until you activate them again.')).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate owner' }))
    expect(handle).toHaveBeenCalledTimes(1)
    expect(handle).toHaveBeenCalledWith({ id: 7, enabled: false })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('turning a user on stays immediate even when deactivating asks', async () => {
    const handle = vi.fn().mockResolvedValue({ ok: true, error: null })
    render(<Host handleChangeActiveUser={handle} confirmDeactivate={ask} />)
    await userEvent.click(statusSwitch('Marco status'))
    expect(handle).toHaveBeenCalledWith({ id: 8, enabled: true })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})
