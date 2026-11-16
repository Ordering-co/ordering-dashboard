/* eslint-disable import/first */
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'
import { resolveSelectTheme } from '../../../styles/selectTheme'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback || key]
}))

import { LinkableText } from './LinkableText'
import { Personalization } from './Personalization'

const personalizationImage = '/tenant-assets/personalization.svg'
const lightTheme = {
  ...createDashboardTheme(theme),
  images: { ...theme.images, general: { ...(theme.images?.general || {}), personalization: personalizationImage } }
}
const rtlDarkTheme = { ...createDashboardTheme(theme, { mode: 'dark' }), images: lightTheme.images, rtl: true }
const renderWithTheme = (content, currentTheme = lightTheme) => render(
  <ThemeProvider theme={currentTheme}>{content}</ThemeProvider>
)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('L2d-C15 Personalization', () => {
  it('preserves conditional title, exact Typeform anchor and Ordering.co fallback copy', () => {
    renderWithTheme(<Personalization isShowTitle />)
    const root = document.querySelector('[data-slot="personalization"]')
    expect(root).toHaveAttribute('dir', 'ltr')
    expect(screen.getByRole('heading', { name: 'Personalization' })).toBeInTheDocument()
    expect(root).toHaveTextContent('If you are looking for something special for your Ordering.co Solution')
    const link = screen.getByRole('link', { name: 'send us your special wish.' })
    expect(link).toHaveAttribute('href', 'https://orderingco.typeform.com/to/qHPQtU')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveAttribute('data-outbound-link-slot', 'personalization-link')
  })

  it('uses the exact tenant image and existing accessible name without forcing the title', () => {
    renderWithTheme(<Personalization />, rtlDarkTheme)
    const root = document.querySelector('[data-slot="personalization"]')
    expect(root).toHaveAttribute('dir', 'rtl')
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    const image = screen.getByRole('img', { name: 'Personalization' })
    expect(image).toHaveAttribute('src', personalizationImage)
    expect(image).toHaveAttribute('loading', 'lazy')
    expect(getComputedStyle(root).getPropertyValue('--od-entity-selector-text')).toBe(resolveSelectTheme(rtlDarkTheme).text)
  })

  it('keeps the exact window.open arguments and original form submit behavior on the 44px action', async () => {
    const user = userEvent.setup()
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const handleSubmit = vi.fn(event => event.preventDefault())
    renderWithTheme(<form onSubmit={handleSubmit}><Personalization /></form>)
    const action = screen.getByRole('button', { name: 'Contact us' })
    expect(action).toHaveAttribute('type', 'submit')
    expect(action).toHaveAttribute('data-outbound-link-slot', 'contact-action')
    await user.click(action)
    expect(open).toHaveBeenCalledOnce()
    expect(open).toHaveBeenCalledWith('https://orderingco.typeform.com/to/qHPQtU', '_blank', 'noopener,noreferrer')
    expect(handleSubmit).toHaveBeenCalledOnce()
  })
})

describe('L2d-C15 LinkableText', () => {
  it('preserves react-linkify href/text and the literal named-window target', () => {
    renderWithTheme(<LinkableText text='Visit https://example.com/docs today' />)
    const root = document.querySelector('[data-slot="linkable-text"]')
    expect(root).toHaveTextContent('Visit https://example.com/docs today')
    const link = screen.getByRole('link', { name: 'https://example.com/docs' })
    expect(link).toHaveAttribute('href', 'https://example.com/docs')
    expect(link).toHaveAttribute('target', 'blank')
    expect(link).not.toHaveAttribute('rel')
    expect(link).toHaveAttribute('data-outbound-link-slot', 'generated-link')
  })

  it('keeps nested content, long generated links and HTML-looking text safely escaped', () => {
    const longUrl = `https://example.com/${'long-path-'.repeat(18)}`
    renderWithTheme(
      <LinkableText
        text={(
          <em>{`Documentation: ${longUrl} <script>alert("unsafe")</script>`}</em>
        )}
      />
    )
    expect(screen.getByText(/Documentation:/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: longUrl })).toHaveAttribute('href', longUrl)
    expect(document.querySelector('[data-slot="linkable-text"]')).toHaveTextContent('<script>alert("unsafe")</script>')
    expect(document.querySelector('script')).not.toBeInTheDocument()
  })
})
