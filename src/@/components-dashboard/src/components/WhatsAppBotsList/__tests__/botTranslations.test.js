import { describe, expect, it } from 'vitest'
import {
  buildTranslationPatch,
  createTranslationDraft,
  getTranslationCatalogGroups,
  validateTranslationDraft
} from '../botTranslations'

const catalog = {
  welcome: {
    value: 'Hello {{name}}',
    default: 'Hello {{name}}',
    maxLength: 30,
    isCustom: false,
    label: 'Welcome message',
    group: 'greeting',
    placeholders: ['name']
  },
  confirm: {
    value: 'Custom confirmation {{number}}',
    default: 'Order {{number}} confirmed',
    maxLength: 40,
    isCustom: true,
    label: 'Order confirmation',
    group: 'confirmation',
    placeholders: ['number']
  }
}

describe('WhatsApp bot translation helpers', () => {
  it('keeps every catalog group in API order without a fixed allowlist', () => {
    expect(getTranslationCatalogGroups({
      welcome: catalog.welcome,
      support: { ...catalog.welcome, group: 'support' },
      tracking: { ...catalog.welcome, group: 'track_order' },
      repeatedSupport: { ...catalog.welcome, group: 'support' }
    })).toEqual(['greeting', 'support', 'track_order'])
  })

  it('leaves automatic fields empty while keeping custom values editable', () => {
    expect(createTranslationDraft(catalog)).toEqual({
      welcome: '',
      confirm: 'Custom confirmation {{number}}'
    })
  })

  it('saves only changed keys and does not override an unchanged automatic value', () => {
    expect(buildTranslationPatch(catalog, {
      welcome: 'Hello {{name}}',
      confirm: 'Updated {{number}}'
    })).toEqual({ confirm: 'Updated {{number}}' })
  })

  it('turns a cleared custom value into null and ignores a clear automatic field', () => {
    expect(buildTranslationPatch(catalog, {
      welcome: '',
      confirm: ''
    })).toEqual({ confirm: null })
  })

  it('reports missing placeholders and values over the API limit', () => {
    expect(validateTranslationDraft(catalog, {
      welcome: 'Hello',
      confirm: 'x'.repeat(41)
    })).toEqual({
      welcome: { missingPlaceholders: ['name'], overLimit: false },
      confirm: { missingPlaceholders: ['number'], overLimit: true }
    })
  })
})
