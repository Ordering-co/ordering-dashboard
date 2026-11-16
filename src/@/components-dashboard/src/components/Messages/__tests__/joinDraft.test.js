import { describe, expect, it } from 'vitest'

import { joinDraft } from '../joinDraft'

// redesign tramo A r4 (W0-QA2-05): the draft that comes back after a failed send is joined to the new text with one space
describe('joinDraft', () => {
  it('joins with one space', () => {
    expect(joinDraft('Uno 1', 'mas')).toBe('Uno 1 mas')
  })

  it('does not double the space when the new text starts with one, or several, or a tab', () => {
    expect(joinDraft('Uno 1', ' + mas')).toBe('Uno 1 + mas')
    expect(joinDraft('Uno 1', '   + mas')).toBe('Uno 1 + mas')
    expect(joinDraft('Uno 1', '\t+ mas')).toBe('Uno 1 + mas')
  })

  it('does not double it when the sent draft ends with one', () => {
    expect(joinDraft('Uno 1 ', 'mas')).toBe('Uno 1 mas')
    expect(joinDraft('Uno 1 ', ' mas')).toBe('Uno 1 mas')
  })

  it('keeps the inside of both texts and the end of the new one', () => {
    expect(joinDraft('Uno  1', ' + mas  y ')).toBe('Uno  1 + mas  y ')
  })

  it('an empty side leaves the other as it is, and a new text of only spaces adds nothing', () => {
    expect(joinDraft('Uno', '')).toBe('Uno')
    expect(joinDraft('', ' mas')).toBe(' mas')
    expect(joinDraft('Uno', '   ')).toBe('Uno')
  })
})
