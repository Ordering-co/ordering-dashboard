/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

let configs = {}

vi.mock('../../../../../../index.js', () => ({
  useConfig: () => [{ configs, loading: false }],
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { AuthLayout } from '..'
import { ShellMain } from '~/components/ShellMain'

describe('AuthLayout', () => {
  it('shows the Ordering.co panel with the order route by default', () => {
    configs = {}
    renderWithProviders(<AuthLayout><h1>Form</h1></AuthLayout>)

    expect(screen.getAllByAltText('Ordering.co').length).toBeGreaterThan(0)
    const route = screen.getByRole('list', { name: 'From order to delivery', hidden: true })
    expect(within(route).getAllByRole('listitem', { hidden: true }).map(item => item.textContent)).toEqual(['Order', 'Store', 'Driver', 'Customer'])
    expect(screen.getByRole('main')).toHaveTextContent('Form')
  })

  it('keeps the project logo and login background when the project set them', () => {
    configs = {
      dashboard_logo: { value: 'https://cdn.test/logo.png' },
      dashboard_login_background: { value: 'https://cdn.test/bg.jpg' }
    }
    const { container } = renderWithProviders(<AuthLayout><p>Form</p></AuthLayout>)

    expect(screen.queryByAltText('Ordering.co')).toBeNull()
    expect(screen.queryByRole('list', { name: 'From order to delivery', hidden: true })).toBeNull()
    expect(container.querySelector('aside').getAttribute('style')).toContain('https://cdn.test/bg.jpg')
  })

  // the dashboard shell wraps every route in <main id='main-content'>; a second <main> inside it fails axe
  // (landmark-main-is-top-level, landmark-no-duplicate-main, landmark-unique).
  it('is no second main landmark inside the shell main', () => {
    configs = {}
    renderWithProviders(<ShellMain><AuthLayout><h1>Form</h1></AuthLayout></ShellMain>)

    const mains = screen.getAllByRole('main')
    expect(mains).toHaveLength(1)
    expect(mains[0]).toHaveAttribute('id', 'main-content')
    expect(mains[0]).toContainElement(screen.getByRole('heading', { name: 'Form' }))
  })

  it('stays the one main landmark where there is no shell main (docs_connect popup)', () => {
    configs = {}
    const { container } = renderWithProviders(<AuthLayout><h1>Form</h1></AuthLayout>)

    expect(container.querySelectorAll('main')).toHaveLength(1)
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { name: 'Form' }))
  })
})
