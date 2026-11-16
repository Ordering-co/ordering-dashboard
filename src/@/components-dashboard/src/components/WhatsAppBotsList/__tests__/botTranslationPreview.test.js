import { describe, expect, it } from 'vitest'
import { buildMessageUnits, previewReplyButtons, previewTextParts } from '../botTranslationPreview'

describe('WhatsApp bot translation preview', () => {
  it('substitutes example placeholders and marks WhatsApp bold spans safely', () => {
    expect(previewTextParts(
      'Selected *{{businessName}}*.\nDeliver to *{{address}}*?',
      { businessName: 'Pizza Hat', address: 'Main Avenue 123' }
    )).toEqual([
      { text: 'Selected ', bold: false },
      { text: 'Pizza Hat', bold: true },
      { text: '.\nDeliver to ', bold: false },
      { text: 'Main Avenue 123', bold: true },
      { text: '?', bold: false }
    ])
  })

  it('leaves unknown placeholders visible for configuration feedback', () => {
    expect(previewTextParts('Order {{orderId}}', {})).toEqual([
      { text: 'Order {{orderId}}', bold: false }
    ])
  })

  it('groups a message with its buttons and leaves a lone button as its own unit', () => {
    const body = { label: 'Confirm address', maxLength: 1024, default: 'Here?' }
    const button = { label: 'Confirm', maxLength: 20, default: 'Confirm' }
    const other = { label: 'Change', maxLength: 20, default: 'Change' }
    const units = buildMessageUnits([
      ['chatbot_confirm_address_body', body],
      ['chatbot_confirm_address', button],
      ['chatbot_change_address_button', other],
      ['chatbot_order_type_delivery', { label: 'Delivery', maxLength: 20, default: 'Delivery' }]
    ])
    expect(units.map(unit => unit.id)).toEqual(['chatbot_confirm_address_body', 'chatbot_order_type_delivery'])
    expect(units[0].actions.map(([key]) => key)).toEqual([
      'chatbot_confirm_address',
      'chatbot_change_address_button'
    ])
  })

  it('attaches the three greeting reply buttons the bot sends', () => {
    expect(previewReplyButtons('chatbot_greeting_prompt', 'es', {}, {}).map(button => button.label)).toEqual([
      'Empezar pedido 🛒',
      'Mi pedido ⏱',
      'Ayuda 💬'
    ])
  })

  it('attaches the reply buttons for every bot message that sends them', () => {
    const catalog = {
      chatbot_order_type_delivery: { default: 'Entrega', isCustom: false },
      chatbot_order_type_pickup: { default: 'Recoger', isCustom: false },
      chatbot_paymethod_cash: { default: 'Efectivo 💵', isCustom: false },
      chatbot_paymethod_card_delivery: { default: 'Tarjeta al llegar 💳', isCustom: false },
      chatbot_paymethod_online: { default: 'Pago en línea 💳', isCustom: false },
      chatbot_confirm_address: { default: 'Confirmar ✅', isCustom: false },
      chatbot_change_address_button: { default: 'Cambiar dirección', isCustom: false },
      chatbot_button_confirm_order: { default: 'Confirmar pedido ✅', isCustom: false },
      chatbot_button_change_payment: { default: 'Cambiar pago', isCustom: false },
      chatbot_order_confirmed_track_button: { default: 'Rastrear pedido', isCustom: false }
    }
    const labels = (key) => previewReplyButtons(key, 'es', catalog, {}).map(button => button.label)

    expect(labels('chatbot_confirm_address_body')).toEqual(['Confirmar ✅', 'Cambiar dirección'])
    expect(labels('chatbot_order_type_prompt')).toEqual(['Entrega', 'Recoger'])
    expect(labels('chatbot_paymethod_prompt')).toEqual(['Efectivo 💵', 'Tarjeta al llegar 💳', 'Pago en línea 💳'])
    expect(labels('chatbot_order_review')).toEqual(['Confirmar pedido ✅', 'Cambiar pago'])
    expect(labels('chatbot_order_confirmed_delivery')).toEqual(['Rastrear pedido'])
    expect(labels('chatbot_order_confirmed_pickup')).toEqual(['Rastrear pedido'])
    expect(labels('chatbot_after_order_prompt')).toEqual(['Empezar pedido 🛒', 'Mi pedido ⏱', 'Ayuda 💬'])
    expect(labels('chatbot_welcome_default')).toEqual([])
  })
})
