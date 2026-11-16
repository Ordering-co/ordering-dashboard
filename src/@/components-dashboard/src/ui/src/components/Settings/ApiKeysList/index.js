import React, { useState, useEffect } from 'react'
import { useLanguage, ApiKeysList as ApiKeysListController } from '../../../../../index'
import { Button } from '../../../styles'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { Dropdown, DropdownButton } from 'react-bootstrap'
import { ThreeDotsVertical } from 'react-bootstrap-icons'
import { useTheme } from 'styled-components'
import { Alert, Confirm } from '../../Shared'
import { Button as ProductButton, CopyButton } from '../../Shared/Product'
import { SECRET_ENDING_MIN_LENGTH } from '../../Shared/Product/SecretField'

import {
  ApiKeysListContainer,
  Header,
  ApiKeysListTable,
  DropdownButtonWrapper,
  KeyCell
} from './styles'

// Owner decision 25 B (2026-10-21, , security): a key reads «Ends in …k3Fz» with «Copy» (the whole key) and «Show», by the
// P/SecretField criterion of hidden by default, the last four characters only from 12 characters on. main showed every key
// whole (and named the row menu with it). The whole key is in the page only while its row is shown.
const ELLIPSIS = '…'
const keyEnding = (key) => typeof key === 'string' && key.length >= SECRET_ENDING_MIN_LENGTH ? `${ELLIPSIS}${key.slice(-4)}` : null

const ApiKeysListUI = (props) => {
  const {
    apiKeysList,
    actionState,
    handleDeleteApiKey,
    handleAddApiKey
  } = props

  const [, t] = useLanguage()
  const theme = useTheme()
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [confirm, setConfirm] = useState({ open: false, content: null, handleOnAccept: null })
  const [shownId, setShownId] = useState(null)
  const [endsBefore, endsAfter] = t('SECRET_ENDS_IN', 'Ends in _ending_').split('_ending_')
  // The row's name, for its buttons: the ending, or its position when the key is too short to show one
  const keyName = (apiKey, index) => {
    const ending = keyEnding(apiKey?.key)
    return ending
      ? t('API_KEY_ENDING', 'API key ending in _ending_').replace('_ending_', () => ending)
      : t('API_KEY_N', 'API key _n_').replace('_n_', () => String(index + 1))
  }

  // The three-dots button has no text of its own: its name carries the row it belongs to.
  const rowActionsLabel = (name) => t('STORES_ROW_ACTIONS', 'Actions for _name_').replace('_name_', name ?? '')

  const onClickDeleteApiKey = (keyId) => {
    setConfirm({
      open: true,
      content: t('QUESTION_DELETE_KEY', 'Are you sure to delete this key?'),
      handleOnAccept: () => {
        setConfirm({ ...confirm, open: false })
        handleDeleteApiKey(keyId)
      }
    })
  }

  useEffect(() => {
    if (!actionState?.error) return
    setAlertState({
      open: true,
      content: actionState?.error
    })
  }, [actionState?.error])

  return (
    <>
      <ApiKeysListContainer>
        <Header>
          <h1>{t('KEYS')}</h1>
          <Button
            borderRadius='8px'
            color='lightPrimary'
            onClick={() => handleAddApiKey()}
          >
            {t('ADD_API_KEY', 'Add API Key')}
          </Button>
        </Header>
        <ApiKeysListTable>
          <thead>
            <tr>
              <th>{t('API_KEY', 'Api Key')}</th>
              <td>{t('ACTIONS', 'Actions')}</td>
            </tr>
          </thead>
          {apiKeysList?.loading
            ? (
                [...Array(10).keys()].map(i => (
              <tbody key={i}>
                <tr>
                  <td><Skeleton width={100} /></td>
                  <td><Skeleton width={20} /></td>
                </tr>
              </tbody>
                ))
              )
            : (
                apiKeysList?.keys?.map((apiKey, index) => {
                  const ending = keyEnding(apiKey?.key)
                  const name = keyName(apiKey, index)
                  const shown = shownId === apiKey.id
                  return (
              <tbody key={apiKey.id}>
                <tr>
                  <td>
                    <KeyCell>
                      <span className='odc-api-key-value'>
                        {shown
                          ? <bdi className='odc-figure' dir='ltr'>{apiKey?.key}</bdi>
                          : ending
                            ? <>{endsBefore}<bdi className='odc-figure' dir='ltr'>{ending}</bdi>{endsAfter}</>
                            : <span aria-hidden='true'>••••••••</span>}
                      </span>
                      <span className='odc-api-key-actions'>
                        <ProductButton
                          variant='secondary'
                          aria-label={`${shown ? t('HIDE', 'Hide') : t('SHOW', 'Show')} ${name}`}
                          onClick={() => setShownId(shown ? null : apiKey.id)}
                        >
                          {shown ? t('HIDE', 'Hide') : t('SHOW', 'Show')}
                        </ProductButton>
                        <CopyButton
                          variant='secondary'
                          text={apiKey?.key}
                          label={`${t('COPY_BUTTON', 'Copy')} ${name}`}
                          copyLabel={t('COPY_BUTTON', 'Copy')}
                          copiedLabel={t('COPIED', 'Copied')}
                          failedLabel={t('API_KEY_COPY_FAILED', "We couldn't copy the key. Show it and copy it by hand.")}
                        />
                      </span>
                    </KeyCell>
                  </td>
                  <td>
                    <DropdownButtonWrapper>
                      <DropdownButton
                        menuAlign={theme?.rtl ? 'left' : 'right'}
                        title={(
                          <>
                            <ThreeDotsVertical aria-hidden='true' />
                            <span className='odc-sr-only'>{rowActionsLabel(name)}</span>
                          </>
                        )}
                        id={`api-key-actions-${apiKey.id}`}
                      >
                        <Dropdown.Item
                          onClick={() => navigator.clipboard.writeText(apiKey.key)}
                        >
                          {t('COPY_BUTTON', 'Copy')}
                        </Dropdown.Item>
                        <Dropdown.Item
                          onClick={() => onClickDeleteApiKey(apiKey.id)}
                        >
                          {t('DELETE', 'Delete')}
                        </Dropdown.Item>
                      </DropdownButton>
                    </DropdownButtonWrapper>
                  </td>
                </tr>
              </tbody>
                  )
                })
              )}
        </ApiKeysListTable>
        <Button
          color='primary'
          borderRadius='8px'
          onClick={() => handleAddApiKey()}
        >
          {t('ADD_API_KEY', 'Add API Key')}
        </Button>
      </ApiKeysListContainer>
      <Alert
        title={t('WEB_APPNAME', 'Ordering')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => setAlertState({ open: false, content: [] })}
        onAccept={() => setAlertState({ open: false, content: [] })}
        closeOnBackdrop={false}
      />
      <Confirm
        title={t('WEB_APPNAME', 'Ordering')}
        content={confirm.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={confirm.open}
        onClose={() => setConfirm({ ...confirm, open: false })}
        onCancel={() => setConfirm({ ...confirm, open: false })}
        onAccept={confirm.handleOnAccept}
        closeOnBackdrop={false}
      />
    </>
  )
}

export const ApiKeysList = (props) => {
  const apiKeysProps = {
    ...props,
    UIComponent: ApiKeysListUI
  }

  return <ApiKeysListController {...apiKeysProps} />
}
