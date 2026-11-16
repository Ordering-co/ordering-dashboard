import translations from '../../../i18n/translations.json'

export const t = (key, fallback) => {
  const locale = new URLSearchParams(window.location.search).get('locale')
  return translations[key]?.[locale] || fallback || key
}

export const parsePrice = value => {
  const number = Number(value)
  return Number.isNaN(number) ? `[USD NaN:${String(value)}]` : `[USD ${number.toFixed(2)}]`
}

export const parseNumber = value => `[N ${Number(value).toFixed(2)}]`
