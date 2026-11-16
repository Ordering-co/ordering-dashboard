import React, { useEffect, useMemo, useState } from 'react'
import { useLanguage as useBaseLanguage } from './language'

const params = () => new URLSearchParams(window.location.search)
const record = (kind, payload) => {
  globalThis.__OD_AUTH_EVENTS__ = [...(globalThis.__OD_AUTH_EVENTS__ || []), { kind, payload }]
}

const baseConfigs = {
  dashboard_logo: { value: params().get('logo') || '/brand/ordering/1.3.0/assets/logos/ordering-lockup-color-on-dark.svg' },
  security_recaptcha_auth: { value: '0' },
  // Tenant login background: supplied as config data only; the real AuthLayout renders it.
  ...(params().get('loginBackground') ? { dashboard_login_background: { value: params().get('loginBackground') } } : {})
}

export const useLanguage = () => useBaseLanguage()
export const useApi = () => {
  const project = params().get('project') || 'fixtureproject'
  return useMemo(() => [{ project }, { configurations: { subdomain: 'ordering' } }], [project])
}
export const useConfig = () => {
  const loading = params().get('domainLoading') === '1'
  const recaptcha = params().get('recaptcha') === '1'
  return useMemo(() => [{
    configs: recaptcha
      ? {
          ...baseConfigs,
          security_recaptcha_auth: { value: '1' },
          security_recaptcha_type: { value: 'v3' },
          security_recaptcha_score_v3: { value: 0.7 },
          security_recaptcha_site_key_v3: { value: 'fixture-site-v3' },
          security_recaptcha_site_key: { value: 'fixture-site-v2' }
        }
      : baseConfigs,
    loading
  }], [loading, recaptcha])
}
export const ReCaptcha = ({ handleReCaptcha, reCaptchaVersion = {} }) => {
  const { version, siteKey } = reCaptchaVersion
  useEffect(() => {
    record('recaptcha-render', { version, siteKey })
  }, [version, siteKey])
  return (
    <button
      data-testid='synthetic-recaptcha'
      type='button'
      onClick={() => {
        record('recaptcha-token', { code: 'fixture-captcha-token', version })
        handleReCaptcha?.({ code: 'fixture-captcha-token', version })
      }}
    >
      Synthetic CAPTCHA {version}
    </button>
  )
}

export const LoginForm = ({ UIComponent, ...props }) => {
  const [loginTab, setLoginTab] = useState(props.fixtureLoginTab || 'email')
  const [otpType, setOtpTypeValue] = useState(props.fixtureOtpType || 'email')
  const [otpState, setOtpStateValue] = useState('')
  const [credentials, setCredentials] = useState({ email: '', password: '', country_phone_code: '', cellphone: '' })
  const [formState, setFormState] = useState(() => ({ loading: params().get('loginLoading') === '1', result: { error: false } }))
  const setOtpType = value => {
    record('login-otp-type', value)
    setOtpTypeValue(value)
  }
  const handleChangeTab = value => {
    record('login-tab', value)
    setLoginTab(value)
  }
  const setOtpState = value => {
    record('login-otp-state', value)
    setOtpStateValue(value)
  }
  const handleChangeInput = event => {
    const { name, value } = event.target
    record('login-input', { name, value })
    setCredentials(current => ({ ...current, [name]: value }))
  }
  const handleChangeCredentials = values => {
    record('login-credentials', values)
    setCredentials(current => ({ ...current, ...values }))
  }
  const handleButtonLoginClick = () => {
    record('login-submit', { credentials, loginTab, otpState, otpType })
    if (params().get('loginOutcome') === 'verification-error') {
      setFormState({ loading: true, result: { error: false } })
      setTimeout(() => setFormState({ loading: false, result: { error: true, result: ['ERROR_AUTH_VERIFICATION_CODE'] } }), 20)
    }
  }
  return React.createElement(UIComponent, {
    ...props,
    loginTab,
    otpType,
    otpState,
    credentials,
    formState,
    checkPhoneCodeState: { loading: false, result: null },
    isReCaptchaEnable: params().get('recaptcha') === '1',
    handleReCaptcha: value => record('login-recaptcha', value),
    setOtpType,
    setOtpState,
    handleChangeTab,
    handleChangeInput,
    handleChangeCredentials,
    setCellphoneStartZero: value => record('login-cellphone-start-zero', value),
    generateOtpCode: () => record('login-generate-otp'),
    handleButtonLoginClick
  })
}

export const ForgotPasswordForm = ({ UIComponent, ...props }) => {
  const [formData, setFormData] = useState({ email: '' })
  const [formState, setFormState] = useState({ loading: false, result: { error: false } })
  const outcome = params().get('outcome') || 'success'
  const hanldeChangeInput = event => {
    const { name, value } = event.target
    record('forgot-input', { name, value })
    setFormData(current => ({ ...current, [name]: value }))
  }
  const handleButtonForgotPasswordClick = () => {
    record('forgot-submit', formData)
    setFormState({ loading: true, result: { error: false } })
    setTimeout(() => setFormState({
      loading: false,
      result: outcome === 'error'
        ? { error: true, result: ['Fixture recovery error'] }
        : { error: false, result: 'OK' }
    }), Number(params().get('forgotDelay') || 20))
  }
  return React.createElement(UIComponent, {
    ...props,
    formData,
    formState,
    isReCaptchaEnable: false,
    handleReCaptcha: () => {},
    hanldeChangeInput,
    handleButtonForgotPasswordClick
  })
}

export const ResetPassword = ({ UIComponent, code, random, ...props }) => {
  const [resetPasswordData, setResetPasswordData] = useState({ code, random, password: '' })
  const [formState, setFormState] = useState({ loading: false, result: { error: false } })
  const [isSuccessfulReset, setSuccessfulReset] = useState(false)
  const handleChangeInput = event => {
    const { name, value } = event.target
    record('reset-input', { name, value })
    setResetPasswordData(current => ({ ...current, [name]: value }))
  }
  const handleResetPassword = () => {
    record('reset-submit', resetPasswordData)
    setFormState({ loading: false, result: { error: false, result: 'OK' } })
    setSuccessfulReset(true)
  }
  return React.createElement(UIComponent, {
    ...props,
    code,
    random,
    resetPasswordData,
    formState,
    isSuccessfulReset,
    handleChangeInput,
    handleResetPassword
  })
}

export const QueryLogin = ({ UIComponent, ...props }) => React.createElement(UIComponent, props)
