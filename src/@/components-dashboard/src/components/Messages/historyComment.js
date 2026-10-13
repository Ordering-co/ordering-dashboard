export const escapeHtml = (value) => {
  if (value == null) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const getSafeHttpHref = (value) => {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.href
  } catch {
    return null
  }
}

const formatHistoryHtmlValue = (value) => {
  const href = getSafeHttpHref(value)
  if (href) {
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(value)}</a>`
  }
  return escapeHtml(value)
}

const formatDriverName = (driver) => {
  if (!driver) return ''
  return escapeHtml([driver.name, driver.lastname].filter(Boolean).join(' '))
}

const getLogisticTagStatus = (status, t) => {
  switch (status) {
    case 0:
      return t('PENDING', 'Pending')
    case 1:
      return t('IN_PROGRESS', 'In Progress')
    case 2:
      return t('IN_QUEUE', 'In Queue')
    case 3:
      return t('EXPIRED', 'Logistic expired')
    case 4:
      return t('RESOLVED', 'Resolved')
    default:
      return status
  }
}

const getVehicleSummary = (vehicle) => {
  return vehicle?.type + ' ' + vehicle?.model + ' ' + vehicle?.car_registration + ' ' + vehicle?.color
}

const getAuthor = (message, t) => {
  if (message?.author_id) {
    return formatDriverName(message.author)
  }
  return escapeHtml(t('AUTHOR_SYSTEM', 'System'))
}

const getStaticMapByLocation = (location, size, googleMapsApiKey) => {
  const lat = Number(location?.lat)
  const lng = Number(location?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return ''
  const mapSize = size || '250x100'
  return 'https://maps.googleapis.com/maps/api/staticmap?center=' +
    encodeURIComponent(lat) + ',' + encodeURIComponent(lng) +
    '&zoom=14&size=' + encodeURIComponent(mapSize) +
    '&markers=color:red%7C' + encodeURIComponent(lat) + ',' + encodeURIComponent(lng) +
    '&key=' + encodeURIComponent(googleMapsApiKey || '')
}

const attributeLabel = (changeAttribute, t) => {
  return escapeHtml(t(changeAttribute.toUpperCase(), changeAttribute.replace(/_/g, ' ')).toLowerCase())
}

export const getHistoryComment = ({
  message,
  userLevel,
  t,
  getOrderState,
  parsePrice,
  googleMapsApiKey,
  capitalize
}) => {
  let comment = ''
  const changeAttribute = message?.change?.attribute
  if (changeAttribute === 'distance') {
    comment = t('THE_DRIVER_IS_CLOSE', 'The driver is close') + ' <b>(' + formatDriverName(message.driver) + ')</b>'
  } else if (changeAttribute === 'status') {
    const fromState = escapeHtml(getOrderState(message.change.old * 1))
    const toState = escapeHtml(getOrderState(message.change.new * 1))
    const statusLabel = escapeHtml(t(changeAttribute.toUpperCase()).toLowerCase())
    if (message.change.new === 8 && message.change.estimated) {
      const estimatedDelivery = escapeHtml(message.change.estimated)
      comment = t('ORDER_ATTRIBUTE_CHANGED_FROM_TO', 'Order _attribute_ changed from _from_ to _to_.')
        .replace('_attribute_', '<b>' + statusLabel + '</b>')
        .replace('_from_', '<b>' + fromState + '</b>')
        .replace('_to_', '<b>' + toState + '</b>') + '<br>' + t('ESTIMATED_DELIVERY_TIME', 'Estimated delivery time is _min_ min(s).')
        .replace('_min_', estimatedDelivery)
    } else if (message.change.new === 7 && message.change.estimated) {
      const estimatedPreparation = escapeHtml(message.change.estimated)
      comment = t('ORDER_ATTRIBUTE_CHANGED_FROM_TO', 'Order _attribute_ changed from _from_ to _to_.')
        .replace('_attribute_', '<b>' + statusLabel + '</b>')
        .replace('_from_', '<b>' + fromState + '</b>')
        .replace('_to_', '<b>' + toState + '</b>') + '<br>' + t('ESTIMATED_PREPARATION_TIME', 'The estimated preparation time is _min_ min(s).')
        .replace('_min_', estimatedPreparation)
    } else {
      comment = t('ORDER_ATTRIBUTE_CHANGED_FROM_TO', 'Order _attribute_ changed from _from_ to _to_.')
        .replace('_attribute_', '<b>' + statusLabel + '</b>')
        .replace('_from_', '<b>' + fromState + '</b>')
        .replace('_to_', '<b>' + toState + '</b>')
    }
    if (message?.change?.comment) {
      comment += '<br>' + '<b>' + escapeHtml(t('COMMENT', '')) + '</b>: ' + escapeHtml(message.change.comment) + '.'
    }
  } else if (changeAttribute === 'driver_id') {
    if (message.driver) {
      comment = t('DRIVER_ASSIGNED_AS_DRIVER', '_driver_ was assigned as driver.')
        .replace('_driver_', '<b>' + formatDriverName(message.driver) + '</b>')
    } else {
      comment = t('DRIVER_UNASSIGNED', 'The driver was unnasigned')
    }
  } else if (['prepared_in', 'delivered_in', 'delivery_datetime'].includes(changeAttribute)) {
    comment = t('ORDER_ATTRIBUTE_CHANGED_FROM_TO', 'Order _attribute_ changed from _from_ to _to_.')
      .replace('_attribute_', '<b>' + attributeLabel(changeAttribute, t) + '</b>')
      .replace('_from_', '<b>' + escapeHtml(message.change.old || 0) + '</b>')
      .replace('_to_', '<b>' + escapeHtml(message.change.new) + '</b>')
  } else if (changeAttribute === 'logistic_status') {
    comment = t('ORDER_ATTRIBUTE_CHANGED_FROM_TO', 'Order _attribute_ changed from _from_ to _to_.')
      .replace('_attribute_', '<b>' + escapeHtml(t('LOGISTIC_STATUS', 'logistic status')) + '</b>')
      .replace('_from_', '<b>' + escapeHtml(getLogisticTagStatus(parseInt(message.change.old, 10), t)) + '</b>')
      .replace('_to_', '<b>' + escapeHtml(getLogisticTagStatus(parseInt(message.change.new, 10), t)) + '</b>')
  } else if (changeAttribute === 'vehicle') {
    comment = t('ORDER_ATTRIBUTE_CHANGED_FROM_TO', 'Order _attribute_ changed from _from_ to _to_.')
      .replace('_attribute_', '<b>' + attributeLabel(changeAttribute, t) + '</b>')
      .replace('_from_', '<b>' + escapeHtml(getVehicleSummary(message.change.old)) + '</b>')
      .replace('_to_', '<b>' + escapeHtml(getVehicleSummary(message.change.new)) + '</b>')
  } else if (changeAttribute === 'reject_reason') {
    comment = t('ORDER_REJECT_REASON_IS', 'Order <b>reject reason</b> is _reject_reason_.')
      .replace('_reject_reason_', '<b>' + escapeHtml(t(`REJECT_REASON_${message.change.new.toUpperCase()}`, capitalize(('REJECT_REASON_' + message.change.new).toLowerCase().replace(/_/g, ' ')))) + '</b>')
  } else if (changeAttribute === 'summary.refunded') {
    comment = t('REFUNDED', 'Refunded') + '<strong>' + escapeHtml(parsePrice(message.change?.new)) + '</strong>'
  } else if (changeAttribute !== 'comment' && changeAttribute) {
    const oldLink = formatHistoryHtmlValue(message.change.old)
    const newLink = formatHistoryHtmlValue(message.change.new)
    if (message.change.old) {
      comment = t('ORDER_ATTRIBUTE_CHANGED_FROM_TO', 'Order _attribute_ changed from _from_ to _to_.')
        .replace('_attribute_', '<b>' + attributeLabel(changeAttribute, t) + '</b>')
        .replace('_from_', '<b>' + oldLink + '</b>')
        .replace('_to_', '<b>' + newLink + '</b>')
    } else {
      comment = t('ORDER_ATTRIBUTE_CHANGED_TO', 'Order _attribute_ changed to _to_.')
        .replace('_attribute_', '<b>' + escapeHtml(t(changeAttribute.toUpperCase()).toLowerCase()) + '</b>')
        .replace('_to_', '<b>' + newLink + '</b>')
    }
  }
  if (['status', 'reject_reason', 'driver_id'].includes(changeAttribute)) {
    if (userLevel === 0 || userLevel === 2) {
      comment += '<br>-'
      if (message.app_id) comment += '<br><strong>' + escapeHtml(t('APP_ID', 'App ID')) + ':</strong> ' + escapeHtml(message.app_id)
      comment += '<br><strong>' + escapeHtml(t('AUTHOR', 'Author')) + ':</strong> ' + getAuthor(message, t)
      if (message.user_agent) comment += '<br><strong>' + escapeHtml(t('USER_AGENT', 'User agent')) + ':</strong> ' + escapeHtml(message.user_agent)
      const mapUrl = message.location ? getStaticMapByLocation(message.location, '250x100', googleMapsApiKey) : ''
      if (mapUrl) comment += '<br><strong>' + escapeHtml(t('LOCATION', 'Location')) + ':</strong> <img src="' + escapeHtml(mapUrl) + '" />'
      comment += '<br><strong>' + escapeHtml(t('IP', 'IP')) + ':</strong> ' + escapeHtml(message.ip)
    }
  }
  return comment
}
