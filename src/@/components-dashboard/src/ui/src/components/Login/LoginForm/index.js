import React, { useState, useEffect, useContext, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import parsePhoneNumber from 'libphonenumber-js'
import OtpInput from 'react-otp-input'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'
import {
  LoginForm as LoginFormController,
  ReCaptcha,
  useLanguage,
  useApi,
  useConfig
} from '../../../../../index'
import { useCountdownTimer } from '../../../hooks/useCountdownTimer'
import { InputPhoneNumber } from '../../Shared/InputPhoneNumber'
import { SpinnerLoader } from '../../Shared/SpinnerLoader'
import { formatSeconds, getOrderingSubdomains } from '../../../utils'
import { recaptchaTypeAllowsV2, recaptchaTypeAllowsV3 } from '../../../../../utils/settingsCustomSections'

import { AuthLayout } from '../AuthLayout'
import { ApiErrorNotice, FieldError, apiErrorMessages, asMessages, focusFirstError, translateFormMessage } from '../AuthLayout/FormFeedback'
import {
  FormInput,
  Field,
  TextInput,
  RedirectLink,
  SignupLink,
  Divider,
  TitleFormSide,
  AuthNotice,
  InputWithIcon,
  WrapperPassword,
  TogglePassword,
  ReCAPTCHAWrapper,
  Tabs,
  Tab,
  PrimaryButton,
  SecondaryButton,
  OtpHeader,
  CountdownTimer,
  OtpWrapper,
  ResendCode,
  PhoneNumberWrapper
} from '../AuthLayout/styles'
import { ArrowRightIcon, EyeIcon, EyeOffIcon, FolderIcon, LockIcon, MailIcon, PhoneIcon } from '../AuthLayout/icons'
import { getDashboardStorageKey } from '~/utils/local-tenant'
import { captureDashboardLoginValidation, getLoginAnalyticsAction } from '~/analytics/posthog'

// The shortest password the login form accepts (the rule below and the message that names it).
const PASSWORD_MIN_LENGTH = 5

// The fields that can fail validation, in the order they are on the page (the first one with an error takes the focus), and the id
// of the control of each one.
const FIELD_ORDER = [
  ['project', 'login-project'],
  ['email', 'login-email'],
  ['cellphone', 'login-cellphone'],
  ['password', 'login-password']
]

const LoginFormUI = (props) => {
  const {
    useLoginOtpEmail,
    useLoginOptCellphone,
    useLoginByCellphone,
    handleChangeInput,
    handleButtonLoginClick,
    handleCancelLogin,
    elementLinkToSignup,
    elementLinkToForgotPassword,
    formState,
    loginTab,
    isPopup,
    isReCaptchaEnable,
    handleReCaptcha,
    useProjectDomain,
    checkPhoneCodeState,
    otpType,
    setOtpType,
    handleChangeTab,
    generateOtpCode,
    otpState,
    setOtpState,
    useLoginByEmail,
    handleChangeCredentials,
    credentials,
    setCellphoneStartZero,
    notice
  } = props
  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ configs, loading }] = useConfig()
  // The first field with an error takes the focus in visual order (focusFirstError); the library would use registration order.
  const { handleSubmit, register, errors, control } = useForm({ shouldFocusError: false })
  const [configFile, setConfigFile] = useContext(ConfigFileContext)

  // what the API (or the OTP step) answered, as the messages of the form notice. Validation errors are not here:
  // they come from react-hook-form and live next to their field.
  const [apiMessages, setApiMessages] = useState([])
  const [focusedMethod, setFocusedMethod] = useState(null)
  const [reCaptchaVersion, setRecaptchaVersion] = useState({ version: 'v3', siteKey: '' })
  const [submitted, setSubmitted] = useState(false)
  const [passwordSee, setPasswordSee] = useState(false)
  const [loginWithOtpState, setLoginWithOtpState] = useState(false)
  const [willVerifyOtpState, setWillVerifyOtpState] = useState(false)
  const projectTimer = useRef(null)
  const submittedProject = useRef(null)
  const submitRef = useRef(null)
  const attemptedRef = useRef(false)

  const numOtpInputs = loginTab === 'otp' ? 6 : 4
  const otpPlaceholder = [...Array(numOtpInputs)].fill(0).join('')
  const [otpLeftTime, , resetOtpLeftTime] = useCountdownTimer(
    600, !checkPhoneCodeState?.loading && willVerifyOtpState)

  const isOtpEmail = loginTab === 'otp' && otpType === 'email'
  const isOptCellphone = loginTab === 'otp' && otpType === 'cellphone'
  const isOrderingSubdomain = getOrderingSubdomains()
  const whiteLabelSubdomainValidation = !configFile?.local_project_pin && (!useProjectDomain || (useProjectDomain && isOrderingSubdomain))

  // The notice and the field errors say what the modal said (AuthLayout/FormFeedback).
  const translateMessage = (message) => translateFormMessage(t, message)

  const clearApiMessages = () => setApiMessages((current) => (current.length ? [] : current))

  // Typing a credential is the correction of what the API refused: its notice goes, as the modal did when it was closed.
  const handleInput = (event) => {
    clearApiMessages()
    handleChangeInput(event)
  }

  const onInvalid = (fieldErrors) => {
    captureDashboardLoginValidation({ action: getLoginAnalyticsAction(loginTab), projectCode: ordering.project, validationCode: 'form_invalid' })
    clearApiMessages()
    focusFirstError(FIELD_ORDER, fieldErrors)
  }

  const onSubmit = (values) => {
    clearApiMessages()
    attemptedRef.current = true
    if (useLoginOptCellphone && loginTab === 'otp' && otpType === 'cellphone' && !credentials?.country_phone_code && !credentials?.cellphone) {
      captureDashboardLoginValidation({ action: getLoginAnalyticsAction(loginTab), projectCode: ordering.project, validationCode: 'phone_invalid' })
      setApiMessages([t('PHONE_NUMBER_IS_NOT_VALID', 'Phone number is not valid')])
      return
    }
    const project = values?.project?.replace(/\s/g, '') || ordering.project
    clearTimeout(projectTimer.current)
    projectTimer.current = null
    submittedProject.current = project
    if (project !== ordering.project) setConfigFile({ ...configFile, project })
    setSubmitted(true)
  }

  const hanldeChangeProject = (project) => {
    clearApiMessages()
    handleCancelLogin?.('superseded')
    clearTimeout(projectTimer.current)
    setSubmitted(false)
    submittedProject.current = null
    projectTimer.current = setTimeout(function () {
      setConfigFile({ ...configFile, project })
      projectTimer.current = null
    }, 750)
  }

  const handleChangeOtpType = (type) => {
    clearApiMessages()
    handleChangeTab('otp')
    setOtpType(type)
  }

  const handleSendOtp = () => {
    clearApiMessages()
    if (willVerifyOtpState) {
      setOtpState('')
      resetOtpLeftTime()
      if (loginTab === 'otp') {
        generateOtpCode()
        setWillVerifyOtpState(true)
      }
    }
  }

  const handleChangePhoneNumber = (number, isValid, rawNumber) => {
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
    clearApiMessages()
    handleChangeCredentials(values)
  }

  useEffect(() => {
    try {
      const user = localStorage.getItem(getDashboardStorageKey(configFile, 'user'))
      if (user) {
        const userData = JSON.parse(user)
        if (userData?.level === 5 && userData?.id) {
          const storageKey = getDashboardStorageKey(configFile, `drivers_cache_${userData.id}`)
          localStorage.removeItem(storageKey)
        }
      }
    } catch (error) {
      console.error('Error clearing driver cache on login:', error)
    }
  }, [])

  useEffect(() => {
    if (ordering.project === null || !submitted || ordering.project !== submittedProject.current) return
    if (loginTab === 'otp') {
      generateOtpCode()
      setWillVerifyOtpState(true)
    } else {
      handleButtonLoginClick()
    }
    submittedProject.current = null
    setSubmitted(false)
  }, [ordering.project, submitted])

  useEffect(() => () => clearTimeout(projectTimer.current), [])

  // an answer of the API (or the OTP step) that is not a field's error goes to the notice above the submit button.
  // The old modal reset the code when it was accepted; the code is reset when the answer arrives, so the user can type it again.
  const showApiMessages = (content) => {
    setApiMessages(asMessages(content))
    setOtpState('')
    // A button that was disabled while it loaded can lose the focus: it comes back to where the user pressed, so it is not lost.
    // A field the user already moved to is left alone.
    const active = document.activeElement
    if (attemptedRef.current && submitRef.current && (!active || active === document.body || active === submitRef.current)) {
      submitRef.current.focus()
    }
    attemptedRef.current = false
  }

  useEffect(() => {
    if (formState.loading) {
      clearApiMessages()
      return
    }
    if (formState.result?.error) {
      if (formState.result?.result?.[0] === 'ERROR_AUTH_VERIFICATION_CODE') {
        setRecaptchaVersion({ version: 'v2', siteKey: configs?.security_recaptcha_site_key?.value })
        showApiMessages([t('TRY_AGAIN', 'Please try again')])
        setSubmitted(false)
        return
      }
      showApiMessages(apiErrorMessages(t, formState.result?.result))
      setSubmitted(false)
    }
  }, [formState])

  useEffect(() => {
    if (otpState?.length === numOtpInputs) {
      if (loginTab === 'otp') {
        handleButtonLoginClick()
      }
    }
  }, [otpState])

  useEffect(() => {
    if (checkPhoneCodeState?.result?.error) {
      showApiMessages(apiErrorMessages(t, checkPhoneCodeState?.result?.result))
    } else if (checkPhoneCodeState?.result?.result) {
      resetOtpLeftTime()
    }
  }, [checkPhoneCodeState])

  useEffect(() => {
    if (otpLeftTime === 0) {
      showApiMessages(t('TIME_IS_UP_PLEASE_RESEND_CODE', 'Time is up. Please resend code again'))
    }
  }, [otpLeftTime])

  useEffect(() => {
    if (configs && Object.keys(configs).length > 0 && configs?.security_recaptcha_auth?.value === '1') {
      const recaptchaType = configs?.security_recaptcha_type?.value
      if (recaptchaTypeAllowsV3(recaptchaType) &&
        configs?.security_recaptcha_score_v3?.value > 0 &&
        configs?.security_recaptcha_site_key_v3?.value
      ) {
        setRecaptchaVersion({ version: 'v3', siteKey: configs?.security_recaptcha_site_key_v3?.value })
        return
      }
      if (recaptchaTypeAllowsV2(recaptchaType) && configs?.security_recaptcha_site_key?.value) {
        setRecaptchaVersion({ version: 'v2', siteKey: configs?.security_recaptcha_site_key?.value })
      }
    }
  }, [configs])

  // A2: the sign-in methods, in the order they are on the page. One group, one Tab stop (a roving tabindex): the chosen method
  // (the first one when none is chosen) while the focus is outside, the focused one while it is inside.
  const methodTabs = [
    useLoginByEmail && { key: 'email', label: t('PASSWORD', 'Password'), active: loginTab === 'email', onSelect: () => handleChangeTab('email') },
    useLoginOtpEmail && { key: 'otp-email', label: t('EMAIL_CODE', 'Email code'), active: isOtpEmail, onSelect: () => handleChangeOtpType('email') },
    useLoginOptCellphone && { key: 'otp-cellphone', label: t('PHONE_CODE', 'Phone code'), active: isOptCellphone, onSelect: () => handleChangeOtpType('cellphone') },
    useLoginByCellphone && { key: 'cellphone', label: t('PHONE_NUMBER', 'Phone number'), active: loginTab === 'cellphone', onSelect: () => handleChangeTab('cellphone') }
  ].filter(Boolean)
  const methodStop = methodTabs.some(method => method.key === focusedMethod)
    ? focusedMethod
    : (methodTabs.find(method => method.active) || methodTabs[0])?.key

  // The arrows (inverted in RTL), Home and End move the focus around the group and wrap; Space and Enter choose, as on any button.
  const handleMethodKeyDown = (event) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (!keys.includes(event.key)) return
    const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')]
    const index = buttons.indexOf(event.target.closest('button'))
    if (index === -1) return
    const step = window.getComputedStyle(event.currentTarget).direction === 'rtl' ? -1 : 1
    const target = {
      ArrowRight: (index + step + buttons.length) % buttons.length,
      ArrowLeft: (index - step + buttons.length) % buttons.length,
      Home: 0,
      End: buttons.length - 1
    }[event.key]
    event.preventDefault()
    buttons[target].focus()
  }

  // a message under its field only while that field is on the page; any other error goes to the notice.
  const fieldShown = {
    project: !willVerifyOtpState && whiteLabelSubdomainValidation,
    email: !willVerifyOtpState && (loginTab === 'email' || (loginTab === 'otp' && otpType === 'email')),
    cellphone: useLoginByCellphone && loginTab === 'cellphone' && !willVerifyOtpState,
    password: loginTab !== 'otp' && !willVerifyOtpState
  }
  const fieldError = (name) => (fieldShown[name] ? translateMessage(errors?.[name]?.message) : undefined)
  const noticeMessages = [
    ...Object.entries(errors).filter(([name]) => !fieldShown[name]).map(([, error]) => error?.message).filter(Boolean),
    ...apiMessages
  ]

  const submitLabel = formState.loading
    ? t('SIGNING_IN', 'Signing in…')
    : loginWithOtpState || loginTab === 'otp'
      ? t('SEND_CODE', 'Send code')
      : t('SIGN_IN', 'Sign in')

  return (
    <>
      {useProjectDomain && loading && !isOrderingSubdomain && (
        <SpinnerLoader />
      )}
      {(((useProjectDomain && !loading) || isOrderingSubdomain) || !useProjectDomain) && (
        <AuthLayout isPopup={isPopup}>
              {notice && <AuthNotice role='note'>{notice}</AuthNotice>}
              <TitleFormSide>
                <h1>{t('LOGIN_PAGE_TITLE', 'Sign in to your dashboard')}</h1>
                <p>
                  {configFile?.local_project_pin
                    ? <>{t('PROJECT', 'Project')}: <strong>{configFile.local_project_pin}</strong></>
                    : t('LOGIN_PAGE_SUBTITLE', 'Enter your project and account to continue.')}
                </p>
              </TitleFormSide>

              {ordering?.project && methodTabs.length > 1 && !willVerifyOtpState && (
                <Tabs
                  role='group'
                  aria-label={t('SIGN_IN_METHOD', 'Sign-in method')}
                  onKeyDown={handleMethodKeyDown}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) setFocusedMethod(null)
                  }}
                >
                  {methodTabs.map((method) => (
                    <Tab
                      key={method.key}
                      type='button'
                      aria-pressed={method.active}
                      $active={method.active}
                      tabIndex={method.key === methodStop ? 0 : -1}
                      onFocus={() => setFocusedMethod(method.key)}
                      onClick={() => {
                        clearApiMessages()
                        method.onSelect()
                      }}
                    >
                      {method.label}
                    </Tab>
                  ))}
                </Tabs>
              )}

              <FormInput
                noValidate
                onSubmit={handleSubmit(onSubmit, onInvalid)}
              >
                {fieldShown.project && (
                  <Field>
                    <label htmlFor='login-project'>{t('PROJECT', 'Project')}</label>
                    <InputWithIcon>
                      <Controller
                        name='project'
                        control={control}
                        rules={{
                          required: t('VALIDATION_ERROR_PROJECT_REQUIRED', 'Project is required')
                        }}
                        render={({ onChange, value }) => (
                          <TextInput
                            id='login-project'
                            type='text'
                            value={value}
                            aria-invalid={fieldError('project') ? 'true' : undefined}
                            aria-describedby={fieldError('project') ? 'login-project-error' : undefined}
                            onChange={(e) => {
                              const project = e.target.value.replace(/\s/g, '')
                              onChange(project)
                              hanldeChangeProject(project)
                            }}
                            autoComplete='off'
                            autoCapitalize='off'
                            spellCheck='false'
                          />
                        )}
                        defaultValue=''
                      />
                      <FolderIcon />
                    </InputWithIcon>
                    {fieldError('project') && <FieldError id='login-project-error'>{fieldError('project')}</FieldError>}
                  </Field>
                )}

                {fieldShown.email && (
                  <Field>
                    <label htmlFor='login-email'>{t('EMAIL', 'Email')}</label>
                    <InputWithIcon>
                      <TextInput
                        id='login-email'
                        type='email'
                        name='email'
                        aria-invalid={fieldError('email') ? 'true' : undefined}
                        aria-describedby={fieldError('email') ? 'login-email-error' : undefined}
                        ref={register({
                          required: t('AUTH_EMAIL_REQUIRED', 'Email is required'),
                          pattern: {
                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                            message: t(
                              'VALIDATION_ERROR_EMAIL',
                              'Invalid email address'
                            ).replace('_attribute_', t('EMAIL', 'Email'))
                          }
                        })}
                        onChange={handleInput}
                        autoComplete='username'
                        autoCapitalize='off'
                        spellCheck='false'
                      />
                      <MailIcon />
                    </InputWithIcon>
                    {fieldError('email') && <FieldError id='login-email-error'>{fieldError('email')}</FieldError>}
                  </Field>
                )}
                {fieldShown.cellphone && (
                  <Field>
                    <label htmlFor='login-cellphone'>{t('PHONE_NUMBER', 'Phone number')}</label>
                    <InputWithIcon>
                      <TextInput
                        id='login-cellphone'
                        type='tel'
                        name='cellphone'
                        aria-invalid={fieldError('cellphone') ? 'true' : undefined}
                        aria-describedby={fieldError('cellphone') ? 'login-cellphone-error' : undefined}
                        ref={register({
                          required: t('AUTH_PHONE_NUMBER_REQUIRED', 'Phone number is required')
                        })}
                        onChange={handleInput}
                        autoComplete='tel'
                      />
                      <PhoneIcon />
                    </InputWithIcon>
                    {fieldError('cellphone') && <FieldError id='login-cellphone-error'>{fieldError('cellphone')}</FieldError>}
                  </Field>
                )}
                {!willVerifyOtpState && useLoginOptCellphone && loginTab === 'otp' && otpType === 'cellphone' && (
                  <Field>
                    <label>{t('PHONE_NUMBER', 'Phone number')}</label>
                    <PhoneNumberWrapper>
                      <InputPhoneNumber
                        setValue={handleChangePhoneNumber}
                      />
                    </PhoneNumberWrapper>
                  </Field>
                )}

                {fieldShown.password && (
                  <Field>
                    <label htmlFor='login-password'>{t('PASSWORD', 'Password')}</label>
                    <WrapperPassword>
                      <TextInput
                        id='login-password'
                        type={!passwordSee ? 'password' : 'text'}
                        name='password'
                        aria-invalid={fieldError('password') ? 'true' : undefined}
                        aria-describedby={fieldError('password') ? 'login-password-error' : undefined}
                        ref={register({
                          required: t('AUTH_PASSWORD_REQUIRED', 'Password is required'),
                          // the message tells the minimum the rule enforces. The old key bakes "8" into every
                          // translation (no `_min_` in them), so this one carries the placeholder.
                          // same pattern as «Password is required» (the field first, no «The», no full stop)
                          minLength: {
                            value: PASSWORD_MIN_LENGTH,
                            message: t('AUTH_PASSWORD_MIN_LENGTH', 'Password must be at least _min_ characters')
                              .replace('_min_', PASSWORD_MIN_LENGTH)
                          }
                        })}
                        onChange={handleInput}
                        autoComplete='current-password'
                        autoCapitalize='off'
                      />
                      <LockIcon />
                      <TogglePassword
                        type='button'
                        aria-pressed={passwordSee}
                        aria-label={passwordSee ? t('HIDE_PASSWORD', 'Hide password') : t('SHOW_PASSWORD', 'Show password')}
                        onClick={() => setPasswordSee(!passwordSee)}
                      >
                        {passwordSee ? <EyeOffIcon /> : <EyeIcon />}
                      </TogglePassword>
                    </WrapperPassword>
                    {fieldError('password') && <FieldError id='login-password-error'>{fieldError('password')}</FieldError>}
                  </Field>
                )}

                {isReCaptchaEnable && (
                  <ReCAPTCHAWrapper>
                    <ReCaptcha handleReCaptcha={handleReCaptcha} reCaptchaVersion={reCaptchaVersion} />
                  </ReCAPTCHAWrapper>
                )}

                {noticeMessages.length > 0 && (
                  <ApiErrorNotice messages={noticeMessages} translate={translateMessage} />
                )}

                {!willVerifyOtpState && (
                  <PrimaryButton ref={submitRef} type='submit' disabled={formState.loading} aria-busy={formState.loading || undefined}>
                    {submitLabel}
                    {!formState.loading && <ArrowRightIcon />}
                  </PrimaryButton>
                )}
                {(willVerifyOtpState && !checkPhoneCodeState?.loading) && (
                  <>
                    <OtpHeader>
                      <span>{t('ENTER_THE_CODE_WE_SENT', 'Enter the code we sent you')}</span>
                      <span>
                        {t('CODE_EXPIRES_IN', 'Code expires in')}{' '}
                        <CountdownTimer>{formatSeconds(otpLeftTime)}</CountdownTimer>
                      </span>
                    </OtpHeader>

                    <OtpWrapper>
                      <OtpInput
                        value={otpState}
                        onChange={otp => {
                          clearApiMessages()
                          setOtpState(otp)
                        }}
                        numInputs={numOtpInputs}
                        containerStyle='otp-container'
                        inputStyle='otp-input'
                        placeholder={otpPlaceholder}
                        isInputNum
                        shouldAutoFocus
                        isDisabled={otpLeftTime === 0}
                      />
                    </OtpWrapper>
                    <ResendCode type='button' disabled={otpLeftTime > 520} onClick={handleSendOtp}>
                      {t('RESEND_CODE', 'Resend code')}
                    </ResendCode>
                    <SecondaryButton
                      type='button'
                      disabled={formState.loading}
                      onClick={() => {
                        clearApiMessages()
                        handleCancelLogin?.('user_cancel')
                        setLoginWithOtpState(false)
                        setWillVerifyOtpState(false)
                      }}
                    >
                      {t('CANCEL', 'Cancel')}
                    </SecondaryButton>
                  </>
                )}

                {loginTab !== 'otp' && elementLinkToForgotPassword && (
                  <RedirectLink>
                    <span>{t('FORGOT_YOUR_PASSWORD', 'Forgot your password?')}</span>
                    {elementLinkToForgotPassword}
                  </RedirectLink>
                )}
              </FormInput>

              {whiteLabelSubdomainValidation && (
                <>
                  <Divider>{t('OR', 'or')}</Divider>
                  <SecondaryButton
                    type='button'
                    onClick={() => window.location.assign(configFile?.billing_url ?? 'https://accounts.ordering.co')}
                  >
                    {t('SIGN_UP_FOR_FREE_LOG_IN_VIA_PARTNERS', 'Sign up for free / Log in via partners portal')}
                  </SecondaryButton>
                </>
              )}
              {elementLinkToSignup && (
                <SignupLink>
                  <span>{t('NEW_ON_PLATFORM', 'New on Ordering?')}</span>
                  {elementLinkToSignup}
                </SignupLink>
              )}
        </AuthLayout>
      )}
    </>
  )
}

export const LoginForm = (props) => {
  const [configFile, setConfigFile] = useContext(ConfigFileContext)
  const loginControllerProps = {
    ...props,
    UIComponent: LoginFormUI,
    allowedLevels: [0, 2, 5, 8],
    configFile,
    setConfigFile
  }
  return <LoginFormController {...loginControllerProps} />
}
