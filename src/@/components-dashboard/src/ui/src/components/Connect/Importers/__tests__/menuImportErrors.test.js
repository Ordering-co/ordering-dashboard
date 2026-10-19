import { describe, expect, it } from 'vitest'
import { mapMenuImportError } from '../menuImportErrors'

const ORDERING_REJECTION_PREFIXED =
  "Failed to send menu to Ordering API: {'error': True, 'result': ['options/3: The external id may not be greater than 255 characters', 'options/4: The external id may not be greater than 255 characters']}"

const ORDERING_REJECTION_BARE =
  "{'error': True, 'result': ['options/3: The external id may not be greater than 255 characters', 'options/7: The external id may not be greater than 255 characters', 'options/8: The external id may not be greater than 255 characters']}"

describe('mapMenuImportError', () => {
  const t = (_key, fallback) => fallback

  it('maps a 400 from DoorDash to a cause plus what to do', () => {
    expect(mapMenuImportError('doordash', 'Bad request', 400, t)).toBe(
      'We could not read a menu from that store URL. Check that the URL is right and the store is open, then try again.'
    )
  })

  it('maps a timeout to a readable message', () => {
    expect(mapMenuImportError('ubereats', 'upstream timed out', 504, t)).toBe(
      'The importer took too long to respond. The import may still be running.'
    )
  })

  it('maps an Ordering rejection dict to a count and the first reason', () => {
    const message = mapMenuImportError('ubereats', ORDERING_REJECTION_PREFIXED, 502, t)
    expect(message).toContain('Ordering rejected 2 entries')
    expect(message).toContain('The external id may not be greater than 255 characters')
    expect(message).toContain('Contact support')
    expect(message).not.toContain("{'error'")
  })

  it('maps the same rejection when the email has no prefix', () => {
    const message = mapMenuImportError('ubereats', ORDERING_REJECTION_BARE, 502, t)
    expect(message).toContain('Ordering rejected 3 entries')
    expect(message).not.toContain("{'error'")
  })

  it('maps an unreachable Ordering.co host without echoing the url', () => {
    const detail =
      "HTTPSConnectionPool(host='127.0.0.1', port=22): Max retries exceeded with url: /v400/en/x (Caused by NewConnectionError: Connection refused)"
    const message = mapMenuImportError('ordering', detail, 503, t)
    expect(message).toBe(
      'We could not reach that Ordering.co store URL. Check the host and try again.'
    )
    expect(message).not.toContain('127.0.0.1')
  })

  it('maps a missing Ordering.co store without echoing the url', () => {
    const detail = '404 Client Error: Not Found for url: https://www.example.com/v400/en/x'
    const message = mapMenuImportError('ordering', detail, 404, t)
    expect(message).toBe(
      'That Ordering.co store was not found. Check the project and store, then try again.'
    )
    expect(message).not.toContain('example.com')
  })

  it('maps an unknown Ordering project without calling it a session expiry', () => {
    const message = mapMenuImportError('ordering', 'ORDERING_SOURCE_UNAUTHORIZED', 403, t)
    expect(message).toContain('could not find that Ordering project or store')
    expect(message).not.toContain('session expired')
    expect(message).not.toContain('http')
  })

  it('maps auth, empty menu and provider failures to readable messages', () => {
    expect(mapMenuImportError('doordash', 'nope', 401, t)).toBe(
      'Your session expired. Sign in again and retry the import.'
    )
    expect(mapMenuImportError('ubereats', 'empty', 422, t)).toBe(
      'That store has no menu items to import. Check that the URL points to a store with a published menu.'
    )
    expect(mapMenuImportError('doordash', 'down', 503, t)).toBe(
      'The menu source is not available right now. Try again later.'
    )
    expect(mapMenuImportError('doordash', 'weird', 418, t)).toBe(
      'Something went wrong on the importer side. Try again or contact support.'
    )
  })

  it('maps GloriaFood status codes to friendly messages', () => {
    expect(mapMenuImportError('gloriafood', 'blocked', 403, t)).toContain('GloriaFood blocked access')
    expect(mapMenuImportError('gloriafood', 'timeout', 504, t)).toContain('too long')
    expect(mapMenuImportError('gloriafood', 'Restaurant Key is required', 400, t)).toContain('Restaurant Key')
    expect(mapMenuImportError('gloriafood', 'rejected', 401, t)).toContain('rejected')
  })

  it('maps an api-core rate limit without calling it a session expiry', () => {
    const limited = mapMenuImportError(
      'doordash',
      'MENU_IMPORT_RATE_LIMITED applied=0 retry_after=90 Bearer secret-token',
      429,
      t
    )
    expect(limited).toBe(
      'This project reached its Ordering API limit. Try again in 90 seconds.'
    )
    expect(limited).not.toContain('secret-token')
    expect(limited).not.toContain('session expired')

    expect(
      mapMenuImportError(
        'ubereats',
        'MENU_IMPORT_RATE_LIMITED applied=2 retry_after=45',
        200,
        t
      )
    ).toBe(
      'Ordering updated 2 stores, then reached its API limit. Try again in 45 seconds.'
    )
  })
})
