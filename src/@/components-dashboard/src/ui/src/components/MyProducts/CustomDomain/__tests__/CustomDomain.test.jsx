import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import dashboardTheme from '~/theme.json'

const state = vi.hoisted(() => ({ apiLabels: {} }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => state.apiLabels[key] ?? fallback],
  useConfig: () => [{ configs: { google_maps_api_key: { value: 'key' } } }],
  CustomDomain: ({ UIComponent, ...props }) => <UIComponent {...props} formState={{ changes: {} }} handleChangeFormState={vi.fn()} />,
  WhiteLabelCustomDomain: ({ UIComponent, ...props }) => <UIComponent {...props} formState={{ changes: {} }} handleChangeFormState={vi.fn()} />
}))
vi.mock('../../../Shared', () => ({ Alert: () => null }))
import { CustomDomain } from '../index'
import { WhiteLabelCustomDomain } from '../../WhiteLabelCustomDomain'

const rawPlaceholder = (name) => '$' + `{${name}}`
const brokenApiLabels = {
  CUSTOM_DOMAIN_NOTIFY: `Please make sure that your DNS CNAME is pointing ${rawPlaceholder('CUSTOM_DOMAIN_NOTIFY_DEFAULT_SUFFIX')}`,
  CUSTOM_DOMAIN_NOTIFY_WHITE_LABEL: `Please make sure that your DNS CNAME is pointing ${rawPlaceholder('CUSTOM_DOMAIN_CNAME')}`
}

beforeEach(() => { state.apiLabels = { ...brokenApiLabels } })

describe('Custom domain CNAME notice', () => {
  it('names the CNAME target instead of a raw placeholder', () => {
    renderWithProviders(<CustomDomain disableDescriptionInfo />, { theme: dashboardTheme })
    expect(screen.getByText('Please make sure your DNS CNAME points to cname.my-sites.app')).toBeInTheDocument()
    expect(screen.queryByText(/\$\{/)).not.toBeInTheDocument()
  })

  it('fills the target into a translated notice', () => {
    state.apiLabels.CUSTOM_DOMAIN_CNAME_TARGET = 'Asegúrate de que tu CNAME apunte a _target_'
    renderWithProviders(<CustomDomain disableDescriptionInfo />, { theme: dashboardTheme })
    expect(screen.getByText('Asegúrate de que tu CNAME apunte a cname.my-sites.app')).toBeInTheDocument()
  })

  it('names the CNAME target on the white label form', () => {
    renderWithProviders(<WhiteLabelCustomDomain />, { theme: dashboardTheme })
    expect(screen.getByText('Please make sure your DNS CNAME points to cname.my-sites.app')).toBeInTheDocument()
    expect(screen.queryByText(/\$\{/)).not.toBeInTheDocument()
  })
})
