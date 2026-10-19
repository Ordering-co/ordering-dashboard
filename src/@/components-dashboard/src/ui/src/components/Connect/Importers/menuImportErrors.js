/**
 * Map menu-import API errors to user-facing i18n messages.
 * Server text is never returned as-is for DoorDash, Uber Eats or Ordering.co:
 * it can carry probed URLs and raw Python payloads.
 */

const ORDERING_REJECTION_MARK = "{'error': True"

const UNREACHABLE_DETAIL = /max retries exceeded|connection refused|name or service not known|client error|server error/i

const fill = (template, values) => Object.entries(values).reduce(
  (text, [key, value]) => text.split(`{{${key}}}`).join(String(value)),
  template
)

export const parseOrderingRejection = (detail) => {
  const text = String(detail || '')
  if (!text.includes(ORDERING_REJECTION_MARK)) return null
  const start = text.indexOf("'result':")
  if (start === -1) return null
  const reasons = [...text.slice(start).matchAll(/'([^']*)'/g)]
    .map((match) => match[1])
    .filter((value) => value && value !== 'result')
  if (!reasons.length) return null
  return { count: reasons.length, reason: reasons[0] }
}

const orderingRejectionMessage = (detail, t) => {
  const parsed = parseOrderingRejection(detail)
  if (!parsed) return null
  if (parsed.count === 1) {
    return fill(
      t(
        'IMPORTER_ERROR_ORDERING_REJECTED_ONE',
        'Ordering rejected 1 entry in this menu. First reason: {{reason}} Contact support; importing again will fail the same way.'
      ),
      { reason: parsed.reason }
    )
  }
  return fill(
    t(
      'IMPORTER_ERROR_ORDERING_REJECTED',
      'Ordering rejected {{count}} entries in this menu. First reason: {{reason}} Contact support; importing again will fail the same way.'
    ),
    { count: parsed.count, reason: parsed.reason }
  )
}

const mapGloriaFoodError = (detail, status, t) => {
  if (status === 403) {
    return t('IMPORTER_ERROR_GLORIAFOOD_PROVIDER_BLOCKED', 'GloriaFood blocked access to this menu. Try again later or contact support.')
  }
  if (status === 504) {
    return t('IMPORTER_ERROR_GLORIAFOOD_TIMEOUT', 'GloriaFood took too long to respond. Try again in a few minutes.')
  }
  if (status === 422) {
    if (/menu items|menu categories|empty/i.test(detail || '')) {
      return t('IMPORTER_ERROR_GLORIAFOOD_MENU_EMPTY', 'No menu items were found for this GloriaFood store.')
    }
    return t('IMPORTER_ERROR_GLORIAFOOD_INVALID_MENU', 'GloriaFood could not load a menu with this Restaurant Key.')
  }
  if (status === 400) {
    if (/restaurant key|gloriafoodRestaurantKey/i.test(detail || '')) {
      return t('IMPORTER_ERROR_GLORIAFOOD_INVALID_KEY', 'GloriaFood Restaurant Key is required. Generate it in Restaurant Admin → 3rd party integrations → Fetch Menu.')
    }
    return t('IMPORTER_ERROR_GLORIAFOOD_INVALID_KEY', 'Check your GloriaFood Restaurant Key and try again.')
  }
  if (status === 401) {
    return t('IMPORTER_ERROR_GLORIAFOOD_UNAUTHORIZED', 'GloriaFood rejected this Restaurant Key. Generate a new Fetch Menu key and try again.')
  }
  if (status === 502 || status === 503) {
    return t('IMPORTER_ERROR_GLORIAFOOD_UNAVAILABLE', 'GloriaFood is not available right now. Try again later.')
  }
  return t('IMPORTER_ERROR_GLORIAFOOD_GENERIC', 'We could not import this GloriaFood menu. Try again or contact support.')
}

const isRetryableStatus = (status) => status === 503 || status === 504

/**
 * @returns {{ message: string, retryable: boolean }}
 */
export const classifyMenuImportError = (source, detail, status, t) => {
  const text = String(detail || '')
  if (text.includes('MENU_IMPORT_RATE_LIMITED')) {
    const applied = Number((text.match(/applied=(\d+)/) || [])[1] || 0)
    const retryAfter = (text.match(/retry_after=(\d+)/) || [])[1]
    if (applied > 0 && retryAfter) {
      return {
        message: fill(
          t(
            'IMPORTER_ERROR_RATE_LIMITED_APPLIED',
            'Ordering updated {{applied}} stores, then reached its API limit. Try again in {{retry_after}} seconds.'
          ),
          { applied, retry_after: retryAfter }
        ),
        retryable: true
      }
    }
    if (retryAfter) {
      return {
        message: fill(
          t(
            'IMPORTER_ERROR_RATE_LIMITED',
            'This project reached its Ordering API limit. Try again in {{retry_after}} seconds.'
          ),
          { retry_after: retryAfter }
        ),
        retryable: true
      }
    }
    return {
      message: t(
        'IMPORTER_ERROR_RATE_LIMITED_LATER',
        'This project reached its Ordering API limit. Try again later.'
      ),
      retryable: true
    }
  }

  if (source === 'gloriafood') {
    return {
      message: mapGloriaFoodError(detail, status, t),
      retryable: isRetryableStatus(status)
    }
  }

  const rejection = orderingRejectionMessage(detail, t)
  if (rejection) {
    return { message: rejection, retryable: false }
  }

  if (status === 504 || /timed out/i.test(text)) {
    return {
      message: t(
        'IMPORTER_ERROR_TIMEOUT',
        'The importer took too long to respond. The import may still be running.'
      ),
      retryable: true
    }
  }

  if (source === 'ordering' && /ORDERING_SOURCE_UNAUTHORIZED/.test(text)) {
    return {
      message: t(
        'IMPORTER_ERROR_ORDERING_SOURCE_UNAUTHORIZED',
        'We could not find that Ordering project or store. Check the project and store, then try again.'
      ),
      retryable: false
    }
  }

  if (source === 'ordering' && status === 404) {
    return {
      message: t(
        'IMPORTER_ERROR_SOURCE_NOT_FOUND',
        'That Ordering.co store was not found. Check the project and store, then try again.'
      ),
      retryable: false
    }
  }

  if (source === 'ordering' && UNREACHABLE_DETAIL.test(text)) {
    return {
      message: t(
        'IMPORTER_ERROR_SOURCE_UNREACHABLE',
        'We could not reach that Ordering.co store URL. Check the host and try again.'
      ),
      retryable: isRetryableStatus(status)
    }
  }

  if (status === 401) {
    return {
      message: t('IMPORTER_ERROR_UNAUTHORIZED', 'Your session expired. Sign in again and retry the import.'),
      retryable: false
    }
  }
  if (status === 400) {
    return {
      message: t(
        'IMPORTER_ERROR_INVALID_INPUT',
        'We could not read a menu from that store URL. Check that the URL is right and the store is open, then try again.'
      ),
      retryable: false
    }
  }
  if (status === 422) {
    return {
      message: t(
        'IMPORTER_ERROR_MENU_EMPTY',
        'That store has no menu items to import. Check that the URL points to a store with a published menu.'
      ),
      retryable: false
    }
  }
  if (status === 503) {
    return {
      message: t('IMPORTER_ERROR_PROVIDER_UNAVAILABLE', 'The menu source is not available right now. Try again later.'),
      retryable: true
    }
  }

  return {
    message: t('IMPORTER_ERROR_GENERIC', 'Something went wrong on the importer side. Try again or contact support.'),
    retryable: false
  }
}

export const mapMenuImportError = (source, detail, status, t) =>
  classifyMenuImportError(source, detail, status, t).message
