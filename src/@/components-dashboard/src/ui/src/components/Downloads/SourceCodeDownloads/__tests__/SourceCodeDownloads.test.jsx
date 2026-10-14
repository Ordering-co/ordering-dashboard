import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'
import { PUBLIC_SOURCE_PRODUCTS, PUBLIC_SOURCE_TOOLS, QUICKSTART_SETUP_PROMPT } from '../../../../../../components/SourceCodeDownloads/public-source-repositories'
import labels from '../../../../../../components/SourceCodeDownloads/sourceCodeTranslations.generated.json'
const state = vi.hoisted(() => ({ collapsed: false, collapse: vi.fn(), language: { code: 'en' }, apiLabels: {} }))
vi.mock('../../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{ language: state.language }, (key, fallback) => state.apiLabels[`DASHBOARD_${key}`] ?? fallback] }))
vi.mock('../../../../contexts/InfoShareContext', () => ({ useInfoShare: () => [{ isCollapse: state.collapsed }, { handleMenuCollapse: state.collapse }] }))
import { SourceCodeDownloadsUI } from '../index'
const renderUI = (overrides = {}, customTheme = theme) => renderWithProviders(<SourceCodeDownloadsUI catalogStatus='ready' products={PUBLIC_SOURCE_PRODUCTS} tools={PUBLIC_SOURCE_TOOLS} {...overrides} />, { theme: customTheme })
beforeEach(() => { state.collapsed = false; state.collapse.mockClear(); state.language = { code: 'en' }; state.apiLabels = {} })
afterEach(() => vi.restoreAllMocks())
describe('public repository presentation', () => {
  it('separates seven products from two tools and contains no package/download metadata', () => {
    renderUI()
    expect(within(screen.getByRole('region', { name: 'Products' })).getAllByRole('article')).toHaveLength(7)
    expect(within(screen.getByRole('region', { name: 'Developer tools' })).getAllByRole('article')).toHaveLength(2)
    expect(screen.queryByText(/Download source code|checksum|ZIP|Published \(CST/)).not.toBeInTheDocument()
    expect(screen.getByText(/Creating a fork requires your own GitHub account/)).toBeInTheDocument()
    expect(screen.getByText(/appropriate permissions/)).toBeInTheDocument()
  })
  it.each([...PUBLIC_SOURCE_PRODUCTS, ...PUBLIC_SOURCE_TOOLS])('offers verified public links and the exact clone for $name', repository => {
    renderUI()
    const article = screen.getByRole('article', { name: repository.name })
    expect(within(article).getByRole('link', { name: 'View repository' })).toHaveAttribute('href', repository.url)
    expect(within(article).getByRole('link', { name: 'README' })).toHaveAttribute('href', repository.readmeUrl)
    expect(within(article).getByRole('link', { name: 'Create a fork' })).toHaveAttribute('href', repository.forkUrl)
    expect(within(article).getByText(repository.cloneCommand)).toBeInTheDocument()
    if (repository.setupUrl) expect(within(article).getByRole('link', { name: 'Setup instructions' })).toHaveAttribute('href', repository.setupUrl)
    for (const link of within(article).getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      expect(link.getAttribute('href')).toMatch(/^https:\/\/github.com\/Ordering-co\//)
    }
  })
  it('copies all nine exact clone commands, including six pinned submodule checkouts', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    renderUI()
    const repos = [...PUBLIC_SOURCE_PRODUCTS, ...PUBLIC_SOURCE_TOOLS]
    for (const repository of repos) {
      const article = screen.getByRole('article', { name: repository.name })
      await user.click(within(article).getByRole('button', { name: 'Copy clone command' }))
      expect(writeText).toHaveBeenLastCalledWith(repository.cloneCommand)
      expect(within(article).getByRole('status', { name: 'Clone command' })).toHaveTextContent('Copied')
    }
    expect(repos.filter(repo => repo.cloneCommand.includes('--recurse-submodules'))).toHaveLength(6)
    expect(writeText).toHaveBeenCalledTimes(9)
  })
  it('keeps copy failure text selectable and retries successfully with keyboard focus', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied')).mockResolvedValue()
    renderUI()
    const article = screen.getByRole('article', { name: 'Dashboard' })
    const button = within(article).getByRole('button', { name: 'Copy clone command' })
    button.focus()
    await user.keyboard('{Enter}')
    expect(button).toHaveFocus()
    expect(within(article).getByRole('status', { name: 'Clone command' })).toHaveTextContent('Copy failed. Select and copy the text above.')
    expect(within(article).getByText(PUBLIC_SOURCE_PRODUCTS[0].cloneCommand)).toBeInTheDocument()
    await user.keyboard('{Enter}')
    expect(within(article).getByRole('status', { name: 'Clone command' })).toHaveTextContent('Copied')
    expect(writeText).toHaveBeenCalledTimes(2)
  })
  it('offers only the published Quickstart MCP prompt, without implying product onboarding', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    renderUI()
    const quickstart = screen.getByRole('article', { name: 'Developer Quickstart' })
    await user.click(within(quickstart).getByText('Connect your agent via MCP'))
    await user.click(within(quickstart).getByRole('button', { name: 'Copy setup prompt' }))
    expect(writeText).toHaveBeenLastCalledWith(QUICKSTART_SETUP_PROMPT)
    expect(screen.getAllByRole('button', { name: 'Copy setup prompt' })).toHaveLength(1)
    expect(screen.getByText(/it does not replace sign-in or configure the products/)).toBeInTheDocument()
  })
  it.each(['es', 'ar'])('uses the bundled %s translations with no API labels', locale => {
    state.language = { code: locale }
    renderUI({}, { ...theme, rtl: locale === 'ar' })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(labels.SOURCE_CODE_TITLE[locale])
    expect(screen.getByRole('region', { name: labels.SOURCE_CODE_TOOLS[locale] })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: labels.SOURCE_CODE_COPY_CLONE[locale] })).toHaveLength(9)
  })
  it('preserves nonempty namespaced API labels', () => {
    state.apiLabels = { DASHBOARD_SOURCE_CODE_TITLE: 'Controlled title' }
    renderUI()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Controlled title')
  })
  it.each(['loading', 'sessionExpired', 'forbidden'])('hides repository actions for %s and preserves session feedback', status => {
    renderUI({ catalogStatus: status })
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(screen.getByRole(status === 'loading' ? 'status' : 'alert')).toBeInTheDocument()
  })
  it('preserves the collapsed menu and deliberate sign-in action for keyboard users', async () => {
    state.collapsed = true
    const signInAgain = vi.fn()
    renderUI({ catalogStatus: 'forbidden', signInAgain, signInError: true })
    const user = userEvent.setup()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(state.collapse).toHaveBeenCalledWith(false)
    await user.tab()
    await user.keyboard('{Enter}')
    expect(signInAgain).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not sign in. Try again.')
  })
})
