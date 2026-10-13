import { describe, expect, it } from 'vitest'

import { buildOrderingApiHeaders } from '../../../worker/seo.js'

describe('buildOrderingApiHeaders', () => {
  it('sets Referer without the autologin token', () => {
    const headers = buildOrderingApiHeaders(
      { app_id: 'dashboard' },
      'https://dashboard.orderingplus.com',
      'https://dashboard.orderingplus.com/orders?token=jwt-secret&project=tenant'
    )

    expect(headers.referer).toBe('https://dashboard.orderingplus.com/orders?project=tenant')
    expect(headers.referer).not.toContain('jwt-secret')
    expect(headers.origin).toBe('https://dashboard.orderingplus.com')
    expect(headers['x-app-x']).toBe('dashboard')
  })
})
