/* eslint-disable import/first */
// redesign RA-B3 (decision 3, decision 5; M-RA8, M-RA16): the Messages section of a rule (one card per channel, duplicates included) and the
// message facsimile it draws (MessagePreview, tested here too). The real Product AsyncSwitch, Button and InlineNotice are under test; the
// language is simulated (English fallbacks) and `channelLabel` (RA-B2) is a stub with the contract's words. Nothing is ever sent.
import React from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {}, language: { code: 'en' } }, (_key, text) => text]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ dictionary: {}, language: { code: 'en' } }, (_key, text) => text]
}))
// RA-B2 writes the real helper; here it keeps the contract of `channelLabel(t, channel, { short })`
vi.mock('../channelLabel', () => ({
  channelLabel: (t, channel, { short } = {}) => (
    { email: t('EMAIL', 'Email'), sms: t('SMS', 'SMS'), notification: short ? t('RECOVERY_RULES_CHANNEL_PUSH_SHORT', 'Push') : t('PUSH_NOTIFICATION', 'Push notification') }[channel] ?? channel
  )
}))

import { MessagePreview } from '../MessagePreview'
import { RuleMessages } from '../RuleMessages'

afterEach(cleanup)

const theme = { images: { general: { mobileHalfMask: '/mask.png' } } }
const withTheme = (ui) => <ThemeProvider theme={theme}>{ui}</ThemeProvider>

const rule = { id: 7, name: 'Did something interrupt your order?', enabled: true, times: [260] }
const email = { id: 1, channel: 'email', enabled: true, title: 'Email title', body: '<p>Hello <b>there</b></p>' }
const sms = { id: 2, channel: 'sms', enabled: false, title: 'SMS title', body: 'Plain <b>text</b>' }
const push = { id: 3, channel: 'notification', enabled: true, title: 'Push title', body: 'Push body' }
const secondEmail = { id: 4, channel: 'email', enabled: true, title: 'Second email', body: '<p>Again</p>' }

const setup = (props = {}) => {
  const handlers = {
    onRetry: vi.fn(),
    onToggle: vi.fn(async () => ({ ok: true })),
    onEdit: vi.fn(),
    onAdd: vi.fn()
  }
  const view = render(withTheme(
    <RuleMessages rule={rule} channelsState={{ loading: false, notifications: [email, sms, push], error: null }} {...handlers} {...props} />
  ))
  return { ...view, ...handlers }
}

describe('MessagePreview — the facsimile (decision 5)', () => {
  it('is readable content: a figure named «Preview», never aria-hidden', () => {
    render(withTheme(<MessagePreview channel='email' title='Hi' body='<p>Body</p>' />))
    const figure = screen.getByRole('figure', { name: 'Preview' })
    expect(figure.closest('[aria-hidden="true"]')).toBeNull()
    expect(figure.querySelector('figcaption')).toHaveTextContent('Preview')
    expect(figure.querySelector('figcaption')).toHaveClass('odc-sr-only')
  })

  it('draws an email as a window (three dots) with the title in an h2 and the body as HTML inside a sandboxed iframe', () => {
    const body = '<p>Your <b>cart</b> waits</p>'
    render(withTheme(<MessagePreview channel='email' title='Come back' body={body} />))
    const figure = screen.getByRole('figure')
    expect(figure).toHaveAttribute('data-channel', 'email')
    expect(figure.querySelectorAll('.odc-ra-preview-dot')).toHaveLength(3)
    expect(within(figure).getByRole('heading', { level: 2, name: 'Come back' })).toBeInTheDocument()
    const frame = within(figure).getByTitle('Email preview')
    expect(frame.tagName).toBe('IFRAME')
    expect(frame.getAttribute('srcdoc')).toContain(body)
  })

  // the body is HTML typed by the project; it must be painted, never run inside the app
  it('never injects the email body into the app document: no img[onerror], no script, an iframe without allow-scripts', () => {
    const body = '<p>Hi</p><img src="x" onerror="window.__xssProbe=1"><script>window.__xssProbe=2</script>'
    render(withTheme(<MessagePreview channel='email' title='Come back' body={body} />))
    const figure = screen.getByRole('figure')
    expect(figure.querySelector('[onerror]')).toBeNull()
    expect(figure.querySelector('img, script, p')).toBeNull()
    expect(window.__xssProbe).toBeUndefined()
    const frames = figure.querySelectorAll('iframe')
    expect(frames).toHaveLength(1)
    const tokens = (frames[0].getAttribute('sandbox') ?? '').split(/\s+/)
    expect(frames[0].hasAttribute('sandbox')).toBe(true)
    expect(tokens).not.toContain('allow-scripts')
    expect(tokens).not.toContain('allow-top-navigation')
    expect(tokens).not.toContain('allow-top-navigation')
    expect(frames[0].getAttribute('srcdoc')).toContain(body)
  })

  it.each(['sms', 'notification'])('draws %s as the phone silhouette with title and body as TEXT (no heading: it is not part of the page outline)', (channel) => {
    render(withTheme(<MessagePreview channel={channel} title='Title' body='<b>not html</b>' />))
    const figure = screen.getByRole('figure')
    expect(figure).toHaveAttribute('data-channel', channel)
    expect(within(figure).getByText('Title')).toBeInTheDocument()
    expect(within(figure).queryByRole('heading')).toBeNull()
    expect(figure.querySelector('b')).toBeNull()
    expect(figure).toHaveTextContent('<b>not html</b>')
    expect(figure.querySelector('.odc-ra-preview-phone-screen')).toHaveStyle({ backgroundImage: 'url(/mask.png)' })
  })

  it('takes the phone background from the theme and survives a theme without it', () => {
    render(<MessagePreview channel='sms' title='Title' body='Body' />)
    expect(screen.getByRole('figure').querySelector('.odc-ra-preview-phone-screen').style.backgroundImage).toBe('')
  })

  it('reads any other channel as text too (never an empty figure)', () => {
    render(withTheme(<MessagePreview channel='whatsapp' title='T' body='B' />))
    expect(screen.getByRole('figure')).toHaveTextContent('TB')
  })

  it('tolerates a message without title or body', () => {
    render(withTheme(<MessagePreview channel='email' />))
    expect(screen.getByRole('figure')).toBeInTheDocument()
  })
})

describe('RuleMessages — the section', () => {
  it('has a «Messages» heading and one card per message, in the order of the API', () => {
    setup()
    expect(screen.getByRole('heading', { name: 'Messages' })).toBeInTheDocument()
    const cards = screen.getAllByRole('listitem')
    expect(cards).toHaveLength(3)
    expect(within(cards[0]).getByText('Email')).toBeInTheDocument()
    expect(within(cards[1]).getByText('SMS')).toBeInTheDocument()
    expect(within(cards[2]).getByText('Push notification')).toBeInTheDocument()
  })

  it('shows each card with its facsimile', () => {
    setup()
    const cards = screen.getAllByRole('listitem')
    expect(within(cards[0]).getByRole('figure')).toHaveAttribute('data-channel', 'email')
    expect(within(cards[1]).getByRole('figure')).toHaveAttribute('data-channel', 'sms')
    expect(within(cards[2]).getByRole('figure')).toHaveAttribute('data-channel', 'notification')
    expect(within(cards[0]).getByRole('heading', { level: 2, name: 'Email title' })).toBeInTheDocument()
  })

  it('draws two messages of the same channel as two cards', () => {
    setup({ channelsState: { loading: false, notifications: [email, secondEmail], error: null } })
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getAllByRole('switch', { name: 'Email' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Edit Email message' })).toHaveLength(2)
  })

  // redesign R2-F2 (R1-10): the channel is written as channelLabel gives it, here and in the dialog title («Edit SMS message»), never lowercased
  it('names the Edit button with the channel as channelLabel writes it («Edit Email message») and calls onEdit with that message', async () => {
    const { onEdit } = setup()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Edit Email message' }))
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onEdit).toHaveBeenCalledWith(email)
    expect(screen.getByRole('button', { name: 'Edit SMS message' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit Push notification message' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit sms message' })).toBeNull()
  })

  it('«Add message» calls onAdd', async () => {
    const { onAdd } = setup()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add message' }))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('gives the section to the host (to scroll to it) through sectionRef', () => {
    const sectionRef = React.createRef()
    setup({ sectionRef })
    expect(sectionRef.current).toBeInstanceOf(HTMLElement)
    expect(sectionRef.current).toContainElement(screen.getByRole('heading', { name: 'Messages' }))
  })
})

describe('RuleMessages — the switch of each message (M-RA17)', () => {
  it('shows the stored value and calls onToggle(message, next)', async () => {
    const { onToggle } = setup()
    expect(screen.getByRole('switch', { name: 'Email' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'SMS' })).not.toBeChecked()
    await userEvent.setup().click(screen.getByRole('switch', { name: 'SMS' }))
    expect(onToggle).toHaveBeenCalledWith(sms, true)
  })

  it('when the save fails it goes back and says why, with the text of the contract', async () => {
    const onToggle = vi.fn(async () => ({ ok: false }))
    setup({ onToggle })
    const toggle = screen.getByRole('switch', { name: 'SMS' })
    await userEvent.setup().click(toggle)
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't change this message. Try again.")
    await waitFor(() => expect(toggle).not.toBeChecked())
  })

  it('names the API error when there is one', async () => {
    const onToggle = vi.fn(async () => ({ ok: false, error: ['Channel is locked'] }))
    setup({ onToggle })
    await userEvent.setup().click(screen.getByRole('switch', { name: 'SMS' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Channel is locked')
  })
})

describe('RuleMessages — states', () => {
  it('loading: skeletons in a busy region, and no cards', () => {
    setup({ channelsState: { loading: true, notifications: [], error: null } })
    const region = screen.getByRole('status', { name: 'Loading' })
    expect(region).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.queryByText('This rule has no messages yet.')).toBeNull()
  })

  it('empty: says so and offers «Add message» (one button, not two)', async () => {
    const { onAdd } = setup({ channelsState: { loading: false, notifications: [], error: null } })
    expect(screen.getByText('This rule has no messages yet.')).toBeInTheDocument()
    const add = screen.getAllByRole('button', { name: 'Add message' })
    expect(add).toHaveLength(1)
    await userEvent.setup().click(add[0])
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  // redesign R2-F2 (R1-05): a rule that is ON and has no message sends nothing, and the panel has to say so
  it('empty with the rule ON: a warning notice «This rule is on and has no message yet.» above the empty state', () => {
    setup({ channelsState: { loading: false, notifications: [], error: null } })
    const notice = screen.getByText('This rule is on and has no message yet.').closest('[data-tone]')
    expect(notice).toHaveAttribute('data-tone', 'warning')
    expect(screen.getByText('This rule has no messages yet.')).toBeInTheDocument()
    expect(notice.compareDocumentPosition(screen.getByText('This rule has no messages yet.')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Add message' })).toHaveLength(1)
  })

  it('empty with the rule OFF: as before, no warning', () => {
    setup({ rule: { ...rule, enabled: false }, channelsState: { loading: false, notifications: [], error: null } })
    expect(screen.queryByText('This rule is on and has no message yet.')).toBeNull()
    expect(screen.getByText('This rule has no messages yet.')).toBeInTheDocument()
  })

  it('no warning while loading, on error or with messages, even with the rule ON', () => {
    setup({ channelsState: { loading: true, notifications: [], error: null } })
    expect(screen.queryByText('This rule is on and has no message yet.')).toBeNull()
    cleanup()
    setup({ channelsState: { loading: false, notifications: [], error: ['Not allowed'] } })
    expect(screen.queryByText('This rule is on and has no message yet.')).toBeNull()
    cleanup()
    setup()
    expect(screen.queryByText('This rule is on and has no message yet.')).toBeNull()
  })

  it('error: a danger notice with the API text and «Retry», and no «no messages» claim (M-RA16)', async () => {
    const { onRetry } = setup({ channelsState: { loading: false, notifications: [], error: ['Not allowed'] } })
    const notice = screen.getByRole('alert')
    expect(notice).toHaveAttribute('data-tone', 'danger')
    expect(notice).toHaveTextContent('Not allowed')
    expect(screen.queryByText('This rule has no messages yet.')).toBeNull()
    await userEvent.setup().click(within(notice).getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('error without text: the fallback sentence', () => {
    setup({ channelsState: { loading: false, notifications: [], error: [] } })
    // an empty list of messages is NOT an error
    expect(screen.queryByRole('alert')).toBeNull()
    cleanup()
    setup({ channelsState: { loading: false, notifications: [], error: [{}] } })
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the messages of this rule.")
  })

  it('error with messages already loaded: keeps the cards and adds the notice', () => {
    setup({ channelsState: { loading: false, notifications: [email], error: ['Reload failed'] } })
    expect(screen.getByRole('alert')).toHaveTextContent('Reload failed')
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })
})
