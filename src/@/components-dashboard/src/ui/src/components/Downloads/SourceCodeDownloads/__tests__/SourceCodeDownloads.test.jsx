import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, within } from '@testing-library/react'
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
  it('puts Dev Quick Start before seven products and the optional plugin', () => {
    renderUI()
    expect(within(screen.getByRole('region', { name: 'Products' })).getAllByRole('article')).toHaveLength(7)
    expect(within(screen.getByRole('region', { name: 'Optional tools' })).getAllByRole('article')).toHaveLength(1)
    const articles = screen.getAllByRole('article')
    expect(articles[0]).toHaveAccessibleName('Dev Quick Start')
    expect(articles.at(-1)).toHaveAccessibleName('MCP plugin and skill')
    const quickstart = articles[0]
    expect(within(quickstart).getByText(QUICKSTART_SETUP_PROMPT).closest('details')).toBeNull()
    expect(within(quickstart).getByText(/configures all seven/)).toHaveTextContent(/asks which to start locally/)
    expect(screen.queryByText(/Download source code|checksum|ZIP|Published \(CST/)).not.toBeInTheDocument()
    expect(screen.getByText(/Creating a fork requires your own GitHub account/)).toBeInTheDocument()
    expect(screen.getByText(/appropriate permissions/)).toBeInTheDocument()
  })
  it.each([...PUBLIC_SOURCE_PRODUCTS, ...PUBLIC_SOURCE_TOOLS])('keeps safe repository links and clone in secondary developer options for $name', async repository => {
    renderUI()
    const article = screen.getByRole('article', { name: repository.id === 'ordering-dev-quickstart' ? 'Dev Quick Start' : repository.name })
    await userEvent.setup().click(within(article).getByText('Developer options'))
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
      const article = screen.getByRole('article', { name: repository.id === 'ordering-dev-quickstart' ? 'Dev Quick Start' : repository.name })
      await user.click(within(article).getByText('Developer options'))
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
    const button = within(article).getByRole('button', { name: 'Copy setup prompt' })
    button.focus()
    await user.keyboard('{Enter}')
    expect(button).toHaveFocus()
    expect(within(article).getByRole('status', { name: 'Setup prompt' })).toHaveTextContent('Copy failed. Select and copy the text.')
    expect(within(article).getByText(PUBLIC_SOURCE_PRODUCTS[0].setupPrompt)).toBeVisible()
    await user.keyboard('{Enter}')
    expect(within(article).getByRole('status', { name: 'Setup prompt' })).toHaveTextContent('Copied')
    expect(writeText).toHaveBeenCalledTimes(2)
  })
  it('opens the exact prompt for manual copying when the clipboard API is unavailable', async () => {
    const user = userEvent.setup()
    const clipboard = navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    try {
      renderUI()
      const article = screen.getByRole('article', { name: 'Dashboard' })
      await user.click(within(article).getByRole('button', { name: 'Copy setup prompt' }))
      expect(within(article).getByText(PUBLIC_SOURCE_PRODUCTS[0].setupPrompt)).toBeVisible()
      expect(within(article).getByRole('status', { name: 'Setup prompt' })).toHaveTextContent('Copy failed. Select and copy the text.')
    } finally {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard })
    }
  })
  it('disables the primary action while clipboard completion is pending', async () => {
    const user = userEvent.setup()
    let complete
    vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(() => new Promise(resolve => { complete = resolve }))
    renderUI()
    const article = screen.getByRole('article', { name: 'Dashboard' })
    const button = within(article).getByRole('button', { name: 'Copy setup prompt' })
    await user.click(button)
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await act(async () => complete())
    expect(button).toBeEnabled()
    expect(within(article).getByRole('status', { name: 'Setup prompt' })).toHaveTextContent('Copied')
  })
  it('copies the canonical connection prompt and seven exact setup prompts as primary actions', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    renderUI()
    const quickstart = screen.getByRole('article', { name: 'Dev Quick Start' })
    await user.click(within(quickstart).getByRole('button', { name: 'Copy setup prompt' }))
    expect(writeText).toHaveBeenLastCalledWith(QUICKSTART_SETUP_PROMPT)
    for (const repository of PUBLIC_SOURCE_PRODUCTS) {
      const article = screen.getByRole('article', { name: repository.name })
      const developerOptions = within(article).getByText('Developer options').closest('details')
      const copy = within(article).getByRole('button', { name: 'Copy setup prompt' })
      expect(developerOptions).not.toHaveAttribute('open')
      expect(developerOptions).not.toContainElement(copy)
      await user.click(copy)
      expect(writeText).toHaveBeenLastCalledWith(repository.setupPrompt)
      expect(within(article).getByRole('status', { name: 'Setup prompt' })).toHaveTextContent('Copied')
      await user.click(within(article).getByText('View setup prompt'))
      expect(within(article).getByText(repository.setupPrompt)).toBeVisible()
    }
    expect(screen.getAllByRole('button', { name: 'Copy setup prompt' })).toHaveLength(8)
    expect(screen.getByText(/it does not replace sign-in or configure the products/)).toBeInTheDocument()
  })
  it.each(['es', 'ar'])('uses the bundled %s translations with no API labels', locale => {
    state.language = { code: locale }
    renderUI({}, { ...theme, rtl: locale === 'ar' })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(labels.SOURCE_CODE_TITLE[locale])
    expect(labels).toHaveProperty('SOURCE_CODE_OPTIONAL_TOOLS')
    expect(screen.getByRole('region', { name: labels.SOURCE_CODE_OPTIONAL_TOOLS[locale] })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: labels.SOURCE_CODE_COPY_PROMPT[locale] })).toHaveLength(8)
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
