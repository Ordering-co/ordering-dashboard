import React, { useState } from 'react'
import { useLanguage, useApi, useSession, useToast, ToastType } from '../../../../../index'
import { Button } from '../../../styles'
import { Confirm } from '../../Shared'
import {
  TemporalDomail,
  CustomeDomainDesc
} from '../OrderingWebsite/styles'

/**
 * White Label simplified custom domain block.
 *
 * Differences vs the original block in OrderingWebsiteUI:
 *  - No "Verify SSL" button (backend handles SSL automatically and the
 *    websocket `sites_update` event keeps the UI in sync).
 *  - Single button "Request/Change custom domain" gated by
 *    `ssl_process_status === 'ended'` (same gate as the original to avoid
 *    concurrent changes while SSL is still processing).
 *  - Status descriptions are shared with the original flow because they
 *    depend only on `site.ssl_status` / `site.ssl_process_status`.
 */
export const WhiteLabelCustomDomainBlock = (props) => {
  const {
    site,
    setSite,
    onRequestEdit
  } = props

  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()

  const [removing, setRemoving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const sslEnded = site?.ssl_process_status === 'ended'
  // Show "Request" when there's no domain yet — `ssl_status === 'void'` is
  // the natural empty state in that case.
  const canRequestDomain = sslEnded && !site?.domain
  // Show "Remove" only after SSL fully resolved. Right after adding a domain
  // the site returns `ssl_process_status === 'ended'` with `ssl_status === 'void'`
  // for a brief moment — we must wait until SSL is `issued` (or failed) before
  // allowing another change.
  const canRemoveDomain = sslEnded && !!site?.domain && site?.ssl_status !== 'void'

  const handleRemoveDomain = async () => {
    if (!site?.id) return
    try {
      setRemoving(true)
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const response = await fetch(`${ordering.root}/sites/${site.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ domain: null })
      })
      const { error, result } = await response.json()
      if (error) {
        showToast(ToastType.Error, result)
        return
      }
      setSite && setSite(prev => ({ ...prev, ...(result || {}), domain: null }))
      showToast(ToastType.Success, t('DOMAIN_REMOVED', 'Domain removed'))
    } catch (err) {
      showToast(ToastType.Error, err.message)
    } finally {
      setRemoving(false)
      setConfirmRemove(false)
    }
  }

  return (
    <>
      {site?.domain && site?.ssl_status !== 'error' && (
        <TemporalDomail
          isDisabled={site?.ssl_process_status === 'pending'}
          marginBottom={site?.ssl_process_status === 'ended'}
        >
          {t('VISIT', 'Visit')}: <a href={`https://${site?.domain}`} rel='noopener noreferrer' target='_blank'>https://{site?.domain}</a>
        </TemporalDomail>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', margin: '10px 0' }}>
        {canRequestDomain && (
          <Button
            color='primary'
            outline
            borderRadius='8px'
            onClick={onRequestEdit}
          >
            {t('REQUEST_CUSTOM_DOMAIN', 'Request custom domain')}
          </Button>
        )}
        {canRemoveDomain && (
          <Button
            color='primary'
            outline
            borderRadius='8px'
            disabled={removing}
            onClick={() => setConfirmRemove(true)}
          >
            {removing ? t('REMOVING_DOMAIN', 'Removing domain...') : t('REMOVE_DOMAIN', 'Remove domain')}
          </Button>
        )}
      </div>
      {site?.domain && (
        <>
          {site?.ssl_status === 'issued' && site?.ssl_process_status !== 'pending' && (
            <CustomeDomainDesc>{t('CUSTOM_DOMAIN_STATUS_ISSUED', 'Your domain is now added , please verify the custom domain link above.')}</CustomeDomainDesc>
          )}
          {site?.ssl_status === 'pre-issued' && (
            <CustomeDomainDesc>{t('CUSTOM_DOMAIN_STATUS_PRE_ISSUED', 'Process almost finish, please wait')}</CustomeDomainDesc>
          )}
          {site?.ssl_status === 'error' && (
            <CustomeDomainDesc>{t('CUSTOM_DOMAIN_STATUS_ERROR', 'Custom domain can\'t be created, please try again with valid data')}</CustomeDomainDesc>
          )}
          {((site?.ssl_status === 'pending_validation') || (site?.ssl_status === 'void' && site?.ssl_process_status === 'pending')) && (
            <CustomeDomainDesc>{t('CUSTOM_DOMAIN_STATUS_PENDING_VALIDATION', 'A custom domain is being created, please wait')}</CustomeDomainDesc>
          )}
          {site?.ssl_process_status === 'pending' && !['pending_validation', 'void', 'error'].includes(site?.ssl_status) && (
            <CustomeDomainDesc>{t('SSL_VERIFICATION_IN_PROGRESS', 'SSL verification in progress, please wait...')}</CustomeDomainDesc>
          )}
          {site?.ssl_status === 'revoked' && (
            <CustomeDomainDesc>{t('CUSTOM_DOMAIN_STATUS_REVOKED', 'Warning: Custom domain is revoked')}</CustomeDomainDesc>
          )}
          {site?.ssl_status === 'cancelled' && (
            <CustomeDomainDesc>{t('CUSTOM_DOMAIN_STATUS_CANCELLED', 'Custom domain is cancelled')}</CustomeDomainDesc>
          )}
          {site?.ssl_status === 'expired' && (
            <CustomeDomainDesc>{t('CUSTOM_DOMAIN_STATUS_EXPIRED', 'Custom domain is expired')}</CustomeDomainDesc>
          )}
        </>
      )}
      <Confirm
        title={t('REMOVE_DOMAIN', 'Remove domain')}
        content={t('REMOVE_DOMAIN_CONFIRM', 'Are you sure you want to remove the current custom domain?')}
        acceptText={t('ACCEPT', 'Accept')}
        cancelText={t('CANCEL', 'Cancel')}
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onCancel={() => setConfirmRemove(false)}
        onAccept={handleRemoveDomain}
        closeOnBackdrop={false}
      />
    </>
  )
}
