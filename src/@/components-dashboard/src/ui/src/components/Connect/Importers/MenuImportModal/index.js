import React, { useEffect, useMemo, useState } from 'react'
import { useHistory } from 'react-router-dom'
import dayjs from 'dayjs'
import { useApi, useLanguage, useSession } from '~components'
import { AppBootLoader, Modal } from '../../../Shared'
import { Button } from '../../../../styles'
import { useMenuImport } from '../useMenuImport'
import { useMenuImportRun } from '../useMenuImportRun'
import { clearRun, isRunResolved } from '../menuImportRuns'
import { fetchMenuImportSync, parseStoredSourceUrl } from '../logMenuImportSync'
import { ImportStatusView } from './ImportStatusView'

import {
  ModalBody,
  Subtitle,
  FieldGroup,
  FieldLabel,
  FieldLabelRow,
  ClearFieldButton,
  FieldHelper,
  FieldError,
  BusinessSummary,
  CheckboxRow,
  StructuredFields,
  StructuredHint,
  OrDivider,
  FooterActions,
  LoadingOverlay,
  StyledInput
} from './styles'

const translateField = (t, key, fallback) => t(key, fallback)

export const MenuImportModal = (props) => {
  const {
    open,
    onClose,
    card,
    business
  } = props

  const config = card?.modalConfig
  const [, t] = useLanguage()
  const [{ user, token }] = useSession()
  const [ordering] = useApi()
  const history = useHistory()
  const { triggerImport, isImporting, status, error, result, startedAt, reset } = useMenuImport(card?.id)
  const runRef = { project: ordering?.project, businessId: business?.id, source: card?.id }
  const storedRun = useMenuImportRun(runRef)
  // A run left importing or unknown by a previous session is shown instead of the empty form.
  const resumedStatus = status === 'idle' &&
    ['importing', 'unknown'].includes(storedRun?.status) &&
    !isRunResolved(storedRun)
    ? storedRun.status
    : null
  const viewStatus = resumedStatus || status

  const [urlInput, setUrlInput] = useState('')
  const [trackerInput, setTrackerInput] = useState('')
  const [orderingPlusProjectId, setOrderingPlusProjectId] = useState('')
  const [orderingBusinessSegment, setOrderingBusinessSegment] = useState('')
  const [includeAllMenuVariants, setIncludeAllMenuVariants] = useState(true)
  const [editing, setEditing] = useState(false)
  const [lastParams, setLastParams] = useState(null)
  const [hasFetchedUrl, setHasFetchedUrl] = useState(false)

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

  const projectApiRoot = ordering?.root || ''
  const formValidation = useMemo(
    () => (config?.validateForm
      ? config.validateForm(importForm, { projectApiRoot })
      : { valid: true }),
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
    formValidation.valid &&
    !isImporting
  )

  useEffect(() => {
    if (!open) {
      setUrlInput('')
      setTrackerInput('')
      setOrderingPlusProjectId('')
      setOrderingBusinessSegment('')
      setIncludeAllMenuVariants(true)
      setEditing(false)
      setLastParams(null)
      setHasFetchedUrl(false)
      return
    }

    setUrlInput('')
    setTrackerInput('')
    setOrderingPlusProjectId('')
    setOrderingBusinessSegment('')
    setIncludeAllMenuVariants(true)
    setEditing(false)
    setLastParams(null)
    setHasFetchedUrl(false)

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
      if (cancelled || !event?.source_url) return
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

  const handleClearUrlFields = () => {
    setUrlInput('')
    setOrderingPlusProjectId('')
    setOrderingBusinessSegment('')
  }

  const handleImport = async () => {
    if (!isImportEnabled || !config) return

    const params = config.buildImportParams(
      importForm,
      [business.id],
      ordering?.project,
      ordering?.root,
      includeAllMenuVariants,
      user?.email
    )
    setLastParams(params)
    setEditing(false)

    await triggerImport(params)
  }

  const handleRetry = () => {
    setEditing(false)
    if (lastParams) {
      triggerImport(lastParams)
      return
    }
    clearRun(runRef)
  }

  const handleEdit = () => {
    setEditing(true)
    clearRun(runRef)
  }

  const handleImportAnother = () => {
    setEditing(false)
    reset()
    clearRun(runRef)
  }

  const showImporting = viewStatus === 'importing'
  const showOutcome = !editing && ['success', 'failed', 'unknown'].includes(viewStatus)
  const shownStartedAt = startedAt || storedRun?.startedAt

  const handleGoToProducts = () => {
    if (business?.slug) {
      history.push(`/stores/products/${business.slug}`)
    } else {
      history.push('/stores/products')
    }
    onClose?.()
  }

  if (!open || !card || !config) return null

  return (
    <Modal
      open={open}
      onClose={isImporting ? undefined : onClose}
      title={translateField(t, config.titleKey, config.titleDefault)}
      width='100%'
      maxWidth='640px'
      padding='24px'
      hideCloseDefault={isImporting}
    >
      <ModalBody>
        {showImporting && (
          <LoadingOverlay aria-live='polite'>
            <AppBootLoader variant='auth' />
            <p>{translateField(t, config.statusImportingKey, config.statusImportingDefault)}</p>
            {shownStartedAt && <p>{dayjs(shownStartedAt).format('MMM D, YYYY h:mm A')}</p>}
          </LoadingOverlay>
        )}

        {showOutcome
          ? (
            <ImportStatusView
              status={viewStatus}
              error={error}
              result={result}
              sourceName={translateField(t, card.titleKey, card.titleDefault)}
              t={t}
              onRetry={handleRetry}
              onEdit={handleEdit}
              onCheckProducts={handleGoToProducts}
              onImportAnother={handleImportAnother}
              onGoToProducts={handleGoToProducts}
            />
            )
          : (
            <>
              <Subtitle>
                {translateField(t, config.subtitleKey, config.subtitleDefault)}
              </Subtitle>

              <BusinessSummary>
                <p className='label'>{t('IMPORTER_MODAL_BUSINESS_LABEL', 'Store')}</p>
                <p className='name'>{business?.name || t('BUSINESS', 'Business')}</p>
              </BusinessSummary>

              <FieldGroup>
                <FieldLabelRow>
                  <FieldLabel htmlFor='menu-import-url-input'>
                    {translateField(t, config.urlLabelKey, config.urlLabelDefault)}
                  </FieldLabel>
                  {showUrlClear && (
                    <ClearFieldButton
                      type='button'
                      onClick={handleClearUrlFields}
                      disabled={isImporting}
                    >
                      {t('CLEAR', 'Clear')}
                    </ClearFieldButton>
                  )}
                </FieldLabelRow>
                <StyledInput
                  id='menu-import-url-input'
                  type='text'
                  inputMode='url'
                  autoComplete='url'
                  value={urlInput}
                  onChange={(event) => setUrlInput(event.target.value)}
                  placeholder={translateField(t, config.urlPlaceholderKey, config.urlPlaceholderDefault)}
                  aria-invalid={showFormError && urlInput.trim() !== ''}
                />
                <FieldHelper>
                  {translateField(t, config.urlHelperKey, config.urlHelperDefault)}
                </FieldHelper>
              </FieldGroup>

              {config.trackerLabelKey && (
                <FieldGroup>
                  <FieldLabel htmlFor='menu-import-tracker-input'>
                    {translateField(t, config.trackerLabelKey, config.trackerLabelDefault)}
                  </FieldLabel>
                  <StyledInput
                    id='menu-import-tracker-input'
                    type='text'
                    autoComplete='off'
                    $mono
                    value={trackerInput}
                    onChange={(event) => setTrackerInput(event.target.value)}
                    placeholder={translateField(t, config.trackerPlaceholderKey, config.trackerPlaceholderDefault)}
                  />
                  <FieldHelper>
                    {translateField(t, config.trackerHelperKey, config.trackerHelperDefault)}
                  </FieldHelper>
                </FieldGroup>
              )}

              {config.orderingProjectLabelKey && (
                <StructuredFields>
                  <OrDivider>
                    {translateField(t, config.orderingOrKey, config.orderingOrDefault)}
                  </OrDivider>
                  <FieldGroup>
                    <FieldLabel htmlFor='menu-import-ordering-project'>
                      {translateField(t, config.orderingProjectLabelKey, config.orderingProjectLabelDefault)}
                    </FieldLabel>
                    <StyledInput
                      id='menu-import-ordering-project'
                      type='text'
                      autoComplete='off'
                      value={orderingPlusProjectId}
                      onChange={(event) => setOrderingPlusProjectId(event.target.value)}
                      placeholder={translateField(t, config.orderingProjectPlaceholderKey, config.orderingProjectPlaceholderDefault)}
                    />
                  </FieldGroup>
                  <FieldGroup>
                    <FieldLabel htmlFor='menu-import-ordering-segment'>
                      {translateField(t, config.orderingBusinessSegmentLabelKey, config.orderingBusinessSegmentLabelDefault)}
                    </FieldLabel>
                    <StyledInput
                      id='menu-import-ordering-segment'
                      type='text'
                      autoComplete='off'
                      value={orderingBusinessSegment}
                      onChange={(event) => setOrderingBusinessSegment(event.target.value)}
                      placeholder={translateField(t, config.orderingBusinessSegmentPlaceholderKey, config.orderingBusinessSegmentPlaceholderDefault)}
                    />
                  </FieldGroup>
                  <StructuredHint>
                    {translateField(t, config.orderingStructuredHintKey, config.orderingStructuredHintDefault)}
                  </StructuredHint>
                </StructuredFields>
              )}

              {showFormError && (
                <FieldError role='alert'>
                  {formValidation.error === 'IMPORTER_VALIDATION_ORDERING_HOST_NOT_ALLOWED'
                    ? t(
                      'IMPORTER_VALIDATION_ORDERING_HOST_NOT_ALLOWED',
                      'Only Ordering.co API URLs are accepted here.'
                    )
                    : t(formValidation.error, formValidation.error)}
                </FieldError>
              )}

              {config.includeAllMenuVariantsKey && (
                <CheckboxRow htmlFor='menu-import-include-variants'>
                  <input
                    id='menu-import-include-variants'
                    type='checkbox'
                    checked={includeAllMenuVariants}
                    onChange={(event) => setIncludeAllMenuVariants(event.target.checked)}
                  />
                  <span>
                    {translateField(t, config.includeAllMenuVariantsKey, config.includeAllMenuVariantsDefault)}
                  </span>
                </CheckboxRow>
              )}

              <FooterActions>
                <Button
                  color='lightPrimary'
                  borderRadius='8px'
                  onClick={onClose}
                  disabled={isImporting}
                >
                  {t('IMPORTER_MODAL_CANCEL', 'Cancel')}
                </Button>
                <Button
                  color='primary'
                  borderRadius='8px'
                  onClick={handleImport}
                  disabled={!isImportEnabled}
                >
                  {t('IMPORTER_MODAL_IMPORT', 'Import')}
                </Button>
              </FooterActions>
            </>
            )}
      </ModalBody>
    </Modal>
  )
}
