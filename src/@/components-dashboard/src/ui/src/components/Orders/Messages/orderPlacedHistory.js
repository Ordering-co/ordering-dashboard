const capitalize = (value) => {
  if (!value) return ''
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export const getOrderPlacedViaCopy = (appId) => {
  if (appId == null || appId === '') {
    return {
      key: 'OTHER',
      fallback: 'Other'
    }
  }
  const raw = String(appId)
  return {
    key: raw.toUpperCase(),
    fallback: capitalize(raw.toLowerCase().replace(/_/g, ' '))
  }
}

export const getOrderPlacedDatetimeHtml = ({
  deliveryDatetimeUtc,
  parseUtcDate,
  parseLocalDate
}) => {
  const datetime = deliveryDatetimeUtc ? parseUtcDate() : parseLocalDate()
  return `<b>${datetime ?? ''}</b>`
}

export const buildOrderPlacedForViaHtml = ({
  template,
  deliveryDatetimeUtc,
  parseUtcDate,
  parseLocalDate,
  viaLabel
}) => {
  return template
    .replace('_for_', getOrderPlacedDatetimeHtml({
      deliveryDatetimeUtc,
      parseUtcDate,
      parseLocalDate
    }))
    .replace('_via_', `<b>${viaLabel ?? ''}</b>`)
}
