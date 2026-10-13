import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StyleSheetManager } from 'styled-components'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'
import { sourceProduct } from '../../../../../../components/SourceCodeDownloads/__tests__/fixtures'
import labels from '../../../../../../components/SourceCodeDownloads/sourceCodeTranslations.generated.json'
import { producerGuides, producerCommands, mixedFenceGuide, heredocCommands } from './producerGuideFixture'

const state = vi.hoisted(() => ({ collapsed: false, collapse: vi.fn(), language: { code: 'en' }, apiLabels: {} }))
vi.mock('../../../../../../index', () => ({
  SourceCodeDownloads: ({ UIComponent, ...props }) => <UIComponent {...props} />,
  useLanguage: () => [{ language: state.language }, (key, fallback) => state.apiLabels[`DASHBOARD_${key}`] ?? state.apiLabels[key] ?? fallback]
}))
vi.mock('../../../../contexts/InfoShareContext', () => ({ useInfoShare: () => [{ isCollapse: state.collapsed }, { handleMenuCollapse: state.collapse }] }))
import { SourceCodeDownloadsUI, SourceCodeDownloads } from '../index'

const product = {
  ...sourceProduct,
  description: sourceProduct.descriptionByLocale.es,
  descriptionLocale: 'es',
  instructions: sourceProduct.instructionsByLocale.es,
  instructionsLocale: 'es',
  instructionsFallback: false,
  publishedLabel: 'Jul 1, 2026, 12:00:00',
  sizeLabel: '4'
}
const props = overrides => ({
  catalogStatus: 'ready',
  catalogError: null,
  product,
  downloadState: { status: 'idle', error: null },
  downloadSource: vi.fn(),
  reloadCatalog: vi.fn(),
  signInAgain: vi.fn(),
  ...overrides
})
const renderUI = overrides => {
  const values = props(overrides)
  return { values, ...renderWithProviders(<SourceCodeDownloadsUI {...values} />, { theme }) }
}
beforeEach(() => { state.collapsed = false; state.collapse.mockClear(); state.language = { code: 'en' }; state.apiLabels = {} })

describe('source downloads presentation', () => {
  it('preserves the literal backtick line and all commands of D’s tilde heredoc as one code block', () => {
    const { container } = renderUI({ product: { ...product, instructions: mixedFenceGuide } })
    const code = container.querySelectorAll('pre code')
    expect(code).toHaveLength(1)
    expect(code[0].textContent).toBe(heredocCommands)
  })
  it.each(['es', 'ar'])('renders the producer-format %s tilde guide as code with no raw fences', locale => {
    state.language = { code: locale }
    const original = producerGuides[locale]
    const value = { ...product, instructions: original, instructionsLocale: locale }
    const { container } = renderWithProviders(<SourceCodeDownloadsUI {...props({ product: value })} />, { theme: { ...theme, rtl: locale === 'ar' } })
    const code = container.querySelector('pre code')
    expect(code).toBeInTheDocument()
    expect(code.textContent).toBe(producerCommands)
    expect(container.textContent).not.toContain('~~~sh')
    expect(container.textContent).not.toContain('```sh')
    expect(value.instructions).toBe(original)
  })

  it('overrides Bootstrap pink code only within Source metadata and Details', async () => {
    const bootstrap = document.createElement('style')
    bootstrap.textContent = 'code { color: #e83e8c; }'
    const outside = document.createElement('code')
    outside.textContent = 'Outside Source'
    const styleTarget = document.createElement('div')
    // Bootstrap loads before the component stylesheet in the application.
    document.head.insertBefore(bootstrap, document.head.firstChild)
    document.head.appendChild(styleTarget)
    document.body.appendChild(outside)
    try {
      // Use a fresh component sheet after Bootstrap, avoiding JSDOM's cached
      // stylesheet ordering from earlier renders in this test suite.
      renderWithProviders(<StyleSheetManager target={styleTarget}><SourceCodeDownloadsUI {...props()} /></StyleSheetManager>, { theme })
      expect(getComputedStyle(screen.getByText(product.version)).color).not.toBe('rgb(232, 62, 140)')
      await userEvent.click(screen.getByText('Source and checksum'))
      expect(getComputedStyle(screen.getByText(product.sourceSha)).color).not.toBe('rgb(232, 62, 140)')
      expect(getComputedStyle(outside).color).toBe('rgb(232, 62, 140)')
    } finally {
      bootstrap.remove()
      outside.remove()
      styleTarget.remove()
    }
  })
  it.each(['es', 'ar'])('renders canonical %s source labels without relying on API coverage', locale => {
    state.language = { code: locale }
    renderUI({ catalogStatus: 'empty', product: null })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(labels.SOURCE_CODE_TITLE[locale])
    expect(screen.getByRole('status')).toHaveTextContent(labels.SOURCE_CODE_EMPTY[locale])
    expect(screen.getByRole('button', { name: labels.SOURCE_CODE_RETRY[locale] })).toBeInTheDocument()
  })

  it('keeps a nonempty namespaced API source label authoritative', () => {
    state.language = { code: 'es-MX' }
    state.apiLabels = { DASHBOARD_SOURCE_CODE_TITLE: 'Controlled API heading' }
    renderUI()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Controlled API heading')
    expect(screen.getByRole('button', { name: labels.SOURCE_CODE_DOWNLOAD.es })).toBeInTheDocument()
  })
  it('shows only producer metadata, localized instructions and the exact original legal text', async () => {
    renderUI()
    expect(screen.getByRole('heading', { name: 'Open Source Code', level: 1 })).toBeInTheDocument()
    const article = screen.getByRole('article')
    expect(within(article).getByRole('heading', { name: 'Website Marketplace', level: 2 })).toBeInTheDocument()
    expect(screen.getByText(product.version)).toBeInTheDocument()
    expect(screen.getByText('Published (CST · UTC−06:00)')).toBeInTheDocument()
    expect(screen.getByText(product.publishedLabel)).toHaveAttribute('datetime', product.publishedAt)
    expect(screen.getByText(product.description)).toHaveAttribute('lang', 'es')
    expect(screen.getByText('Descomprime el ZIP.')).toBeInTheDocument()
    expect(screen.getByText(product.artifact.filename)).toBeInTheDocument()
    await userEvent.click(screen.getByText('License · MIT'))
    expect(screen.getByText(/Copyright \(c\) Controlled test fixture/).textContent).toBe(product.license.text)
    expect(screen.queryByText(/Purchase|Contact Us/)).not.toBeInTheDocument()
  })

  it('wires the UI through the controller export', () => {
    renderWithProviders(<SourceCodeDownloads {...props({ catalogStatus: 'empty', product: null })} />, { theme })
    expect(screen.getByRole('status')).toHaveTextContent('No Website Marketplace package is available yet.')
  })

  it('announces loading and an honest empty state without offering a download', () => {
    const view = renderUI({ catalogStatus: 'loading', product: null })
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('button', { name: 'Download source code' })).not.toBeInTheDocument()
    view.rerender(<SourceCodeDownloadsUI {...props({ catalogStatus: 'empty', product: null })} />)
    expect(screen.getByRole('status')).toHaveTextContent('No Website Marketplace package is available yet.')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it.each(['sessionExpired', 'forbidden'])('offers a deliberate sign-in action for %s without displaying metadata', async catalogStatus => {
    const { values } = renderUI({ catalogStatus, product: null })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Website Marketplace' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in again' }))
    expect(values.signInAgain).toHaveBeenCalledTimes(1)
  })

  it('reports a load failure and supports keyboard retry', async () => {
    const { values } = renderUI({ catalogStatus: 'error', product: null })
    expect(screen.getByRole('alert')).toHaveTextContent('Source code could not be loaded.')
    const user = userEvent.setup()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Try again' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(values.reloadCatalog).toHaveBeenCalledTimes(1)
  })

  it('disables only the download while pending and announces the result', () => {
    const view = renderUI({ downloadState: { status: 'pending' } })
    expect(screen.getByRole('button', { name: 'Downloading…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Downloading…' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Downloading…')
    view.rerender(<SourceCodeDownloadsUI {...props({ downloadState: { status: 'success' } })} />)
    expect(screen.getByRole('status')).toHaveTextContent('The ZIP is ready.')
    expect(screen.getByRole('button', { name: 'Download source code' })).toBeEnabled()
  })

  it('keeps a failed download retryable and allows catalog refresh for a missing version', async () => {
    const view = renderUI({ downloadState: { status: 'error', error: 'failed' } })
    expect(screen.getByRole('alert')).toHaveTextContent('The download failed.')
    await userEvent.click(screen.getByRole('button', { name: 'Download source code' }))
    expect(view.values.downloadSource).toHaveBeenCalledTimes(1)
    const changed = props({ downloadState: { status: 'error', error: 'notFound' } })
    view.rerender(<SourceCodeDownloadsUI {...changed} />)
    expect(screen.getByRole('alert')).toHaveTextContent('This version is no longer available.')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(changed.reloadCatalog).toHaveBeenCalledTimes(1)
  })

  it('renders Markdown as text/React nodes, rejects script links and labels an English fallback', () => {
    renderUI({ product: { ...product, instructionsLocale: 'en', instructionsFallback: true, instructions: '<script>untrusted()</script>\n\n[unsafe](javascript:alert(1))\n\n[Docs](https://docs.example.test)' } })
    expect(screen.getByText('Instructions for this version are shown in English.')).toBeInTheDocument()
    expect(document.querySelector('script')).toBeNull()
    expect(screen.queryByRole('link', { name: 'unsafe' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it.each([
    ['integrityMismatch', 'The downloaded ZIP does not match the package information. Try again.'],
    ['verificationUnavailable', 'Your browser cannot verify this ZIP. Use a supported browser on HTTPS or localhost.']
  ])('announces the precise %s failure without claiming a verified download', (error, message) => {
    renderUI({ downloadState: { status: 'error', error } })
    expect(screen.getByRole('alert')).toHaveTextContent(message)
    expect(screen.queryByText('The ZIP is ready. Your browser will save it.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download source code' })).toBeEnabled()
  })

  it('keeps the collapsed menu keyboard-accessible and supports RTL themes', async () => {
    state.collapsed = true
    renderWithProviders(<SourceCodeDownloadsUI {...props()} />, { theme: { ...theme, rtl: true } })
    const user = userEvent.setup()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(state.collapse).toHaveBeenCalledWith(false)
    expect(screen.getByRole('button', { name: 'Download source code' })).toBeEnabled()
  })
})
