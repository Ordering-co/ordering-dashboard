import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLanguage, useCustomer, useConfig } from '../../../../../index'
import { DatePicker, Field, PasswordField, SaveBar, Skeleton, Switch, TextField, useFieldFrame } from '../../Shared/Product'
import { PhoneField } from '../../Shared/Product/PhoneField'
import { FirstSelect } from '../../Shared/UI/FirstSelect'
import { SelectSurfaceContext } from '../../Shared/UI/selectPlacement'
import { OccupationSelector } from '../OccupationSelector'
import { ConfirmAdmin } from '../../Shared/ConfirmAdmin'
import { userTypeLabel, userTypesValues } from '../UserTypeSelector/utils'
import { useConfirmStep } from '../../../hooks/useConfirmStep'
import { timezones } from '../../../config/constants'
import { userFullName } from '../../../../../utils/userContact'
import { getDateTimeFormats } from '../../../../../utils/settingsCustomSections'
import {
  cellphoneStartZero,
  changedFieldNames,
  checkoutFields,
  fieldLabel,
  phoneToChanges,
  profileApiErrorText,
  sanitizeEmail,
  userPhoneText,
  validateUserForm
} from '../../../../../utils/userForm'
import './user-form-details.css'

export { profileApiErrorText }

// redesign UF-B2 (decisions 1 A and 2 A): the profile fields as a Product form. Groups with a heading (Details: the
// configured checkout fields, the phone, and for a professional the occupation and the birthday; Account: user type, password,
// timezone; Driver: the zone switch), a visible label on every control, the error under its field with the focus on the first,
// and the save bar of Settings (`P/SaveBar`) at the foot of the form in place of the «Update» button and the «Profile» Alert.
// The controller is untouched: the same handlers are called with the same names and values as before.

// The select is the Product anatomy (C18): trigger as wide as the field, brand rows.
const FIT_TRIGGER = { fitTrigger: true }
// How long «Saved» stays in the bar after a save that ended well.
const SAVED_NOTICE_MS = 4000
// The oldest birthday the calendar of main offered (RangeCalendar `minDate`); there is no maximum, as in main.
const BIRTHDAY_MIN = '1922-01-01'

/** The words of `P/DatePicker`, translated here: the wrapper has no text of its own. */
const pickerLabels = (t) => ({
  title: t('SELECT_DATE', 'Select a date'),
  close: t('CLOSE', 'Close'),
  today: t('TODAY', 'Today'),
  goToToday: t('DATE_RANGE_GO_TO_TODAY', 'Go to today'),
  previousMonth: t('PREVIOUS_MONTH', 'Previous month'),
  nextMonth: t('NEXT_MONTH', 'Next month'),
  invalidDate: (format) => t('DATE_RANGE_INVALID', 'Enter a real date as _format_.').replace('_format_', () => format),
  outOfRange: t('CAMPAIGNS_DATE_UNAVAILABLE', 'That date is not available.')
})

/**
 * A C18 select tied to a visible label (the trigger is a `div[role=button]`, which a `<label for>` cannot point at). Inside a `P/Field`
 * the label is the Field's; outside one, `labelId` names it.
 */
const FramedSelect = ({ label, labelId: ownLabelId, options, defaultValue, onChange, placeholder, isDisabled, search }) => {
  const frame = useFieldFrame()
  const rootRef = useRef(null)
  const labelId = ownLabelId ?? frame?.labelId
  // A click on the field's label focuses the trigger, as it does for a text field.
  useEffect(() => {
    const labelNode = labelId ? document.getElementById(labelId) : null
    if (!labelNode) return undefined
    const focusTrigger = (event) => {
      const control = rootRef.current?.querySelector('[aria-haspopup="listbox"]')
      if (!control) return
      event.preventDefault()
      control.focus()
    }
    labelNode.addEventListener('click', focusTrigger)
    return () => labelNode.removeEventListener('click', focusTrigger)
  }, [labelId])
  return (
    <span ref={rootRef} className='odc-uf-select'>
      <SelectSurfaceContext.Provider value={FIT_TRIGGER}>
        <FirstSelect
          ariaLabelledBy={labelId || undefined}
          ariaLabel={label}
          options={options}
          defaultValue={defaultValue}
          onChange={onChange}
          placeholder={placeholder}
          isDisabled={isDisabled}
          isShowSearchBar={!!search}
          searchValue={search?.value}
          handleChangeSearch={search?.onChange}
        />
      </SelectSurfaceContext.Provider>
    </span>
  )
}

export const UserFormDetailsUI = (props) => {
  const {
    formState,
    showField,
    cleanFormState,
    isRequiredField,
    validationFields,
    handleChangeInput,
    handleButtonUpdateClick,
    isCheckout,
    userData,
    isCustomerMode,
    isDriversPage,
    handleChangeSwtich,
    handleChangeUserType,
    isProfessional,
    occupations,
    handleChangeOccupation,
    setCellphoneStartZero,
    onDirtyChange,
    defaultUserTypesSelected,
    suppressApiError
  } = props

  const [languageState, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [, { setUserCustomer }] = useCustomer()
  const formRef = useRef(null)
  const baseId = useId()
  const { ask, dialog } = useConfirmStep()
  // Owner decision 24 B: the question asked before giving level 0 (password or code), with the C8 words
  const [adminLevelCopy, setAdminLevelCopy] = useState(null)

  const user = userData
  const changes = formState?.changes ?? {}
  const loadingFields = !!validationFields?.loading
  // redesign UF-B2 (M-UF10): `checkoutFields` never throws when the validation-fields request failed (`fields` is `{}`)
  const fields = checkoutFields(validationFields, showField)
  const cellphoneField = validationFields?.fields?.checkout?.cellphone
  const showPhone = cellphoneField?.enabled ?? false
  const requiredLabel = t('REQUIRED', 'Required')

  // What the form shows: the change if there is one, else what the user has (so «Discard» empties the changes and the controls follow).
  const valueOf = (code) => changes[code] ?? user?.[code] ?? ''

  const [errors, setErrors] = useState({})
  const [focusRequest, setFocusRequest] = useState(0)
  const [saved, setSaved] = useState(false)
  const [phoneText, setPhoneText] = useState(() => userPhoneText(userData, formState))
  const [phoneValid, setPhoneValid] = useState(null)
  const [timezoneSearch, setTimezoneSearch] = useState('')

  const clearError = (name) => setErrors(current => {
    if (!(name in current)) return current
    const { [name]: _gone, ...rest } = current
    return rest
  })

  const change = (name, value) => {
    handleChangeInput({ target: { name, value } })
    clearError(name)
  }

  // The phone starts as `+code number`, or what was typed if the last save failed (UserFormDetails:80-97 of main).
  useEffect(() => {
    if (user && !formState?.loading) setPhoneText(userPhoneText(user, formState))
  }, [user])

  const handleChangePhone = (number, isValid, rawNumber) => {
    setPhoneText(number)
    setCellphoneStartZero && setCellphoneStartZero(cellphoneStartZero(rawNumber))
    handleChangeInput(phoneToChanges(number, isValid, { validationPhoneNumberLib: configs?.validation_phone_number_lib?.value }), true)
    clearError('cellphone')
  }

  const timezoneOptions = useMemo(() => timezones
    .filter(timezone => timezone.toLocaleLowerCase().includes(timezoneSearch.toLocaleLowerCase()))
    .map(timezone => ({ value: timezone, content: timezone })), [timezoneSearch])

  const userTypeOptions = useMemo(
    () => userTypesValues({ t, isPrimary: true, defaultUserTypesSelected }),
    // the labels follow the language; `t` itself is a new function on every render
    [languageState, defaultUserTypesSelected]
  )

  // ---- the save bar ------------------------------------------------------------------------------------------------------------
  const labelOf = (key) => {
    const field = fields.find(item => item.code === key)
    if (field) return fieldLabel(t, field)
    const fixed = {
      cellphone: t('PHONE_NUMBER', 'Phone number'),
      password: t('PASSWORD', 'Password'),
      level: t('USER_TYPE', 'User type'),
      timezone: t('TIMEZONE', 'Timezone'),
      occupation_id: t('USER_FORM_OCCUPATION', 'Occupation'),
      birthdate: t('DATE_OF_BIRTH', 'Date of birth'),
      driver_zone_restriction: t('DRIVER_ZONE_RESTRICTION', 'Driver zone restriction'),
      photo: t('USER_FORM_PHOTO', 'Profile photo')
    }
    return fixed[key]
  }
  const names = changedFieldNames(changes, labelOf)
  const count = names.length

  const withCount = (text, n) => text.replace('_count_', String(n))
  const invalidCount = Object.keys(errors).length
  let errorText = null
  if (invalidCount > 0) {
    errorText = withCount(invalidCount === 1
      ? t('SETTINGS_FIX_FIELDS_ONE', 'Fix _count_ field to save.')
      : t('SETTINGS_FIX_FIELDS_OTHER', 'Fix _count_ fields to save.'), invalidCount)
  } else if (formState?.result?.error && !formState?.loading && !suppressApiError) {
    errorText = profileApiErrorText(t, formState.result.result)
  }

  // «Saved» for four seconds after a save that ended well.
  const wasLoading = useRef(false)
  useEffect(() => {
    if (formState?.loading) {
      wasLoading.current = true
      setSaved(false)
      return
    }
    if (!wasLoading.current) return
    wasLoading.current = false
    if (!formState?.result?.error) setSaved(true)
  }, [formState?.loading])
  useEffect(() => {
    if (!saved) return undefined
    const timer = setTimeout(() => setSaved(false), SAVED_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [saved])

  // redesign UC-B6 (auditor #16): opt-in. The page asks to hear whether the form has unsaved changes.
  const isDirty = Object.keys(changes).length > 0
  useEffect(() => {
    if (onDirtyChange) onDirtyChange(isDirty)
  }, [isDirty])

  // After a failed validation the focus goes to the first invalid control, once the errors are in the DOM.
  // redesign UF-R1 (F1): `block: 'nearest'` honors the `scroll-margin-block-end` of the controls (user-form-details.css), so the sticky
  // save bar does not sit over the field that has the focus or over its error.
  useEffect(() => {
    if (!focusRequest) return
    const invalid = formRef.current?.querySelector('[aria-invalid="true"]')
    invalid?.focus()
    invalid?.scrollIntoView?.({ block: 'nearest' })
  }, [focusRequest])

  // redesign UF-R1 (F1): the bar appears with the first unsaved change, over the field being edited; bring that field into view once.
  const hasChanges = count > 0
  const hadChanges = useRef(false)
  useEffect(() => {
    const appeared = hasChanges && !hadChanges.current
    hadChanges.current = hasChanges
    if (!appeared) return
    const active = document.activeElement
    if (active && formRef.current?.contains(active)) active.scrollIntoView?.({ block: 'nearest' })
  }, [hasChanges])

  const validate = () => validateUserForm({
    t,
    fields,
    values: Object.fromEntries(fields.map(field => [field.code, valueOf(field.code)])),
    isRequiredField,
    password: { value: changes.password, show: !isCheckout, required: !!isRequiredField('password') },
    phone: {
      number: phoneText,
      isValid: phoneValid,
      enabled: !!cellphoneField?.enabled,
      required: !!cellphoneField?.required,
      hasCountryCode: !!user?.country_phone_code
    }
  })

  // redesign UF-B2 (decision 2 A, M-UF4): the errors go under their field and the focus to the first; the «Profile» Alert is gone.
  // The save bar is inside the form, so Enter in a field and the Save button run this same validation (auditor #3).
  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!isDirty || formState?.loading) return
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setFocusRequest(current => current + 1)
      return
    }
    // redesign D-11 (owner, 2026-10-19, C8): a change of user type changes what the person can see and do, so the save
    // asks first. Cancel saves nothing and the form keeps the change; the photo upload (`handleButtonUpdateClick(null, true)`) never comes here.
    const levelChanged = changes.level !== undefined && changes.level !== null && Number(changes.level) !== Number(user?.level)
    if (levelChanged) {
      const copy = {
        title: t('USER_TYPE_CHANGE_CONFIRM_TITLE', 'Change _name_ to _type_?')
          .replace('_name_', () => userFullName(user) || user?.email || '')
          .replace('_type_', () => userTypeLabel(t, changes.level)),
        body: t('USER_TYPE_CHANGE_CONFIRM_BODY', 'What they can see and do changes as soon as you save.'),
        confirmLabel: t('USER_TYPE_CHANGE_CONFIRM', 'Change user type')
      }
      // Owner decision 24 B (2026-10-21, ): giving the highest privilege asks the password or a code, as taking it away
      // (deactivating an admin) does. ConfirmAdmin carries the same words and replaces C8, so two confirmations never stack (D-1).
      // the API checks the confirmation both ways (action `user_admin_level`), giving level 0 to someone who was not
      // an admin, or taking it from someone who was; either way the row being edited is the ConfirmAdmin target.
      if (Number(changes.level) === 0 || Number(user?.level) === 0) {
        setAdminLevelCopy(copy)
        return
      }
      const confirmed = await ask({ ...copy, tone: 'danger' })
      if (!confirmed) return
    }
    save()
  }

  const save = (confirmationToken) => {
    let phoneChanges = null
    if (user?.cellphone && !phoneText) {
      phoneChanges = { country_phone_code: '', cellphone: '' }
    }
    if (isCustomerMode) {
      setUserCustomer(formState.result.result, true)
    }
    if (confirmationToken) handleButtonUpdateClick(phoneChanges, undefined, undefined, confirmationToken)
    else handleButtonUpdateClick(phoneChanges)
  }

  // redesign UF-B2 (decision 1 A, auditor #3): Discard empties the changes through the controller; every control is controlled, so the
  // text, the selects, the switch and the date follow; the phone text is the one local state and goes back here.
  const handleDiscard = () => {
    cleanFormState && cleanFormState({ changes: {}, result: { error: false } })
    setPhoneText(userPhoneText(user, null))
    setCellphoneStartZero && setCellphoneStartZero(null)
    setErrors({})
    setTimezoneSearch('')
  }

  // ---- the form ----------------------------------------------------------------------------------------------------------------
  const detailsId = `${baseId}-details`
  const accountId = `${baseId}-account`
  const driverId = `${baseId}-driver`
  const timezoneId = `${baseId}-timezone`
  const occupationId = `${baseId}-occupation`
  const dateFormat = getDateTimeFormats(configs?.dates_general_format?.value).dateFormat
  const phoneRequiredError = errors.cellphone && !phoneText ? errors.cellphone : undefined

  return (
    <form
      ref={formRef}
      className='odc-root odc-uf-form'
      tabIndex={-1}
      noValidate
      aria-busy={loadingFields || undefined}
      onSubmit={handleSubmit}
      data-checkout={isCheckout ? '' : undefined}
    >
      {loadingFields
        ? (
          <div className='odc-uf-loading'>
            {[...Array(6)].map((_item, index) => (
              <div key={index} className='odc-uf-loading-row'>
                <Skeleton size='30%' />
                <Skeleton block='var(--od-x-control-height)' />
              </div>
            ))}
          </div>
          )
        : (
          <>
            <section className='odc-uf-group' aria-labelledby={detailsId}>
              <h3 id={detailsId} className='odc-uf-heading'>{t('DETAILS', 'Details')}</h3>
              {fields.map(field => (
                <TextField
                  key={field.id}
                  name={field.code}
                  type={field.type}
                  label={fieldLabel(t, field)}
                  value={valueOf(field.code)}
                  required={!!isRequiredField(field.code)}
                  requiredLabel={requiredLabel}
                  error={errors[field.code]}
                  autoComplete='off'
                  onChange={field.code === 'email'
                    ? (value) => change('email', sanitizeEmail(value))
                    : (value) => change(field.code, value)}
                />
              ))}
              {!!showPhone && (
                <PhoneField
                  label={t('PHONE_NUMBER', 'Phone number')}
                  countryLabel={t('USER_FORM_PHONE_COUNTRY', 'Phone number country')}
                  required={!!cellphoneField?.required}
                  requiredLabel={requiredLabel}
                  error={phoneRequiredError}
                  user={user}
                  value={phoneText}
                  setValue={handleChangePhone}
                  handleIsValid={setPhoneValid}
                  isUser
                />
              )}
              {isProfessional && occupations?.length > 0 && (
                <div className='odc-uf-occupation' role='group' aria-labelledby={occupationId}>
                  <p id={occupationId} className='odc-uf-label'>{t('USER_FORM_OCCUPATION', 'Occupation')}</p>
                  <OccupationSelector
                    occupationId={changes.occupation_id ?? user?.occupation_id}
                    occupations={occupations}
                    handleChangeOccupation={handleChangeOccupation}
                  />
                </div>
              )}
              {isProfessional && (
                // redesign UF-B2 (decision 13, auditor #13): P/DatePicker in the project's format; it hands back `YYYY-MM-DD`, the
                // string the legacy calendar sent (RangeCalendar `isSingleDate` without time), so the API gets the same value
                <Field label={t('DATE_OF_BIRTH', 'Date of birth')}>
                  <DatePicker
                    label={t('DATE_OF_BIRTH', 'Date of birth')}
                    labels={pickerLabels(t)}
                    dateFormat={dateFormat}
                    value={valueOf('birthdate') || null}
                    min={BIRTHDAY_MIN}
                    onChange={(day) => handleChangeSwtich('birthdate', day)}
                  />
                </Field>
              )}
            </section>

            <section className='odc-uf-group' aria-labelledby={accountId}>
              <h3 id={accountId} className='odc-uf-heading'>{t('USER_FORM_ACCOUNT', 'Account')}</h3>
              {!isProfessional && (
                <Field
                  label={t('USER_TYPE', 'User type')}
                  hint={user?.protected ? t('USER_PROTECTED_CANNOT_CHANGE_TYPE', "You can't change the user type of a protected account.") : undefined}
                >
                  <FramedSelect
                    label={t('USER_TYPE', 'User type')}
                    options={userTypeOptions}
                    defaultValue={changes.level ?? user?.level}
                    placeholder={t('TYPE', 'Type')}
                    isDisabled={Array.isArray(defaultUserTypesSelected) || !!user?.protected}
                    onChange={(level) => handleChangeUserType(level)}
                  />
                </Field>
              )}
              {!isCheckout && (
                // redesign UF-B2 (M-UF6): a real show/hide button (the eye was a span without role or name)
                <PasswordField
                  name='password'
                  label={t('PASSWORD', 'Password')}
                  hint={t('USER_FORM_PASSWORD_KEEP_HINT', 'Leave empty to keep the current password.')}
                  showLabel={t('SHOW_PASSWORD', 'Show password')}
                  hideLabel={t('HIDE_PASSWORD', 'Hide password')}
                  value={changes.password ?? ''}
                  required={!!isRequiredField('password')}
                  requiredLabel={requiredLabel}
                  error={errors.password}
                  autoComplete='new-password'
                  onChange={(value) => change('password', value)}
                />
              )}
              {/* Not a P/Field: this list has a search field, and the Base UI Field would take that input for its own control (and
                  rename it with this label). The frame is the Field's own markup and classes, without its context. */}
              <div className='odc-root odc-field'>
                <span id={timezoneId} className='odc-field-label'>{t('TIMEZONE', 'Timezone')}</span>
                <div className='odc-field-control'>
                  <FramedSelect
                    label={t('TIMEZONE', 'Timezone')}
                    labelId={timezoneId}
                    options={timezoneOptions}
                    defaultValue={changes.timezone ?? user?.timezone ?? ''}
                    placeholder={t('SELECT_TIMEZONE', 'Select a timezone')}
                    search={{ value: timezoneSearch, onChange: setTimezoneSearch }}
                    onChange={(zone) => {
                      setTimezoneSearch('')
                      handleChangeSwtich('timezone', zone)
                    }}
                  />
                </div>
              </div>
            </section>

            {isDriversPage && (
              // redesign UF-B2 (M-UF2): dead in this copy (no consumer passes isDriversPage), kept; its text now goes through t()
              <section className='odc-uf-group' aria-labelledby={driverId}>
                <h3 id={driverId} className='odc-uf-heading'>{t('DRIVER', 'Driver')}</h3>
                <Switch
                  checked={!!(changes.driver_zone_restriction ?? user?.driver_zone_restriction)}
                  onCheckedChange={(value) => handleChangeSwtich('driver_zone_restriction', value)}
                >
                  {t('DRIVER_ZONE_RESTRICTION', 'Driver zone restriction')}
                </Switch>
              </section>
            )}
          </>
          )}
      <SaveBar
        className='odc-uf-savebar'
        formSelector='.odc-uf-form'
        label={t('SAVE_CHANGES', 'Save changes')}
        count={count}
        countText={withCount(count === 1
          ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change')
          : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes'), count)}
        names={names}
        moreText={(n) => withCount(t('SETTINGS_UNSAVED_MORE', '+_count_'), n)}
        saving={!!formState?.loading}
        errorText={errorText}
        saved={saved}
        savedText={t('SAVED', 'Saved')}
        discardLabel={t('DISCARD', 'Discard')}
        saveLabel={t('SAVE_CHANGES', 'Save changes')}
        saveType='submit'
        onDiscard={handleDiscard}
      />
      {dialog}
      <ConfirmAdmin
        open={!!adminLevelCopy}
        action='user_admin_level'
        targetId={user?.id}
        title={adminLevelCopy?.title}
        description={adminLevelCopy?.body}
        otpDescription={adminLevelCopy?.body}
        confirmLabel={adminLevelCopy?.confirmLabel}
        onClose={() => setAdminLevelCopy(null)}
        onConfirm={(token) => {
          setAdminLevelCopy(null)
          save(token)
        }}
      />
    </form>
  )
}
