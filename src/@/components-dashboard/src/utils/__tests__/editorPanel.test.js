import { describe, expect, it } from 'vitest'
import {
  EDITOR_PANEL_EXPAND_FROM,
  EDITOR_PANEL_FULL_UP_TO,
  EDITOR_PANEL_WIDE_FROM,
  getPanelSize
} from '../editorPanel'

// redesign SP-F0 (E0)
describe('editorPanel', () => {
  it('keeps the thresholds of the store editor', () => {
    expect(EDITOR_PANEL_FULL_UP_TO).toBe(500)
    expect(EDITOR_PANEL_WIDE_FROM).toBe(1000)
    expect(EDITOR_PANEL_EXPAND_FROM).toBe(576)
  })

  it.each([
    // the Overview: the base width, unless the window is too narrow or Expand is on
    [{ width: 1400, isExpand: false, sectionOpen: false, isExtendExtraOpen: false }, 'base'],
    [{ width: 501, isExpand: false, sectionOpen: false, isExtendExtraOpen: false }, 'base'],
    [{ width: 500, isExpand: false, sectionOpen: false, isExtendExtraOpen: false }, 'full'],
    [{ width: 1400, isExpand: true, sectionOpen: false, isExtendExtraOpen: false }, 'full'],
    // extending only counts with a section open
    [{ width: 1400, isExpand: false, sectionOpen: false, isExtendExtraOpen: true }, 'base'],
    // a section: wide from 1000, the whole width below
    [{ width: 1000, isExpand: false, sectionOpen: true, isExtendExtraOpen: false }, 'wide'],
    [{ width: 999, isExpand: false, sectionOpen: true, isExtendExtraOpen: false }, 'full'],
    [{ width: 500, isExpand: false, sectionOpen: true, isExtendExtraOpen: false }, 'full'],
    [{ width: 1400, isExpand: true, sectionOpen: true, isExtendExtraOpen: false }, 'full'],
    [{ width: 1400, isExpand: false, sectionOpen: true, isExtendExtraOpen: true }, 'full']
  ])('getPanelSize(%j) is %s', (state, expected) => {
    expect(getPanelSize(state)).toBe(expected)
  })
})
