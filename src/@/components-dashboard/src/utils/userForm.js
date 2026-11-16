import { formatPhoneNumber } from 'react-phone-number-input'
import parsePhoneNumber from 'libphonenumber-js'
import { sortInputFields } from '../ui/src/utils'
import { toAlertContent } from './alertContent'
import { translateApiMessage } from './translateApiMessage'

// redesign UF-B1a (decision 1): the helpers the four user forms share (profile details and add form, Users and
// Delivery copies). Pure functions; `t` is always passed in. Each one reproduces what `UI/Users/UserFormDetails`,
// `UI/Users/UserAddForm` and their `UI/Delivery` copies do today.

/** `UI/Users/UserFormDetails:232`. */
export const USER_FORM_EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i

const EMAIL_FORBIDDEN_CHARACTERS = /[&,()%";:ç?<>{}\\[\]\s]/g

const PASSWORD_MIN_LENGTH = 8

const isEmpty = (value) => value === undefined || value === null || value === ''

/**
 * Lower case, and none of the characters the API refuses in an email (`UI/Users/UserFormDetails:178`).
 * @param {string} [value]
 * @returns {string}
 */
export const sanitizeEmail = (value) => value?.toLowerCase().replace(EMAIL_FORBIDDEN_CHARACTERS, '') ?? ''

/**
 * The checkout fields the form shows, in the order the forms have always used (`fieldsToSort`).
 * Never throws when the validation-fields request failed (`fields` is `{}`) or there is no state at all.
 * @param {{ fields?: { checkout?: Object } }} [validationFields]
 * @param {(code: string) => boolean} [showField] controller `showField`; when absent nothing is filtered
 * @returns {Object[]}
 */
export const checkoutFields = (validationFields, showField) => {
  const fields = sortInputFields({ values: validationFields?.fields?.checkout ?? {} })
  return typeof showField === 'function' ? fields.filter(field => showField(field.code)) : fields
}

/**
 * Text of a field. It is today's placeholder, which becomes the visible label.
 */
// redesign tanda AB (U-1): the live dictionary says «Lastname» for LASTNAME, so the last-name fields
// read their own keys; every other field still asks for its upper-case code.
const FIELD_LABEL_KEYS = {
  lastname: ['LAST_NAME', 'Last name'],
  second_lastname: ['SECOND_LAST_NAME', 'Second last name']
}

export const fieldLabel = (t, field) => {
  const [key, english] = FIELD_LABEL_KEYS[field.code] ?? [field.code.toUpperCase(), field.name]
  return t(key, english)
}

/**
 * "Field is required" message, same expressions as `UI/Users/UserFormDetails:229,294`.
 */
export const requiredMessage = (t, field) => {
  if (field.code === 'email') {
    return t('VALIDATION_ERROR_EMAIL_REQUIRED', 'The field Email is required').replace('_attribute_', t('EMAIL', 'Email'))
  }
  return t(`VALIDATION_ERROR_${field.code.toUpperCase()}_REQUIRED`, `${field.name} is required`).replace('_attribute_', t(field.name, field.code))
}

/**
 * Validates what the form shows and answers `{ [name]: message }` (an empty object when it is valid).
 * Order of the keys: checkout fields (and email where it sits in `fields`), password, cellphone.
 * @param {Object} params
 * @param {Function} params.t translator
 * @param {Object[]} params.fields checkout fields shown (see `checkoutFields`)
 * @param {Object} params.values what the form shows: the change if any, else the user's value
 * @param {(code: string) => boolean} params.isRequiredField controller `isRequiredField`
 * @param {{ value?: string, show?: boolean, required?: boolean }} [params.password] skipped when `show` is false
 * @param {{ number?: string, isValid?: boolean, enabled?: boolean, required?: boolean, hasCountryCode?: boolean }} [params.phone]
 * @param {boolean} [params.emailRequired] overrides `isRequiredField('email')` (the Delivery add form never requires it)
 * @returns {Object<string, string>}
 */
export const validateUserForm = ({ t, fields, values, isRequiredField, password, phone, emailRequired }) => {
  const errors = {}
  const current = values ?? {}
  const list = fields ?? []

  list.forEach(field => {
    if (field.code === 'email') {
      const required = emailRequired ?? isRequiredField('email')
      if (required && isEmpty(current.email)) {
        errors.email = requiredMessage(t, field)
      } else if (!isEmpty(current.email) && !USER_FORM_EMAIL_PATTERN.test(current.email)) {
        errors.email = t('INVALID_ERROR_EMAIL', 'Invalid email address').replace('_attribute_', t('EMAIL', 'Email'))
      }
      return
    }
    if (isRequiredField(field.code) && isEmpty(current[field.code])) {
      errors[field.code] = requiredMessage(t, field)
    }
  })

  if (password && password.show !== false) {
    if (password.required && isEmpty(password.value)) {
      errors.password = t('VALIDATION_ERROR_PASSWORD_REQUIRED', 'The field Password is required').replace('_attribute_', t('PASSWORD', 'Password'))
    } else if (!isEmpty(password.value) && password.value.length < PASSWORD_MIN_LENGTH) {
      errors.password = t('VALIDATION_ERROR_PASSWORD_MIN_STRING', 'The Password must be at least 8 characters.').replace('_attribute_', t('PASSWORD', 'Password')).replace('_min_', PASSWORD_MIN_LENGTH)
    }
  }

  if (phone) {
    if (!phone.number && phone.enabled && phone.required) {
      errors.cellphone = t('VALIDATION_ERROR_MOBILE_PHONE_REQUIRED', 'The field Phone Number is required.')
    } else if (phone.number && !phone.isValid) {
      errors.cellphone = phone.hasCountryCode
        ? t('INVALID_ERROR_PHONE_NUMBER', 'The Phone Number field is invalid')
        : t('INVALID_ERROR_COUNTRY_CODE_PHONE_NUMBER', 'The country code of the phone number is invalid')
    }
  }

  return errors
}

/**
 * What `handleChangePhoneNumber` builds today (`UI/Users/UserFormDetails:140-175`), in the `{ name, value }` shape
 * `handleChangeInput(changes, true)` takes. Invalid gives both empty.
 * @param {string} number phone as typed by the input (`+390612345678`)
 * @param {boolean} isValid
 * @param {{ validationPhoneNumberLib?: number|string }} [options] `configs.validation_phone_number_lib.value`; 0 keeps `formatPhoneNumber(number)` without spaces
 */
export const phoneToChanges = (number, isValid, { validationPhoneNumberLib } = {}) => {
  let parsed = null
  if (isValid) {
    parsed = parsePhoneNumber(number)
    if (!parseInt(validationPhoneNumberLib ?? 1, 10)) {
      if (parsed?.nationalNumber) parsed.nationalNumber = formatPhoneNumber(number)?.replace?.(/\s/g, '')
    }
  }
  return {
    country_phone_code: { name: 'country_phone_code', value: parsed ? parsed.countryCallingCode : '' },
    cellphone: { name: 'cellphone', value: parsed ? parsed.nationalNumber : '' }
  }
}

/**
 * The raw number to send when it starts with zero (`UI/Users/UserFormDetails:173`), or null.
 * @param {{ number?: string, countryCallingCode?: string }} [rawNumber]
 */
export const cellphoneStartZero = (rawNumber) => (
  rawNumber?.number && rawNumber?.countryCallingCode ? rawNumber.number : null
)

/**
 * The phone text the input starts with (`setUserCellPhone`, `UI/Users/UserFormDetails:80-97`): what was typed if the
 * last save failed, `+code number`, the bare number, or an empty string.
 * @param {Object} [user]
 * @param {{ result?: { error?: boolean }, changes?: Object }} [formState]
 */
export const userPhoneText = (user, formState) => {
  if (user?.cellphone) {
    if (formState?.result?.error && formState.changes?.cellphone && formState.changes?.country_phone_code) {
      return `+${formState.changes.country_phone_code} ${formState.changes.cellphone}`
    }
    if (user.country_phone_code) return `+${user.country_phone_code} ${user.cellphone}`
    return user.cellphone
  }
  return ''
}

const PHONE_KEYS = ['country_phone_code', 'cellphone']

/**
 * Labels of what changed, for the save bar: in the order the keys changed, without duplicates;
 * `country_phone_code` and `cellphone` count once, as the phone (`cellphone`).
 * @param {Object} [changes] controller `formState.changes`
 * @param {(key: string) => string} [labelOf] label for a key; the key itself when it answers nothing
 * @returns {string[]}
 */
export const changedFieldNames = (changes, labelOf) => {
  const keys = []
  Object.keys(changes ?? {}).forEach(key => {
    const name = PHONE_KEYS.includes(key) ? 'cellphone' : key
    if (!keys.includes(name)) keys.push(name)
  })
  const labels = []
  keys.forEach(key => {
    const label = labelOf?.(key) ?? key
    if (!labels.includes(label)) labels.push(label)
  })
  return labels
}

/**
 * The text of an API error for the save bar: a string stays the string, a list is joined, anything that is not text (an object,
 * a User cast from a 200 with `error: true`, an Error, an empty list) says the generic message. Never empty (M-13).
 */
export const profileApiErrorText = (t, result) => {
  const fallback = t('USER_SAVE_ERROR', 'We couldn\'t save the changes. Try again.')
  const lines = toAlertContent(result, fallback)
  const text = lines.map(line => (line === fallback ? line : translateApiMessage(t, line, fallback))).join('; ')
  return text || fallback
}
