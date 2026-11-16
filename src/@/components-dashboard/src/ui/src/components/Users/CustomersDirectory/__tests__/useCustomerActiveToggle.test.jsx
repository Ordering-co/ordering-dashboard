/* eslint-disable import/first */
// redesign UC-B2 (decision 5 / decision 25 C8, defect M-10): activating is immediate; deactivating asks first; a failure of
// the API opens an alert and the switch (controlled by `user.enabled`) stays where it was. `handleChangeActiveUser` is the
// contract of UC-B1 (resolves `{ ok, error }`), mocked here. The Product dialogs and the Switch are real.
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
import { useCustomerActiveToggle } from '../useCustomerActiveToggle'

const ana = { id: 7, name: 'Ana', lastname: 'Ruiz', enabled: true }
const marco = { id: 8, name: 'Marco', lastname: 'Toss', enabled: false }

// The host: a switch per user, controlled by `user.enabled` (the list does not move it until the controller says so)
const Host = ({ users = [ana, marco], handleChangeActiveUser }) => {
  const { onToggleActive, pendingIds, dialogs } = useCustomerActiveToggle({ handleChangeActiveUser })
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

describe('useCustomerActiveToggle', () => {
  it('activating calls the controller at once, with no dialog', async () => {
    const handle = vi.fn().mockResolvedValue({ ok: true, error: null })
    render(<Host handleChangeActiveUser={handle} />)
    await userEvent.click(statusSwitch('Marco status'))
    expect(handle).toHaveBeenCalledTimes(1)
    expect(handle).toHaveBeenCalledWith({ id: 8, enabled: true })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('deactivating calls nothing until it is confirmed: the dialog names the customer, explains and focuses Cancel', async () => {
    const handle = vi.fn().mockResolvedValue({ ok: true, error: null })
    render(<Host handleChangeActiveUser={handle} />)
    await userEvent.click(statusSwitch('Ana status'))
    const dialog = await screen.findByRole('alertdialog')
    expect(handle).not.toHaveBeenCalled()
    expect(within(dialog).getByText('Deactivate Ana Ruiz?')).toBeInTheDocument()
    expect(within(dialog).getByText('The account becomes inactive. You can activate it again at any time.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Deactivate customer' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
  })

  it('«Deactivate customer» is the only thing that calls the controller with enabled false', async () => {
    const handle = vi.fn().mockResolvedValue({ ok: true, error: null })
    render(<Host handleChangeActiveUser={handle} />)
    await userEvent.click(statusSwitch('Ana status'))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Deactivate customer' }))
    expect(handle).toHaveBeenCalledTimes(1)
    expect(handle).toHaveBeenCalledWith({ id: 7, enabled: false })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('Cancel calls nothing and the switch stays on', async () => {
    const handle = vi.fn()
    render(<Host handleChangeActiveUser={handle} />)
    await userEvent.click(statusSwitch('Ana status'))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(handle).not.toHaveBeenCalled()
    expect(statusSwitch('Ana status')).toHaveAttribute('aria-checked', 'true')
  })

  it('Escape is a cancel too', async () => {
    const handle = vi.fn()
    render(<Host handleChangeActiveUser={handle} />)
    await userEvent.click(statusSwitch('Ana status'))
    await screen.findByRole('alertdialog')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(handle).not.toHaveBeenCalled()
  })

  it('a failure ({ ok: false, error }) opens the alert with the API messages and the switch keeps its old value', async () => {
    const handle = vi.fn().mockResolvedValue({ ok: false, error: ['Not allowed for this account'] })
    render(<Host handleChangeActiveUser={handle} />)
    await userEvent.click(statusSwitch('Marco status'))
    const alert = await screen.findByRole('alertdialog')
    expect(within(alert).getByText("The status didn't change")).toBeInTheDocument()
    expect(within(alert).getByText('Not allowed for this account')).toBeInTheDocument()
    expect(statusSwitch('Marco status')).toHaveAttribute('aria-checked', 'false') // M-10: it does not lie
    await userEvent.click(within(alert).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('a failure with no message says «Something went wrong. Try again.»; so does a controller that throws', async () => {
    const handle = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: null })
      .mockRejectedValueOnce(new Error('network'))
    render(<Host handleChangeActiveUser={handle} />)
    await userEvent.click(statusSwitch('Marco status'))
    let alert = await screen.findByRole('alertdialog')
    expect(within(alert).getByText('Something went wrong. Try again.')).toBeInTheDocument()
    await userEvent.click(within(alert).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())

    await userEvent.click(statusSwitch('Marco status'))
    alert = await screen.findByRole('alertdialog')
    expect(within(alert).getByText("The status didn't change")).toBeInTheDocument()
    expect(within(alert).getByText('Something went wrong. Try again.')).toBeInTheDocument()
    expect(screen.getByTestId('pending')).toHaveTextContent('')
  })

  it('a deactivation that fails after the confirmation opens the alert too', async () => {
    const handle = vi.fn().mockResolvedValue({ ok: false, error: ['Server said no'] })
    render(<Host handleChangeActiveUser={handle} />)
    await userEvent.click(statusSwitch('Ana status'))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Deactivate customer' }))
    await waitFor(() => expect(screen.getByText('Server said no')).toBeInTheDocument())
    expect(statusSwitch('Ana status')).toHaveAttribute('aria-checked', 'true')
  })

  it('the id is in pendingIds while the call runs, the switch is busy, and further presses are ignored', async () => {
    const pending = deferred()
    const handle = vi.fn().mockReturnValue(pending.promise)
    render(<Host handleChangeActiveUser={handle} />)
    expect(screen.getByTestId('pending')).toHaveTextContent('')
    await userEvent.click(statusSwitch('Marco status'))
    expect(screen.getByTestId('pending')).toHaveTextContent('8')
    expect(statusSwitch('Marco status')).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(statusSwitch('Marco status'))
    expect(handle).toHaveBeenCalledTimes(1)
    await act(async () => { pending.resolve({ ok: true, error: null }) })
    expect(screen.getByTestId('pending')).toHaveTextContent('')
    expect(statusSwitch('Marco status')).not.toHaveAttribute('aria-busy')
  })

  it('a controller that resolves nothing (today\'s one) counts as done, not as a failure', async () => {
    const handle = vi.fn().mockResolvedValue(undefined)
    render(<Host handleChangeActiveUser={handle} />)
    await userEvent.click(statusSwitch('Marco status'))
    await waitFor(() => expect(screen.getByTestId('pending')).toHaveTextContent(''))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})
