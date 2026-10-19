import React from 'react'
import { Button } from '../../../../styles'
import { FooterActions, StatusBlock, StatusTitle } from './styles'
import { fillTemplate } from '../fillTemplate'

const focusStatus = (node) => {
  if (node) node.focus()
}

/**
 * Outcome of an import inside the modal. Every state opens with a verdict line
 * (what happened) and follows with the detail (why, what to do next).
 */
export const ImportStatusView = ({
  status,
  error,
  result,
  sourceName,
  t,
  onRetry,
  onEdit,
  onCheckProducts,
  onImportAnother,
  onGoToProducts
}) => {
  if (status === 'success') {
    return (
      <StatusBlock ref={focusStatus} tabIndex={-1}>
        <StatusTitle $tone='success'>{t('IMPORTER_STATUS_SUCCESS', 'Menu imported successfully')}</StatusTitle>
        <p>
          {fillTemplate(
            t('IMPORTER_SUCCESS_APPLIED_COUNT', 'Menu imported to {{count}} store(s)'),
            { count: result?.appliedCount ?? 0 }
          )}
        </p>
        <FooterActions>
          <Button color='primary' borderRadius='8px' onClick={onGoToProducts}>
            {t('IMPORTER_GO_TO_PRODUCTS', 'Go to products')}
          </Button>
          <Button color='lightPrimary' borderRadius='8px' onClick={onImportAnother}>
            {t('IMPORTER_IMPORT_ANOTHER', 'Import another menu')}
          </Button>
        </FooterActions>
      </StatusBlock>
    )
  }

  if (status === 'failed') {
    return (
      <StatusBlock ref={focusStatus} tabIndex={-1} role='alert'>
        <StatusTitle $tone='danger'>
          {fillTemplate(
            t('IMPORTER_STATUS_FAILED_TITLE', 'The {{source}} menu was not imported'),
            { source: sourceName }
          )}
        </StatusTitle>
        <p>{error?.message}</p>
        <FooterActions>
          {error?.retryable && (
            <Button color='primary' borderRadius='8px' onClick={onRetry}>
              {t('IMPORTER_RETRY', 'Retry')}
            </Button>
          )}
          <Button color='lightPrimary' borderRadius='8px' onClick={onEdit}>
            {t('IMPORTER_EDIT_URL', 'Edit URL')}
          </Button>
        </FooterActions>
      </StatusBlock>
    )
  }

  if (status === 'unknown') {
    return (
      <StatusBlock ref={focusStatus} tabIndex={-1}>
        <StatusTitle>{t('IMPORTER_STATUS_UNKNOWN_TITLE', 'We lost the connection to the importer')}</StatusTitle>
        <p>
          {t(
            'IMPORTER_STATUS_UNKNOWN_BODY',
            'The import may still be running on the server. Check the products in a few minutes before importing again.'
          )}
        </p>
        <FooterActions>
          <Button color='primary' borderRadius='8px' onClick={onCheckProducts}>
            {t('IMPORTER_CHECK_PRODUCTS', 'Check products')}
          </Button>
          <Button color='lightPrimary' borderRadius='8px' onClick={onRetry}>
            {t('IMPORTER_RETRY', 'Retry')}
          </Button>
        </FooterActions>
      </StatusBlock>
    )
  }

  return null
}
