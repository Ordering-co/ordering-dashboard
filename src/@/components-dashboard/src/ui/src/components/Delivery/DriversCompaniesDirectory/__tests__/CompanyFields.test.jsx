/* eslint-disable import/first */
// redesign DC-B3 (decision 3, 4 | M-DC10, M-DC13): the fields of a driver company, General and Webhooks, shared by the panel and
// the add form. Only the language is simulated; the Product fields (TextField, SegmentedControl, CopyButton) and the time zone
// select are the real ones. The fields keep no state: a host holds the changes, as the controller does.
import React, { useState } from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text]
}))

import { GeneralFields, WebhooksFields } from '../CompanyFields'

afterEach(() => cleanup())

const company = {
  id: 31,
  name: 'Moto Express',
  limit: 8,
  timezone: 'America/Bogota',
  priority: 1,
  address: 'Calle 1 # 2-3',
  webhook_new_order: 'https://example.test/hooks/new',
  webhook_cancel_request: 'https://example.test/hooks/cancel',
  webhook_order_status_changed: null,
  api_key: 'api-key-test'
}

// A host like the controller: it keeps the changes and hands every edit to the spy
const Host = ({ Fields, initial = {}, spy, ...props }) => {
  const [changes, setChanges] = useState(initial)
  return (
    <Fields
      changes={changes}
      company={company}
      onChange={(field, value) => { spy(field, value); setChanges(current => ({ ...current, [field]: value })) }}
      {...props}
    />
  )
}
const drawGeneral = (props = {}) => {
  const spy = vi.fn()
  render(<Host Fields={GeneralFields} spy={spy} {...props} />)
  return spy
}
const drawWebhooks = (props = {}) => {
  const spy = vi.fn()
  render(<Host Fields={WebhooksFields} spy={spy} {...props} />)
  return spy
}

describe('GeneralFields', () => {
  it('draws Name, Limit, Timezone, Priority and Address, in main\'s order, with the values of the company', () => {
    drawGeneral()
    const frames = [...document.querySelectorAll('.odc-dc-fields > [data-field], .odc-dc-pair > [data-field]')]
    expect(frames.map(frame => frame.getAttribute('data-field'))).toEqual(['name', 'limit', 'timezone', 'priority', 'address'])
    expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Moto Express')
    expect(screen.getByRole('textbox', { name: 'Limit' })).toHaveValue('8')
    expect(screen.getByRole('button', { name: /Timezone/ })).toHaveTextContent('America/Bogota')
    expect(screen.getByRole('textbox', { name: /Address/ })).toHaveValue('Calle 1 # 2-3')
  })

  it('a pending change wins over the company, an emptied one included', () => {
    drawGeneral({ initial: { name: 'Moto Plus', address: '', limit: '', timezone: 'Europe/Madrid' } })
    expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Moto Plus')
    expect(screen.getByRole('textbox', { name: /Address/ })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Limit' })).toHaveValue('')
    expect(screen.getByRole('button', { name: /Timezone/ })).toHaveTextContent('Europe/Madrid')
  })

  it('without a company it draws empty fields (the add form)', () => {
    drawGeneral({ company: null })
    expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Limit' })).toHaveValue('')
    expect(screen.getByRole('button', { name: /Timezone/ })).toHaveTextContent('Select a timezone')
  })

  it('typing in Name and Address reports each edit with its field', async () => {
    const user = userEvent.setup()
    const spy = drawGeneral()
    await user.type(screen.getByRole('textbox', { name: /Name/ }), '!')
    expect(spy).toHaveBeenLastCalledWith('name', 'Moto Express!')
    await user.type(screen.getByRole('textbox', { name: /Address/ }), '?')
    expect(spy).toHaveBeenLastCalledWith('address', 'Calle 1 # 2-3?')
  })

  it('Name, Address and Timezone are required, with the mark and the words for a screen reader; Limit is not', () => {
    drawGeneral()
    for (const field of ['name', 'address', 'timezone']) {
      const frame = document.querySelector(`[data-field="${field}"]`)
      expect(within(frame).getByText('Required')).toBeInTheDocument()
    }
    const limit = document.querySelector('[data-field="limit"]')
    expect(within(limit).queryByText('Required')).toBeNull()
    expect(screen.getByRole('textbox', { name: /Name/ })).toBeRequired()
    expect(screen.getByRole('textbox', { name: /Address/ })).toBeRequired()
    expect(screen.getByRole('textbox', { name: 'Limit' })).not.toBeRequired()
  })

  describe('Limit', () => {
    it('is a numeric keyboard field', () => {
      drawGeneral()
      expect(screen.getByRole('textbox', { name: 'Limit' })).toHaveAttribute('inputmode', 'numeric')
    })

    it('lets only digits through when typed', async () => {
      const user = userEvent.setup()
      const spy = drawGeneral({ initial: { limit: '' } })
      await user.type(screen.getByRole('textbox', { name: 'Limit' }), '1a2-3.4 ')
      expect(spy.mock.calls.filter(([field]) => field === 'limit').map(([, value]) => value)).toEqual(['1', '1', '12', '12', '123', '123', '1234', '1234'])
      expect(screen.getByRole('textbox', { name: 'Limit' })).toHaveValue('1234')
    })

    it('cleans a paste of anything else', async () => {
      const user = userEvent.setup()
      const spy = drawGeneral({ initial: { limit: '' } })
      await user.click(screen.getByRole('textbox', { name: 'Limit' }))
      await user.paste('12 abc 34')
      expect(spy).toHaveBeenLastCalledWith('limit', '1234')
    })
  })

  describe('Priority', () => {
    const group = () => screen.getByRole('group', { name: 'Priority' })

    it('is a segmented control with Low, Normal, High and Urgent and a visible label', () => {
      drawGeneral()
      expect(document.querySelector('[data-field="priority"] .odc-field-label')).toHaveTextContent('Priority')
      expect(within(group()).getAllByRole('button').map(button => button.textContent))
        .toEqual(['Low', 'Normal', 'High', 'Urgent'])
    })

    it('shows the priority of the company', () => {
      drawGeneral()
      expect(within(group()).getByRole('button', { name: 'High' })).toHaveAttribute('aria-pressed', 'true')
    })

    it.each([[-1, 'Low'], [0, 'Normal'], [1, 'High'], [2, 'Urgent'], ['2', 'Urgent']])('priority %s checks %s', (priority, label) => {
      drawGeneral({ initial: { priority } })
      expect(within(group()).getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true')
    })

    // redesign DC-R1 (review r1 F7): the row says «Unknown» for these; the panel does not claim «Normal» (main's select showed none)
    it('a company without priority shows none chosen', () => {
      drawGeneral({ company: { ...company, priority: null } })
      expect(within(group()).queryAllByRole('button', { pressed: true })).toEqual([])
    })

    it('a value that is not one of the four shows none chosen too', () => {
      drawGeneral({ initial: { priority: 9 } })
      expect(within(group()).queryAllByRole('button', { pressed: true })).toEqual([])
    })

    it('the add form (no company) reads Normal, the value main sent when none was chosen', () => {
      drawGeneral({ company: null })
      expect(within(group()).getByRole('button', { name: 'Normal' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('choosing one reports the NUMBER, not the text', async () => {
      const user = userEvent.setup()
      const spy = drawGeneral()
      await user.click(within(group()).getByRole('button', { name: 'Urgent' }))
      expect(spy).toHaveBeenLastCalledWith('priority', 2)
      await user.click(within(group()).getByRole('button', { name: 'Low' }))
      expect(spy).toHaveBeenLastCalledWith('priority', -1)
      await user.click(within(group()).getByRole('button', { name: 'Normal' }))
      expect(spy).toHaveBeenLastCalledWith('priority', 0)
    })
  })

  describe('Timezone', () => {
    it('choosing a zone reports it', async () => {
      const user = userEvent.setup()
      const spy = drawGeneral()
      await user.click(screen.getByRole('button', { name: /Timezone/ }))
      await user.type(await screen.findByRole('searchbox', { name: 'Search' }), 'madrid')
      await user.click(await screen.findByRole('option', { name: 'Europe/Madrid' }))
      expect(spy).toHaveBeenLastCalledWith('timezone', 'Europe/Madrid')
    })

    it('a new timezoneKey remounts the select so it shows the value from outside again (Discard)', () => {
      const view = render(<GeneralFields changes={{ timezone: 'Europe/Madrid' }} company={company} onChange={vi.fn()} timezoneKey={0} />)
      expect(screen.getByRole('button', { name: /Timezone/ })).toHaveTextContent('Europe/Madrid')
      view.rerender(<GeneralFields changes={{}} company={company} onChange={vi.fn()} timezoneKey={1} />)
      expect(screen.getByRole('button', { name: /Timezone/ })).toHaveTextContent('America/Bogota')
    })
  })

  describe('errors', () => {
    it('go under their own field, linked to it', () => {
      drawGeneral({ errors: { name: 'Name is missing', address: 'Address is missing', timezone: 'Zone is missing' } })
      expect(screen.getByRole('textbox', { name: /Name/ })).toBeInvalid()
      expect(screen.getByRole('textbox', { name: /Name/ })).toHaveAccessibleDescription('Name is missing')
      expect(screen.getByRole('textbox', { name: /Address/ })).toHaveAccessibleDescription('Address is missing')
      const zone = document.querySelector('[data-field="timezone"]')
      expect(within(zone).getByRole('alert')).toHaveTextContent('Zone is missing')
      // no error of another field leaks onto Limit
      expect(screen.getByRole('textbox', { name: 'Limit' })).not.toBeInvalid()
    })

    it('without errors nothing is invalid and nothing is announced', () => {
      drawGeneral()
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.getByRole('textbox', { name: /Name/ })).toBeValid()
    })
  })

  it('disabled disables the text fields and the time zone', () => {
    drawGeneral({ disabled: true })
    expect(screen.getByRole('textbox', { name: /Name/ })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Limit' })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: /Address/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Timezone/ })).toHaveAttribute('aria-disabled', 'true')
  })

  // redesign DC-B3 (agent finding): P/SegmentedControl has no `disabled`; the field ignores a press instead
  it('disabled leaves Priority inert too: a press reports nothing', async () => {
    const user = userEvent.setup()
    const spy = drawGeneral({ disabled: true })
    await user.click(within(screen.getByRole('group', { name: 'Priority' })).getByRole('button', { name: 'Urgent' }))
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('WebhooksFields', () => {
  it('draws the three webhooks with the values of the company', () => {
    drawWebhooks()
    const fields = [...document.querySelectorAll('.odc-dc-fields [data-field]')].map(frame => frame.getAttribute('data-field'))
    expect(fields).toEqual(['webhook_new_order', 'webhook_cancel_request', 'webhook_order_status_changed'])
    expect(screen.getByRole('textbox', { name: /Webhook new order/ })).toHaveValue('https://example.test/hooks/new')
    expect(screen.getByRole('textbox', { name: /Webhook cancel request/ })).toHaveValue('https://example.test/hooks/cancel')
    expect(screen.getByRole('textbox', { name: /Webhook order status changed/ })).toHaveValue('')
  })

  it('a pending change wins over the company', () => {
    drawWebhooks({ initial: { webhook_new_order: 'https://example.test/hooks/changed', webhook_cancel_request: '' } })
    expect(screen.getByRole('textbox', { name: /Webhook new order/ })).toHaveValue('https://example.test/hooks/changed')
    expect(screen.getByRole('textbox', { name: /Webhook cancel request/ })).toHaveValue('')
  })

  it('new order and cancel request are required, order status changed is not', () => {
    drawWebhooks()
    expect(screen.getByRole('textbox', { name: /Webhook new order/ })).toBeRequired()
    expect(screen.getByRole('textbox', { name: /Webhook cancel request/ })).toBeRequired()
    expect(screen.getByRole('textbox', { name: /Webhook order status changed/ })).not.toBeRequired()
    expect(within(document.querySelector('[data-field="webhook_new_order"]')).getByText('Required')).toBeInTheDocument()
    expect(within(document.querySelector('[data-field="webhook_order_status_changed"]')).queryByText('Required')).toBeNull()
  })

  it('reports each edit with its field', async () => {
    const user = userEvent.setup()
    const spy = drawWebhooks({ initial: { webhook_order_status_changed: '' } })
    await user.type(screen.getByRole('textbox', { name: /Webhook order status changed/ }), 'x')
    expect(spy).toHaveBeenLastCalledWith('webhook_order_status_changed', 'x')
  })

  it('the URLs read left to right and are not spell-checked', () => {
    drawWebhooks()
    const input = screen.getByRole('textbox', { name: /Webhook new order/ })
    expect(input).toHaveAttribute('dir', 'ltr')
    expect(input).toHaveAttribute('spellcheck', 'false')
  })

  it('errors go under their own webhook', () => {
    drawWebhooks({ errors: { webhook_new_order: 'New order is missing' } })
    expect(screen.getByRole('textbox', { name: /Webhook new order/ })).toHaveAccessibleDescription('New order is missing')
    expect(screen.getByRole('textbox', { name: /Webhook cancel request/ })).toBeValid()
  })

  describe('API key', () => {
    it('is not drawn unless showApiKey', () => {
      drawWebhooks()
      expect(screen.queryByRole('textbox', { name: 'API Key' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Copy API Key' })).toBeNull()
    })

    it('with showApiKey it is read only, shows the key and has a «Copy API Key» button', () => {
      drawWebhooks({ showApiKey: true })
      const key = screen.getByRole('textbox', { name: 'API Key' })
      expect(key).toHaveValue('api-key-test')
      expect(key).toHaveAttribute('readonly')
      expect(screen.getByRole('button', { name: 'Copy API Key' })).toBeEnabled()
    })

    it('typing in it changes nothing', async () => {
      const user = userEvent.setup()
      const spy = drawWebhooks({ showApiKey: true })
      await user.type(screen.getByRole('textbox', { name: 'API Key' }), 'zzz')
      expect(spy).not.toHaveBeenCalled()
      expect(screen.getByRole('textbox', { name: 'API Key' })).toHaveValue('api-key-test')
    })

    it('the key is not a pending change: it reads the company even when changes name something else', () => {
      drawWebhooks({ showApiKey: true, initial: { api_key: 'other-key' } })
      expect(screen.getByRole('textbox', { name: 'API Key' })).toHaveValue('api-key-test')
    })

    it('a company with no key has an empty field and nothing to copy', () => {
      drawWebhooks({ showApiKey: true, company: { ...company, api_key: null } })
      expect(screen.getByRole('textbox', { name: 'API Key' })).toHaveValue('')
      expect(screen.getByRole('button', { name: 'Copy API Key' })).toBeDisabled()
    })

    it('Copy sends the key to the clipboard', async () => {
      const user = userEvent.setup()
      const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
      drawWebhooks({ showApiKey: true })
      await user.click(screen.getByRole('button', { name: 'Copy API Key' }))
      expect(writeText).toHaveBeenCalledWith('api-key-test')
      writeText.mockRestore()
    })
  })

  it('disabled disables every webhook', () => {
    drawWebhooks({ disabled: true })
    for (const input of screen.getAllByRole('textbox')) expect(input).toBeDisabled()
  })
})
