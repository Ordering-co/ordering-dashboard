import { describe, expect, it } from 'vitest'

import { getQuickMessages } from '../quickMessages'

const translate = (dictionary) => (key, fallback) => dictionary[key] ?? fallback

describe('getQuickMessages', () => {
  it('hides admin quick messages that only have the placeholder text', () => {
    expect(getQuickMessages(0, translate({}))).toEqual([])
  })

  it('hides placeholders translated with a localized prefix', () => {
    expect(getQuickMessages(0, translate({ ADMIN_MESSAGE_1: 'administrador_message_1' }))).toEqual([])
  })

  it('keeps the quick messages a project configured', () => {
    const t = translate({ ADMIN_MESSAGE_2: 'Your order is on its way', STORE_MESSAGE_1: 'Ready for pickup' })
    expect(getQuickMessages(0, t)).toEqual([{ key: 'message_2', text: 'Your order is on its way' }])
    expect(getQuickMessages(2, t)).toEqual([{ key: 'message_1', text: 'Ready for pickup' }])
  })

  it('returns no quick messages for other user levels', () => {
    expect(getQuickMessages(4, translate({ ADMIN_MESSAGE_1: 'Hello' }))).toEqual([])
  })
})
