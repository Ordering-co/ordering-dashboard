/**
 * Map menu-import API errors to user-facing i18n messages.
 */
export const mapMenuImportError = (source, detail, status, t) => {
  if (source !== 'gloriafood') {
    return detail || t('IMPORTER_STATUS_ERROR', 'Import failed')
  }

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
