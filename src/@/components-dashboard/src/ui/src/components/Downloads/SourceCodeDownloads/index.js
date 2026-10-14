import React, { useState } from 'react'
import { List as MenuIcon } from 'react-bootstrap-icons'
import { SourceCodeDownloads as SourceCodeDownloadsController } from '../../../../../components/SourceCodeDownloads'
import { useLanguage } from '../../../../../contexts/LanguageContext'
import { QUICKSTART_SETUP_PROMPT } from '../../../../../components/SourceCodeDownloads/public-source-repositories'
import { useSourceCodeTranslator } from '../../../../../components/SourceCodeDownloads/useSourceCodeTranslator'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { Page, Content, Header, MenuButton, Product, Action, RepositoryLink, Actions, State, RepositoryGrid, RepositorySection, Platform, CopyBlock } from './styles'

const ExternalLink = ({ href, children, ...props }) => <a href={href} target='_blank' rel='noopener noreferrer' {...props}>{children}</a>

const CopyText = ({ text, label, buttonLabel, t }) => {
  const [copyStatus, setCopyStatus] = useState('')
  const copy = async () => {
    setCopyStatus('pending')
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus('copied')
    } catch (_) {
      setCopyStatus('manual')
    }
  }
  return (
    <CopyBlock>
      <pre aria-label={label} dir='ltr'><code>{text}</code></pre>
      <Actions>
        <Action type='button' color='primary' outline borderRadius='4px' onClick={copy} disabled={copyStatus === 'pending'} aria-busy={copyStatus === 'pending'}>{buttonLabel}</Action>
        <span role='status' aria-label={label} aria-live='polite'>{copyStatus === 'copied'
          ? t('SOURCE_CODE_COPIED', 'Copied')
          : copyStatus === 'manual' ? t('SOURCE_CODE_COPY_FAILED', 'Copy failed. Select and copy the text above.') : ''}</span>
      </Actions>
    </CopyBlock>
  )
}

export const SourceCodeDownloadsUI = ({ catalogStatus, products = [], tools = [], signInAgain, signInError }) => {
  const [languageState, apiTranslator] = useLanguage()
  const t = useSourceCodeTranslator(apiTranslator, languageState.language)
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const descriptions = {
    'ordering-dashboard': t('SOURCE_CODE_DASHBOARD_DESCRIPTION', 'Manage your businesses, orders and project settings.'),
    'website-marketplace': t('SOURCE_CODE_MARKETPLACE_DESCRIPTION', 'A storefront for browsing businesses, ordering and tracking deliveries.'),
    'ordering-app-marketplace': t('SOURCE_CODE_CUSTOMER_DESCRIPTION', 'The customer ordering experience for iOS and Android.'),
    'ordering-app-business': t('SOURCE_CODE_BUSINESS_DESCRIPTION', 'Manage store operations and orders from a mobile app.'),
    'ordering-app-driver': t('SOURCE_CODE_DRIVER_DESCRIPTION', 'Manage assigned deliveries and their progress from a mobile app.'),
    'ordering-website-franchises': t('SOURCE_CODE_FRANCHISE_WEB_DESCRIPTION', 'A franchise storefront with business selection and ordering.'),
    'ordering-app-franchises': t('SOURCE_CODE_FRANCHISE_APP_DESCRIPTION', 'The franchise customer experience for iOS and Android.'),
    'ordering-dev-quickstart': t('SOURCE_CODE_QUICKSTART_DESCRIPTION', 'Sign in to Ordering and connect your AI agent through MCP. Product setup follows each repository’s instructions.'),
    'ordering-mcp-plugin': t('SOURCE_CODE_PLUGIN_DESCRIPTION', 'Add Ordering platform knowledge to your agent. The plugin requires an existing MCP connection; it does not replace sign-in or configure the products.')
  }
  const platformLabels = {
    web: t('SOURCE_CODE_WEB', 'Web'),
    mobile: t('SOURCE_CODE_MOBILE', 'Mobile app'),
    tool: t('SOURCE_CODE_TOOL', 'Developer tool')
  }
  const renderRepository = repository => (
    <Product key={repository.id} aria-labelledby={`source-${repository.id}`}>
      <h3 id={`source-${repository.id}`}>{repository.name}</h3>
      <Platform>{platformLabels[repository.platform]}</Platform>
      <p>{descriptions[repository.id]}</p>
      <Actions>
        <RepositoryLink href={repository.url} target='_blank' rel='noopener noreferrer' color='primary' borderRadius='4px'>{t('SOURCE_CODE_VIEW_REPOSITORY', 'View repository')}</RepositoryLink>
        <ExternalLink href={repository.forkUrl}>{t('SOURCE_CODE_FORK', 'Create a fork')}</ExternalLink>
      </Actions>
      <Actions>
        <ExternalLink href={repository.readmeUrl}>README</ExternalLink>
        {repository.setupUrl && <ExternalLink href={repository.setupUrl}>{t('SOURCE_CODE_SETUP', 'Setup instructions')}</ExternalLink>}
      </Actions>
      <CopyText text={repository.cloneCommand} label={t('SOURCE_CODE_CLONE_COMMAND', 'Clone command')} buttonLabel={t('SOURCE_CODE_COPY_CLONE', 'Copy clone command')} t={t} />
      {repository.id === 'ordering-dev-quickstart' && (
        <details>
          <summary>{t('SOURCE_CODE_QUICKSTART_PROMPT', 'Connect your agent via MCP')}</summary>
          <CopyText text={QUICKSTART_SETUP_PROMPT} label={t('SOURCE_CODE_QUICKSTART_PROMPT', 'Connect your agent via MCP')} buttonLabel={t('SOURCE_CODE_COPY_PROMPT', 'Copy setup prompt')} t={t} />
        </details>
      )}
    </Product>
  )
  return (
    <Page aria-labelledby='source-code-title'>
      <Content>
        <Header>
          {isCollapse && <MenuButton type='button' color='black' aria-label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)}><MenuIcon aria-hidden='true' /></MenuButton>}
          <h1 id='source-code-title'>{t('SOURCE_CODE_TITLE', 'Open Source Code')}</h1>
        </Header>
        <p>{t('SOURCE_CODE_PUBLIC_INTRO', 'Get the code on GitHub. Choose a product, read its instructions, then clone it or create a fork to make your own changes.')}</p>
        {catalogStatus !== 'ready' && (
          <State role={catalogStatus === 'loading' ? 'status' : 'alert'} aria-live={catalogStatus === 'loading' ? 'polite' : 'assertive'} aria-busy={catalogStatus === 'loading'}>
            {catalogStatus === 'loading' && <p>{t('SOURCE_CODE_LOADING', 'Loading source code…')}</p>}
            {catalogStatus === 'sessionExpired' && <p>{t('SOURCE_CODE_SESSION_EXPIRED', 'Your session has expired. Sign in again to continue.')}</p>}
            {catalogStatus === 'forbidden' && <p>{t('SOURCE_CODE_FORBIDDEN', 'Source code is available to administrators only.')}</p>}
            {signInError && <p>{t('SOURCE_CODE_SIGN_IN_ERROR', 'Could not sign in. Try again.')}</p>}
            {catalogStatus !== 'loading' && <Action type='button' color='primary' borderRadius='4px' onClick={signInAgain}>{t('SOURCE_CODE_SIGN_IN', 'Sign in again')}</Action>}
          </State>
        )}
        {catalogStatus === 'ready' && <>
          <p>{t('SOURCE_CODE_PUBLIC_ACCESS', 'Public repositories can be cloned without GitHub organization membership. Creating a fork requires your own GitHub account.')}</p>
          <p>{t('SOURCE_CODE_PROJECT_ACCESS', 'Ordering APIs and data require your own project and the appropriate permissions. Check each repository’s requirements and license before use.')}</p>
          <RepositorySection aria-labelledby='source-products-title'>
            <h2 id='source-products-title'>{t('SOURCE_CODE_PRODUCTS', 'Products')}</h2>
            <RepositoryGrid>{products.map(renderRepository)}</RepositoryGrid>
          </RepositorySection>
          <RepositorySection aria-labelledby='source-tools-title'>
            <h2 id='source-tools-title'>{t('SOURCE_CODE_TOOLS', 'Developer tools')}</h2>
            <RepositoryGrid>{tools.map(renderRepository)}</RepositoryGrid>
          </RepositorySection>
        </>}
      </Content>
    </Page>
  )
}

export const SourceCodeDownloads = props => <SourceCodeDownloadsController {...props} UIComponent={SourceCodeDownloadsUI} />
