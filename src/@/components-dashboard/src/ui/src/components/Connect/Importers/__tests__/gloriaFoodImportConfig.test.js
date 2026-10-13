import { describe, expect, it } from 'vitest'
import { validateGloriaFoodForm } from '../gloriaFoodImportConfig'

describe('validateGloriaFoodForm', () => {
  it('requires restaurant key', () => {
    expect(validateGloriaFoodForm({ mas_key: 'master' })).toEqual({
      valid: false,
      error: 'IMPORTER_VALIDATION_GLORIAFOOD_RESTAURANT_KEY_REQUIRED',
      errorDefault: 'Restaurant Key is required'
    })
  })

  it('requires master key', () => {
    expect(validateGloriaFoodForm({ res_key: 'restaurant' })).toEqual({
      valid: false,
      error: 'IMPORTER_VALIDATION_GLORIAFOOD_MASTER_KEY_REQUIRED',
      errorDefault: 'Master Key is required'
    })
  })

  it('accepts both keys', () => {
    expect(validateGloriaFoodForm({
      res_key: ' restaurant ',
      mas_key: ' master '
    })).toEqual({ valid: true })
  })
})
