/* eslint-disable import/first */
// redesign CA-B4 (decision 2; defect M-CA6, owner proposal P-1): the switch of a dynamic campaign.
// redesign D-6 (owner, 2026-10-19): turning it ON asks first (it starts sending to whoever matches, and messages can't be
// unsent); turning it OFF stays immediate.
// `handleUpdateCampaign` is the contract of CA-B1 (resolves `{ ok, error }`), mocked here. The Product Switch and AlertDialog are real.
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

import { AlertDialog, Switch } from '../../../Shared/Product'
import { useCampaignEnabledToggle } from '../useCampaignEnabledToggle'

const weekend = { id: 1, name: 'Weekend offer', enabled: true }
const winback = { id: 2, name: 'Win-back', enabled: false }

// The host: a switch per campaign controlled by `campaign.enabled` (the list does not move it until the controller says so)
// and the alert the hook asks for.
const Host = ({ campaigns = [weekend, winback], handleUpdateCampaign }) => {
  const { setEnabled, pendingIds, alert, dialog } = useCampaignEnabledToggle({ handleUpdateCampaign })
  return (
    <>
      {dialog}
      {campaigns.map(campaign => (
        <Switch
          key={campaign.id}
          checked={!!campaign.enabled}
          busy={pendingIds.includes(campaign.id)}
          onCheckedChange={next => setEnabled(campaign, next)}
        >
          {`${campaign.name} status`}
        </Switch>
      ))}
      <output data-testid='pending'>{pendingIds.join(',')}</output>
      <AlertDialog
        open={!!alert}
        title={alert?.title ?? ''}
        content={alert?.content ?? []}
        closeLabel='Close'
        confirmLabel='OK'
        onClose={() => alert?.close()}
      />
    </>
  )
}

const confirmation = () => screen.findByRole('alertdialog', { name: /^Activate / })
// turns a campaign ON: the press, then the confirmation
const turnOn = async (name) => {
  await userEvent.click(control(name))
  const dialog = await confirmation()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Activate campaign' }))
}
const control = name => screen.getByRole('switch', { name, hidden: true })
const deferred = () => {
  let settle
  const promise = new Promise(resolve => { settle = resolve })
  return { promise, resolve: settle }
}

afterEach(() => document.getElementById('app-modals')?.remove())

describe('useCampaignEnabledToggle', () => {
  it('turning a campaign OFF calls the controller at once, with its id and the new value, and no dialog', async () => {
    const handle = vi.fn().mockResolvedValue({ ok: true, error: null })
    render(<Host handleUpdateCampaign={handle} />)
    await userEvent.click(control('Weekend offer status'))
    expect(handle).toHaveBeenCalledWith(1, { enabled: false })
    expect(handle).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('turning a campaign ON asks first and writes nothing until the person confirms', async () => {
    const handle = vi.fn().mockResolvedValue({ ok: true, error: null })
    render(<Host handleUpdateCampaign={handle} />)
    await userEvent.click(control('Win-back status'))
    const dialog = await confirmation()
    expect(within(dialog).getByText('Activate "Win-back"?')).toBeInTheDocument()
    expect(within(dialog).getByText("It starts sending to the customers who match its rules. Sent messages can't be undone.")).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()) // initial focus is on Cancel
    expect(handle).not.toHaveBeenCalled()
    expect(screen.getByTestId('pending')).toHaveTextContent('')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Activate campaign' }))
    expect(handle).toHaveBeenCalledWith(2, { enabled: true })
    expect(handle).toHaveBeenCalledTimes(1)
  })

  it('Cancel (and Close) write nothing and leave the switch where it was', async () => {
    const handle = vi.fn().mockResolvedValue({ ok: true, error: null })
    render(<Host handleUpdateCampaign={handle} />)
    await userEvent.click(control('Win-back status'))
    await userEvent.click(within(await confirmation()).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await userEvent.click(control('Win-back status'))
    await userEvent.click(within(await confirmation()).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(handle).not.toHaveBeenCalled()
    expect(control('Win-back status')).not.toBeChecked()
    expect(screen.getByTestId('pending')).toHaveTextContent('')
  })

  it('a campaign with no rules says it goes to all the customers; a nameless one is «this campaign»', async () => {
    const handle = vi.fn().mockResolvedValue({ ok: true, error: null })
    render(<Host handleUpdateCampaign={handle} campaigns={[{ id: 3, name: '  ', enabled: false, conditions: [] }]} />)
    await userEvent.click(control('status'))
    const dialog = await confirmation()
    expect(within(dialog).getByText('Activate this campaign?')).toBeInTheDocument()
    expect(within(dialog).getByText("This campaign has no rules: it starts sending to all your customers. Sent messages can't be undone.")).toBeInTheDocument()
  })

  it('the id is pending while the call is in flight and clears when it settles', async () => {
    const call = deferred()
    const handle = vi.fn().mockReturnValue(call.promise)
    render(<Host handleUpdateCampaign={handle} />)
    await turnOn('Win-back status')
    expect(screen.getByTestId('pending')).toHaveTextContent('2')
    expect(control('Win-back status')).toHaveAttribute('aria-busy', 'true')
    await act(async () => { call.resolve({ ok: true, error: null }) })
    expect(screen.getByTestId('pending')).toHaveTextContent('')
  })

  it('a second press while the first is in flight does not send a second request', async () => {
    const call = deferred()
    const handle = vi.fn().mockReturnValue(call.promise)
    render(<Host handleUpdateCampaign={handle} />)
    await turnOn('Win-back status')
    await userEvent.click(control('Win-back status')) // still in flight: no second request and no second confirmation
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(handle).toHaveBeenCalledTimes(1)
    await act(async () => { call.resolve({ ok: true, error: null }) })
  })

  it('a failure keeps the old value (the switch is controlled by campaign.enabled) and raises the alert with the reasons', async () => {
    const handle = vi.fn().mockResolvedValue({ ok: false, error: ['Not allowed', 'Try later'] })
    render(<Host handleUpdateCampaign={handle} />)
    await turnOn('Win-back status')
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText("We couldn't change the campaign")).toBeInTheDocument()
    expect(within(dialog).getByText('Not allowed')).toBeInTheDocument()
    expect(within(dialog).getByText('Try later')).toBeInTheDocument()
    expect(control('Win-back status')).not.toBeChecked()
    expect(screen.getByTestId('pending')).toHaveTextContent('')
  })

  it('a failure with no reason says the default sentence; a thrown error counts as a failure', async () => {
    const handle = vi.fn().mockResolvedValueOnce({ ok: false, error: null }).mockRejectedValueOnce(new Error('network'))
    render(<Host handleUpdateCampaign={handle} />)
    await turnOn('Win-back status')
    const first = await screen.findByRole('alertdialog')
    expect(within(first).getByText('Something went wrong. Try again.')).toBeInTheDocument()
    await userEvent.click(within(first).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await userEvent.click(control('Weekend offer status'))
    const second = await screen.findByRole('alertdialog')
    expect(within(second).getByText('Something went wrong. Try again.')).toBeInTheDocument()
    expect(control('Weekend offer status')).toBeChecked()
  })

  it('close() clears the alert', async () => {
    const handle = vi.fn().mockResolvedValue({ ok: false, error: 'Nope' })
    render(<Host handleUpdateCampaign={handle} />)
    await turnOn('Win-back status')
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('a controller that resolves nothing (a legacy one) counts as done: no alert', async () => {
    const handle = vi.fn().mockResolvedValue(undefined)
    render(<Host handleUpdateCampaign={handle} />)
    await turnOn('Win-back status')
    await waitFor(() => expect(screen.getByTestId('pending')).toHaveTextContent(''))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('renders nothing itself (its dialog is for the host to draw) and starts with no pending id and no alert', () => {
    let seen
    const Probe = () => {
      seen = useCampaignEnabledToggle({ handleUpdateCampaign: vi.fn() })
      return null
    }
    const { container } = render(<Probe />)
    expect(container).toBeEmptyDOMElement()
    expect(seen.pendingIds).toEqual([])
    expect(seen.alert).toBeNull()
    expect(typeof seen.setEnabled).toBe('function')
    expect(seen.dialog).toBeTruthy() // a node the host renders once
  })
})
