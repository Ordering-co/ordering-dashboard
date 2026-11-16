import React, { useEffect, useId, useRef, useState } from 'react'

import {
  useLanguage,
  useConfig,
  DragAndDrop,
  UserFormDetails as UserFormDetailsController
} from '../../../../../index'
import { Avatar, Button, DatePicker, Dialog, Field, IconButton, InlineNotice, PasswordField, Skeleton, TextField } from '../../Shared/Product'
import { PhoneField } from '../../Shared/Product/PhoneField'
import { ImageCrop } from '../../Shared/UI/ImageCrop'
import { Image as ImageIcon, X as CloseIcon } from '../../Shared/Icon'
import { OccupationSelector } from '../OccupationSelector'
import { bytesConverter } from '../../../utils'
import { toAlertContent } from '../../../../../utils/alertContent'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { getDateTimeFormats } from '../../../../../utils/settingsCustomSections'
import {
  cellphoneStartZero,
  checkoutFields,
  fieldLabel,
  phoneToChanges,
  sanitizeEmail,
  validateUserForm
} from '../../../../../utils/userForm'

import '../UserAddForm/user-add-form.css'
import './professional-add-form.css'

// redesign (P-UF5): the professionals' add form in the composition gave `UserAddForm` (same root, same
// classes, same order of the parts), with what is its own kept: the occupation (always there: Stores gives no list, the selector
// fetches its own), the 24/7 schedule it starts with, the birthday, the password optional, no level and no user type (the
// controller adds level 8). Its two hosts: the staff directory's sheet already titles the form (`showTitle={false}`); Stores does
// not (title and close of a service in one header row).
// redesign (P-OF1, P-OF2, P-OF4; owner via the triage): it says what the user add form says («Occupation»
// as in the profile, «Phone number», FRONT_VISUALS_PASSWORD, «Add» with only the busy state) and crops the photo with its dialog.

const IMAGE_ACCEPT = 'image/png, image/jpeg, image/jpg'
// The oldest birthday the calendar of main offered (RangeCalendar `minDate`); there is no maximum, as in main.
const BIRTHDAY_MIN = '1922-01-01'

/** The words of `P/DatePicker`, translated here: the wrapper has no text of its own (same as `UserFormDetails`). */
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

/** Every day open from 00:00 to 23:59: the schedule a new professional starts with. */
const allDayWeek = () => Array.from({ length: 7 }, () => ({
  enabled: true,
  lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }]
}))

const ProfessionalAddFormUI = (props) => {
  const {
    formState,
    showField,
    isRequiredField,
    validationFields,
    handleChangeInput,
    handleButtonAddClick,
    isCheckout,
    handleChangeSwtich,
    onClose,
    isService,
    occupations,
    setCellphoneStartZero,
    showTitle = true // redesign (B1c): the host that already has a title turns it off
  } = props

  const [, t] = useLanguage()
  const [{ configs }] = useConfig()
  const occupationLabelId = useId()

  const formRef = useRef(null)
  const fileRef = useRef(null)
  const photoButtonRef = useRef(null)
  const [phone, setPhone] = useState({ number: null, isValid: null })
  const [submitted, setSubmitted] = useState(false)
  const [photoError, setPhotoError] = useState(null)
  const [cropState, setCropState] = useState({ name: null, data: null, open: false })

  const showInputPhoneNumber = validationFields?.fields?.checkout?.cellphone?.enabled ?? false
  const showPassword = !isCheckout
  const changes = formState?.changes ?? {}
  const loadingFields = !!validationFields?.loading
  const fields = loadingFields ? [] : checkoutFields(validationFields, showField)
  const requiredLabel = t('REQUIRED', 'Required')
  const passwordRequired = !!isRequiredField('password')
  const dateFormat = getDateTimeFormats(configs?.dates_general_format?.value).dateFormat

  // What is wrong with what the form shows now; it reaches the fields only after the first submit.
  const validate = () => validateUserForm({
    t,
    fields,
    values: changes,
    isRequiredField,
    // a professional can be created without a password (main); once typed it needs 8 characters
    password: { value: changes.password, show: showPassword, required: passwordRequired },
    phone: { number: phone.number, isValid: phone.isValid, enabled: !!showInputPhoneNumber, required: false, hasCountryCode: false }
  })
  const errors = submitted ? validate() : {}

  const focusFirstInvalid = (codes) => {
    const root = formRef.current
    if (!root) return
    const targets = codes
      .map(code => code === 'cellphone' ? root.querySelector('input.PhoneInputInput') : root.querySelector(`[name="${code}"]`))
      .filter(Boolean)
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1)
    targets[0]?.focus()
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (formState?.loading) return
    setSubmitted(true)
    const codes = Object.keys(validate())
    if (codes.length > 0) {
      focusFirstInvalid(codes)
      return
    }
    if (Object.keys(changes).length > 0) {
      handleButtonAddClick()
    }
  }

  // The photo goes through the crop of the user add form; only the cropped photo goes with the creation, a cancelled crop attaches nothing
  const handleFiles = (files) => {
    if (files?.length !== 1) return
    const file = files[0]
    if (file.type.split('/')[0] !== 'image') {
      setPhotoError(t('ERROR_ONLY_IMAGES', 'Only images can be accepted'))
      return
    }
    if (bytesConverter(file.size) > 2048) {
      setPhotoError(t('IMAGE_MAXIMUM_SIZE', 'The maximum image size is 2 megabytes'))
      return
    }
    setPhotoError(null)
    const reader = new window.FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      setCropState({ name: 'photo', data: reader.result, open: true })
    }
  }

  const handlePickedFile = (event) => {
    const picked = Array.from(event.target.files ?? [])
    event.target.value = '' // the same file can be picked again
    handleFiles(picked)
  }

  const closeCrop = () => setCropState(current => ({ ...current, open: false }))

  const handleChangePhoto = (croppedImg) => {
    handleChangeSwtich(cropState?.name, croppedImg)
    setCropState({ name: null, data: null, open: false })
  }

  const handleChangePhoneNumber = (number, isValid, rawNumber) => {
    setPhone(current => ({ ...current, number }))
    handleChangeInput(phoneToChanges(number, isValid, { validationPhoneNumberLib: configs?.validation_phone_number_lib?.value }), true)
    // a leading zero survives, as in the profile and the user add form
    setCellphoneStartZero && setCellphoneStartZero(cellphoneStartZero(rawNumber))
  }

  // The only write at mount: the controller handlers close over a stale `formState`, a second write would drop this one.
  useEffect(() => {
    handleChangeInput({ target: { name: 'schedule', value: allDayWeek() } })
  }, [])

  // the answer of the API, as text: a string stays a string, a list shows each line, anything else the generic message
  const saveError = t('USER_SAVE_ERROR', 'We couldn\'t save the changes. Try again.')
  const apiLines = !formState?.loading && formState?.result?.error
    ? toAlertContent(formState.result?.result, saveError).map(line => translateApiMessage(t, line, line))
    : []

  const photoName = [changes.name, changes.lastname].filter(Boolean).join(' ')

  return (
    <>
      <div className='odc-uf-add'>
      <form
        ref={formRef}
        className='odc-uf-form'
        onSubmit={handleSubmit}
        noValidate
        autoComplete='off'
        data-tour='tour_fill'
      >
        {/* `showTitle={false}` is for a host that already titles the form (the staff directory's sheet); a service (Stores) has no other close */}
        {(showTitle || isService) && (
          <div className='odc-pf-header'>
            {showTitle && (
              <h1 className='odc-uf-title'>
                {t('NEW_PROFESSIONAL', 'New professional')}
              </h1>
            )}
            {isService && (
              <IconButton
                className='odc-pf-close'
                icon={CloseIcon}
                label={t('CLOSE', 'Close')}
                onClick={() => onClose && onClose()}
              />
            )}
          </div>
        )}
        <DragAndDrop className='odc-uf-photo' onDrop={dataTransfer => handleFiles(dataTransfer.files)} disabled={formState?.loading}>
          {formState?.loading
            ? <span className='odc-uf-photo-wait'><Skeleton shape='round' size='100%' block='100%' /></span>
            : <Avatar name={photoName} src={changes.photo} size='lg' />}
          <div className='odc-uf-photo-body'>
            <Button ref={photoButtonRef} icon={ImageIcon} disabled={formState?.loading} onClick={() => fileRef.current?.click()}>
              {t('USER_FORM_ADD_PHOTO', 'Add photo')}
            </Button>
            <p className='odc-uf-hint'>{t('USER_FORM_ADD_PHOTO_HINT', 'JPG or PNG, up to 2 MB.')}</p>
            {photoError && <p className='odc-uf-photo-error' role='alert'>{photoError}</p>}
          </div>
          <input
            ref={fileRef}
            type='file'
            accept={IMAGE_ACCEPT}
            hidden
            tabIndex={-1}
            aria-hidden='true'
            disabled={formState?.loading}
            onChange={handlePickedFile}
          />
        </DragAndDrop>
        {/* Always there, also without a list: in Stores the selector fetches its own */}
        <div className='odc-pf-occupation' role='group' aria-labelledby={occupationLabelId}>
          <p id={occupationLabelId} className='odc-pf-label'>{t('USER_FORM_OCCUPATION', 'Occupation')}</p>
          <OccupationSelector
            occupations={occupations}
            occupationId={changes.occupation_id}
            handleChangeOccupation={id => handleChangeInput({ target: { name: 'occupation_id', value: id } })}
          />
        </div>
        {!loadingFields
          ? (
            <>
              <div className='odc-uf-fields'>
                {fields.map(field => (
                  <TextField
                    key={field.id}
                    type={field.type}
                    name={field.code}
                    label={fieldLabel(t, field)}
                    required={isRequiredField(field.code)}
                    requiredLabel={requiredLabel}
                    error={errors[field.code]}
                    value={changes[field.code] ?? ''}
                    onChange={value => handleChangeInput({ target: { name: field.code, value: field.code === 'email' ? sanitizeEmail(value) : value } })}
                    autoComplete='off'
                  />
                ))}
                {!!showInputPhoneNumber && (
                  <PhoneField
                    label={t('PHONE_NUMBER', 'Phone number')}
                    countryLabel={t('COUNTRY_PHONE_CODE', 'Country phone code')}
                    value={phone.number}
                    setValue={handleChangePhoneNumber}
                    handleIsValid={isValid => setPhone(current => ({ ...current, isValid }))}
                  />
                )}
                {showPassword && (
                  <PasswordField
                    name='password'
                    label={t('FRONT_VISUALS_PASSWORD', 'Password')}
                    required={passwordRequired}
                    requiredLabel={requiredLabel}
                    hint={t('USER_FORM_PASSWORD_MIN_HINT', 'At least 8 characters.')}
                    showLabel={t('SHOW_PASSWORD', 'Show password')}
                    hideLabel={t('HIDE_PASSWORD', 'Hide password')}
                    error={errors.password}
                    value={changes.password ?? ''}
                    onChange={value => handleChangeInput({ target: { name: 'password', value } })}
                    autoComplete='new-password'
                  />
                )}
                {/* P/DatePicker in the project's format; it hands back `YYYY-MM-DD`, the string the legacy calendar sent */}
                <Field label={t('DATE_OF_BIRTH', 'Date of birth')}>
                  <DatePicker
                    label={t('DATE_OF_BIRTH', 'Date of birth')}
                    labels={pickerLabels(t)}
                    dateFormat={dateFormat}
                    value={changes.birthdate || null}
                    min={BIRTHDAY_MIN}
                    onChange={day => handleChangeSwtich('birthdate', day)}
                  />
                </Field>
              </div>
              {apiLines.length > 0 && (
                <InlineNotice tone='danger' role='alert' className='odc-uf-notice'>
                  {apiLines.map((line, index) => <span key={index} className='odc-uf-notice-line'>{line}</span>)}
                </InlineNotice>
              )}
              <div className='odc-uf-actions'>
                <Button
                  variant='primary'
                  type='submit'
                  busy={!!formState?.loading}
                  disabled={Object.keys(changes).length === 0}
                >
                  {t('ADD', 'Add')}
                </Button>
              </div>
            </>
            )
          : (
            <div className='odc-uf-skeleton' aria-busy='true'>
              {[...Array(6)].map((item, i) => (
                <div key={i} className='odc-uf-skeleton-row'><Skeleton size='60%' /></div>
              ))}
            </div>
            )}
      </form>
      </div>
      <Dialog
        open={cropState.open}
        onOpenChange={closeCrop}
        title={t('IMAGE_CROP', 'Image crop')}
        closeLabel={t('CLOSE', 'Close')}
        size='lg'
        returnFocus={photoButtonRef}
      >
        {cropState.data && (
          <ImageCrop
            photo={cropState.data}
            handleChangePhoto={handleChangePhoto}
            onClose={closeCrop}
          />
        )}
      </Dialog>
    </>
  )
}

export const ProfessionalAddForm = (props) => {
  const UserAddProps = {
    ...props,
    useSessionUser: false,
    useValidationFields: true,
    isProfessional: true,
    UIComponent: ProfessionalAddFormUI
  }
  return (
    <UserFormDetailsController {...UserAddProps} />
  )
}
