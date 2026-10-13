import { renderHook } from '@testing-library/react'
import { it, expect, vi } from 'vitest'
import { useStoreOnboardingLanguage } from '../useStoreOnboardingLanguage'
const state = vi.hoisted(() => ({ code: 'en', translation: '' }))
vi.mock('../../contexts/LanguageContext', () => ({ useLanguage: () => { const translation = state.translation; return [{ language: { code: state.code } }, (key, fallback) => translation || fallback] } }))
it('keeps one translator callback while reading the latest language and API dictionary', () => {
  const view = renderHook(() => useStoreOnboardingLanguage())
  const t = view.result.current[1]
  view.rerender()
  expect(view.result.current[1]).toBe(t)
  state.translation = 'API updated'
  state.code = 'es'
  view.rerender()
  expect(view.result.current[1]).toBe(t)
  expect(t('STORE_ONBOARDING_RETRY', 'Retry')).toBe('API updated')
})

it('retains shared Spanish fallback copy when the API dictionary lacks a common onboarding key', async () => {
  state.code = 'es'; state.translation = ''
  const { default: catalog } = await import('../../../../../../i18n/translations.json')
  const view = renderHook(() => useStoreOnboardingLanguage())
  expect(view.result.current[1]('CASH', 'Cash')).toBe(catalog.CASH.es)
})
