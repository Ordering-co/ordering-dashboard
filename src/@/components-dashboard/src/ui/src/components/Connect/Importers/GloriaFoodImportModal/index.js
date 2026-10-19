import React, { useEffect, useMemo, useState } from 'react'
import { useHistory } from 'react-router-dom'
import dayjs from 'dayjs'
import { useApi, useLanguage, useSession } from '~components'
import { AppBootLoader, Modal } from '../../../Shared'
import { Button } from '../../../../styles'
import { validateGloriaFoodForm } from '../gloriaFoodImportConfig'
import { useMenuImport } from '../useMenuImport'
import { useMenuImportRun } from '../useMenuImportRun'
import { clearRun, isRunResolved } from '../menuImportRuns'
import { getMenuImportUseFixture } from '../menuImportConfig'
import { fetchMenuImportSync } from '../logMenuImportSync'
import { ImportStatusView } from '../MenuImportModal/ImportStatusView'

import {
  ModalBody,
  Subtitle,
  FieldGroup,
  FieldLabel,
  FieldHelper,
  FieldError,
  BusinessSummary,
  CheckboxRow,
  FooterActions,
  LoadingOverlay,
  StyledInput
} from '../MenuImportModal/styles'
import {
  GLORIAFOOD_HELP_VIDEO_URL,
  HelpVideoFrame,
  StepHeading,
  BackButton
} from './styles'

export const GloriaFoodImportModal = (props) => {
  const { open, onClose, business } = props

  const [, t] = useLanguage()
  const [{ user, token }] = useSession()
  const [ordering] = useApi()
  const history = useHistory()
  const { triggerImport, isImporting, status, error, result, startedAt, reset } = useMenuImport('gloriafood')
  const runRef = { project: ordering?.project, businessId: business?.id, source: 'gloriafood' }
  const storedRun = useMenuImportRun(runRef)
  // A run left importing or unknown by a previous session is shown instead of the help step.
  const resumedStatus = status === 'idle' &&
    ['importing', 'unknown'].includes(storedRun?.status) &&
    !isRunResolved(storedRun)
    ? storedRun.status
    : null
  const viewStatus = resumedStatus || status

  const [step, setStep] = useState('help')
  const [resKey, setResKey] = useState('')
  const [masKey, setMasKey] = useState('')
  const [ignoreForceLimits, setIgnoreForceLimits] = useState(true)
  const [localError, setLocalError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [lastParams, setLastParams] = useState(null)

  const formValidation = useMemo(
    () => validateGloriaFoodForm({ res_key: resKey, mas_key: masKey }),
    [resKey, masKey]
  )

  const showFormError = Boolean(localError || formValidation.error) && (
    resKey.trim() !== '' || masKey.trim() !== ''
  )

  const isImportEnabled = Boolean(
    business?.id &&
    formValidation.valid &&
    !isImporting
  )

  useEffect(() => {
    if (!open) return
    setStep('help')
    setResKey('')
    setMasKey('')
    setIgnoreForceLimits(true)
    setLocalError(null)
    setEditing(false)
    setLastParams(null)

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
      if (cancelled || !event) return
      const restaurantKey = String(event.gloriafood_restaurant_key || '').trim()
      const masterKey = String(event.gloriafood_master_key || '').trim()
      if (restaurantKey) setResKey(restaurantKey)
      if (masterKey) setMasKey(masterKey)
      if (restaurantKey && masterKey) setStep('credentials')
    })

    return () => {
      cancelled = true
    }
  }, [open, business?.id, token, ordering?.project, ordering?.root])

  const handleImport = async () => {
    if (!formValidation.valid) {
      setLocalError(t(formValidation.error, formValidation.errorDefault || formValidation.error))
      return
    }
    if (!business?.id) return

    setLocalError(null)

    const params = {
      gloriafoodRestaurantKey: resKey.trim(),
      gloriafoodMasterKey: masKey.trim(),
      ignoreGloriaFoodForceLimits: ignoreForceLimits,
      businessIds: [business.id],
      project: ordering?.project,
      orderingApiBaseUrl: ordering?.root,
      userEmail: user?.email || undefined,
      useFixture: getMenuImportUseFixture()
    }
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
    setStep('credentials')
    clearRun(runRef)
  }

  const handleEdit = () => {
    setEditing(true)
    setStep('credentials')
    clearRun(runRef)
  }

  const handleImportAnother = () => {
    setEditing(false)
    setStep('credentials')
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

  if (!open || !business) return null

  return (
    <Modal
      open={open}
      onClose={isImporting ? undefined : onClose}
      title={t('IMPORTER_MODAL_GLORIAFOOD_TITLE', 'Import from GloriaFood')}
      width='100%'
      maxWidth='640px'
      padding='24px'
      hideCloseDefault={isImporting}
    >
      <ModalBody>
        {showImporting && (
          <LoadingOverlay aria-live='polite'>
            <AppBootLoader variant='auth' />
            <p>{t('SYNCHRONIZE_MENU_LOADING', 'Synchronize Menu .......')}</p>
            {shownStartedAt && <p>{dayjs(shownStartedAt).format('MMM D, YYYY h:mm A')}</p>}
          </LoadingOverlay>
        )}

        {showOutcome
          ? (
            <ImportStatusView
              status={viewStatus}
              error={error}
              result={result}
              sourceName='GloriaFood'
              t={t}
              onRetry={handleRetry}
              onEdit={handleEdit}
              onCheckProducts={handleGoToProducts}
              onImportAnother={handleImportAnother}
              onGoToProducts={handleGoToProducts}
            />
            )
          : step === 'help'
            ? (
              <>
                <HelpVideoFrame
                  src={GLORIAFOOD_HELP_VIDEO_URL}
                  title={t('IMPORTER_MODAL_GLORIAFOOD_VIDEO_TITLE', 'GloriaFood setup guide')}
                  allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
                  referrerPolicy='strict-origin-when-cross-origin'
                  allowFullScreen
                />
                <FooterActions>
                  <Button
                    color='lightPrimary'
                    borderRadius='8px'
                    onClick={onClose}
                  >
                    {t('IMPORTER_MODAL_CANCEL', 'Cancel')}
                  </Button>
                  <Button
                    color='primary'
                    borderRadius='8px'
                    onClick={() => setStep('credentials')}
                  >
                    {t('CONTINUE', 'Continue')}
                  </Button>
                </FooterActions>
              </>
              )
            : (
              <>
                <StepHeading>
                  <BackButton
                    type='button'
                    aria-label={t('BACK', 'Back')}
                    onClick={() => setStep('help')}
                    disabled={isImporting}
                  >
                    &larr;
                  </BackButton>
                  {t('SYNCHRONIZE', 'Synchronize')}
                </StepHeading>

                <Subtitle>
                  {t(
                    'IMPORTER_MODAL_GLORIAFOOD_SUBTITLE',
                    'Enter the Restaurant Key from GloriaFood (3rd party integrations → Fetch Menu) to synchronize this store menu.'
                  )}
                </Subtitle>

                <BusinessSummary>
                  <p className='label'>{t('IMPORTER_MODAL_BUSINESS_LABEL', 'Store')}</p>
                  <p className='name'>{business?.name || t('BUSINESS', 'Business')}</p>
                </BusinessSummary>

                <FieldGroup>
                  <FieldLabel htmlFor='gloriafood-res-key'>
                    {t('IMPORTER_MODAL_GLORIAFOOD_RESTAURANT_KEY_LABEL', 'Restaurant Key')}
                  </FieldLabel>
                  <StyledInput
                    id='gloriafood-res-key'
                    type='text'
                    autoComplete='off'
                    value={resKey}
                    onChange={(event) => setResKey(event.target.value)}
                    placeholder={t(
                      'IMPORTER_MODAL_GLORIAFOOD_RESTAURANT_KEY_PLACEHOLDER',
                      'Paste your GloriaFood Restaurant Key'
                    )}
                  />
                </FieldGroup>

                <FieldGroup>
                  <FieldLabel htmlFor='gloriafood-mas-key'>
                    {t('IMPORTER_MODAL_GLORIAFOOD_MASTER_KEY_LABEL', 'Master Key')}
                  </FieldLabel>
                  <StyledInput
                    id='gloriafood-mas-key'
                    type='text'
                    autoComplete='off'
                    value={masKey}
                    onChange={(event) => setMasKey(event.target.value)}
                    placeholder={t(
                      'IMPORTER_MODAL_GLORIAFOOD_MASTER_KEY_PLACEHOLDER',
                      'Paste your GloriaFood Master Key (from the help video)'
                    )}
                  />
                  <FieldHelper>
                    {t(
                      'IMPORTER_MODAL_GLORIAFOOD_HELPER',
                      'The Restaurant Key is used to fetch the menu. The Master Key is only required for setup parity with the help video.'
                    )}
                  </FieldHelper>
                </FieldGroup>

                <CheckboxRow htmlFor='gloriafood-ignore-force-limits'>
                  <input
                    id='gloriafood-ignore-force-limits'
                    type='checkbox'
                    checked={ignoreForceLimits}
                    onChange={(event) => setIgnoreForceLimits(event.target.checked)}
                    disabled={isImporting}
                  />
                  <span>
                    {t(
                      'IMPORTER_MODAL_GLORIAFOOD_IGNORE_FORCE_LIMITS',
                      'Allow customers to choose more than one option in each group'
                    )}
                  </span>
                </CheckboxRow>
                <FieldHelper>
                  {t(
                    'IMPORTER_MODAL_GLORIAFOOD_IGNORE_FORCE_LIMITS_HELPER',
                    'Some GloriaFood menus only allow one choice per group. Leave this on so customers can pick several, like on GloriaFood.'
                  )}
                </FieldHelper>

                {showFormError && (
                  <FieldError role='alert'>
                    {localError || t(formValidation.error, formValidation.errorDefault || formValidation.error)}
                  </FieldError>
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
                    {t('SYNCHRONIZE_MENU', 'Synchronize Menu')}
                  </Button>
                </FooterActions>
              </>
              )}
      </ModalBody>
    </Modal>
  )
}
