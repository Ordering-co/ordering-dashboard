import { describe, expect, it } from 'vitest'
import { buildMcpSetupPrompt, MCP_SETUP_PROMPT } from '../setupPrompt'

describe('Public MCP connection prompt', () => {
  it.each(['claude', 'codex', undefined])('ignores private inputs for %s', client => {
    const prompt = buildMcpSetupPrompt({ client, url: 'https://api.ordering.co/mcp/private-tenant', token: 'ord_mcp_SECRET' })
    expect(prompt).toBe(MCP_SETUP_PROMPT)
    expect(prompt).not.toContain('private-tenant')
    expect(prompt).not.toContain('ord_mcp_')
    expect(prompt).not.toContain('Authorization')
  })
})
