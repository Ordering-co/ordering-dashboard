export const getMenuImportApiUrl = () =>
  (import.meta.env.VITE_MENU_IMPORT_API_URL || '').trim().replace(/\/$/, '')

export const getMenuImportUseFixture = () =>
  import.meta.env.VITE_MENU_IMPORT_USE_FIXTURE === 'true'
