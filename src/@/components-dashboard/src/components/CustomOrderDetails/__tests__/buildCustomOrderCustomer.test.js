import { describe, expect, it } from 'vitest'

import {
  buildCustomOrderCustomer,
  getCustomOrderRegisterUrl
} from '../buildCustomOrderCustomer'

describe('buildCustomOrderCustomer', () => {
  const user = {
    name: 'Ramon',
    lastname: 'Perez',
    email: 'ramon@example.com',
    cellphone: '3319423323',
    phone: '3311111111',
    country_phone_code: '52'
  }

  const address = {
    address: 'Av Reforma 100',
    address_notes: 'Ring the bell',
    zipcode: '44100',
    city: 'Guadalajara',
    country: 'Mexico',
    country_code: 'MX',
    state: 'Jalisco',
    internal_number: '4B',
    location: { lat: 20.67, lng: -103.35 }
  }

  it('includes city and equivalent payor address fields', () => {
    const customer = buildCustomOrderCustomer(user, address)

    expect(customer.city).toBe('Guadalajara')
    expect(customer.country).toBe('Mexico')
    expect(customer.country_code).toBe('MX')
    expect(customer.state).toBe('Jalisco')
    expect(customer.zipcode).toBe('44100')
    expect(customer.lastname).toBe('Perez')
    expect(customer.email).toBe('ramon@example.com')
    expect(customer.internal_number).toBe('4B')
    expect(customer.country_phone_code).toBe('52')
    expect(customer.location).toBe(JSON.stringify(address.location))
  })

  it('prefers address.city over user.city when both exist', () => {
    const customer = buildCustomOrderCustomer(
      { ...user, city: 'Monterrey' },
      address
    )

    expect(customer.city).toBe('Guadalajara')
  })

  it('falls back to user.city when the address has no city', () => {
    const customer = buildCustomOrderCustomer(user, {
      ...address,
      city: undefined
    })

    expect(customer.city).toBeUndefined()

    const fromUser = buildCustomOrderCustomer(
      { ...user, city: 'Zapopan' },
      { ...address, city: undefined }
    )
    expect(fromUser.city).toBe('Zapopan')
  })

  it('omits empty optional fields', () => {
    const customer = buildCustomOrderCustomer(
      { name: 'Ramon', cellphone: '3319423323' },
      { address: 'Av Reforma 100', location: { lat: 1, lng: 2 } }
    )

    expect(customer).not.toHaveProperty('city')
    expect(customer).not.toHaveProperty('email')
    expect(customer).not.toHaveProperty('zipcode')
    expect(customer.name).toBe('Ramon')
    expect(customer.address).toBe('Av Reforma 100')
  })
})

describe('getCustomOrderRegisterUrl', () => {
  it('posts custom orders with version v2 so city is persisted', () => {
    expect(getCustomOrderRegisterUrl('https://apiv4.ordering.co/v400/en/demo'))
      .toBe('https://apiv4.ordering.co/v400/en/demo/orders/custom?version=v2')
  })
})
