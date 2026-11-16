import React, { useEffect, useRef, useState } from 'react'

import {
  BrandWhiteLabel as BrandWhiteLabelController,
  useLanguage
} from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { TriangleAlert } from '../../Shared/Icon'
import { Button, ConfirmDialog, InlineNotice, Skeleton } from '../../Shared/Product'
import { OrderingWebsite } from '../../MyProducts/OrderingWebsite'
import './brand-white-label.css'

// redesign SB-B5 (; decision 7): Brand › White label on Product, the same behaviour as Store details › White label (5.16).
// Fetching the current site (`GET /franchises/:id/sites/current`) CREATES it when the brand has none, so «Create site» no longer
// sends that request on its own: it asks first (P/ConfirmDialog) and only the dialog's confirm calls `handleConfirmCreate` (Cancel
// and Close call nothing). The dialog stays open and busy until the site answers; after a confirm the focus goes to the site card's
// heading. A failed load says why (the API message, translated) with «Retry». The embedded editor, its props and the site name
// `<brand> Web` are unchanged and it has no `layout='sections'` (that is the Ordering website page's own work).
// Expanding the panel while this tab is open is the list's job now (SB-B2), so `expandSideBar` / `isExpand` may still arrive
// in the props and are ignored.

const NAME_TOKEN = '_name_'

const BrandWhiteLabelUI = (props) => {
  const {
    brand,
    siteCurrentState,
    confirmCreate,
    handleConfirmCreate,
    handleRetry
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
    return () => {
      mounted.current = false
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

  // The title names the brand; the name is data, so it is isolated for any direction of text.
  const brandName = brand?.name || t('BRAND', 'Brand')
  const titleParts = t('WHITE_LABEL_CREATE_TITLE', 'Create a site for _name_?').split(NAME_TOKEN)
  const dialogTitle = titleParts.reduce(
    (nodes, part, index) => (index === 0 ? [part] : [...nodes, <bdi key={index}>{brandName}</bdi>, part]),
    []
  )

  const apiError = Array.isArray(error) ? error.find(message => typeof message === 'string' && message.trim()) : error
  const errorText = translateApiMessage(t, apiError, t('WHITE_LABEL_LOAD_ERROR_BRAND', 'Could not load the site for this brand.'))

  const renderBody = () => {
    if (confirmCreate) {
      return (
        <section className='odc-brand-wl-card'>
          <h2 className='odc-brand-wl-card-title'>{t('CREATE_SITE_FOR_BRAND', 'Create site for this brand')}</h2>
          <p className='odc-brand-wl-muted'>
            {t('WHITE_LABEL_CONFIRM_CREATE_BRAND', 'You are about to create a dedicated site for this brand. This will be created automatically.')}
          </p>
          <div className='odc-brand-wl-row'>
            <Button variant='primary' onClick={() => { confirmedRef.current = false; setDialogOpen(true) }}>
              {t('CREATE_SITE', 'Create site')}
            </Button>
          </div>
        </section>
      )
    }

    return (
      <section className='odc-brand-wl-card' data-fill={site?.id ? '' : undefined}>
        <h2 ref={siteHeadingRef} className='odc-brand-wl-card-title' tabIndex={-1}>{t('SITE_AND_THEME', 'Site & theme')}</h2>
        {loading && (
          <div className='odc-brand-wl-loading' role='status' aria-busy='true' aria-label={t('LOADING', 'Loading')}>
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
          <div className='odc-brand-wl-editor'>
            <OrderingWebsite
              forcedSiteId={site.id}
              forcedThemeId={theme?.theme_id || theme?.id}
              appId={site.code}
              name={`${brand?.name || ''} Web`}
              disableReplaceCode
              // redesign J5 row 52 (ordering-website P-OW3, ): the sections editor, embedded in this panel
              layout='sections'
            />
          </div>
        )}
        {!loading && !error && !site?.id && (
          <p className='odc-brand-wl-muted odc-brand-wl-empty'>
            {t('WHITE_LABEL_EMPTY_BRAND', 'No site available for this brand.')}
          </p>
        )}
      </section>
    )
  }

  return (
    <div className='odc-brand-wl'>
      <header className='odc-brand-wl-head'>
        <h1 className='odc-brand-wl-title'>{t('WHITE_LABEL', 'White Label')}</h1>
        <p className='odc-brand-wl-muted'>{t('WHITE_LABEL_DESC_BRAND', 'Customize the site and theme of this brand.')}</p>
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
        {t('WHITE_LABEL_CREATE_BODY_BRAND', 'This creates a dedicated white-label site for this brand right away. It cannot be undone from here.')}
      </ConfirmDialog>
    </div>
  )
}

export const BrandWhiteLabel = (props) => {
  return (
    <BrandWhiteLabelController
      {...props}
      UIComponent={BrandWhiteLabelUI}
    />
  )
}
