// redesign ordering-website integration: the colors a website theme takes when it has none stored. They are data the
// editor writes into the customer's site (white label, decision 30), not styles of the dashboard, so they live here once and the
// legacy editor, SettingComponent and the sections editor read them from this module.

/** Seed of a color setting of Advanced settings that has no value yet (SettingComponent, ProductSettingList). */
export const DEFAULT_SETTING_COLOR = '#2C7BE5'

/** Background color of the website pages when the theme has none (theme_settings.components.style.background_page). */
export const DEFAULT_PAGE_BACKGROUND = '#FFFFFF'
