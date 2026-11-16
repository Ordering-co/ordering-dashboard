import React, { useEffect, useState } from 'react'
import { useTheme as useStyledTheme } from 'styled-components'

import theme from '../../../src/theme.json'
import { createDashboardTheme } from '../../../src/brand/adapter'
import { mergeThemePrimary } from '../../../src/utils/bootTheme'
import { useTheme as useDashboardTheme } from '../../../src/@/components-dashboard/src/ui/src/contexts/ThemeContext'
import { InputPhoneNumber } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/InputPhoneNumber'
import { FormController } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/ConfirmAdmin/styles'

const session = [{
  auth: true,
  loading: false,
  user: {
    id: 8101,
    level: 0,
    email: 'admin@example.test',
    country_phone_code: '1',
    cellphone: '2025550123'
  }
}]

export const PhoneInputConsumersFixture = () => {
  const themeState = useStyledTheme()
  const [, { update }] = useDashboardTheme()
  const [validationEnabled, setValidationEnabled] = useState(true)
  const [internationalValue, setInternationalValue] = useState('+12025550123')
  const [nationalValue, setNationalValue] = useState('+12025550123')
  const [events, setEvents] = useState({ international: [], national: [] })
  const outputStyle = { display: 'block', maxWidth: '100%', minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }

  globalThis.__OD_PHONE_FIXTURE_SESSION__ = session
  globalThis.__OD_PHONE_FIXTURE_CONFIG__ = [{
    configs: {
      default_country_code: { value: 'US' },
      validation_phone_number_lib: { value: validationEnabled ? 1 : 0 }
    },
    loading: false
  }]

  useEffect(() => () => {
    delete globalThis.__OD_PHONE_FIXTURE_SESSION__
    delete globalThis.__OD_PHONE_FIXTURE_CONFIG__
  }, [])

  const capture = (key, setter) => (...args) => {
    const [number, isValid, raw] = args
    setter(number || '')
    setEvents(current => ({
      ...current,
      [key]: [...current[key], { number: number ?? null, numberType: typeof number, raw: raw ?? null, rawType: typeof raw, valid: isValid ?? null, validType: typeof isValid, arity: args.length }]
    }))
  }

  const applyRuntimeTheme = ({
    mode = themeState.ordering.mode,
    rtl = themeState.rtl,
    tenant = themeState.ordering.actionOverride,
    tenantFont = themeState.fonts.primary
  } = {}) => {
    let nextTheme = createDashboardTheme({ ...theme, rtl }, { mode })
    if (tenant) nextTheme = mergeThemePrimary(nextTheme, tenant)
    nextTheme = {
      ...nextTheme,
      fonts: { ...nextTheme.fonts, primary: tenantFont }
    }
    update(nextTheme)
  }

  return (
    <main data-testid='phone-input-consumers' style={{ boxSizing: 'border-box', display: 'grid', gap: 20, gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0, overflow: 'hidden', padding: 24, width: '100%' }}>
      <button type='button' onClick={() => setValidationEnabled(value => !value)}>
        {validationEnabled ? 'Disable phone validation' : 'Enable phone validation'}
      </button>
      <button
        type='button'
        data-testid='phone-theme-toggle'
        onClick={() => applyRuntimeTheme({ mode: themeState.ordering.mode === 'dark' ? 'light' : 'dark' })}
      >
        Toggle phone theme
      </button>
      <button
        type='button'
        data-testid='phone-direction-toggle'
        onClick={() => applyRuntimeTheme({ rtl: !themeState.rtl })}
      >
        Toggle phone direction
      </button>
      <button
        type='button'
        data-testid='phone-tenant-apply'
        onClick={() => applyRuntimeTheme({
          tenant: '#123456',
          tenantFont: { name: 'Fixture Tenant Sans', family: 'monospace' }
        })}
      >
        Apply phone tenant
      </button>

      <section data-testid='international-phone-consumer'>
        <h2>International user phone</h2>
        <InputPhoneNumber
          isUser
          user={session[0].user}
          value={internationalValue}
          setValue={capture('international', setInternationalValue)}
        />
      </section>

      <section data-testid='confirm-admin-phone-consumer'>
        <h2>Confirm administrator phone</h2>
        <FormController>
          <InputPhoneNumber
            user={session[0].user}
            value={nationalValue}
            setValue={capture('national', setNationalValue)}
          />
        </FormController>
      </section>

      <section data-testid='disabled-phone-consumer'>
        <h2>Disabled phone</h2>
        <InputPhoneNumber
          isUser
          disabled
          user={session[0].user}
          value='+12025550123'
          setValue={() => {}}
        />
      </section>

      <div style={{ maxWidth: '100%', minWidth: 0, overflow: 'hidden' }}>
        <output data-testid='phone-theme' style={outputStyle}>{JSON.stringify({
          mode: themeState.ordering.mode,
          rtl: themeState.rtl,
          primary: themeState.colors.primary,
          focus: themeState.ordering.semantic.action.focus,
          surface: themeState.ordering.semantic.surface.default,
          text: themeState.ordering.semantic.text.default,
          danger: themeState.ordering.semantic.state.danger.functional,
          font: themeState.fonts.primary?.family || themeState.fonts.primary?.name
        })}</output>
        <output data-testid='phone-values' style={outputStyle}>{JSON.stringify({ internationalValue, nationalValue, validationEnabled })}</output>
        <output data-testid='phone-events' style={outputStyle}>{JSON.stringify(events)}</output>
      </div>
    </main>
  )
}
