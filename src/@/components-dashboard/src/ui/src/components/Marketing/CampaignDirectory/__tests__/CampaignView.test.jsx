/* eslint-disable import/first */
// redesign CA-B6 (decisions 1 and 4; M-CA3, M-CA10; auditor #1, #4, #7): the read-only view of a created campaign. The six channel editors
// are stubs that record the props they get (previewOnly above all) and draw a facsimile; `campaignData.js` (CA-B3) is the real one.
// Nothing here can send anything: the only callback is `onOpenOpens`.
import React from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  editorProps: {},
  extraControls: false, // a facsimile with every kind of control a preview may hold (the tab-order tests)
  // the stand-in of every channel editor: a facsimile (and, for the popup, the «Done» button the real one has)
  editor: (React, channel, props) => {
    mocks.editorProps[channel] = props
    const h = React.createElement
    return h(
      'div',
      { 'data-testid': `preview-${channel}`, 'data-preview-only': String(!!props.previewOnly) },
      h('p', null, `facsimile of ${channel}`),
      channel === 'popup' ? h('button', { type: 'button' }, 'Done') : null,
      mocks.extraControls
        ? [
            h('button', { key: 'b', type: 'button' }, 'Use default template'),
            h('a', { key: 'a', href: '#more' }, 'More'),
            h('input', { key: 'i', 'aria-label': 'Preview input' }),
            h('select', { key: 's', 'aria-label': 'Preview select' }),
            h('textarea', { key: 't', 'aria-label': 'Preview textarea' }),
            h('div', { key: 'd', tabIndex: 0 }, 'focusable block')
          ]
        : null
    )
  },
  // the project's date parser, simulated: it shows what it was asked for, so a test sees the options the view passes
  // the project's price formatter, simulated; `withPrice: false` is a useUtils that does not carry it
  parsePrice: (value) => `P[${value}]`,
  withPrice: true,
  parseDate: (date, options = {}) => `D[${String(date).slice(0, options.dateOnly ? 10 : 16)}${options.dateOnly ? ' date' : ''}${options.utc === false ? ' local' : ''}]`
}))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  useConfig: () => [{ configs: {} }],
  useUtils: () => [mocks.withPrice ? { parseDate: mocks.parseDate, parsePrice: mocks.parsePrice } : { parseDate: mocks.parseDate }]
}))
vi.mock('../../CampaignEmail', async () => {
  const React = await import('react')
  return { CampaignEmail: (props) => mocks.editor(React, 'email', props) }
})
vi.mock('../../CampaignSMS', async () => {
  const React = await import('react')
  return { CampaignSMS: (props) => mocks.editor(React, 'sms', props) }
})
vi.mock('../../CampaignNotification', async () => {
  const React = await import('react')
  return { CampaignNotification: (props) => mocks.editor(React, 'notification', props) }
})
vi.mock('../../CampaignWhatsapp', async () => {
  const React = await import('react')
  return { CampaignWhatsapp: (props) => mocks.editor(React, 'whatsapp', props) }
})
vi.mock('../../CampaignPopup', async () => {
  const React = await import('react')
  return { CampaignPopup: (props) => mocks.editor(React, 'popup', props) }
})
vi.mock('../../CampaignWebHook', async () => {
  const React = await import('react')
  return { CampaignWebHook: (props) => mocks.editor(React, 'webhook', props) }
})

import { CampaignView } from '../CampaignView'

const ordersRule = { id: 1, type: 'orders_count', condition: '>', value: 2 }
const signUpRule = { id: 2, type: 'user_created_at', date_condition: '><', date: '2026-01-05 00:00:00', max_date: '2026-02-10 00:00:00' }

const fixedScheduled = {
  id: 11,
  name: 'Spring sale',
  contact_type: 'email',
  audience_type: 'fixed',
  status: 'scheduled',
  scheduled_at: '2026-08-01 10:00:00',
  conditions: [ordersRule, signUpRule],
  audience_count: 1200,
  sent_count: 0,
  open_count: 0
}
const fixedPending = { id: 12, name: 'Flash', contact_type: 'sms', audience_type: 'fixed', status: 'pending', conditions: [], audience_count: 1, sent_count: 0, open_count: 0 }
const dynamicActive = {
  id: 13,
  name: 'Weekend offer',
  contact_type: 'notification',
  audience_type: 'dynamic',
  enabled: true,
  status: 'active',
  end_at: '2026-12-31 18:30:00',
  conditions: [ordersRule],
  audience_count: 40,
  sent_count: 30,
  open_count: 7
}
const dynamicPaused = { ...dynamicActive, id: 14, name: 'Win-back', enabled: false, end_at: null, contact_type: 'email' }
const ended = {
  id: 15,
  name: 'Old promo',
  contact_type: 'email',
  audience_type: 'fixed',
  status: 'ended',
  conditions: [ordersRule],
  audience_count: 100,
  sent_count: 100,
  open_count: 40
}

const renderView = (campaign, props = {}) => {
  const onOpenOpens = vi.fn()
  const view = render(
    <CampaignView
      campaignState={{ campaign, loading: false, error: null }}
      contactState={{ loading: false, changes: { contact_type: campaign.contact_type, contact_data: { title: 'Hello', body: 'World' } }, error: null }}
      formState={{ loading: false, changes: {}, error: null }}
      onOpenOpens={onOpenOpens}
      {...props}
    />
  )
  return { ...view, onOpenOpens }
}

const block = (name) => screen.getByRole('region', { name })

beforeEach(() => { mocks.editorProps = {}; mocks.extraControls = false; mocks.withPrice = true })
afterEach(() => { cleanup() })

describe('CampaignView blocks', () => {
  it('a fixed scheduled campaign shows every block, with the record\'s own data', () => {
    renderView(fixedScheduled)

    expect(screen.getByRole('status')).toHaveTextContent("Campaigns can't be edited after they're created.")

    expect(within(block('Channel')).getByText('Email')).toBeInTheDocument()

    const audience = block('Audience')
    expect(within(audience).getByText('Fixed')).toBeInTheDocument()
    expect(within(audience).getByText('Only people who match rules right now')).toBeInTheDocument()
    const rules = within(audience).getByRole('list', { name: 'Rules' })
    const chips = within(rules).getAllByRole('listitem')
    expect(chips).toHaveLength(2)
    expect(chips[0]).toHaveTextContent('Orders: more than 2')
    expect(chips[0].querySelector('.odc-figure')).toHaveTextContent('2')
    // dates go through parseDate, never the ISO text (decision 13); the range holds two figures
    expect(chips[1]).toHaveTextContent('Sign-up date: between D[2026-01-05 date local] and D[2026-02-10 date local]')
    expect(chips[1].querySelectorAll('.odc-figure')).toHaveLength(2)
    // the figure the API recorded, not a live count (auditor #4)
    expect(within(audience).getByText((_, node) => node.tagName === 'P' && node.textContent === 'Audience: 1,200 customers')).toBeInTheDocument()
    expect(audience.querySelector('.odc-figure')).not.toBeNull()

    const delivery = block('Delivery')
    expect(delivery).toHaveTextContent('Scheduled for D[2026-08-01 10:00 local]')
    expect(delivery).not.toHaveTextContent('As soon as possible')
    expect(delivery.querySelector('.odc-figure')).toHaveTextContent('D[2026-08-01 10:00 local]')

    const message = block('Message')
    expect(within(message).getByTestId('preview-email')).toBeInTheDocument()

    const results = block('Results')
    expect(within(results).getByText('In queue').nextElementSibling).toHaveTextContent('1,200')
    expect(within(results).getByText('Sent').nextElementSibling).toHaveTextContent('0')
    expect(within(results).getByText('Opens').nextElementSibling).toHaveTextContent('0')
  })

  it('a fixed pending campaign says «As soon as possible», without a clock', () => {
    renderView(fixedPending)
    const delivery = block('Delivery')
    expect(delivery).toHaveTextContent('As soon as possible')
    expect(delivery).not.toHaveTextContent('Scheduled for')
    expect(delivery.textContent).not.toMatch(/\d{1,2}:\d{2}/)
    // a single customer is singular
    expect(within(block('Audience')).getByText((_, node) => node.tagName === 'P' && node.textContent === 'Audience: 1 customer')).toBeInTheDocument()
  })

  it('a dynamic active campaign says Active and when it ends', () => {
    renderView(dynamicActive)
    const delivery = block('Delivery')
    expect(delivery).toHaveTextContent('Active')
    expect(delivery).toHaveTextContent('Until D[2026-12-31 18:30 local]')
    expect(within(block('Audience')).getByText('Dynamic')).toBeInTheDocument()
    expect(within(block('Audience')).getByText('People who match rules now and in the future')).toBeInTheDocument()
    expect(within(block('Channel')).getByText('Push notification')).toBeInTheDocument()
  })

  it('a dynamic paused campaign says Paused and has no end line', () => {
    renderView(dynamicPaused)
    const delivery = block('Delivery')
    expect(delivery).toHaveTextContent('Paused')
    expect(delivery).not.toHaveTextContent('Until')
  })

  it('an ended campaign says what main says about it, not the new notice', () => {
    renderView(ended)
    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent('Information not editable when campaign has ended')
    expect(notice).not.toHaveTextContent("Campaigns can't be edited")
    expect(block('Message')).toBeInTheDocument()
    expect(block('Results')).toBeInTheDocument()
  })

  // redesign CA-R2 (P6): a record with no title and no body says so instead of drawing an empty frame
  it('a campaign without a message says «No message», and one with a body keeps its facsimile', () => {
    renderView({ ...fixedPending, contact_data: {} })
    expect(within(block('Message')).getByText('No message')).toBeInTheDocument()
    expect(within(block('Message')).queryByTestId('preview-email')).toBeNull()
    cleanup()
    renderView({ ...fixedPending, contact_data: { title: '', body: '<p>&nbsp;</p>' } })
    expect(within(block('Message')).getByText('No message')).toBeInTheDocument()
    cleanup()
    renderView({ ...fixedPending, contact_data: { body: 'Hi' } })
    expect(within(block('Message')).queryByText('No message')).toBeNull()
  })

  it('no rules says so; no audience_count draws nothing instead of a made-up number', () => {
    renderView({ ...fixedPending, conditions: [], audience_count: undefined })
    const audience = block('Audience')
    expect(within(audience).getByText('No rules')).toBeInTheDocument()
    expect(within(audience).queryByRole('list', { name: 'Rules' })).toBeNull()
    expect(audience).not.toHaveTextContent('customer')
  })

  it('the conditions may come as JSON text (auditor #16) and a value we do not know is a word, never the raw text', () => {
    renderView({
      ...fixedPending,
      contact_type: 'carrier-pigeon',
      audience_type: 'sideways',
      conditions: JSON.stringify([ordersRule, { type: 'moon_phase' }])
    })
    expect(within(block('Channel')).getByText('Other')).toBeInTheDocument()
    const audience = block('Audience')
    expect(within(audience).getByText('—')).toBeInTheDocument()
    const chips = within(within(audience).getByRole('list', { name: 'Rules' })).getAllByRole('listitem')
    expect(chips[0]).toHaveTextContent('Orders: more than 2')
    expect(chips[1]).toHaveTextContent('Rule: —')
    expect(screen.queryByText(/carrier-pigeon|sideways|moon_phase/)).toBeNull()
    // a channel we do not know has no facsimile to show
    expect(within(block('Message')).queryByTestId(/^preview-/)).toBeNull()
  })
})

describe('CampaignView is read-only (decision 4, M-CA3)', () => {
  it.each([
    ['fixed scheduled', fixedScheduled],
    ['fixed pending', fixedPending],
    ['dynamic active', dynamicActive],
    ['dynamic paused', dynamicPaused],
    ['ended', ended]
  ])('%s: nothing that looks editable', (_name, campaign) => {
    const { container } = renderView(campaign)
    expect(container.querySelectorAll('input, textarea, select, [contenteditable]')).toHaveLength(0)
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByRole('button', { name: /^(save|add|edit|update)$/i })).toBeNull()
    expect(container.querySelector('[data-testid="settings-list"]')).toBeNull()
  })

  it('asks every channel editor for its facsimile only (previewOnly), with the controller props', () => {
    for (const [channel, contact] of [['email', 'email'], ['sms', 'sms'], ['notification', 'notification'], ['whatsapp', 'whatsapp'], ['popup', 'popup'], ['webhook', 'webhook']]) {
      const { unmount } = renderView({ ...fixedPending, contact_type: contact })
      expect(screen.getByTestId(`preview-${channel}`)).toHaveAttribute('data-preview-only', 'true')
      expect(mocks.editorProps[channel].contactState.changes.contact_data.title).toBe('Hello')
      unmount()
    }
  })

  // The message is the point of the block, so the wrapper stays in the accessible tree (no `inert`, no aria-hidden); only its controls
  // leave the tab order (tabindex -1), so the popup's «Done» and the like never take focus.
  it('keeps the facsimile readable: no inert, no aria-hidden, its text in the accessible tree', () => {
    renderView({ ...fixedPending, contact_type: 'popup' })
    const group = screen.getByRole('group', { name: 'Message preview' })
    expect(group.querySelector('[inert]')).toBeNull()
    expect(group.closest('[inert], [aria-hidden="true"]')).toBeNull()
    expect(group.hasAttribute('inert')).toBe(false)
    const text = within(group).getByText('facsimile of popup')
    expect(text.closest('[inert], [aria-hidden="true"]')).toBeNull()
    expect(group).toContainElement(screen.getByTestId('preview-popup'))
  })

  it('takes the popup\'s «Done» out of the tab order', () => {
    renderView({ ...fixedPending, contact_type: 'popup' })
    const done = within(screen.getByRole('group', { name: 'Message preview' })).getByRole('button', { name: 'Done' })
    expect(done).toHaveAttribute('tabindex', '-1')
  })

  it('takes every control of the facsimile out of the tab order, and the ones outside it stay as they are', () => {
    mocks.extraControls = true
    const { rerender } = renderView({ ...fixedPending, contact_type: 'email' })
    const group = screen.getByRole('group', { name: 'Message preview' })
    const controls = group.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')
    expect(controls).toHaveLength(6)
    for (const control of controls) expect(control).toHaveAttribute('tabindex', '-1')
    // the read-only view's own button (the opens link) is not part of the facsimile
    rerender(
      <CampaignView
        campaignState={{ campaign: { ...dynamicActive, contact_type: 'email' }, loading: false, error: null }}
        contactState={{ loading: false, changes: { contact_type: 'email', contact_data: {} }, error: null }}
        onOpenOpens={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: '7 opens of Weekend offer' })).not.toHaveAttribute('tabindex', '-1')
    for (const control of screen.getByRole('group', { name: 'Message preview' }).querySelectorAll('button, a[href], input, select, textarea, [tabindex]')) {
      expect(control).toHaveAttribute('tabindex', '-1')
    }
  })

  it('does it again when the campaign or the channel changes (controls the new facsimile brings)', () => {
    mocks.extraControls = true
    const { rerender } = renderView({ ...fixedPending, contact_type: 'email' })
    rerender(
      <CampaignView
        campaignState={{ campaign: { ...fixedPending, id: 99, contact_type: 'popup' }, loading: false, error: null }}
        contactState={{ loading: false, changes: { contact_type: 'popup', contact_data: {} }, error: null }}
        onOpenOpens={vi.fn()}
      />
    )
    const group = screen.getByRole('group', { name: 'Message preview' })
    expect(within(group).getByRole('button', { name: 'Done' })).toHaveAttribute('tabindex', '-1')
    for (const control of group.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')) {
      expect(control).toHaveAttribute('tabindex', '-1')
    }
  })
})

describe('CampaignView results (the arithmetic and the N/A rule of main)', () => {
  it('In queue is audience_count minus sent_count, 0 when either is missing', () => {
    renderView({ ...fixedPending, audience_count: 20, sent_count: 5 })
    expect(within(block('Results')).getByText('In queue').nextElementSibling).toHaveTextContent('15')
    cleanup()
    renderView({ ...fixedPending, audience_count: undefined, sent_count: 5 })
    expect(within(block('Results')).getByText('In queue').nextElementSibling).toHaveTextContent('0')
  })

  it('SMS shows N/A for Sent and Opens; a push campaign (stored as «notification») shows its figures', () => {
    renderView({ ...fixedPending, contact_type: 'sms', audience_count: 3, sent_count: 1, open_count: 2 })
    let results = block('Results')
    expect(within(results).getByText('Sent').nextElementSibling).toHaveTextContent('N/A')
    expect(within(results).getByText('Opens').nextElementSibling).toHaveTextContent('N/A')
    expect(within(results).queryByRole('button')).toBeNull()
    cleanup()

    renderView({ ...fixedPending, contact_type: 'notification', audience_count: 3, sent_count: 1, open_count: 2 })
    results = block('Results')
    expect(within(results).getByText('Sent').nextElementSibling).toHaveTextContent('1')
    expect(within(results).getByText('Opens').nextElementSibling).toHaveTextContent('2')
    cleanup()

    // the literal «push» is N/A too, as main
    renderView({ ...fixedPending, contact_type: 'push', audience_count: 3, sent_count: 1, open_count: 2 })
    expect(within(block('Results')).getByText('Sent').nextElementSibling).toHaveTextContent('N/A')
  })

  it('Opens above zero is a link-button that opens the list of the campaign; zero is a plain figure', async () => {
    const user = userEvent.setup()
    const { onOpenOpens, unmount } = renderView(dynamicActive)
    const link = within(block('Results')).getByRole('button', { name: '7 opens of Weekend offer' })
    expect(link).toHaveTextContent('7')
    expect(link.querySelector('.odc-figure')).not.toBeNull()
    await user.click(link)
    expect(onOpenOpens).toHaveBeenCalledTimes(1)
    expect(onOpenOpens.mock.calls[0][0]).toMatchObject({ id: 13, name: 'Weekend offer' })
    unmount()

    renderView({ ...dynamicActive, open_count: 1 })
    expect(screen.getByRole('button', { name: '1 open of Weekend offer' })).toBeInTheDocument()
    cleanup()

    renderView({ ...dynamicActive, open_count: 0 })
    expect(within(block('Results')).queryByRole('button')).toBeNull()
  })

  it('every figure sits in an odc-figure node (decision 11)', () => {
    renderView(dynamicActive)
    const figures = [...block('Results').querySelectorAll('.odc-figure')].map(node => node.textContent)
    expect(figures).toEqual(['10', '30', '7', '0', 'P[0]'])
  })
})

describe('CampaignView orders and revenue (attributed through the links of an email)', () => {
  const help = 'Orders and revenue come from customers who ordered after clicking a link in this email.'
  const helpPush = 'Orders and revenue come from customers who ordered after opening this notification in the app.'
  const cell = (label) => within(block('Results')).getByText(label).nextElementSibling

  it('an email shows the orders formatted and the revenue through parsePrice, each in a figure node, with the help line', () => {
    renderView({ ...ended, orders_count: 1234, orders_total: 56.5 })
    expect(cell('Orders')).toHaveTextContent('1,234')
    expect(cell('Revenue')).toHaveTextContent('P[56.5]')
    expect(cell('Orders').querySelector('.odc-figure')).not.toBeNull()
    expect(cell('Revenue').querySelector('.odc-figure')).not.toBeNull()
    expect(screen.getByText(help)).toBeInTheDocument()
  })

  it('zero and a missing field read as 0 and the price of 0', () => {
    renderView({ ...ended, orders_count: 0, orders_total: 0 })
    expect(cell('Orders')).toHaveTextContent('0')
    expect(cell('Revenue')).toHaveTextContent('P[0]')
    cleanup()
    renderView({ ...ended, orders_count: null, orders_total: undefined })
    expect(cell('Orders')).toHaveTextContent('0')
    expect(cell('Revenue')).toHaveTextContent('P[0]')
    cleanup()
    renderView({ ...ended, orders_total: '12.5' })
    expect(cell('Revenue')).toHaveTextContent('P[12.5]')
  })

  it('a push campaign (notification) shows the orders and the revenue with the push help line', () => {
    renderView({ ...ended, contact_type: 'notification', orders_count: 5, orders_total: 99 })
    expect(cell('Orders')).toHaveTextContent('5')
    expect(cell('Revenue')).toHaveTextContent('P[99]')
    expect(screen.getByText(helpPush)).toBeInTheDocument()
    expect(screen.queryByText(help)).toBeNull()
  })

  it('an email keeps the email help line, not the push one', () => {
    renderView({ ...ended, orders_count: 5, orders_total: 99 })
    expect(screen.getByText(help)).toBeInTheDocument()
    expect(screen.queryByText(helpPush)).toBeNull()
  })

  it('sms and the literal push show N/A in both and no help line', () => {
    for (const channel of ['sms', 'push']) {
      renderView({ ...ended, contact_type: channel, orders_count: 5, orders_total: 99 })
      expect(cell('Orders')).toHaveTextContent('N/A')
      expect(cell('Revenue')).toHaveTextContent('N/A')
      expect(screen.queryByText(help)).toBeNull()
      expect(screen.queryByText(helpPush)).toBeNull()
      cleanup()
    }
  })

  it('the five results come in order', () => {
    renderView({ ...ended, orders_count: 1, orders_total: 2 })
    const labels = [...block('Results').querySelectorAll('dt')].map(node => node.textContent)
    expect(labels).toEqual(['In queue', 'Sent', 'Opens', 'Orders', 'Revenue'])
  })

  it('a useUtils without parsePrice does not crash and falls back to the formatted number', () => {
    mocks.withPrice = false
    renderView({ ...ended, orders_count: 3, orders_total: 1234.5 })
    expect(cell('Revenue')).toHaveTextContent('1,234.5')
  })
})
