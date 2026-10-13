/**
 * Shared test helpers for ordering-dashboard (Vitest + Testing Library).
 */
import React from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter, Route } from 'react-router-dom'
import { ThemeProvider } from 'styled-components'
import { vi } from 'vitest'

export const defaultTheme = {
  colors: {
    primary: '#000000',
    backgroundPage: '#ffffff',
    headingColor: '#000000',
    lightGray: '#f5f5f5',
    borderColor: '#e9ecef'
  },
  images: {},
  third_party_code: {}
}

/**
 * @param {React.ReactElement} ui
 * @param {{
 *   initialEntries?: Array<string | { pathname: string, state?: object, search?: string }>,
 *   routePath?: string,
 *   theme?: object,
 *   wrapper?: React.ComponentType
 * }} options
 */
export const renderWithProviders = (ui, options = {}) => {
  const {
    initialEntries = ['/'],
    routePath,
    theme = defaultTheme,
    wrapper: ExtraWrapper,
    ...renderOptions
  } = options

  const Wrapper = ({ children }) => {
    const routed = routePath
      ? <Route path={routePath}>{children}</Route>
      : children

    const content = (
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={initialEntries}>
          {routed}
        </MemoryRouter>
      </ThemeProvider>
    )
    return ExtraWrapper ? <ExtraWrapper>{content}</ExtraWrapper> : content
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

export const mockFetch = (data, options = {}) => {
  const { ok = true, status = 200 } = options
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok,
      status,
      json: async () => data,
      text: async () => JSON.stringify(data)
    })
  )
}

export const mockFetchError = (error) => {
  const errorObj = typeof error === 'string' ? new Error(error) : error
  global.fetch = vi.fn(() => Promise.reject(errorObj))
}
