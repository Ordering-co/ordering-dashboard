import React, { useCallback, useMemo, useState } from 'react'
import { ThemeProvider, useTheme } from 'styled-components'

import { publicAssetUrl } from '../../../src/utils/publicAssetUrl'
import { useConfig } from './auth-forms-language'
import { ConfigFileContext } from '../../../src/@/components-dashboard/src/ui/src/contexts/ConfigFileContext'
import { ForgotPasswordForm } from '../../../src/@/components-dashboard/src/ui/src/components/Login/ForgotPasswordForm'
import { LoginForm } from '../../../src/@/components-dashboard/src/ui/src/components/Login/LoginForm'
import { QueryLogin } from '../../../src/@/components-dashboard/src/ui/src/components/Login/QueryLogin'
import { ResetPassword } from '../../../src/@/components-dashboard/src/ui/src/components/Login/ResetPassword'

const canonicalInvert = '/brand/ordering/1.3.0/assets/logos/ordering-lockup-color-on-dark.svg'
const record = (kind, payload) => {
  globalThis.__OD_AUTH_EVENTS__ = [...(globalThis.__OD_AUTH_EVENTS__ || []), { kind, payload }]
}

const AuthCase = ({ fixtureCase }) => {
  const query = new URLSearchParams(window.location.search)
  if (fixtureCase === 'forgot') {
    return (
      <ForgotPasswordForm
        isPopup={query.get('popup') === '1'}
        useProjectDomain={query.get('domain') === '1'}
        elementLinkToLogin={<a href='/login'>Return to login</a>}
      />
    )
  }
  if (fixtureCase === 'reset') {
    const tokenMode = query.get('tokens') || 'present'
    const code = ['present', 'code-only'].includes(tokenMode) ? 'code-fixture-17' : undefined
    const random = ['present', 'random-only'].includes(tokenMode) ? 'random-fixture-29' : undefined
    return (
      <ResetPassword
        code={code}
        random={random}
        project={query.get('resetProject') || undefined}
        elementLinkToLogin={<a href='/login'>Return to login</a>}
        redirectResetPassword={data => record('reset-redirect', data)}
        onPasswordReset={() => record('reset-complete')}
      />
    )
  }
  if (fixtureCase === 'query') return <QueryLogin project={query.get('queryProject') || 'query-fixture'} token='query-token' />
  const methods = query.get('methods') || 'all'
  const methodFlags = {
    useLoginByEmail: ['all', 'email-only'].includes(methods),
    useLoginByCellphone: ['all', 'phone-only'].includes(methods),
    useLoginOtpEmail: ['all', 'otp-email-only'].includes(methods),
    useLoginOptCellphone: ['all', 'otp-phone-only'].includes(methods)
  }
  return (
    <LoginForm
      {...methodFlags}
      fixtureLoginTab={query.get('initialTab') || 'email'}
      fixtureOtpType={query.get('initialOtpType') || 'email'}
      useProjectDomain={query.get('domain') === '1'}
      isPopup={query.get('popup') === '1'}
      elementLinkToForgotPassword={<a href='/forgot-password'>Recover access</a>}
      elementLinkToSignup={<a href='/signup'>Create account</a>}
    />
  )
}

export const AuthFormsFixture = () => {
  const outerTheme = useTheme()
  // AuthLayout (new in `main`) is not one of the seam-mapped owners, so its SDK `useConfig`
  // resolves to the shared language.js seam. Hand that seam the same synthetic tenant config
  // the form seam serves (logo, optional login background); no product behaviour is faked.
  globalThis.__OD_PHONE_FIXTURE_CONFIG__ = useConfig()
  const query = new URLSearchParams(window.location.search)
  const [configFile, setConfigFileValue] = useState({ billing_url: '/__brand-fixture__/auth/partners', project: null })
  const setConfigFile = useCallback(next => {
    record('config-update', next)
    setConfigFileValue(next)
  }, [])
  const theme = useMemo(() => ({
    ...outerTheme,
    images: {
      ...outerTheme.images,
      logos: { ...outerTheme.images?.logos, logotypeInvert: publicAssetUrl(canonicalInvert) }
    }
  }), [outerTheme])
  return (
    <ThemeProvider theme={theme}>
      <ConfigFileContext.Provider value={[configFile, setConfigFile]}>
        <main data-testid='auth-forms-fixture' className='auth-forms-fixture'>
          <style>{`
            .auth-forms-fixture { box-sizing: border-box; min-height: 100vh; min-width: 0; width: 100%; }
            .auth-forms-fixture * { box-sizing: border-box; }
            .auth-fixture-output { background: ${theme.ordering?.semantic?.background}; color: ${theme.ordering?.semantic?.text?.default}; display: block; max-width: 100%; overflow-wrap: anywhere; padding: 8px 12px; }
          `}</style>
          <AuthCase fixtureCase={query.get('case') || 'login'} />
          <output className='auth-fixture-output' data-testid='auth-config-state'>{JSON.stringify(configFile)}</output>
        </main>
      </ConfigFileContext.Provider>
    </ThemeProvider>
  )
}
