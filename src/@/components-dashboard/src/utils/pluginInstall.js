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
