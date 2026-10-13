import { describe, expect, it } from 'vitest'
import { getSessionCheckAction, getSessionCheckUrl } from '../sessionCheck'

const trialExpireEn = 'Your project is not active, please pay your invoice or contact the Ordering.co sales team for assistance.'
const trialExpireEs = 'Su proyecto no está activo, pague su factura o póngase en contacto con el equipo de ventas de Ordering.co para obtener ayuda.'

describe('getSessionCheckUrl', () => {
  it('asks only for the fields the session check needs', () => {
    expect(getSessionCheckUrl('https://api.test/v400/en/demo')).toBe('https://api.test/v400/en/demo/users/me?params=id,level,enabled')
  })
})

describe('getSessionCheckAction', () => {
  it.each([0, 2, 5, 8, 9])('keeps the session for a valid user of level %d', (level) => {
    expect(getSessionCheckAction({ status: 200, content: { error: false, result: { id: 1, level } } })).toBe('keep')
  })

  it.each([6, 7])('logs out a user of level %d', (level) => {
    expect(getSessionCheckAction({ status: 200, content: { error: false, result: { id: 1, level } } })).toBe('logout')
  })

  it('logs out when the token is rejected', () => {
    expect(getSessionCheckAction({ status: 401, content: { error: true, result: ['You do not have permission'] } })).toBe('logout')
  })

  it('logs out on a 401 without a readable body', () => {
    expect(getSessionCheckAction({ status: 401, content: null })).toBe('logout')
  })

  it.each([[trialExpireEn], [trialExpireEs], [[trialExpireEn]]])('sends to billing when the project is not active (%j)', (result) => {
    expect(getSessionCheckAction({ status: 401, content: { error: true, result } })).toBe('billing')
  })

  it.each([429, 500, 503])('keeps the session on a %d server error', (status) => {
    expect(getSessionCheckAction({ status, content: { error: true, result: 'Service unavailable' } })).toBe('keep')
  })

  it('keeps the session when there is no response', () => {
    expect(getSessionCheckAction()).toBe('keep')
  })
})
