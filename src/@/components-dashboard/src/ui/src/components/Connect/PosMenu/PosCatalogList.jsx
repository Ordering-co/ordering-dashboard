import React, { useState } from 'react'
import { useTheme } from 'styled-components'

import { ToastType, useLanguage, useToast } from '../../../../../index'
import { findConnectedPosIntegration } from '../../../../../utils/posPluginCatalog'
import { ExternalLink } from '../../Shared/Icon'
import { Button, ConfirmDialog, Skeleton, Status } from '../../Shared/Product'
import { fillName } from './posMenuModel'
import './pos-store-panel.css'

// One pass with a replacer function, as fillName: a `$` in a name stays a `$`.
const fillInstall = (template, { name, current }) => String(template).replace(/_name_|_current_/g, token => String(token === '_name_' ? name : current ?? ''))

/**
 * «Other POS systems» of the store panel (C13 to C17): one row per option of the model (`catalogOptions`, the ones the store is
 * not connected to), in main's order. The action of a row is its option's `action`:
 *  - `book_call`: a link to the setup call in another tab (Checkmate, Deliverect; PM-05), named after the POS; a disabled «Contact admin» for
 *    anyone but an administrator (main , Calendly is for administrators; `restricted` in any option does the same);
 *  - `install`: asks first (C16) and then installs the plugin for the project (W2); a store with no POS also gets it connected (W3);
 *  - `connect`: connects the store to the installed POS (W3);
 *  - `contact_admin`: no button, the note says to contact the administrator (level 2);
 *  - `check_again` (main #399): the plugin is still finishing its install; reads it once and connects the store when it is done
 *    (not when the store already has its POS, `keepsCurrentPos`);
 *  - `null`: nothing.
 * main #399 and #394: a row shows the install state of its plugin (Installing, Install failed with the API's reason) and a Connect
 * that cannot run is off (failed install, disabled plugin, a store that already has its POS).
 * Everything runs through the handlers of the controller and of the list; the panel hears about the failures and about the POS that
 * has just been connected (`onRequestError`, `onConnected`) to tell the user and to focus its card.
 */
export const PosCatalogList = ({
  options,
  loading,
  business,
  integrations,
  handleInstallPosIntegration,
  handleConnectBusiness,
  getIntegrations,
  updateBusiness,
  onConnected,
  onRequestError,
  handleCheckPluginInstall,
  keepsCurrentPos = false
}) => {
  const [, t] = useLanguage()
  const theme = useTheme()
  const [, { showToast }] = useToast()
  // The option being confirmed stays while the dialog fades out
  const [install, setInstall] = useState({ open: false, option: null, current: null })

  if (loading) {
    return (
      <div className='psp-skeleton' role='status' aria-busy='true' aria-label={t('LOADING', 'Loading')}>
        <Skeleton block='var(--od-x-control-height)' />
        <Skeleton block='var(--od-x-control-height)' />
        <Skeleton block='var(--od-x-control-height)' />
      </div>
    )
  }

  const labelOf = (name) => t(String(name || 'INTEGRATION').toUpperCase(), name || 'Integration')

  const askInstall = (option) => {
    const { integration } = option
    if (!integration.plugin_root) {
      showToast(ToastType.Error, t('INTEGRATION_PLUGIN_NOT_FOUND', 'Plugin is needed to connect to this integration'))
      return
    }
    const current = integration.type === 'pos' ? findConnectedPosIntegration(business, integrations) : null
    setInstall({ open: true, option, current })
  }

  const confirmInstall = async () => {
    const { option, current } = install
    const { integration } = option
    setInstall(previous => ({ ...previous, open: false }))
    try {
      if (current) {
        // the store keeps the POS it has
        await handleInstallPosIntegration(integration)
        return
      }
      const result = await handleInstallPosIntegration(integration)
      if (!result?.installed) return
      if (!result.integration) {
        updateBusiness?.()
        return
      }
      await handleConnectBusiness(result.integration.id, { enabled: true }, () => {
        updateBusiness?.()
        onConnected?.(result.integration.id)
      })
    } catch (error) {
      onRequestError?.(error)
    }
  }

  const connect = async (option) => {
    const { integration } = option
    try {
      await handleConnectBusiness(integration.id, { enabled: true }, () => {
        getIntegrations?.()
        updateBusiness?.()
        onConnected?.(integration.id)
      })
    } catch (error) {
      onRequestError?.(error)
    }
  }

  // main #399: «Check again» reads the plugin once; when it is done the store connects to it, as after a quick install, unless the
  // store already has its POS
  const checkAgain = async (option) => {
    try {
      const result = await handleCheckPluginInstall?.(option.integration)
      const installed = result?.integration
      if (!installed) return
      if (keepsCurrentPos) {
        updateBusiness?.()
        return
      }
      await handleConnectBusiness(installed.id, { enabled: true }, () => {
        updateBusiness?.()
        onConnected?.(installed.id)
      })
    } catch (error) {
      onRequestError?.(error)
    }
  }

  // main #399: a logo that does not load shows the default logo, once; with none, the box stays empty (PM-07, no broken icon)
  const logoFailed = (event) => {
    const image = event.currentTarget
    const fallback = theme?.images?.dummies?.businessLogo
    if (fallback && !image.dataset.fallback) {
      image.dataset.fallback = 'true'
      image.src = fallback
      return
    }
    image.style.visibility = 'hidden'
  }

  const renderAction = (option, posName) => {
    // main, the setup call, Install, Connect and Setup of a Calendly integration are a disabled «Contact admin»
    // for anyone but an administrator (the model says so with `restricted`)
    if (option.restricted) {
      return (
        <Button disabled aria-label={`${t('CONTACT_ADMIN', 'Contact admin')} · ${posName}`}>
          {t('CONTACT_ADMIN', 'Contact admin')}
        </Button>
      )
    }
    switch (option.action) {
      case 'book_call':
        return (
          // The same classes as the Product button, on a link: Base UI's Button would give it role=button
          <a
            className='odc-btn'
            data-variant='secondary'
            data-size='md'
            href={option.href}
            target='_blank'
            rel='noopener noreferrer'
            // redesign PM-R2: the name starts with the visible text (label in name), then the POS
            aria-label={`${t('POS_MENU_BOOK_SETUP_CALL', 'Book setup call')} · ${posName}`}
          >
            {t('POS_MENU_BOOK_SETUP_CALL', 'Book setup call')}
            <ExternalLink className='odc-icon' />
          </a>
        )
      case 'contact_us':
        return (
          <a
            className='odc-btn'
            data-variant='secondary'
            data-size='md'
            href={option.href}
            target='_blank'
            rel='noopener noreferrer'
            aria-label={`${t('CONTACT_US', 'Contact us')} · ${posName}`}
          >
            {t('CONTACT_US', 'Contact us')}
            <ExternalLink className='odc-icon' />
          </a>
        )
      case 'install':
        return (
          <Button
            busy={option.busy}
            disabled={option.disabled}
            aria-label={option.busy ? undefined : fillName(t('POS_MENU_INSTALL_CONFIRM', 'Install _pos_'), { pos: posName })}
            onClick={() => askInstall(option)}
          >
            {option.busy ? t('INSTALLING', 'Installing...') : t('INSTALL', 'Install')}
          </Button>
        )
      case 'connect':
        return (
          <Button
            disabled={option.disabled}
            aria-label={fillName(t('POS_MENU_CONNECT_POS', 'Connect _pos_'), { pos: posName })}
            onClick={() => connect(option)}
          >
            {t('CONNECT', 'Connect')}
          </Button>
        )
      case 'check_again':
        return (
          <Button
            busy={option.checking}
            disabled={option.disabled}
            aria-label={option.checking ? undefined : `${t('CHECK_AGAIN', 'Check again')} · ${posName}`}
            onClick={() => checkAgain(option)}
          >
            {option.checking ? t('CHECKING', 'Checking...') : t('CHECK_AGAIN', 'Check again')}
          </Button>
        )
      case 'contact_admin':
        return <span className='psp-note'>{t(option.noteKey, option.noteDefault)}</span>
      default:
        return null
    }
  }

  // (main #485): a row blocked by the store's POS says so itself, names that POS and how to switch
  const currentPos = options.some(option => option.blockedByPos) ? findConnectedPosIntegration(business, integrations) : null
  const blockedHelp = (name) => fillInstall(
    t('POS_CONNECT_BLOCKED_HELP', 'This store already uses _current_. To connect _name_, open _current_ and choose Disconnect.'),
    { name, current: currentPos?.name }
  )

  const pending = install.option
  const pendingName = pending ? labelOf(pending.integration.name) : ''

  return (
    <>
      <ul className='psp-catalog'>
        {options.map((option) => {
          const isCall = option.kind === 'call'
          const logo = isCall ? theme?.images?.general?.[option.logoKey] : option.integration?.logo
          const name = isCall ? option.name : labelOf(option.integration?.name)
          return (
            <li key={option.key} className='psp-row'>
              {/* The name is written beside the logo, so the image is decorative (alt=''). The wordmarks of the setup-call providers are wide:
                  , they get a box of their own instead of the square of a POS mark */}
              {logo
                ? <img className={isCall ? 'psp-logo psp-logo-wordmark' : 'psp-logo'} src={logo} alt='' onError={logoFailed} />
                : <span className='psp-logo' aria-hidden='true' />}
              <span className='psp-row-text'>
                <span className='psp-row-name'>{name}</span>
                {option.installState === 'installing' && <Status family='pending' label={t('INTEGRATION_PLUGIN_INSTALLING', 'Installing')} />}
                {option.installState === 'failed' && <Status family='cancel' label={t('INTEGRATION_PLUGIN_INSTALL_FAILED_NOTE', 'Install failed')} />}
                {option.blockedByPos && currentPos && (
                  <>
                    <Status family='review' label={t('POS_CONNECT_BLOCKED', 'Another POS connected')} />
                    <span className='psp-note'>{blockedHelp(name)}</span>
                  </>
                )}
                {option.installMessage && <span className='psp-note psp-note-danger' dir='auto'>{option.installMessage}</span>}
                {option.busy
                  ? <span className='psp-note'>{t('INTEGRATION_PLUGIN_INSTALLING_REQUEST', 'Installing plugin...')}</span>
                  : option.noteKey && option.action !== 'contact_admin' && (
                    <span className='psp-note'>{t(option.noteKey, option.noteDefault)}</span>
                  )}
              </span>
              <span className='psp-row-action'>{renderAction(option, name)}</span>
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        open={install.open}
        tone='primary'
        title={fillName(t('POS_MENU_INSTALL_TITLE', 'Install _pos_ for the whole project?'), { pos: pendingName })}
        confirmLabel={fillName(t('POS_MENU_INSTALL_CONFIRM', 'Install _pos_'), { pos: pendingName })}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={confirmInstall}
        onCancel={() => setInstall(previous => ({ ...previous, open: false }))}
      >
        {pending && (install.current
          ? fillInstall(
            t('INSTALL_POS_PLUGIN_KEEP_CURRENT_CONFIRM', 'This installs _name_ for the whole project. This store stays connected to _current_.'),
            { name: pending.integration.name, current: install.current.name }
          )
          : fillInstall(
            t('INSTALL_POS_PLUGIN_CONFIRM', 'This installs _name_ for the whole project and connects it to this store.'),
            { name: pending.integration.name }
          ))}
      </ConfirmDialog>
    </>
  )
}
