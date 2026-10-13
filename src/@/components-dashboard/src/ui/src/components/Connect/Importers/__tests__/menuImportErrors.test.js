import { describe, expect, it } from 'vitest'
import { mapMenuImportError } from '../menuImportErrors'

describe('mapMenuImportError', () => {
  const t = (_key, fallback) => fallback

  it('returns detail for non-gloriafood sources', () => {
    expect(mapMenuImportError('doordash', 'Bad request', 400, t)).toBe('Bad request')
  })

  it('maps GloriaFood status codes to friendly messages', () => {
    expect(mapMenuImportError('gloriafood', 'blocked', 403, t)).toContain('GloriaFood blocked access')
    expect(mapMenuImportError('gloriafood', 'timeout', 504, t)).toContain('too long')
    expect(mapMenuImportError('gloriafood', 'Restaurant Key is required', 400, t)).toContain('Restaurant Key')
    expect(mapMenuImportError('gloriafood', 'rejected', 401, t)).toContain('rejected')
  })
})
