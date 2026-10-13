export const validWebsiteTarget = target => target && typeof target === 'object' && !Array.isArray(target) && ['siteId', 'themeId'].every(key => typeof target[key] === 'number' && Number.isInteger(target[key]) && target[key] > 0)
export const validWebsiteColor = value => typeof value === 'string' && /^#[a-f0-9]{6}$/i.test(value)
export const normalizeWebsiteColor = value => {
  if (validWebsiteColor(value)) return value
  if (typeof value === 'string' && /^#[a-f0-9]{3}$/i.test(value)) return '#' + value.slice(1).split('').map(letter => letter + letter).join('')
  return null
}
const object = value => value && typeof value === 'object' && !Array.isArray(value)
export const readWebsiteValues = value => {
  const values = typeof value === 'string' ? JSON.parse(value) : value
  if (!object(values)) throw new Error('invalid_website_theme')
  return values
}
export const websitePrimaryColor = values => normalizeWebsiteColor(readWebsiteValues(values)?.my_products?.components?.theme_settings?.components?.style?.primary_btn_color)
export const websiteColorValues = (raw, color) => {
  if (!validWebsiteColor(color)) throw new Error('invalid_website_color')
  const values = readWebsiteValues(raw)
  const product = values.my_products ?? {}
  const components = product.components ?? {}
  const settings = components.theme_settings ?? {}
  const settingsComponents = settings.components ?? {}
  const style = settingsComponents.style ?? {}
  if (![product, components, settings, settingsComponents, style].every(object)) throw new Error('invalid_website_theme')
  return { ...values, my_products: { ...product, components: { ...components, theme_settings: { ...settings, components: { ...settingsComponents, style: { ...style, primary_btn_color: color } } } } } }
}
export const websiteColorContrast = color => {
  const channels = color.slice(1).match(/.{2}/g).map(channel => parseInt(channel, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  return luminance > 0.179 ? '#000000' : '#FFFFFF'
}
