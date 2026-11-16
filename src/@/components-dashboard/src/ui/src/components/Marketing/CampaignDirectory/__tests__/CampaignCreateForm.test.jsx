/* eslint-disable import/first */
// redesign CA-B5 (decisions 3, 5, 6, 7; M-CA1, M-CA2, M-CA7, M-CA9, M-CA12, M-CA13; auditor #3, #5, #6, #15): the create form of a campaign:
// name, channel, audience with its rules and the reach, the message, the delivery, ONE button that says what it does, and the
// confirmation that cannot be skipped when the campaign is fixed and goes out now. The controller is a stateful stand-in that
// copies the handlers of K/CampaignDetail (stale closures included); `handleAddCampaign` is a spy: nothing is ever sent.
import React, { useEffect, useState } from 'react'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  catalog: {}, // what the runtime catalog of the API says for a key, over the default text
  configs: {},
  configured: true, // what every channel editor reports through onConfigStateChange
  total: 12, // what the audience endpoint answers
  audienceError: null,
  mounts: {}, // how many times each channel editor was mounted
  editorProps: {}, // the props of the last render of each editor
  // The three channel editors, as one stub: two inputs that write through handleChangeData, the config gate and a «Save»
  // that must NOT be there (hideActions). Built with the React the factory hands in (a hoisted block cannot import).
  renderEditor: (React, channel, props) => {
    const { useEffect: effect } = React
    mockState.editorProps[channel] = props
    effect(() => {
      mockState.mounts[channel] = (mockState.mounts[channel] || 0) + 1
    }, [])
    effect(() => {
      if (typeof props.onConfigStateChange === 'function') props.onConfigStateChange(mockState.configured)
    }, [mockState.configured])
    return React.createElement(
      'div',
      { 'data-testid': `editor-${channel}` },
      React.createElement('input', {
        'aria-label': 'Editor title',
        defaultValue: props.contactState?.changes?.contact_data?.title || '',
        onChange: (event) => props.handleChangeData({ target: { name: 'title', value: event.target.value } })
      }),
      React.createElement('textarea', {
        'aria-label': 'Editor body',
        defaultValue: props.contactState?.changes?.contact_data?.body || '',
        onChange: (event) => props.handleChangeData({ target: { name: 'body', value: event.target.value } })
      }),
      props.hideActions ? null : React.createElement('button', { type: 'button' }, 'Editor save')
    )
  }
}))

vi.mock('../../../../../../index', async () => {
  const { getDateTimeFormats } = await import('../../../../../../utils/settingsCustomSections')
  return {
    useLanguage: () => [{ language: { code: 'en' } }, (key, text) => mockState.catalog[key] ?? text],
    useConfig: () => [{ configs: mockState.configs }],
    // the project's date format, day part only, as the real parseDate does
    useUtils: () => [{
      parseDate: (date, options = {}) => {
        const raw = mockState.configs.dates_general_format?.value
        const formats = getDateTimeFormats(typeof raw === 'string' && raw.trim() ? raw : 'DD/MM/YYYY HH:mm')
        return dayjs(String(date).slice(0, 10)).format(options.dateOnly ? formats.dateFormat : `${formats.dateFormat} ${formats.timeFormat}`)
      }
    }]
  }
})

vi.mock('../../CampaignEmail', async () => {
  const React = await import('react')
  return { CampaignEmail: (props) => mockState.renderEditor(React, 'email', props) }
})
vi.mock('../../CampaignSMS', async () => {
  const React = await import('react')
  return { CampaignSMS: (props) => mockState.renderEditor(React, 'sms', props) }
})
vi.mock('../../CampaignNotification', async () => {
  const React = await import('react')
  return { CampaignNotification: (props) => mockState.renderEditor(React, 'notification', props) }
})

import { CampaignCreateForm } from '../CampaignCreateForm'
import { CampaignRules } from '../CampaignRules'
import { CampaignSendConfirm } from '../CampaignSendConfirm'

// A day far from any real clock, so «tomorrow» never gets in the way; the project format is DD/MM/YYYY.
const FAR = '2099-03-20'
const FAR_TYPED = '20/03/2099'
const FAR_DIGITS = '20032099'

const stubMatchMedia = (phone = false) => {
  window.matchMedia = vi.fn((query) => ({
    matches: phone && query.includes('max-width: 767px'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
}

// ---- the controller, as K/CampaignDetail handles it in add mode (handlers copied, closures stale on purpose) -------------------------
const Harness = ({ addCampaign, api, onDirtyChange, onCancel, formLoading = false, children, categoryList }) => {
  const [formState, setFormState] = useState({ loading: false, changes: { enabled: true, conditions: [], status: 'pending' }, error: null })
  const [contactState, setContactState] = useState({ loading: false, changes: {}, error: null })
  const [audienceState, setAudienceState] = useState({ loading: false, audience: 0, error: null })

  const handleChangeInput = (e) => setFormState({ ...formState, changes: { ...formState.changes, [e.target.name]: e.target.value } })
  const handleChangeItem = (key, value) => {
    const changes = { ...formState.changes, [key]: value }
    if (key === 'scheduled_at') changes.status = value ? 'scheduled' : 'pending'
    setFormState({ ...formState, changes })
  }
  const handleChangeType = (name, value) => {
    setContactState({ ...contactState, changes: { ...contactState.changes, [name]: value } })
    handleChangeItem(name, value)
  }
  const handleChangeContactData = (e) => {
    const contactData = { ...formState.changes.contact_data, [e.target.name]: e.target.value }
    setFormState({ ...formState, changes: { ...formState.changes, contact_data: contactData } })
  }
  const handleChangeData = (e) => {
    const contactData = { ...contactState.changes.contact_data, [e.target.name]: e.target.value }
    setContactState({ ...contactState, changes: { ...contactState.changes, contact_data: contactData } })
    handleChangeContactData(e)
  }
  const handleChangeContact = (name, value) => {
    const contactData = { ...formState.changes.contact_data, [name]: value }
    setFormState({ ...formState, changes: { ...formState.changes, contact_data: contactData } })
  }
  // the add-mode sync of the controller: the contact state follows the form state
  useEffect(() => {
    if (Object.keys(formState.changes).length > 0) {
      setContactState(current => ({
        ...current,
        changes: { contact_type: formState.changes.contact_type || '', contact_data: formState.changes.contact_data || {} }
      }))
    }
  }, [formState.changes])
  // the count of the controller: only when the rules change and there is at least one (and a channel)
  useEffect(() => {
    const conditions = formState.changes.conditions
    if (!conditions?.length || !formState.changes.contact_type) return undefined
    setAudienceState(current => ({ ...current, loading: true }))
    const id = setTimeout(() => {
      setAudienceState({ loading: false, audience: [], error: mockState.audienceError, pagination: { total: mockState.total } })
    }, 0)
    return () => clearTimeout(id)
  }, [JSON.stringify(formState.changes.conditions)])

  const handleAddCampaign = async (overrides) => {
    const body = JSON.parse(JSON.stringify({ ...formState.changes, ...(overrides || {}) })) // what travels: undefined keys are gone
    return addCampaign(overrides, body)
  }

  if (api) api.current = { formState, contactState, audienceState, setAudienceState }
  const shown = { ...formState, loading: formLoading || formState.loading }

  return (
    <CampaignCreateForm
      isAddMode
      formState={shown}
      contactState={contactState}
      audienceState={audienceState}
      categoryList={categoryList || { loading: false, categories: [], error: null }}
      handleChangeInput={handleChangeInput}
      handleChangeItem={handleChangeItem}
      handleChangeType={handleChangeType}
      handleChangeData={handleChangeData}
      handleChangeContact={handleChangeContact}
      handleChangeContactData={handleChangeContactData}
      handleAddCampaign={handleAddCampaign}
      onDirtyChange={onDirtyChange}
      onCancel={onCancel}
    >
      {children}
    </CampaignCreateForm>
  )
}

const setup = (props = {}) => {
  const addCampaign = vi.fn(async () => ({ ok: true, error: null }))
  const onDirtyChange = vi.fn()
  const onCancel = vi.fn()
  const api = { current: null }
  const user = userEvent.setup()
  const view = render(<Harness addCampaign={addCampaign} api={api} onDirtyChange={onDirtyChange} onCancel={onCancel} {...props} />)
  return { addCampaign, onDirtyChange, onCancel, api, user, ...view }
}

const pickChannel = (user, name = 'Push notification') => user.click(screen.getByRole('radio', { name }))
const pickAudience = (user, name) => user.click(screen.getByRole('radio', { name }))
const writeName = (user, name = 'Spring offer') => user.type(screen.getByRole('textbox', { name: 'Name' }), name)
const writeMessage = async (user, title = 'Hello', body = 'World') => {
  await user.type(screen.getByLabelText('Editor title'), title)
  await user.type(screen.getByLabelText('Editor body'), body)
}
const sendButton = (name) => screen.getByRole('button', { name })
const footer = () => document.querySelector('.odc-campaign-form-foot') // redesign CA-R2 (P1): the form's own footer class, not the table's

// a fixed campaign that is ready to go out now
const readyFixed = async (user) => {
  await writeName(user)
  await pickChannel(user)
  await writeMessage(user)
  await pickAudience(user, 'Fixed')
  await addCountRule(user)
}

const pickEndDate = async (user) => {
  await user.click(screen.getByRole('combobox', { name: /^End date/ }))
  const picker = await screen.findByRole('dialog', { name: 'Select a date' })
  await user.type(within(picker).getByRole('textbox'), `${FAR_DIGITS}{Enter}`)
}

const readyDynamic = async (user, name) => {
  await writeName(user, name)
  await pickChannel(user)
  await writeMessage(user)
  await pickAudience(user, 'Dynamic')
  await addCountRule(user)
  await pickEndDate(user)
}

const confirmDialog = () => screen.findByRole('alertdialog', { name: /^Send / })
// redesign D-6 (owner, 2026-10-19): a dynamic campaign that is Active asks before it is created
const createDialog = () => screen.findByRole('alertdialog', { name: /^Create .* and start sending\?$/ })
const confirmCreate = async (user) => {
  const dialog = await createDialog()
  await user.click(within(dialog).getByRole('button', { name: 'Create and activate' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  stubMatchMedia(false)
  mockState.catalog = {}
  mockState.configs = { dates_general_format: { value: 'DD/MM/YYYY HH:mm' } }
  mockState.configured = true
  mockState.total = 12
  mockState.audienceError = null
  mockState.mounts = {}
  mockState.editorProps = {}
})

afterEach(() => {
  cleanup()
  delete window.matchMedia
  document.getElementById('app-modals')?.remove()
})

// ---------------------------------------------------------------------------------------------------------------------------------
describe('the form · sections, in the order of decision 3', () => {
  it('has the sections Name, Channel, Audience and Message, each with its heading; Delivery comes only with an audience', async () => {
    const { user } = setup()
    const headings = () => screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)
    expect(headings()).toEqual(['Name', 'Channel', 'Audience', 'Message'])
    await pickAudience(user, 'Fixed')
    expect(headings()).toEqual(['Name', 'Channel', 'Audience', 'Message', 'Delivery'])
  })

  it('has no <form> element anywhere (the embedded settings list has its own saves, auditor #15)', () => {
    const { container } = setup()
    expect(container.querySelector('form')).toBeNull()
    expect(document.querySelector('form')).toBeNull()
  })

  it('writes the name through handleChangeInput as an event-like object', async () => {
    const { user, api } = setup()
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Spring')
    expect(api.current.formState.changes.name).toBe('Spring')
  })

  it('offers the three channels main lets you create, with their names, and none chosen', () => {
    setup()
    const group = screen.getByRole('radiogroup', { name: 'Channel' })
    expect(within(group).getAllByRole('radio').map(radio => radio.textContent)).toEqual(['Email', 'SMS', 'Push notification'])
    for (const radio of within(group).getAllByRole('radio')) expect(radio).toHaveAttribute('aria-checked', 'false')
  })

  it('writes the channel through handleChangeType (the add-mode path of main)', async () => {
    const { user, api } = setup()
    await pickChannel(user, 'SMS')
    expect(api.current.formState.changes.contact_type).toBe('sms')
    expect(api.current.contactState.changes.contact_type).toBe('sms')
  })

  it('offers Fixed and Dynamic with the descriptions of main and no default (decision 3)', async () => {
    const { user, api } = setup()
    const group = screen.getByRole('radiogroup', { name: 'Audience' })
    expect(within(group).getByText('Only people who match rules right now')).toBeInTheDocument()
    expect(within(group).getByText('People who match rules now and in the future')).toBeInTheDocument()
    for (const radio of within(group).getAllByRole('radio')) expect(radio).toHaveAttribute('aria-checked', 'false')
    await pickAudience(user, 'Dynamic')
    expect(api.current.formState.changes.audience_type).toBe('dynamic')
  })

  it('says «Choose a channel first» in the Message section until a channel is chosen, with no editor', async () => {
    const { user } = setup()
    expect(screen.getByText('Choose a channel first')).toBeInTheDocument()
    expect(screen.queryByTestId('editor-notification')).not.toBeInTheDocument()
    await pickChannel(user)
    expect(screen.queryByText('Choose a channel first')).not.toBeInTheDocument()
    expect(screen.getByTestId('editor-notification')).toBeInTheDocument()
  })

  it('mounts the editor of the chosen channel ONCE, without its own buttons (hideActions), and tells it where to report its setup', async () => {
    const { user } = setup()
    await pickChannel(user, 'Email')
    expect(screen.getAllByTestId(/^editor-/)).toHaveLength(1)
    expect(mockState.mounts.email).toBe(1)
    expect(mockState.editorProps.email.hideActions).toBe(true)
    expect(typeof mockState.editorProps.email.onConfigStateChange).toBe('function')
    expect(screen.queryByRole('button', { name: 'Editor save' })).not.toBeInTheDocument()
    // the controller's props reach it
    expect(typeof mockState.editorProps.email.handleChangeData).toBe('function')
    expect(mockState.editorProps.email.isAddMode).toBe(true)
  })

  it('switching the channel replaces the editor: one at a time', async () => {
    const { user } = setup()
    await pickChannel(user, 'Email')
    await pickChannel(user, 'SMS')
    expect(screen.getAllByTestId(/^editor-/)).toHaveLength(1)
    expect(screen.getByTestId('editor-sms')).toBeInTheDocument()
    expect(mockState.mounts.sms).toBe(1)
  })
})

// ---------------------------------------------------------------------------------------------------------------------------------
describe('the config gate · decision 34, decision 4', () => {
  it('shows a warning with «Go to setup» and disables the button when the editor says the channel is not set up', async () => {
    mockState.configured = false
    const { user } = setup()
    await readyFixed(user)
    expect(screen.getByRole('status')).toHaveTextContent('Set up Push notification before you can send')
    expect(screen.getByRole('button', { name: 'Go to setup' })).toBeInTheDocument()
    expect(sendButton('Send now')).toBeDisabled()
    expect(footer()).toHaveTextContent('Set up Push notification before you can send')
  })

  it('«Go to setup» takes the focus to the Message section, where the editor shows its gate', async () => {
    mockState.configured = false
    const { user } = setup()
    await pickChannel(user)
    await user.click(screen.getByRole('button', { name: 'Go to setup' }))
    expect(screen.getByRole('heading', { name: 'Message' })).toHaveFocus()
    expect(screen.getAllByTestId(/^editor-/)).toHaveLength(1)
  })

  it('shows no warning while the channel is set up, nor before a channel is chosen', async () => {
    const { user } = setup()
    expect(screen.queryByRole('button', { name: 'Go to setup' })).not.toBeInTheDocument()
    await pickChannel(user)
    expect(screen.queryByRole('button', { name: 'Go to setup' })).not.toBeInTheDocument()
  })

  it('does not warn while the settings of the channel are still loading', async () => {
    mockState.configured = false
    const { user } = setup({ categoryList: { loading: true, categories: [], error: null } })
    await pickChannel(user)
    expect(screen.queryByRole('button', { name: 'Go to setup' })).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------------------------------------------------------------
describe('the one button · says what it does and why it waits (M-CA2, M-CA9)', () => {
  it('is «Create campaign», disabled, with the first thing that is missing as its reason, in a fresh form', () => {
    setup()
    const button = sendButton('Create campaign')
    expect(button).toBeDisabled()
    expect(footer()).toHaveTextContent('Add a name')
    const reason = document.getElementById(button.getAttribute('aria-describedby'))
    expect(reason).toHaveTextContent('Add a name')
  })

  it('M-CA2: a form with only a name sends nothing and cannot be sent', async () => {
    const { user, addCampaign } = setup()
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Only a name')
    expect(sendButton('Create campaign')).toBeDisabled()
    await user.click(sendButton('Create campaign'))
    expect(addCampaign).not.toHaveBeenCalled()
  })

  it('names what is missing, one at a time, in the order of the form', async () => {
    const { user } = setup()
    expect(footer()).toHaveTextContent('Add a name')
    await writeName(user)
    expect(footer()).toHaveTextContent('Choose a channel')
    await pickChannel(user)
    expect(footer()).toHaveTextContent('Choose an audience')
    await pickAudience(user, 'Fixed')
    expect(footer()).toHaveTextContent('Add a title')
    await user.type(screen.getByLabelText('Editor title'), 'Hello')
    expect(footer()).toHaveTextContent('Write the message')
    await user.type(screen.getByLabelText('Editor body'), 'World')
    expect(footer()).toHaveTextContent('Add at least one rule')
    expect(sendButton('Send now')).toBeDisabled()
    await addCountRule(user)
    expect(sendButton('Send now')).toBeEnabled()
    expect(footer()).not.toHaveTextContent('Add at least one rule')
  })

  it('is «Send now» for fixed + ASAP, «Schedule campaign» for fixed + later, «Create campaign» for dynamic', async () => {
    const { user } = setup()
    await readyFixed(user)
    expect(sendButton('Send now')).toBeEnabled()
    await user.click(screen.getByRole('radio', { name: 'Schedule for later' }))
    expect(sendButton('Schedule campaign')).toBeDisabled()
    await pickAudience(user, 'Dynamic')
    expect(sendButton('Create campaign')).toBeDisabled()
    expect(footer()).toHaveTextContent('Choose an end date')
    await pickEndDate(user)
    expect(sendButton('Create campaign')).toBeEnabled()
  })

  it('requires the name: the API refuses a campaign without one', async () => {
    const { user, addCampaign } = setup()
    await pickChannel(user)
    await writeMessage(user)
    await pickAudience(user, 'Fixed')
    await addCountRule(user)
    expect(sendButton('Send now')).toBeDisabled()
    expect(footer()).toHaveTextContent('Add a name')
    await user.click(sendButton('Send now'))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(addCampaign).not.toHaveBeenCalled()
    await writeName(user)
    expect(sendButton('Send now')).toBeEnabled()
  })

  it('requires a rule: the API refuses a campaign without one', async () => {
    const { user, addCampaign } = setup()
    await writeName(user)
    await pickChannel(user)
    await writeMessage(user)
    await pickAudience(user, 'Fixed')
    expect(sendButton('Send now')).toBeDisabled()
    expect(footer()).toHaveTextContent('Add at least one rule')
    await user.click(sendButton('Send now'))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(addCampaign).not.toHaveBeenCalled()
  })

  it('requires an end date of a dynamic campaign, and not of a fixed one', async () => {
    const { user } = setup()
    await readyFixed(user)
    expect(sendButton('Send now')).toBeEnabled()
    await pickAudience(user, 'Dynamic')
    expect(sendButton('Create campaign')).toBeDisabled()
    expect(footer()).toHaveTextContent('Choose an end date')
  })

  it('is busy while the controller is saving, and ignores a click', async () => {
    const { user, addCampaign } = setup({ formLoading: true })
    await readyFixed(user)
    const button = sendButton('Send now')
    expect(button).toHaveAttribute('aria-busy', 'true')
    await user.click(button)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(addCampaign).not.toHaveBeenCalled()
  })

  it('«Cancel» asks the host to close, and sends nothing', async () => {
    const { user, onCancel, addCampaign } = setup()
    await user.click(within(footer()).getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(addCampaign).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------------------------------------------------------------
describe('how the footer reaches RecordPanel · a render prop', () => {
  it('without a render prop the body and the footer are drawn one after the other', () => {
    const { container } = setup()
    expect(container.querySelector('.odc-campaign-form')).not.toBeNull()
    expect(footer()).not.toBeNull()
    expect(container.contains(footer())).toBe(true)
  })

  // redesign CA-R2 (P1): `.odc-campaign-foot` is the pagination foot of the table (campaigns-table.css); the form's footer must not carry it,
  // or it inherits the table's padding and its end alignment
  it('P1: the footer of the form does not carry the class of the table\'s pagination foot', () => {
    const { container } = setup()
    expect(footer()).toHaveClass('odc-campaign-form-foot')
    expect(footer()).not.toHaveClass('odc-campaign-foot')
    expect(container.querySelector('.odc-campaign-foot')).toBeNull()
    expect(footer().querySelector('.odc-campaign-form-foot-reason')).not.toBeNull()
    expect(within(footer()).getAllByRole('button').map(button => button.textContent)).toEqual(['Cancel', 'Create campaign'])
  })

  it('with a render prop (children as a function) hands over { body, footer, dirty } and draws nothing else', async () => {
    const seen = []
    const { user, container } = setup({
      children: ({ body, footer: foot, dirty }) => {
        seen.push(dirty)
        return (
          <div>
            <div data-testid='host-body'>{body}</div>
            <div data-testid='host-foot'>{foot}</div>
          </div>
        )
      }
    })
    const hostBody = screen.getByTestId('host-body')
    const hostFoot = screen.getByTestId('host-foot')
    expect(within(hostBody).getByRole('heading', { name: 'Message' })).toBeInTheDocument()
    expect(within(hostBody).queryByRole('button', { name: 'Create campaign' })).not.toBeInTheDocument()
    expect(within(hostFoot).getByRole('button', { name: 'Create campaign' })).toBeInTheDocument()
    expect(within(hostFoot).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(container.querySelectorAll('.odc-campaign-form-foot')).toHaveLength(1)
    expect(seen[0]).toBe(false)
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'a')
    expect(seen[seen.length - 1]).toBe(true)
  })

  it('keeps its dialogs with the body, so a host that only places the footer still gets the confirmation', async () => {
    const { user } = setup({
      children: ({ body, footer: foot }) => (
        <div>
          <div data-testid='host-body'>{body}</div>
          <div data-testid='host-foot'>{foot}</div>
        </div>
      )
    })
    await readyFixed(user)
    await user.click(sendButton('Send now'))
    expect(await confirmDialog()).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------------------------------------------------------------
describe('fixed + ASAP · the confirmation cannot be skipped (decision 25, C8, M-CA1)', () => {
  it('«Send now» does NOT call handleAddCampaign: it opens the confirmation', async () => {
    const { user, addCampaign } = setup()
    await readyFixed(user)
    await user.click(sendButton('Send now'))
    const dialog = await confirmDialog()
    expect(dialog).toBeInTheDocument()
    expect(addCampaign).not.toHaveBeenCalled()
  })

  it('the focus starts on Cancel, by the contract of ConfirmDialog', async () => {
    const { user } = setup()
    await readyFixed(user)
    await user.click(sendButton('Send now'))
    const dialog = await confirmDialog()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
  })

  it('Cancel sends nothing, closes the dialog and leaves the form as typed', async () => {
    const { user, addCampaign } = setup()
    await readyFixed(user)
    await user.click(sendButton('Send now'))
    const dialog = await confirmDialog()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(addCampaign).not.toHaveBeenCalled()
    expect(sendButton('Send now')).toBeEnabled()
    expect(screen.getByLabelText('Editor title')).toHaveValue('Hello')
  })

  it('Escape and the close button send nothing either', async () => {
    const { user, addCampaign } = setup()
    await readyFixed(user)
    await user.click(sendButton('Send now'))
    await confirmDialog()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await user.click(sendButton('Send now'))
    const dialog = await confirmDialog()
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(addCampaign).not.toHaveBeenCalled()
  })

  it('the confirm button sends once, with the overrides of fixed + ASAP, and the body has no end date', async () => {
    const { user, addCampaign } = setup()
    await readyFixed(user)
    await user.click(sendButton('Send now'))
    const dialog = await confirmDialog()
    expect(addCampaign).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: /^Send / }))
    await waitFor(() => expect(addCampaign).toHaveBeenCalledTimes(1))
    const [overrides, body] = addCampaign.mock.calls[0]
    expect(overrides).toEqual({ end_at: undefined, enabled: true, scheduled_at: undefined, status: 'pending' })
    expect(body).toMatchObject({ enabled: true, status: 'pending', audience_type: 'fixed', contact_type: 'notification' })
    expect(body).not.toHaveProperty('end_at')
    expect(body).not.toHaveProperty('scheduled_at')
    expect(body.contact_data).toEqual({ title: 'Hello', body: 'World' })
  })

  it('a second click on the confirm button cannot send twice', async () => {
    const { user, addCampaign } = setup()
    addCampaign.mockImplementation(() => new Promise(() => {})) // never answers
    await readyFixed(user)
    await user.click(sendButton('Send now'))
    const dialog = await confirmDialog()
    const confirm = within(dialog).getByRole('button', { name: /^Send / })
    await user.click(confirm)
    await user.click(confirm)
    expect(addCampaign).toHaveBeenCalledTimes(1)
  })

  it('names the campaign in the title', async () => {
    const { user } = setup()
    await readyFixed(user)
    await user.click(sendButton('Send now'))
    expect(await screen.findByRole('alertdialog', { name: 'Send "Spring offer" now?' })).toBeInTheDocument()
  })

  it('with a fresh count the text and the button say how many customers, the figure in an odc-figure', async () => {
    mockState.total = 12
    const { user } = setup()
    await writeName(user)
    await pickChannel(user)
    await writeMessage(user)
    await pickAudience(user, 'Fixed')
    await addCountRule(user)
    await waitFor(() => expect(screen.getByText(/Reaches/)).toHaveTextContent('Reaches 12 customers'))
    await user.click(sendButton('Send now'))
    const dialog = await confirmDialog()
    expect(dialog).toHaveTextContent('This sends a push notification to 12 customers who match the rules. It can\'t be undone.')
    expect(within(dialog).getByRole('button', { name: 'Send to 12 customers' })).toBeInTheDocument()
    expect(dialog.querySelector('.odc-figure')).not.toBeNull()
  })

  it('says «1 customer» for one', async () => {
    mockState.total = 1
    const { user } = setup()
    await writeName(user)
    await pickChannel(user, 'Email')
    await writeMessage(user)
    await pickAudience(user, 'Fixed')
    await addCountRule(user)
    await waitFor(() => expect(screen.getByText(/Reaches/)).toHaveTextContent('Reaches 1 customer'))
    await user.click(sendButton('Send now'))
    const dialog = await confirmDialog()
    expect(dialog).toHaveTextContent('This sends an email to 1 customer who matches the rules. It can\'t be undone.')
    expect(within(dialog).getByRole('button', { name: 'Send to 1 customer' })).toBeInTheDocument()
  })

  it('with rules but without a count (the count failed) the text has no figure: «every customer who matches the rules»', async () => {
    mockState.audienceError = ['Something failed']
    const { user } = setup()
    await readyFixed(user)
    await waitFor(() => expect(screen.getByText(/Couldn't count/)).toBeInTheDocument())
    await user.click(sendButton('Send now'))
    const dialog = await confirmDialog()
    expect(dialog).toHaveTextContent('This sends a push notification to every customer who matches the rules. It can\'t be undone.')
    expect(within(dialog).getByRole('button', { name: 'Send push notification' })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------------------------------------------------------------
describe('CampaignSendConfirm · the dialog by itself', async () => {
  const dialogProps = (patch = {}) => ({ open: true, name: 'Spring offer', channel: 'notification', count: 12, busy: false, onConfirm: vi.fn(), onCancel: vi.fn(), ...patch })

  it.each([
    ['notification', 12, 'This sends a push notification to 12 customers who match the rules. It can\'t be undone.', 'Send to 12 customers'],
    ['email', 12, 'This sends an email to 12 customers who match the rules. It can\'t be undone.', 'Send to 12 customers'],
    ['sms', 12, 'This sends a text message to 12 customers who match the rules. It can\'t be undone.', 'Send to 12 customers'],
    ['notification', 1, 'This sends a push notification to 1 customer who matches the rules. It can\'t be undone.', 'Send to 1 customer'],
    ['email', 1, 'This sends an email to 1 customer who matches the rules. It can\'t be undone.', 'Send to 1 customer'],
    ['sms', 1, 'This sends a text message to 1 customer who matches the rules. It can\'t be undone.', 'Send to 1 customer'],
    ['notification', 0, 'This sends a push notification to 0 customers who match the rules. It can\'t be undone.', 'Send to 0 customers']
  ])('%s with %s: the consequence names the channel and the count', async (channel, count, text, confirm) => {
    render(<CampaignSendConfirm {...dialogProps({ channel, count })} />)
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent(text)
    expect(within(dialog).getByRole('button', { name: confirm })).toBeInTheDocument()
  })

  it.each([
    ['notification', 'This sends a push notification to every customer who matches the rules. It can\'t be undone.', 'Send push notification'],
    ['email', 'This sends an email to every customer who matches the rules. It can\'t be undone.', 'Send email'],
    ['sms', 'This sends a text message to every customer who matches the rules. It can\'t be undone.', 'Send text message']
  ])('%s without a count: no figure', async (channel, text, confirm) => {
    render(<CampaignSendConfirm {...dialogProps({ channel, count: null })} />)
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent(text)
    expect(within(dialog).getByRole('button', { name: confirm })).toBeInTheDocument()
    expect(dialog.querySelector('.odc-figure')).toBeNull()
  })

  it.each([[undefined], [NaN], [-1], ['12']])('treats %j as no count', async (count) => {
    render(<CampaignSendConfirm {...dialogProps({ count })} />)
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('to every customer who matches the rules')
  })

  // redesign CA-R2 (M1): `hasRules` is opt-in; without the prop the dialog behaves as before (it assumes rules)
  it('M1: without the hasRules prop the text is the one with rules (the default pins today\'s behavior)', async () => {
    render(<CampaignSendConfirm {...dialogProps({ count: null })} />)
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('to every customer who matches the rules')
  })

  it.each([
    ['notification', 'This campaign has no rules: it sends a push notification to all your customers. It can\'t be undone.', 'Send push notification'],
    ['email', 'This campaign has no rules: it sends an email to all your customers. It can\'t be undone.', 'Send email'],
    ['sms', 'This campaign has no rules: it sends a text message to all your customers. It can\'t be undone.', 'Send text message'],
    ['whatsapp', 'This campaign has no rules: it sends the campaign to all your customers. It can\'t be undone.', 'Send campaign']
  ])('M1: %s without rules says so and names no count and no rules to match', async (channel, text, confirm) => {
    // a number is given on purpose: with no rules the dialog never shows one
    render(<CampaignSendConfirm {...dialogProps({ channel, count: 12, hasRules: false })} />)
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent(text)
    expect(dialog).not.toHaveTextContent(/match(es)? the rules/)
    expect(within(dialog).getByRole('button', { name: confirm })).toBeInTheDocument()
    expect(dialog.querySelector('.odc-figure')).toBeNull()
  })

  it('M1: the words without rules come from the catalog of the project', async () => {
    mockState.catalog = { CAMPAIGNS_SEND_BODY_EMAIL_NO_RULES: 'Sin reglas: va a todos.' }
    render(<CampaignSendConfirm {...dialogProps({ channel: 'email', count: null, hasRules: false })} />)
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Sin reglas: va a todos.')
  })

  it('does not break on a channel it does not know: it says «campaign»', async () => {
    render(<CampaignSendConfirm {...dialogProps({ channel: 'whatsapp', count: null })} />)
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('This sends the campaign to every customer who matches the rules. It can\'t be undone.')
    expect(within(dialog).getByRole('button', { name: 'Send campaign' })).toBeInTheDocument()
  })

  it('names the campaign in the title, or says «this campaign» when it has no name', async () => {
    const { unmount } = render(<CampaignSendConfirm {...dialogProps({ name: 'Spring offer' })} />)
    expect(await screen.findByRole('alertdialog', { name: 'Send "Spring offer" now?' })).toBeInTheDocument()
    unmount()
    render(<CampaignSendConfirm {...dialogProps({ name: '   ' })} />)
    expect(await screen.findByRole('alertdialog', { name: 'Send this campaign now?' })).toBeInTheDocument()
  })

  it('starts on Cancel and reports cancel and confirm once each', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<CampaignSendConfirm {...dialogProps({ onConfirm, onCancel })} />)
    const dialog = await screen.findByRole('alertdialog')
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Send to 12 customers' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('while it sends (busy) neither button answers', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<CampaignSendConfirm {...dialogProps({ onConfirm, onCancel, busy: true })} />)
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await user.click(within(dialog).getByRole('button', { name: 'Send to 12 customers' }))
    expect(onCancel).not.toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('is nothing while closed', async () => {
    render(<CampaignSendConfirm {...dialogProps({ open: false })} />)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('takes its words from the catalog of the project when it has them', async () => {
    mockState.catalog = { CAMPAIGNS_SEND_TITLE_UNNAMED: 'Enviar esta campaña ahora?' }
    render(<CampaignSendConfirm {...dialogProps({ name: '' })} />)
    expect(await screen.findByRole('alertdialog', { name: 'Enviar esta campaña ahora?' })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------------------------------------------------------------
describe('the reach line · a count is shown only while it is fresh (auditor #3)', () => {
  const line = () => document.querySelector('.odc-campaign-reach')

  it('says nothing before the first count', async () => {
    const { user } = setup()
    expect(line()).toBeNull()
    await pickChannel(user)
    await pickAudience(user, 'Fixed')
    expect(line()).toBeNull()
    expect(screen.queryByText(/Reaches|Count not available|Couldn't count/)).not.toBeInTheDocument()
  })

  it('does not paint the bogus error the controller leaves in add mode before any count was requested', async () => {
    const { user, api } = setup()
    await pickAudience(user, 'Fixed')
    act(() => api.current.setAudienceState({ loading: false, audience: 0, error: 'conditions is not iterable' }))
    expect(screen.queryByText(/Couldn't count/)).not.toBeInTheDocument()
  })

  it('shows a skeleton while it counts, then «Reaches N customers» with the figure in an odc-figure', async () => {
    const { user, api } = setup()
    await pickChannel(user)
    await pickAudience(user, 'Fixed')
    act(() => api.current.setAudienceState({ loading: true, audience: 0, error: null }))
    expect(line()).toHaveAttribute('aria-busy', 'true')
    expect(line().querySelector('.odc-skeleton')).not.toBeNull()
    expect(screen.queryByText(/Reaches/)).not.toBeInTheDocument()
  })

  it('«Reaches N customers» after the count, and «Count not available» once the channel changes (stale)', async () => {
    const { user } = setup()
    await pickChannel(user)
    await pickAudience(user, 'Fixed')
    await addCountRule(user)
    await waitFor(() => expect(line()).toHaveTextContent('Reaches 12 customers'))
    expect(line().querySelector('.odc-figure')).toHaveTextContent('12')
    await pickChannel(user, 'SMS')
    expect(line()).toHaveTextContent('Count not available')
    expect(line()).not.toHaveTextContent('12')
  })

  it('a stale count is not a number anywhere: not in the line and not in the confirmation', async () => {
    const { user } = setup()
    await writeName(user)
    await pickChannel(user)
    await writeMessage(user)
    await pickAudience(user, 'Fixed')
    await addCountRule(user)
    await waitFor(() => expect(line()).toHaveTextContent('Reaches 12 customers'))
    await pickChannel(user, 'SMS')
    await user.click(sendButton('Send now'))
    const dialog = await confirmDialog()
    expect(dialog).not.toHaveTextContent('12')
    expect(dialog).toHaveTextContent('This sends a text message to every customer who matches the rules.')
  })

  it('becomes fresh again when the rules change and are counted again', async () => {
    const { user } = setup()
    await pickChannel(user)
    await pickAudience(user, 'Fixed')
    await addCountRule(user)
    await waitFor(() => expect(line()).toHaveTextContent('Reaches 12 customers'))
    await pickChannel(user, 'SMS')
    expect(line()).toHaveTextContent('Count not available')
    mockState.total = 5
    const row = screen.getByRole('group', { name: 'Orders' })
    await user.clear(within(row).getByRole('textbox'))
    await user.type(within(row).getByRole('textbox'), '4')
    await waitFor(() => expect(line()).toHaveTextContent('Reaches 5 customers'))
  })

  it('says «Couldn\'t count the audience» when the count failed', async () => {
    mockState.audienceError = ['Something failed']
    const { user } = setup()
    await pickChannel(user)
    await pickAudience(user, 'Fixed')
    await addCountRule(user)
    await waitFor(() => expect(line()).toHaveTextContent('Couldn\'t count the audience'))
    expect(line()).not.toHaveTextContent('Reaches')
  })

  it('does not count an unfinished rule: the controller gets only the finished ones, so no request is made for a half rule', async () => {
    const { user, api } = setup()
    await pickChannel(user)
    await pickAudience(user, 'Fixed')
    await user.click(screen.getByRole('button', { name: 'Add rule' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Orders' }))
    expect(api.current.formState.changes.conditions).toEqual([])
    expect(api.current.audienceState.loading).toBe(false)
    expect(line()).toBeNull()
  })
})

// ---------------------------------------------------------------------------------------------------------------------------------
const addCountRule = async (user, value = '3') => {
  await user.click(screen.getByRole('button', { name: 'Add rule' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Orders' }))
  const row = screen.getByRole('group', { name: 'Orders' })
  await user.type(within(row).getByRole('textbox'), value)
}

// redesign D-6 (owner, 2026-10-19): fixed + later stays unconfirmed, as main; a dynamic campaign that is Active asks first
describe('fixed + later (no confirmation) and dynamic (asks only when Active)', () => {
  it('fixed + later sends the scheduled date with the chosen time, status «scheduled», and no end date', async () => {
    const { user, addCampaign } = setup()
    await readyFixed(user)
    await user.click(screen.getByRole('radio', { name: 'Schedule for later' }))
    await user.click(screen.getByRole('combobox', { name: /^Date/ }))
    const picker = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.type(within(picker).getByRole('textbox'), `${FAR_DIGITS}{Enter}`)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Time' }), '09:30')
    expect(sendButton('Schedule campaign')).toBeEnabled()
    await user.click(sendButton('Schedule campaign'))
    await waitFor(() => expect(addCampaign).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    const [overrides, body] = addCampaign.mock.calls[0]
    expect(overrides).toEqual({ end_at: undefined, enabled: true, scheduled_at: `${FAR} 09:30:00`, status: 'scheduled' })
    expect(body).toMatchObject({ scheduled_at: `${FAR} 09:30:00`, status: 'scheduled', enabled: true })
    expect(body).not.toHaveProperty('end_at')
  })

  it('dynamic + Active asks first, writes nothing until confirmed, then sends enabled, the end date and no scheduled date', async () => {
    const { user, addCampaign } = setup()
    await readyDynamic(user)
    await user.click(sendButton('Create campaign'))
    const dialog = await createDialog()
    expect(addCampaign).not.toHaveBeenCalled()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()) // initial focus is on Cancel
    await user.click(within(dialog).getByRole('button', { name: 'Create and activate' }))
    await waitFor(() => expect(addCampaign).toHaveBeenCalledTimes(1))
    const [overrides, body] = addCampaign.mock.calls[0]
    expect(overrides).toEqual({ scheduled_at: undefined, status: 'pending', end_at: `${FAR} 09:00:00`, enabled: true })
    expect(body).toMatchObject({ enabled: true, status: 'pending', audience_type: 'dynamic', end_at: `${FAR} 09:00:00` })
    expect(body).not.toHaveProperty('scheduled_at')
  })

  it('the confirmation of a dynamic + Active campaign names it and says what happens', async () => {
    const { user } = setup()
    await readyDynamic(user, 'Win-back')
    await user.click(sendButton('Create campaign'))
    const dialog = await screen.findByRole('alertdialog', { name: 'Create "Win-back" and start sending?' })
    expect(dialog).toHaveTextContent('It starts sending to the customers who match its rules. Sent messages can\'t be undone.')
    expect(within(dialog).getByRole('button', { name: 'Create and activate' })).toBeInTheDocument()
  })

  it('Cancel (or Close) on the confirmation writes nothing and leaves the form and the Active switch as they were', async () => {
    const { user, addCampaign, api, onCancel } = setup()
    await readyDynamic(user, 'Spring')
    await user.click(sendButton('Create campaign'))
    await user.click(within(await createDialog()).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await user.click(sendButton('Create campaign'))
    await user.click(within(await createDialog()).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(addCampaign).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Spring')
    expect(screen.getByLabelText('Editor title')).toHaveValue('Hello')
    expect(screen.getByRole('switch', { name: 'Active' })).toHaveAttribute('aria-checked', 'true')
    expect(api.current.formState.changes.enabled).toBe(true)
    expect(sendButton('Create campaign')).toBeEnabled()
  })

  it('a second click on «Create and activate» cannot create twice', async () => {
    const { user, addCampaign } = setup()
    addCampaign.mockImplementation(() => new Promise(() => {})) // never answers
    await readyDynamic(user)
    await user.click(sendButton('Create campaign'))
    const confirm = within(await createDialog()).getByRole('button', { name: 'Create and activate' })
    await user.click(confirm)
    await user.click(confirm)
    expect(addCampaign).toHaveBeenCalledTimes(1)
  })

  it('dynamic switched off sends enabled: false; with an end date it sends it in the format of the API', async () => {
    const { user, addCampaign } = setup()
    await writeName(user)
    await pickChannel(user)
    await writeMessage(user)
    await pickAudience(user, 'Dynamic')
    await addCountRule(user)
    await user.click(screen.getByRole('switch', { name: 'Active' }))
    await user.click(screen.getByRole('combobox', { name: /^End date/ }))
    const picker = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.type(within(picker).getByRole('textbox'), `${FAR_DIGITS}{Enter}`)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Time' }), '18:00')
    await user.click(sendButton('Create campaign'))
    await waitFor(() => expect(addCampaign).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument() // redesign D-6: Active off sends nothing, so no dialog
    const [overrides] = addCampaign.mock.calls[0]
    expect(overrides).toEqual({ scheduled_at: undefined, status: 'pending', end_at: `${FAR} 18:00:00`, enabled: false })
  })

  it('a fixed campaign that was scheduled and then turned dynamic sends no scheduled date (M-CA13)', async () => {
    const { user, addCampaign, api } = setup()
    await readyFixed(user)
    await user.click(screen.getByRole('radio', { name: 'Schedule for later' }))
    await user.click(screen.getByRole('combobox', { name: /^Date/ }))
    const picker = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.type(within(picker).getByRole('textbox'), `${FAR_DIGITS}{Enter}`)
    expect(api.current.formState.changes.scheduled_at).toBe(`${FAR} 09:00:00`)
    await pickAudience(user, 'Dynamic')
    await pickEndDate(user)
    await user.click(sendButton('Create campaign'))
    await confirmCreate(user)
    await waitFor(() => expect(addCampaign).toHaveBeenCalledTimes(1))
    const [, body] = addCampaign.mock.calls[0]
    expect(body).not.toHaveProperty('scheduled_at')
    expect(body.status).toBe('pending')
  })

  it('asks for the date of a scheduled fixed campaign by name', async () => {
    const { user } = setup()
    await readyFixed(user)
    await user.click(screen.getByRole('radio', { name: 'Schedule for later' }))
    expect(sendButton('Schedule campaign')).toBeDisabled()
    expect(footer()).toHaveTextContent('Scheduled date is required')
  })
})

describe('the error of the POST · M-CA6', () => {
  it('opens an alert dialog with the error, keeps everything as typed, and does not close the form', async () => {
    const { user, addCampaign, onCancel } = setup()
    addCampaign.mockResolvedValue({ ok: false, error: ['Invalid audience'] })
    await readyDynamic(user, 'Spring')
    await user.click(sendButton('Create campaign'))
    await confirmCreate(user)
    const alert = await screen.findByRole('alertdialog', { name: 'Campaign' })
    expect(alert).toHaveTextContent('Invalid audience')
    await user.click(within(alert).getByRole('button', { name: 'Accept' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Spring')
    expect(screen.getByLabelText('Editor title')).toHaveValue('Hello')
    expect(sendButton('Create campaign')).toBeEnabled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('after a failed confirmed send the confirmation is gone and the error is shown', async () => {
    const { user, addCampaign } = setup()
    addCampaign.mockResolvedValue({ ok: false, error: 'Something failed' })
    await readyFixed(user)
    await user.click(sendButton('Send now'))
    const dialog = await confirmDialog()
    await user.click(within(dialog).getByRole('button', { name: /^Send / }))
    const alert = await screen.findByRole('alertdialog', { name: 'Campaign' })
    expect(alert).toHaveTextContent('Something failed')
    expect(screen.queryByRole('alertdialog', { name: /^Send / })).not.toBeInTheDocument()
  })

  it('says something even when the API sent nothing', async () => {
    const { user, addCampaign } = setup()
    addCampaign.mockResolvedValue({ ok: false, error: null })
    await readyDynamic(user)
    await user.click(sendButton('Create campaign'))
    await confirmCreate(user)
    const alert = await screen.findByRole('alertdialog', { name: 'Campaign' })
    expect(alert).toHaveTextContent('The campaign could not be created.')
  })
})

describe('onDirtyChange · as soon as any field has a value', () => {
  it('starts false and turns true on the first typed value', async () => {
    const { user, onDirtyChange } = setup()
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    expect(onDirtyChange).not.toHaveBeenCalledWith(true)
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'a')
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
  })

  it('a message typed in the editor makes it dirty too, and so does a rule', async () => {
    const { user, onDirtyChange } = setup()
    await pickChannel(user)
    expect(onDirtyChange).not.toHaveBeenCalledWith(true)
    await user.type(screen.getByLabelText('Editor title'), 'a')
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
  })

  it('choosing a channel or an audience alone is not typing', async () => {
    const { user, onDirtyChange } = setup()
    await pickChannel(user)
    await pickAudience(user, 'Fixed')
    expect(onDirtyChange).not.toHaveBeenCalledWith(true)
  })
})

describe('the translations · the words come from t()', () => {
  it('reads the button and the reasons from the catalog of the project', async () => {
    mockState.catalog = { CAMPAIGNS_ACTION_CREATE: 'Crear campaña', CAMPAIGNS_MISSING_NAME: 'Agrega un nombre' }
    setup()
    expect(screen.getByRole('button', { name: 'Crear campaña' })).toBeDisabled()
    expect(footer()).toHaveTextContent('Agrega un nombre')
  })
})

// ---------------------------------------------------------------------------------------------------------------------------------
describe('CampaignDelivery · inside the form', () => {
  it('fixed: ASAP is chosen by default and has no clock time in its label (M-CA7)', async () => {
    const { user } = setup()
    await pickAudience(user, 'Fixed')
    const asap = screen.getByRole('radio', { name: 'As soon as possible' })
    expect(asap).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Schedule for later' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByRole('combobox', { name: 'Time' })).not.toBeInTheDocument()
  })

  // redesign (row 39, campaign P-4, D-52): 09:00 is proposed; main sent 00:00 without showing it
  it('Schedule shows the date and the time, with 09:00 as the default time', async () => {
    const { user } = setup()
    await pickAudience(user, 'Fixed')
    await user.click(screen.getByRole('radio', { name: 'Schedule for later' }))
    expect(screen.getByRole('combobox', { name: /^Date/ })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Time' })).toHaveValue('09:00')
  })

  it('the time is chosen in steps of 30 minutes, 24 hours by default', async () => {
    const { user } = setup()
    await pickAudience(user, 'Fixed')
    await user.click(screen.getByRole('radio', { name: 'Schedule for later' }))
    const options = within(screen.getByRole('combobox', { name: 'Time' })).getAllByRole('option')
    expect(options).toHaveLength(48)
    expect(options[0]).toHaveTextContent('00:00')
    expect(options[1]).toHaveTextContent('00:30')
    expect(options[47]).toHaveTextContent('23:30')
  })

  it('the time is in 12 hours when the project says hh:mm', async () => {
    mockState.configs = { dates_general_format: { value: 'DD/MM/YYYY hh:mm a' }, general_hour_format: { value: 'hh:mm a' } }
    const { user } = setup()
    await pickAudience(user, 'Fixed')
    await user.click(screen.getByRole('radio', { name: 'Schedule for later' }))
    const select = screen.getByRole('combobox', { name: 'Time' })
    const options = within(select).getAllByRole('option')
    expect(options[0]).toHaveTextContent('12:00 AM')
    expect(options[19]).toHaveTextContent('9:30 AM')
    expect(options[19]).toHaveAttribute('value', '09:30')
    expect(options[47]).toHaveTextContent('11:30 PM')
    await user.selectOptions(select, '09:30')
    expect(select).toHaveValue('09:30')
  })

  it('the scheduled value is the day and the chosen time, as the API takes it, and the status becomes «scheduled»', async () => {
    const { user, api } = setup()
    await pickAudience(user, 'Fixed')
    await user.click(screen.getByRole('radio', { name: 'Schedule for later' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Time' }), '13:30')
    expect(api.current.formState.changes.scheduled_at).toBeUndefined() // no day yet: the time waits in the form
    await user.click(screen.getByRole('combobox', { name: /^Date/ }))
    const picker = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.type(within(picker).getByRole('textbox'), `${FAR_DIGITS}{Enter}`)
    expect(api.current.formState.changes.scheduled_at).toBe(`${FAR} 13:30:00`)
    expect(api.current.formState.changes.status).toBe('scheduled')
    // changing the time after the day rewrites the value
    await user.selectOptions(screen.getByRole('combobox', { name: 'Time' }), '08:00')
    expect(api.current.formState.changes.scheduled_at).toBe(`${FAR} 08:00:00`)
    // the day is shown in the project format, never ISO
    expect(screen.getByRole('combobox', { name: /^Date/ })).toHaveTextContent(FAR_TYPED)
    expect(screen.getByRole('combobox', { name: /^Date/ }).textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('back to ASAP clears the scheduled date and goes back to «pending»', async () => {
    const { user, api } = setup()
    await pickAudience(user, 'Fixed')
    await user.click(screen.getByRole('radio', { name: 'Schedule for later' }))
    await user.click(screen.getByRole('combobox', { name: /^Date/ }))
    const picker = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.type(within(picker).getByRole('textbox'), `${FAR_DIGITS}{Enter}`)
    expect(api.current.formState.changes.status).toBe('scheduled')
    await user.click(screen.getByRole('radio', { name: 'As soon as possible' }))
    expect(api.current.formState.changes.scheduled_at).toBeNull()
    expect(api.current.formState.changes.status).toBe('pending')
  })

  it('the first day to schedule is tomorrow: today is refused', async () => {
    const { user, api } = setup()
    await pickAudience(user, 'Fixed')
    await user.click(screen.getByRole('radio', { name: 'Schedule for later' }))
    await user.click(screen.getByRole('combobox', { name: /^Date/ }))
    const picker = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.type(within(picker).getByRole('textbox'), dayjs().format('DDMMYYYY'))
    expect(await within(picker).findByRole('alert')).toHaveTextContent('That date is not available.')
    expect(api.current.formState.changes.scheduled_at).toBeUndefined()
  })

  it('tomorrow is accepted', async () => {
    const { user, api } = setup()
    await pickAudience(user, 'Fixed')
    await user.click(screen.getByRole('radio', { name: 'Schedule for later' }))
    await user.click(screen.getByRole('combobox', { name: /^Date/ }))
    const picker = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.type(within(picker).getByRole('textbox'), dayjs().add(1, 'day').format('DDMMYYYY'))
    expect(api.current.formState.changes.scheduled_at).toBe(`${dayjs().add(1, 'day').format('YYYY-MM-DD')} 09:00:00`)
  })

  it('M-CA12: the choice «Schedule» survives a change of channel (it lives in the form, not in the section)', async () => {
    const { user } = setup()
    await pickChannel(user, 'Email')
    await pickAudience(user, 'Fixed')
    await user.click(screen.getByRole('radio', { name: 'Schedule for later' }))
    await pickChannel(user, 'SMS')
    expect(screen.getByRole('radio', { name: 'Schedule for later' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('combobox', { name: 'Time' })).toBeInTheDocument()
  })

  it('M-CA12: it survives a trip through the dynamic audience and back', async () => {
    const { user } = setup()
    await pickAudience(user, 'Fixed')
    await user.click(screen.getByRole('radio', { name: 'Schedule for later' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Time' }), '10:00')
    await pickAudience(user, 'Dynamic')
    await pickAudience(user, 'Fixed')
    expect(screen.getByRole('radio', { name: 'Schedule for later' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('combobox', { name: 'Time' })).toHaveValue('10:00')
  })

  it('dynamic: «Active» is on by default, there is an end date, and no ASAP / Schedule choice', async () => {
    const { user, api } = setup()
    await pickAudience(user, 'Dynamic')
    expect(screen.getByRole('switch', { name: 'Active' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('radio', { name: 'As soon as possible' })).not.toBeInTheDocument()
    const end = screen.getByRole('combobox', { name: /^End date/ })
    expect(end).toBeInTheDocument()
    expect(screen.getByText('The campaign stops sending on this date.')).toBeInTheDocument()
    expect(screen.queryByText(/Optional/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('switch', { name: 'Active' }))
    expect(api.current.formState.changes.enabled).toBe(false)
    expect(screen.getByRole('switch', { name: 'Active' })).toHaveAttribute('aria-checked', 'false')
  })

  it('dynamic: the end date may be today, and a «Clear» on the picker removes it', async () => {
    const { user, api } = setup()
    await pickAudience(user, 'Dynamic')
    await user.click(screen.getByRole('combobox', { name: /^End date/ }))
    let picker = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.type(within(picker).getByRole('textbox'), `${dayjs().format('DDMMYYYY')}{Enter}`)
    expect(api.current.formState.changes.end_at).toBe(`${dayjs().format('YYYY-MM-DD')} 09:00:00`)
    await user.click(screen.getByRole('combobox', { name: /^End date/ }))
    picker = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.click(within(picker).getByRole('button', { name: 'Clear' }))
    expect(api.current.formState.changes.end_at).toBeNull()
  })
})

// ---------------------------------------------------------------------------------------------------------------------------------
// The rules, by themselves: a stateful host that keeps the list, as the form does.
const RulesHost = ({ initial = [], onChange, ...props }) => {
  const [conditions, setConditions] = useState(initial)
  return (
    <CampaignRules
      conditions={conditions}
      formatDate={(stamp) => dayjs(String(stamp).slice(0, 10)).format('DD/MM/YYYY')}
      onChange={(next) => { onChange?.(next); setConditions(next) }}
      {...props}
    />
  )
}
const rulesSetup = (props = {}) => {
  const onChange = vi.fn()
  const user = userEvent.setup()
  render(<RulesHost onChange={onChange} {...props} />)
  return { onChange, user }
}
const last = (spy) => spy.mock.calls[spy.mock.calls.length - 1][0]
const addRule = async (user, name) => {
  await user.click(screen.getByRole('button', { name: 'Add rule' }))
  await user.click(await screen.findByRole('menuitem', { name }))
}

describe('CampaignRules · one row per rule, in the order of the types', () => {
  it('says there are no rules yet, and offers the four types in «Add rule»', async () => {
    const { user } = rulesSetup()
    expect(screen.getByText('No rules yet. Add at least one to choose who receives this campaign.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add rule' }))
    const items = await screen.findAllByRole('menuitem')
    expect(items.map(item => item.textContent)).toEqual(['Orders', 'Sign-up date', 'Last order date', 'Open carts'])
  })

  it('offers only the types not used yet (one rule per type, as today), and none when all are used', async () => {
    const { user } = rulesSetup({
      initial: [
        { type: 'orders_count', condition: '>', value: 1 },
        { type: 'user_created_at', date_condition: '<', date: '2099-01-01 00:00:00', max_date: null }
      ]
    })
    await user.click(screen.getByRole('button', { name: 'Add rule' }))
    expect((await screen.findAllByRole('menuitem')).map(item => item.textContent)).toEqual(['Last order date', 'Open carts'])
    await user.keyboard('{Escape}')
    cleanup()
    rulesSetup({
      initial: [
        { type: 'orders_count', condition: '>', value: 1 },
        { type: 'user_created_at', date_condition: '<', date: '2099-01-01 00:00:00', max_date: null },
        { type: 'user_last_order_at', date_condition: '<', date: '2099-01-01 00:00:00', max_date: null },
        { type: 'user_last_open_cart_at', date_condition: '<', date: '2099-01-01 00:00:00', max_date: null }
      ]
    })
    expect(screen.queryByRole('button', { name: 'Add rule' })).not.toBeInTheDocument()
  })

  it('draws the rows in the order of the types, whatever the order they were added in', async () => {
    const { user } = rulesSetup()
    await addRule(user, 'Open carts')
    await addRule(user, 'Orders')
    const groups = screen.getAllByRole('group').filter(group => ['Orders', 'Open carts'].includes(group.getAttribute('aria-label')))
    expect(groups.map(group => group.getAttribute('aria-label'))).toEqual(['Orders', 'Open carts'])
  })

  it('adding Orders makes an unfinished row: «More than» chosen, no number, and the reason shown inline', async () => {
    const { user, onChange } = rulesSetup()
    await addRule(user, 'Orders')
    const row = screen.getByRole('group', { name: 'Orders' })
    expect(within(row).getByRole('button', { name: 'More than' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(row).getByRole('button', { name: 'Less than' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(row).getByRole('textbox')).toHaveValue('')
    expect(row).toHaveTextContent('Enter a number')
    expect(last(onChange)).toEqual([{ type: 'orders_count', condition: '>', value: null }])
  })

  it('the count rule sends today\'s shape: { type, condition, value }, with « > » and « < » and no «exactly»', async () => {
    const { user, onChange } = rulesSetup()
    await addRule(user, 'Orders')
    const row = screen.getByRole('group', { name: 'Orders' })
    expect(within(row).getAllByRole('button').map(button => button.textContent).filter(text => /than|Exactly/.test(text))).toEqual(['More than', 'Less than'])
    await user.type(within(row).getByRole('textbox'), '7')
    expect(last(onChange)).toEqual([{ type: 'orders_count', condition: '>', value: 7 }])
    expect(row).not.toHaveTextContent('Enter a number')
    await user.click(within(row).getByRole('button', { name: 'Less than' }))
    expect(last(onChange)).toEqual([{ type: 'orders_count', condition: '<', value: null }]) // main clears the value when the operator changes
    await user.type(within(row).getByRole('textbox'), '2')
    expect(last(onChange)).toEqual([{ type: 'orders_count', condition: '<', value: 2 }])
  })

  it('«more than 0» is a rule, and «less than 0» is never one (M/CampaignAmountOption:86-92)', async () => {
    const { user, onChange } = rulesSetup()
    await addRule(user, 'Orders')
    const row = screen.getByRole('group', { name: 'Orders' })
    await user.type(within(row).getByRole('textbox'), '0')
    expect(last(onChange)).toEqual([{ type: 'orders_count', condition: '>', value: 0 }])
    await user.click(within(row).getByRole('button', { name: 'Less than' }))
    // typed in the field, a 0 is held at the minimum of «less than» (1); main cleared it. Either way it is never { '<', 0 }
    await user.type(within(row).getByRole('textbox'), '0')
    expect(last(onChange)[0].value).not.toBe(0)
    expect([null, 1]).toContain(last(onChange)[0].value)
  })

  it('a «less than 0» that arrives by other ways is an unfinished row, not a rule', () => {
    rulesSetup({ initial: [{ type: 'orders_count', condition: '<', value: 0 }] })
    expect(screen.getByRole('group', { name: 'Orders' })).toHaveTextContent('Enter a number')
  })

  it('the arrows stop at the minimum: 0 for «more than», 1 for «less than»', async () => {
    const { user, onChange } = rulesSetup()
    await addRule(user, 'Orders')
    const row = screen.getByRole('group', { name: 'Orders' })
    await user.type(within(row).getByRole('textbox'), '1')
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
    expect(last(onChange)).toEqual([{ type: 'orders_count', condition: '>', value: 0 }])
    await user.click(within(row).getByRole('button', { name: 'Less than' }))
    await user.type(within(row).getByRole('textbox'), '2')
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
    expect(last(onChange)).toEqual([{ type: 'orders_count', condition: '<', value: 1 }])
  })

  it('the number is a whole number: a decimal point is not kept', async () => {
    const { user, onChange } = rulesSetup()
    await addRule(user, 'Orders')
    const row = screen.getByRole('group', { name: 'Orders' })
    await user.type(within(row).getByRole('textbox'), '2.7')
    expect(Number.isInteger(last(onChange)[0].value)).toBe(true)
  })

  it('a date rule starts on «Before», with no date, and says so', async () => {
    const { user, onChange } = rulesSetup()
    await addRule(user, 'Sign-up date')
    const row = screen.getByRole('group', { name: 'Sign-up date' })
    expect(within(row).getByRole('button', { name: 'Before' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(row).getByRole('button', { name: 'Date range' })).toHaveAttribute('aria-pressed', 'false')
    expect(row).toHaveTextContent('Pick a date')
    expect(last(onChange)).toEqual([{ type: 'user_created_at', date_condition: '<', date: null, max_date: null }])
  })

  it('Before sends today\'s shape: the date at 00:00:00 and max_date null', async () => {
    const { user, onChange } = rulesSetup()
    await addRule(user, 'Last order date')
    const row = screen.getByRole('group', { name: 'Last order date' })
    await user.click(within(row).getByRole('combobox'))
    const picker = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.type(within(picker).getByRole('textbox'), `${FAR_DIGITS}{Enter}`)
    expect(last(onChange)).toEqual([{ type: 'user_last_order_at', date_condition: '<', date: `${FAR} 00:00:00`, max_date: null }])
    expect(within(row).getByRole('combobox')).toHaveTextContent(FAR_TYPED)
    expect(row).not.toHaveTextContent('Pick a date')
  })

  it('Date range sends date and max_date, both at 00:00:00 (K/CampaignSignUpOption:44-47)', async () => {
    const { user, onChange } = rulesSetup()
    await addRule(user, 'Open carts')
    const row = screen.getByRole('group', { name: 'Open carts' })
    await user.click(within(row).getByRole('button', { name: 'Date range' }))
    expect(last(onChange)).toEqual([{ type: 'user_last_open_cart_at', date_condition: '><', date: null, max_date: null }])
    expect(row).toHaveTextContent('Pick both dates')
    await user.click(row.querySelector('[aria-haspopup="dialog"]'))
    const popover = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.type(within(popover).getByLabelText('From'), '01032099')
    await user.type(within(popover).getByLabelText('To'), '15032099')
    await user.click(within(popover).getByRole('button', { name: 'Done' }))
    expect(last(onChange)).toEqual([{ type: 'user_last_open_cart_at', date_condition: '><', date: '2099-03-01 00:00:00', max_date: '2099-03-15 00:00:00' }])
    expect(row).not.toHaveTextContent('Pick both dates')
  })

  it('same day for both ends is refused inline with MAX_DATE_AFTER_DATE, and the row stays unfinished', async () => {
    const { user, onChange } = rulesSetup()
    await addRule(user, 'Sign-up date')
    const row = screen.getByRole('group', { name: 'Sign-up date' })
    await user.click(within(row).getByRole('button', { name: 'Date range' }))
    await user.click(row.querySelector('[aria-haspopup="dialog"]'))
    const popover = await screen.findByRole('dialog', { name: 'Select a date' })
    await user.type(within(popover).getByLabelText('From'), '01032099')
    await user.type(within(popover).getByLabelText('To'), '01032099')
    await user.click(within(popover).getByRole('button', { name: 'Done' }))
    expect(row).toHaveTextContent('The Max date must be a date after date')
    expect(ruleOf(last(onChange), 'user_created_at').date).toBe('2099-03-01 00:00:00')
    expect(ruleOf(last(onChange), 'user_created_at').max_date).toBe('2099-03-01 00:00:00')
  })

  it('changing a date rule from Before to Date range clears the date (as handleChangeOption does)', async () => {
    const { user, onChange } = rulesSetup({ initial: [{ type: 'user_created_at', date_condition: '<', date: '2099-03-20 00:00:00', max_date: null }] })
    const row = screen.getByRole('group', { name: 'Sign-up date' })
    await user.click(within(row).getByRole('button', { name: 'Date range' }))
    expect(last(onChange)).toEqual([{ type: 'user_created_at', date_condition: '><', date: null, max_date: null }])
    await user.click(within(row).getByRole('button', { name: 'Before' }))
    expect(last(onChange)).toEqual([{ type: 'user_created_at', date_condition: '<', date: null, max_date: null }])
  })

  it('shows a finished range with the dates in the project format, never ISO', () => {
    rulesSetup({ initial: [{ type: 'user_created_at', date_condition: '><', date: '2099-03-01 00:00:00', max_date: '2099-03-15 00:00:00' }] })
    const row = screen.getByRole('group', { name: 'Sign-up date' })
    expect(row).toHaveTextContent('01/03/2099')
    expect(row).toHaveTextContent('15/03/2099')
    expect(row.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('removes a rule with a button that names it: «Remove rule Orders»', async () => {
    const { user, onChange } = rulesSetup({
      initial: [
        { type: 'orders_count', condition: '>', value: 1 },
        { type: 'user_created_at', date_condition: '<', date: '2099-03-20 00:00:00', max_date: null }
      ]
    })
    await user.click(screen.getByRole('button', { name: 'Remove rule Orders' }))
    expect(last(onChange)).toEqual([{ type: 'user_created_at', date_condition: '<', date: '2099-03-20 00:00:00', max_date: null }])
    expect(screen.queryByRole('group', { name: 'Orders' })).not.toBeInTheDocument()
  })

  it('refuses to remove the last finished rule, as main does («Conditions field is required»), inline and with no alert', async () => {
    const { user, onChange } = rulesSetup({ initial: [{ type: 'orders_count', condition: '>', value: 1 }] })
    await user.click(screen.getByRole('button', { name: 'Remove rule Orders' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('group', { name: 'Orders' })).toBeInTheDocument()
    expect(screen.getByText('Conditions field is required')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('the refusal goes away with the next change', async () => {
    const { user } = rulesSetup({ initial: [{ type: 'orders_count', condition: '>', value: 1 }] })
    await user.click(screen.getByRole('button', { name: 'Remove rule Orders' }))
    expect(screen.getByText('Conditions field is required')).toBeInTheDocument()
    await addRule(user, 'Sign-up date')
    expect(screen.queryByText('Conditions field is required')).not.toBeInTheDocument()
  })

  it('an unfinished row can always be removed (it is not a rule yet: main\'s modal let you cancel it)', async () => {
    const { user, onChange } = rulesSetup()
    await addRule(user, 'Orders')
    await user.click(screen.getByRole('button', { name: 'Remove rule Orders' }))
    expect(last(onChange)).toEqual([])
    expect(screen.queryByText('Conditions field is required')).not.toBeInTheDocument()
  })

  it('an unfinished row does not make the last finished rule removable', async () => {
    const { user, onChange } = rulesSetup({ initial: [{ type: 'orders_count', condition: '>', value: 1 }, { type: 'user_created_at', date_condition: '<', date: null, max_date: null }] })
    await user.click(screen.getByRole('button', { name: 'Remove rule Orders' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('Conditions field is required')).toBeInTheDocument()
  })

  it('names a rule it cannot edit instead of breaking (a type the API may send)', () => {
    rulesSetup({ initial: [{ type: 'something_else', value: 1 }] })
    expect(screen.getByRole('group', { name: 'Rule' })).toBeInTheDocument()
  })
})

// redesign CA-R2 (P2): the focus follows the list. Adding a rule lands on the new rule's first control; removing one lands on its neighbor
// (product.md › Control semantics), or on «Add rule» when no rule is left.
describe('CampaignRules · focus after adding and removing a rule (CA-R2 P2)', () => {
  it('adding a count rule moves the focus to its segmented control', async () => {
    const { user } = rulesSetup()
    await addRule(user, 'Orders')
    const row = screen.getByRole('group', { name: 'Orders' })
    await waitFor(() => expect(within(row).getByRole('button', { name: 'More than' })).toHaveFocus())
  })

  it('adding a date rule moves the focus to its segmented control', async () => {
    const { user } = rulesSetup()
    await addRule(user, 'Sign-up date')
    const row = screen.getByRole('group', { name: 'Sign-up date' })
    await waitFor(() => expect(within(row).getByRole('button', { name: 'Before' })).toHaveFocus())
  })

  it('adding the last type left (the menu goes away with it) still lands on the new rule', async () => {
    const { user } = rulesSetup({
      initial: [
        { type: 'orders_count', condition: '>', value: 1 },
        { type: 'user_created_at', date_condition: '<', date: '2099-01-01 00:00:00', max_date: null },
        { type: 'user_last_order_at', date_condition: '<', date: '2099-01-01 00:00:00', max_date: null }
      ]
    })
    await addRule(user, 'Open carts')
    expect(screen.queryByRole('button', { name: 'Add rule' })).not.toBeInTheDocument()
    const row = screen.getByRole('group', { name: 'Open carts' })
    await waitFor(() => expect(within(row).getByRole('button', { name: 'Before' })).toHaveFocus())
  })

  it('does not take the focus when the rules change for another reason (typing a number stays in the field)', async () => {
    const { user } = rulesSetup()
    await addRule(user, 'Orders')
    const field = within(screen.getByRole('group', { name: 'Orders' })).getByRole('textbox')
    await user.click(field)
    await user.type(field, '3')
    expect(field).toHaveFocus()
  })

  it('removing a rule moves the focus to the remove button of the next one', async () => {
    const { user } = rulesSetup({
      initial: [
        { type: 'orders_count', condition: '>', value: 1 },
        { type: 'user_created_at', date_condition: '<', date: '2099-03-20 00:00:00', max_date: null }
      ]
    })
    await user.click(screen.getByRole('button', { name: 'Remove rule Orders' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove rule Sign-up date' })).toHaveFocus())
  })

  it('removing the last rule of the list moves the focus to the remove button of the one before', async () => {
    const { user } = rulesSetup({
      initial: [
        { type: 'orders_count', condition: '>', value: 1 },
        { type: 'user_created_at', date_condition: '<', date: '2099-03-20 00:00:00', max_date: null }
      ]
    })
    await user.click(screen.getByRole('button', { name: 'Remove rule Sign-up date' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove rule Orders' })).toHaveFocus())
  })

  it('removing the only rule moves the focus to «Add rule»', async () => {
    const { user } = rulesSetup()
    await addRule(user, 'Orders')
    await user.click(screen.getByRole('button', { name: 'Remove rule Orders' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add rule' })).toHaveFocus())
  })

  it('a removal that main refuses (the last finished rule) leaves the focus where it is', async () => {
    const { user } = rulesSetup({ initial: [{ type: 'orders_count', condition: '>', value: 1 }] })
    const remove = screen.getByRole('button', { name: 'Remove rule Orders' })
    await user.click(remove)
    expect(screen.getByText('Conditions field is required')).toBeInTheDocument()
    expect(remove).toHaveFocus()
  })
})

const ruleOf = (list, type) => list.find(item => item.type === type)

// ---------------------------------------------------------------------------------------------------------------------------------
describe('the rules in the form · the controller gets only the finished ones', () => {
  it('an unfinished row blocks the button with its name; finishing it sends the rule', async () => {
    const { user, api, addCampaign } = setup()
    await writeName(user)
    await pickChannel(user)
    await writeMessage(user)
    await pickAudience(user, 'Fixed')
    await user.click(screen.getByRole('button', { name: 'Add rule' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Orders' }))
    expect(sendButton('Send now')).toBeDisabled()
    expect(footer()).toHaveTextContent('Finish the rule "Orders"')
    expect(api.current.formState.changes.conditions).toEqual([])
    await user.type(within(screen.getByRole('group', { name: 'Orders' })).getByRole('textbox'), '3')
    expect(api.current.formState.changes.conditions).toEqual([{ type: 'orders_count', condition: '>', value: 3 }])
    expect(sendButton('Send now')).toBeEnabled()
    await user.click(sendButton('Send now'))
    const dialog = await confirmDialog()
    expect(addCampaign).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: /^Send / }))
    await waitFor(() => expect(addCampaign).toHaveBeenCalledTimes(1))
    expect(addCampaign.mock.calls[0][1].conditions).toEqual([{ type: 'orders_count', condition: '>', value: 3 }])
  })

  it('a rule counts as a value: the form becomes dirty', async () => {
    const { user, onDirtyChange } = setup()
    await user.click(screen.getByRole('button', { name: 'Add rule' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Orders' }))
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
  })
})
