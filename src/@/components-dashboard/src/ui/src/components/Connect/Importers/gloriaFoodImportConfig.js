export const GLORIAFOOD_ERROR_MESSAGES = {
  IMPORTER_VALIDATION_GLORIAFOOD_RESTAURANT_KEY_REQUIRED: 'Restaurant Key is required',
  IMPORTER_VALIDATION_GLORIAFOOD_MASTER_KEY_REQUIRED: 'Master Key is required'
}

export const validateGloriaFoodForm = (form) => {
  if (!form?.res_key?.trim()) {
    return {
      valid: false,
      error: 'IMPORTER_VALIDATION_GLORIAFOOD_RESTAURANT_KEY_REQUIRED',
      errorDefault: GLORIAFOOD_ERROR_MESSAGES.IMPORTER_VALIDATION_GLORIAFOOD_RESTAURANT_KEY_REQUIRED
    }
  }
  if (!form?.mas_key?.trim()) {
    return {
      valid: false,
      error: 'IMPORTER_VALIDATION_GLORIAFOOD_MASTER_KEY_REQUIRED',
      errorDefault: GLORIAFOOD_ERROR_MESSAGES.IMPORTER_VALIDATION_GLORIAFOOD_MASTER_KEY_REQUIRED
    }
  }
  return { valid: true }
}
