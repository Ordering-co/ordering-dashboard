const DRIVER_EVENTS = [
  'logistic_driver_found',
  'logistic_driver_found_group',
  'logistic_driver_not_found',
  'logistic_driver_not_found_group',
  'logistic_driver_found_in_coverage',
  'logistic_driver_found_in_coverage_group',
  'logistic_driver_found_out_coverage',
  'logistic_driver_found_out_coverage_group',
  'logistic_driver_autoaccepted',
  'logistic_driver_autoaccepted_group',
  'logistic_request_autorejected',
  'logistic_request_autorejected_group',
  'logistic_assign_request_accepted',
  'logistic_assign_request_accepted_group',
  'logistic_assign_request_rejected',
  'logistic_assign_request_rejected_group',
  'logistic_manual_driver_assignment',
  'logistic_manual_driver_unassignment',
  'logistic_driver_autoassigned_group'
]

const GENERAL_EVENTS = [
  'logistic_started',
  'logistic_finished',
  'logistic_expired',
  'logistic_resolved',
  'logistic_reset',
  'logistic_grouped',
  'logistic_cancelled',
  'logistic_not_grouped',
  'logistic_order_queued',
  'logistic_order_out_queued',
  'logistic_driver_company_not_found'
]

const escapeHtml = (value) => {
  if (value == null) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const parseLogData = (eventName, data, { t, parseDistance, getOrderState, fallbackText }) => {
  let message = t('LOG_' + eventName.toUpperCase(), fallbackText('LOG_' + eventName.toUpperCase()))
  for (let key in data) {
    let replaceBy = data[key]
    if (key === 'distance' || key === 'coverage') {
      replaceBy = parseDistance(data[key])
    } else if (key === 'with_orders') {
      replaceBy = data[key].join(', ')
      key = 'orders'
    } else if (key === 'status') {
      replaceBy = getOrderState(data[key])
    }

    message = message.replace('_' + key + '_', escapeHtml(replaceBy))
  }
  return message
}

export const parseLog = (log, { t, parseDistance, getOrderState, capitalize, fallbackText }) => {
  const logData = { ...(log.data || {}) }

  if (DRIVER_EVENTS.indexOf(log.event) !== -1 || log.driver_id) {
    if (log.driver) {
      logData.driver = log.driver.name + (log.driver.lastname ? log.driver.lastname : '')
    }
    return parseLogData(log.event, logData, { t, parseDistance, getOrderState, fallbackText })
  }
  if (log.driver_company_id || log.external_driver_id) {
    if (log.driver_company) {
      logData.driver_company = log.driver_company.name
    }
    if (log.external_driver) {
      logData.external_driver = log.external_driver.name
    }
    return parseLogData(log.event, logData, { t, parseDistance, getOrderState, fallbackText })
  }
  if (GENERAL_EVENTS.indexOf(log.event) !== -1) {
    return parseLogData(log.event, logData, { t, parseDistance, getOrderState, fallbackText })
  }
  const fallbackEventText = capitalize(log.event.toLowerCase().replace(/_/g, ' '))
  return escapeHtml(t(log.event.toUpperCase(), fallbackEventText)) + '<br />' + escapeHtml(JSON.stringify(log.data) || '')
}
