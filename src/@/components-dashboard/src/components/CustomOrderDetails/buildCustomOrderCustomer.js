const USER_FIELDS = [
  'name',
  'middle_name',
  'lastname',
  'second_lastname',
  'email',
  'cellphone',
  'phone',
  'photo',
  'country_phone_code'
]

const ADDRESS_FIELDS = [
  'address',
  'address_notes',
  'zipcode',
  'internal_number',
  'tag',
  'country',
  'country_code',
  'locality',
  'neighborhood',
  'route',
  'state',
  'state_code',
  'street_number',
  'sublocality'
]

const isPresent = (value) => value !== undefined && value !== null && value !== ''

const asCity = (value) => {
  if (typeof value === 'string' && value.trim()) return value
  if (value && typeof value.name === 'string' && value.name.trim()) return value.name
  return undefined
}

const serializeLocation = (location) => {
  if (location == null) return undefined
  if (typeof location === 'string') return location
  return JSON.stringify(location)
}

const assignIfPresent = (target, key, value) => {
  if (!isPresent(value)) return
  target[key] = value
}

export const buildCustomOrderCustomer = (user = {}, address = {}) => {
  const customer = {}

  USER_FIELDS.forEach((key) => {
    assignIfPresent(customer, key, user?.[key])
  })

  ADDRESS_FIELDS.forEach((key) => {
    assignIfPresent(customer, key, address?.[key] ?? user?.[key])
  })

  assignIfPresent(
    customer,
    'city',
    asCity(address?.city) || asCity(address?.city_name) || asCity(user?.city)
  )

  if (isPresent(address?.map_data) || isPresent(user?.map_data)) {
    customer.map_data = address?.map_data ?? user?.map_data
  }

  const location = serializeLocation(address?.location)
  if (isPresent(location)) {
    customer.location = location
  }

  return customer
}

export const getCustomOrderRegisterUrl = (root) => `${root}/orders/custom?version=v2`
