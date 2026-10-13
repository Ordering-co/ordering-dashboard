import React, { useEffect } from 'react'
import { useTheme } from 'styled-components'
import { useLanguage } from '../../../../index'
import { getDocsConnectView } from '../../../../components/DocsConnection/mode'
import { OrderingBrandFonts } from '../../styles/OrderingBrand'
import { PrimaryButton, SecondaryButton } from '../Login/AuthLayout/styles'
import { CheckIcon, CircleCheckIcon, ClockIcon, ShieldIcon } from '../Login/AuthLayout/icons'
import { SpinnerLoader } from '../Shared'
import { getDocsConnectContext, getDocsConnectCopy } from './copy'
import {
  ConsentPage,
  Card,
  Logo,
  Heading,
  Scope,
  Notice,
  Actions,
  TextButton,
  Status,
  Result
} from './styles'

export { getDocsConnectContext, getDocsConnectCopy } from './copy'

const closeWindow = () => {
  try {
    window.close()
  } catch {}
}

/**
 * Full-page, OAuth-style consent for docs.ordering.co. Rendered instead of the
 * Dashboard shell when the URL carries a valid `docs_connect` nonce (see
 * DocsConnection/mode.js). Sign-in reuses the normal login form.
 */
export const DocsConnectionConsent = ({
  loaded = true,
  auth,
  ready,
  requested,
  approved,
  connected,
  expired,
  purpose,
  project,
  user,
  connect,
  changeAccount,
  signInElement = null
}) => {
  const [, t] = useLanguage()
  const theme = useTheme()
  const logos = theme?.images?.logos || {}
  const view = getDocsConnectView({ loaded, auth, ready, connected, expired })

  useEffect(() => {
    if (view === 'connected') closeWindow()
  }, [view])

  if (view === 'loading') return null
  if (view === 'sign-in') return signInElement

  const copy = getDocsConnectCopy(purpose, t)
  const logo = (
    <Logo>
      <picture>
        <source media='(prefers-color-scheme: dark)' srcSet={logos.logotypeInvert} />
        <img src={logos.logotype} alt='Ordering.co' />
      </picture>
    </Logo>
  )

  return (
    <ConsentPage>
      <OrderingBrandFonts />
      <Card aria-labelledby='docs-connect-title'>
        {logo}
        {view === 'preparing' && (
          <Result role='status'>
            <SpinnerLoader />
            <p id='docs-connect-title'>{t('DOCS_CONNECT_PREPARING', 'Preparing your account…')}</p>
          </Result>
        )}

        {view === 'connected' && (
          <Result role='status'>
            <CircleCheckIcon />
            <p id='docs-connect-title'>{t('DOCS_CONNECT_DONE', 'Connected. You can close this window and return to docs.ordering.co.')}</p>
            <SecondaryButton type='button' onClick={closeWindow}>{t('DOCS_CONNECT_CLOSE', 'Close window')}</SecondaryButton>
          </Result>
        )}

        {view === 'expired' && (
          <Result role='alert' $tone='danger'>
            <ClockIcon />
            <p id='docs-connect-title'>{t('DOCS_CONNECT_EXPIRED', 'This request expired. Start again from docs.ordering.co.')}</p>
            <SecondaryButton type='button' onClick={closeWindow}>{t('DOCS_CONNECT_CLOSE', 'Close window')}</SecondaryButton>
          </Result>
        )}

        {view === 'consent' && (
          <>
            <Heading>
              <h1 id='docs-connect-title'>{copy.title}</h1>
              <p>{getDocsConnectContext(project, user?.email)}</p>
            </Heading>
            <Scope aria-labelledby='docs-connect-scope'>
              <h2 id='docs-connect-scope'>{t('DOCS_CONNECT_ALLOWS', 'This allows docs.ordering.co to:')}</h2>
              <ul>
                <li><CheckIcon /><span>{copy.scope}</span></li>
              </ul>
            </Scope>
            <Notice>
              <ShieldIcon />
              <span>{t('DOCS_CONNECT_SECURITY_NOTE', 'Only continue if you started this from docs.ordering.co just now.')}</span>
            </Notice>
            <Actions>
              <PrimaryButton type='button' onClick={connect} disabled={!requested || approved}>
                {approved
                  ? t('DOCS_CONNECT_CONNECTING', 'Connecting…')
                  : t('DOCS_CONNECT_CONFIRM', 'Connect this account')}
              </PrimaryButton>
              <SecondaryButton type='button' onClick={changeAccount}>
                {t('DOCS_CONNECT_OTHER', 'Use another project or account')}
              </SecondaryButton>
              <TextButton type='button' onClick={closeWindow}>{t('CANCEL', 'Cancel')}</TextButton>
              {!requested && !approved && (
                <Status role='status'>{t('DOCS_CONNECT_WAITING', 'Waiting for docs.ordering.co…')}</Status>
              )}
            </Actions>
          </>
        )}
      </Card>
    </ConsentPage>
  )
}
