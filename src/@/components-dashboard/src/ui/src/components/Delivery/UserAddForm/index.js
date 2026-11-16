import React, { useEffect, useMemo, useRef, useState } from 'react'

import {
  useLanguage,
  useSession,
  DragAndDrop,
  UserFormDetails as UserFormDetailsController
} from '../../../../../index'
import {
  Avatar,
  Button,
  Checkbox,
  Dialog,
  Field,
  InlineNotice,
  PasswordField,
  Skeleton,
  TextField,
  useFieldFrame
} from '../../Shared/Product'
import { PhoneField } from '../../Shared/Product/PhoneField'
import { FirstSelect } from '../../Shared/UI/FirstSelect'
import { ImageCrop } from '../../Shared/UI/ImageCrop'
import { SelectSurfaceContext } from '../../Shared/UI/selectPlacement'
import { Image as ImageIcon } from '../../Shared/Icon'
import { bytesConverter } from '../../../utils'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { timezones } from '../../../config/constants'
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

// redesign UF-B4 (decision 4, ): the Delivery add form (drivers, driver managers, delivery users) in Product.
// Same fields under the same conditions as main, same values to the controller, same tour hand-off; what changes is how it
// reads (labels, required marks, errors under their fields with the focus on the first, the API error in the form), the
// opt-in title (`showTitle`) and the driver groups as a checklist.

const FIT_TRIGGER = { fitTrigger: true } // the C18 select as wide as its field
const IMAGE_ACCEPT = 'image/png, image/jpeg, image/jpg'
const DIGITS_ONLY = /\D/g

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
    isDriversPage,
    isDriversManagersPage,
    handleChangeSwtich,
    driversGroupsState,
    selectedDriverGroupIds,
    handleDriverGroupClick,
    setCellphoneStartZero,
    showTitle = true // redesign UF-B4 (M-UF9): a host that already has a title turns it off
  } = props

  const [, t] = useLanguage()
  const { width } = useWindowSize()
  const [session] = useSession()

  const formRef = useRef(null)
  const fileRef = useRef(null)
  const photoButtonRef = useRef(null)
  const [phone, setPhone] = useState({ number: null, isValid: null })
  const [submitted, setSubmitted] = useState(false)
  const [timezoneSearchValue, setTimezoneSearchValue] = useState('')
  const [photoError, setPhotoError] = useState(null)
  const [cropState, setCropState] = useState({ name: null, data: null, open: false })

  const timezonesOptions = useMemo(() => timezones
    .filter(timezone => timezone.toLocaleLowerCase().includes(timezoneSearchValue.toLocaleLowerCase()))
    .map(timezone => ({ value: timezone, content: timezone })), [timezoneSearchValue])

  const showInputPhoneNumber = validationFields?.fields?.checkout?.cellphone?.enabled ?? false
  const changes = formState?.changes ?? {}
  const loadingFields = !!validationFields?.loading
  const fields = loadingFields ? [] : checkoutFields(validationFields, showField)
  const requiredLabel = t('REQUIRED', 'Required')
  const passwordRequired = !!isRequiredField('password')

  // What is wrong with what the form shows now; it reaches the fields only after the first submit.
  // The email is never required here (M-UF14 stays as in main: it is the owner's call, P-UF6).
  const validate = () => validateUserForm({
    t,
    fields,
    values: changes,
    isRequiredField,
    emailRequired: false,
    password: { value: changes.password, show: !isCheckout, required: passwordRequired },
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

  // This copy has its own phone rules: no `validation_phone_number_lib` reformatting (it never had it)
  const handleChangePhoneNumber = (number, isValid, rawNumber) => {
    setPhone(current => ({ ...current, number }))
    handleChangeInput(phoneToChanges(number, isValid), true)
    setCellphoneStartZero && setCellphoneStartZero(cellphoneStartZero(rawNumber))
  }

  // redesign UF-B4 (M-UF12): the digits of what is typed or pasted, the paste at the caret; what is stored is what is shown
  const handleExternalId = (value) => {
    handleChangeInput({ target: { name: 'external_id', value: value.replace(DIGITS_ONLY, '') } })
  }

  const handleExternalIdPaste = (event) => {
    event.preventDefault()
    const input = event.currentTarget
    const current = String(changes.external_id ?? '')
    const start = input.selectionStart ?? current.length
    const end = input.selectionEnd ?? start
    const digits = (event.clipboardData?.getData('text') ?? '').replace(DIGITS_ONLY, '')
    handleChangeInput({ target: { name: 'external_id', value: current.slice(0, start) + digits + current.slice(end) } })
    const caret = start + digits.length
    window.requestAnimationFrame(() => input.setSelectionRange?.(caret, caret))
  }

  useEffect(() => {
    if (isDriversPage) {
      cleanFormState && cleanFormState({ changes: { level: 4 } })
    } else if (isDriversManagersPage) {
      cleanFormState && cleanFormState({ changes: { level: 5 } })
    } else {
      cleanFormState && cleanFormState({ changes: { level: 3 } })
    }
  }, [isDriversPage, isDriversManagersPage])

  // the answer of the API, as text (M-13): a string stays a string, a list shows each line, anything else the generic message
  const saveError = t('USER_SAVE_ERROR', 'We couldn\'t save the changes. Try again.')
  const apiLines = !formState?.loading && formState?.result?.error
    ? toAlertContent(formState.result?.result, saveError).map(line => translateApiMessage(t, line, line))
    : []

  const title = isDriversPage
    ? t('NEW_DRIVER', 'New driver')
    : isDriversManagersPage
      ? t('NEW_DRIVER_MANAGER', 'New driver manager')
      : t('USERS_REGISTER', 'New user')
  const photoName = [changes.name, changes.lastname].filter(Boolean).join(' ')
  const showGroups = isDriversPage && session?.user?.level === 5
  const groups = driversGroupsState?.groups ?? []
  const selectedGroups = selectedDriverGroupIds ?? []

  return (
    <>
      <div className='odc-uf-add'>
        <form
          ref={formRef}
          className='odc-uf-form'
          onSubmit={handleSubmit}
          noValidate
          autoComplete='off'
          data-tour={width > 768 ? 'tour_fill' : ''}
        >
          {showTitle && (
            <h1 className='odc-uf-title'>
              {title}
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
          <div
            className='odc-uf-main'
            data-tour={width <= 768 ? 'tour_fill' : ''}
          >
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
                        required={field.code !== 'email' && isRequiredField(field.code)}
                        requiredLabel={requiredLabel}
                        error={errors[field.code]}
                        value={changes[field.code] ?? ''}
                        onChange={value => handleChangeInput({ target: { name: field.code, value: field.code === 'email' ? sanitizeEmail(value) : value } })}
                        autoComplete='off'
                      />
                    ))}
                    {isDriversPage && (
                      <>
                        <TextField
                          name='external_id'
                          label={t('EXTERNAL_ID', 'External ID')}
                          inputMode='numeric'
                          value={changes.external_id ?? ''}
                          onChange={handleExternalId}
                          onPaste={handleExternalIdPaste}
                          autoComplete='off'
                        />
                        <Field label={t('TIMEZONE', 'Timezone')}>
                          <FramedSelect
                            placeholder={t('SELECT_TIMEZONE', 'Select a timezone')}
                            defaultValue={changes.timezone}
                            options={timezonesOptions}
                            onChange={val => handleChangeSwtich('timezone', val)}
                            isShowSearchBar
                            searchValue={timezoneSearchValue}
                            handleChangeSearch={setTimezoneSearchValue}
                          />
                        </Field>
                      </>
                    )}
                    {!!showInputPhoneNumber && (
                      <PhoneField
                        label={t('PHONE_NUMBER', 'Phone number')}
                        countryLabel={t('COUNTRY_PHONE_CODE', 'Country phone code')}
                        value={phone.number}
                        setValue={handleChangePhoneNumber}
                        handleIsValid={isValid => setPhone(current => ({ ...current, isValid }))}
                      />
                    )}
                    {!isCheckout && (
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
                    {showGroups && (driversGroupsState?.loading || groups.length > 0) && (
                      <fieldset className='odc-uf-groups' aria-busy={driversGroupsState?.loading || undefined}>
                        <legend className='odc-uf-legend'>{t('USER_FORM_DRIVER_GROUPS', 'Driver groups')}</legend>
                        {driversGroupsState?.loading
                          ? [...Array(10).keys()].map(i => (
                            <div className='odc-uf-group-skeleton' aria-hidden='true' key={i}>
                              <Skeleton shape='box' size='var(--od-x-icon-md)' block='var(--od-x-icon-md)' />
                              <Skeleton size='40%' />
                            </div>
                            ))
                          : groups.map(group => (
                            <Checkbox
                              key={group.id}
                              checked={selectedGroups.includes(group.id)}
                              onCheckedChange={() => handleDriverGroupClick(group.id)}
                            >
                              {group?.name}
                            </Checkbox>
                          ))}
                      </fieldset>
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
          </div>
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
