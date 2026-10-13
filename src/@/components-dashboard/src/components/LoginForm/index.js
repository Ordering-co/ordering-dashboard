import React, { useState, useEffect, useRef } from 'react'
import { captureDashboardLoginOperation, captureDashboardLoginValidation, getLoginAnalyticsAction } from '~/analytics/posthog'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useEvent } from '../../contexts/EventContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useConfig } from '../../contexts/ConfigContext'
import { getDashboardLoginSessionDecision } from './loginSessionDecision'
import { getStoredLanguageCode } from '../../utils'

export const getDefaultLoginTab = ({
  useLoginByEmail,
  useLoginByCellphone,
  useLoginOtpEmail,
  useLoginOptCellphone
}) => useLoginByEmail
  ? 'email'
  : (useLoginByCellphone
      ? 'cellphone'
      : ((useLoginOtpEmail || useLoginOptCellphone) ? 'otp' : 'email'))

export const getLoginSelection = ({ loginTab, otpType }, flags) => {
  const { useLoginByEmail, useLoginByCellphone, useLoginOtpEmail, useLoginOptCellphone } = flags
  const otpEnabled = { email: useLoginOtpEmail, cellphone: useLoginOptCellphone }
  const nextOtpType = otpEnabled[otpType]
    ? otpType
    : (useLoginOtpEmail ? 'email' : (useLoginOptCellphone ? 'cellphone' : otpType))
  const tabEnabled = {
    email: useLoginByEmail,
    cellphone: useLoginByCellphone,
    otp: useLoginOtpEmail || useLoginOptCellphone
  }
  const nextLoginTab = tabEnabled[loginTab] ? loginTab : getDefaultLoginTab(flags)
  return { loginTab: nextLoginTab, otpType: nextOtpType }
}

/**
 * Component to manage login behavior without UI component
 */
export const LoginForm = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    handleButtonLoginClick,
    handleSuccessLogin,
    useDefualtSessionManager,
    urlToRedirect,
    allowedLevels,
    billingUrl,
    handleRedirect,
    notificationState,
    setNotificationState
  } = props

  const [ordering, { setLanguage: setApiLanguage } = {}] = useApi()
  let { defaultLoginTab } = props
  const [formState, setFormState] = useState({ loading: false, result: { error: false } })
  const [credentials, setCredentials] = useState({ email: '', cellphone: '', password: '' })
  const [verifyPhoneState, setVerifyPhoneState] = useState({ loading: false, result: { error: false } })
  const [checkPhoneCodeState, setCheckPhoneCodeState] = useState({ loading: false, result: { error: false } })
  const [events] = useEvent()

  const [, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [reCaptchaValue, setReCaptchaValue] = useState({ code: '', version: '' })
  const [isReCaptchaEnable, setIsReCaptchaEnable] = useState(false)
  const [cellphoneStartZero, setCellphoneStartZero] = useState(null)

  const useLoginOtpEmail = configs?.opt_email_enabled?.value === '1'
  const useLoginOptCellphone = configs?.otp_cellphone_enabled?.value === '1'
  const useLoginByEmail = configs?.email_password_login_enabled?.value === '1'
  const useLoginByCellphone = configs?.phone_password_login_enabled?.value === '1'

  const useLoginOtp = useLoginOtpEmail
  defaultLoginTab = getDefaultLoginTab({
    useLoginByEmail,
    useLoginByCellphone,
    useLoginOtpEmail,
    useLoginOptCellphone
  })

  const [loginTab, setLoginTab] = useState(defaultLoginTab)
  const [otpType, setOtpType] = useState('email')
  const [otpState, setOtpState] = useState('')

  const [, { login, logout }] = useSession()
  const activeLogin = useRef(null)
  const currentLoginSelection = useRef(null)
  currentLoginSelection.current = { project: ordering?.project, tab: loginTab, otpType }

  const finishLogin = (attempt, status, details = {}) => {
    if (!attempt || activeLogin.current !== attempt || attempt.finished) return
    attempt.finished = true
    captureDashboardLoginOperation({
      status,
      action: attempt.action,
      projectCode: attempt.project,
      durationMs: Math.max(0, Date.now() - attempt.startedAt),
      ...details
    })
  }

  const resetAttemptReCaptcha = (attempt) => {
    if (!attempt?.recaptchaType || attempt.recaptchaReset) return
    attempt.recaptchaReset = true
    if (attempt.recaptchaType === 'v2' && window.grecaptcha) window.grecaptcha.reset()
    setReCaptchaValue({ code: '', version: '' })
  }

  const handleCancelLogin = (reason = 'user_cancel') => {
    const attempt = activeLogin.current
    if (!attempt) return
    finishLogin(attempt, 'cancelled', { cancelReason: reason })
    activeLogin.current = null
    resetAttemptReCaptcha(attempt)
    setFormState(state => ({ ...state, loading: false }))
  }

  const isCurrentLogin = (attempt) => {
    const current = currentLoginSelection.current
    return activeLogin.current === attempt &&
      current?.project === attempt.project &&
      current?.tab === attempt.tab &&
      current?.otpType === attempt.otpType
  }

  const cancelIfStaleLogin = (attempt) => {
    if (isCurrentLogin(attempt)) return false
    if (activeLogin.current === attempt) handleCancelLogin('superseded')
    return true
  }

  useEffect(() => {
    const attempt = activeLogin.current
    if (attempt && (attempt.project !== ordering?.project || attempt.tab !== loginTab || attempt.otpType !== otpType)) {
      handleCancelLogin('superseded')
    }
  }, [ordering?.project, loginTab, otpType])

  /**
   * Default fuction for login workflow
   * @param {object} credentials Login credentials email/cellphone and password
   */
  const handleLoginClick = async (values) => {
    if (activeLogin.current) return
    let attempt
    let receivedResponse = false
    try {
      let _credentials
      if (loginTab === 'otp') {
        _credentials = {
          [otpType]: (values && values[otpType]) || credentials[otpType],
          one_time_password: (values && values?.code) || otpState,
          ...(otpType === 'cellphone' && { country_phone_code: (values?.country_phone_code || credentials?.country_phone_code) })
        }
      } else {
        _credentials = {
          [loginTab]: (values && values[loginTab]) || credentials[loginTab],
          password: (values && values?.password) || credentials.password
        }
      }

      if (isReCaptchaEnable) {
        if (reCaptchaValue?.code === '') {
          captureDashboardLoginValidation({ action: getLoginAnalyticsAction(loginTab), projectCode: ordering?.project, validationCode: 'captcha_required' })
          setFormState({
            result: {
              error: true,
              result: t('RECAPTCHA_VALIDATION_IS_REQUIRED', 'The captcha validation is required')
            },
            loading: false
          })
          return
        } else {
          _credentials.verification_code = reCaptchaValue?.code
          _credentials.recaptcha_type = reCaptchaValue?.version
        }
      }

      const language = getStoredLanguageCode(window.localStorage.getItem('language'))
      if (ordering.language !== language) {
        ordering.setLanguage(language)
        setApiLanguage?.(language)
      }

      setFormState({ ...formState, loading: true })

      if (notificationState?.notification_token) {
        _credentials.notification_app = notificationState.notification_app
        _credentials.notification_token = notificationState.notification_token
      }
      const users = ordering.users()
      attempt = { action: getLoginAnalyticsAction(loginTab), project: ordering?.project, tab: loginTab, otpType, recaptchaType: _credentials.recaptcha_type, startedAt: Date.now() }
      activeLogin.current = attempt
      captureDashboardLoginOperation({ status: 'started', action: attempt.action, projectCode: attempt.project })
      const response = await users.auth(_credentials)
      receivedResponse = true
      if (activeLogin.current === attempt) resetAttemptReCaptcha(attempt)
      if (cancelIfStaleLogin(attempt)) return
      const { content: { error: apiError, result, action } } = response
      const httpFailed = response.status !== undefined && (response.status < 200 || response.status >= 300)
      const error = apiError || httpFailed
      if (error) finishLogin(attempt, 'failed', { failureType: response.status === 403 ? 'permission' : 'api' })

      if (action && action?.type === 'billing_autologin') {
        window.open(`${billingUrl}?token=${action?.data?.access_token}&projectId=${action?.data?.project_id}&userId=${action?.data?.user_id}`, '_blank').focus()
      }

      if (!error) {
        setNotificationState?.({
          ...notificationState,
          subscribed: true
        })
        if (useDefualtSessionManager) {
          const sessionDecision = getDashboardLoginSessionDecision({
            user: result,
            allowedLevels
          })
          if (!sessionDecision.persistSession) {
            finishLogin(attempt, 'failed', { failureType: 'permission' })
            try {
              const { content: logoutResp } = await ordering.setAccessToken(sessionDecision.logoutToken).users().logout()
              if (cancelIfStaleLogin(attempt)) return
              if (!logoutResp.error) {
                logout()
              }
              setFormState({
                result: {
                  error: true,
                  result: [sessionDecision.error]
                },
                loading: false
              })
            } catch (error) {
              if (cancelIfStaleLogin(attempt)) return
              setFormState({
                result: {
                  error: true,
                  result: error.message
                },
                loading: false
              })
            }
            return
          }
          // Confirm authentication before session callbacks can navigate/unmount.
          if (!result?.id || !result?.session?.access_token) throw new Error(t('ERROR', 'Error'))
          finishLogin(attempt, 'succeeded')
          login({
            user: result,
            token: result.session.access_token,
            project: ordering?.project
          })
        }
        if (!useDefualtSessionManager) {
          if (!result?.id || !result?.session?.access_token) throw new Error(t('ERROR', 'Error'))
          finishLogin(attempt, 'succeeded')
        }
        events.emit('userLogin', result)
        if (handleSuccessLogin) {
          handleSuccessLogin(result)
        }

        if (urlToRedirect) {
          handleRedirect
            ? handleRedirect(urlToRedirect)
            : window.location.href = `${window.location.origin}${urlToRedirect}`
        }
      }
      setFormState({
        result: {
          error,
          result
        },
        loading: false
      })
    } catch (err) {
      if (activeLogin.current === attempt) resetAttemptReCaptcha(attempt)
      if (attempt && cancelIfStaleLogin(attempt)) return
      // The bundled SDK reports XHR failures as ProgressEvent, HTTP 5xx as Error.
      let failureType = 'api'
      if (!receivedResponse && err?.name === 'TimeoutError') failureType = 'timeout'
      else if (!receivedResponse && (err?.type === 'error' || err instanceof TypeError)) failureType = 'network'
      finishLogin(attempt, 'failed', { failureType })
      setFormState({
        result: {
          error: true,
          result: err.message
        },
        loading: false
      })
    } finally {
      if (activeLogin.current === attempt) activeLogin.current = null
    }
  }

  /**
   * Update credential data
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeInput = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    })
  }

  /**
   * Update credential data
   */
  const handleChangeCredentials = (changes) => {
    setCredentials({
      ...credentials,
      ...changes
    })
  }

  /**
   * Change current selected tab
   * @param {string} tab Reference tab email or cellphone
   */
  const handleChangeTab = (tab) => {
    if (tab !== loginTab) handleCancelLogin('superseded')
    setLoginTab(tab)
  }

  /**
   * function to send verify code with twilio
   * @param {Object} values object with cellphone and country code values
   */
  const sendVerifyPhoneCode = async (values) => {
    try {
      setVerifyPhoneState({ ...verifyPhoneState, loading: true })
      const body = {
        cellphone: cellphoneStartZero || values.cellphone,
        country_phone_code: `+${values.country_phone_code}`
      }
      if (notificationState?.notification_token) {
        body.notification_token = notificationState.notification_token
        body.notification_app = notificationState.notification_app
      }
      const response = await fetch(`${ordering.root}/auth/sms/twilio/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-INTERNAL-PRODUCT-X': ordering.appInternalName },
        body: JSON.stringify(body)
      })
      const res = await response.json()
      setVerifyPhoneState({
        ...verifyPhoneState,
        loading: false,
        result: res
      })
      setNotificationState?.({
        ...notificationState,
        subscribed: true
      })
    } catch (error) {
      setVerifyPhoneState({
        ...verifyPhoneState,
        loading: false,
        result: {
          error: error.message
        }
      })
    }
  }

  const handleSetCheckPhoneCodeState = (data) => {
    const values = data || { loading: false, result: { error: false } }
    setCheckPhoneCodeState(values)
  }

  /**
   * function to verify code with endpoint
   * @param {Object} values object with cellphone and country code values
   */
  const checkVerifyPhoneCode = async (values) => {
    try {
      setCheckPhoneCodeState({ ...checkPhoneCodeState, loading: true })
      const response = await fetch(`${ordering.root}/auth/sms/twilio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-INTERNAL-PRODUCT-X': ordering.appInternalName },
        body: JSON.stringify(values)
      })
      const res = await response.json()
      if (!res?.error && res?.result?.id) {
        const sessionDecision = getDashboardLoginSessionDecision({
          user: res?.result,
          allowedLevels
        })
        if (!sessionDecision.persistSession) {
          try {
            const { content: logoutResp } = await ordering.setAccessToken(sessionDecision.logoutToken).users().logout()
            if (!logoutResp.error) {
              logout()
            }
          } catch (error) {
            setCheckPhoneCodeState({
              ...checkPhoneCodeState,
              loading: false,
              result: {
                error: true,
                result: error.message
              }
            })
            return
          }
          setCheckPhoneCodeState({
            ...checkPhoneCodeState,
            loading: false,
            result: {
              error: true,
              result: [sessionDecision.error]
            }
          })
          return
        }
        login({
          user: res?.result,
          token: res?.result?.session?.access_token,
          project: ordering?.project
        })
        if (handleSuccessLogin) {
          handleSuccessLogin(res?.result)
        }
      }
      setCheckPhoneCodeState({
        ...checkPhoneCodeState,
        loading: false,
        result: res
      })
    } catch (error) {
      setCheckPhoneCodeState({
        ...checkPhoneCodeState,
        loading: false,
        result: {
          error: error.message
        }
      })
    }
  }

  const generateOtpCode = async (values) => {
    const body = {
      type: 4,
      channel: otpType === 'email' ? 1 : 2,
      size: 6
    }
    const email = values?.email || credentials?.email
    const cellphone = cellphoneStartZero || values?.cellphone || credentials?.cellphone
    const countryPhoneCode = values?.countryPhoneCode || values?.country_phone_code || credentials.country_phone_code

    try {
      if (otpType === 'cellphone') {
        body.country_phone_code = countryPhoneCode
        body.cellphone = cellphone
        setCredentials({
          cellphone,
          country_phone_code: countryPhoneCode
        })
      } else {
        body.email = email
        setCredentials({
          email
        })
      }
      const response = await fetch(`${ordering.root}/codes/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-X': ordering.appId, 'X-INTERNAL-PRODUCT-X': ordering.appInternalName },
        body: JSON.stringify(body)
      })
      const { result, error } = await response.json()
      if (!error) {
        setCheckPhoneCodeState({ ...checkPhoneCodeState, result: { result, error: null } })
        return
      }
      setCheckPhoneCodeState({ ...checkPhoneCodeState, result: { error: result } })
    } catch (err) {
      setCheckPhoneCodeState({ ...checkPhoneCodeState, result: { error: err.message } })
    }
  }

  useEffect(() => {
    setIsReCaptchaEnable(ordering?.project && configs &&
      Object.keys(configs).length > 0 &&
      configs?.security_recaptcha_auth?.value === '1')
  }, [configs, ordering?.project])

  useEffect(() => {
    const selection = getLoginSelection({ loginTab, otpType }, {
      useLoginByEmail,
      useLoginByCellphone,
      useLoginOtpEmail,
      useLoginOptCellphone
    })
    setLoginTab(selection.loginTab)
    setOtpType(selection.otpType)
  }, [loginTab, otpType, useLoginByEmail, useLoginByCellphone, useLoginOtpEmail, useLoginOptCellphone])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          formState={formState}
          loginTab={loginTab}
          credentials={credentials}
          verifyPhoneState={verifyPhoneState}
          checkPhoneCodeState={checkPhoneCodeState}
          setCheckPhoneCodeState={handleSetCheckPhoneCodeState}
          handleChangeInput={handleChangeInput}
          handleButtonLoginClick={handleButtonLoginClick || handleLoginClick}
          handleChangeTab={handleChangeTab}
          handleCancelLogin={handleCancelLogin}
          handleSendVerifyCode={sendVerifyPhoneCode}
          handleCheckPhoneCode={checkVerifyPhoneCode}
          isReCaptchaEnable={isReCaptchaEnable}
          handleReCaptcha={setReCaptchaValue}

          useLoginOtp={useLoginOtp}
          setOtpType={setOtpType}
          otpType={otpType}
          setOtpState={setOtpState}
          otpState={otpState}
          useLoginByEmail={useLoginByEmail}
          useLoginOtpEmail={useLoginOtpEmail}
          generateOtpCode={generateOtpCode}
          useLoginByCellphone={useLoginByCellphone}
          useLoginOptCellphone={useLoginOptCellphone}
          handleChangeCredentials={handleChangeCredentials}
          setCellphoneStartZero={setCellphoneStartZero}
        />
      )}
    </>
  )
}

LoginForm.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Function to change default login behavior
   */
  handleButtonLoginClick: PropTypes.func,
  /**
   * Function to get login success event
   * @param {Object} user User with session data
   */
  handleSuccessLogin: PropTypes.func,
  /**
   * Enable/Disable default session manager
   * Save user and token with default session manager
   */
  useDefualtSessionManager: PropTypes.bool,
  /**
   * Enable/Disable login by email
   */
  useLoginByEmail: PropTypes.bool,
  /**
   * Enable/Disable login by cellphone
   */
  useLoginByCellphone: PropTypes.bool,
  /**
   * Selected tab by default
   * You can choose between 'email' or 'cellphone'
   */
  defaultLoginTab: PropTypes.string,
  /**
   * Url to signup page
   * Url to create element link to signup page
   */
  linkToSignup: PropTypes.string,
  /**
   * Url to forgot password page
   * Url to create element link to signup page
   */
  linkToForgetPassword: PropTypes.string,
  /**
   * Element to custom link to signup
   * You can provide de link element as react router Link or your custom Anchor to signup page
   */
  elementLinkToSignup: PropTypes.element,
  /**
   * Element to custo link to forgot password
   * You can provide de link element as react router Link or your custom Anchor to forgot password page
   */
  elementLinkToForgotPassword: PropTypes.element
}

const defaultProps = {
  defaultLoginTab: 'email',
  useLoginByEmail: true,
  useDefualtSessionManager: true
}
