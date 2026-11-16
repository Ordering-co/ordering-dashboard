import React from 'react'
import { useLanguage } from '../../../../../index'
import { ChevronRight } from '../../Shared/Icon'
import { AsyncSwitch, Button, StatusBadge } from '../../Shared/Product'
import { getMissingSandboxFields, hasMissingCredentials } from './paymethodModel'

// redesign stores 5.9: one row of the Payment methods list, on P/SectionSplit.
// - An `AsyncSwitch` named by the gateway turns it on or off at once and says why when the save fails (`onToggle(paymethod, next)`
//   answers `{ ok, error }`). A catalog row (a plugin not installed yet) has no switch, only «Install».
// - The name is a native button that opens the detail (`onOpen(paymethod)`), with a chevron that flips in RTL. In the tutorial and on a
//   catalog row there is nothing to open, so the name is plain text.
// - An enabled row says when it is in sandbox or lacks keys. The open row carries `aria-current='true'`.
// The row is an `li`: the list draws the `ul`. `data-section-split-key` is where the focus returns to when the detail closes.
export const PaymethodRow = ({
  paymethod,
  displayName,
  record,
  isEnabled,
  configs,
  active,
  installingPluginKey,
  onToggle,
  onOpen,
  onRequestInstall
}) => {
  const [, t] = useLanguage()
  const isCatalogRow = paymethod?.installState === 'installable' || paymethod?.installState === 'pending'
  const isInstalling = installingPluginKey === paymethod?.pluginKey
  const canOpen = !isCatalogRow && !!paymethod?.id
  const showSandbox = !isCatalogRow && isEnabled && !!record?.sandbox
  // owner decision 5 C (W1): Live keys missing, or Sandbox keys missing while the gateway is in Sandbox mode
  const showKeysMissing = !isCatalogRow && isEnabled && (
    hasMissingCredentials(paymethod, record, configs) || getMissingSandboxFields(paymethod, record).length > 0
  )

  return (
    <li
      className='odc-pm-row'
      data-section-split-key={paymethod?.id ?? undefined}
      aria-current={active ? 'true' : undefined}
    >
      {isCatalogRow
        ? <span className='odc-pm-lead' aria-hidden='true' />
        : (
          <AsyncSwitch
            className='odc-pm-switch'
            checked={!!isEnabled}
            label={displayName}
            failureText={t('PAYMETHOD_TOGGLE_FAILED', 'The payment method was not changed')}
            onToggle={next => onToggle?.(paymethod, next)}
          />
          )}
      {canOpen
        ? (
          <button
            type='button'
            className='odc-paym-name'
            aria-label={`${displayName}, ${t('VIEW_DETAILS', 'View details')}`}
            onClick={() => onOpen?.(paymethod)}
          >
            <span className='odc-pm-name-text' title={displayName}>{displayName}</span>
          </button>
          )
        : <span className='odc-pm-label'><span className='odc-pm-name-text' title={displayName}>{displayName}</span></span>}
      {(showSandbox || showKeysMissing) && (
        <span className='odc-pm-badges'>
          {showSandbox && <StatusBadge family='progress' label={t('SANDBOX', 'Sandbox')} />}
          {showKeysMissing && <StatusBadge family='pending' label={t('PAYMETHOD_KEYS_MISSING', 'Keys missing')} />}
        </span>
      )}
      {paymethod?.installState === 'installable' && (
        <span className='odc-pm-install'>
          <Button
            size='sm'
            disabled={isInstalling}
            onClick={() => onRequestInstall?.(paymethod)}
          >
            {isInstalling ? t('INSTALLING', 'Installing...') : t('INSTALL', 'Install')}
          </Button>
        </span>
      )}
      {canOpen && <ChevronRight className='odc-icon odc-icon-flip odc-pm-chevron' aria-hidden='true' />}
    </li>
  )
}
