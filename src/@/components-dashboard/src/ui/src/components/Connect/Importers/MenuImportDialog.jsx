import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { useApi, useLanguage, useSession } from '~components'
import { Button, Checkbox, Dialog, TextField } from '../../Shared/Product'
import { CircleAlert } from '../../Shared/Icon'
import { useMenuImport } from './useMenuImport'
import { clearRun } from './menuImportRuns'
import { fetchMenuImportSync, parseStoredSourceUrl } from './logMenuImportSync'
import { readableImportError } from './menuImportErrors'
import { fillTemplate } from './fillTemplate'
import { ImportOutcome, ImportOutcomeActions, ImportRunning, useImportRunView } from './ImportOutcome'
import { ImportStores, importConsequence, useImportStores } from './ImportStores'
import './importer-dialog.css'

// validation keys whose text main shows with a default (MenuImportModal); the others show their key, as before
const VALIDATION_DEFAULTS = {
  IMPORTER_VALIDATION_ORDERING_HOST_NOT_ALLOWED: 'Only Ordering.co API URLs are accepted here.',
  IMPORTER_VALIDATION_ORDERING_SEGMENT_INVALID: 'Spaces are not allowed. Use the store slug or numeric id (letters, numbers, _ or -).'
}

/*
 * redesign IM-C (D3): the import dialog of DoorDash, Uber Eats and Ordering.co on P/Dialog. The logic is the one of
 * MenuImportModal (state, validation, prefill, Clear, params): `main` keeps it, this changes the shell and fixes:
 *  - IM-03: a failed import stays inside the dialog (role=alert) besides the toast of the hook; the URL is kept, and the message goes
 *    away when a field is edited or the import is tried again;
 *  - IM-13: the prefill of the last source does not overwrite what the user already typed (a `touched` ref, reset on open);
 *  - the first field has the initial focus (it is a form, not a confirmation: decision D3);
 *  - while it imports nothing closes it (`closeDisabled`, `dismissible={false}`, Cancel disabled), as in `main`.
 * (main sync, 6f58d106) brings the run state of `main` (useMenuImport, useMenuImportRun), in this shell:
 *  - a run a previous session left importing or unknown is shown on open instead of the empty form (a finished one is not);
 *  - success shows the applied count, with Import another; a lost connection says the import may still be running, with Check products
 *    and Retry; a failed one names the source and says why in the same inline alert (the form stays, IM-03) and, when it can be
 *    retried, its primary action is Retry, with the same parameters (see ImportOutcome);
 *  - the project API root goes to the validation, so the Ordering.co host rule of `main` applies;
 *  - `onGoToProducts`, when given, replaces the navigation of Go to products / Check products, as in `main`.
 * the import can go to more stores than this one (ImportStores, up to MAX_IMPORT_STORES); when some do not get the menu,
 * the outcome is `partial`: it names them, says why, and Retry sends only those.
 * Props: `open`, `card` (an importer card with `modalConfig`), `business` (`id`, `name`, `slug`), `onClose()`, `onGoToProducts()`.
 */
export const MenuImportDialog = ({ open, onClose, card, business, onGoToProducts }) => {
  const config = card?.modalConfig
  const [, t] = useLanguage()
  const [{ user, token }] = useSession()
  const [ordering] = useApi()
  const history = useHistory()
  const { triggerImport, isImporting, status = 'idle', error, result, startedAt, reset } = useMenuImport(card?.id)
  const { runRef, storedRun, viewStatus } = useImportRunView({
    project: ordering?.project,
    businessId: business?.id,
    source: card?.id,
    status
  })
  // the live import locks the dialog (it cannot be closed); a resumed one only shows the state and blocks a second import
  const showImporting = isImporting || viewStatus === 'importing'
  const [urlInput, setUrlInput] = useState('')
  const [trackerInput, setTrackerInput] = useState('')
  const [orderingPlusProjectId, setOrderingPlusProjectId] = useState('')
  const [orderingBusinessSegment, setOrderingBusinessSegment] = useState('')
  const [includeAllMenuVariants, setIncludeAllMenuVariants] = useState(true)
  const [importSuccess, setImportSuccess] = useState(false)
  const [hasFetchedUrl, setHasFetchedUrl] = useState(false)
  const [importError, setImportError] = useState(null) // redesign IM-03
  const [lastParams, setLastParams] = useState(null) // what Retry sends again
  const stores = useImportStores(business, open)

  // what replaces the form: the success (the callback of this session or the hook, as main), the lost connection, or some stores failed
  const outcome = importSuccess || viewStatus === 'success'
    ? 'success'
    : ['unknown', 'partial', 'queued'].includes(viewStatus) ? viewStatus : null
  const retryStoreIds = viewStatus === 'partial' && result
    ? [...(result.failed || []).map(({ businessId }) => businessId), ...(result.pending || [])]
    : []

  const urlRef = useRef(null)
  const primaryRef = useRef(null)
  const hadOutcomeRef = useRef(false)
  // redesign IM-13: true once the user changed a field; a prefill that arrives later is not applied
  const touchedRef = useRef(false)

  const importForm = useMemo(() => ({
    url: urlInput,
    tracker: trackerInput,
    orderingPlusProjectId,
    orderingBusinessSegment
  }), [urlInput, trackerInput, orderingPlusProjectId, orderingBusinessSegment])

  const showUrlClear = hasFetchedUrl && (
    urlInput.trim() !== '' ||
    orderingPlusProjectId.trim() !== '' ||
    orderingBusinessSegment.trim() !== ''
  )

  // main: the validation knows the project API root (the Ordering.co host rule)
  const projectApiRoot = ordering?.root || ''
  const formValidation = useMemo(
    () => (config?.validateForm ? config.validateForm(importForm, { projectApiRoot }) : { valid: true }),
    [config, importForm, projectApiRoot]
  )

  const showFormError = Boolean(formValidation.error) && (
    urlInput.trim() !== '' ||
    trackerInput.trim() !== '' ||
    orderingPlusProjectId.trim() !== '' ||
    orderingBusinessSegment.trim() !== ''
  )

  const isImportEnabled = Boolean(
    business?.id &&
    stores.ids.length > 0 &&
    formValidation.valid &&
    !showImporting
  )

  useEffect(() => {
    touchedRef.current = false
    setLastParams(null)
    setUrlInput('')
    setTrackerInput('')
    setOrderingPlusProjectId('')
    setOrderingBusinessSegment('')
    setIncludeAllMenuVariants(true)
    setImportSuccess(false)
    setHasFetchedUrl(false)
    setImportError(null)

    if (!open) return

    if (!business?.id || !card?.id || !token || !ordering?.project || !ordering?.root) {
      return
    }

    let cancelled = false
    fetchMenuImportSync({
      token,
      businessId: business.id,
      project: ordering.project,
      source: card.id,
      orderingApiBaseUrl: ordering.root
    }).then((event) => {
      if (cancelled || !event?.source_url || touchedRef.current) return
      const parsed = parseStoredSourceUrl(event.source_url)
      setUrlInput(parsed.url)
      setOrderingPlusProjectId(parsed.orderingPlusProjectId)
      setOrderingBusinessSegment(parsed.orderingBusinessSegment)
      setHasFetchedUrl(true)
    })

    return () => {
      cancelled = true
    }
  }, [open, business?.id, card?.id, token, ordering?.project, ordering?.root])

  // the button that had the focus is gone: the primary action of the outcome takes it; when the outcome is left (Import another) the URL does
  useEffect(() => {
    if (outcome) primaryRef.current?.focus()
    else if (hadOutcomeRef.current) urlRef.current?.focus()
    hadOutcomeRef.current = Boolean(outcome)
  }, [outcome])

  // every edit by the user: it marks the form as touched and drops the message of a failed import
  const edit = (setter) => (value) => {
    touchedRef.current = true
    setImportError(null)
    setter(value)
  }

  // the variants option is not part of the prefill: it drops the message but does not count as typing
  const handleVariantsChange = (next) => {
    setImportError(null)
    setIncludeAllMenuVariants(next)
  }

  const handleClearUrlFields = () => {
    touchedRef.current = true
    setImportError(null)
    setUrlInput('')
    setOrderingPlusProjectId('')
    setOrderingBusinessSegment('')
  }

  // same request and payload as main: the params the config builds, sent with the hook
  const submit = async (params) => {
    setLastParams(params)
    setImportError(null)
    setImportSuccess(false)
    await triggerImport(params, {
      onSuccess: () => setImportSuccess(true),
      // redesign IM-03: the failure is also said here, in words. In the hook the message is the classified one of main
      onError: (failure) => setImportError(readableImportError(failure, t, t('IMPORTER_STATUS_ERROR', 'Import failed')))
    })
  }

  const handleImport = async () => {
    if (!isImportEnabled || !config) return

    await submit(config.buildImportParams(
      importForm,
      stores.ids,
      ordering?.project,
      ordering?.root,
      includeAllMenuVariants,
      user?.email
    ))
  }

  // main: with the last parameters; a resumed run has none, so it forgets the run and returns to the form
  const handleRetry = () => {
    setImportError(null)
    if (lastParams) {
      submit(lastParams)
      return
    }
    clearRun(runRef)
  }

  // the same import, only to the stores that did not get the menu
  const handleRetryStores = () => {
    stores.setIds(retryStoreIds)
    submit({ ...lastParams, businessIds: retryStoreIds })
  }

  const handleImportAnother = () => {
    setImportSuccess(false)
    setImportError(null)
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

  if (!open || !card || !config) return null

  const storeName = stores.chosenName(business?.name || t('BUSINESS', 'Business'))
  const sentStoreCount = lastParams?.businessIds?.length || 0
  const sourceName = t(card.titleKey, card.titleDefault)
  const validationMessage = showFormError
    ? t(formValidation.error, VALIDATION_DEFAULTS[formValidation.error] ?? formValidation.error)
    : null
  const alertMessage = importError || validationMessage
  // main's title for a failed import, once the hook says it failed (its message is the one under it)
  const failureTitle = importError && status === 'failed'
    ? fillTemplate(t('IMPORTER_STATUS_FAILED_TITLE', 'The {{source}} menu was not imported'), { source: sourceName })
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
  } else {
    footer = (
      <>
        <Button onClick={() => onClose?.()} disabled={isImporting}>
          {t('IMPORTER_MODAL_CANCEL', 'Cancel')}
        </Button>
        <Button
          variant='primary'
          busy={isImporting}
          disabled={!isImportEnabled && !isImporting}
          onClick={canRetry ? handleRetry : handleImport}
        >
          {canRetry ? t('IMPORTER_RETRY', 'Retry') : t('IMPORTER_MODAL_IMPORT', 'Import')}
        </Button>
      </>
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => { if (!next && !isImporting) onClose?.() }}
      size='md'
      title={t(config.titleKey, config.titleDefault)}
      description={outcome ? undefined : t(config.subtitleKey, config.subtitleDefault)}
      closeLabel={t('CLOSE', 'Close')}
      dismissible={!isImporting}
      closeDisabled={isImporting}
      initialFocus={outcome ? primaryRef : urlRef}
      footer={footer}
    >
      <div className='odc-imp-body'>
        {outcome
          ? <ImportOutcome status={outcome} result={['success', 'partial', 'queued'].includes(viewStatus) ? result : null} t={t} nameOf={stores.nameOf} storeCount={sentStoreCount} />
          : (
            <>
              {showImporting && (
                <ImportRunning
                  message={t(config.statusImportingKey, config.statusImportingDefault)}
                  startedAt={startedAt || storedRun?.startedAt}
                />
              )}

              <ImportStores storeName={storeName} stores={stores} disabled={showImporting} />

              <div className='odc-imp-field'>
                <TextField
                  ref={urlRef}
                  label={t(config.urlLabelKey, config.urlLabelDefault)}
                  hint={t(config.urlHelperKey, config.urlHelperDefault)}
                  placeholder={t(config.urlPlaceholderKey, config.urlPlaceholderDefault)}
                  inputMode='url'
                  autoComplete='url'
                  value={urlInput}
                  onChange={edit(setUrlInput)}
                  invalid={showFormError && urlInput.trim() !== ''}
                  disabled={showImporting}
                />
                {showUrlClear && (
                  <Button
                    className='odc-imp-clear'
                    variant='link'
                    size='sm'
                    onClick={handleClearUrlFields}
                    disabled={showImporting}
                  >
                    {t('CLEAR', 'Clear')}
                  </Button>
                )}
              </div>

              {config.trackerLabelKey && (
                <TextField
                  label={t(config.trackerLabelKey, config.trackerLabelDefault)}
                  hint={t(config.trackerHelperKey, config.trackerHelperDefault)}
                  placeholder={t(config.trackerPlaceholderKey, config.trackerPlaceholderDefault)}
                  autoComplete='off'
                  className='odc-imp-mono'
                  value={trackerInput}
                  onChange={edit(setTrackerInput)}
                  disabled={showImporting}
                />
              )}

              {config.orderingProjectLabelKey && (
                <div className='odc-imp-structured'>
                  <p className='odc-imp-or'>{t(config.orderingOrKey, config.orderingOrDefault)}</p>
                  <TextField
                    label={t(config.orderingProjectLabelKey, config.orderingProjectLabelDefault)}
                    placeholder={t(config.orderingProjectPlaceholderKey, config.orderingProjectPlaceholderDefault)}
                    autoComplete='off'
                    value={orderingPlusProjectId}
                    onChange={edit(setOrderingPlusProjectId)}
                    disabled={showImporting}
                  />
                  <TextField
                    label={t(config.orderingBusinessSegmentLabelKey, config.orderingBusinessSegmentLabelDefault)}
                    placeholder={t(config.orderingBusinessSegmentPlaceholderKey, config.orderingBusinessSegmentPlaceholderDefault)}
                    autoComplete='off'
                    value={orderingBusinessSegment}
                    onChange={edit(setOrderingBusinessSegment)}
                    disabled={showImporting}
                  />
                  <p className='odc-imp-hint'>{t(config.orderingStructuredHintKey, config.orderingStructuredHintDefault)}</p>
                </div>
              )}

              {config.includeAllMenuVariantsKey && (
                <Checkbox
                  checked={includeAllMenuVariants}
                  onCheckedChange={handleVariantsChange}
                  disabled={showImporting}
                >
                  {t(config.includeAllMenuVariantsKey, config.includeAllMenuVariantsDefault)}
                </Checkbox>
              )}

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
