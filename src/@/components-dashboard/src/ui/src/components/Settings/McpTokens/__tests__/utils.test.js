import { describe, expect, it } from 'vitest'
import {
  buildClaudeCodeCommand,
  buildClaudeCodeJson,
  buildCodexCommand,
  buildCodexToml,
  clampMcpExpirationDays,
  formatMcpRelative,
  getMcpExpirationOptions,
  getMcpTokenStatus,
  isMcpTokenExpiringSoon
} from '../utils'

const URL = 'https://api.ordering.co/mcp/demo'
const NOW = Date.UTC(2026, 8, 29, 12, 0, 0)

describe('getMcpTokenStatus', () => {
  it('is revoked when revoked_at is set, even if it has not expired', () => {
    expect(getMcpTokenStatus({ revoked_at: '2026-09-28 10:00:00', expires_at: '2026-12-01 00:00:00' }, NOW)).toBe('revoked')
  })

  it('is expired when expires_at (UTC) is in the past', () => {
    expect(getMcpTokenStatus({ revoked_at: null, expires_at: '2026-09-29 11:59:59' }, NOW)).toBe('expired')
  })

  it('is active otherwise', () => {
    expect(getMcpTokenStatus({ revoked_at: null, expires_at: '2026-09-29 12:00:01' }, NOW)).toBe('active')
  })
})

describe('expiration', () => {
  it('offers the presets under the max and adds a default that is not a preset', () => {
    expect(getMcpExpirationOptions({ defaultDays: 7, maxDays: 365 })).toEqual([7, 30, 90, 365])
    expect(getMcpExpirationOptions({ defaultDays: 14, maxDays: 60 })).toEqual([7, 14, 30])
  })

  it('accepts whole days between 1 and max only', () => {
    expect(clampMcpExpirationDays('45', 365)).toBe(45)
    expect(clampMcpExpirationDays('0', 365)).toBeNull()
    expect(clampMcpExpirationDays('366', 365)).toBeNull()
    expect(clampMcpExpirationDays('2.5', 365)).toBeNull()
    expect(clampMcpExpirationDays('', 365)).toBeNull()
  })
})

describe('client configs', () => {
  it('builds the Claude Code .mcp.json with the key read from the environment', () => {
    expect(JSON.parse(buildClaudeCodeJson(URL))).toEqual({
      mcpServers: {
        ordering: {
          type: 'http',
          url: URL,
          headers: { Authorization: 'Bearer ${ORDERING_MCP_KEY}' } // eslint-disable-line no-template-curly-in-string
        }
      }
    })
  })

  it('keeps the variable literal in the claude mcp add command', () => {
    const command = buildClaudeCodeCommand(URL)
    expect(command).toBe(`claude mcp add --transport http --scope project ordering \\\n  ${URL} \\\n  --header 'Authorization: Bearer \${ORDERING_MCP_KEY}'`)
    expect(command).toContain("--header 'Authorization: Bearer ${ORDERING_MCP_KEY}'") // eslint-disable-line no-template-curly-in-string
  })

  it('builds the Codex config with bearer_token_env_var', () => {
    expect(buildCodexToml(URL)).toBe(`[mcp_servers.ordering]\nurl = "${URL}"\nbearer_token_env_var = "ORDERING_MCP_KEY"`)
    expect(buildCodexCommand(URL)).toBe(`codex mcp add ordering \\\n  --url ${URL} \\\n  --bearer-token-env-var ORDERING_MCP_KEY`)
  })
})

describe('relative dates', () => {
  it('reads like a sentence in the dashboard language', () => {
    expect(formatMcpRelative('2026-10-06 12:00:00', { now: NOW })).toBe('in 7 days')
    expect(formatMcpRelative('2026-09-29 11:55:00', { now: NOW })).toBe('5 minutes ago')
    expect(formatMcpRelative('2026-09-29 11:59:40', { now: NOW })).toBe('this minute')
    expect(formatMcpRelative('2026-09-28 12:00:00', { now: NOW })).toBe('yesterday')
    expect(formatMcpRelative('2027-09-29 12:00:00', { now: NOW })).toBe('next year')
    expect(formatMcpRelative('2026-10-06 12:00:00', { now: NOW, locale: 'es' })).toBe('dentro de 7 días')
    expect(formatMcpRelative(null, { now: NOW })).toBeNull()
  })

  it('flags an active key that expires within 3 days', () => {
    expect(isMcpTokenExpiringSoon({ expires_at: '2026-10-01 12:00:00' }, NOW)).toBe(true)
    expect(isMcpTokenExpiringSoon({ expires_at: '2026-10-06 12:00:00' }, NOW)).toBe(false)
    expect(isMcpTokenExpiringSoon({ expires_at: '2026-10-01 12:00:00', revoked_at: '2026-09-29 10:00:00' }, NOW)).toBe(false)
  })
})
