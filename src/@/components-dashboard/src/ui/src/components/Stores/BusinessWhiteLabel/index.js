import React, { useEffect, useRef, useState } from 'react'

import {
  BusinessWhiteLabel as BusinessWhiteLabelController,
  useLanguage
} from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { TriangleAlert } from '../../Shared/Icon'
import { Button, ConfirmDialog, InlineNotice, Skeleton } from '../../Shared/Product'
import { OrderingWebsite } from '../../MyProducts/OrderingWebsite'
import './business-white-label.css'

// redesign stores 5.16 (; G5-17, G5-18; decision 6): Store details › White label on Product.
// Fetching the current site CREATES it when the store has none, so «Create site» no longer sends that request on its own: it
// asks first (P/ConfirmDialog) and only the dialog's confirm calls `handleConfirmCreate` (Cancel and Close call nothing). The
// dialog stays open and busy until the site answers. The muted copy is a class with tokens (it was an inline #748194). A failed
// load says why (the API message, translated) with «Retry». The embedded editor, its props and the site name `<store> Web`
// (data, session decision S6) are unchanged.

const NAME_TOKEN = '_name_'

const BusinessWhiteLabelUI = (props) => {
  const {
    business,
    siteCurrentState,
    confirmCreate,
    handleConfirmCreate,
    handleRetry,
    setIsExtendExtraOpen
  } = props

  const [, t] = useLanguage()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const creatingRef = useRef(false)
  const mounted = useRef(true)
  // Confirming the create replaces the «Create site» card (and the button the dialog would give the focus back to) with the site
  // card: after a confirm the focus goes to that card's heading; otherwise (Cancel, Close, a create that failed and left the first
  // card in place) it goes back to where it was.
  const siteHeadingRef = useRef(null)
  const confirmedRef = useRef(false)

  useEffect(() => {
    if (setIsExtendExtraOpen) {
      setIsExtendExtraOpen(true)
    }
    return () => {
      mounted.current = false
      if (setIsExtendExtraOpen) {
        setIsExtendExtraOpen(false)
      }
    }
  }, [])

  const { loading, site, theme, error } = siteCurrentState || {}

  const handleCreate = async () => {
    if (creatingRef.current) return
    creatingRef.current = true
    confirmedRef.current = true
    setCreating(true)
    try {
      await handleConfirmCreate()
    } finally {
      creatingRef.current = false
      if (mounted.current) {
        setCreating(false)
        setDialogOpen(false)
      }
    }
  }

  // The title names the store; the name is data, so it is isolated for any direction of text.
  const storeName = business?.name || t('THIS_STORE', 'this store')
  const titleParts = t('WHITE_LABEL_CREATE_TITLE', 'Create a site for _name_?').split(NAME_TOKEN)
  const dialogTitle = titleParts.reduce(
    (nodes, part, index) => (index === 0 ? [part] : [...nodes, <bdi key={index}>{storeName}</bdi>, part]),
    []
  )

  const apiError = Array.isArray(error) ? error.find(message => typeof message === 'string' && message.trim()) : error
  const errorText = translateApiMessage(t, apiError, t('WHITE_LABEL_LOAD_ERROR', 'Could not load the site for this business.'))

  const renderBody = () => {
    if (confirmCreate) {
      return (
        <section className='odc-bwl-card'>
          <h2 className='odc-bwl-card-title'>{t('CREATE_SITE_FOR_BUSINESS', 'Create site for this business')}</h2>
          <p className='odc-bwl-muted'>
            {t('WHITE_LABEL_CONFIRM_CREATE', 'You are about to create a dedicated site for this business. This will be created automatically.')}
          </p>
          <div className='odc-bwl-row'>
            <Button variant='primary' onClick={() => { confirmedRef.current = false; setDialogOpen(true) }}>
              {t('CREATE_SITE', 'Create site')}
            </Button>
          </div>
        </section>
      )
    }

    return (
      <section className='odc-bwl-card' data-fill={site?.id ? '' : undefined}>
        <h2 ref={siteHeadingRef} className='odc-bwl-card-title' tabIndex={-1}>{t('SITE_AND_THEME', 'Site & theme')}</h2>
        {loading && (
          <div className='odc-bwl-loading' role='status' aria-busy='true' aria-label={t('LOADING', 'Loading')}>
            {[0, 1, 2].map(index => <Skeleton key={index} block='var(--od-x-control-height)' />)}
          </div>
        )}
        {!loading && error && (
          <InlineNotice
            tone='danger'
            icon={TriangleAlert}
            role='alert'
            action={<Button size='sm' onClick={handleRetry}>{t('RETRY', 'Retry')}</Button>}
          >
            {errorText}
          </InlineNotice>
        )}
        {!loading && !error && site?.id && (
          <div className='odc-bwl-editor'>
            <OrderingWebsite
              forcedSiteId={site.id}
              forcedThemeId={theme?.theme_id || theme?.id}
              appId={site.code}
              name={`${business?.name || ''} Web`}
              business={business}
              disableReplaceCode
              // redesign J5 row 52 (ordering-website P-OW3, ): the sections editor, embedded in this panel
              layout='sections'
            />
          </div>
        )}
        {!loading && !error && !site?.id && (
          <p className='odc-bwl-muted odc-bwl-empty'>
            {t('WHITE_LABEL_EMPTY', 'No site available for this business.')}
          </p>
        )}
      </section>
    )
  }

  return (
    <div className='odc-bwl'>
      <header className='odc-bwl-head'>
        <h1 className='odc-bwl-title'>{t('WHITE_LABEL', 'White Label')}</h1>
        <p className='odc-bwl-muted'>{t('WHITE_LABEL_DESC', 'Customize the site and theme of this business.')}</p>
      </header>
      {renderBody()}
      <ConfirmDialog
        open={dialogOpen}
        tone='primary'
        title={dialogTitle}
        confirmLabel={t('CREATE_SITE', 'Create site')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        busy={creating || !!loading}
        finalFocus={() => {
          const heading = siteHeadingRef.current
          if (confirmedRef.current && heading?.isConnected) {
            confirmedRef.current = false
            return heading
          }
          return true
        }}
        onConfirm={handleCreate}
        onCancel={() => setDialogOpen(false)}
      >
        {t('WHITE_LABEL_CREATE_BODY', 'This creates a dedicated white-label site for this store right away. It cannot be undone from here.')}
      </ConfirmDialog>
    </div>
  )
}

export const BusinessWhiteLabel = (props) => {
  return (
    <BusinessWhiteLabelController
      {...props}
      UIComponent={BusinessWhiteLabelUI}
    />
  )
}
