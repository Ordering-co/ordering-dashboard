import { describe, expect, it } from 'vitest'
import { buildInstallPaymentPluginRequest } from '../installPaymentPlugin'

describe('buildInstallPaymentPluginRequest', () => {
  it('posts only the catalog URL for a known key', () => {
    expect(buildInstallPaymentPluginRequest({ pluginKey: 'paystack' })).toEqual({
      method: 'POST',
      body: { url: 'https://paystack.plugins.orderingplus.com' }
    })
  })

  it('rejects unknown keys so a caller cannot send an arbitrary URL', () => {
    expect(buildInstallPaymentPluginRequest({ pluginKey: 'not-real' })).toEqual({
      error: 'UNKNOWN_PAYMENT_PLUGIN'
    })
  })

  it('ignores a caller-supplied URL and still uses the catalog', () => {
    expect(buildInstallPaymentPluginRequest({
      pluginKey: 'paystack',
      installUrl: 'https://evil.example'
    })).toEqual({
      method: 'POST',
      body: { url: 'https://paystack.plugins.orderingplus.com' }
    })
  })
})
