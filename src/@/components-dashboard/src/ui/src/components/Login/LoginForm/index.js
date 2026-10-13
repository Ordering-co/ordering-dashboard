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
import { Alert, InputPhoneNumber, SpinnerLoader } from '../../Shared'
import { formatSeconds, getOrderingSubdomains } from '../../../utils'
import { recaptchaTypeAllowsV2, recaptchaTypeAllowsV3 } from '../../../../../utils/settingsCustomSections'

import { AuthLayout } from '../AuthLayout'
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
import { captureDashboardLoginValidation, getLoginAnalyticsAction } from '~/analytics/posthog'

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
  const { handleSubmit, register, errors, control } = useForm()
  const [configFile, setConfigFile] = useContext(ConfigFileContext)

  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [reCaptchaVersion, setRecaptchaVersion] = useState({ version: 'v3', siteKey: '' })
  const [submitted, setSubmitted] = useState(false)
  const [passwordSee, setPasswordSee] = useState(false)
  const [loginWithOtpState, setLoginWithOtpState] = useState(false)
  const [willVerifyOtpState, setWillVerifyOtpState] = useState(false)
  const projectTimer = useRef(null)
  const submittedProject = useRef(null)

  const numOtpInputs = loginTab === 'otp' ? 6 : 4
  const otpPlaceholder = [...Array(numOtpInputs)].fill(0).join('')
  const [otpLeftTime, , resetOtpLeftTime] = useCountdownTimer(
    600, !checkPhoneCodeState?.loading && willVerifyOtpState)

  const isOtpEmail = loginTab === 'otp' && otpType === 'email'
  const isOptCellphone = loginTab === 'otp' && otpType === 'cellphone'
  const isOrderingSubdomain = getOrderingSubdomains()
  const whiteLabelSubdomainValidation = (!useProjectDomain || (useProjectDomain && isOrderingSubdomain))

  const onSubmit = (values) => {
    if (useLoginOptCellphone && loginTab === 'otp' && otpType === 'cellphone' && !credentials?.country_phone_code && !credentials?.cellphone) {
      captureDashboardLoginValidation({ action: getLoginAnalyticsAction(loginTab), projectCode: ordering.project, validationCode: 'phone_invalid' })
      setAlertState({
        open: true,
        content: [t('PHONE_NUMBER_IS_NOT_VALID', 'Phone number is not valid')]
      })
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
    handleChangeTab('otp')
    setOtpType(type)
  }

  const handleSendOtp = () => {
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
    handleChangeCredentials(values)
  }

  useEffect(() => {
    try {
      const user = localStorage.getItem('user')
      if (user) {
        const userData = JSON.parse(user)
        if (userData?.level === 5 && userData?.id) {
          const storageKey = `drivers_cache_${userData.id}`
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

  useEffect(() => {
    if (!formState.loading && formState.result?.error) {
      if (formState.result?.result?.[0] === 'ERROR_AUTH_VERIFICATION_CODE') {
        setRecaptchaVersion({ version: 'v2', siteKey: configs?.security_recaptcha_site_key?.value })
        setAlertState({
          open: true,
          content: [t('TRY_AGAIN', 'Please try again')]
        })
        setSubmitted(false)
        return
      }
      setAlertState({
        open: true,
        content: formState.result?.result || [t('ERROR')]
      })
      setSubmitted(false)
    }
  }, [formState])

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      setAlertState({
        open: true,
        content: Object.values(errors).map((error) => error.message)
      })
    }
  }, [errors])

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
    setOtpState('')
  }

  useEffect(() => {
    if (otpState?.length === numOtpInputs) {
      if (loginTab === 'otp') {
        handleButtonLoginClick()
      }
    }
  }, [otpState])

  useEffect(() => {
    if (checkPhoneCodeState?.result?.error) {
      setAlertState({
        open: true,
        content: checkPhoneCodeState?.result?.result || [t('ERROR', 'Error')]
      })
    } else if (checkPhoneCodeState?.result?.result) {
      resetOtpLeftTime()
    }
  }, [checkPhoneCodeState])

  useEffect(() => {
    if (otpLeftTime === 0) {
      setAlertState({
        open: true,
        content: t('TIME_IS_UP_PLEASE_RESEND_CODE', 'Time is up. Please resend code again')
      })
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

  const loginMethods = [useLoginByEmail, useLoginOtpEmail, useLoginOptCellphone, useLoginByCellphone].filter(Boolean)
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
                <p>{t('LOGIN_PAGE_SUBTITLE', 'Enter your project and account to continue.')}</p>
              </TitleFormSide>

              {ordering?.project && loginMethods.length > 1 && !willVerifyOtpState && (
                <Tabs role='group' aria-label={t('SIGN_IN_METHOD', 'Sign-in method')}>
                  {useLoginByEmail && (
                    <Tab type='button' aria-pressed={loginTab === 'email'} $active={loginTab === 'email'} onClick={() => handleChangeTab('email')}>
                      {t('PASSWORD', 'Password')}
                    </Tab>
                  )}
                  {useLoginOtpEmail && (
                    <Tab type='button' aria-pressed={isOtpEmail} $active={isOtpEmail} onClick={() => handleChangeOtpType('email')}>
                      {t('EMAIL_CODE', 'Email code')}
                    </Tab>
                  )}
                  {useLoginOptCellphone && (
                    <Tab type='button' aria-pressed={isOptCellphone} $active={isOptCellphone} onClick={() => handleChangeOtpType('cellphone')}>
                      {t('PHONE_CODE', 'Phone code')}
                    </Tab>
                  )}
                  {useLoginByCellphone && (
                    <Tab type='button' aria-pressed={loginTab === 'cellphone'} $active={loginTab === 'cellphone'} onClick={() => handleChangeTab('cellphone')}>
                      {t('PHONE_NUMBER', 'Phone number')}
                    </Tab>
                  )}
                </Tabs>
              )}

              <FormInput
                noValidate
                onSubmit={handleSubmit(onSubmit, () => captureDashboardLoginValidation({ action: getLoginAnalyticsAction(loginTab), projectCode: ordering.project, validationCode: 'form_invalid' }))}
              >
                {!willVerifyOtpState && whiteLabelSubdomainValidation && (
                  <Field>
                    <label htmlFor='login-project'>{t('PROJECT', 'Project')}</label>
                    <InputWithIcon>
                      <Controller
                        name='project'
                        control={control}
                        rules={{
                          required: t(
                            'VALIDATION_ERROR_PROJECT_REQUIRED',
                            'Project is required'
                          ).replace('_attribute_', t('PROJECT', 'Project'))
                        }}
                        render={({ onChange, value }) => (
                          <TextInput
                            id='login-project'
                            type='text'
                            value={value}
                            aria-invalid={errors?.project ? 'true' : undefined}
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
                  </Field>
                )}

                {!willVerifyOtpState && ((loginTab === 'email') || (loginTab === 'otp' && otpType === 'email')) && (
                  <Field>
                    <label htmlFor='login-email'>{t('EMAIL', 'Email')}</label>
                    <InputWithIcon>
                      <TextInput
                        id='login-email'
                        type='email'
                        name='email'
                        aria-invalid={errors?.email ? 'true' : undefined}
                        ref={register({
                          required: t(
                            'VALIDATION_ERROR_EMAIL_REQUIRED',
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
                        autoComplete='username'
                        autoCapitalize='off'
                        spellCheck='false'
                      />
                      <MailIcon />
                    </InputWithIcon>
                  </Field>
                )}
                {useLoginByCellphone && loginTab === 'cellphone' && !willVerifyOtpState && (
                  <Field>
                    <label htmlFor='login-cellphone'>{t('PHONE_NUMBER', 'Phone number')}</label>
                    <InputWithIcon>
                      <TextInput
                        id='login-cellphone'
                        type='tel'
                        name='cellphone'
                        aria-invalid={errors?.cellphone ? 'true' : undefined}
                        ref={register({
                          required: t(
                            'VALIDATION_ERROR_CELLPHONE_REQUIRED',
                            'Cellphone is required'
                          ).replace('_attribute_', t('CELLPHONE', 'Cellphone'))
                        })}
                        onChange={(e) => handleChangeInput(e)}
                        autoComplete='tel'
                      />
                      <PhoneIcon />
                    </InputWithIcon>
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

                {loginTab !== 'otp' && !willVerifyOtpState && (
                  <Field>
                    <label htmlFor='login-password'>{t('PASSWORD', 'Password')}</label>
                    <WrapperPassword>
                      <TextInput
                        id='login-password'
                        type={!passwordSee ? 'password' : 'text'}
                        name='password'
                        aria-invalid={errors?.password ? 'true' : undefined}
                        ref={register({
                          required: t(
                            'VALIDATION_ERROR_PASSWORD_REQUIRED',
                            'Password is required'
                          ).replace('_attribute_', t('PASSWORD', 'Password')),
                          minLength: {
                            value: 5,
                            message: t(
                              'VALIDATION_ERROR_MIN_STRING',
                              'The Password must be at least 8 characters.'
                            )
                              .replace('_attribute_', t('PASSWORD', 'Password'))
                              .replace('_min_', 8)
                          }
                        })}
                        onChange={(e) => handleChangeInput(e)}
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
                  </Field>
                )}

                {isReCaptchaEnable && (
                  <ReCAPTCHAWrapper>
                    <ReCaptcha handleReCaptcha={handleReCaptcha} reCaptchaVersion={reCaptchaVersion} />
                  </ReCAPTCHAWrapper>
                )}

                {!willVerifyOtpState && (
                  <PrimaryButton type='submit' disabled={formState.loading} aria-busy={formState.loading || undefined}>
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
                        onChange={otp => setOtpState(otp)}
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
                    {t('SIGN_UP_FOR_FREE_VIA_PARTNERS', 'Sign up for free / Login via partners portal')}
                  </SecondaryButton>
                </>
              )}
              {elementLinkToSignup && (
                <SignupLink>
                  <span>{t('NEW_ON_PLATFORM', 'New on Ordering?')}</span>
                  {elementLinkToSignup}
                </SignupLink>
              )}
          <Alert
            title={t('LOGIN', 'Login')}
            content={alertState.content}
            acceptText={t('ACCEPT', 'Accept')}
            open={alertState.open}
            onClose={() => closeAlert()}
            onAccept={() => closeAlert()}
            closeOnBackdrop={false}
          />
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
