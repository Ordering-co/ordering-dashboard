import { describe, expect, it } from 'vitest'
import { getRefreshFallbackPage } from '../listRefresh'

describe('getRefreshFallbackPage', () => {
  it('keeps a page that came back with rows', () => {
    expect(getRefreshFallbackPage(3, { total_pages: 3 }, 10)).toBeNull()
  })

  it('goes to the last page when the requested one is past the end', () => {
    expect(getRefreshFallbackPage(3, { total_pages: 2 }, 0)).toBe(2)
  })

  it('keeps an empty list as it is', () => {
    expect(getRefreshFallbackPage(1, { total_pages: 0 }, 0)).toBeNull()
    expect(getRefreshFallbackPage(2, null, 0)).toBeNull()
  })

  it('keeps an empty page that is still within the pages', () => {
    expect(getRefreshFallbackPage(2, { total_pages: 3 }, 0)).toBeNull()
  })
})
