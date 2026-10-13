import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, it, expect, vi } from 'vitest'
import { ThemeProvider } from 'styled-components'
import theme from '~/theme.json'
import { TestOrderGuide } from './TestOrderGuide'
vi.mock('../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (_, fallback) => fallback] }))
afterEach(cleanup)
it('keeps the first-order instructions informational without duplicate website or Orders actions', () => {
  render(<ThemeProvider theme={theme}><TestOrderGuide testOrder={{ enabled: true }} /></ThemeProvider>)
  expect(screen.getByText(/creates a real order/)).toBeTruthy()
  expect(screen.queryByRole('button')).toBeNull()
  expect(screen.queryByRole('link')).toBeNull()
})
it.each([undefined, { enabled: false }])('does not show an empty guide when instructions do not apply: %s', testOrder => {
  const { container } = render(<ThemeProvider theme={theme}><TestOrderGuide testOrder={testOrder} /></ThemeProvider>)
  expect(container).toBeEmptyDOMElement()
})
