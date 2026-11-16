const identityConfig = [{ configs: { dashboard_title: { value: 'Identity Console' } }, loading: false }]

export const useConfig = () => identityConfig

// HelmetTags translates the page title; the fixture has no dictionary, so every key reads its English reserve.
const identityLanguage = [{ loading: false }, (key, fallback = null) => fallback ?? key]

export const useLanguage = () => identityLanguage
