import { describe, expect, it } from 'vitest'
import { isContactUsSalesChannel, isSalesCallRestricted, isSetupCallIntegration } from '../connectAccess'

describe('isSalesCallRestricted', () => {
  const booking = 'https://calendly.com/pos/meet'

  it.each([2, 3, undefined])('restricts a sales call for user level %s', (level) => {
    expect(isSalesCallRestricted({ level }, booking)).toBe(true)
  })

  it('lets an admin open a sales call', () => {
    expect(isSalesCallRestricted({ level: 0 }, booking)).toBe(false)
  })

  it('restricts a relative page whose plugin root is Calendly', () => {
    expect(isSalesCallRestricted({ level: 2 }, '/pos/meet', 'https://calendly.com')).toBe(true)
  })

  it('never restricts a page that is not a sales call', () => {
    expect(isSalesCallRestricted({ level: 2 }, '/views/setup', 'https://square.test')).toBe(false)
    expect(isSalesCallRestricted({ level: 2 }, null, 'https://calendly.com')).toBe(false)
  })

  it('does not apply to sales channels', () => {
    expect(isSalesCallRestricted({ level: 2 }, booking, '', true)).toBe(false)
  })
})

describe('isContactUsSalesChannel', () => {
  it.each([
    [{ name: 'Rappi', plugin: { key: 'rappi_integration' } }],
    [{ name: 'Uber Eats', plugin_root: 'https://uber-eats.plugins.example.com' }],
    [{ name: 'uber_eats' }],
    [{ name: 'Channel', plugin: { key: 'uber_eats_integration' } }]
  ])('is true for %o', (integration) => {
    expect(isContactUsSalesChannel(integration)).toBe(true)
  })

  it.each([
    [{ name: 'DoorDash', plugin: { key: 'doordash_integration' } }],
    [{ name: 'Uber Direct', plugin: { key: 'uber_direct' } }],
    [{ name: 'Test Sales channel Integration' }],
    [null]
  ])('is false for %o', (integration) => {
    expect(isContactUsSalesChannel(integration)).toBe(false)
  })

  it('leaves the setup-call providers as they were', () => {
    expect(isSetupCallIntegration({ name: 'Deliverect' })).toBe(true)
    expect(isSetupCallIntegration({ name: 'Rappi' })).toBe(false)
  })
})
