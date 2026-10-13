import { expect, it } from 'vitest'
import { validWebsiteTarget, normalizeWebsiteColor, websiteColorValues, websitePrimaryColor, websiteColorContrast } from '../storeOnboardingAppearance'
it('changes only the website color leaf and preserves existing nested settings and the source snapshot', () => {
  const values = { seo: { title: 'Existing' }, general: { components: { fonts: { primary: { name: 'Custom font' } }, buttons: { borderRadius: '4px' } } }, my_products: { enabled: false, components: { website_theme: { components: { type: 'franchise' } }, theme_settings: { protected: 'keep', components: { style: { primary_btn_color: '#123456', background_page: '#eeeeee', primary_link_color: '#112233' }, values: { footer_content: 'Existing footer' } } } } } }
  const next = websiteColorValues(JSON.stringify(values), '#abcdef')
  expect(websitePrimaryColor(next)).toBe('#abcdef')
  expect(next.my_products.components.theme_settings.components.style).toEqual({ primary_btn_color: '#abcdef', background_page: '#eeeeee', primary_link_color: '#112233' })
  expect(next.my_products.components.theme_settings.components.values).toEqual({ footer_content: 'Existing footer' })
  expect(next.general).toEqual(values.general)
  expect(next.seo).toEqual(values.seo)
  expect(next.my_products.enabled).toBe(false)
  expect(websitePrimaryColor(values)).toBe('#123456')
})
it('supports short existing colors and rejects malformed themes or new colors', () => {
  expect(normalizeWebsiteColor('#abc')).toBe('#aabbcc')
  expect(normalizeWebsiteColor('red')).toBeNull()
  expect(() => websiteColorValues({ my_products: [] }, '#123456')).toThrow()
  expect(() => websiteColorValues({ my_products: false }, '#123456')).toThrow()
  expect(() => websiteColorValues({}, 'javascript:bad')).toThrow()
})
it.each(['#000000', '#ffffff', '#abcdef', '#ff9900', '#266df0'])('selects a readable preview button text color for %s', color => {
  expect(['#000000', '#FFFFFF']).toContain(websiteColorContrast(color))
})

it('accepts only an explicit numeric website/theme identity', () => {
  expect(validWebsiteTarget({ siteId: 1, themeId: 2 })).toBe(true)
  for (const siteId of [true, false, '1', null, 0, -1, NaN]) expect(validWebsiteTarget({ siteId, themeId: 2 })).toBeFalsy()
})
