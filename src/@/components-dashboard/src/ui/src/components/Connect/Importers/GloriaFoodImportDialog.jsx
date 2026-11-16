import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { useApi, useLanguage, useSession } from '~components'
import { Button, Checkbox, Dialog, IconButton, TextField } from '../../Shared/Product'
import { ArrowLeft, CircleAlert } from '../../Shared/Icon'
import { GLORIAFOOD_HELP_VIDEO_URL, validateGloriaFoodForm } from './gloriaFoodImportConfig'
import { useMenuImport } from './useMenuImport'
import { getMenuImportUseFixture } from './menuImportConfig'
import { fetchMenuImportSync } from './logMenuImportSync'
import { readableImportError } from './menuImportErrors'
import { clearRun } from './menuImportRuns'
import { fillTemplate } from './fillTemplate'
import { ImportOutcome, ImportOutcomeActions, ImportRunning, useImportRunView } from './ImportOutcome'
import { ImportStores, importConsequence, useImportStores } from './ImportStores'
import './importer-dialog.css'

/*
 * redesign IM-C (D3): the GloriaFood import dialog on P/Dialog. The logic is the one of GloriaFoodImportModal (two
 * steps, `help` and `credentials`; the keys of the last import are prefilled and, when both are there, the dialog starts on the
 * keys; `ignoreGloriaFoodForceLimits` on by default; same parameters). It changes the shell and fixes:
 *  - IM-13: a late prefill does not overwrite keys the user already typed, and does not jump to the keys if the user already moved
 *    between the steps;
 *  - IM-03: the error shown in the dialog is readable and goes away when a key is edited;
 *  - while it imports nothing closes it (`closeDisabled`, `dismissible={false}`, Cancel and Back disabled), as in `main`.
 * (main sync, 6f58d106) brings the run state of `main` (useMenuImport, useMenuImportRun), in this shell:
 *  - a run a previous session left importing or unknown is shown on open instead of the guide (a finished one is not);
 *  - success shows the applied count, with Import another; a lost connection says the import may still be running, with Check products
 *    and Retry; a failed one names the source and says why in the same inline alert (the keys stay, IM-03) and, when it can be
 *    retried, its primary action is Retry, with the same parameters (see ImportOutcome);
 *  - `onGoToProducts`, when given, replaces the navigation of Go to products / Check products, as in `main`.
 * The Master Key stays a visible text field, as in `main` (proposal P3 of the owner is pending).
 * the import can go to more stores than this one, with the `partial` outcome of MenuImportDialog.
 * Props: `open`, `business`, `onClose()`, `onGoToProducts()`.
 */
export const GloriaFoodImportDialog = ({ open, onClose, business, onGoToProducts }) => {
  const [, t] = useLanguage()
  const [{ user, token }] = useSession()
  const [ordering] = useApi()
  const history = useHistory()
  const { triggerImport, isImporting, status = 'idle', error, result, startedAt, reset } = useMenuImport('gloriafood')
  const { runRef, storedRun, viewStatus } = useImportRunView({
    project: ordering?.project,
    businessId: business?.id,
    source: 'gloriafood',
    status
  })
  // the live import locks the dialog (it cannot be closed); a resumed one only shows the state and blocks a second import
  const showImporting = isImporting || viewStatus === 'importing'

  const [step, setStep] = useState('help')
  const [resKey, setResKey] = useState('')
  const [masKey, setMasKey] = useState('')
  const [ignoreForceLimits, setIgnoreForceLimits] = useState(true)
  const [localError, setLocalError] = useState(null)
  const [importSuccess, setImportSuccess] = useState(false)
  const [lastParams, setLastParams] = useState(null) // what Retry sends again
  const stores = useImportStores(business, open)

  // what replaces the form: the success (the callback of this session or the hook, as main), the lost connection, or some stores failed
  const outcome = importSuccess || viewStatus === 'success'
    ? 'success'
    : ['unknown', 'partial', 'queued'].includes(viewStatus) ? viewStatus : null
  const retryStoreIds = viewStatus === 'partial' && result
    ? [...(result.failed || []).map(({ businessId }) => businessId), ...(result.pending || [])]
    : []

  const resKeyRef = useRef(null)
  const continueRef = useRef(null)
  const primaryRef = useRef(null)
  const hadOutcomeRef = useRef(false)
  const stepChangedByUserRef = useRef(false)
  // redesign IM-13: the user typed a key, or went from one step to the other; a prefill that arrives later respects it
  const touchedRef = useRef(false)
  const movedRef = useRef(false)
  const forceLimitsHelpId = useId()

  const formValidation = useMemo(
    () => validateGloriaFoodForm({ res_key: resKey, mas_key: masKey }),
    [resKey, masKey]
  )

  const showFormError = Boolean(localError || formValidation.error) && (
    resKey.trim() !== '' || masKey.trim() !== ''
  )

  const isImportEnabled = Boolean(
    business?.id &&
    stores.ids.length > 0 &&
    formValidation.valid &&
    !showImporting &&
    !outcome
  )

  useEffect(() => {
    touchedRef.current = false
    setLastParams(null)
    movedRef.current = false
    stepChangedByUserRef.current = false
    setStep('help')
    setResKey('')
    setMasKey('')
    setIgnoreForceLimits(true)
    setLocalError(null)
    setImportSuccess(false)

    if (!open) return

    if (!business?.id || !token || !ordering?.project || !ordering?.root) {
      return
    }

    let cancelled = false
    fetchMenuImportSync({
      token,
      businessId: business.id,
      project: ordering.project,
      source: 'gloriafood',
      orderingApiBaseUrl: ordering.root
    }).then((event) => {
      if (cancelled || !event || touchedRef.current) return
      const restaurantKey = String(event.gloriafood_restaurant_key || '').trim()
      const masterKey = String(event.gloriafood_master_key || '').trim()
      if (restaurantKey) setResKey(restaurantKey)
      if (masterKey) setMasKey(masterKey)
      if (restaurantKey && masterKey && !movedRef.current) setStep('credentials')
    })

    return () => {
      cancelled = true
    }
  }, [open, business?.id, token, ordering?.project, ordering?.root])

  // the button that had the focus is gone after a click: the next control takes it
  useEffect(() => {
    if (!stepChangedByUserRef.current) return
    if (step === 'credentials') resKeyRef.current?.focus()
    else continueRef.current?.focus()
  }, [step])

  // the button that had the focus is gone: the primary action of the outcome takes it; when the outcome is left (Import another) the keys do
  useEffect(() => {
    if (outcome) primaryRef.current?.focus()
    else if (hadOutcomeRef.current) resKeyRef.current?.focus()
    hadOutcomeRef.current = Boolean(outcome)
  }, [outcome])

  const goToStep = (next) => {
    movedRef.current = true
    stepChangedByUserRef.current = true
    setStep(next)
  }

  const editKey = (setter) => (value) => {
    touchedRef.current = true
    setLocalError(null)
    setter(value)
  }

  // same request and payload as main: the params below, sent with the hook
  const submit = async (params) => {
    setLastParams(params)
    setLocalError(null)
    setImportSuccess(false)
    await triggerImport(params, {
      onSuccess: () => setImportSuccess(true),
      // redesign IM-03: readable, also when the importer cannot be reached. In the hook the message is the classified one of main
      onError: (failure) => setLocalError(readableImportError(failure, t, t('IMPORTER_STATUS_ERROR', 'Import failed')))
    })
  }

  const handleImport = async () => {
    if (!formValidation.valid) {
      setLocalError(t(formValidation.error, formValidation.errorDefault || formValidation.error))
      return
    }
    if (!business?.id || !stores.ids.length) return

    await submit({
      gloriafoodRestaurantKey: resKey.trim(),
      gloriafoodMasterKey: masKey.trim(),
      ignoreGloriaFoodForceLimits: ignoreForceLimits,
      businessIds: stores.ids,
      project: ordering?.project,
      orderingApiBaseUrl: ordering?.root,
      userEmail: user?.email || undefined,
      useFixture: getMenuImportUseFixture()
    })
  }

  // main: with the last parameters; a resumed run has none, so it forgets the run and goes to the keys
  const handleRetry = () => {
    setLocalError(null)
    if (lastParams) {
      submit(lastParams)
      return
    }
    goToStep('credentials')
    clearRun(runRef)
  }

  // the same import, only to the stores that did not get the menu
  const handleRetryStores = () => {
    stores.setIds(retryStoreIds)
    submit({ ...lastParams, businessIds: retryStoreIds })
  }

  const handleImportAnother = () => {
    setImportSuccess(false)
    setLocalError(null)
    goToStep('credentials')
    reset?.()
    clearRun(runRef)
  }

  const handleGoToProducts = () => {
    if (onGoToProducts) {
      onClose?.()
      onGoToProducts()
      return
    }
    if (business?.slug) {
      history.push(`/stores/products/${business.slug}`)
    } else {
      history.push('/stores/products')
    }
    onClose?.()
  }

  if (!open || !business) return null

  const storeName = stores.chosenName(business?.name || t('BUSINESS', 'Business'))
  const sentStoreCount = lastParams?.businessIds?.length || 0
  const alertMessage = showFormError
    ? (localError || t(formValidation.error, formValidation.errorDefault || formValidation.error))
    : null

  // main's title for a failed import, once the hook says it failed (its message is the one under it)
  const failureTitle = localError && status === 'failed'
    ? fillTemplate(t('IMPORTER_STATUS_FAILED_TITLE', 'The {{source}} menu was not imported'), { source: 'GloriaFood' })
    : null
  const canRetry = Boolean(failureTitle && error?.retryable && lastParams)

  let footer
  if (outcome) {
    footer = (
      <ImportOutcomeActions
        status={outcome}
        t={t}
        primaryRef={primaryRef}
        onGoToProducts={handleGoToProducts}
        onCheckProducts={handleGoToProducts}
        // «Import another» is main's, once the hook confirmed the success
        onImportAnother={viewStatus === 'success' ? handleImportAnother : undefined}
        onRetry={outcome === 'partial' ? handleRetryStores : handleRetry}
        onClose={() => onClose?.()}
        retryCount={outcome === 'partial' ? (lastParams ? retryStoreIds.length : 0) : sentStoreCount}
      />
    )
  } else if (step === 'help') {
    footer = (
      <>
        <Button onClick={() => onClose?.()}>{t('IMPORTER_MODAL_CANCEL', 'Cancel')}</Button>
        {/* a run resumed from a previous session is only shown: there is nothing to continue to */}
        {!showImporting && (
          <Button ref={continueRef} variant='primary' onClick={() => goToStep('credentials')}>
            {t('CONTINUE', 'Continue')}
          </Button>
        )}
      </>
    )
  } else {
    footer = (
      <>
        <Button onClick={() => onClose?.()} disabled={isImporting}>{t('IMPORTER_MODAL_CANCEL', 'Cancel')}</Button>
        <Button
          variant='primary'
          busy={isImporting}
          disabled={!isImportEnabled && !isImporting}
          onClick={canRetry ? handleRetry : handleImport}
        >
          {canRetry ? t('IMPORTER_RETRY', 'Retry') : t('SYNCHRONIZE_MENU', 'Synchronize Menu')}
        </Button>
      </>
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => { if (!next && !isImporting) onClose?.() }}
      size='md'
      title={t('IMPORTER_MODAL_GLORIAFOOD_TITLE', 'Import from GloriaFood')}
      closeLabel={t('CLOSE', 'Close')}
      dismissible={!isImporting}
      closeDisabled={isImporting}
      initialFocus={outcome ? primaryRef : undefined}
      footer={footer}
    >
      <div className='odc-imp-body'>
        {outcome && <ImportOutcome status={outcome} result={['success', 'partial', 'queued'].includes(viewStatus) ? result : null} t={t} nameOf={stores.nameOf} storeCount={sentStoreCount} />}

        {!outcome && showImporting && (
          <ImportRunning
            message={t('SYNCHRONIZE_MENU_LOADING', 'Synchronize Menu .......')}
            startedAt={startedAt || storedRun?.startedAt}
          />
        )}

        {!outcome && !showImporting && step === 'help' && (
          <iframe
            className='odc-imp-video'
            src={GLORIAFOOD_HELP_VIDEO_URL}
            title={t('IMPORTER_MODAL_GLORIAFOOD_VIDEO_TITLE', 'GloriaFood setup guide')}
            allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
            referrerPolicy='strict-origin-when-cross-origin'
            allowFullScreen
          />
        )}

        {!outcome && step === 'credentials' && (
          <>
            <div className='odc-imp-step'>
              <IconButton
                icon={ArrowLeft}
                label={t('BACK', 'Back')}
                flipInRtl
                onClick={() => goToStep('help')}
                disabled={showImporting}
              />
              <h3 className='odc-imp-step-title'>{t('SYNCHRONIZE', 'Synchronize')}</h3>
            </div>

            <p className='odc-imp-hint'>
              {t(
                'IMPORTER_MODAL_GLORIAFOOD_SUBTITLE',
                'Enter the Restaurant Key from GloriaFood (3rd party integrations → Fetch Menu) to synchronize this store menu.'
              )}
            </p>

            <ImportStores storeName={storeName} stores={stores} disabled={showImporting} />

            <TextField
              ref={resKeyRef}
              label={t('IMPORTER_MODAL_GLORIAFOOD_RESTAURANT_KEY_LABEL', 'Restaurant Key')}
              placeholder={t('IMPORTER_MODAL_GLORIAFOOD_RESTAURANT_KEY_PLACEHOLDER', 'Paste your GloriaFood Restaurant Key')}
              autoComplete='off'
              value={resKey}
              onChange={editKey(setResKey)}
              disabled={showImporting}
            />

            <TextField
              label={t('IMPORTER_MODAL_GLORIAFOOD_MASTER_KEY_LABEL', 'Master Key')}
              hint={t(
                'IMPORTER_MODAL_GLORIAFOOD_HELPER',
                'The Restaurant Key is used to fetch the menu. The Master Key is only required for setup parity with the help video.'
              )}
              placeholder={t('IMPORTER_MODAL_GLORIAFOOD_MASTER_KEY_PLACEHOLDER', 'Paste your GloriaFood Master Key (from the help video)')}
              autoComplete='off'
              value={masKey}
              onChange={editKey(setMasKey)}
              disabled={showImporting}
            />

            <div className='odc-imp-option'>
              <Checkbox
                checked={ignoreForceLimits}
                onCheckedChange={setIgnoreForceLimits}
                disabled={showImporting}
                aria-describedby={forceLimitsHelpId}
              >
                {t('IMPORTER_MODAL_GLORIAFOOD_IGNORE_FORCE_LIMITS', 'Allow customers to choose more than one option in each group')}
              </Checkbox>
              <p id={forceLimitsHelpId} className='odc-imp-hint'>
                {t(
                  'IMPORTER_MODAL_GLORIAFOOD_IGNORE_FORCE_LIMITS_HELPER',
                  'Some GloriaFood menus only allow one choice per group. Leave this on so customers can pick several, like on GloriaFood.'
                )}
              </p>
            </div>

            {alertMessage && (
              <p className='odc-imp-alert' role='alert'>
                <CircleAlert className='odc-icon' aria-hidden='true' />
                <span>
                  {failureTitle && <strong className='odc-imp-alert-title'>{failureTitle}</strong>}
                  {alertMessage}
                </span>
              </p>
            )}

            <p className='odc-imp-consequence'>
              {importConsequence(t, storeName, stores.ids.length)}
            </p>
          </>
        )}
      </div>
    </Dialog>
  )
}
