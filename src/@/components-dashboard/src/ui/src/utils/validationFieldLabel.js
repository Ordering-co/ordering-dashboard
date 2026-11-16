// (U1, tanda AK): the key of a validation field is its code in capitals, except where that reads badly in the live
// catalog: LASTNAME is «Lastname» there, LAST_NAME is «Last name» (as in the user forms, `utils/userForm.js`). SECOND_LASTNAME has
// no entry, so the API name «Second lastname» showed; SECOND_LAST_NAME (batch AB) has none in the live catalog either, so these
// keys carry their own English default instead of the API name
const KEY_BY_CODE = {
  lastname: ['LAST_NAME', 'Last name'],
  second_lastname: ['SECOND_LAST_NAME', 'Second last name']
}

/** The name of a checkout, address or card validation field (`field.validation_field`), with the API name as the fallback. */
export const validationFieldLabel = (t, validationField) => {
  const code = validationField?.code
  const fallback = validationField?.name ?? ''
  if (!code) return fallback
  const [key, text] = KEY_BY_CODE[code] ?? [code.toUpperCase(), fallback]
  return t(key, text)
}
