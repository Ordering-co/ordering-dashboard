// redesign CA-B2 (decision 3|4): the six channel editors gain three opt-in props
// (hideActions, previewOnly, onConfigStateChange). Defaults must keep today's render.
import React, { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, defaultTheme } from '~/__tests__/helpers/testUtils'

const project = vi.hoisted(() => ({ subdomain: 'ordering' }))

vi.mock('../../../../../index', () => {
  return {
    useLanguage: () => [{}, (key, fallback) => fallback],
    useApi: () => [{}, { configurations: { subdomain: project.subdomain } }],
    useEvent: () => [{ emit: () => {} }],
    HtmlEditor: ({ UIComponent, ...props }) => (
      <UIComponent {...props} imageListState={{ images: [], loading: false }} insertImageState={{ loading: false, change: {} }} />
    )
  }
})

vi.mock('../../Shared', () => ({
  Alert: ({ open, content }) => <div data-testid='own-alert'>{open ? content : ''}</div>,
  Modal: () => null
}))

vi.mock('../../Settings/SettingsList', () => ({
  SettingsList: ({ category }) => <div data-testid='settings-list'>{(category?.configs ?? []).map(config => config.key).join(',')}</div>
}))

import { CampaignEmail } from '../CampaignEmail'
import { getUtils } from '../CampaignEmail/utils'
import { CampaignSMS } from '../CampaignSMS'
import { CampaignNotification } from '../CampaignNotification'
import { CampaignWhatsapp } from '../CampaignWhatsapp'
import { CampaignPopup } from '../CampaignPopup'
import { CampaignWebHook } from '../CampaignWebHook'

beforeAll(() => {
  Range.prototype.getClientRects = () => []
  Range.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 })
  document.elementFromPoint = () => null
})

const theme = {
  ...defaultTheme,
  images: { general: { mobileHalfMask: 'mask.png', whatsappHeader: 'header.png' } }
}

const contactState = {
  loading: false,
  changes: {
    contact_type: 'email',
    contact_data: { title: 'Hello title', body: 'World body', webhook: 'https://example.test/hook' }
  }
}

const baseProps = {
  isAddMode: true,
  contactState,
  formState: { changes: {} },
  handleChangeData: () => {},
  handleChangeContact: () => {},
  handleUpdateContact: () => {},
  handleAddCampaign: () => {}
}

const configured = (key, keys) => ({
  loading: false,
  categories: [{ key, configs: keys.map(k => ({ key: k, value: 'x' })) }]
})
const loading = { loading: true, categories: [] }

const emailKeys = ['email_smtp_use_default', 'email_smtp_host', 'email_smtp_username', 'email_smtp_password', 'email_smtp_encryption', 'email_smtp_port']
const pushKeys = ['onesignal_user_auth', 'onesignal_orderingapp_id', 'onesignal_businessapp_id', 'onesignal_deliveryapp_id', 'notification_toast']

const gated = [
  { name: 'email', Editor: CampaignEmail, ready: configured('pro_white_labeling', emailKeys) },
  { name: 'sms', Editor: CampaignSMS, ready: configured('twilio', ['twilio_sid', 'twilio_token']) },
  { name: 'push', Editor: CampaignNotification, ready: configured('notification', pushKeys) }
]
const ungated = [
  { name: 'whatsapp', Editor: CampaignWhatsapp },
  { name: 'popup', Editor: CampaignPopup },
  { name: 'webhook', Editor: CampaignWebHook }
]

const addButton = () => screen.queryByRole('button', { name: 'Add' })

describe('channel editors: defaults keep today\'s render', () => {
  gated.forEach(({ name, Editor, ready }) => {
    it(`${name} shows the Add button, the fields and the facsimile`, () => {
      renderWithProviders(<Editor {...baseProps} categoryList={ready} />, { theme })
      expect(addButton()).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Title')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Hello title' })).toBeInTheDocument()
    })
  })

  ungated.forEach(({ name, Editor }) => {
    it(`${name} shows the Add button and the fields`, () => {
      renderWithProviders(<Editor {...baseProps} categoryList={loading} />, { theme })
      expect(addButton()).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Title')).toBeInTheDocument()
    })
  })

  it('SMS and push still show the config gate and the SettingsList when not configured', () => {
    const unset = { loading: false, categories: [{ key: 'twilio', configs: [{ key: 'twilio_sid', value: '' }] }] }
    renderWithProviders(<CampaignSMS {...baseProps} categoryList={unset} />, { theme })
    expect(screen.getByRole('button', { name: 'Tech Support' })).toBeInTheDocument()
    expect(screen.getByTestId('settings-list')).toBeInTheDocument()
    expect(addButton()).toBeNull()
  })
})

describe('channel editors: hideActions', () => {
  gated.forEach(({ name, Editor, ready }) => {
    it(`${name} hides the Add button and keeps the fields and the facsimile`, () => {
      renderWithProviders(<Editor {...baseProps} categoryList={ready} hideActions />, { theme })
      expect(addButton()).toBeNull()
      expect(screen.getByPlaceholderText('Title')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Hello title' })).toBeInTheDocument()
    })
  })

  ungated.forEach(({ name, Editor }) => {
    it(`${name} hides the Add button and keeps the fields`, () => {
      renderWithProviders(<Editor {...baseProps} categoryList={loading} hideActions />, { theme })
      expect(addButton()).toBeNull()
      expect(screen.getByPlaceholderText('Title')).toBeInTheDocument()
    })
  })

  it('email with hideActions keeps the default template button and the rich editor', () => {
    renderWithProviders(<CampaignEmail {...baseProps} categoryList={configured('pro_white_labeling', emailKeys)} hideActions />, { theme })
    expect(screen.getByRole('button', { name: 'Use default template' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Messages' })).toHaveAttribute('contenteditable', 'true')
  })

  it('SMS with hideActions keeps the config gate and the SettingsList when not configured', () => {
    const unset = { loading: false, categories: [{ key: 'twilio', configs: [{ key: 'twilio_sid', value: '' }] }] }
    renderWithProviders(<CampaignSMS {...baseProps} categoryList={unset} hideActions />, { theme })
    expect(screen.getByRole('button', { name: 'Tech Support' })).toBeInTheDocument()
    expect(screen.getByTestId('settings-list')).toBeInTheDocument()
  })

  ;[...gated.map(g => [g.name, g.Editor, g.ready]), ...ungated.map(g => [g.name, g.Editor, loading])].forEach(([name, Editor, categoryList]) => {
    it(`${name} mounts its own validation alert by default and not with hideActions (the host validates)`, () => {
      const { unmount } = renderWithProviders(<Editor {...baseProps} categoryList={categoryList} />, { theme })
      expect(screen.getByTestId('own-alert')).toBeInTheDocument()
      unmount()
      renderWithProviders(<Editor {...baseProps} categoryList={categoryList} hideActions />, { theme })
      expect(screen.queryByTestId('own-alert')).toBeNull()
    })
  })
})

describe('channel editors: previewOnly', () => {
  const noInputs = () => {
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(addButton()).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tech Support' })).toBeNull()
    expect(screen.queryByTestId('settings-list')).toBeNull()
  }

  ;[
    ['sms', CampaignSMS],
    ['push', CampaignNotification],
    ['whatsapp', CampaignWhatsapp],
    ['popup', CampaignPopup]
  ].forEach(([name, Editor]) => {
    it(`${name} renders only the facsimile with title and body`, () => {
      // categoryList is loading: previewOnly must not wait for the gate
      renderWithProviders(<Editor {...baseProps} categoryList={loading} previewOnly />, { theme })
      expect(screen.getByRole('heading', { name: 'Hello title' })).toBeInTheDocument()
      expect(screen.getByText('World body')).toBeInTheDocument()
      noInputs()
    })
  })

  it('email renders only the facsimile (title and body HTML in a sandboxed iframe) and never mounts the rich editor', () => {
    const state = {
      loading: false,
      changes: { contact_data: { title: 'Hello title', body: '<p data-testid="rich">World body</p>' } }
    }
    renderWithProviders(<CampaignEmail {...baseProps} contactState={state} categoryList={loading} previewOnly />, { theme })
    expect(screen.getByRole('heading', { name: 'Hello title' })).toBeInTheDocument()
    expect(screen.getByTitle('Email preview').getAttribute('srcdoc')).toContain('<p data-testid="rich">World body</p>')
    noInputs()
    expect(screen.queryByRole('button', { name: 'Use default template' })).toBeNull()
  })

  // the campaign body is HTML typed by the project; it must be painted, never run inside the app
  it('email never injects the body into the app document: no img[onerror], an iframe without allow-scripts', () => {
    const body = '<p>Hi</p><img src="x" onerror="window.__xssProbe=1"><script>window.__xssProbe=2</script>'
    const state = { loading: false, changes: { contact_data: { title: 'Hello title', body } } }
    const { container } = renderWithProviders(<CampaignEmail {...baseProps} contactState={state} categoryList={loading} previewOnly />, { theme })
    expect(container.querySelector('[onerror]')).toBeNull()
    expect(container.querySelector('img, script, p')).toBeNull()
    expect(window.__xssProbe).toBeUndefined()
    const frames = container.querySelectorAll('iframe')
    expect(frames).toHaveLength(1)
    const tokens = (frames[0].getAttribute('sandbox') ?? '').split(/\s+/)
    expect(frames[0].hasAttribute('sandbox')).toBe(true)
    expect(tokens).not.toContain('allow-scripts')
    expect(tokens).not.toContain('allow-top-navigation')
    expect(tokens).not.toContain('allow-top-navigation')
    expect(frames[0].getAttribute('srcdoc')).toContain(body)
  })

  it('webhook has no facsimile: it renders title, message and URL as a read-only definition list', () => {
    const { container } = renderWithProviders(<CampaignWebHook {...baseProps} categoryList={loading} previewOnly />, { theme })
    expect(container.querySelector('dl')).not.toBeNull()
    const terms = [...container.querySelectorAll('dt')].map(el => el.textContent)
    expect(terms).toEqual(['Title', 'Messages', 'Hooks'])
    const values = [...container.querySelectorAll('dd')].map(el => el.textContent)
    expect(values).toEqual(['Hello title', 'World body', 'https://example.test/hook'])
    noInputs()
  })
})

// redesign CA-R2 (P7): the visible «Title» and «Messages» labels are tied to their fields, so the fields have an accessible name
describe('channel editors: accessible names (P7)', () => {
  const forms = [
    ...gated.map(g => [g.name, g.Editor, g.ready]),
    ...ungated.map(g => [g.name, g.Editor, loading])
  ]

  forms.forEach(([name, Editor, categoryList]) => {
    it(`${name}: the Title label names the title field`, () => {
      renderWithProviders(<Editor {...baseProps} categoryList={categoryList} />, { theme })
      const field = screen.getByLabelText('Title')
      expect(field).toHaveAttribute('name', 'title')
      expect(screen.getByRole('textbox', { name: 'Title' })).toBe(field)
    })
  })

  forms.filter(([name]) => name !== 'email').forEach(([name, Editor, categoryList]) => {
    it(`${name}: the Messages label names the message field`, () => {
      renderWithProviders(<Editor {...baseProps} categoryList={categoryList} />, { theme })
      const field = screen.getByLabelText('Messages')
      expect(field).toHaveAttribute('name', 'body')
      expect(screen.getByRole('textbox', { name: 'Messages' })).toBe(field)
    })
  })

  it('email: the Messages label names the group around the rich editor, and the editor has the same name', () => {
    renderWithProviders(<CampaignEmail {...baseProps} categoryList={configured('pro_white_labeling', emailKeys)} />, { theme })
    expect(screen.getByRole('group', { name: 'Messages' })).toContainElement(screen.getByRole('textbox', { name: 'Messages' }))
  })

  it('webhook: the Hooks label names the URL field too', () => {
    renderWithProviders(<CampaignWebHook {...baseProps} categoryList={loading} />, { theme })
    expect(screen.getByLabelText('Hooks')).toHaveAttribute('name', 'webhook')
  })

  it('two editors on the page do not share ids', () => {
    renderWithProviders(
      <>
        <CampaignSMS {...baseProps} categoryList={configured('twilio', ['twilio_sid', 'twilio_token'])} />
        <CampaignPopup {...baseProps} categoryList={loading} />
      </>,
      { theme }
    )
    const titles = screen.getAllByLabelText('Title')
    expect(titles).toHaveLength(2)
    expect(titles[0].id).not.toBe(titles[1].id)
  })
})

describe('channel editors: onConfigStateChange', () => {
  gated.forEach(({ name, Editor, ready }) => {
    it(`${name} reports false while loading, then true when every key is set`, () => {
      const onConfigStateChange = vi.fn()
      const { rerender } = renderWithProviders(
        <Editor {...baseProps} categoryList={loading} onConfigStateChange={onConfigStateChange} />,
        { theme }
      )
      expect(onConfigStateChange).toHaveBeenCalledWith(false)
      onConfigStateChange.mock.calls.forEach(([value]) => expect(typeof value).toBe('boolean'))

      rerender(<Editor {...baseProps} categoryList={ready} onConfigStateChange={onConfigStateChange} />)
      const calls = onConfigStateChange.mock.calls.map(([value]) => value)
      expect(calls[0]).toBe(false)
      expect(calls[calls.length - 1]).toBe(true)
      calls.forEach(value => expect(typeof value).toBe('boolean'))
    })

    it(`${name} reports false when a key is empty`, () => {
      const onConfigStateChange = vi.fn()
      const incomplete = {
        loading: false,
        categories: [{
          key: ready.categories[0].key,
          configs: ready.categories[0].configs.map((c, i) => (i === 0 ? { ...c, value: '' } : c))
        }]
      }
      renderWithProviders(<Editor {...baseProps} categoryList={incomplete} onConfigStateChange={onConfigStateChange} />, { theme })
      const calls = onConfigStateChange.mock.calls.map(([value]) => value)
      expect(calls[calls.length - 1]).toBe(false)
    })
  })

  ungated.forEach(({ name, Editor }) => {
    it(`${name} reports true (no gate)`, () => {
      const onConfigStateChange = vi.fn()
      renderWithProviders(<Editor {...baseProps} categoryList={loading} onConfigStateChange={onConfigStateChange} />, { theme })
      expect(onConfigStateChange).toHaveBeenCalledTimes(1)
      expect(onConfigStateChange).toHaveBeenCalledWith(true)
    })
  })

  it('works together with previewOnly', () => {
    const onConfigStateChange = vi.fn()
    renderWithProviders(<CampaignPopup {...baseProps} previewOnly onConfigStateChange={onConfigStateChange} />, { theme })
    expect(onConfigStateChange).toHaveBeenCalledWith(true)
  })

  it('does nothing when the prop is absent', () => {
    expect(() => renderWithProviders(<CampaignPopup {...baseProps} />, { theme })).not.toThrow()
  })
})

describe('push editor: OneSignal or Firebase', () => {
  const pushCategory = (values) => ({
    loading: false,
    categories: [{
      key: 'notification',
      configs: [...pushKeys, 'firebase_service_account', 'onesignal_dashboardweb_id'].map(key => ({ key, value: values[key] ?? '' }))
    }]
  })
  const oneSignalValues = Object.fromEntries(pushKeys.map(key => [key, 'x']))
  const helpText = 'To send push notifications, complete the OneSignal settings or add a Firebase service account'

  it('opens with a Firebase service account and no OneSignal keys', () => {
    const onConfigStateChange = vi.fn()
    renderWithProviders(
      <CampaignNotification {...baseProps} categoryList={pushCategory({ firebase_service_account: '{"project_id":"demo"}' })} onConfigStateChange={onConfigStateChange} />,
      { theme }
    )
    expect(screen.getByPlaceholderText('Title')).toBeInTheDocument()
    expect(addButton()).toBeInTheDocument()
    expect(screen.queryByTestId('settings-list')).toBeNull()
    expect(onConfigStateChange).toHaveBeenLastCalledWith(true)
  })

  it('still opens with the OneSignal keys and no Firebase service account', () => {
    const onConfigStateChange = vi.fn()
    renderWithProviders(
      <CampaignNotification {...baseProps} categoryList={pushCategory(oneSignalValues)} onConfigStateChange={onConfigStateChange} />,
      { theme }
    )
    expect(screen.getByPlaceholderText('Title')).toBeInTheDocument()
    expect(onConfigStateChange).toHaveBeenLastCalledWith(true)
  })

  it('stays closed with neither, names both services and offers both in the settings list', () => {
    const onConfigStateChange = vi.fn()
    renderWithProviders(
      <CampaignNotification {...baseProps} categoryList={pushCategory({ onesignal_user_auth: 'x' })} onConfigStateChange={onConfigStateChange} />,
      { theme }
    )
    expect(screen.queryByPlaceholderText('Title')).toBeNull()
    expect(addButton()).toBeNull()
    expect(screen.getByText(helpText)).toBeInTheDocument()
    expect(screen.getByTestId('settings-list')).toHaveTextContent([...pushKeys, 'firebase_service_account'].join(','))
    expect(onConfigStateChange).toHaveBeenLastCalledWith(false)
  })
})

// (tanda O) kept «Tech Support» off www.undefined.com; (main #481) sends it to the Ordering.co contact page for
// every project, with or without a subdomain
describe('channel editors: Tech Support link', () => {
  const unset = {
    email: { Editor: CampaignEmail, categoryList: { loading: false, categories: [{ key: 'pro_white_labeling', configs: [{ key: 'email_smtp_host', value: '' }] }] } },
    sms: { Editor: CampaignSMS, categoryList: { loading: false, categories: [{ key: 'twilio', configs: [{ key: 'twilio_sid', value: '' }] }] } },
    push: { Editor: CampaignNotification, categoryList: { loading: false, categories: [{ key: 'notification', configs: [{ key: 'onesignal_user_auth', value: '' }] }] } }
  }

  afterEach(() => {
    project.subdomain = 'ordering'
    vi.restoreAllMocks()
  })

  Object.entries(unset).forEach(([name, { Editor, categoryList }]) => {
    it.each([['with', 'ordering'], ['without', undefined]])(`${name} opens the Ordering.co contact page, %s a subdomain`, async (_label, subdomain) => {
      project.subdomain = subdomain
      const open = vi.spyOn(window, 'open').mockImplementation(() => null)
      renderWithProviders(<Editor {...baseProps} categoryList={categoryList} />, { theme })
      await userEvent.click(screen.getByRole('button', { name: 'Tech Support' }))
      expect(open).toHaveBeenCalledWith('https://www.ordering.co/contact/', '_blank', 'noopener,noreferrer')
    })
  })
})

// The body is now a controlled Tiptap editor: the state is the campaign form's, the editor only shows it
describe('email body: controlled rich editor', () => {
  const ready = configured('pro_white_labeling', emailKeys)
  const { defaultBodyContent, defaultSubjectContent } = getUtils()
  const body = () => screen.getByRole('textbox', { name: 'Messages' })
  const preview = () => screen.getByTitle('Email preview').getAttribute('srcdoc')

  // Plays the controller of the campaign form: it owns contact_data and feeds it back
  const Host = ({ initial, spies = {}, ...rest }) => {
    const [contactData, setContactData] = useState(initial)
    const state = { loading: false, changes: { contact_data: contactData } }
    return (
      <CampaignEmail
        {...baseProps}
        {...rest}
        contactState={state}
        categoryList={ready}
        handleChangeData={(event) => setContactData(data => ({ ...data, [event.target.name]: event.target.value }))}
        handleChangeContact={(key, value) => {
          spies.handleChangeContact?.(key, value)
          setContactData(data => ({ ...data, [key]: value }))
        }}
        handleAddCampaign={spies.handleAddCampaign ?? (() => {})}
        handleUpdateContact={spies.handleUpdateContact ?? (() => {})}
      />
    )
  }

  it('shows the saved body in the editor and the preview', () => {
    renderWithProviders(<Host initial={{ title: 'T', body: '<p>Hello <strong>there</strong></p>' }} />, { theme })
    expect(body().querySelector('strong')).toHaveTextContent('there')
    expect(preview()).toContain('Hello')
  })

  it('writes nothing to the campaign on mount, with or without a body', () => {
    const handleChangeContact = vi.fn()
    const { unmount } = renderWithProviders(<Host initial={{ title: 'T', body: '<p>Saved</p>' }} spies={{ handleChangeContact }} />, { theme })
    unmount()
    renderWithProviders(<Host initial={{ title: 'T' }} spies={{ handleChangeContact }} />, { theme })
    expect(handleChangeContact).not.toHaveBeenCalled()
  })

  it('uses the toolbar without video, with the link as a button, and no Summernote chrome', () => {
    const { container } = renderWithProviders(<Host initial={{ title: 'T' }} />, { theme })
    expect(screen.queryByRole('button', { name: /video/i })).toBeNull()
    expect(screen.getByRole('button', { name: 'Edit as HTML' })).toBeInTheDocument()
    expect(container.querySelector('.note-editor')).toBeNull()
  })

  it('the default template button fills the title, the editor, the preview and the state (it used to leave the editor behind)', () => {
    const handleChangeContact = vi.fn()
    renderWithProviders(<Host initial={{ title: '', body: '<p>Old</p>' }} spies={{ handleChangeContact }} />, { theme })
    fireEvent.click(screen.getByRole('button', { name: 'Use default template' }))
    expect(screen.getByPlaceholderText('Title')).toHaveValue(defaultSubjectContent)
    expect(handleChangeContact).toHaveBeenCalledTimes(1)
    expect(handleChangeContact).toHaveBeenCalledWith('body', defaultBodyContent)
    expect(body()).toHaveTextContent("Hi [Recipient's Name]!")
    expect(body()).not.toHaveTextContent('Old')
    expect(body().querySelector('a button')).toHaveTextContent('[Link to your marketplace with hyperlink]')
    expect(preview()).toContain("Hi [Recipient's Name]!")
    expect(preview()).not.toContain('Old')
  })

  it('the default template also fills an editor that was empty', () => {
    renderWithProviders(<Host initial={{ title: '' }} />, { theme })
    fireEvent.click(screen.getByRole('button', { name: 'Use default template' }))
    expect(body()).toHaveTextContent('Ready to explore incredible flavors?')
  })

  it('does not re-write the body when the editor gets the value it just emitted', () => {
    const handleChangeContact = vi.fn()
    renderWithProviders(<Host initial={{ title: 'T', body: '<p>Saved</p>' }} spies={{ handleChangeContact }} />, { theme })
    fireEvent.click(screen.getByRole('button', { name: 'Use default template' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use default template' }))
    expect(handleChangeContact).toHaveBeenCalledTimes(2)
  })

  describe('saving', () => {
    const save = (initial) => {
      const handleAddCampaign = vi.fn()
      renderWithProviders(<Host initial={initial} spies={{ handleAddCampaign }} />, { theme })
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))
      return handleAddCampaign
    }

    it.each([['an undefined body', undefined], ['an empty body (what the editor emits when emptied)', '']])('rejects %s', (_label, value) => {
      const handleAddCampaign = save({ title: 'T', body: value })
      expect(handleAddCampaign).not.toHaveBeenCalled()
      expect(screen.getByTestId('own-alert')).toHaveTextContent('Body is required')
    })

    it('rejects a missing title before the body', () => {
      const handleAddCampaign = save({ title: '', body: '<p>Hi</p>' })
      expect(handleAddCampaign).not.toHaveBeenCalled()
      expect(screen.getByTestId('own-alert')).toHaveTextContent('Title is required')
    })

    it.each([
      ['a paragraph', '<p>Hi</p>'],
      ['the default template', getUtils().defaultBodyContent],
      ['a template with tokens', '<p>Hi {{ user_name }} <a href="{{ unsubscribe_link }}">Unsubscribe</a></p>']
    ])('saves %s', (_label, value) => {
      const handleAddCampaign = save({ title: 'T', body: value })
      expect(handleAddCampaign).toHaveBeenCalledTimes(1)
    })

    it('keeps tokens byte for byte through the real editor (nothing is emitted just by opening it)', () => {
      const handleChangeContact = vi.fn()
      const value = '<p>Hi {{ user_name }} :user_email <a href="{{ unsubscribe_link }}">Unsubscribe</a></p>'
      renderWithProviders(<Host initial={{ title: 'T', body: value }} spies={{ handleChangeContact }} />, { theme })
      expect(body()).toHaveTextContent('Hi {{ user_name }} :user_email Unsubscribe')
      expect(body().querySelector('a')).toHaveAttribute('href', '{{ unsubscribe_link }}')
      expect(handleChangeContact).not.toHaveBeenCalled()
    })
  })
})
