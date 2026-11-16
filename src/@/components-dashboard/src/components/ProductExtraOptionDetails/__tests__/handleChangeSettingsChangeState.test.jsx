/* eslint-disable import/first */
// redesign bugs F row 25 (N-3): `handleChangeSettingsChangeState(change)` of the option editor merges `change` into the
// pending settings. It used to spread `setChangesState.changes` (the setter has no `.changes`), so every change replaced the last one.
import React from 'react'
import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token' }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test' }]
}))
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: vi.fn() }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { ProductExtraOptionDetails } from '../index'

let ui
const draw = () => {
  ui = null
  const UI = (uiProps) => {
    ui = uiProps
    return null
  }
  const option = { id: 9, name: 'Size', suboptions: [] }
  render(
    <ProductExtraOptionDetails
      UIComponent={UI}
      business={{ id: 3, extras: [], categories: [] }}
      extra={{ id: 4, options: [option] }}
      option={option}
      handleUpdateBusinessState={vi.fn()}
    />
  )
}

describe('ProductExtraOptionDetails controller · handleChangeSettingsChangeState', () => {
  it('keeps both keys when two different changes arrive one after the other', () => {
    draw()
    act(() => { ui.handleChangeSettingsChangeState({ external_id: 'x1' }) })
    act(() => { ui.handleChangeSettingsChangeState({ snooze_until: '2026-10-11 18:50:00' }) })
    expect(ui.settingChangeState.changes).toEqual({ external_id: 'x1', snooze_until: '2026-10-11 18:50:00' })
  })

  it('keeps both keys when two changes arrive in the same tick', () => {
    draw()
    act(() => {
      ui.handleChangeSettingsChangeState({ external_id: 'x1' })
      ui.handleChangeSettingsChangeState({ snooze_until: '2026-10-11 18:50:00' })
    })
    expect(ui.settingChangeState.changes).toEqual({ external_id: 'x1', snooze_until: '2026-10-11 18:50:00' })
  })

  it('lets a later value of the same key win and leaves loading and error alone', () => {
    draw()
    act(() => { ui.handleChangeSettingsChangeState({ external_id: 'x1' }) })
    act(() => { ui.handleChangeSettingsChangeState({ external_id: 'x2' }) })
    expect(ui.settingChangeState).toEqual({ changes: { external_id: 'x2' }, loading: false, error: null })
  })
})
