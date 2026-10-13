import moment from 'moment'

/** Environment variable the setup guide tells the user to set. */
export const MCP_ENV_VAR = 'ORDERING_MCP_KEY'

/** Name of the server in the client configs. */
export const MCP_SERVER_NAME = 'ordering'

/** Expiration presets for a new key, in days. */
export const MCP_EXPIRATION_PRESETS = [7, 30, 90, 365]

const API_DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss'

/** API dates are UTC `YYYY-MM-DD HH:mm:ss`. */
export const parseMcpDate = (value) => {
  if (!value) return null
  const date = moment.utc(value, [API_DATE_FORMAT, moment.ISO_8601])
  return date.isValid() ? date : null
}

/**
 * `revoked` when `revoked_at` is set, `expired` when `expires_at` is in the
 * past, otherwise `active`.
 */
export const getMcpTokenStatus = (token, now = Date.now()) => {
  if (!token) return null
  if (token.revoked_at) return 'revoked'
  const expiresAt = parseMcpDate(token.expires_at)
  if (expiresAt && expiresAt.valueOf() <= now) return 'expired'
  return 'active'
}

/** An active key that expires within this many days is flagged. */
export const MCP_EXPIRING_SOON_DAYS = 3

export const isMcpTokenExpiringSoon = (token, now = Date.now()) => {
  if (getMcpTokenStatus(token, now) !== 'active') return false
  const expiresAt = parseMcpDate(token.expires_at)
  return !!expiresAt && expiresAt.valueOf() - now <= MCP_EXPIRING_SOON_DAYS * 86400000
}

const DAY = 86400

/**
 * "in 6 days", "3 hours ago", "yesterday"… in the dashboard language, via
 * Intl.RelativeTimeFormat. Days up to two months, then months, then years.
 */
export const formatMcpRelative = (value, { now = Date.now(), locale = 'en' } = {}) => {
  const date = parseMcpDate(value)
  if (!date) return null
  const seconds = Math.round((date.valueOf() - now) / 1000)
  const abs = Math.abs(seconds)
  let rtf
  try {
    rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  } catch {
    rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  }
  if (abs < 60) return rtf.format(0, 'minute')
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < DAY) return rtf.format(Math.round(seconds / 3600), 'hour')
  if (abs < 60 * DAY) return rtf.format(Math.round(seconds / DAY), 'day')
  if (abs < 365 * DAY) return rtf.format(Math.round(seconds / (30 * DAY)), 'month')
  return rtf.format(Math.round(seconds / (365 * DAY)), 'year')
}

/** Presets that fit under the API max, plus the default when it is not one of them. */
export const getMcpExpirationOptions = ({ defaultDays = 7, maxDays = 365 } = {}) => {
  const options = MCP_EXPIRATION_PRESETS.filter(days => days <= maxDays)
  if (defaultDays && defaultDays <= maxDays && !options.includes(defaultDays)) options.push(defaultDays)
  return options.sort((a, b) => a - b)
}

/** Whole days between 1 and max, or null. */
export const clampMcpExpirationDays = (value, maxDays = 365) => {
  const days = Number(value)
  if (!Number.isInteger(days) || days < 1 || days > maxDays) return null
  return days
}

export const buildClaudeCodeJson = (url) => JSON.stringify({
  mcpServers: {
    [MCP_SERVER_NAME]: {
      type: 'http',
      url,
      headers: { Authorization: `Bearer \${${MCP_ENV_VAR}}` }
    }
  }
}, null, 2)

// Single quotes keep `${ORDERING_MCP_KEY}` literal: Claude Code expands it
// when it connects, so the key never lands in the shell history or the config.
export const buildClaudeCodeCommand = (url) =>
  `claude mcp add --transport http --scope project ${MCP_SERVER_NAME} \\\n  ${url} \\\n  --header 'Authorization: Bearer \${${MCP_ENV_VAR}}'`

export const buildCodexToml = (url) =>
  `[mcp_servers.${MCP_SERVER_NAME}]\nurl = "${url}"\nbearer_token_env_var = "${MCP_ENV_VAR}"`

export const buildCodexCommand = (url) =>
  `codex mcp add ${MCP_SERVER_NAME} \\\n  --url ${url} \\\n  --bearer-token-env-var ${MCP_ENV_VAR}`

export const buildEnvExport = () => `export ${MCP_ENV_VAR}="ord_mcp_…"`
