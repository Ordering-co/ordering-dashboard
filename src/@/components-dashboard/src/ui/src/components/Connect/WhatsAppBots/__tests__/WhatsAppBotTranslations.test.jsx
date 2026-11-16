import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { WhatsAppBotTranslations } from '../WhatsAppBotTranslations'
import { WhatsAppTranslationsModal } from '../WhatsAppTranslationsModal'

const catalog = {
  welcome: {
    value: 'Hello from Pizza Hat',
    default: 'Hello from Pizza Hat',
    maxLength: 1024,
    isCustom: false,
    label: 'Welcome message',
    group: 'greeting',
    placeholders: []
  },
  address: {
    value: 'Deliver to *{{address}}*?',
    default: 'Deliver to *{{address}}*?',
    maxLength: 1024,
    isCustom: false,
    label: 'Confirm address message',
    group: 'address',
    placeholders: ['address']
  },
  delivery: {
    value: 'Delivery',
    default: 'Delivery',
    maxLength: 20,
    isCustom: false,
    label: 'Delivery button',
    group: 'order',
    placeholders: []
  },
  payment: {
    value: 'How would you like to pay?',
    default: 'How would you like to pay?',
    maxLength: 1024,
    isCustom: false,
    label: 'Payment prompt',
    group: 'payment',
    placeholders: []
  },
  confirm: {
    value: 'Custom confirmation',
    default: 'Confirm your order',
    maxLength: 1024,
    isCustom: true,
    label: 'Order confirmation',
    group: 'confirmation',
    placeholders: []
  }
}

const renderEditor = (overrides = {}) => {
  const props = {
    translationsState: {
      locale: 'en',
      loaded: true,
      loading: false,
      saving: false,
      error: null,
      savedNotice: false,
      catalog,
      draft: { welcome: '', address: '', delivery: '', payment: '', confirm: 'Custom confirmation' },
      validation: {},
      patch: {}
    },
    setTranslationLocale: vi.fn(),
    updateTranslationDraft: vi.fn(),
    saveBotTranslations: vi.fn(),
    reloadBotTranslations: vi.fn(),
    brandName: 'Pizza Hat',
    ...overrides
  }
  renderWithProviders(<WhatsAppBotTranslations {...props} />)
  return props
}

describe('WhatsApp bot translation editor', () => {
  it('shows a compact summary and opens the full editor on demand', () => {
    renderEditor()

    expect(screen.getByRole('heading', { name: 'Customer messages & Translations' })).toBeTruthy()
    expect(screen.getByText('1 of 5 customized')).toBeTruthy()
    expect(screen.getByText('Hello from Pizza Hat')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Configure messages & translations' }))

    expect(screen.getByRole('heading', { name: 'WhatsApp Bot Translations' })).toBeTruthy()
    expect(screen.getAllByText('Pizza Hat')).toHaveLength(2)
    expect(screen.getByRole('tab', { name: 'Greeting' })).toHaveAttribute('aria-selected', 'true')
    const welcome = screen.getByRole('textbox', { name: 'Welcome message' })
    expect(welcome).toHaveAttribute('placeholder', 'Hello from Pizza Hat')
    expect(welcome).toHaveAttribute('maxlength', '1024')
    expect(welcome).toHaveStyle('resize: none')
  })

  it('changes locale and renders button copy as a single-line field', () => {
    const props = renderEditor({ brandName: 'Pizza Hat' })
    fireEvent.click(screen.getByRole('button', { name: 'Configure messages & translations' }))

    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'fr' } })
    fireEvent.click(screen.getByRole('tab', { name: 'Order' }))

    expect(props.setTranslationLocale).toHaveBeenCalledWith('fr')
    expect(screen.getByRole('textbox', { name: 'Delivery button' }).tagName).toBe('INPUT')
  })

  it('keeps every catalog message available across API-defined groups', () => {
    const groups = [
      'greeting',
      'address',
      'order',
      'payment',
      'confirmation',
      'support',
      'track_order',
      'fallback',
      'menu'
    ]
    const fullCatalog = Object.fromEntries(Array.from({ length: 29 }, (_, index) => {
      const group = groups[index % groups.length]
      return [`field-${index}`, {
        value: `Message ${index}`,
        default: `Message ${index}`,
        maxLength: index % 3 === 0 ? 20 : 1024,
        isCustom: false,
        label: `Field ${index}`,
        group,
        placeholders: []
      }]
    }))
    renderEditor({
      translationsState: {
        locale: 'en',
        loaded: true,
        loading: false,
        saving: false,
        error: null,
        savedNotice: false,
        catalog: fullCatalog,
        draft: Object.fromEntries(Object.keys(fullCatalog).map(key => [key, ''])),
        validation: {},
        patch: {}
      }
    })

    expect(screen.getByText('0 of 29 customized')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Configure messages & translations' }))
    groups.forEach((group, groupIndex) => {
      const tabName = [
        'Greeting',
        'Address',
        'Order',
        'Payment',
        'Confirmation',
        'Support',
        'Track Order',
        'Fallback',
        'Menu'
      ][groupIndex]
      fireEvent.click(screen.getByRole('tab', { name: tabName }))
      const expectedCount = Object.values(fullCatalog).filter(entry => entry.group === group).length
      expect(screen.getAllByRole('textbox')).toHaveLength(expectedCount)
    })
  })

  it('inserts required placeholders and blocks save while validation fails', () => {
    const props = renderEditor({
      brandName: 'Pizza Hat',
      translationsState: {
        locale: 'en',
        loaded: true,
        loading: false,
        saving: false,
        error: null,
        savedNotice: false,
        catalog,
        draft: { welcome: '', address: 'Deliver here?', delivery: '', payment: '', confirm: 'Custom confirmation' },
        validation: {
          address: { missingPlaceholders: ['address'], overLimit: false }
        },
        patch: { address: 'Deliver here?' }
      }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Configure messages & translations' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Address' }))
    fireEvent.click(screen.getByRole('button', { name: 'Insert {{address}}' }))

    expect(props.updateTranslationDraft).toHaveBeenCalledWith('address', 'Deliver here?{{address}}')
    expect(screen.getByRole('button', { name: 'Save translations' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Fix error' }))
    expect(props.saveBotTranslations).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Confirm address message' })).toHaveFocus()
  })

  it('opens the tab of the invalid field when save is blocked', () => {
    renderEditor({
      translationsState: {
        locale: 'en',
        loaded: true,
        loading: false,
        saving: false,
        error: null,
        savedNotice: false,
        catalog,
        draft: { welcome: '', address: '', delivery: '', payment: 'x'.repeat(21), confirm: 'Custom confirmation' },
        validation: {
          payment: { missingPlaceholders: [], overLimit: true }
        },
        patch: { payment: 'x'.repeat(21) }
      }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Configure messages & translations' }))
    expect(screen.getByRole('tab', { name: 'Greeting' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Payment' })).toHaveAttribute('data-error', 'true')
    expect(screen.getByRole('tab', { name: 'Confirmation' }).querySelector('[data-tone="custom"]')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('1 field needs attention: Payment prompt')
    expect(screen.getByRole('button', { name: 'Save translations' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Fix error' }))

    expect(screen.getByRole('tab', { name: 'Payment' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('textbox', { name: 'Payment prompt' })).toHaveFocus()
    expect(screen.getByText('Maximum length exceeded.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Preview Payment prompt' })).toHaveAttribute('data-invalid', 'true')
  })

  it('shows the greeting reply buttons under their prompt in the WhatsApp preview', () => {
    renderEditor({
      translationsState: {
        locale: 'es',
        loaded: true,
        loading: false,
        saving: false,
        error: null,
        savedNotice: false,
        catalog: {
          chatbot_greeting_prompt: {
            ...catalog.welcome,
            label: 'Greeting prompt',
            default: '¿Qué deseas hacer?',
            value: '¿Qué deseas hacer?'
          }
        },
        draft: { chatbot_greeting_prompt: '' },
        validation: {},
        patch: {}
      }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Configure messages & translations' }))
    expect(screen.getByText('Empezar pedido 🛒')).toBeTruthy()
    expect(screen.getByText('Mi pedido ⏱')).toBeTruthy()
    expect(screen.getByText('Ayuda 💬')).toBeTruthy()
  })

  it('resets a custom value and focuses a field from the WhatsApp preview', () => {
    const props = renderEditor({ brandName: 'Pizza Hat' })
    fireEvent.click(screen.getByRole('button', { name: 'Configure messages & translations' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Confirmation' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset Order confirmation' }))

    expect(props.updateTranslationDraft).toHaveBeenCalledWith('confirm', '')

    fireEvent.click(screen.getByRole('button', { name: 'Preview Order confirmation' }))
    expect(screen.getByRole('textbox', { name: 'Order confirmation' })).toHaveFocus()
  })

  it('shows maximum length errors in the modal', () => {
    const props = renderEditor({
      translationsState: {
        locale: 'en',
        loaded: true,
        loading: false,
        saving: false,
        error: null,
        savedNotice: false,
        catalog,
        draft: { welcome: '', address: '', delivery: 'x'.repeat(21), payment: '', confirm: 'Custom confirmation' },
        validation: {
          delivery: { missingPlaceholders: [], overLimit: true }
        },
        patch: { delivery: 'x'.repeat(21) }
      }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Configure messages & translations' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Order' }))
    expect(screen.getByLabelText('Characters remaining: 0')).toHaveAttribute('data-status', 'danger')
    expect(screen.getByText('Maximum length exceeded.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save translations' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Preview Delivery button' }))
    expect(props.saveBotTranslations).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Delivery button' })).toHaveFocus()

    fireEvent.change(screen.getByRole('textbox', { name: 'Delivery button' }), {
      target: { value: 'x'.repeat(25) }
    })
    expect(props.updateTranslationDraft).toHaveBeenCalledWith('delivery', 'x'.repeat(20))
  })

  it('warns when a field approaches its character limit', () => {
    renderEditor({
      translationsState: {
        locale: 'en',
        loaded: true,
        loading: false,
        saving: false,
        error: null,
        savedNotice: false,
        catalog,
        draft: { welcome: '', address: '', delivery: 'x'.repeat(16), payment: '', confirm: 'Custom confirmation' },
        validation: {},
        patch: { delivery: 'x'.repeat(16) }
      }
    })

    fireEvent.click(screen.getByRole('button', { name: 'Configure messages & translations' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Order' }))
    expect(screen.getByLabelText('Characters remaining: 4')).toHaveAttribute('data-status', 'warning')
  })

  it('uses the existing save handler when a valid patch is ready', () => {
    const props = renderEditor({
      translationsState: {
        locale: 'en',
        loaded: true,
        loading: false,
        saving: false,
        error: null,
        savedNotice: false,
        catalog,
        draft: { welcome: 'A custom welcome', address: '', delivery: '', payment: '', confirm: 'Custom confirmation' },
        validation: {},
        patch: { welcome: 'A custom welcome' }
      }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Configure messages & translations' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save translations' }))
    expect(props.saveBotTranslations).toHaveBeenCalledTimes(1)
  })

  it('shows loading and recoverable error states', () => {
    const retry = vi.fn()
    const { rerender } = renderWithProviders(
      <WhatsAppBotTranslations
        translationsState={{ locale: 'en', loading: true, catalog: {}, draft: {}, validation: {}, patch: {} }}
      />
    )
    expect(screen.getByText('Loading translations...')).toBeTruthy()

    rerender(
      <WhatsAppBotTranslations
        translationsState={{ locale: 'en', loading: false, error: ['ERROR'], catalog: {}, draft: {}, validation: {}, patch: {} }}
        reloadBotTranslations={retry}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('ERROR')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(retry).toHaveBeenCalled()
  })

  it('shows editor skeletons while the catalog is loading', () => {
    renderWithProviders(
      <WhatsAppTranslationsModal
        open
        brandName='Pizza Hat'
        translationsState={{ locale: 'fr', loading: true, catalog: {}, draft: {}, validation: {}, patch: {} }}
      />
    )
    expect(screen.getByRole('status')).toHaveTextContent('Loading translations...')
    expect(screen.queryByText('No customer messages are available.')).toBeNull()
    expect(document.querySelectorAll('[data-skeleton="translation"]').length).toBeGreaterThan(4)
  })
})
