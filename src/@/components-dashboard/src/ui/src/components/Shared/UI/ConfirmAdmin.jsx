import React, { useEffect, useId, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import parsePhoneNumber from 'libphonenumber-js'
import OtpInput from 'react-otp-input'
import {
  useLanguage,
  useSession,
  CheckPassword as CheckPasswordController
} from '../../../../../index'
import { useCountdownTimer } from '../../../hooks/useCountdownTimer'
import { formatSeconds } from '../../../utils/formatSeconds'
import { Alert } from '../Confirm'
import { InputPhoneNumber } from '../InputPhoneNumber'
// redesign fix-qa E5: the owner is a Product Dialog (brand title, footer, tabs) instead of the legacy
// Modal; the controller calls and the nested Alert are the ones it always had.
import { Button, Dialog, SegmentedControl } from '../Product'

import {
  WrapperCheckPassword,
  FormController,
  CountdownTimer,
  OtpWrapper,
  ResendCode
} from './confirm-admin-styles'

const ConfirmAdminUI = (props) => {
  const {
    checkPasswordStatus,
    getCheckPassword,
    // when the caller names the action (and ConfirmAdmin was wired with a `targetId` too, for
    // user-targeted actions) the password/code is checked server-side and `onConfirm` gets the one-time
    // `confirmation_token` to send with the protected request. No `action` keeps the legacy behavior: the
    // password check has nothing to carry, and the code is handed over unverified, as today.
    action,
    confirmActionStatus = { result: null, loading: false, error: null },
    confirmAction,
    open,
    onClose,
    onConfirm,
    // redesign fix-qa E5: optional copy from the consumer ("Delete 3 orders?" and what it means).
    // Without them the dialog reads exactly as it always did: «Confirm password», no description.
    title,
    description,
    // redesign tramo A r3 (W0-QA1-10): the same sentence for when a code is chosen instead of the password (optional).
    otpDescription: consumerOtpDescription,
    // redesign F6d (Q3-13, C8): optional verb-with-object for the final button («Delete order»). Opt-in: without it
    // the button says «Confirm» as it always did, for every other caller.
    confirmLabel,
    size = 'md',

    confirmTab,
    otpType,
    setOtpType,
    handleChangeTab,
    setOtpState,
    otpState,
    generateOtpCode,

    checkCodeState,
    handleChangeInput,
    handleChangeCredentials,
    setCellphoneStartZero
  } = props

  const [, t] = useLanguage()
  const [{ user }] = useSession()
  const { handleSubmit, register, errors } = useForm()
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [willVerifyOtpState, setWillVerifyOtpState] = useState(false)
  const [userPhoneNumber, setUserPhoneNumber] = useState(null)
  const [isValidPhoneNumber, setIsValidPhoneNumber] = useState('')
  const formId = useId()
  const passwordId = useId()
  const emailId = useId()
  const formRef = useRef(null)
  // The element that had the focus when the confirmation opened: it gets it back when this unmounts
  // (the wrapper unmounts the whole controller on close, so Base UI never plays its own return).
  const [opener] = useState(() => (typeof document === 'undefined' ? null : document.activeElement))
  useEffect(() => () => {
    if (opener?.isConnected && (!document.activeElement || document.activeElement === document.body)) opener.focus?.()
  }, [])

  const numOtpInputs = confirmTab === 'otp' ? 6 : 4
  const otpPlaceholder = [...Array(numOtpInputs)].fill(0).join('')
  const [otpLeftTime, , resetOtpLeftTime] = useCountdownTimer(600, !checkCodeState?.loading && willVerifyOtpState)

  const handleChangeOtpType = (type) => {
    setWillVerifyOtpState(false)
    handleChangeTab('otp')
    setOtpType(type)
  }

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
    setOtpState('')
  }

  const handleChangePhoneNumber = (number, isValid, rawNumber) => {
    setUserPhoneNumber(number)
    let phoneNumberParser = null
    let values = { country_phone_code: '', cellphone: '' }

    if (isValid) {
      phoneNumberParser = parsePhoneNumber(number)
    }
    if (phoneNumberParser) {
      values = {
        country_phone_code: phoneNumberParser.countryCallingCode,
        cellphone: phoneNumberParser.nationalNumber
      }
    }
    setCellphoneStartZero && setCellphoneStartZero(rawNumber?.number && rawNumber?.countryCallingCode ? rawNumber?.number : null)
    handleChangeCredentials(values)
  }

  const handleSendOtp = () => {
    if (willVerifyOtpState) {
      setOtpState('')
      resetOtpLeftTime()
      if (confirmTab === 'otp') {
        generateOtpCode()
        setWillVerifyOtpState(true)
      }
    }
  }

  const onSubmit = () => {
    if (confirmTab === 'otp' && otpType === 'cellphone') {
      const isPhoneNumberValid = userPhoneNumber ? isValidPhoneNumber : true
      if (!userPhoneNumber) {
        setAlertState({
          open: true,
          content: [t('VALIDATION_ERROR_MOBILE_PHONE_REQUIRED', 'The field Phone Number is required.')]
        })
        return
      }
      if (!isPhoneNumberValid && userPhoneNumber) {
        setAlertState({
          open: true,
          content: [t('PHONE_NUMBER_IS_NOT_VALID', 'Phone number is not valid')]
        })
        return
      }
    }
    if (confirmTab === 'password') {
      getCheckPassword()
    }
    if (confirmTab === 'otp') {
      generateOtpCode()
      setWillVerifyOtpState(true)
    }
  }

  useEffect(() => {
    if (otpState?.length === numOtpInputs) {
      if (confirmTab === 'otp') {
        // with an `action`, the code is checked server-side (confirmAction below resolves it
        // into confirmActionStatus); without one, it is handed to the caller unverified, as today.
        if (action) {
          confirmAction(otpState)
        } else {
          onConfirm(otpState)
        }
      }
    }
  }, [otpState])

  useEffect(() => {
    if (checkPasswordStatus.error) {
      setAlertState({
        open: true,
        content: checkPasswordStatus.error
      })
      return
    }
    if (checkPasswordStatus.result === 'OK') {
      onConfirm()
    }
  }, [checkPasswordStatus.error, checkPasswordStatus.result])

  // the server-checked path (password or code, both go through `confirmAction`). An error shows in
  // the same Alert as the legacy path; success hands the one-time confirmation_token to the caller.
  useEffect(() => {
    if (!action) return
    if (confirmActionStatus.error) {
      setAlertState({
        open: true,
        content: confirmActionStatus.error
      })
      return
    }
    if (confirmActionStatus.result) {
      onConfirm(confirmActionStatus.result.confirmation_token)
    }
  }, [action, confirmActionStatus.error, confirmActionStatus.result])

  useEffect(() => {
    if (checkCodeState?.result?.error) {
      setAlertState({
        open: true,
        content: checkCodeState?.result?.error || [t('ERROR', 'Error')]
      })
    } else if (checkCodeState?.result?.result) {
      setAlertState({
        open: true,
        content: t('CODE_SENT', 'The code has been sent')
      })
      resetOtpLeftTime()
    }
  }, [checkCodeState])

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      setAlertState({
        open: true,
        content: Object.values(errors).map((error) => error.message)
      })
    }
  }, [errors])

  useEffect(() => {
    const _credentials = {}
    if (user) {
      if (user?.cellphone) {
        let phone = null
        if (user?.cellphone && user?.country_phone_code) {
          phone = `+${user?.country_phone_code} ${user?.cellphone}`
          _credentials.country_phone_code = user.country_phone_code
          _credentials.cellphone = user.cellphone
        } else if (user?.country_phone_code) {
          phone = `+${user?.country_phone_code} ${user?.cellphone}`
          _credentials.country_phone_code = user.country_phone_code
          _credentials.cellphone = user?.cellphone
        } else {
          phone = user?.cellphone
          _credentials.cellphone = user?.cellphone
        }
        setUserPhoneNumber(phone)
      }
      if (user?.email) {
        _credentials.email = user?.email
      }
      handleChangeCredentials(_credentials)
    }
  }, [user])

  const confirmMethod = confirmTab === 'password' ? 'password' : otpType
  // redesign tramo A r3 (W0-QA1-10): the consumer's description is written for the password («Type your password to confirm…»).
  // With a code chosen it says to type the code instead; a consumer can bring its own words (`otpDescription`).
  const otpDescription = description
    ? (consumerOtpDescription ?? t('CONFIRM_ADMIN_OTP_DESCRIPTION', 'Enter the verification code to confirm. This can’t be undone.'))
    : description

  const handleChangeMethod = (method) => {
    if (method === 'password') {
      setWillVerifyOtpState(false)
      handleChangeTab('password')
      return
    }
    handleChangeOtpType(method)
  }

  return (
    open
      ? (
        <>
          <Dialog
            open={open}
            onOpenChange={(next) => { if (!next) onClose() }}
            size={size}
            title={title || t('CONFIRM_PASSWORD', 'Confirm password')}
            description={confirmTab === 'otp' ? otpDescription : description}
            closeLabel={t('CLOSE', 'Close')}
            // The field is where the user types; the first tabbable one would be the method toggle.
            initialFocus={() => formRef.current?.querySelector('input:not([type="hidden"])') ?? true}
            footer={(
              <>
                <Button onClick={() => onClose()}>{t('CANCEL', 'Cancel')}</Button>
                {!willVerifyOtpState && (
                  <Button
                    variant={confirmTab === 'otp' ? 'primary' : 'danger'}
                    type='submit'
                    form={formId}
                    busy={!!checkPasswordStatus.loading || !!confirmActionStatus.loading}
                    disabled={!!checkPasswordStatus.loading || !!confirmActionStatus.loading}
                  >
                    {(checkPasswordStatus.loading || confirmActionStatus.loading)
                      ? t('LOADING', 'Loading')
                      : confirmTab === 'otp'
                        ? t('GET_VERIFY_CODE', 'Get verify code')
                        : (confirmLabel || t('CONFIRM', 'Confirm'))}
                  </Button>
                )}
              </>
            )}
          >
            <WrapperCheckPassword
              id={formId}
              ref={formRef}
              onSubmit={handleSubmit(onSubmit)}
            >
              <SegmentedControl
                label={t('CONFIRMATION_METHOD', 'Confirmation method')}
                value={confirmMethod}
                onValueChange={handleChangeMethod}
                options={[
                  // segment labels in sentence case, no loose «by» and no «Otp» (the phone code goes by SMS, channel 2)
                  { value: 'password', label: t('BY_PASSWORD', 'Password') },
                  { value: 'email', label: t('BY_OTP_EMAIL', 'Email code') },
                  { value: 'cellphone', label: t('BY_OTP_PHONE', 'SMS code') }
                ]}
              />
              {confirmTab === 'password' && (
                <FormController>
                  <label htmlFor={passwordId}>{t('PASSWORD', 'Password')}</label>
                  <input
                    id={passwordId}
                    className='od-confirm-admin-input'
                    type='password'
                    name='password'
                    // neutral, the dialog also confirms activating or deactivating an admin, not only deletes
                    placeholder={t('TYPE_YOUR_PASSWORD_TO_CONFIRM', 'Type your password to confirm.')}
                    ref={register({
                      required: t(
                        'VALIDATION_ERROR_REQUIRED',
                        'Password is required'
                      ).replace('_attribute_', t('PASSWORD', 'Password'))
                    })}
                    onChange={(e) => handleChangeInput(e)}
                    autoComplete='off'
                    autoCapitalize='off'
                  />
                </FormController>
              )}
              {!willVerifyOtpState && confirmTab === 'otp' && otpType === 'email' && (
                <FormController>
                  <label htmlFor={emailId}>{t('EMAIL', 'Email')}</label>
                  <input
                    id={emailId}
                    className='od-confirm-admin-input'
                    type='email'
                    name='email'
                    placeholder={t('EMAIL', 'Email')}
                    defaultValue={user?.email}
                    ref={register({
                      required: t(
                        'VALIDATION_ERROR_REQUIRED',
                        'Email is required'
                      ).replace('_attribute_', t('EMAIL', 'Email')),
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: t(
                          'VALIDATION_ERROR_EMAIL',
                          'Invalid email address'
                        ).replace('_attribute_', t('EMAIL', 'Email'))
                      }
                    })}
                    onChange={(e) => handleChangeInput(e)}
                    autoComplete='off'
                    autoCapitalize='off'
                  />
                </FormController>
              )}
              {!willVerifyOtpState && confirmTab === 'otp' && otpType === 'cellphone' && (
                <FormController>
                  <InputPhoneNumber
                    isUser
                    user={user}
                    value={userPhoneNumber}
                    setValue={handleChangePhoneNumber}
                    handleIsValid={setIsValidPhoneNumber}
                  />
                </FormController>
              )}
              {willVerifyOtpState && !checkCodeState?.loading && (
                <>
                  <CountdownTimer>
                    <span>{formatSeconds(otpLeftTime)}</span>
                  </CountdownTimer>

                  <OtpWrapper>
                    <OtpInput
                      value={otpState}
                      onChange={otp => setOtpState(otp)}
                      numInputs={numOtpInputs}
                      containerStyle='otp-container'
                      inputStyle='otp-input'
                      placeholder={otpPlaceholder}
                      isInputNum
                      shouldAutoFocus
                      isDisabled={otpLeftTime === 0 || !!confirmActionStatus.loading}
                    />
                  </OtpWrapper>
                  <ResendCode
                    disabled={otpLeftTime > 520}
                    onClick={handleSendOtp}
                  >
                    {t('RESEND_AGAIN', 'Resend again')}?
                  </ResendCode>
                  {/* What the old in-body «Cancel» did: back to asking for the code. Cancel is the footer's. */}
                  <Button
                    variant='ghost'
                    className='od-confirm-admin-back'
                    onClick={() => {
                      setWillVerifyOtpState(false)
                    }}
                  >
                    {t('BACK', 'Back')}
                  </Button>
                </>
              )}
            </WrapperCheckPassword>
          </Dialog>

          <Alert
            title={t('WEB_APPNAME', 'Ordering.co')}
            content={alertState.content}
            acceptText={t('ACCEPT')}
            open={alertState.open}
            onClose={() => closeAlert()}
            onAccept={() => closeAlert()}
            closeOnBackdrop={false}
          />
        </>
        )
      : null
  )
}

export const ConfirmAdmin = (props) => {
  // with an `action`, the proof is checked by POST /users/confirm_action (api-core#3615)
  const checkPasswordControlProps = {
    ...props,
    UIComponent: ConfirmAdminUI
  }
  return (
    <>
      {props.open && (
        <CheckPasswordController {...checkPasswordControlProps} />
      )}
    </>
  )
}
