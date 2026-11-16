import React, { useEffect, useRef, useState } from 'react'
import { useConfig, useLanguage } from '../../../../../index'
import { UserFormDetails as UserFormDetailsController } from '../../../../../components/UserFormDetails'
import { cellphoneStartZero, fieldLabel, phoneToChanges, profileApiErrorText, sanitizeEmail, userPhoneText } from '../../../../../utils/userForm'
import { Button, InlineNotice, PasswordField, TextField } from '../../Shared/Product'
import { PhoneField } from '../../Shared/Product/PhoneField'

// P12 (D-15): the session user's own name, last name, email, phone and password, on Product pieces only. The Users form
// would bring legacy residue to /profile (FirstSelect, ConfirmAdmin, ImageCrop; scripts/redesign/residue-baseline.json). No user type:
// api-core refuses a self edit that sends `level`. shortcut: no photo, since every crop (ImageField too) is still ImageCrop; add it
// when the crop has no legacy pieces.

const ProfileEditFormUI = (props) => {
  const { formState, userState, handleChangeInput, handleButtonUpdateClick, setCellphoneStartZero } = props
  const [, t] = useLanguage()
  const [{ configs }] = useConfig()
  const user = userState?.result?.result
  const changes = formState?.changes ?? {}
  const [phoneText, setPhoneText] = useState(() => userPhoneText(user, formState))
  const [saved, setSaved] = useState(false)
  const wasLoading = useRef(false)

  useEffect(() => {
    if (formState?.loading) {
      wasLoading.current = true
      setSaved(false)
      return
    }
    if (!wasLoading.current) return
    wasLoading.current = false
    setSaved(!formState?.result?.error)
  }, [formState?.loading])

  const valueOf = (code) => changes[code] ?? user?.[code] ?? ''
  const change = (name, value) => {
    setSaved(false)
    handleChangeInput({ target: { name, value } })
  }
  const handleChangePhone = (number, isValid, rawNumber) => {
    setPhoneText(number)
    setCellphoneStartZero(cellphoneStartZero(rawNumber))
    handleChangeInput(phoneToChanges(number, isValid, { validationPhoneNumberLib: configs?.validation_phone_number_lib?.value }), true)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (formState?.loading || Object.keys(changes).length === 0) return
    // an emptied phone is cleared, as the Users form does
    handleButtonUpdateClick(user?.cellphone && !phoneText ? { country_phone_code: '', cellphone: '' } : null)
  }

  const error = formState?.result?.error && !formState?.loading ? profileApiErrorText(t, formState.result.result) : null

  return (
    <form className='odc-root odc-profile-form' noValidate onSubmit={handleSubmit}>
      {[['name', 'Name'], ['lastname', 'Last name']].map(([code, name]) => (
        <TextField
          key={code}
          name={code}
          label={fieldLabel(t, { code, name })}
          value={valueOf(code)}
          onChange={(value) => change(code, value)}
        />
      ))}
      <TextField
        name='email'
        type='email'
        label={t('EMAIL', 'Email')}
        value={valueOf('email')}
        onChange={(value) => change('email', sanitizeEmail(value))}
      />
      <PhoneField
        label={t('PHONE_NUMBER', 'Phone number')}
        countryLabel={t('USER_FORM_PHONE_COUNTRY', 'Phone number country')}
        user={user}
        value={phoneText}
        setValue={handleChangePhone}
        isUser
      />
      <PasswordField
        name='password'
        label={t('PASSWORD', 'Password')}
        hint={t('USER_FORM_PASSWORD_KEEP_HINT', 'Leave empty to keep the current password.')}
        showLabel={t('SHOW_PASSWORD', 'Show password')}
        hideLabel={t('HIDE_PASSWORD', 'Hide password')}
        value={changes.password ?? ''}
        autoComplete='new-password'
        onChange={(value) => change('password', value)}
      />
      {error && <InlineNotice tone='danger' role='alert'>{error}</InlineNotice>}
      {saved && <InlineNotice tone='info'>{t('SAVED', 'Saved')}</InlineNotice>}
      <div className='odc-profile-form-actions'>
        <Button type='submit' variant='primary' busy={!!formState?.loading}>{t('SAVE_CHANGES', 'Save changes')}</Button>
      </div>
    </form>
  )
}

export const ProfileEditForm = ({ user }) => (
  <UserFormDetailsController UIComponent={ProfileEditFormUI} user={user} userData={user} useSessionUser />
)
