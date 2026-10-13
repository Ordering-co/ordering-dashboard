import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../__tests__/helpers/testUtils'

vi.mock('../../../components/HelmetTags', () => ({
  HelmetTags: ({ page }) => <div data-testid='helmet-tags' data-page={page} />
}))

vi.mock('~ui', () => ({
  LoginForm: (props) => (
    <div
      data-testid='login-form'
      data-billing-url={props.billingUrl || ''}
    />
  )
}))

vi.mock('../../../config', () => ({
  default: {
    billing_url: 'https://billing.example',
    use_project_domain: false
  }
}))

import { Login } from '../index'

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders helmet tags and LoginForm with config props', () => {
    renderWithProviders(<Login />)

    expect(screen.getByTestId('helmet-tags')).toHaveAttribute('data-page', 'login')
    expect(screen.getByTestId('login-form')).toHaveAttribute(
      'data-billing-url',
      'https://billing.example'
    )
  })
})
