import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'

import settings from '~/config'
import { useLanguage, useCustomer, useApi } from '../../../../../index'
import { Field, PasswordField, SaveBar, Skeleton, Switch, TextField, useFieldFrame } from '../../Shared/Product'
import { PhoneField } from '../../Shared/Product/PhoneField'
import { FirstSelect } from '../../Shared/UI/FirstSelect'
import { SelectSurfaceContext } from '../../Shared/UI/selectPlacement'
import { useLabelFocusesTrigger } from '../../Settings/SettingsHubForm/useLabelFocusesTrigger'
import { userTypeLabel, userTypesValues } from '../../Users/UserTypeSelector/utils'
import { useConfirmStep } from '../../../hooks/useConfirmStep'
import { ConfirmAdmin } from '../../Shared/ConfirmAdmin'
import { timezones } from '../../../config/constants'
import { toAlertContent } from '../../../../../utils/alertContent'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { userFullName } from '../../../../../utils/userContact'
import {
  cellphoneStartZero,
  changedFieldNames,
  checkoutFields,
  fieldLabel,
  phoneToChanges,
  sanitizeEmail,
  userPhoneText,
  validateUserForm
} from '../../../../../utils/userForm'
import { useDriverPlate } from './useDriverPlate'
import './user-form-details.css'

// redesign UF-B3 (decisions 1-3): the Delivery copy of the profile form in Product, with the composition of the
// Users copy (B2): labels over every field, the groups Details / Account / Driver, errors under their field, and the save bar
// of Settings promoted to `P/SaveBar`, inside the form at its foot. The trees are not unified on purpose (will).

// The select is the Product anatomy (C18): trigger as wide as the field, brand rows.
const FIT_TRIGGER = { fitTrigger: true }

const SKELETON_ROWS = 6
// «Saved» stays this long, then the bar goes away
const SAVED_MILLISECONDS = 4000

const withCount = (text, count) => text.replace('_count_', String(count))

const hasErrors = errors => Object.keys(errors).length > 0

/**
 * The text of an API error for the bar (or the photo): a string stays the string, a list is joined, anything else
 * (an object, an Error, a `User` the SDK cast from a 200 with `error: true`, an empty list) is the generic sentence.
 * Never empty (M-UF5).
 * @param {Function} t translator
 * @param {*} result `formState.result.result`
 */
export const userFormErrorText = (t, result) => {
  const fallback = t('USER_SAVE_ERROR', 'We couldn\'t save the changes. Try again.')
  return toAlertContent(result, fallback).map(line => translateApiMessage(t, line, fallback)).join(' ') || fallback
}

/** A dropdown tied to the label of its Field (the C18 trigger names itself «label + value»). */
const FramedSelect = ({ label, placeholder, options, defaultValue, onChange, isDisabled, searchable, searchValue, handleChangeSearch }) => {
  const frame = useFieldFrame()
  const rootRef = useRef(null)
  useLabelFocusesTrigger(rootRef, frame?.labelId)
  return (
    <span ref={rootRef} className='odc-uf-select'>
      <SelectSurfaceContext.Provider value={FIT_TRIGGER}>
        <FirstSelect
          ariaLabelledBy={frame?.labelId || undefined}
          ariaLabel={label}
          placeholder={placeholder}
          options={options}
          defaultValue={defaultValue}
          onChange={onChange}
          isDisabled={isDisabled}
          isShowSearchBar={searchable}
          searchBarIsCustomLayout={searchable}
          searchBarIsNotLazyLoad={searchable}
          searchValue={searchValue}
          handleChangeSearch={handleChangeSearch}
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
    userData,
    isCustomerMode,
    isDriversPage,
    handleChangeSwtich,
    handleChangeUserType,
    setCellphoneStartZero,
    defaultUserTypesSelected,
    onDirtyChange
  } = props

  const [, t] = useLanguage()
  const [, { setUserCustomer }] = useCustomer()
  const [ordering] = useApi()
  const baseId = useId()
  const { ask, dialog } = useConfirmStep()
  // Owner decision 24 B: the question asked before giving level 0 (password or code), with the C8 words
  const [adminLevelCopy, setAdminLevelCopy] = useState(null)
  const formRef = useRef(null)
  const externalIdRef = useRef(null)
  const caretRef = useRef(null)

  const user = userData
  const changes = formState?.changes ?? {}
  const loadingFields = !!validationFields?.loading

  const driverPlateProjects = settings.dashboard_project_allowlists?.driver_plate
  const project = ordering?.project
  const showDriverPlate = isDriversPage && typeof project === 'string' && project !== '' &&
    Array.isArray(driverPlateProjects) && driverPlateProjects.includes(project)
  const { plate, setPlate, savePlate, resetPlate, isPlateDirty, plateState } = useDriverPlate(showDriverPlate ? userData?.id : null)

  const [isValidPhoneNumber, setIsValidPhoneNumber] = useState(null)
  const [userPhoneNumber, setUserPhoneNumber] = useState(null)
  const [timezoneSearchValue, setTimezoneSearchValue] = useState('')
  const [errors, setErrors] = useState({})
  const [focusRequest, setFocusRequest] = useState(0)
  const [plateSaved, setPlateSaved] = useState(false)
  const [saved, setSaved] = useState(false)
  const [flowDone, setFlowDone] = useState(0)

  const fields = checkoutFields(validationFields, showField)
  const cellphoneRule = validationFields?.fields?.checkout?.cellphone
  const showInputPhoneNumber = cellphoneRule?.enabled ?? false

  // what the form shows: the change if any, else the user's value (the API may send a number, e.g. an external id)
  const valueOf = (code) => {
    const value = changes[code] ?? user?.[code] ?? ''
    return typeof value === 'number' ? String(value) : value
  }

  // redesign UF-B3 (M-UF1): the placeholder of main is the label now; the names a change can carry, for the bar
  const labelOfKey = (key) => {
    const field = fields.find(item => item.code === key) ?? Object.values(validationFields?.fields?.checkout ?? {}).find(item => item?.code === key)
    if (field && key !== 'cellphone') return fieldLabel(t, field)
    return ({
      cellphone: t('PHONE_NUMBER', 'Phone number'),
      level: t('USER_TYPE', 'User type'),
      timezone: t('TIMEZONE', 'Timezone'),
      password: t('NEW_PASSWORD', 'New password'),
      external_id: t('EXTERNAL_ID', 'External ID'),
      driver_zone_restriction: t('DRIVER_ZONE_RESTRICTION', 'Driver zone restriction'),
      mono_session: t('MONO_SESSION', 'Mono session')
    })[key] ?? key
  }

  // The photo is saved the moment it is chosen (decision 3), so it is never an unsaved change of the bar.
  const { photo: _photo, ...formChanges } = changes
  const names = changedFieldNames(formChanges, labelOfKey)
  if (isPlateDirty) names.push(t('DRIVER_LICENSE_PLATE', 'License plate'))
  const count = names.length

  const setUserCellPhone = () => setUserPhoneNumber(userPhoneText(user, formState))

  const validate = () => validateUserForm({
    t,
    fields,
    values: Object.fromEntries(fields.map(field => [field.code, valueOf(field.code)])),
    isRequiredField: code => !!isRequiredField?.(code),
    password: { value: changes.password ?? '', show: true, required: !!isRequiredField?.('password') },
    phone: {
      number: userPhoneNumber,
      isValid: userPhoneNumber ? isValidPhoneNumber : true,
      enabled: showInputPhoneNumber,
      required: cellphoneRule?.required,
      hasCountryCode: !!user?.country_phone_code
    }
  })

  const onSubmit = async (confirmationToken) => {
    setPlateSaved(false)
    if (isPlateDirty) {
      const done = await savePlate()
      if (!done) {
        setFlowDone(count => count + 1)
        return
      }
      setPlateSaved(true)
    }
    if (Object.keys(changes).length > 0) {
      let phoneChanges = null
      if (user?.cellphone && !userPhoneNumber) {
        phoneChanges = {
          country_phone_code: '',
          cellphone: ''
        }
      }
      if (isCustomerMode) {
        setUserCustomer(formState.result.result, true)
      }
      if (confirmationToken) await handleButtonUpdateClick(phoneChanges, undefined, undefined, confirmationToken)
      else await handleButtonUpdateClick(phoneChanges)
    }
    setFlowDone(count => count + 1)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const found = validate()
    setErrors(found)
    if (hasErrors(found)) {
      setFocusRequest(request => request + 1)
      return
    }
    // redesign D-11 (owner, 2026-10-19, C8): a change of user type changes what the person can see and do, so the save
    // asks first, BEFORE `onSubmit` (which writes the plate ahead of the user): on Cancel nothing is written and the form keeps its
    // changes. The photo upload (`handleButtonUpdateClick(null, true)`) never comes here.
    const levelChanged = changes.level !== undefined && changes.level !== null && Number(changes.level) !== Number(user?.level)
    if (levelChanged) {
      const copy = {
        title: t('USER_TYPE_CHANGE_CONFIRM_TITLE', 'Change _name_ to _type_?')
          .replace('_name_', () => userFullName(user) || user?.email || '')
          .replace('_type_', () => userTypeLabel(t, changes.level)),
        body: t('USER_TYPE_CHANGE_CONFIRM_BODY', 'What they can see and do changes as soon as you save.'),
        confirmLabel: t('USER_TYPE_CHANGE_CONFIRM', 'Change user type')
      }
      // Owner decision 24 B (2026-10-21, ): giving level 0 asks the password or a code (ConfirmAdmin) instead of C8, as in
      // Users/UserFormDetails: never two confirmations in a row (D-1). Nothing is written (the plate included) until it passes.
      // the API checks the confirmation both ways (action `user_admin_level`), giving level 0 to someone who was not
      // an admin, or taking it from someone who was; either way the row being edited is the ConfirmAdmin target.
      if (Number(changes.level) === 0 || Number(user?.level) === 0) {
        setAdminLevelCopy(copy)
        return
      }
      const confirmed = await ask({ ...copy, tone: 'danger' })
      if (!confirmed) return
    }
    onSubmit()
  }

  const handleDiscard = () => {
    cleanFormState && cleanFormState({ changes: {}, result: { error: false } })
    setUserPhoneNumber(userPhoneText(user, { result: { error: false } }))
    setCellphoneStartZero && setCellphoneStartZero(null)
    resetPlate()
    setErrors({})
    setPlateSaved(false)
    setSaved(false)
    setTimezoneSearchValue('')
  }

  const handleChangePhoneNumber = (number, isValid, rawNumber) => {
    setUserPhoneNumber(number)
    setCellphoneStartZero && setCellphoneStartZero(cellphoneStartZero(rawNumber))
    // Delivery never had the `validation_phone_number_lib` branch: it always reads the number as the library parses it
    handleChangeInput(phoneToChanges(number, isValid, { validationPhoneNumberLib: 1 }), true)
  }

  const changeInput = (name, value) => handleChangeInput({ target: { name, value } })

  const handleChangeEmail = (value) => changeInput('email', sanitizeEmail(value))

  // redesign UF-B3 (M-UF12): typing keeps the digits; a paste inserts the digits of the text at the caret (replacing the
  // selection) and what is stored is what the field shows. No `execCommand`.
  const handleExternalId = (value) => changeInput('external_id', value.replace(/\D/g, ''))

  const handleExternalIdPaste = (event) => {
    event.preventDefault()
    const digits = (event.clipboardData?.getData('text/plain') ?? '').replace(/\D/g, '')
    if (!digits) return
    const input = event.currentTarget
    const start = input.selectionStart ?? input.value.length
    const end = input.selectionEnd ?? start
    caretRef.current = start + digits.length
    changeInput('external_id', input.value.slice(0, start) + digits + input.value.slice(end))
  }

  // The controlled value comes back a render later: the caret goes right after what was pasted.
  useLayoutEffect(() => {
    if (caretRef.current == null) return
    const caret = caretRef.current
    caretRef.current = null
    externalIdRef.current?.setSelectionRange?.(caret, caret)
  })

  useEffect(() => {
    if (user && !formState?.loading) {
      setUserCellPhone()
    }
  }, [user])

  // main reset the changes when another user opened
  useEffect(() => {
    if (user?.id) {
      cleanFormState && cleanFormState({ changes: {} })
    }
  }, [user?.id])

  // Once a save failed validation the messages follow what the user types, as they would in a field that checks as it goes.
  useEffect(() => {
    if (hasErrors(errors)) setErrors(validate())
  }, [formState?.changes, userPhoneNumber, isValidPhoneNumber])

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
  // redesign DL-B5 (decision 1; as Users/UserFormDetails, UC-B6 auditor #16): opt-in. The page asks to hear whether the form has
  // unsaved changes. It is what the bar counts: a changed field or a changed plate (the photo is saved when chosen).
  useEffect(() => {
    if (onDirtyChange) onDirtyChange(hasChanges)
  }, [hasChanges])
  const hadChanges = useRef(false)
  useEffect(() => {
    const appeared = hasChanges && !hadChanges.current
    hadChanges.current = hasChanges
    if (!appeared) return
    const active = document.activeElement
    if (active && formRef.current?.contains(active)) active.scrollIntoView?.({ block: 'nearest' })
  }, [hasChanges])

  // «Saved» for a few seconds after a save that ended well (the plate and the user, or either)
  useEffect(() => {
    if (!flowDone || formState?.result?.error || plateState.error) return undefined
    setSaved(true)
    const timer = setTimeout(() => setSaved(false), SAVED_MILLISECONDS)
    return () => clearTimeout(timer)
  }, [flowDone])

  const timezonesOptions = useMemo(() => timezones
    .filter(timezone => timezone.toLocaleLowerCase().includes(timezoneSearchValue.toLocaleLowerCase()))
    .map(timezone => ({ value: timezone, content: timezone })), [timezoneSearchValue])

  const requiredLabel = t('REQUIRED', 'Required')
  const saving = !!formState?.loading || plateState.loading

  // redesign UF-B3 (decision 2, M-UF5, M-UF18): what the bar says when something went wrong, most urgent first.
  let errorText = null
  if (hasErrors(errors)) {
    const invalid = Object.keys(errors).length
    errorText = withCount(invalid === 1
      ? t('SETTINGS_FIX_FIELDS_ONE', 'Fix _count_ field to save.')
      : t('SETTINGS_FIX_FIELDS_OTHER', 'Fix _count_ fields to save.'), invalid)
  } else if (plateState.error) {
    errorText = translateApiMessage(t, plateState.error, t('USER_SAVE_ERROR', 'We couldn\'t save the changes. Try again.'))
  } else if (formState?.result?.error && !changes.photo) {
    // a photo that failed to upload (its `changes.photo` stays) is shown under the avatar, not here
    errorText = userFormErrorText(t, formState.result.result)
    if (plateSaved) {
      errorText = t('USER_FORM_PLATE_SAVED_USER_FAILED', 'The license plate was saved, but the other changes were not. _message_').replace('_message_', errorText)
    }
  }

  const detailsId = `${baseId}-details`
  const accountId = `${baseId}-account`
  const driverId = `${baseId}-driver`

  const userTypeOptions = userTypesValues({
    t,
    isPrimary: true,
    defaultUserType: changes.level ?? user?.level,
    defaultUserTypesSelected
  })

  return (
    <form
      ref={formRef}
      className='odc-uf-form'
      noValidate
      tabIndex={-1}
      aria-busy={loadingFields ? 'true' : undefined}
      onSubmit={handleSubmit}
    >
      {loadingFields
        ? (
          <div className='odc-uf-skeleton' aria-hidden='true'>
            {[...Array(SKELETON_ROWS)].map((_, index) => (
              <Skeleton key={index} block='var(--od-x-control-height)' />
            ))}
          </div>
          )
        : (
          <>
            <section className='odc-uf-group' aria-labelledby={detailsId}>
              <h3 id={detailsId} className='odc-uf-heading'>{t('DETAILS', 'Details')}</h3>
              {fields.map(field => (
                <TextField
                  key={field.id ?? field.code}
                  type={field.type}
                  name={field.code}
                  label={fieldLabel(t, field)}
                  required={!!isRequiredField?.(field.code)}
                  requiredLabel={requiredLabel}
                  error={errors[field.code]}
                  value={valueOf(field.code)}
                  onChange={field.code === 'email' ? handleChangeEmail : value => changeInput(field.code, value)}
                  autoComplete='off'
                />
              ))}
              {!!showInputPhoneNumber && (
                <PhoneField
                  label={t('PHONE_NUMBER', 'Phone number')}
                  countryLabel={t('USER_FORM_PHONE_COUNTRY', 'Phone number country')}
                  // the piece paints its own message for a number that is not valid; only «required» comes from here
                  error={userPhoneNumber ? undefined : errors.cellphone}
                  user={user}
                  value={userPhoneNumber}
                  setValue={handleChangePhoneNumber}
                  handleIsValid={setIsValidPhoneNumber}
                />
              )}
            </section>

            <section className='odc-uf-group' aria-labelledby={accountId}>
              <h3 id={accountId} className='odc-uf-heading'>{t('USER_FORM_ACCOUNT', 'Account')}</h3>
              <Field label={t('USER_TYPE', 'User type')}>
                <FramedSelect
                  label={t('USER_TYPE', 'User type')}
                  placeholder={t('TYPE', 'Type')}
                  options={userTypeOptions}
                  defaultValue={changes.level ?? user?.level}
                  onChange={handleChangeUserType}
                  isDisabled={Array.isArray(defaultUserTypesSelected)}
                />
              </Field>
              <PasswordField
                name='password'
                label={t('NEW_PASSWORD', 'New password')}
                hint={t('USER_FORM_PASSWORD_KEEP_HINT', 'Leave empty to keep the current password.')}
                showLabel={t('SHOW_PASSWORD', 'Show password')}
                hideLabel={t('HIDE_PASSWORD', 'Hide password')}
                required={!!isRequiredField?.('password')}
                requiredLabel={requiredLabel}
                error={errors.password}
                value={changes.password ?? ''}
                onChange={value => changeInput('password', value)}
                autoComplete='new-password'
              />
            </section>

            {isDriversPage && (
              <section className='odc-uf-group' aria-labelledby={driverId}>
                <h3 id={driverId} className='odc-uf-heading'>{t('DRIVER', 'Driver')}</h3>
                <TextField
                  ref={externalIdRef}
                  name='external_id'
                  label={t('EXTERNAL_ID', 'External ID')}
                  inputMode='numeric'
                  autoComplete='off'
                  value={valueOf('external_id')}
                  onChange={handleExternalId}
                  onPaste={handleExternalIdPaste}
                />
                {showDriverPlate && (
                  <TextField
                    name='plate'
                    label={t('DRIVER_LICENSE_PLATE', 'License plate')}
                    value={plate}
                    onChange={setPlate}
                    disabled={plateState.loading}
                    autoComplete='off'
                    maxLength={255}
                  />
                )}
                <Field label={t('TIMEZONE', 'Timezone')}>
                  <FramedSelect
                    label={t('TIMEZONE', 'Timezone')}
                    placeholder={t('SELECT_TIMEZONE', 'Select a timezone')}
                    options={timezonesOptions}
                    defaultValue={changes.timezone ?? user?.timezone ?? ''}
                    onChange={value => handleChangeSwtich('timezone', value)}
                    searchable
                    searchValue={timezoneSearchValue}
                    handleChangeSearch={setTimezoneSearchValue}
                  />
                </Field>
                <div className='odc-uf-switch-row'>
                  <Switch
                    checked={!!(changes.driver_zone_restriction ?? user?.driver_zone_restriction ?? false)}
                    onCheckedChange={value => handleChangeSwtich('driver_zone_restriction', value)}
                  >
                    {t('DRIVER_ZONE_RESTRICTION', 'Driver zone restriction')}
                  </Switch>
                </div>
                <div className='odc-uf-switch-row'>
                  <Switch
                    checked={!!(changes.mono_session ?? user?.mono_session ?? false)}
                    onCheckedChange={value => handleChangeSwtich('mono_session', value)}
                  >
                    {t('MONO_SESSION', 'Mono session')}
                  </Switch>
                </div>
              </section>
            )}
          </>
          )}

      <SaveBar
        label={t('SAVE_CHANGES', 'Save changes')}
        count={count}
        countText={withCount(count === 1
          ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change')
          : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes'), count)}
        names={names}
        moreText={more => withCount(t('SETTINGS_UNSAVED_MORE', '+_count_'), more)}
        saving={saving}
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
          onSubmit(token)
        }}
      />
    </form>
  )
}
