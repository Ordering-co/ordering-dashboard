import React from 'react'
import { describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'

import { ApiProvider, useApi } from '..'

const buildSettings = (overrides = {}) => ({
  app_id: 'dashboard',
  app_internal_name: 'dashboard',
  project: 'demo',
  api: { url: 'https://api.test', version: 'v400', language: 'en' },
  ...overrides
})

let apiActions
const ApiProbe = () => {
  const [ordering, actions] = useApi()
  apiActions = actions
  return <span data-testid='client'>{ordering.language}|{ordering.project}</span>
}

const renderProvider = (settings) => render(
  <ApiProvider settings={settings}>
    <ApiProbe />
  </ApiProvider>
)

describe('ApiProvider', () => {
  it('keeps the active language when settings are rebuilt with a new project', () => {
    const { rerender } = renderProvider(buildSettings())
    act(() => apiActions.setLanguage('es'))
    expect(screen.getByTestId('client').textContent).toBe('es|demo')

    rerender(
      <ApiProvider settings={buildSettings({ project: 'resolved' })}>
        <ApiProbe />
      </ApiProvider>
    )

    expect(screen.getByTestId('client').textContent).toBe('es|resolved')
  })

  it('does not mutate the settings.api object it receives', () => {
    const settings = buildSettings()
    renderProvider(settings)

    expect(settings.api).toEqual({ url: 'https://api.test', version: 'v400', language: 'en' })
  })
})
