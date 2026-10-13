import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import {
  formatCountdown,
  formatFieldValue,
  formatRetryAt,
  formatSchedule,
  getActionDisplayStatus,
  getFieldLabel,
  getRecordId,
  getRecordName,
  getRecordTypeLabel,
  getSecondsLeft
} from '../format'
import { getAssistantPageContext, withPageEntities } from '../pageContext'
import { AssistantMarkdown, parseBlocks } from '../AssistantMarkdown'
import { getAssistantOffset, setAssistantOffset } from '../../../utils/assistantDock'

const t = (_key, fallback) => fallback
const helpers = { t, parsePrice: (value) => `$${value.toFixed(2)}`, parseDate: (value) => `date(${value})` }

describe('format', () => {
  it('names records and fields of the allowed writes', () => {
    expect(getRecordTypeLabel('Product.update', t)).toBe('Product')
    expect(getRecordTypeLabel('ExtraOptionSuboption.update.put', t)).toBe('Extra suboption')
    expect(getRecordTypeLabel('Offer.update.put', t)).toBe('Promotion')
    expect(getRecordTypeLabel('Unknown.thing', t)).toBe('Record')
    expect(getFieldLabel('offer_price', t)).toBe('Offer price')
    expect(getFieldLabel('some_new_field', t)).toBe('some new field')
  })

  it('names a record without a name by its id', () => {
    expect(getRecordId('Product.update', { business_id: 3, category_id: 7, product_id: 45 })).toBe('45')
    expect(getRecordId('ExtraOption.update.put', { business_id: 3, extra_id: 2, option_id: 9 })).toBe('9')
    expect(getRecordId('ExtraOptionSuboption.update.put', { business_id: 3, extra_id: 2, option_id: 9, suboption_id: 4 })).toBe('4')
    expect(getRecordId('Business.update', { business: 3 })).toBe('3')
    expect(getRecordId('Order.update.put', { order: 1234 })).toBe('1234')
    expect(getRecordId('Menu.update', {})).toBeNull()
    expect(getRecordName({ operation_id: 'Business.update', path_params: { business: 3 }, record_name: null }, t)).toBe('Store #3')
    expect(getRecordName({ operation_id: 'Product.update', path_params: { product_id: 45 }, record_name: 'Pizza' }, t)).toBe('Pizza')
    expect(getRecordName({ operation_id: 'Menu.update', path_params: {}, record_name: null }, t)).toBe('Menu')
  })

  it('formats values by field', () => {
    expect(formatFieldValue('price', 14, helpers)).toBe('$14.00')
    expect(formatFieldValue('enabled', 0, helpers)).toBe('No')
    expect(formatFieldValue('in_offer', true, helpers)).toBe('Yes')
    expect(formatFieldValue('snooze_until', '2026-10-01 22:00:00', helpers)).toBe('date(2026-10-01 22:00:00)')
    expect(formatFieldValue('status', 7, helpers)).toBe('Accepted by business')
    expect(formatFieldValue('rate_type', 1, helpers)).toBe('Percentage')
    expect(formatFieldValue('rate', 15, { ...helpers, changes: [{ field: 'rate_type', after: 1 }] })).toBe('15%')
    expect(formatFieldValue('prepared_in', 20, helpers)).toBe('20 min')
    expect(formatFieldValue('description', null, helpers)).toBe('—')
    expect(formatFieldValue('name', 'Pizza', helpers)).toBe('Pizza')
  })

  it('summarizes a weekly schedule, Sunday first', () => {
    const open = { enabled: true, lapses: [{ open: { hour: 9, minute: 0 }, close: { hour: 22, minute: 30 } }] }
    const closed = { enabled: false, lapses: [] }
    expect(formatSchedule([closed, open, open, open, open, open, closed], t)).toEqual([
      'Sun closed', 'Mon 09:00–22:30', 'Tue 09:00–22:30', 'Wed 09:00–22:30', 'Thu 09:00–22:30', 'Fri 09:00–22:30', 'Sat closed'
    ])
    expect(formatSchedule('not a schedule', t)).toBeNull()
  })

  it('counts down to expires_at and shows a proposal that ran out as expired', () => {
    const now = Date.UTC(2026, 8, 30, 12, 0, 0)
    const expiresAt = new Date(now + 125000).toISOString()
    expect(getSecondsLeft(expiresAt, now)).toBe(125)
    expect(formatCountdown(125)).toBe('2:05')
    expect(getActionDisplayStatus({ status: 'proposed', expires_at: expiresAt }, now)).toBe('proposed')
    expect(getActionDisplayStatus({ status: 'proposed', expires_at: expiresAt }, now + 200000)).toBe('expired')
    expect(getActionDisplayStatus({ status: 'executed', expires_at: expiresAt }, now + 200000)).toBe('executed')
  })
})

describe('formatRetryAt', () => {
  // Local times, whatever the time zone of the test run
  const now = new Date(2026, 9, 1, 15, 0).getTime()
  const at = (day, hour, minute = 0) => new Date(2026, 9, day, hour, minute).toISOString()

  it('says today, tomorrow or the date, with the time', () => {
    expect(formatRetryAt(at(1, 19), t, 'en', now)).toBe('You can use it again today at 7:00 PM.')
    expect(formatRetryAt(at(2, 9, 30), t, 'en', now)).toBe('You can use it again tomorrow at 9:30 AM.')
    expect(formatRetryAt(at(3, 19), t, 'en', now)).toBe('You can use it again on Oct 3 at 7:00 PM.')
  })

  it('uses the Dashboard language and falls back to later', () => {
    expect(formatRetryAt(at(1, 19), t, 'es', now)).toBe('You can use it again today at 19:00.')
    expect(formatRetryAt(at(1, 19), t, 'not a locale', now)).toMatch(/^You can use it again today at /)
    expect(formatRetryAt(null, t, 'en', now)).toBe('You can use it again later.')
    expect(formatRetryAt('soon', t, 'en', now)).toBe('You can use it again later.')
  })
})

describe('getAssistantPageContext', () => {
  it('reads the store and product of the products page', () => {
    expect(getAssistantPageContext({ pathname: '/stores/products/pizza-hub', search: '?category=7&product=45&id=3' })).toEqual({
      context: { route: '/stores/products/pizza-hub?category=7&product=45&id=3', business_id: 3, product_id: 45 },
      refs: [{ type: 'business', id: 3, name: null }, { type: 'product', id: 45, name: null }]
    })
  })

  it('reads the store only where ?id is a store', () => {
    expect(getAssistantPageContext({ pathname: '/stores/list', search: '?id=3' }).context).toEqual({ route: '/stores/list?id=3', business_id: 3 })
    expect(getAssistantPageContext({ pathname: '/connect/pos-menu', search: '?id=3' }).context.business_id).toBe(3)
    for (const pathname of ['/stores/devices', '/stores/markups', '/connect/delivery-services']) {
      expect(getAssistantPageContext({ pathname, search: '?id=5' })).toEqual({ context: { route: `${pathname}?id=5` }, refs: [] })
    }
  })

  it('reads the brand of the brands page and the user of the customers, admins and drivers pages', () => {
    expect(getAssistantPageContext({ pathname: '/stores/brand', search: '?id=5' })).toEqual({
      context: { route: '/stores/brand?id=5', franchise_id: 5 },
      refs: [{ type: 'franchise', id: 5, name: null }]
    })
    for (const pathname of ['/users/customers', '/users/admins', '/delivery/drivers-list']) {
      expect(getAssistantPageContext({ pathname, search: '?id=8' })).toEqual({
        context: { route: `${pathname}?id=8`, user_id: 8 },
        refs: [{ type: 'user', id: 8, name: null }]
      })
    }
  })

  it('reads the order of the orders page and ignores ids that are not positive integers', () => {
    expect(getAssistantPageContext({ pathname: '/orders', search: '?id=1234' }).context).toEqual({ route: '/orders?id=1234', order_id: 1234 })
    expect(getAssistantPageContext({ pathname: '/orders', search: '?id=abc' }).context).toEqual({ route: '/orders?id=abc' })
    expect(getAssistantPageContext({ pathname: '/users/business-owners', search: '?id=5' }).refs).toEqual([])
  })

  it('adds what the page published, with names for the chips', () => {
    const fromUrl = getAssistantPageContext({ pathname: '/stores/products/taste-wine', search: '?category=12&product=45' })
    expect(withPageEntities(fromUrl, {
      business: { id: 3, name: 'Taste Wine' },
      category: { id: 12, name: 'Beer' },
      product: null
    })).toEqual({
      context: { route: '/stores/products/taste-wine?category=12&product=45', business_id: 3, category_id: 12, product_id: 45 },
      refs: [
        { type: 'business', id: 3, name: 'Taste Wine' },
        { type: 'category', id: 12, name: 'Beer' },
        { type: 'product', id: 45, name: null }
      ]
    })
    expect(withPageEntities(fromUrl, null)).toEqual(fromUrl)
    expect(withPageEntities({ context: null, refs: [] }, { business: { id: 'featured' } })).toEqual({ context: null, refs: [] })
  })

  it('drops the query when the route is too long for the contract', () => {
    const search = `?q=${'x'.repeat(250)}`
    expect(getAssistantPageContext({ pathname: '/orders', search }).context).toEqual({ route: '/orders' })
  })
})

describe('AssistantMarkdown', () => {
  it('parses paragraphs, lists and tables', () => {
    const blocks = parseBlocks('Yesterday:\n\n| Store | Sales |\n|---|---:|\n| Pizza Hub | $120 |\n\n- one\n- two\n\n1. first')
    expect(blocks.map(block => block.type)).toEqual(['p', 'table', 'ul', 'ol'])
    expect(blocks[1]).toMatchObject({ header: ['Store', 'Sales'], rows: [['Pizza Hub', '$120']] })
  })

  it('renders text from the project as text, never as markup', () => {
    const { container } = render(
      <AssistantMarkdown text={'**Bold** <img src=x onerror=alert(1)> [safe](https://ordering.co) [bad](javascript:alert(1))'} />
    )
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('strong').textContent).toBe('Bold')
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
    const links = container.querySelectorAll('a')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', 'https://ordering.co')
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer')
    expect(container.textContent).toContain('bad')
  })

  it('leaves snake_case, URLs, emails and math as text', () => {
    const text = 'pizza_margherita_large https://shop.test/my_best_store john_doe_1@mail.com 2 * 3 * 4'
    const { container } = render(<AssistantMarkdown text={text} />)
    expect(container.querySelector('em')).toBeNull()
    expect(container.textContent).toBe(text)
  })

  it('still reads emphasis around words', () => {
    const { container } = render(<AssistantMarkdown text={'_one_, *two* and __three__ in my_store_x, **四**五'} />)
    expect([...container.querySelectorAll('em')].map(node => node.textContent)).toEqual(['one', 'two'])
    expect([...container.querySelectorAll('strong')].map(node => node.textContent)).toEqual(['three', '四'])
    expect(container.textContent).toContain('my_store_x')
  })
})

describe('assistantDock', () => {
  afterEach(() => setAssistantOffset(0))

  it('sets the CSS variables, moves Intercom and tells width listeners', () => {
    const intercom = vi.fn()
    window.Intercom = intercom
    const onResize = vi.fn()
    window.addEventListener('resize', onResize)

    try {
      setAssistantOffset(380)
      expect(getAssistantOffset()).toBe(380)
      expect(document.documentElement.style.getPropertyValue('--assistant-offset')).toBe('380px')
      expect(document.documentElement.style.getPropertyValue('--app-width')).toBe('calc(100vw - 380px)')
      expect(intercom).toHaveBeenCalledWith('update', { horizontal_padding: 400 })
      expect(onResize).toHaveBeenCalledOnce()

      setAssistantOffset(0)
      expect(document.documentElement.style.getPropertyValue('--assistant-offset')).toBe('')
      expect(intercom).toHaveBeenLastCalledWith('update', { horizontal_padding: 20 })
    } finally {
      window.removeEventListener('resize', onResize)
      delete window.Intercom
    }
  })
})
