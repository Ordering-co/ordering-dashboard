import React from 'react'
import { List as MenuIcon } from 'react-bootstrap-icons'
import { SourceCodeDownloads as SourceCodeDownloadsController, useLanguage } from '../../../../../index'
import { useSourceCodeTranslator } from '../../../../../components/SourceCodeDownloads/useSourceCodeTranslator'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { SourceCodeMarkdown } from './SourceCodeMarkdown'
import { Page, Content, Header, MenuButton, Product, Metadata, Action, Actions, State, DownloadStatus, Instructions, Details, LicenseText } from './styles'

export const SourceCodeDownloadsUI = ({ catalogStatus, catalogError, product, downloadState, reloadCatalog, downloadSource, signInAgain }) => {
  const [languageState, apiTranslator] = useLanguage()
  const t = useSourceCodeTranslator(apiTranslator, languageState.language)
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const sessionIssue = catalogStatus === 'sessionExpired' || catalogStatus === 'forbidden'
  return (
    <Page aria-labelledby='source-code-title'>
      <Content>
        <Header>
          {isCollapse && (
            <MenuButton type='button' color='black' aria-label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)}>
              <MenuIcon aria-hidden='true' />
            </MenuButton>
          )}
          <h1 id='source-code-title'>{t('SOURCE_CODE_TITLE', 'Open Source Code')}</h1>
        </Header>
        <p>{t('SOURCE_CODE_INTRO', 'Download Website Marketplace source code and follow the instructions for the available version.')}</p>

        {catalogStatus !== 'ready' && (
          <State role={catalogStatus === 'loading' || catalogStatus === 'empty' ? 'status' : 'alert'} aria-live={catalogStatus === 'loading' || catalogStatus === 'empty' ? 'polite' : 'assertive'} aria-busy={catalogStatus === 'loading'}>
            {catalogStatus === 'loading' && <p>{t('SOURCE_CODE_LOADING', 'Loading source code…')}</p>}
            {catalogStatus === 'empty' && <p>{t('SOURCE_CODE_EMPTY', 'No Website Marketplace package is available yet.')}</p>}
            {catalogStatus === 'error' && <p>{catalogError === 'invalidCatalog'
              ? t('SOURCE_CODE_INVALID_CATALOG', 'Package information is incomplete. Try again later.')
              : t('SOURCE_CODE_CATALOG_ERROR', 'Source code could not be loaded. Try again.')}</p>}
            {catalogStatus === 'sessionExpired' && <p>{t('SOURCE_CODE_SESSION_EXPIRED', 'Your session has expired. Sign in again to continue.')}</p>}
            {catalogStatus === 'forbidden' && <p>{t('SOURCE_CODE_FORBIDDEN', 'Source code is available to administrators and business owners.')}</p>}
            {(catalogStatus === 'error' || catalogStatus === 'empty') && <Action type='button' color='primary' borderRadius='4px' onClick={reloadCatalog}>{t('SOURCE_CODE_RETRY', 'Try again')}</Action>}
            {sessionIssue && <Action type='button' color='primary' borderRadius='4px' onClick={signInAgain}>{t('SOURCE_CODE_SIGN_IN', 'Sign in again')}</Action>}
          </State>
        )}

        {catalogStatus === 'ready' && product && (
          <Product aria-labelledby='source-code-product'>
            <h2 id='source-code-product'>{product.name}</h2>
            <p lang={product.descriptionLocale}>{product.description}</p>
            <Metadata>
              <div><dt>{t('SOURCE_CODE_VERSION', 'Version')}</dt><dd><code dir='ltr'>{product.version}</code></dd></div>
              <div><dt>{t('SOURCE_CODE_PUBLISHED', 'Published (CST · UTC−06:00)')}</dt><dd><time dateTime={product.publishedAt}>{product.publishedLabel}</time></dd></div>
              <div><dt>{t('SOURCE_CODE_LICENSE', 'License')}</dt><dd>{product.license.id}</dd></div>
            </Metadata>
            <Actions>
              <Action type='button' color='primary' borderRadius='4px' disabled={downloadState.status === 'pending'} aria-busy={downloadState.status === 'pending'} onClick={downloadSource}>
                {downloadState.status === 'pending' ? t('SOURCE_CODE_DOWNLOADING', 'Downloading…') : t('SOURCE_CODE_DOWNLOAD', 'Download source code')}
              </Action>
              <span>{t('SOURCE_CODE_FILE_SIZE', '_size_ bytes').replace('_size_', product.sizeLabel)}</span>
            </Actions>
            {downloadState.status !== 'idle' && (
              <DownloadStatus role={downloadState.status === 'error' ? 'alert' : 'status'} aria-live={downloadState.status === 'error' ? 'assertive' : 'polite'}>
                {downloadState.status === 'pending' && <span>{t('SOURCE_CODE_DOWNLOADING', 'Downloading…')}</span>}
                {downloadState.status === 'success' && <span>{t('SOURCE_CODE_DOWNLOAD_SUCCESS', 'The ZIP is ready. Your browser will save it.')}</span>}
                {downloadState.status === 'error' && <p>{downloadState.error === 'notFound'
                  ? t('SOURCE_CODE_DOWNLOAD_UNAVAILABLE', 'This version is no longer available. Refresh the catalog.')
                  : downloadState.error === 'integrityMismatch'
                    ? t('SOURCE_CODE_INTEGRITY_MISMATCH', 'The downloaded ZIP does not match the package information. Try again.')
                    : downloadState.error === 'verificationUnavailable'
                      ? t('SOURCE_CODE_VERIFY_UNAVAILABLE', 'Your browser cannot verify this ZIP. Use a supported browser on HTTPS or localhost.')
                      : t('SOURCE_CODE_DOWNLOAD_ERROR', 'The download failed. Try again.')}</p>}
                {downloadState.status === 'error' && downloadState.error === 'notFound' && <Action type='button' color='primary' outline borderRadius='4px' onClick={reloadCatalog}>{t('SOURCE_CODE_RETRY', 'Try again')}</Action>}
              </DownloadStatus>
            )}
            <Instructions aria-labelledby='source-code-instructions'>
              <h3 id='source-code-instructions'>{t('SOURCE_CODE_INSTALLATION', 'Installation instructions')}</h3>
              {product.instructionsFallback && <p>{t('SOURCE_CODE_ENGLISH_CONTENT', 'Instructions for this version are shown in English.')}</p>}
              <div lang={product.instructionsLocale}><SourceCodeMarkdown text={product.instructions} /></div>
            </Instructions>
            <Details>
              <summary>{t('SOURCE_CODE_LICENSE', 'License')} · {product.license.id}</summary>
              <LicenseText lang='en' dir='ltr'>{product.license.text}</LicenseText>
            </Details>
            <Details>
              <summary>{t('SOURCE_CODE_PROVENANCE', 'Source and checksum')}</summary>
              <dl>
                <dt>{t('SOURCE_CODE_SOURCE_SHA', 'Source commit')}</dt><dd><code>{product.sourceSha}</code></dd>
                <dt>{t('SOURCE_CODE_FILE', 'ZIP file')}</dt><dd><code>{product.artifact.filename}</code></dd>
                <dt>{t('SOURCE_CODE_CHECKSUM', 'ZIP SHA-256')}</dt><dd><code>{product.artifact.sha256}</code></dd>
                {product.submodules.length > 0 && <><dt>{t('SOURCE_CODE_SUBMODULES', 'Included submodules')}</dt><dd><ul>{product.submodules.map(item => <li key={item.path}><code>{item.path}</code><br /><code>{item.sha}</code></li>)}</ul></dd></>}
              </dl>
            </Details>
          </Product>
        )}
      </Content>
    </Page>
  )
}

export const SourceCodeDownloads = props => <SourceCodeDownloadsController {...props} UIComponent={SourceCodeDownloadsUI} />
