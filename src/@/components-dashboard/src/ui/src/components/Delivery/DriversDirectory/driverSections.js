// redesign DL-B3 (decision 1): the sections of the driver panel and the map from main's `?tab=` keys.
// Pure: no React, no network.

// The order the SectionNav shows them in (the former drivers menu)
export const DRIVER_SECTIONS = ['profile', 'driver_group', 'saved_places', 'schedule', 'logs', 'advanced_logs', 'push_tokens']

// main's tabs that have no entry in the nav but stay reachable by `?tab=`: the panel handles them
// (`orders` mounts the orders of the driver, `metafields` opens Custom fields, `personalization` is the profile)
export const LEGACY_TABS = ['orders', 'metafields', 'personalization']

// redesign DM-B1 (decision 3): the sections of a driver manager, in the order of the former drivers menu's other menu (`isDriverMenu` false)
export const MANAGER_SECTIONS = ['profile', 'saved_places', 'driver_group']

// main, main's «Stripe Connect» tab of the driver detail, after Push tokens. Kept out of DRIVER_SECTIONS on purpose:
// the panel builds the manager's URL-only sections from that list, and this one must not be reachable by URL for anyone without the flag.
export const STRIPE_CONNECT_SECTION = 'stripe_connect'

// Advanced logs only for level 0 (the former drivers menu: `user?.level === 0`); `role: 'managers'` gives the manager's three, for every level.
// main, Stripe Connect only for a driver admin (level 0) when the panel says payouts are on (`stripeConnect`)
export const driverSectionIds = ({ level, role, stripeConnect } = {}) => (role === 'managers'
  ? [...MANAGER_SECTIONS]
  : [
      ...DRIVER_SECTIONS.filter(id => id !== 'advanced_logs' || level === 0),
      ...(level === 0 && stripeConnect === true ? [STRIPE_CONNECT_SECTION] : [])
    ])

// `?tab=` → a section id, a legacy tab or profile. A section the user's level lacks is still returned here;
// the panel falls back to profile when it is not among `driverSectionIds`.
export const sectionFromTab = (tab) => {
  if (typeof tab !== 'string') return 'profile'
  // main, `?tab=stripe_connect` is main's key; the panel falls back to profile when the user lacks the section
  if (DRIVER_SECTIONS.includes(tab) || LEGACY_TABS.includes(tab) || tab === STRIPE_CONNECT_SECTION) return tab
  return 'profile'
}
