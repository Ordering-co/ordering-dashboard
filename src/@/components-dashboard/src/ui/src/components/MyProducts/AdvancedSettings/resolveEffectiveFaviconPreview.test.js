import { describe, expect, it } from 'vitest'

import {
  hasCustomFavicon,
  resolveEffectiveFaviconPreview
} from './resolveEffectiveFaviconPreview'

const siteLogo = 'https://cloud-assets.orderingplus.com/tenant/logo.png'
const customFavicon = 'https://cloud-assets.orderingplus.com/tenant/favicon.png'

describe('resolveEffectiveFaviconPreview', () => {
  it('uses the custom favicon when it is configured', () => {
    expect(resolveEffectiveFaviconPreview(customFavicon, siteLogo)).toBe(customFavicon)
  })

  it('falls back to the site logo when the favicon is empty', () => {
    expect(resolveEffectiveFaviconPreview('', siteLogo)).toBe(siteLogo)
    expect(resolveEffectiveFaviconPreview(null, siteLogo)).toBe(siteLogo)
  })

  it('ignores placeholder favicons and uses the site logo', () => {
    expect(resolveEffectiveFaviconPreview('/default-favicon.png', siteLogo)).toBe(siteLogo)
    expect(resolveEffectiveFaviconPreview('/favicon.png', siteLogo)).toBe(siteLogo)
  })

  it('returns empty when neither asset is configured', () => {
    expect(resolveEffectiveFaviconPreview('', '')).toBe('')
    expect(resolveEffectiveFaviconPreview('/default-favicon.png', '/default-logo.png')).toBe('')
  })
})

describe('hasCustomFavicon', () => {
  it('is false when the favicon is empty or a placeholder', () => {
    expect(hasCustomFavicon('')).toBe(false)
    expect(hasCustomFavicon(null)).toBe(false)
    expect(hasCustomFavicon('/default-favicon.png')).toBe(false)
    expect(hasCustomFavicon('/favicon.png')).toBe(false)
  })

  it('is true when a custom favicon is uploaded', () => {
    expect(hasCustomFavicon(customFavicon)).toBe(true)
  })
})
