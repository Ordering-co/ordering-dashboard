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

// api-core answers an install with what it created or linked from the
// plugin's config.json `models` (`provides`). Older APIs, and plugins that
// declare no models, answer without it: then the client still has to wait for
// the plugin to register its integration (waitForInstalledIntegration).
export const findProvidedIntegration = (plugin, { key } = {}) => (
  (Array.isArray(plugin?.provides) ? plugin.provides : []).find(item => (
    item?.type === 'third_party_integration' && (!key || item?.key === key)
  )) || null
)

// `install_status` says whether the plugin finished its own after install;
// only `failed` stops it from being used (null is a plugin installed before
// the column, or one whose queued after install nobody reads yet).
export const isPluginInstallFailed = (plugin) => plugin?.install_status === 'failed'

// `installing` while the plugin's queued after install has not answered.
// api-core turns it into `failed` after 5 minutes, so it never stays forever.
export const isPluginInstalling = (plugin) => plugin?.install_status === 'installing'

export const normalizePluginRoot = (root) => (
  typeof root === 'string' ? root.trim().replace(/\/+$/, '').toLowerCase() : ''
)

// A row offering "Install" whose plugin is in fact already installed: its
// queued after install has not registered the integration yet, or failed
// before it did. The row keeps that plugin as `pending_plugin`, so it shows
// the install state instead of "Install", which would fail on the plugin key
// (also after a page reload).
export const attachPendingPluginInstalls = (integrations, plugins) => {
  const byRoot = new Map(
    (Array.isArray(plugins) ? plugins : [])
      .filter(plugin => plugin?.root)
      .map(plugin => [normalizePluginRoot(plugin.root), plugin])
  )
  return (Array.isArray(integrations) ? integrations : []).map(integration => {
    if (integration?.plugin_id || !integration?.plugin_root) return integration
    const plugin = byRoot.get(normalizePluginRoot(integration.plugin_root))
    return plugin ? { ...integration, pending_plugin: plugin } : integration
  })
}

/**
 * The install state an integration row shows instead of its usual button:
 * - installing: the plugin is finishing its install ("Check again");
 * - failed: the install failed, with the plugin's reason;
 * - null: nothing to show, the row behaves as usual.
 * A plugin installed but not linked to the integration yet counts as
 * installing whatever its status says.
 * @param {object|null} integration row of the integrations list
 * @returns {{ state: 'installing'|'failed', plugin: object, message: string|null }|null}
 */
export const getPluginInstallState = (integration) => {
  const plugin = integration?.plugin_id ? integration?.plugin : integration?.pending_plugin
  if (!plugin) return null
  const message = typeof plugin.install_message === 'string' && plugin.install_message.trim()
    ? plugin.install_message.trim()
    : null
  if (isPluginInstallFailed(plugin)) return { state: 'failed', plugin, message }
  if (isPluginInstalling(plugin) || !integration?.plugin_id) return { state: 'installing', plugin, message: null }
  return null
}

/**
 * Reads the plugin until it stops installing or the attempts run out (15
 * seconds by default). Returns the last plugin read, or the one given when a
 * read fails.
 */
export const waitForPluginInstall = async (loadPlugin, plugin, { attempts = 10, interval = 1500, sleep = wait } = {}) => {
  let current = plugin
  for (let attempt = 0; attempt < attempts && isPluginInstalling(current); attempt++) {
    await sleep(interval)
    current = (await loadPlugin(current.id)) || current
  }
  return current
}
