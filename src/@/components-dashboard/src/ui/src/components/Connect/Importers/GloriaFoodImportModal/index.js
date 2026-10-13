import React, { useEffect, useMemo, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { useApi, useLanguage, useSession } from '~components'
import { Modal, SpinnerLoader } from '../../../Shared'
import { Button } from '../../../../styles'
import { validateGloriaFoodForm } from '../gloriaFoodImportConfig'
import { useMenuImport } from '../useMenuImport'
import { getMenuImportUseFixture } from '../menuImportConfig'
import { fetchMenuImportSync } from '../logMenuImportSync'

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
  SuccessBody,
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
  const { triggerImport, isImporting } = useMenuImport('gloriafood')

  const [step, setStep] = useState('help')
  const [resKey, setResKey] = useState('')
  const [masKey, setMasKey] = useState('')
  const [ignoreForceLimits, setIgnoreForceLimits] = useState(true)
  const [localError, setLocalError] = useState(null)
  const [importSuccess, setImportSuccess] = useState(false)

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
    !isImporting &&
    !importSuccess
  )

  useEffect(() => {
    if (!open) return
    setStep('help')
    setResKey('')
    setMasKey('')
    setIgnoreForceLimits(true)
    setLocalError(null)
    setImportSuccess(false)

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

    await triggerImport(
      {
        gloriafoodRestaurantKey: resKey.trim(),
        gloriafoodMasterKey: masKey.trim(),
        ignoreGloriaFoodForceLimits: ignoreForceLimits,
        businessIds: [business.id],
        project: ordering?.project,
        orderingApiBaseUrl: ordering?.root,
        userEmail: user?.email || undefined,
        useFixture: getMenuImportUseFixture()
      },
      {
        onSuccess: () => setImportSuccess(true),
        onError: (err) => {
          setLocalError(err?.message || t('IMPORTER_STATUS_ERROR', 'Import failed'))
        }
      }
    )
  }

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
        {isImporting && (
          <LoadingOverlay aria-live='polite'>
            <SpinnerLoader content='' />
            <p>{t('SYNCHRONIZE_MENU_LOADING', 'Synchronize Menu .......')}</p>
          </LoadingOverlay>
        )}

        {importSuccess
          ? (
            <SuccessBody>
              <p>{t('IMPORTER_STATUS_SUCCESS', 'Menu imported successfully')}</p>
              <FooterActions>
                <Button color='primary' borderRadius='8px' onClick={handleGoToProducts}>
                  {t('IMPORTER_GO_TO_PRODUCTS', 'Go to products')}
                </Button>
              </FooterActions>
            </SuccessBody>
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
