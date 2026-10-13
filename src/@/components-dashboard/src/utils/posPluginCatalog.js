export const POS_PLUGIN_CATALOG = [
  { key: 'square_pos_integration', name: 'Square', installUrl: 'https://square-pos.plugins.orderingplus.com', logo: 'https://cdn.freebiesupply.com/logos/large/2x/square-logo-black-and-white.png' },
  { key: 'clover_integration', name: 'Clover', installUrl: 'https://clover.plugins.orderingplus.com', logo: 'https://d3vj0kew82apqn.cloudfront.net/clover-logo.png' },
  { key: 'simphony_integration', name: 'Simphony', installUrl: 'https://simphony.plugins.orderingplus.com', logo: 'https://d3vj0kew82apqn.cloudfront.net/oracle-simphony-logo.png' },
  { key: 'wansoft_integration', name: 'Wansoft', installUrl: 'https://wansoft.plugins.orderingplus.com', logo: 'https://d3vj0kew82apqn.cloudfront.net/wansoft-logo.png' }
]

export const getPosCatalogItem = (key) => POS_PLUGIN_CATALOG.find(item => item.key === key) || null

export const isCatalogIntegration = (integration) => integration?.source === 'catalog'

export const mergePosIntegrationsWithCatalog = (integrations = []) => {
  const apiRows = Array.isArray(integrations) ? integrations : []
  const presentKeys = new Set(apiRows.map(integration => integration?.key).filter(Boolean))
  const stubs = POS_PLUGIN_CATALOG
    .filter(item => !presentKeys.has(item.key))
    .map(item => ({
      id: `catalog:${item.key}`,
      key: item.key,
      name: item.name,
      logo: item.logo,
      type: 'pos',
      plugin_id: null,
      plugin: null,
      plugin_root: item.installUrl,
      source: 'catalog'
    }))
  return [...apiRows, ...stubs]
}

export const getPluginSetupPath = (plugin) => plugin?.setup_url || plugin?.links?.setup || null

export const findConnectedPosIntegration = (business, integrations) => {
  const connectedIds = new Set((business?.third_party_integrations || []).map(item => item?.third_party_integration_id))
  return (Array.isArray(integrations) ? integrations : []).find(item => item?.type === 'pos' && connectedIds.has(item?.id)) || null
}

export const findInstalledIntegration = (integrations, { key, pluginRoot } = {}) => (
  (Array.isArray(integrations) ? integrations : []).find(item => (
    item?.plugin_id && (key ? item?.key === key : item?.plugin_root === pluginRoot)
  )) || null
)

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

export const waitForInstalledIntegration = async (loadIntegrations, target, { attempts = 10, interval = 1500, sleep = wait } = {}) => {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const installed = findInstalledIntegration(await loadIntegrations(), target)
    if (installed) return installed
    if (attempt < attempts - 1) await sleep(interval)
  }
  return null
}
