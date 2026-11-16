/* eslint-disable import/first */
// redesign RA-B4 (decision 5; M-RA7, M-RA9): the dialog of one message of a recovery rule. The real Product Dialog, ConfirmDialog,
// SegmentedControl, TextField, TextArea and the real channelLabel are under test. Simulated: the language (English, the fallback text),
// the HTML editor (Tiptap is not exercised here: a controlled textarea stands in and records its props) and the facsimile (RA-B3).
import React from 'react'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const editor = vi.hoisted(() => ({ props: null, mounts: 0 }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {}, language: { code: 'en' } }, (_key, text) => text]
}))

vi.mock('../../../Shared/RichHtmlEditor', async () => {
  const ReactModule = await vi.importActual('react')
  return {
    RichHtmlEditor: props => {
      editor.props = props
      ReactModule.useEffect(() => { editor.mounts += 1 }, [])
      return (
        <div data-testid='html-editor' data-body={props.value} data-invalid={props.invalid ? 'true' : 'false'} data-described-by={props.describedBy ?? ''}>
          <textarea
            aria-label='HTML editor'
            value={props.value ?? ''}
            onChange={event => props.onChange(event.target.value)}
          />
        </div>
      )
    }
  }
})

vi.mock('../MessagePreview', () => ({
  MessagePreview: ({ channel, title, body }) => (
    <figure data-testid='message-preview' data-channel={channel}>
      <span data-testid='preview-title'>{title}</span>
      <span data-testid='preview-body'>{body}</span>
    </figure>
  )
}))

import { RuleMessageDialog } from '../RuleMessageDialog'

const rule = { id: 31, name: 'Did something interrupt your order?' }
const emailChannel = { id: 7, channel: 'email', title: 'Your cart is waiting', body: '<p>Finish your order today.</p>', enabled: true }
const smsChannel = { id: 8, channel: 'sms', title: 'Cart', body: 'Finish your order', enabled: true }

beforeEach(() => {
  editor.props = null
  editor.mounts = 0
})

afterEach(() => {
  cleanup()
  document.getElementById('app-modals')?.remove()
})

const deferred = () => {
  let resolve
  const promise = new Promise(_resolve => { resolve = _resolve })
  return { promise, resolve }
}

const renderDialog = (props = {}) => {
  const onSave = props.onSave ?? vi.fn(async () => ({ ok: true }))
  const onDelete = props.onDelete ?? vi.fn(async () => ({ ok: true }))
  const onOpenChange = props.onOpenChange ?? vi.fn()
  const utils = render(
    <RuleMessageDialog
      open
      mode='add'
      rule={rule}
      onSave={onSave}
      onDelete={onDelete}
      onOpenChange={onOpenChange}
      {...props}
    />
  )
  return { ...utils, onSave, onDelete, onOpenChange }
}

const dialog = name => screen.findByRole('dialog', { name })
const channelButton = (popup, name) => within(popup).getByRole('button', { name })
const pressed = popup => ['Email', 'SMS', 'Push notification'].filter(name => channelButton(popup, name).getAttribute('aria-pressed') === 'true')

describe('RuleMessageDialog — add (decision 5)', () => {
  it('opens as «Add message» with the three channels, none chosen, a title, a message and no Delete', async () => {
    renderDialog()
    const popup = await dialog('Add message')
    expect(within(popup).getByRole('group', { name: 'Channel' })).toBeInTheDocument()
    expect(pressed(popup)).toEqual([])
    expect(within(popup).getByRole('textbox', { name: /^Title/ })).toHaveValue('')
    expect(within(popup).getByRole('textbox', { name: /^Message/ })).toHaveValue('')
    expect(within(popup).getByRole('button', { name: 'Add message' })).toBeInTheDocument()
    expect(within(popup).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(within(popup).queryByRole('button', { name: 'Delete message' })).not.toBeInTheDocument()
    expect(within(popup).getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('is a large Product dialog with the footer apart from the scrolling body (M-RA9)', async () => {
    renderDialog()
    const popup = await dialog('Add message')
    expect(popup).toHaveAttribute('data-size', 'lg')
    const body = popup.querySelector('.odc-overlay-body')
    const foot = popup.querySelector('.odc-overlay-foot')
    expect(body).not.toBeNull()
    expect(foot).not.toBeNull()
    expect(body.contains(foot)).toBe(false)
    expect(within(foot).getByRole('button', { name: 'Add message' })).toBeInTheDocument()
  })

  // redesign R2-F2 (R1-03): changing the channel empties the message, as main and the create form do (an email's HTML must not reach an SMS)
  it('shows the plain text area for SMS and Push notification and the HTML editor for Email, emptying the message at each change of channel', async () => {
    const user = userEvent.setup()
    renderDialog()
    const popup = await dialog('Add message')
    await user.click(channelButton(popup, 'SMS'))
    expect(within(popup).queryByTestId('html-editor')).not.toBeInTheDocument()
    await user.type(within(popup).getByRole('textbox', { name: /^Title/ }), 'Keep the title')
    await user.type(within(popup).getByRole('textbox', { name: /^Message/ }), 'Hello')

    await user.click(channelButton(popup, 'Email'))
    expect(within(popup).getByTestId('html-editor')).toHaveAttribute('data-body', '')
    expect(within(popup).queryByRole('textbox', { name: /^Message/ })).not.toBeInTheDocument()
    expect(within(popup).getByRole('textbox', { name: /^Title/ })).toHaveValue('Keep the title')

    act(() => editor.props.onChange('<p><b>Hello in bold</b></p>'))
    await user.click(channelButton(popup, 'SMS'))
    expect(within(popup).queryByTestId('html-editor')).not.toBeInTheDocument()
    expect(within(popup).getByRole('textbox', { name: /^Message/ })).toHaveValue('')

    await user.type(within(popup).getByRole('textbox', { name: /^Message/ }), 'Again')
    await user.click(channelButton(popup, 'Push notification'))
    expect(within(popup).getByRole('textbox', { name: /^Message/ })).toHaveValue('')
  })

  it('does not empty the message when the channel chosen is the one already chosen', async () => {
    const user = userEvent.setup()
    renderDialog()
    const popup = await dialog('Add message')
    await user.click(channelButton(popup, 'SMS'))
    await user.type(within(popup).getByRole('textbox', { name: /^Message/ }), 'Hello')
    await user.click(channelButton(popup, 'SMS'))
    expect(within(popup).queryByRole('textbox', { name: /^Message/ })).toHaveValue('Hello')
  })

  it('draws the facsimile live from the channel, the title and the message, and none before a channel is chosen', async () => {
    const user = userEvent.setup()
    renderDialog()
    const popup = await dialog('Add message')
    expect(within(popup).queryByTestId('message-preview')).not.toBeInTheDocument()

    await user.click(channelButton(popup, 'SMS'))
    await user.type(within(popup).getByRole('textbox', { name: /^Title/ }), 'Hi')
    await user.type(within(popup).getByRole('textbox', { name: /^Message/ }), 'Body')
    const preview = within(popup).getByTestId('message-preview')
    expect(preview).toHaveAttribute('data-channel', 'sms')
    expect(within(preview).getByTestId('preview-title')).toHaveTextContent('Hi')
    expect(within(preview).getByTestId('preview-body')).toHaveTextContent('Body')

    await user.click(channelButton(popup, 'Email'))
    expect(within(popup).getByTestId('message-preview')).toHaveAttribute('data-channel', 'email')
  })

  it('validates in line: channel, title and message each say what is missing, focus goes to the first, nothing is sent (M-RA12)', async () => {
    const user = userEvent.setup()
    const { onSave } = renderDialog()
    const popup = await dialog('Add message')
    await user.click(within(popup).getByRole('button', { name: 'Add message' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(within(popup).getByText('Choose a channel')).toBeInTheDocument()
    const alerts = within(popup).getAllByRole('alert').map(node => node.textContent)
    expect(alerts.filter(text => text === 'This field is required')).toHaveLength(2)
    expect(within(popup).getByRole('textbox', { name: /^Title/ })).toBeInvalid()
    expect(within(popup).getByRole('textbox', { name: /^Message/ })).toBeInvalid()
    await waitFor(() => expect(channelButton(popup, 'Email')).toHaveFocus())

    await user.click(channelButton(popup, 'SMS'))
    expect(within(popup).queryByText('Choose a channel')).not.toBeInTheDocument()
    await user.click(within(popup).getByRole('button', { name: 'Add message' }))
    await waitFor(() => expect(within(popup).getByRole('textbox', { name: /^Title/ })).toHaveFocus())
    await user.type(within(popup).getByRole('textbox', { name: /^Title/ }), 'Hi')
    await user.click(within(popup).getByRole('button', { name: 'Add message' }))
    await waitFor(() => expect(within(popup).getByRole('textbox', { name: /^Message/ })).toHaveFocus())
    expect(onSave).not.toHaveBeenCalled()
  })

  it('a title or a message of only spaces is empty; an empty editor («<p><br></p>») is empty; an image alone is a message', async () => {
    const user = userEvent.setup()
    const { onSave } = renderDialog()
    const popup = await dialog('Add message')
    await user.click(channelButton(popup, 'Email'))
    await user.type(within(popup).getByRole('textbox', { name: /^Title/ }), '   ')
    act(() => editor.props.onChange('<p><br></p>'))
    await user.click(within(popup).getByRole('button', { name: 'Add message' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(within(popup).getAllByText('This field is required')).toHaveLength(2)

    await user.clear(within(popup).getByRole('textbox', { name: /^Title/ }))
    await user.type(within(popup).getByRole('textbox', { name: /^Title/ }), 'Hi')
    act(() => editor.props.onChange('<p><img src="/a.png"></p>'))
    await user.click(within(popup).getByRole('button', { name: 'Add message' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ channel: 'email', title: 'Hi', body: '<p><img src="/a.png"></p>' }))
  })

  it('sends {channel, title, body}, shows Add message busy while it runs, and closes on success', async () => {
    const user = userEvent.setup()
    const gate = deferred()
    const onSave = vi.fn(() => gate.promise)
    const { onOpenChange } = renderDialog({ onSave })
    const popup = await dialog('Add message')
    await user.click(channelButton(popup, 'SMS'))
    await user.type(within(popup).getByRole('textbox', { name: /^Title/ }), ' Your cart ')
    await user.type(within(popup).getByRole('textbox', { name: /^Message/ }), 'Finish your order')
    await user.click(within(popup).getByRole('button', { name: 'Add message' }))

    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave).toHaveBeenCalledWith({ channel: 'sms', title: 'Your cart', body: 'Finish your order' })
    const save = within(popup).getByRole('button', { name: 'Add message' })
    expect(save).toHaveAttribute('aria-busy', 'true')
    await user.click(save)
    expect(onSave).toHaveBeenCalledOnce()
    expect(onOpenChange).not.toHaveBeenCalled()

    gate.resolve({ ok: true })
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('keeps the dialog and the values on an API error and says it, translated, in the footer (M-RA9)', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn(async () => ({ ok: false, error: ['Channel already exists'] }))
    const { onOpenChange } = renderDialog({ onSave })
    const popup = await dialog('Add message')
    await user.click(channelButton(popup, 'SMS'))
    await user.type(within(popup).getByRole('textbox', { name: /^Title/ }), 'Hi')
    await user.type(within(popup).getByRole('textbox', { name: /^Message/ }), 'Body')
    await user.click(within(popup).getByRole('button', { name: 'Add message' }))

    const foot = popup.querySelector('.odc-overlay-foot')
    expect(await within(foot).findByText('Channel already exists')).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(within(popup).getByRole('textbox', { name: /^Title/ })).toHaveValue('Hi')
    expect(within(popup).getByRole('textbox', { name: /^Message/ })).toHaveValue('Body')
    expect(within(popup).getByRole('button', { name: 'Add message' })).not.toHaveAttribute('aria-busy')
  })

  it('says a fallback when the API error has no text, and when the save throws', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockRejectedValueOnce(new Error('network'))
    renderDialog({ onSave })
    const popup = await dialog('Add message')
    await user.click(channelButton(popup, 'SMS'))
    await user.type(within(popup).getByRole('textbox', { name: /^Title/ }), 'Hi')
    await user.type(within(popup).getByRole('textbox', { name: /^Message/ }), 'Body')
    await user.click(within(popup).getByRole('button', { name: 'Add message' }))
    expect(await within(popup).findByText("We couldn't save this message. Try again.")).toBeInTheDocument()
    await user.click(within(popup).getByRole('button', { name: 'Add message' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2))
    expect(await within(popup).findByText("We couldn't save this message. Try again.")).toBeInTheDocument()
  })

  it('cancels with Cancel and with the close button, and does not let either happen while saving', async () => {
    const user = userEvent.setup()
    const gate = deferred()
    const { onOpenChange } = renderDialog({ onSave: vi.fn(() => gate.promise) })
    const popup = await dialog('Add message')
    await user.click(within(popup).getByRole('button', { name: 'Cancel' }))
    await user.click(within(popup).getByRole('button', { name: 'Close' }))
    expect(onOpenChange).toHaveBeenCalledTimes(2)
    expect(onOpenChange).toHaveBeenNthCalledWith(1, false)
    expect(onOpenChange).toHaveBeenNthCalledWith(2, false)
    onOpenChange.mockClear()

    await user.click(channelButton(popup, 'SMS'))
    await user.type(within(popup).getByRole('textbox', { name: /^Title/ }), 'Hi')
    await user.type(within(popup).getByRole('textbox', { name: /^Message/ }), 'Body')
    await user.click(within(popup).getByRole('button', { name: 'Add message' }))
    await user.click(within(popup).getByRole('button', { name: 'Cancel' }))
    await user.click(within(popup).getByRole('button', { name: 'Close' }))
    await user.keyboard('{Escape}')
    expect(onOpenChange).not.toHaveBeenCalled()
    gate.resolve({ ok: false, error: ['Not saved'] })
    expect(await within(popup).findByText('Not saved')).toBeInTheDocument()
  })

  it('starts empty every time it opens', async () => {
    const user = userEvent.setup()
    const { rerender, onSave, onDelete, onOpenChange } = renderDialog()
    const popup = await dialog('Add message')
    await user.click(channelButton(popup, 'SMS'))
    await user.type(within(popup).getByRole('textbox', { name: /^Title/ }), 'Left over')

    const props = { mode: 'add', rule, onSave, onDelete, onOpenChange }
    rerender(<RuleMessageDialog open={false} {...props} />)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    rerender(<RuleMessageDialog open {...props} />)
    const again = await dialog('Add message')
    expect(pressed(again)).toEqual([])
    expect(within(again).getByRole('textbox', { name: /^Title/ })).toHaveValue('')
  })

  it('may be called with the same channel twice: duplicates are allowed, nothing filters the three', async () => {
    renderDialog({ rule: { ...rule, channels: [emailChannel, emailChannel] } })
    const popup = await dialog('Add message')
    for (const name of ['Email', 'SMS', 'Push notification']) {
      expect(channelButton(popup, name)).toBeEnabled()
    }
  })
})

describe('RuleMessageDialog — rich editor wiring', () => {
  it('an editor that emits \'\' (empty document) is an empty message, and the editor is told why through invalid/describedBy', async () => {
    const user = userEvent.setup()
    const { onSave } = renderDialog()
    const popup = await dialog('Add message')
    await user.click(channelButton(popup, 'Email'))
    expect(editor.props.label).toBe('Message')
    expect(editor.props.invalid).toBe(false)
    await user.type(within(popup).getByRole('textbox', { name: /^Title/ }), 'Hi')
    act(() => editor.props.onChange('<p>text</p>'))
    act(() => editor.props.onChange(''))
    await user.click(within(popup).getByRole('button', { name: 'Add message' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(editor.props.invalid).toBe(true)
    const error = popup.querySelector(`[id="${editor.props.describedBy}"]`)
    expect(error).toHaveTextContent('This field is required')
  })

  it('the editor is controlled: it always receives the form body, so an outside change of the body reaches it', async () => {
    renderDialog({ mode: 'edit', channel: emailChannel })
    const popup = await dialog('Edit Email message')
    expect(editor.props.value).toBe('<p>Finish your order today.</p>')
    act(() => editor.props.onChange('<p>Changed</p>'))
    expect(within(popup).getByTestId('html-editor')).toHaveAttribute('data-body', '<p>Changed</p>')
    expect(within(popup).getByTestId('preview-body')).toHaveTextContent('<p>Changed</p>')
    expect(editor.mounts).toBe(1)
  })
})

describe('RuleMessageDialog — edit (decision 5; M-RA7)', () => {
  it('opens as «Edit Email message» with the channel fixed, the title and the HTML of the message, and Delete message first', async () => {
    renderDialog({ mode: 'edit', channel: emailChannel })
    const popup = await dialog('Edit Email message')
    expect(within(popup).queryByRole('group', { name: 'Channel' })).not.toBeInTheDocument()
    expect(within(popup).getByRole('textbox', { name: /^Title/ })).toHaveValue('Your cart is waiting')
    expect(within(popup).getByTestId('html-editor')).toHaveAttribute('data-body', '<p>Finish your order today.</p>')
    expect(within(popup).getByTestId('message-preview')).toHaveAttribute('data-channel', 'email')
    expect(within(popup).getByRole('button', { name: 'Save message' })).toBeInTheDocument()
    expect(within(popup).queryByRole('button', { name: 'Add message' })).not.toBeInTheDocument()
    const foot = popup.querySelector('.odc-overlay-foot')
    const labels = within(foot).getAllByRole('button').map(button => button.textContent)
    expect(labels).toEqual(['Delete message', 'Cancel', 'Save message'])
  })

  it('names the channel in its own words in the title: SMS, Push notification', async () => {
    const { rerender, onSave, onDelete, onOpenChange } = renderDialog({ mode: 'edit', channel: smsChannel })
    expect(await dialog('Edit SMS message')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /^Message/ })).toHaveValue('Finish your order')
    rerender(<RuleMessageDialog open mode='edit' rule={rule} channel={{ ...smsChannel, channel: 'notification' }} onSave={onSave} onDelete={onDelete} onOpenChange={onOpenChange} />)
    expect(await dialog('Edit Push notification message')).toBeInTheDocument()
  })

  it('saves {channel, title, body} of the channel being edited', async () => {
    const user = userEvent.setup()
    const { onSave, onOpenChange } = renderDialog({ mode: 'edit', channel: smsChannel })
    const popup = await dialog('Edit SMS message')
    const message = within(popup).getByRole('textbox', { name: /^Message/ })
    await user.clear(message)
    await user.type(message, 'New text')
    await user.click(within(popup).getByRole('button', { name: 'Save message' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ channel: 'sms', title: 'Cart', body: 'New text' }))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('refuses to save an emptied title or message, in line', async () => {
    const user = userEvent.setup()
    const { onSave } = renderDialog({ mode: 'edit', channel: smsChannel })
    const popup = await dialog('Edit SMS message')
    await user.clear(within(popup).getByRole('textbox', { name: /^Title/ }))
    await user.click(within(popup).getByRole('button', { name: 'Save message' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(within(popup).getByRole('textbox', { name: /^Title/ })).toBeInvalid()
    await waitFor(() => expect(within(popup).getByRole('textbox', { name: /^Title/ })).toHaveFocus())
  })

  it('Delete message asks first with the channel named, the consequence, and the focus on Cancel; Cancel changes nothing', async () => {
    const user = userEvent.setup()
    const { onDelete, onOpenChange } = renderDialog({ mode: 'edit', channel: smsChannel })
    const popup = await dialog('Edit SMS message')
    await user.click(within(popup).getByRole('button', { name: 'Delete message' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete the SMS message?' })
    expect(within(confirm).getByText('Customers stop getting this message from the rule.')).toBeInTheDocument()
    expect(within(confirm).getByRole('button', { name: 'Delete message' })).toBeInTheDocument()
    await waitFor(() => expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(onDelete).not.toHaveBeenCalled()

    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(onDelete).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Edit SMS message' })).toBeInTheDocument()
  })

  it('confirming deletes the channel it was opened on, busy while it runs, and closes both on success', async () => {
    const user = userEvent.setup()
    const gate = deferred()
    const onDelete = vi.fn(() => gate.promise)
    const { onOpenChange } = renderDialog({ mode: 'edit', channel: smsChannel, onDelete })
    const popup = await dialog('Edit SMS message')
    await user.click(within(popup).getByRole('button', { name: 'Delete message' }))
    const confirm = await screen.findByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: 'Delete message' }))
    expect(onDelete).toHaveBeenCalledOnce()
    expect(onDelete).toHaveBeenCalledWith(smsChannel)
    expect(within(confirm).getByRole('button', { name: 'Delete message' })).toHaveAttribute('aria-busy', 'true')

    gate.resolve({ ok: true })
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('a delete that fails closes the question, keeps the message and says why in the footer of the dialog (M-RA6 style)', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn(async () => ({ ok: false, error: ['Channel not found'] }))
    const { onOpenChange } = renderDialog({ mode: 'edit', channel: smsChannel, onDelete })
    const popup = await dialog('Edit SMS message')
    await user.click(within(popup).getByRole('button', { name: 'Delete message' }))
    const confirm = await screen.findByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: 'Delete message' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    const foot = popup.querySelector('.odc-overlay-foot')
    expect(await within(foot).findByText('Channel not found')).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(within(popup).getByRole('textbox', { name: /^Title/ })).toHaveValue('Cart')
  })

  it('a delete that fails without text says a fallback', async () => {
    const user = userEvent.setup()
    renderDialog({ mode: 'edit', channel: smsChannel, onDelete: vi.fn(async () => ({ ok: false })) })
    const popup = await dialog('Edit SMS message')
    await user.click(within(popup).getByRole('button', { name: 'Delete message' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete message' }))
    expect(await within(popup).findByText("We couldn't delete this message. Try again.")).toBeInTheDocument()
  })

  it('shows an unknown channel as it came', async () => {
    renderDialog({ mode: 'edit', channel: { id: 9, channel: 'whatsapp', title: 'T', body: 'B' } })
    expect(await dialog('Edit whatsapp message')).toBeInTheDocument()
  })
})

// redesign R2-F2 (R1-04, R1-05): when the dialog closes and the focus is left on <body> (or on a node that left the page: the «Edit» of a message
// that was just deleted), `returnFocus()` says where it goes. The page opens the dialog with no opener at all after a failed first message.
describe('RuleMessageDialog — Escape', () => {
  it('closes the dialog', async () => {
    const user = userEvent.setup()
    const { onOpenChange } = renderDialog({ mode: 'edit', channel: emailChannel })
    await dialog('Edit Email message')
    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

describe('RuleMessageDialog — returnFocus (R1-04, R1-05)', () => {
  const Harness = ({ returnFocus, ...props }) => {
    const [open, setOpen] = React.useState(true)
    return (
      <>
        {/* first in the page, so the library's own fallback (the first tabbable) is never the target by accident */}
        <button type='button'>Somewhere else</button>
        <button type='button' data-testid='target'>Add message (panel)</button>
        <RuleMessageDialog
          open={open}
          mode='add'
          rule={rule}
          onSave={async () => ({ ok: true })}
          onDelete={async () => ({ ok: true })}
          onOpenChange={setOpen}
          returnFocus={returnFocus}
          {...props}
        />
      </>
    )
  }
  const fillSms = async (user, popup) => {
    await user.click(channelButton(popup, 'SMS'))
    await user.type(within(popup).getByRole('textbox', { name: /^Title/ }), 'Hi')
    await user.type(within(popup).getByRole('textbox', { name: /^Message/ }), 'Body')
  }
  const lands = async () => {
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByTestId('target')).toHaveFocus())
  }

  it('Cancel: the focus goes to the node returnFocus gives', async () => {
    const user = userEvent.setup()
    const returnFocus = vi.fn(() => screen.getByTestId('target'))
    render(<Harness returnFocus={returnFocus} />)
    const popup = await dialog('Add message')
    await user.click(within(popup).getByRole('button', { name: 'Cancel' }))
    await lands()
    expect(returnFocus).toHaveBeenCalled()
  })

  it('Escape: the same', async () => {
    const user = userEvent.setup()
    render(<Harness returnFocus={() => screen.getByTestId('target')} />)
    await dialog('Add message')
    await user.keyboard('{Escape}')
    await lands()
  })

  it('the close button: the same', async () => {
    const user = userEvent.setup()
    render(<Harness returnFocus={() => screen.getByTestId('target')} />)
    const popup = await dialog('Add message')
    await user.click(within(popup).getByRole('button', { name: 'Close' }))
    await lands()
  })

  it('a message saved: the same', async () => {
    const user = userEvent.setup()
    render(<Harness returnFocus={() => screen.getByTestId('target')} />)
    const popup = await dialog('Add message')
    await fillSms(user, popup)
    await user.click(within(popup).getByRole('button', { name: 'Add message' }))
    await lands()
  })

  it('a message deleted (the «Edit» that opened it is gone): the same', async () => {
    const user = userEvent.setup()
    render(<Harness mode='edit' channel={smsChannel} returnFocus={() => screen.getByTestId('target')} />)
    const popup = await dialog('Edit SMS message')
    await user.click(within(popup).getByRole('button', { name: 'Delete message' }))
    const confirm = await screen.findByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: 'Delete message' }))
    await lands()
  })

  // redesign R2-I4 (live check of R1-04): in the browser the confirmation's own hand-back comes a few frames after the close and drops the
  // focus on <body> again; one frame of watching was not enough
  it('a focus dropped on <body> a few frames after the close still goes to returnFocus', async () => {
    const user = userEvent.setup()
    render(<Harness returnFocus={() => screen.getByTestId('target')} />)
    const popup = await dialog('Add message')
    await user.click(within(popup).getByRole('button', { name: 'Cancel' }))
    await lands()
    // the late hand-back of a layer that closed after the dialog (after the Dialog's own hand-back, inside the watch window)
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 100)) })
    screen.getByTestId('target').blur()
    expect(document.activeElement).toBe(document.body)
    await waitFor(() => expect(screen.getByTestId('target')).toHaveFocus())
  })

  it('works when returnFocus gives null: nothing breaks, the focus is left alone', async () => {
    const user = userEvent.setup()
    render(<Harness returnFocus={() => null} />)
    const popup = await dialog('Add message')
    await user.click(within(popup).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByTestId('target')).not.toHaveFocus()
  })

  it('without the prop it is as before: nothing is forced', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const popup = await dialog('Add message')
    await user.click(within(popup).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByTestId('target')).not.toHaveFocus()
  })

  it('opened from a control that stays, the focus goes back to that control, not to the fallback', async () => {
    const user = userEvent.setup()
    const Opened = () => {
      const [open, setOpen] = React.useState(false)
      return (
        <>
          <button type='button' data-testid='target'>Fallback</button>
          <button type='button' data-testid='opener' onClick={() => setOpen(true)}>Opener</button>
          <RuleMessageDialog open={open} mode='add' rule={rule} onOpenChange={setOpen} returnFocus={() => screen.getByTestId('target')} />
        </>
      )
    }
    render(<Opened />)
    await user.click(screen.getByTestId('opener'))
    const popup = await dialog('Add message')
    await user.click(within(popup).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.getByTestId('opener')).toHaveFocus())
    await new Promise(resolve => setTimeout(resolve, 80))
    expect(screen.getByTestId('opener')).toHaveFocus()
    expect(screen.getByTestId('target')).not.toHaveFocus()
  })
})

describe('RuleMessageDialog — pending (a rule that was created and whose message failed; decision 6)', () => {
  const pending = { channel: 'email', title: 'Your cart is waiting', body: '<p>Finish.</p>', error: ['Title too long'] }

  it('opens as an add with the channel, title and message filled and the error already visible', async () => {
    renderDialog({ mode: 'edit', channel: smsChannel, pending })
    const popup = await dialog('Add message')
    expect(pressed(popup)).toEqual(['Email'])
    expect(within(popup).getByRole('textbox', { name: /^Title/ })).toHaveValue('Your cart is waiting')
    expect(within(popup).getByTestId('html-editor')).toHaveAttribute('data-body', '<p>Finish.</p>')
    expect(within(popup.querySelector('.odc-overlay-foot')).getByText('Title too long')).toBeInTheDocument()
    expect(within(popup).queryByRole('button', { name: 'Delete message' })).not.toBeInTheDocument()
  })

  it('Add message retries with those values, and a string error reads too', async () => {
    const user = userEvent.setup()
    const { onSave, onOpenChange } = renderDialog({ pending: { ...pending, error: 'Title too long' } })
    const popup = await dialog('Add message')
    expect(within(popup).getByText('Title too long')).toBeInTheDocument()
    await user.click(within(popup).getByRole('button', { name: 'Add message' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ channel: 'email', title: 'Your cart is waiting', body: '<p>Finish.</p>' }))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('without an error shows no notice', async () => {
    renderDialog({ pending: { ...pending, error: null } })
    const popup = await dialog('Add message')
    expect(within(popup.querySelector('.odc-overlay-foot')).queryByRole('alert')).not.toBeInTheDocument()
  })
})
