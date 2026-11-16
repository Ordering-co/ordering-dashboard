const replacePlaceholders = (value, replacements) => (
  Object.entries(replacements || {}).reduce(
    (text, [key, replacement]) => text.replaceAll(`{{${key}}}`, String(replacement)),
    String(value || '')
  )
)

export const previewTextParts = (value, replacements) => {
  const text = replacePlaceholders(value, replacements)
  const parts = []
  const boldPattern = /\*([^*]+)\*/g
  let cursor = 0
  let match

  while ((match = boldPattern.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push({ text: text.slice(cursor, match.index), bold: false })
    }
    parts.push({ text: match[1], bold: true })
    cursor = match.index + match[0].length
  }

  if (cursor < text.length || parts.length === 0) {
    parts.push({ text: text.slice(cursor), bold: false })
  }

  return parts
}

const BUILTIN_REPLY_BUTTONS = {
  en: {
    chatbot_button_start: 'Start order 🛒',
    chatbot_button_track: 'Track order ⏱',
    chatbot_button_support: 'Support 💬',
    chatbot_button_cart: 'View cart 🛒'
  },
  es: {
    chatbot_button_start: 'Empezar pedido 🛒',
    chatbot_button_track: 'Mi pedido ⏱',
    chatbot_button_support: 'Ayuda 💬',
    chatbot_button_cart: 'Ver carrito 🛒'
  },
  fr: {
    chatbot_button_start: 'Commander 🛒',
    chatbot_button_track: 'Suivi ⏱',
    chatbot_button_support: 'Aide 💬',
    chatbot_button_cart: 'Panier 🛒'
  },
  ar: {
    chatbot_button_start: 'ابدأ الطلب 🛒',
    chatbot_button_track: 'الطلب ⏱',
    chatbot_button_support: 'المساعدة 💬',
    chatbot_button_cart: 'السلة 🛒'
  }
}

const ATTACHED_REPLY_BUTTONS = {
  chatbot_greeting_prompt: ['chatbot_button_start', 'chatbot_button_track', 'chatbot_button_support'],
  chatbot_after_order_prompt: ['chatbot_button_start', 'chatbot_button_track', 'chatbot_button_support'],
  chatbot_main_menu_body: ['chatbot_main_menu_button', 'chatbot_button_cart'],
  chatbot_order_type_prompt: ['chatbot_order_type_delivery', 'chatbot_order_type_pickup'],
  chatbot_paymethod_prompt: ['chatbot_paymethod_cash', 'chatbot_paymethod_card_delivery', 'chatbot_paymethod_online'],
  chatbot_set_address_body: ['chatbot_set_address_button'],
  chatbot_change_address_prompt: ['chatbot_change_address_button'],
  chatbot_confirm_address_body: ['chatbot_confirm_address', 'chatbot_change_address_button'],
  chatbot_address_notes_prompt: ['chatbot_address_notes_skip'],
  chatbot_order_review: ['chatbot_button_confirm_order', 'chatbot_button_change_payment'],
  chatbot_order_confirmed_delivery: ['chatbot_order_confirmed_track_button'],
  chatbot_order_confirmed_pickup: ['chatbot_order_confirmed_track_button']
}

const attachedButtonKeys = new Set(Object.values(ATTACHED_REPLY_BUTTONS).flat())

const catalogButtonLabel = (key, catalog, draft) => {
  const entry = catalog?.[key]
  if (!entry) return ''
  const draftValue = typeof draft?.[key] === 'string' ? draft[key] : ''
  return draftValue || entry.default || ''
}

const isActionEntry = (entry) => Number.isFinite(entry?.maxLength) && entry.maxLength <= 20

export const buildMessageUnits = (entries) => {
  const byKey = new Map(entries)
  const owner = new Map()
  entries.forEach(([key, entry]) => {
    if (isActionEntry(entry)) return
    ;(ATTACHED_REPLY_BUTTONS[key] || []).forEach(child => {
      if (byKey.has(child) && !owner.has(child)) owner.set(child, key)
    })
  })
  const units = []
  const started = new Map()
  entries.forEach(([key, entry]) => {
    if (isActionEntry(entry)) {
      const parent = owner.get(key)
      const unit = parent ? started.get(parent) : null
      if (unit) {
        unit.actions.push([key, entry])
        return
      }
      units.push({ id: key, label: entry.label, bodyKey: null, body: null, actions: [[key, entry]] })
      return
    }
    const unit = { id: key, label: entry.label, bodyKey: key, body: [key, entry], actions: [] }
    started.set(key, unit)
    units.push(unit)
  })
  return units
}

export const isAttachedReplyButton = (key, entries) => (
  attachedButtonKeys.has(key) &&
  entries.some(([messageKey]) => (ATTACHED_REPLY_BUTTONS[messageKey] || []).includes(key))
)

export const previewReplyButtons = (messageKey, locale, catalog, draft) => (
  (ATTACHED_REPLY_BUTTONS[messageKey] || []).map(key => {
    const catalogLabel = catalogButtonLabel(key, catalog, draft)
    const builtin = BUILTIN_REPLY_BUTTONS[locale]?.[key] || BUILTIN_REPLY_BUTTONS.en[key] || ''
    const label = catalogLabel || builtin
    return label ? { key, label, editable: Boolean(catalog?.[key]) } : null
  }).filter(Boolean)
)
