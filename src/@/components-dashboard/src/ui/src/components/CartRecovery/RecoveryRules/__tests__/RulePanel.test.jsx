/* eslint-disable import/first */
// redesign RA-B3 (decisions 3, 4 and 6; M-RA6, M-RA7, M-RA12, M-RA15, M-RA16): the one panel of a rule. K/RecoveryActionDetail and
// K/RecoveryNotificationList are stubs that give the UI the state a test sets (and record what the panel passed them), so the wiring is
// what is under test; Shared/RichHtmlEditor is a controlled textarea stub (the real Tiptap editor has its own tests) and
// `channelLabel` (RA-B2) a stub with the contract's words. RecordPanel, Menu, AsyncSwitch, ConfirmDialog, Fields and the real helpers of
// C/utils/recoveryRules.js (RA-B1) are real. Nothing is ever sent.
import React, { useState } from 'react'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  isAddMode: false,
  recoveryActionState: null,
  actionState: { loading: false, error: null },
  controllerProps: null,
  controllerMounts: 0,
  handleSaveRule: null,
  handleCreateRule: null,
  handleDeleteRecoveryAction: null,
  notificationState: { loading: false, notifications: [], error: null },
  listProps: null,
  listMounts: 0,
  listHandlers: {}
}))

vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  const Controller = (props) => {
    const { UIComponent } = props
    React.useEffect(() => { mocks.controllerMounts += 1 }, [])
    mocks.controllerProps = props
    return (
      <UIComponent
        {...props}
        isAddMode={mocks.isAddMode}
        recoveryActionState={mocks.recoveryActionState}
        actionState={mocks.actionState}
        handleSaveRule={mocks.handleSaveRule}
        handleCreateRule={mocks.handleCreateRule}
        handleDeleteRecoveryAction={mocks.handleDeleteRecoveryAction}
      />
    )
  }
  const NotificationList = (props) => {
    const { UIComponent } = props
    React.useEffect(() => { mocks.listMounts += 1 }, [])
    mocks.listProps = props
    return (
      <UIComponent
        {...props}
        notificationListState={mocks.notificationState}
        {...mocks.listHandlers}
      />
    )
  }
  return {
    RecoveryActionDetail: Controller,
    RecoveryNotificationList: NotificationList,
    useLanguage: () => [{ dictionary: {}, language: { code: 'en' } }, (_key, text) => text],
    useUtils: () => [{ parsePrice: (value) => '$' + Number(value).toFixed(2) }]
  }
})
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ dictionary: {}, language: { code: 'en' } }, (_key, text) => text]
}))
// The SplitView is not mounted here; a test that needs the phone (mode `full`) sets what `useSplitView` answers
const split = vi.hoisted(() => ({ value: null }))
vi.mock('../../../Shared/Product/SplitView', async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, useSplitView: () => { const real = original.useSplitView(); return split.value ?? real } }
})
vi.mock('../channelLabel', () => ({
  channelLabel: (t, channel, { short } = {}) => (
    { email: t('EMAIL', 'Email'), sms: t('SMS', 'SMS'), notification: short ? t('RECOVERY_RULES_CHANNEL_PUSH_SHORT', 'Push') : t('PUSH_NOTIFICATION', 'Push notification') }[channel] ?? channel
  )
}))
vi.mock('../../../Shared/RichHtmlEditor', async () => {
  const React = await import('react')
  return {
    RichHtmlEditor: ({ label, value, onChange, invalid, describedBy }) => (
      <textarea
        data-testid='html-editor'
        aria-label='Email editor'
        data-label={label}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={describedBy}
        value={value ?? ''}
        onChange={event => onChange(event.target.value)}
      />
    )
  }
})

import { formatWait } from '../../../../../../utils/recoveryRules'
import { RulePanel } from '../RulePanel'

const theme = { images: { general: { mobileHalfMask: '/mask.png' } } }

const rule = { id: 7, name: 'Did something interrupt your order?', description: 'Hey! Looks like you left something', enabled: true, type: 'abandoned_cart', launch_type: 'times', times: [260] }
const email = { id: 1, channel: 'email', enabled: true, title: 'Email title', body: '<p>Hello</p>' }
const sms = { id: 2, channel: 'sms', enabled: false, title: 'SMS title', body: 'Text' }

let handlers

const Host = ({ action = rule, actionId = action?.id ?? null, ...props }) => {
  const [expanded, setExpanded] = useState(false)
  return (
    <ThemeProvider theme={theme}>
      <RulePanel
        action={action}
        actionId={actionId}
        expanded={expanded}
        onExpandedChange={setExpanded}
        onClose={handlers.onClose}
        onToggleRule={handlers.onToggleRule}
        confirmTurnOn={handlers.confirmTurnOn}
        onEditMessage={handlers.onEditMessage}
        onCreated={handlers.onCreated}
        onChannelsChange={handlers.onChannelsChange}
        onDirtyChange={handlers.onDirtyChange}
        {...props}
      />
    </ThemeProvider>
  )
}

const field = (name) => screen.getByRole('textbox', { name })

beforeEach(() => {
  mocks.isAddMode = false
  mocks.recoveryActionState = { action: rule, loading: false, error: null }
  mocks.actionState = { loading: false, error: null }
  mocks.controllerProps = null
  mocks.controllerMounts = 0
  mocks.handleSaveRule = vi.fn(async () => ({ ok: true }))
  mocks.handleCreateRule = vi.fn(async ({ rule: created }) => ({ ok: true, rule: { id: 99, ...created }, channel: {} }))
  mocks.handleDeleteRecoveryAction = vi.fn(async () => ({ ok: true }))
  mocks.notificationState = { loading: false, notifications: [email, sms], error: null }
  mocks.listProps = null
  mocks.listMounts = 0
  mocks.listHandlers = {
    handleUpdateClick: vi.fn(async () => ({ ok: true })),
    handleAddChannel: vi.fn(async () => ({ ok: true })),
    handleSaveChannel: vi.fn(async () => ({ ok: true })),
    handleDeleteChannel: vi.fn(async () => ({ ok: true })),
    reload: vi.fn()
  }
  handlers = {
    onClose: vi.fn(),
    onToggleRule: vi.fn(async () => ({ ok: true })),
    // redesign D-76 (owner, 2026-10-19): the page's question before a rule is turned on; here it says yes
    confirmTurnOn: vi.fn(async () => true),
    onEditMessage: vi.fn(),
    onCreated: vi.fn(),
    onChannelsChange: vi.fn(),
    onDirtyChange: vi.fn()
  }
})

afterEach(cleanup)

describe('RulePanel — a rule (view and edit, decision 3)', () => {
  it('is a RecordPanel titled with the rule, with When, Details and Messages in one column', () => {
    render(<Host />)
    expect(screen.getByRole('heading', { level: 2, name: rule.name })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'When' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Messages' })).toBeInTheDocument()
    expect(field('Name')).toHaveValue(rule.name)
    expect(field('Description')).toHaveValue(rule.description)
    expect(screen.getByRole('textbox', { name: 'Send after' })).toHaveValue('260')
    expect(screen.getByRole('button', { name: 'Seconds' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('mounts K/RecoveryActionDetail with the rule and the panel as its UIComponent', () => {
    render(<Host />)
    expect(mocks.controllerProps.action).toBe(rule)
    expect(mocks.controllerProps.actionId).toBe(7)
    expect(typeof mocks.controllerProps.UIComponent).toBe('function')
  })

  it('has «Save changes» disabled and no «Cancel» while nothing changed', () => {
    render(<Host />)
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
  })

  it('a change enables «Save changes» and shows «Cancel»; «Cancel» takes the change back', async () => {
    render(<Host />)
    const user = userEvent.setup()
    await user.type(field('Name'), '!')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(field('Name')).toHaveValue(rule.name)
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
  })

  it('saves ONLY what changed: the name', async () => {
    render(<Host />)
    const user = userEvent.setup()
    await user.clear(field('Name'))
    await user.type(field('Name'), 'New name')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(mocks.handleSaveRule).toHaveBeenCalledTimes(1)
    expect(mocks.handleSaveRule).toHaveBeenCalledWith({ name: 'New name' })
  })

  it('saves the wait as times: [n] in seconds, with nothing else', async () => {
    render(<Host />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Minutes' })) // 260 minutes
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(mocks.handleSaveRule).toHaveBeenCalledWith({ times: [15600], launch_type: 'times' })
  })

  it('saves the description alone, and an emptied description as an empty string', async () => {
    render(<Host />)
    const user = userEvent.setup()
    await user.clear(field('Description'))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(mocks.handleSaveRule).toHaveBeenCalledWith({ description: '' })
  })

  it('says why the wait changed, with the real formatter («Sends _new_ after instead of _old_»)', async () => {
    render(<Host />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Minutes' }))
    const reason = screen.getByText(/instead of/)
    expect(reason).toHaveTextContent(`Sends ${formatWait(15600, 'en')} after instead of ${formatWait(260, 'en')}`)
    expect(reason.querySelectorAll('.odc-figure')).toHaveLength(2)
  })

  it('does not give a wait reason when the wait did not change', async () => {
    render(<Host />)
    await userEvent.setup().type(field('Name'), '!')
    expect(screen.queryByText(/instead of/)).toBeNull()
  })

  // redesign (n.º 17, P-3): editing refuses a wait of 0 with the same rule and text as creating (main saved it: M-RA18)
  it('refuses a wait of 0 when editing, as creating does, and an empty one says to enter it', async () => {
    render(<Host />)
    const user = userEvent.setup()
    const amount = screen.getByRole('textbox', { name: 'Send after' })
    await user.clear(amount)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(mocks.handleSaveRule).not.toHaveBeenCalled()
    expect(screen.getByText('Enter how long to wait before sending.')).toBeInTheDocument()
    await user.type(amount, '0')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(mocks.handleSaveRule).not.toHaveBeenCalled()
    expect(screen.getByText('Wait at least 1 second.')).toBeInTheDocument()
    expect(screen.queryByText('Enter how long to wait before sending.')).toBeNull()
    expect(amount).toHaveFocus()
    await user.clear(amount)
    await user.type(amount, '5')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(mocks.handleSaveRule).toHaveBeenCalledWith({ times: [5], launch_type: 'times' })
  })

  it('does not save an empty name, and says so on the field', async () => {
    render(<Host />)
    const user = userEvent.setup()
    await user.clear(field('Name'))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(mocks.handleSaveRule).not.toHaveBeenCalled()
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(field('Name')).toHaveFocus()
  })

  it('a failed save says why in the footer (translated API text) and keeps the change', async () => {
    mocks.handleSaveRule = vi.fn(async () => ({ ok: false, error: ['Name already used'] }))
    render(<Host />)
    const user = userEvent.setup()
    await user.type(field('Name'), '!')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Name already used')).toBeInTheDocument()
    expect(field('Name')).toHaveValue(`${rule.name}!`)
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
  })

  it('a save that fails without text uses the fallback sentence', async () => {
    mocks.handleSaveRule = vi.fn(async () => ({ ok: false }))
    render(<Host />)
    const user = userEvent.setup()
    await user.type(field('Name'), '!')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText("We couldn't save this rule. Try again.")).toBeInTheDocument()
  })

  it('a thrown save is a failure too, and the button is usable again', async () => {
    mocks.handleSaveRule = vi.fn(async () => { throw new Error('Network down') })
    render(<Host />)
    const user = userEvent.setup()
    await user.type(field('Name'), '!')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Network down')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).not.toHaveAttribute('aria-busy', 'true')
  })

  it('does not save twice while it saves', async () => {
    let release
    mocks.handleSaveRule = vi.fn(() => new Promise(resolve => { release = () => resolve({ ok: true }) }))
    render(<Host />)
    const user = userEvent.setup()
    await user.type(field('Name'), '!')
    const save = screen.getByRole('button', { name: 'Save changes' })
    await user.click(save)
    await user.click(save)
    expect(mocks.handleSaveRule).toHaveBeenCalledTimes(1)
    await act(async () => { release() })
  })

  it('asks before it drops a change (the four texts of the discard guard)', async () => {
    render(<Host />)
    const user = userEvent.setup()
    await user.type(field('Name'), '!')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Discard your changes?')).toBeInTheDocument()
    expect(within(dialog).getByText('What you changed here is not saved yet.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Keep editing' })).toBeInTheDocument()
    expect(handlers.onClose).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }))
    expect(handlers.onClose).toHaveBeenCalledTimes(1)
  })

  it('closes straight away when nothing changed', async () => {
    render(<Host />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Close' }))
    expect(handlers.onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

// redesign R2-F1 (R1-01): the rule the panel shows is the latest of «the row of the list» and «what the controller loaded or saved»; a rule
// that left the list keeps a stale row that must not cover what was saved
describe('RulePanel — the record is the latest of the row and of what was saved (R1-01)', () => {
  const settle = (rerender, props) => act(async () => { rerender(<Host {...props} />) })

  it('after «Save changes» the title, the baseline and the button follow what was saved, though the row is the old one', async () => {
    const saved = { ...rule, name: 'Saved name' }
    mocks.handleSaveRule = vi.fn(async () => {
      mocks.recoveryActionState = { action: saved, loading: false, error: null }
      return { ok: true, error: null, rule: saved }
    })
    const { rerender } = render(<Host />)
    const user = userEvent.setup()
    await user.clear(field('Name'))
    await user.type(field('Name'), 'Saved name')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await settle(rerender)
    expect(screen.getByRole('heading', { level: 2, name: 'Saved name' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
    expect(handlers.onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('a wait that was saved becomes the baseline too (no wait reason, nothing left to save)', async () => {
    const saved = { ...rule, times: [900] }
    mocks.handleSaveRule = vi.fn(async () => {
      mocks.recoveryActionState = { action: saved, loading: false, error: null }
      return { ok: true, error: null, rule: saved }
    })
    const { rerender } = render(<Host />)
    const user = userEvent.setup()
    await user.clear(screen.getByRole('textbox', { name: 'Send after' }))
    await user.type(screen.getByRole('textbox', { name: 'Send after' }), '900')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await settle(rerender)
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    expect(screen.queryByText(/instead of/)).toBeNull()
  })

  it('what the controller loaded or saved later than the row wins: the header switch shows it', async () => {
    const { rerender } = render(<Host />)
    expect(screen.getByRole('switch', { name: rule.name })).toBeChecked()
    mocks.recoveryActionState = { action: { ...rule, enabled: false }, loading: false, error: null }
    await settle(rerender)
    expect(screen.getByRole('switch', { name: rule.name })).not.toBeChecked()
  })

  it('a row newer than what was loaded wins too (the page folds a saved record into the row it holds)', async () => {
    const { rerender } = render(<Host />)
    mocks.recoveryActionState = { action: { ...rule, name: 'Saved name' }, loading: false, error: null }
    await settle(rerender)
    await settle(rerender, { action: { ...rule, name: 'Saved name', enabled: false } })
    expect(screen.getByRole('switch', { name: 'Saved name' })).not.toBeChecked()
    expect(screen.getByRole('heading', { level: 2, name: 'Saved name' })).toBeInTheDocument()
  })
})

// redesign R2-F1 (R1-06): the page asks before it drops edits when another row or «New rule» is opened, so it must hear about them
describe('RulePanel — unsaved changes of a rule are reported (R1-06)', () => {
  it('true as soon as a field differs from the rule, false when the change is taken back or the panel goes away', async () => {
    const { unmount } = render(<Host />)
    expect(handlers.onDirtyChange).toHaveBeenLastCalledWith(false)
    const user = userEvent.setup()
    await user.type(field('Name'), '!')
    expect(handlers.onDirtyChange).toHaveBeenLastCalledWith(true)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(handlers.onDirtyChange).toHaveBeenLastCalledWith(false)
    await user.type(field('Name'), '!')
    expect(handlers.onDirtyChange).toHaveBeenLastCalledWith(true)
    unmount()
    expect(handlers.onDirtyChange).toHaveBeenLastCalledWith(false)
  })
})

describe('RulePanel — saving a wait (R1-10)', () => {
  it('a wait with no value shows its error and puts the focus on the wait field', async () => {
    render(<Host />)
    const user = userEvent.setup()
    const amount = screen.getByRole('textbox', { name: 'Send after' })
    await user.clear(amount)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(screen.getByText('Enter how long to wait before sending.')).toBeInTheDocument()
    expect(amount).toHaveFocus()
    expect(mocks.handleSaveRule).not.toHaveBeenCalled()
  })

  it('a changed name alone does not send launch_type', async () => {
    render(<Host />)
    await userEvent.setup().type(field('Name'), '!')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save changes' }))
    expect(mocks.handleSaveRule).toHaveBeenCalledWith({ name: `${rule.name}!` })
  })
})

describe('RulePanel — the header (decision 3)', () => {
  it('has the switch of the rule, checked from the row of the list, and it calls onToggleRule(rule, next)', async () => {
    render(<Host />)
    const toggle = screen.getByRole('switch', { name: rule.name })
    expect(toggle).toBeChecked()
    await userEvent.setup().click(toggle)
    expect(handlers.onToggleRule).toHaveBeenCalledTimes(1)
    expect(handlers.onToggleRule).toHaveBeenCalledWith(expect.objectContaining({ id: 7, enabled: true }), false)
  })

  // redesign D-76 (owner, 2026-10-19): turning the rule ON asks the page (confirmTurnOn) before onToggleRule; OFF stays immediate
  it('turning the rule on asks the page first with the rule, and calls onToggleRule only after a yes', async () => {
    let answer
    handlers.confirmTurnOn = vi.fn(() => new Promise(resolve => { answer = resolve }))
    render(<Host action={{ ...rule, enabled: false }} />)
    const toggle = screen.getByRole('switch', { name: rule.name })
    await userEvent.setup().click(toggle)
    expect(handlers.confirmTurnOn).toHaveBeenCalledTimes(1)
    expect(handlers.confirmTurnOn).toHaveBeenCalledWith(expect.objectContaining({ id: 7, name: rule.name, enabled: false }))
    // while the question is open the switch does not look flipped nor busy, and nothing is saved
    expect(handlers.onToggleRule).not.toHaveBeenCalled()
    expect(toggle).not.toBeChecked()
    expect(toggle).not.toHaveAttribute('aria-busy', 'true')
    await act(async () => { answer(true) })
    expect(handlers.onToggleRule).toHaveBeenCalledTimes(1)
    expect(handlers.onToggleRule).toHaveBeenCalledWith(expect.objectContaining({ id: 7, enabled: false }), true)
  })

  it('a no leaves the rule off: nothing is saved and the switch is where it was', async () => {
    handlers.confirmTurnOn = vi.fn(async () => false)
    render(<Host action={{ ...rule, enabled: false }} />)
    const toggle = screen.getByRole('switch', { name: rule.name })
    await userEvent.setup().click(toggle)
    expect(handlers.confirmTurnOn).toHaveBeenCalledTimes(1)
    expect(handlers.onToggleRule).not.toHaveBeenCalled()
    expect(toggle).not.toBeChecked()
    expect(toggle).not.toHaveAttribute('aria-busy', 'true')
  })

  it('turning the rule off never asks', async () => {
    render(<Host />)
    await userEvent.setup().click(screen.getByRole('switch', { name: rule.name }))
    expect(handlers.confirmTurnOn).not.toHaveBeenCalled()
    expect(handlers.onToggleRule).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }), false)
  })

  it('follows the row of the list when it changes (the list is the source)', () => {
    const { rerender } = render(<Host />)
    rerender(<Host action={{ ...rule, enabled: false }} />)
    expect(screen.getByRole('switch', { name: rule.name })).not.toBeChecked()
  })

  it('a refused toggle goes back and says why (M-RA3)', async () => {
    handlers.onToggleRule = vi.fn(async () => ({ ok: false, error: ['Cannot turn it on'] }))
    render(<Host />)
    const toggle = screen.getByRole('switch', { name: rule.name })
    await userEvent.setup().click(toggle)
    expect(await screen.findByText('Cannot turn it on')).toBeInTheDocument()
    expect(toggle).toBeChecked()
  })

  it('without onToggleRule it saves only `enabled` itself', async () => {
    render(<Host onToggleRule={undefined} />)
    await userEvent.setup().click(screen.getByRole('switch', { name: rule.name }))
    expect(mocks.handleSaveRule).toHaveBeenCalledWith({ enabled: false })
  })

  it('has «Open as page» that turns into «Back to split view»', async () => {
    render(<Host />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Open as page' }))
    expect(screen.getByRole('button', { name: 'Back to split view' })).toBeInTheDocument()
  })
})

describe('RulePanel — delete (M-RA6, M-RA7)', () => {
  const openDelete = async (user) => {
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    return screen.findByRole('alertdialog')
  }

  it('asks with the name, the consequence and a verb, with the focus on Cancel', async () => {
    render(<Host />)
    const dialog = await openDelete(userEvent.setup())
    expect(within(dialog).getByText(`Delete "${rule.name}"?`)).toBeInTheDocument()
    expect(within(dialog).getByText("Customers stop getting its messages. This can't be undone.")).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Delete rule' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(mocks.handleDeleteRecoveryAction).not.toHaveBeenCalled()
  })

  it('Cancel closes it without deleting', async () => {
    render(<Host />)
    const user = userEvent.setup()
    const dialog = await openDelete(user)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mocks.handleDeleteRecoveryAction).not.toHaveBeenCalled()
  })

  it('«Delete rule» deletes once', async () => {
    render(<Host />)
    const user = userEvent.setup()
    const dialog = await openDelete(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete rule' }))
    expect(mocks.handleDeleteRecoveryAction).toHaveBeenCalledTimes(1)
  })

  it('a refused delete says why in the panel (translated API text) and the dialog closes', async () => {
    mocks.handleDeleteRecoveryAction = vi.fn(async () => ({ ok: false, error: ['Rule is in use'] }))
    render(<Host />)
    const user = userEvent.setup()
    const dialog = await openDelete(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete rule' }))
    const notice = await screen.findByText('Rule is in use')
    expect(notice.closest('[data-tone="danger"]')).not.toBeNull()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(handlers.onClose).not.toHaveBeenCalled()
  })

  it('a delete that fails without text uses the fallback sentence', async () => {
    mocks.handleDeleteRecoveryAction = vi.fn(async () => ({ ok: false }))
    render(<Host />)
    const user = userEvent.setup()
    const dialog = await openDelete(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete rule' }))
    expect(await screen.findByText("We couldn't delete this rule. Try again.")).toBeInTheDocument()
  })
})

describe('RulePanel — Messages, connected to K/RecoveryNotificationList', () => {
  it('mounts the notification controller for the rule and draws its messages', () => {
    render(<Host />)
    expect(mocks.listProps.action).toEqual(expect.objectContaining({ id: 7 }))
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('switch', { name: 'Email' })).toBeChecked()
  })

  it('keeps the SAME rule object for the controller when the row changes (it would ask the API again)', () => {
    const { rerender } = render(<Host />)
    const first = mocks.listProps.action
    rerender(<Host action={{ ...rule, enabled: false, name: 'Renamed' }} />)
    expect(mocks.listProps.action).toBe(first)
    expect(mocks.listMounts).toBe(1)
  })

  it('mounts it again for another rule', () => {
    const { rerender } = render(<Host />)
    rerender(<Host action={{ ...rule, id: 8 }} />)
    expect(mocks.listProps.action).toEqual(expect.objectContaining({ id: 8 }))
  })

  it('passes onChannelsChange to the controller (the page connects it to setRuleChannels)', () => {
    render(<Host />)
    expect(mocks.listProps.onChannelsChange).toBe(handlers.onChannelsChange)
  })

  it('a message switch calls handleUpdateClick(id, { enabled })', async () => {
    render(<Host />)
    await userEvent.setup().click(screen.getByRole('switch', { name: 'SMS' }))
    expect(mocks.listHandlers.handleUpdateClick).toHaveBeenCalledWith(2, { enabled: true })
  })

  it('«Edit» asks the page for the dialog: onEditMessage({ mode: edit, rule, channel })', async () => {
    render(<Host />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Edit Email message' }))
    expect(handlers.onEditMessage).toHaveBeenCalledTimes(1)
    const call = handlers.onEditMessage.mock.calls[0][0]
    expect(call.mode).toBe('edit')
    expect(call.channel).toBe(email)
    expect(call.rule).toEqual(expect.objectContaining({ id: 7, name: rule.name }))
  })

  it('«Add message» asks for it in add mode, without a channel', async () => {
    render(<Host />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add message' }))
    const call = handlers.onEditMessage.mock.calls[0][0]
    expect(call.mode).toBe('add')
    expect(call.channel).toBeNull()
    expect(call.rule).toEqual(expect.objectContaining({ id: 7 }))
  })

  it('hands the page the channel actions, which always call the LATEST handlers of the controller', async () => {
    const channelActionsRef = React.createRef()
    const { rerender } = render(<Host channelActionsRef={channelActionsRef} />)
    expect(channelActionsRef.current).toEqual({
      add: expect.any(Function),
      save: expect.any(Function),
      remove: expect.any(Function),
      reload: expect.any(Function)
    })
    const first = channelActionsRef.current
    const newer = vi.fn(async () => ({ ok: true }))
    mocks.listHandlers = { ...mocks.listHandlers, handleSaveChannel: newer }
    rerender(<Host channelActionsRef={channelActionsRef} />)
    expect(channelActionsRef.current).toBe(first) // stable
    await channelActionsRef.current.save(2, { title: 'T', body: 'B' })
    expect(newer).toHaveBeenCalledWith(2, { title: 'T', body: 'B' })
    await channelActionsRef.current.add({ channel: 'sms', title: 'T', body: 'B', enabled: true })
    expect(mocks.listHandlers.handleAddChannel).toHaveBeenCalledWith({ channel: 'sms', title: 'T', body: 'B', enabled: true })
    await channelActionsRef.current.remove(2)
    expect(mocks.listHandlers.handleDeleteChannel).toHaveBeenCalledWith(2)
  })

  it('the same actions travel in the payload of onEditMessage', async () => {
    render(<Host />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Edit Email message' }))
    const { channelActions } = handlers.onEditMessage.mock.calls[0][0]
    await channelActions.remove(1)
    expect(mocks.listHandlers.handleDeleteChannel).toHaveBeenCalledWith(1)
  })

  it('clears the channel actions when the panel goes away', () => {
    const channelActionsRef = React.createRef()
    const { unmount } = render(<Host channelActionsRef={channelActionsRef} />)
    expect(channelActionsRef.current).not.toBeNull()
    unmount()
    expect(channelActionsRef.current).toBeNull()
  })

  it('a failed load of the messages is the section\'s notice with «Retry» → reload (M-RA16)', async () => {
    mocks.notificationState = { loading: false, notifications: [], error: ['Boom'] }
    render(<Host />)
    const notice = screen.getByRole('alert')
    expect(notice).toHaveTextContent('Boom')
    await userEvent.setup().click(within(notice).getByRole('button', { name: 'Retry' }))
    expect(mocks.listHandlers.reload).toHaveBeenCalledTimes(1)
  })

  describe('initialSection', () => {
    let scroll
    beforeEach(() => {
      scroll = vi.fn()
      Element.prototype.scrollIntoView = scroll
    })
    afterEach(() => { delete Element.prototype.scrollIntoView })

    it('«messages» scrolls the panel to Messages once the rule is loaded', async () => {
      render(<Host initialSection='messages' />)
      await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1))
      expect(scroll.mock.instances[0]).toContainElement(screen.getByRole('heading', { name: 'Messages' }))
    })

    it('does not scroll without it, and does not scroll again on a re-render', async () => {
      const { rerender } = render(<Host />)
      expect(scroll).not.toHaveBeenCalled()
      cleanup()
      const second = render(<Host initialSection='messages' />)
      await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1))
      second.rerender(<Host initialSection='messages' action={{ ...rule, enabled: false }} />)
      expect(scroll).toHaveBeenCalledTimes(1)
      expect(rerender).toBeDefined()
    })

    // redesign R2-F1 (R1-09): at mount the messages are still loading and the panel has nothing to scroll; it scrolls when they arrive
    it('waits for the messages: no scroll while they load, one scroll when they have arrived', async () => {
      mocks.notificationState = { loading: true, notifications: [], error: null }
      const { rerender } = render(<Host initialSection='messages' />)
      expect(scroll).not.toHaveBeenCalled()
      mocks.notificationState = { loading: false, notifications: [email, sms], error: null }
      rerender(<Host initialSection='messages' />)
      await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1))
      expect(scroll.mock.instances[0]).toContainElement(screen.getByRole('heading', { name: 'Messages' }))
      rerender(<Host initialSection='messages' action={{ ...rule, enabled: false }} />)
      expect(scroll).toHaveBeenCalledTimes(1)
    })

    it('a rule with no messages scrolls too, once its load has finished', async () => {
      mocks.notificationState = { loading: true, notifications: [], error: null }
      const { rerender } = render(<Host initialSection='messages' />)
      mocks.notificationState = { loading: false, notifications: [], error: null }
      rerender(<Host initialSection='messages' />)
      await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1))
    })

    it('waits for the rule: no scroll while it loads', async () => {
      mocks.recoveryActionState = { action: undefined, loading: true, error: null }
      render(<Host action={{}} actionId={7} initialSection='messages' />)
      expect(scroll).not.toHaveBeenCalled()
    })
  })
})

describe('RulePanel — loading and failing (M-RA15)', () => {
  it('draws a skeleton in a busy region while it loads a rule it only knows by id', () => {
    mocks.recoveryActionState = { action: undefined, loading: true, error: null }
    render(<Host action={{}} actionId={7} />)
    expect(screen.getByRole('status', { name: 'Loading' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull()
  })

  it('a failed load is an error state with «Retry» and «Close», with the API text', async () => {
    mocks.recoveryActionState = { action: undefined, loading: false, error: ['Not found'] }
    render(<Host action={{}} actionId={77} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't load this rule.")
    expect(alert).toHaveTextContent('Not found')
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull()
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Close' }))
    expect(handlers.onClose).toHaveBeenCalledTimes(1)
  })

  it('«Retry» mounts the controller again, which asks the API again', async () => {
    mocks.recoveryActionState = { action: undefined, loading: false, error: ['Not found'] }
    render(<Host action={{}} actionId={77} />)
    expect(mocks.controllerMounts).toBe(1)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    expect(mocks.controllerMounts).toBe(2)
  })

  it('a rule already known by the list opens at once, without waiting for the fetch', () => {
    mocks.recoveryActionState = { action: rule, loading: true, error: null }
    render(<Host />)
    expect(field('Name')).toHaveValue(rule.name)
  })
})

describe('RulePanel — Results of a rule', () => {
  const ready = { loading: false, error: null, sent_count: 1200, recovered_count: 0, recovered_total: 345.5 }
  const section = () => screen.getByRole('heading', { name: 'Results' }).closest('section')
  const help = 'A cart counts as recovered when it became an order after this rule wrote to the customer.'

  it('is the first section of the editor and shows the three figures with their labels', () => {
    const { container } = render(<Host stats={ready} onRetryStats={vi.fn()} />)
    const headings = Array.from(container.querySelectorAll('.odc-ra-section-title')).map(node => node.textContent)
    expect(headings.slice(0, 3)).toEqual(['Results', 'When', 'Details'])
    const results = within(section())
    expect(results.getByText('Sent').closest('div')).toHaveTextContent('1,200')
    expect(results.getByText('Recovered').closest('div')).toHaveTextContent(/^Recovered0$/)
    expect(results.getByText('Revenue recovered').closest('div')).toHaveTextContent('$345.50')
    expect(results.getByText(help)).toBeInTheDocument()
  })

  it('shows skeletons with a screen-reader text while loading', () => {
    render(<Host stats={{ loading: true, error: null }} onRetryStats={vi.fn()} />)
    expect(within(section()).getAllByText('Loading results')).toHaveLength(3)
    expect(within(section()).getByText(help)).toBeInTheDocument()
  })

  it('says the results could not be loaded and Retry calls the prop', async () => {
    const onRetryStats = vi.fn()
    render(<Host stats={{ loading: false, error: ['x'] }} onRetryStats={onRetryStats} />)
    expect(within(section()).getByText("We couldn't load the results of this rule.")).toBeInTheDocument()
    await userEvent.click(within(section()).getByRole('button', { name: 'Retry' }))
    expect(onRetryStats).toHaveBeenCalledTimes(1)
  })

  it('shows dashes when the rule has no entry (nobody asked yet)', () => {
    render(<Host />)
    expect(within(section()).getAllByText('—')).toHaveLength(3)
    expect(within(section()).queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('the create form has no Results section', () => {
    mocks.isAddMode = true
    mocks.recoveryActionState = { action: undefined, loading: false, error: null }
    render(<Host action={{}} actionId={null} stats={ready} />)
    expect(screen.queryByRole('heading', { name: 'Results' })).toBeNull()
  })
})

describe('RulePanel — a new rule (decision 6)', () => {
  beforeEach(() => {
    mocks.isAddMode = true
    mocks.recoveryActionState = { action: undefined, loading: false, error: null }
  })

  const addProps = { action: {}, actionId: null }
  const fillRule = async (user, { name = 'QA come back', minutes = '30' } = {}) => {
    await user.type(field('Name'), name)
    await user.click(screen.getByRole('button', { name: 'Minutes' }))
    await user.type(screen.getByRole('textbox', { name: 'Send after' }), minutes)
  }
  // redesign D-76 (owner, 2026-10-19): «Create rule» in the footer asks first; the confirm button of the dialog has the same name
  const pressCreate = async (user) => {
    await user.click(screen.getByRole('button', { name: 'Create rule' }))
    return screen.findByRole('alertdialog')
  }
  const createRule = async (user) => {
    const dialog = await pressCreate(user)
    await user.click(within(dialog).getByRole('button', { name: 'Create rule' }))
  }
  const fillSms = async (user, { title = 'Your cart is waiting', body = 'Finish your order today.' } = {}) => {
    await user.click(screen.getByRole('button', { name: 'SMS' }))
    await user.type(field('Title'), title)
    await user.type(field('Message'), body)
  }

  it('is titled «New rule», with Details, When and the first message, and no switch, menu or Messages section', () => {
    render(<Host {...addProps} />)
    expect(screen.getByRole('heading', { level: 2, name: 'New rule' })).toBeInTheDocument()
    expect(field('Name')).toHaveValue('')
    expect(field('Description')).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Send after' })).toHaveValue('')
    expect(screen.getByRole('group', { name: 'Channel' })).toBeInTheDocument()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Messages' })).toBeNull()
    expect(mocks.listMounts).toBe(0)
  })

  it('starts with NO channel chosen, and offers the three of the contract', () => {
    render(<Host {...addProps} />)
    for (const name of ['Email', 'SMS', 'Push notification']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('says it starts sending as soon as it is created, and has «Cancel» and «Create rule»', () => {
    render(<Host {...addProps} />)
    expect(screen.getByText('Starts sending as soon as you create it.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create rule' })).toBeEnabled()
  })

  // redesign D-76 (owner, 2026-10-19): the rule is created switched on, so «Create rule» asks before the controller is called
  it('asks before creating: the name, the consequence and a verb, with the focus on Cancel, and nothing is created yet', async () => {
    render(<Host {...addProps} />)
    const user = userEvent.setup()
    await fillRule(user, { name: '  QA come back ' })
    await fillSms(user)
    const dialog = await pressCreate(user)
    expect(within(dialog).getByText('Create QA come back and start sending?')).toBeInTheDocument()
    expect(within(dialog).getByText('Customers who leave a cart start getting its messages.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Create rule' })).toHaveAttribute('data-variant', 'primary') // tone 'primary', not the danger red
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(mocks.handleCreateRule).not.toHaveBeenCalled()
    expect(handlers.onCreated).not.toHaveBeenCalled()
  })

  it('a name that is already a question does not double the mark in the question', async () => {
    render(<Host {...addProps} />)
    const user = userEvent.setup()
    await fillRule(user, { name: 'Forgot something?' })
    await fillSms(user)
    const dialog = await pressCreate(user)
    expect(within(dialog).getByText('Create Forgot something and start sending?')).toBeInTheDocument()
  })

  it('does not ask while the form has a problem: the in-line errors come first', async () => {
    render(<Host {...addProps} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Create rule' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(mocks.handleCreateRule).not.toHaveBeenCalled()
  })

  it('Cancel writes nothing and leaves the form as it was, ready to ask again', async () => {
    render(<Host {...addProps} />)
    const user = userEvent.setup()
    await fillRule(user)
    await fillSms(user)
    const dialog = await pressCreate(user)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mocks.handleCreateRule).not.toHaveBeenCalled()
    expect(handlers.onCreated).not.toHaveBeenCalled()
    expect(field('Name')).toHaveValue('QA come back')
    expect(field('Title')).toHaveValue('Your cart is waiting')
    expect(screen.getByRole('button', { name: 'Create rule' })).not.toHaveAttribute('aria-busy', 'true')
    await createRule(user)
    expect(mocks.handleCreateRule).toHaveBeenCalledTimes(1)
  })

  it('Escape is a no too', async () => {
    render(<Host {...addProps} />)
    const user = userEvent.setup()
    await fillRule(user)
    await fillSms(user)
    await pressCreate(user)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(mocks.handleCreateRule).not.toHaveBeenCalled()
    expect(field('Name')).toHaveValue('QA come back')
  })

  it('validates in line on the press: every missing thing has its error, and the focus goes to the first (M-RA12)', async () => {
    render(<Host {...addProps} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Create rule' }))
    expect(mocks.handleCreateRule).not.toHaveBeenCalled()
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Enter how long to wait before sending.')).toBeInTheDocument()
    expect(screen.getByText('Choose a channel')).toBeInTheDocument()
    expect(field('Name')).toHaveFocus()
    expect(field('Name')).toHaveAttribute('aria-invalid', 'true')
  })

  it('a wait of 0 is refused when creating (and when editing too)', async () => {
    render(<Host {...addProps} />)
    const user = userEvent.setup()
    await user.type(field('Name'), 'Rule')
    await user.type(screen.getByRole('textbox', { name: 'Send after' }), '0')
    await user.click(screen.getByRole('button', { name: 'Create rule' }))
    expect(screen.getByText('Wait at least 1 second.')).toBeInTheDocument()
    expect(screen.queryByText('Enter how long to wait before sending.')).toBeNull()
    expect(mocks.handleCreateRule).not.toHaveBeenCalled()
  })

  it('an empty wait says to enter it (not «at least 1 second»)', async () => {
    render(<Host {...addProps} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Create rule' }))
    expect(screen.getByText('Enter how long to wait before sending.')).toBeInTheDocument()
  })

  it('once the person has tried, the errors follow what they type (and the first one to be fixed gets no stale message)', async () => {
    render(<Host {...addProps} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Create rule' }))
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    await user.type(field('Name'), 'Rule')
    expect(screen.queryByText('Name is required')).toBeNull()
  })

  it('needs a title and a message for the chosen channel (the focus moves to the first missing one)', async () => {
    render(<Host {...addProps} />)
    const user = userEvent.setup()
    await fillRule(user)
    await user.click(screen.getByRole('button', { name: 'SMS' }))
    await user.click(screen.getByRole('button', { name: 'Create rule' }))
    expect(mocks.handleCreateRule).not.toHaveBeenCalled()
    expect(screen.getAllByText('This field is required')).toHaveLength(2)
    expect(field('Title')).toHaveFocus()
  })

  it('creates: handleCreateRule({ rule, channel }) with the wait in seconds as times: [n], rule ON by the controller', async () => {
    render(<Host {...addProps} />)
    const user = userEvent.setup()
    await fillRule(user)
    await fillSms(user)
    await createRule(user)
    expect(mocks.handleCreateRule).toHaveBeenCalledTimes(1)
    expect(mocks.handleCreateRule).toHaveBeenCalledWith({
      rule: { name: 'QA come back', description: '', times: [1800] },
      channel: { channel: 'sms', title: 'Your cart is waiting', body: 'Finish your order today.' }
    })
  })

  it('success: onCreated(rule), with nothing else', async () => {
    render(<Host {...addProps} />)
    const user = userEvent.setup()
    await fillRule(user)
    await fillSms(user)
    await createRule(user)
    await waitFor(() => expect(handlers.onCreated).toHaveBeenCalledTimes(1))
    expect(handlers.onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 99, name: 'QA come back' }))
    expect(handlers.onCreated.mock.calls[0]).toHaveLength(1)
  })

  it('the channel failed: the rule exists, onCreated(rule, { pendingMessage }) with the values and the error', async () => {
    mocks.handleCreateRule = vi.fn(async ({ rule: created }) => ({ ok: false, stage: 'channel', rule: { id: 99, ...created }, error: ['SMS is not set up'] }))
    render(<Host {...addProps} />)
    const user = userEvent.setup()
    await fillRule(user)
    await fillSms(user)
    await createRule(user)
    await waitFor(() => expect(handlers.onCreated).toHaveBeenCalledTimes(1))
    expect(handlers.onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: 99 }),
      { pendingMessage: { channel: 'sms', title: 'Your cart is waiting', body: 'Finish your order today.', error: ['SMS is not set up'] } }
    )
  })

  it('the rule failed: a danger notice in the footer with the API text, the form stays as it was, and a retry is possible', async () => {
    mocks.handleCreateRule = vi.fn(async () => ({ ok: false, stage: 'rule', error: ['Name already used'] }))
    render(<Host {...addProps} />)
    const user = userEvent.setup()
    await fillRule(user)
    await fillSms(user)
    await createRule(user)
    const notice = (await screen.findByText('Name already used')).closest('[data-tone="danger"]')
    expect(notice).not.toBeNull()
    expect(handlers.onCreated).not.toHaveBeenCalled()
    expect(field('Name')).toHaveValue('QA come back')
    await createRule(user)
    expect(mocks.handleCreateRule).toHaveBeenCalledTimes(2)
  })

  it('a rule failure without text uses the fallback sentence', async () => {
    mocks.handleCreateRule = vi.fn(async () => ({ ok: false, stage: 'rule' }))
    render(<Host {...addProps} />)
    const user = userEvent.setup()
    await fillRule(user)
    await fillSms(user)
    await createRule(user)
    expect(await screen.findByText("We couldn't create this rule. Try again.")).toBeInTheDocument()
  })

  it('does not create twice while it creates', async () => {
    let release
    mocks.handleCreateRule = vi.fn(() => new Promise(resolve => { release = () => resolve({ ok: true, rule: { id: 99 } }) }))
    render(<Host {...addProps} />)
    const user = userEvent.setup()
    await fillRule(user)
    await fillSms(user)
    await createRule(user)
    await user.click(screen.getByRole('button', { name: 'Create rule' }))
    expect(mocks.handleCreateRule).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull() // pressing it while it creates does not ask again
    await act(async () => { release() })
  })

  it('email uses the HTML editor (by file, as main does) and sends its HTML', async () => {
    render(<Host {...addProps} />)
    const user = userEvent.setup()
    await fillRule(user)
    await user.click(screen.getByRole('button', { name: 'Email' }))
    expect(screen.getByTestId('html-editor')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Message' })).toBeNull()
    await user.type(field('Title'), 'Hello')
    await user.type(screen.getByTestId('html-editor'), '<p>Hi</p>')
    await createRule(user)
    expect(mocks.handleCreateRule).toHaveBeenCalledWith(expect.objectContaining({
      channel: { channel: 'email', title: 'Hello', body: '<p>Hi</p>' }
    }))
  })

  it('an email whose body is only the empty paragraph of the editor is an empty message', async () => {
    render(<Host {...addProps} />)
    const user = userEvent.setup()
    await fillRule(user)
    await user.click(screen.getByRole('button', { name: 'Email' }))
    await user.type(field('Title'), 'Hello')
    await user.type(screen.getByTestId('html-editor'), '<p><br></p>')
    await user.click(screen.getByRole('button', { name: 'Create rule' }))
    expect(mocks.handleCreateRule).not.toHaveBeenCalled()
    expect(screen.getByText('This field is required')).toBeInTheDocument()
  })

  it('an email whose editor emits an empty string is an empty message, and the editor is told it is invalid', async () => {
    render(<Host {...addProps} />)
    const user = userEvent.setup()
    await fillRule(user)
    await user.click(screen.getByRole('button', { name: 'Email' }))
    await user.type(field('Title'), 'Hello')
    const editorField = screen.getByTestId('html-editor')
    expect(editorField).toHaveAttribute('data-label', 'Message')
    expect(editorField).not.toHaveAttribute('aria-invalid')
    await user.type(editorField, 'x')
    await user.clear(editorField) // the editor emits '' for an empty document
    await user.click(screen.getByRole('button', { name: 'Create rule' }))
    expect(mocks.handleCreateRule).not.toHaveBeenCalled()
    expect(screen.getByTestId('html-editor')).toHaveAttribute('aria-invalid', 'true')
    const describedBy = screen.getByTestId('html-editor').getAttribute('aria-describedby')
    expect(document.getElementById(describedBy)).toHaveTextContent('This field is required')
  })

  it('the editor shows the body of the form (controlled): switching channel and back gives an empty editor, not the old email', async () => {
    render(<Host {...addProps} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Email' }))
    await user.type(screen.getByTestId('html-editor'), 'Old email')
    expect(screen.getByTestId('html-editor')).toHaveValue('Old email')
    await user.click(screen.getByRole('button', { name: 'SMS' }))
    await user.click(screen.getByRole('button', { name: 'Email' }))
    expect(screen.getByTestId('html-editor')).toHaveValue('')
  })

  it('an email that is only an image is a message', async () => {
    render(<Host {...addProps} />)
    const user = userEvent.setup()
    await fillRule(user)
    await user.click(screen.getByRole('button', { name: 'Email' }))
    await user.type(field('Title'), 'Hello')
    await user.type(screen.getByTestId('html-editor'), '<p><img src="x.png"></p>')
    await createRule(user)
    expect(mocks.handleCreateRule).toHaveBeenCalledTimes(1)
  })

  it('changing the channel empties the message, as main does (HTML is not text)', async () => {
    render(<Host {...addProps} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'SMS' }))
    await user.type(field('Message'), 'Some text')
    await user.click(screen.getByRole('button', { name: 'Push notification' }))
    expect(field('Message')).toHaveValue('')
  })

  it('shows the facsimile live once a channel is chosen, and not before', async () => {
    render(<Host {...addProps} />)
    expect(screen.queryByRole('figure')).toBeNull()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'SMS' }))
    await user.type(field('Title'), 'Live title')
    const figure = screen.getByRole('figure', { name: 'Preview' })
    expect(figure).toHaveAttribute('data-channel', 'sms')
    expect(within(figure).getByText('Live title')).toBeInTheDocument()
    await user.type(field('Message'), 'Live body')
    expect(figure).toHaveTextContent('Live body')
  })

  it('reports its dirty state: true as soon as anything has a value, false when it leaves', async () => {
    const { unmount } = render(<Host {...addProps} />)
    expect(handlers.onDirtyChange).toHaveBeenLastCalledWith(false)
    await userEvent.setup().type(field('Name'), 'R')
    expect(handlers.onDirtyChange).toHaveBeenLastCalledWith(true)
    unmount()
    expect(handlers.onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  it('«Cancel» of a clean form closes at once; of a dirty one it asks first (the discard guard)', async () => {
    render(<Host {...addProps} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(handlers.onClose).toHaveBeenCalledTimes(1)
    handlers.onClose.mockClear()
    await user.type(field('Name'), 'R')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(handlers.onClose).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }))
    expect(handlers.onClose).toHaveBeenCalledTimes(1)
  })

  it('has «Open as page» but not the menu', () => {
    render(<Host {...addProps} />)
    expect(screen.getByRole('button', { name: 'Open as page' })).toBeInTheDocument()
  })

  it('is the form from the FIRST frame even if the controller has not flipped isAddMode yet (no skeleton flash)', () => {
    mocks.isAddMode = false
    render(<Host {...addProps} />)
    expect(screen.getByRole('heading', { level: 2, name: 'New rule' })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull()
  })
})

describe('RulePanel — on a phone (the SplitView is full)', () => {
  beforeEach(() => {
    split.value = { mode: 'full', open: true, expanded: false, onClose: () => {}, requestClose: () => {}, registerCloseGuard: () => () => {}, getEscapedField: () => null }
  })
  afterEach(() => { split.value = null })

  it('a rule says «Back» instead of «Close», and has no «Open as page»', async () => {
    render(<Host />)
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open as page' })).toBeNull()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Back' }))
    expect(handlers.onClose).toHaveBeenCalledTimes(1)
  })

  it('a new rule says «Back» too, and keeps the discard guard', async () => {
    mocks.isAddMode = true
    render(<Host action={{}} actionId={null} />)
    const user = userEvent.setup()
    await user.type(field('Name'), 'R')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(handlers.onClose).not.toHaveBeenCalled()
  })

  it('a failed load says «Back» as well', () => {
    mocks.recoveryActionState = { action: undefined, loading: false, error: ['Not found'] }
    render(<Host action={{}} actionId={77} />)
    expect(screen.getAllByRole('button', { name: 'Back' }).length).toBeGreaterThan(0)
  })
})
