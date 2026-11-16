import React, { useEffect, useRef, useState } from 'react'

import {
  useLanguage,
  useConfig,
  DragAndDrop,
  UserFormDetails as UserFormDetailsController
} from '../../../../../index'
import { Avatar, Button, Dialog, Field, InlineNotice, PasswordField, Skeleton, TextField, useFieldFrame } from '../../Shared/Product'
import { PhoneField } from '../../Shared/Product/PhoneField'
import { FirstSelect } from '../../Shared/UI/FirstSelect'
import { ImageCrop } from '../../Shared/UI/ImageCrop'
import { ConfirmAdmin } from '../../Shared/ConfirmAdmin'
import { SelectSurfaceContext } from '../../Shared/UI/selectPlacement'
import { Image as ImageIcon } from '../../Shared/Icon'
import { userTypesValues } from '../UserTypeSelector/utils'
import { bytesConverter } from '../../../utils'
import { toAlertContent } from '../../../../../utils/alertContent'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import {
  cellphoneStartZero,
  checkoutFields,
  fieldLabel,
  phoneToChanges,
  sanitizeEmail,
  validateUserForm
} from '../../../../../utils/userForm'

import './user-add-form.css'

// redesign UF-B4 (decision 4, ): the add form in Product. Same fields under the same conditions, same values
// to the controller; what changes is how it reads (labels, required marks, errors under their fields with the focus on
// the first, the API error in the form) and that its own title is opt-in (`showTitle`).

const FIT_TRIGGER = { fitTrigger: true } // the C18 select as wide as its field
const IMAGE_ACCEPT = 'image/png, image/jpeg, image/jpg'

/** The C18 select tied to the label of its `P/Field` (the trigger is a `div[role=button]`, which a `<label for>` cannot point at). */
const FramedSelect = ({ placeholder, defaultValue, options, onChange, isDisabled, isShowSearchBar, searchValue, handleChangeSearch }) => {
  const frame = useFieldFrame()
  const rootRef = useRef(null)
  const labelId = frame?.labelId
  useEffect(() => {
    const labelNode = labelId ? document.getElementById(labelId) : null
    if (!labelNode) return undefined
    const focusTrigger = (event) => {
      const trigger = rootRef.current?.querySelector('[aria-haspopup="listbox"]')
      if (!trigger) return
      event.preventDefault()
      trigger.focus()
    }
    labelNode.addEventListener('click', focusTrigger)
    return () => labelNode.removeEventListener('click', focusTrigger)
  }, [labelId])
  return (
    <span ref={rootRef} className='odc-uf-select'>
      <SelectSurfaceContext.Provider value={FIT_TRIGGER}>
        <FirstSelect
          ariaLabelledBy={labelId || undefined}
          placeholder={placeholder}
          defaultValue={defaultValue}
          options={options}
          onChange={onChange}
          isDisabled={isDisabled}
          isShowSearchBar={isShowSearchBar}
          searchValue={searchValue}
          handleChangeSearch={handleChangeSearch}
        />
      </SelectSurfaceContext.Provider>
    </span>
  )
}

const UserAddFormUI = (props) => {
  const {
    formState,
    showField,
    cleanFormState,
    isRequiredField,
    validationFields,
    handleChangeInput,
    handleButtonAddClick,
    isCheckout,
    handleChangeUserType,
    handleChangeSwtich,
    defaultPhoneNumber,
    isFromCustomOrder,
    hideUserTypeSelector,
    defaultUserTypesSelected,
    setCellphoneStartZero,
    showTitle = true // redesign UF-B4 (M-UF9): the host that already has a title turns it off
  } = props

  const [, t] = useLanguage()
  const [{ configs }] = useConfig()

  const formRef = useRef(null)
  const fileRef = useRef(null)
  const photoButtonRef = useRef(null)
  const [phone, setPhone] = useState({ number: null, isValid: null })
  const [submitted, setSubmitted] = useState(false)
  const [photoError, setPhotoError] = useState(null)
  const [cropState, setCropState] = useState({ name: null, data: null, open: false })
  const [confirmAdminOpen, setConfirmAdminOpen] = useState(false)

  const defaultLevelType = Array.isArray(defaultUserTypesSelected) ? defaultUserTypesSelected[0] : undefined
  // redesign (row 90, I#24): the wizard (`true`) always shows the phone; `false`/absent leaves it to the checkout configuration
  const showInputPhoneNumber = isFromCustomOrder || (validationFields?.fields?.checkout?.cellphone?.enabled ?? false)
  const showPassword = !isCheckout && !isFromCustomOrder
  const changes = formState?.changes ?? {}
  const loadingFields = !!validationFields?.loading
  const fields = loadingFields ? [] : checkoutFields(validationFields, showField)
  const requiredLabel = t('REQUIRED', 'Required')

  // What is wrong with what the form shows now; it reaches the fields only after the first submit.
  const validate = () => validateUserForm({
    t,
    fields,
    values: changes,
    isRequiredField,
    password: { value: changes.password, show: showPassword, required: true },
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
    if (Object.keys(changes).length === 0) return
    // Owner decision 24 B (2026-10-21, ): creating an administrator asks the password or a code first, as deactivating
    // one does. main sent POST /users { level: 0 } with no question.
    if (changes.level !== undefined && changes.level !== null && Number(changes.level) === 0) {
      setConfirmAdminOpen(true)
      return
    }
    handleButtonAddClick()
  }

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
    // redesign UF-integration (decision 3, M-UF3): only the cropped photo goes with the creation; a cancelled crop attaches nothing
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
    // redesign UF-B4 (M-UF15): a leading zero survives, as in the profile and the Delivery copy
    setCellphoneStartZero && setCellphoneStartZero(cellphoneStartZero(rawNumber))
  }

  useEffect(() => {
    if (!isFromCustomOrder) {
      cleanFormState && cleanFormState({ changes: { level: defaultLevelType ?? 3 } })
    }
  }, [])

  useEffect(() => {
    if (defaultPhoneNumber) {
      handleChangePhoneNumber(defaultPhoneNumber, true)
    }
  }, [defaultPhoneNumber])

  // the answer of the API, as text (M-13): a string stays a string, a list shows each line, anything else the generic message
  const saveError = t('USER_SAVE_ERROR', 'We couldn\'t save the changes. Try again.')
  const apiLines = !formState?.loading && formState?.result?.error
    ? toAlertContent(formState.result?.result, saveError).map(line => translateApiMessage(t, line, line))
    : []

  const userTypes = userTypesValues({
    isPrimary: true,
    defaultUserType: defaultLevelType ?? 3,
    defaultUserTypesSelected,
    t
  })

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
          {showTitle && (
            <h1 className='odc-uf-title'>
              {t('USERS_REGISTER', 'New user')}
            </h1>
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
                      required
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
                  {!hideUserTypeSelector && (
                    <Field label={t('USER_TYPE', 'User type')}>
                      {/* the select re-reads `defaultValue` whenever it renders: it follows the level, so a choice stays */}
                      <FramedSelect
                        defaultValue={changes.level ?? defaultLevelType ?? 3}
                        placeholder={t('TYPE', 'Type')}
                        options={userTypes}
                        onChange={type => handleChangeUserType(type)}
                        isDisabled={Array.isArray(defaultUserTypesSelected)}
                      />
                    </Field>
                  )}
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
      <ConfirmAdmin
        open={confirmAdminOpen}
        title={t('USER_ADD_ADMIN_CONFIRM_TITLE', 'Add this administrator?')}
        description={t('USER_ADD_ADMIN_CONFIRM_BODY', 'Administrators can see and change everything in this project.')}
        otpDescription={t('USER_ADD_ADMIN_CONFIRM_BODY', 'Administrators can see and change everything in this project.')}
        confirmLabel={t('ADMINS_ADD', 'Add admin')}
        onClose={() => setConfirmAdminOpen(false)}
        onConfirm={() => {
          setConfirmAdminOpen(false)
          handleButtonAddClick()
        }}
      />
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

export const UserAddForm = (props) => {
  const UserAddProps = {
    ...props,
    useSessionUser: false,
    useValidationFields: true,
    UIComponent: UserAddFormUI
  }
  return (
    <UserFormDetailsController {...UserAddProps} />
  )
}
