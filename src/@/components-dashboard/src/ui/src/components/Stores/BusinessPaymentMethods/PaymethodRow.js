import React from 'react'
import RiCheckboxBlankLine from '@meronex/icons/ri/RiCheckboxBlankLine'
import RiCheckboxFill from '@meronex/icons/ri/RiCheckboxFill'
import { ChevronRight } from 'react-bootstrap-icons'
import { useLanguage } from '../../../../../index'
import { Button } from '../../../styles'
import {
  PaymethodOptionContainer,
  PaymethodOption,
  PaymethodLeadSpacer,
  PaymethodName,
  PaymethodInstallAction
} from './styles'

export const PaymethodRow = (props) => {
  const {
    paymethod,
    displayName,
    isEnabled,
    showChevron,
    installingPluginKey,
    onOpenEdit,
    onToggle,
    onRequestInstall,
    isTutorialMode,
    active
  } = props
  const [, t] = useLanguage()
  const isCatalogRow = paymethod?.installState === 'installable' || paymethod?.installState === 'pending'
  const isInstalling = installingPluginKey === paymethod?.pluginKey

  const handleRowClick = (e) => {
    if (isCatalogRow) return
    onOpenEdit?.(e, paymethod.id, paymethod.gateway)
  }

  return (
    <PaymethodOptionContainer
      onClick={handleRowClick}
      active={active}
      disabled={isTutorialMode || isCatalogRow || !paymethod?.id}
    >
      <PaymethodOption
        className={isCatalogRow ? 'paymethod-lead' : 'paymethod-checkbox'}
        onClick={() => {
          if (isCatalogRow) return
          onToggle?.(paymethod.id, true)
        }}
      >
        {isCatalogRow && (
          <PaymethodLeadSpacer className='paymethod-lead-spacer' aria-hidden />
        )}
        {!isCatalogRow && isEnabled && (
          <RiCheckboxFill className='fill' />
        )}
        {!isCatalogRow && !isEnabled && (
          <RiCheckboxBlankLine />
        )}
      </PaymethodOption>
      <PaymethodName title={displayName}>{displayName}</PaymethodName>
      {paymethod?.installState === 'installable' && (
        <PaymethodInstallAction>
          <Button
            color='secundaryDark'
            disabled={isInstalling}
            onClick={(e) => {
              e.stopPropagation()
              onRequestInstall?.(paymethod)
            }}
          >
            {isInstalling ? t('INSTALLING', 'Installing...') : t('INSTALL', 'Install')}
          </Button>
        </PaymethodInstallAction>
      )}
      {showChevron && <ChevronRight />}
    </PaymethodOptionContainer>
  )
}
