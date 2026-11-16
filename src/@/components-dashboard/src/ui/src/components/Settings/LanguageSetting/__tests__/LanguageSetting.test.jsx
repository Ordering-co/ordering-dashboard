import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  languages: vi.fn(),
  setLanguage: vi.fn(),
  updateLanguageListState: vi.fn(),
  showToast: vi.fn(),
  languageList: []
}))

vi.mock('../../../../../../contexts/ApiContext', () => ({
  useApi: () => [{ languages: mocks.languages }]
}))

vi.mock('../../../../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'info', Success: 'success', Error: 'error' },
  useToast: () => [{}, { showToast: mocks.showToast }]
}))

vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [
    { language: { id: 1, code: 'en' }, loading: false, languageList: mocks.languageList },
    (_key, fallback) => fallback,
    { setLanguage: mocks.setLanguage, updateLanguageListState: mocks.updateLanguageListState }
  ]
}))

vi.mock('../../../../../../index', async () => {
  const { LanguageSetting } = await import('../../../../../../components/LanguageSetting')
  const { useLanguage } = await import('../../../../../../contexts/LanguageContext')
  return { LanguageSetting, useLanguage }
})

import { LanguageSetting } from '../index'

const rowRadio = (name) => screen.getByText(name).parentElement.querySelector('.default')

describe('Settings › Languages default language', () => {
  let reload

  beforeEach(() => {
    reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    mocks.save.mockReset()
    mocks.languages.mockReset()
    mocks.setLanguage.mockReset()
    mocks.updateLanguageListState.mockReset()
    mocks.showToast.mockReset()
    mocks.save.mockImplementation(async (changes) => ({
      content: { error: false, result: { id: 2, code: 'es', name: 'Spanish', enabled: true, ...changes } }
    }))
    mocks.languages.mockImplementation(() => ({ save: mocks.save }))
    mocks.languageList = [
      { id: 1, code: 'en', name: 'English', enabled: true, default: true },
      { id: 2, code: 'es', name: 'Spanish', enabled: true, default: false },
      { id: 3, code: 'fr', name: 'French', enabled: false, default: false }
    ]
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('saves default: true once through the Settings controller, without reloading, and moves the mark', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LanguageSetting />)
    expect(rowRadio('English')).toHaveClass('checked')
    expect(rowRadio('Spanish')).not.toHaveClass('checked')

    await user.click(rowRadio('Spanish'))

    await waitFor(() => expect(rowRadio('Spanish')).toHaveClass('checked'))
    expect(mocks.languages).toHaveBeenCalledTimes(1)
    expect(mocks.languages).toHaveBeenCalledWith(2)
    expect(mocks.save).toHaveBeenCalledTimes(1)
    expect(mocks.save).toHaveBeenCalledWith({ default: true })
    expect(rowRadio('English')).not.toHaveClass('checked')
    expect(rowRadio('French')).not.toHaveClass('checked')
    expect(mocks.setLanguage).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  // review r1 #1: the default no longer follows the admin's own language, so its Status switch must lock by itself.
  it('locks the Status switch of the project default, also after the default moves', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LanguageSetting />)
    const statusSwitch = (name) => screen.getByText(name).parentElement.querySelector('.status [data-slot="switch"]')
    expect(statusSwitch('English')).toHaveAttribute('disabled')
    expect(statusSwitch('Spanish')).not.toHaveAttribute('disabled')

    await user.click(rowRadio('Spanish'))

    await waitFor(() => expect(rowRadio('Spanish')).toHaveClass('checked'))
    expect(statusSwitch('Spanish')).toHaveAttribute('disabled')
  })

  it('does not save when the language is already the default', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LanguageSetting />)

    await user.click(rowRadio('English'))

    expect(mocks.save).not.toHaveBeenCalled()
    expect(mocks.setLanguage).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('does not save when the language is disabled', async () => {
    // The disabled radio has pointer-events: none; click it anyway to prove the handler is guarded too.
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderWithProviders(<LanguageSetting />)

    await user.click(rowRadio('French'))

    expect(mocks.save).not.toHaveBeenCalled()
    expect(mocks.setLanguage).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })
  // (tanda H, R1-02): the Default mark is a real radio button, not a div with onClick
  describe('Default mark as a radio', () => {
    it('exposes one named radio per language with its checked state', () => {
      renderWithProviders(<LanguageSetting />)
      expect(screen.getAllByRole('radio')).toHaveLength(3)
      expect(screen.getByRole('radio', { name: /Default.*English/ })).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByRole('radio', { name: /Default.*Spanish/ })).toHaveAttribute('aria-checked', 'false')
      expect(screen.getByRole('radio', { name: /Default.*Spanish/ }).tagName).toBe('BUTTON')
    })

    it('is disabled for a language that is not enabled', () => {
      renderWithProviders(<LanguageSetting />)
      expect(screen.getByRole('radio', { name: /Default.*French/ })).toBeDisabled()
      expect(screen.getByRole('radio', { name: /Default.*Spanish/ })).toBeEnabled()
    })

    it('is reached with Tab and activated with Enter or Space, saving the same default', async () => {
      const user = userEvent.setup()
      renderWithProviders(<LanguageSetting />)
      const spanish = screen.getByRole('radio', { name: /Default.*Spanish/ })
      for (let i = 0; i < 10 && document.activeElement !== spanish; i++) await user.tab()
      expect(spanish).toHaveFocus()

      await user.keyboard('{Enter}')

      await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
      expect(mocks.save).toHaveBeenCalledWith({ default: true })
      await waitFor(() => expect(screen.getByRole('radio', { name: /Default.*Spanish/ })).toHaveAttribute('aria-checked', 'true'))
    })

    it('does not save from the keyboard on the current default', async () => {
      const user = userEvent.setup()
      renderWithProviders(<LanguageSetting />)
      screen.getByRole('radio', { name: /Default.*English/ }).focus()
      await user.keyboard(' ')
      expect(mocks.save).not.toHaveBeenCalled()
    })
  })
})

// a failed PUT /languages/:id used to leave the switch in its new state and say nothing.
describe('Settings › Languages status switch when the save fails', () => {
  const statusInput = (name) => screen.getByText(name).parentElement.querySelector('.status input[type="checkbox"]')

  beforeEach(() => {
    mocks.save.mockReset()
    mocks.languages.mockReset()
    mocks.showToast.mockReset()
    mocks.updateLanguageListState.mockReset()
    mocks.languages.mockImplementation(() => ({ save: mocks.save }))
    mocks.languageList = [
      { id: 1, code: 'en', name: 'English', enabled: true, default: true },
      { id: 2, code: 'es', name: 'Spanish', enabled: true, default: false },
      { id: 3, code: 'fr', name: 'French', enabled: false, default: false }
    ]
  })

  it('shows the API message as an error toast and puts the switch back when the API refuses', async () => {
    mocks.save.mockResolvedValue({ content: { error: true, result: ['Language cannot be disabled'] } })
    const user = userEvent.setup()
    renderWithProviders(<LanguageSetting />)
    expect(statusInput('Spanish')).toBeChecked()

    await user.click(statusInput('Spanish'))

    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('error', 'Language cannot be disabled'))
    expect(mocks.save).toHaveBeenCalledWith({ enabled: false })
    await waitFor(() => expect(statusInput('Spanish')).toBeChecked())
    expect(mocks.updateLanguageListState).not.toHaveBeenCalled()
  })

  it('shows a generic error toast and puts the switch back when the request fails', async () => {
    mocks.save.mockRejectedValue(new Error('Failed to fetch'))
    const user = userEvent.setup()
    renderWithProviders(<LanguageSetting />)
    expect(statusInput('French')).not.toBeChecked()

    await user.click(statusInput('French'))

    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('error', "We couldn't save the language change. Try again."))
    await waitFor(() => expect(statusInput('French')).not.toBeChecked())
  })

  it('keeps the new state and the success toast when the save works', async () => {
    mocks.save.mockImplementation(async (changes) => ({
      content: { error: false, result: { id: 2, code: 'es', name: 'Spanish', default: false, ...changes } }
    }))
    const user = userEvent.setup()
    renderWithProviders(<LanguageSetting />)

    await user.click(statusInput('Spanish'))

    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('success', 'Language change saved'))
    expect(statusInput('Spanish')).not.toBeChecked()
    expect(mocks.showToast).not.toHaveBeenCalledWith('error', expect.anything())
  })
})

// the Status column had no label a screen reader could tie to its switches.
describe('Settings › Languages status column label', () => {
  it('keeps the visible Status header and names each switch group after its language', () => {
    mocks.languageList = [
      { id: 1, code: 'en', name: 'English', enabled: true, default: true },
      { id: 2, code: 'es', name: 'Spanish', enabled: true, default: false }
    ]
    renderWithProviders(<LanguageSetting />)

    expect(screen.getByText('Status')).toBeVisible()
    expect(screen.getByRole('group', { name: 'Status: Spanish' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Status: English' })).toBeInTheDocument()
  })
})
