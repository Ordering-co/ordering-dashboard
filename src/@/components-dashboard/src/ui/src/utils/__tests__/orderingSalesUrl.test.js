import { describe, expect, it } from 'vitest'
import { ORDERING_SALES_URL, subdomainUrl } from '../orderingSalesUrl'

describe('subdomainUrl', () => {
  it('builds the subdomain link when the project has one', () => {
    expect(subdomainUrl('acme', '/support')).toBe('https://www.acme.com/support')
    expect(subdomainUrl(' acme ')).toBe('https://www.acme.com')
  })

  it('falls back to the Ordering.co sales page without a subdomain, never www.undefined.com', () => {
    for (const missing of [undefined, null, '', '  ', 42]) {
      expect(subdomainUrl(missing, '/support')).toBe(ORDERING_SALES_URL)
    }
    expect(ORDERING_SALES_URL).toBe('https://www.ordering.co/platform-demo-and-pricing')
  })
})
