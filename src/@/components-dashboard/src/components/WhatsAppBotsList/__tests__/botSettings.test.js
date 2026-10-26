import { describe, expect, it } from 'vitest'
import { readBotSettings, settingsPatch } from '../botSettings'

const saved = {
  branchSelectionMode: 'auto',
  primaryColor: '#c4271b',
  secondaryColor: '#ffc72c'
}

describe('settingsPatch', () => {
  it('sends only the color that changed', () => {
    expect(settingsPatch(saved, { ...saved, primaryColor: '#00aa00' })).toEqual({
      webview_primary_color: '#00aa00'
    })
  })

  it('sends null when a color is cleared and leaves the other color out', () => {
    expect(settingsPatch(saved, { ...saved, secondaryColor: '' })).toEqual({
      webview_secondary_color: null
    })
  })

  it('sends only the branch mode when that is the change', () => {
    expect(settingsPatch(saved, { ...saved, branchSelectionMode: 'marketplace' })).toEqual({
      branch_selection_mode: 'marketplace'
    })
  })

  it('sends nothing when the form matches what is saved', () => {
    expect(settingsPatch(saved, { ...saved })).toEqual({})
  })
})

describe('readBotSettings', () => {
  it('reads the three keys and treats a missing color as empty', () => {
    expect(readBotSettings({
      settings: {
        branch_selection_mode: 'marketplace',
        webview_primary_color: '#112233',
        webview_secondary_color: null
      }
    })).toEqual({
      branchSelectionMode: 'marketplace',
      primaryColor: '#112233',
      secondaryColor: ''
    })
  })

  it('uses auto when the branch mode is missing', () => {
    expect(readBotSettings({})).toEqual({
      branchSelectionMode: 'auto',
      primaryColor: '',
      secondaryColor: ''
    })
  })
})
