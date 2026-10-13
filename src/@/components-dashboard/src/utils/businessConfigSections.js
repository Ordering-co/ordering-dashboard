export const BUSINESS_CONFIG_SECTIONS = [
  {
    key: 'pedidosya',
    prefix: 'pedidosya_integration_',
    labelKey: 'PEDIDOSYA',
    label: 'PedidosYa'
  }
]

const byRankThenId = (a, b) => {
  const aRank = Number.isFinite(a?.rank) ? a.rank : Number.MAX_SAFE_INTEGER
  const bRank = Number.isFinite(b?.rank) ? b.rank : Number.MAX_SAFE_INTEGER
  if (aRank !== bRank) return aRank - bRank
  return (a?.id ?? 0) - (b?.id ?? 0)
}

export const getBusinessConfigSections = (configs = [], registry = BUSINESS_CONFIG_SECTIONS) => {
  const list = Array.isArray(configs) ? configs : []
  return registry
    .map(section => ({
      ...section,
      configs: list
        .filter(config => typeof config?.key === 'string' && config.key.startsWith(section.prefix))
        .sort(byRankThenId)
    }))
    .filter(section => section.configs.length > 0)
}
