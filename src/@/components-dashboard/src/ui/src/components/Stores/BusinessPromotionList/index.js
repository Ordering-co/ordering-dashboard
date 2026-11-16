import React, { useEffect, useRef, useState } from 'react'

import { BusinessPromotionList as BusinessPromotionListController, useLanguage } from '../../../../../index'
import { EDITOR_PANEL_WIDE_FROM } from '../../../../../utils/editorPanel'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { CircleAlert, Plus, Trash2 } from '../../Shared/Icon'
import { Button, ConfirmDialog, InlineNotice, SectionSplit, TabPanel, Tabs } from '../../Shared/Product'
import { BusinessPromotionCustomFields } from '../BusinessPromotionCustomFields'
import { BusinessPromotionGeneralForm } from '../BusinessPromotionGeneralForm'
import { PromotionsTable } from './PromotionsTable'
import './business-promotions.css'

// redesign stores 5.14 (; E4): the promotions of a store on Product, in place of the legacy table, the 80 % Modal and the Confirm
// of `main`. The same controller and the same requests; what changes is how the screen says things.
// - The list (S-1, S-2, S-3): «Promotions» and one «Add promotion» (the duplicate link of the foot is gone), a P/DataTable (RecordCards
//   under 768px) with the type and code, how much it discounts, the dates in the format of the project and whether it is expired or
//   scheduled, and a Status that is a switch that saves at once and says why when it cannot. Loading, error and empty are three
//   different things (G4-16): a skeleton, the reason with «Retry», and «No promotions yet»; a failed load never looks empty.
// - The detail (S-4, S-10) opens beside the list while there is room for both (from 1000px of window, the width `main` opened its
//   column at, the SectionSplit decides) and instead of it below, with «‹ Back». «Add promotion» opens it empty. A saved promotion has
//   General and Custom fields tabs; a change of tab, of promotion or closing the detail asks while the form holds unsaved work
//   (decision 4: it goes through `requestLeave` of the split).
// - «Delete» (S-6) in the head of the detail asks first, with the name and what it means for the customers; a failure stays in the
//   confirmation with its reason. Writes go through the controller with `{ inlineError: true }`: no toast, no Alert.
// The list comes from `business.offers` (the `promotions` prop); the controller only asks the API when it does not come.

const NEW = 'new'
const TAB_GENERAL = 'general'
const TAB_CUSTOM = 'custom'

// The first text of what the API answers: a string, `{ message }` or a list of either.
const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(message => typeof message === 'string' && message.trim() !== '') ?? null

const BusinessPromotionListUI = (props) => {
  const {
    business,
    businessId: businessIdProp,
    promotionListState,
    reloadPromotions,
    handleChangePromotionActiveState,
    handleDeletePromotion,
    handleSuccessUpdate,
    setIsExtendExtraOpen
  } = props

  const [, t] = useLanguage()
  const splitRef = useRef(null)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const businessId = businessIdProp ?? business?.id

  const [openKey, setOpenKey] = useState(null) // a promotion id, NEW, or null
  const [openRecord, setOpenRecord] = useState(null) // the record the detail holds (it follows the list)
  const [tab, setTab] = useState(TAB_GENERAL)
  // `name` is the one the question was asked about: it outlives the record while the confirmation closes
  const [deleting, setDeleting] = useState({ open: false, busy: false, error: null, name: '' })

  const loading = Boolean(promotionListState?.loading)
  const promotions = Array.isArray(promotionListState?.promotions) ? promotionListState.promotions : []
  const loadError = !loading && promotionListState?.error ? promotionListState.error : null

  // ── Open and close the detail ──
  const showDetail = (key, record) => {
    setTab(TAB_GENERAL)
    setDeleting(current => ({ ...current, open: false, busy: false, error: null }))
    setOpenKey(key)
    setOpenRecord(record)
  }

  const requestOpen = (key, record) => {
    if (!businessId || String(key) === String(openKey)) return
    if (splitRef.current) splitRef.current.requestLeave(() => showDetail(key, record))
    else showDetail(key, record)
  }

  const closeDetail = () => {
    setOpenKey(null)
    setOpenRecord(null)
  }

  // the record in the detail follows the list (a switch of the table, a save)
  useEffect(() => {
    if (openKey == null || openKey === NEW) return
    const found = promotions.find(promotion => String(promotion.id) === String(openKey))
    if (found && found !== openRecord) setOpenRecord(found)
  }, [promotions, openKey])

  const isNew = openKey === NEW
  const isOpen = isNew || (openKey != null && openRecord != null)

  // a change of tab asks first when the form holds unsaved work
  const changeTab = (next) => {
    if (next === tab) return
    if (splitRef.current) splitRef.current.requestLeave(() => setTab(next))
    else setTab(next)
  }

  // ── The switch of a row and the one of the detail ──
  const toggleEnabled = (promotion, next) => Promise.resolve(handleChangePromotionActiveState?.(next, promotion.id, { inlineError: true }))
    .then(result => (!result || result.ok === false ? { ok: false, error: result?.error } : { ok: true }))

  // ── Delete ──
  const confirmDelete = async () => {
    if (deleting.busy || !openRecord) return
    setDeleting(current => ({ ...current, open: true, busy: true, error: null }))
    let result
    try {
      result = await handleDeletePromotion?.(openRecord.id, { inlineError: true })
    } catch (error) {
      result = { ok: false, error: error?.message }
    }
    if (!mounted.current) return
    if (!result || result.ok === false) {
      setDeleting(current => ({
        ...current,
        open: true,
        busy: false,
        error: translateApiMessage(t, firstMessage(result?.error), t('PROMOTION_DELETE_FAILED', "We couldn't delete this promotion. Try again."))
      }))
      return
    }
    setDeleting(current => ({ ...current, open: false, busy: false, error: null }))
    closeDetail()
  }

  // ── The list ──
  const addButton = (
    <Button variant='primary' icon={Plus} disabled={!businessId} onClick={() => requestOpen(NEW, null)}>
      {t('ADD_PROMOTION', 'Add promotion')}
    </Button>
  )

  let body
  if (loadError) {
    const reason = translateApiMessage(t, firstMessage(loadError), '')
    body = (
      <InlineNotice
        tone='danger'
        icon={CircleAlert}
        role='alert'
        className='odc-bpl-notice'
        action={<Button size='sm' onClick={() => reloadPromotions?.()}>{t('RETRY', 'Retry')}</Button>}
      >
        {[t('STORES_PROMOTION_LOAD_ERROR', "We couldn't load the promotions."), reason].filter(Boolean).join(' ')}
      </InlineNotice>
    )
  } else if (!loading && promotions.length === 0) {
    body = (
      <div className='odc-bpl-empty'>
        <p className='odc-bpl-empty-text'>{t('NO_PROMOTIONS_YET', 'No promotions yet')}</p>
        {addButton}
      </div>
    )
  } else {
    body = (
      <PromotionsTable
        promotions={promotions}
        loading={loading && promotions.length === 0}
        activeId={isOpen && !isNew ? openKey : undefined}
        onOpen={(promotion) => requestOpen(promotion.id, promotion)}
        onToggleEnabled={toggleEnabled}
      />
    )
  }

  const list = (
    <div className='odc-bpl-pane'>
      <div className='odc-bpl-head'>
        <h2 className='odc-bpl-title'>{t('PROMOTIONS', 'Promotions')}</h2>
        {addButton}
      </div>
      {body}
    </div>
  )

  // ── The detail ──
  const form = isOpen && (
    <BusinessPromotionGeneralForm
      key={isNew ? NEW : openRecord.id}
      promotion={isNew ? {} : openRecord}
      business={business}
      handleSuccessUpdate={handleSuccessUpdate}
      onToggleEnabled={toggleEnabled}
      onCreated={(record) => showDetail(record.id, record)}
      onSaved={(record) => setOpenRecord(current => (current ? { ...current, ...record } : current))}
      onClose={closeDetail}
    />
  )

  const detail = !isOpen
    ? null
    : (
      <div className='odc-bpl-detail'>
        {isNew
          ? form
          : (
            <Tabs
              label={t('PROMOTION_SECTIONS', 'Promotion sections')}
              value={tab}
              onValueChange={changeTab}
              items={[
                { value: TAB_GENERAL, label: t('GENERAL', 'General') },
                { value: TAB_CUSTOM, label: t('CUSTOM_FIELDS', 'Custom fields') }
              ]}
            >
              <TabPanel value={TAB_GENERAL}>{form}</TabPanel>
              <TabPanel value={TAB_CUSTOM}>
                <BusinessPromotionCustomFields key={openRecord.id} businessId={business?.id ?? businessId} offerId={openRecord.id} />
              </TabPanel>
            </Tabs>
            )}
      </div>
      )

  const headerActions = isOpen && !isNew
    ? (
      <Button
        size='sm'
        data-tone='danger'
        icon={Trash2}
        onClick={() => setDeleting({ open: true, busy: false, error: null, name: openRecord?.name ?? '' })}
      >
        {t('DELETE', 'Delete')}
      </Button>
      )
    : null

  return (
    <div className='odc-root odc-bpl'>
      <SectionSplit
        revealDetail // redesign bugs F row 6 (D5 of 5.18): stacked, the detail opens at its header
        ref={splitRef}
        splitFrom={EDITOR_PANEL_WIDE_FROM}
        open={isOpen}
        detailKey={openKey}
        onClose={closeDetail}
        onExtendChange={value => setIsExtendExtraOpen?.(value)}
        detailTitle={isNew ? t('NEW_PROMOTION', 'New promotion') : (openRecord?.name ?? '')}
        closeLabel={t('CLOSE', 'Close')}
        backLabel={t('BACK', 'Back')}
        headerActions={headerActions}
        list={list}
        detail={detail}
      />
      <ConfirmDialog
        open={deleting.open}
        tone='danger'
        busy={deleting.busy}
        title={t('PROMOTION_DELETE_TITLE', 'Delete "_name_"?').replace('_name_', () => deleting.name)}
        confirmLabel={t('STORE_PROMOTION_DELETE_CONFIRM', 'Delete promotion')} // redesign tanda AB (S-5): verb + object
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onCancel={() => setDeleting(current => (current.busy ? current : { ...current, open: false, error: null }))}
        onConfirm={confirmDelete}
      >
        <p className='odc-bpl-delete-body'>{t('STORES_PROMOTION_DELETE_BODY', "Customers can no longer use it. This can't be undone.")}</p>
        {deleting.error && (
          <InlineNotice tone='danger' icon={CircleAlert} role='alert' className='odc-bpl-delete-error'>
            {deleting.error}
          </InlineNotice>
        )}
      </ConfirmDialog>
    </div>
  )
}

export const BusinessPromotionList = (props) => {
  const businessPromotionsController = {
    ...props,
    UIComponent: BusinessPromotionListUI
  }
  return (
    <BusinessPromotionListController {...businessPromotionsController} />
  )
}
