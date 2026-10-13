export const POS_SETUP_CALL_URL =
  'https://calendly.com/mauricio-ordering/meet?back=1'

export const POS_SETUP_CALL_PROVIDERS = [
  { name: 'Checkmate', logoKey: 'ItsaCheckmateLogo', aliases: ['checkmate', 'itsacheckmate'] },
  { name: 'Deliverect', logoKey: 'deliverect', aliases: ['deliverect'] }
]

export const CONNECT_BUSINESS_OWNER_PAGES = ['pos_menu']

export const getConnectAllowedLevels = (pageName) =>
  CONNECT_BUSINESS_OWNER_PAGES.includes(pageName) ? [0, 2] : [0]

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
