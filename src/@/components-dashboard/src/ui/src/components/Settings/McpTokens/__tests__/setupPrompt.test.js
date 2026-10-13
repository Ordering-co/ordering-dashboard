import { describe, expect, it } from 'vitest'
import { buildMcpSetupPrompt } from '../setupPrompt'

describe('MCP setup prompt safety and completion contract', () => {
  it.each(['claude', 'codex'])('requires private key entry and proof from the actual %s client', client => {
    const prompt = buildMcpSetupPrompt({ client, url: 'https://api.ordering.co/mcp/tenant-one', token: 'ord_mcp_SECRET' })
    expect(prompt).not.toContain('ord_mcp_SECRET')
    expect(prompt).toContain('NEVER ask me to paste a password or MCP key into this conversation')
    expect(prompt).toContain('local masked-input flow')
    expect(prompt).toContain('owner-only permissions')
    expect(prompt).toContain('Serialize the key safely as data, never executable shell text')
    expect(prompt).toContain('A shell profile alone does not guarantee a desktop app or IDE receives it')
    expect(prompt).toContain('Registration alone is not success')
    expect(prompt).toContain('invoke whoami')
    expect(prompt).toContain('intended account/project is confirmed')
    expect(prompt).toContain('If verification is still pending, say so instead of saying "Listo"')
    expect(prompt).toContain('Do not install software, switch tenants, delete other servers, bypass approvals or change project data')
    expect(prompt).toContain('Use read-only scope')
    expect(prompt).toContain('401/403')
    expect(prompt).toContain('when the key expires or is revoked')
  })

  it('provides separate config formats and preserves existing config and credentials', () => {
    const url = 'https://api.ordering.co/mcp/tenant-two'
    const claude = buildMcpSetupPrompt({ client: 'claude', url })
    const codex = buildMcpSetupPrompt({ client: 'codex', url })
    expect(claude).toContain('"Authorization": "Bearer ${ORDERING_MCP_KEY}"') // eslint-disable-line no-template-curly-in-string
    expect(claude).toContain('preserving every other MCP server and JSON field')
    expect(claude).toContain('local/user/project scopes')
    expect(claude).not.toContain('[mcp_servers.ordering]')
    expect(codex).toContain(`[mcp_servers.ordering]\nurl = "${url}"\nbearer_token_env_var = "ORDERING_MCP_KEY"`)
    expect(codex).toContain('respect CODEX_HOME if set')
    expect(codex).toContain('not a blind append')
    expect(codex).not.toContain('"mcpServers"')
    expect(codex).toContain('a different existing Ordering endpoint requires my choice')
  })
})
