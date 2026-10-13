import {
  DOCS_CONNECT_PURPOSES,
  getDocsConnectMode,
  getDocsConnectPurpose,
  getDocsConnectView
} from '../mode'

const nonce = '0123456789abcdef0123456789abcdef'

describe('docs-connect page mode', () => {
  it('turns on only for a valid docs_connect nonce', () => {
    expect(getDocsConnectMode(`?docs_connect=${nonce}`)).toEqual({ active: true, nonce, purpose: 'docs' })
    expect(getDocsConnectMode('').active).toBe(false)
    expect(getDocsConnectMode('?docs_connect=invalid').active).toBe(false)
    expect(getDocsConnectMode(`?docs_connect=${nonce}&docs_connect=${nonce}`).active).toBe(false)
    expect(getDocsConnectMode('?docs_connect_purpose=agent')).toEqual({ active: false, nonce: null, purpose: 'docs' })
  })

  it('reads the purpose from a whitelist and falls back to docs', () => {
    expect(DOCS_CONNECT_PURPOSES).toEqual(['docs', 'agent'])
    expect(getDocsConnectPurpose('?docs_connect_purpose=agent')).toBe('agent')
    expect(getDocsConnectPurpose('?docs_connect_purpose=docs')).toBe('docs')
    expect(getDocsConnectPurpose('')).toBe('docs')
    expect(getDocsConnectPurpose('?docs_connect_purpose=AGENT')).toBe('docs')
    expect(getDocsConnectPurpose('?docs_connect_purpose=admin')).toBe('docs')
    expect(getDocsConnectPurpose('?docs_connect_purpose=<script>')).toBe('docs')
    expect(getDocsConnectPurpose('?docs_connect_purpose=agent&docs_connect_purpose=agent')).toBe('docs')
    expect(getDocsConnectMode(`?docs_connect=${nonce}&docs_connect_purpose=agent`).purpose).toBe('agent')
  })

  it('picks the screen from boot, session, readiness and bridge state', () => {
    const base = { loaded: true, auth: true, ready: true, connected: false, expired: false }
    expect(getDocsConnectView({ ...base, loaded: false })).toBe('loading')
    expect(getDocsConnectView({ ...base, auth: false, ready: false })).toBe('sign-in')
    expect(getDocsConnectView({ ...base, ready: false })).toBe('preparing')
    expect(getDocsConnectView(base)).toBe('consent')
    expect(getDocsConnectView({ ...base, connected: true })).toBe('connected')
    expect(getDocsConnectView({ ...base, expired: true })).toBe('expired')
    expect(getDocsConnectView({ ...base, auth: false, expired: true })).toBe('expired')
    expect(getDocsConnectView({ ...base, connected: true, expired: true })).toBe('connected')
  })
})
