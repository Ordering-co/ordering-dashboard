export const getLocale = (code, locales) => {
  let locale = locales?.[code]
  if (code === 'es-419-1' || code === 'es-419-2') locale = locales?.es
  if (code === 'zh-CN') locale = locales?.zhCN
  if (code === 'ar') locale = locales?.arSA
  if (code === 'kn') locale = locales?.ta
  if (code === 'km') locale = locales?.th
  if (!locale) return locales?.enUS
  return locale
}
