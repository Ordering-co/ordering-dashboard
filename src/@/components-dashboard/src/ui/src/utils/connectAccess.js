export const POS_SETUP_CALL_URL =
  'https://calendly.com/mauricio-ordering/meet?back=1'

export const POS_SETUP_CALL_PROVIDERS = [
  { name: 'Checkmate', logoKey: 'ItsaCheckmateLogo', aliases: ['checkmate', 'itsacheckmate'] },
  { name: 'Deliverect', logoKey: 'deliverect', aliases: ['deliverect'] }
]

export const CONNECT_BUSINESS_OWNER_PAGES = ['pos_menu']

export const getConnectAllowedLevels = (pageName) =>
  CONNECT_BUSINESS_OWNER_PAGES.includes(pageName) ? [0, 2] : [0]

export const isCalendlyUrl = (url, root = '') => {
  if (!url) return false
  try {
    const protocolRelative = typeof url === 'string' && url.startsWith('//')
    const candidate = protocolRelative ? `https:${url}` : url
    const { hostname } = new URL(candidate, /^https?:\/\//i.test(candidate) ? undefined : root || undefined)
    const host = hostname.toLowerCase().replace(/\.$/, '')
    return host === 'calendly.com' || host.endsWith('.calendly.com')
  } catch {
    return false
  }
}

/**
 * A plugin page that is a sales call (a Calendly link) only opens for admins
 * (level 0). Sales channels have no such page, so the rule does not apply
 * to them.
 * @param {object|null} user the session user
 * @param {string|null} url the page, absolute or relative to root
 * @param {string} root the plugin root a relative url resolves against
 * @param {boolean} fromSalesChannels whether the page is in the sales channels view
 * @returns {boolean}
 */
export const isSalesCallRestricted = (user, url, root = '', fromSalesChannels = false) =>
  !fromSalesChannels && user?.level !== 0 && isCalendlyUrl(url, root)

const normalizeIdentifier = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '')

export const isSetupCallIntegration = (integration) => {
  const identifiers = [
    integration?.plugin?.key,
    integration?.plugin_root,
    integration?.name
  ].map(normalizeIdentifier)

  return POS_SETUP_CALL_PROVIDERS.some((provider) =>
    identifiers.some((id) =>
      provider.aliases.some((alias) => id === alias || id.includes(alias))
    )
  )
}
