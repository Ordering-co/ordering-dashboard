import { describe, expect, it } from 'vitest'

import { isMawejaProject } from './isMawejaProject'

describe('isMawejaProject', () => {
  it('accepts the maweja project code', () => {
    expect(isMawejaProject('maweja')).toBe(true)
    expect(isMawejaProject(' Maweja ')).toBe(true)
  })

  it('rejects any other configured project', () => {
    expect(isMawejaProject('orderingplus')).toBe(false)
    expect(isMawejaProject('maweja-demo')).toBe(false)
    expect(isMawejaProject('')).toBe(false)
    expect(isMawejaProject(null)).toBe(false)
    expect(isMawejaProject(undefined)).toBe(false)
  })
})
