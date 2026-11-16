import React, { useId, useRef, useState } from 'react'

import { useApi, useLanguage } from '../../../../../../index'
import { CLOUDFLARE_DEPLOYMENT_PROVIDER } from '../../../../../../components/OrderingWebsite/constants'
import { useProjectState } from '../../../../contexts/ProjectContext'
import { getDefaultTemporalSiteUrl } from '../../../../utils/getPreferredSiteUrl'
import { Button, ConfirmDialog, Dialog, Status, TextArea, TextField } from '../../../Shared/Product'
import { ExternalLink } from '../../../Shared/Icon'
import { CustomDomain } from '../../CustomDomain'
import { WhiteLabelCustomDomain } from '../../WhiteLabelCustomDomain'
import { WhiteLabelCustomDomainBlock } from '../../WhiteLabelCustomDomain/WhiteLabelCustomDomainBlock'
import { setThemePath } from './themeDraft'

// redesign ordering-website B3a (D6, D7): Website › General. The site's name and description, its temporal domain and its
// custom domain with the state of the certificate (P/Status) and its actions. Everything the legacy editor did on its «Basic» tab
// for these four fields (OW: 394-603), with the same data and the same calls: the controller's `handleChangeInput` for the site's
// fields (and the mirror in the theme), `handleUpdateSite({ domain: null })` for «Remove custom domain».
// redesign ordering-website B4 (D7, OW-08): the form of the custom domain is told `hideTitle`: the dialog gives the title.

// The state of the custom domain: its P/Status family and label, and the sentence the legacy editor printed under the button
// (OW: 565-589). `t` is called with literal keys so the key scanner sees them. Any other state paints nothing, as before.
const getDomainState = (site, t) => {
  const status = site?.ssl_status
  const processPending = site?.ssl_process_status === 'pending'
  if (status === 'issued' && !processPending) {
    return {
      family: 'done',
      label: t('ACTIVE', 'Active'),
      text: t('CUSTOM_DOMAIN_STATUS_ISSUED', 'Your domain is now added. Please verify the custom domain link above.')
    }
  }
  if (status === 'pre-issued') {
    return {
      family: 'progress',
      label: t('IN_PROGRESS', 'In progress'),
      text: t('CUSTOM_DOMAIN_STATUS_PRE_ISSUED', 'Process almost finish, please wait')
    }
  }
  if (status === 'pending_validation' || (status === 'void' && processPending)) {
    return {
      family: 'pending',
      label: t('PENDING', 'Pending'),
      text: t('CUSTOM_DOMAIN_STATUS_PENDING_VALIDATION', 'A custom domain is being created, please wait')
    }
  }
  if (status === 'error') {
    return {
      family: 'cancel',
      label: t('ERROR', 'Error'),
      text: t('CUSTOM_DOMAIN_STATUS_ERROR', 'Custom domain can\'t be created, please try again with valid data')
    }
  }
  if (status === 'revoked') {
    return {
      family: 'cancel',
      label: t('REVOKED', 'Revoked'),
      text: t('CUSTOM_DOMAIN_STATUS_REVOKED', 'Warning: Custom domain is revoked')
    }
  }
  if (status === 'cancelled') {
    return {
      family: 'cancel',
      label: t('CANCELLED', 'Cancelled'),
      text: t('CUSTOM_DOMAIN_STATUS_CANCELLED', 'Custom domain is cancelled')
    }
  }
  if (status === 'expired') {
    return {
      family: 'cancel',
      label: t('EXPIRED', 'Expired'),
      text: t('CUSTOM_DOMAIN_STATUS_EXPIRED', 'Custom domain is expired')
    }
  }
  return null
}

export const GeneralSection = (props) => {
  const {
    site,
    setSite,
    handleChangeInput,
    themeValues,
    setThemeValues,
    formState,
    handleUpdateSite,
    isDashboard,
    isFranchise,
    forcedSiteId
  } = props

  const [, t] = useLanguage()
  const [ordering, { configurations }] = useApi()
  const [projectStatus] = useProjectState()
  const ids = useId()
  const [domainOpen, setDomainOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  // redesign ordering-website review R1-01: «Remove» goes away with the domain, so the focus goes to the button that stays
  const domainButtonRef = useRef(null)

  const temporalIsFranchise = isFranchise || (
    !isDashboard &&
    !forcedSiteId &&
    projectStatus?.websiteProduct === 'web_franchises_x'
  )
  const canRemoveCustomDomain = site?.domain && site?.deployment_provider === CLOUDFLARE_DEPLOYMENT_PROVIDER
  const domainState = site?.domain ? getDomainState(site, t) : null

  // The same as `handleChangeSiteSettings` of the legacy editor: the theme keeps a mirror of the site's fields (not in the dashboard)
  // and the controller keeps the site's draft and its pending changes.
  const handleChangeSiteField = (name, value) => {
    if (!isDashboard) setThemeValues(setThemePath(themeValues, 'website_settings', `values.${name}`, value))
    handleChangeInput({ target: { name, value } })
  }

  const temporalDomainUrl = (() => {
    if (!isDashboard && !isFranchise && !forcedSiteId && !projectStatus?.websiteProduct) return null
    return getDefaultTemporalSiteUrl({
      // FW-02, as the legacy editor: a franchise site with its own temporal domain opens it
      site: forcedSiteId
        ? site
        : isFranchise
          ? { type: site?.type, code: site?.code, temporal_domain: site?.temporal_domain }
          : { type: site?.type, code: site?.code },
      ordering,
      configurations,
      isDashboard,
      isFranchise: temporalIsFranchise,
      preserveExplicitSite: !!forcedSiteId
    })
  })()

  return (
    <div className='odc-ows-form'>
      <TextField
        label={t('NAME', 'Name')}
        name='name'
        // redesign J5 row 52: one text per surface, as the legacy editor (FW-03, D4 of my-products-dashboard)
        placeholder={isFranchise
          ? t('SOURCE_DEMO_FRANCHISE_WEBSITE', 'Source demo franchise website')
          : isDashboard
            ? t('SOURCE_DEMO_DASHBOARD', 'Source demo dashboard')
            : t('SOURCE_DEMO_WEBSITE', 'Source demo website')}
        value={site?.name || ''}
        onChange={(value) => handleChangeSiteField('name', value)}
      />
      <TextArea
        label={t('DESCRIPTION', 'Description')}
        name='description'
        placeholder={t('DESCRIPTION', 'Description')}
        value={site?.description || ''}
        onChange={(value) => handleChangeSiteField('description', value)}
      />

      {temporalDomainUrl && (
        <div className='odc-ows-row' role='group' aria-labelledby={`${ids}-temporal`}>
          <p id={`${ids}-temporal`} className='odc-ows-label'>{isDashboard || isFranchise ? t('DEFAULT_DOMAIN', 'Default domain') : t('TEMPORARY_DOMAIN', 'Temporary domain')}</p>
          <a className='odc-ows-link' href={temporalDomainUrl} rel='noopener noreferrer' target='_blank'>
            <span className='odc-figure'>{temporalDomainUrl}</span>
            <ExternalLink className='odc-icon' aria-hidden='true' />
          </a>
        </div>
      )}

      <div className='odc-ows-row' role='group' aria-labelledby={`${ids}-domain`}>
        <p id={`${ids}-domain`} className='odc-ows-label'>{t('CUSTOM_DOMAIN', 'Custom domain')}</p>
        {/* redesign J5 row 52: a white label (forcedSiteId) keeps its own block, as the legacy editor: one Request / Change
            button gated by the SSL process (ssl_process_status 'ended') and the white-label form; Remove stays with Cloudflare */}
        {forcedSiteId
          ? (
            <>
              <WhiteLabelCustomDomainBlock site={site} setSite={setSite} onRequestEdit={() => setDomainOpen(true)} />
              {canRemoveCustomDomain && (
                <div className='odc-ows-actions'>
                  <Button variant='danger' disabled={formState?.loading} onClick={() => setRemoveOpen(true)}>
                    {t('REMOVE_CUSTOM_DOMAIN', 'Remove custom domain')}
                  </Button>
                </div>
              )}
            </>
            )
          : (
            <>
          {site?.domain && (
            <div className='odc-ows-domain'>
              <span className='odc-figure odc-ows-domain-name'>{site.domain}</span>
              {site?.ssl_status !== 'error' && (
                <a
                  className='odc-ows-link'
                  href={`https://${site.domain}`}
                  rel='noopener noreferrer'
                  target='_blank'
                  aria-label={`${t('VISIT', 'Visit')} ${site.domain}`}
                >
                  <span>{t('VISIT', 'Visit')}</span>
                  <ExternalLink className='odc-icon' aria-hidden='true' />
                </a>
              )}
              {domainState && <Status family={domainState.family} label={domainState.label} />}
            </div>
          )}
          {domainState && <p className='odc-ows-hint'>{domainState.text}</p>}
          <div className='odc-ows-actions'>
            <Button ref={domainButtonRef} onClick={() => setDomainOpen(true)}>
              {site?.domain ? t('CHANGE_CUSTOM_DOMAIN', 'Change custom domain') : t('REQUEST_CUSTOM_DOMAIN', 'Request custom domain')}
            </Button>
            {canRemoveCustomDomain && (
              <Button variant='danger' disabled={formState?.loading} onClick={() => setRemoveOpen(true)}>
                {t('REMOVE_CUSTOM_DOMAIN', 'Remove custom domain')}
              </Button>
            )}
          </div>
            </>
            )}
        <div className='odc-ows-hints'>
          <p className='odc-ows-hint'>{t('CUSTOM_DOMAIN_INFO_DESC_1', 'When creating a custom domain, add your domain or subdomain without http protocol or slashes.')}</p>
          <p className='odc-ows-hint'>
            {t('EXAMPLE', 'Example')}: <span className='odc-figure'>www.customerwebsite.com</span>
          </p>
          <p className='odc-ows-hint'>
            {t('CUSTOM_DOMAIN_INFO_DESC_2', 'If you have problems with the set-up, please contact our')}{' '}
            {/* tanda AI (decision 43, AI-43 D): /contact-us lands on a sales demo; the support route of the project subdomain, as «Contact support» */}
            <a href='https://www.ordering.co/support/' rel='noopener noreferrer' target='_blank'>
              {t('CUSTOMER_SUPPORT_TEAM', 'customer support team')}
            </a>
          </p>
        </div>
      </div>

      <Dialog
        open={domainOpen}
        onOpenChange={setDomainOpen}
        title={t('CUSTOM_DOMAIN', 'Custom domain')}
        closeLabel={t('CLOSE', 'Close')}
        size='md'
      >
        {forcedSiteId
          ? <WhiteLabelCustomDomain site={site} setSite={setSite} onClose={() => setDomainOpen(false)} hideTitle />
          : (
            <CustomDomain
              site={site}
              setSite={setSite}
              onClose={() => setDomainOpen(false)}
              disableDescriptionInfo
              hideTitle
              isFranchise={isFranchise}
            />
            )}
      </Dialog>

      <ConfirmDialog
        open={removeOpen}
        title={t('REMOVE_CUSTOM_DOMAIN_TITLE', 'Remove custom domain?')}
        confirmLabel={t('REMOVE_CUSTOM_DOMAIN', 'Remove custom domain')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onCancel={() => setRemoveOpen(false)}
        onConfirm={async () => {
          setRemoveOpen(false)
          await handleUpdateSite({ domain: null })
          setTimeout(() => domainButtonRef.current?.focus(), 0)
        }}
      >
        {t('CONFIRM_REMOVE_CUSTOM_DOMAIN', 'Are you sure you want to remove this custom domain?')}
      </ConfirmDialog>
    </div>
  )
}
