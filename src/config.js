import baseSettings from './config.json'

const runtimeOverride =
  typeof window !== 'undefined' &&
  window.__CONFIG__ &&
  typeof window.__CONFIG__ === 'object' &&
  !Array.isArray(window.__CONFIG__)
    ? window.__CONFIG__
    : {}

/**
 * Merged dashboard config: `config.json` + Worker-injected `window.__CONFIG__` (explicit `api`/`socket`).
 * `ai_api` (the Dashboard assistant's backend) comes only from `config.json`: `window.__CONFIG__` holds
 * project configs and cannot point the assistant elsewhere.
 */
const settings = {
  ...baseSettings,
  ...runtimeOverride,
  api: {
    ...(baseSettings.api || {}),
    ...(runtimeOverride.api || {})
  },
  socket: {
    ...(baseSettings.socket || {}),
    ...(runtimeOverride.socket || {})
  },
  ai_api: baseSettings.ai_api || null
}

export default settings
