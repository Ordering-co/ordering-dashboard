import React from 'react'

import { getFeeAmount, getFeeKey, shouldShowFeeItem, shouldShowFeeRateDetails } from '../../../utils/feeBillUtils'
import { BillRow } from './bill-row-styles'
import { BillRowAction } from './sharedBillRowAction'

export const FeeBillRows = (props) => {
  const {
    fees,
    setOpenTaxModal,
    parsePrice,
    t,
    iconVariant = 'icon',
    IconWrapper,
    ExclamationWrapper
  } = props

  const visibleFees = fees?.filter(shouldShowFeeItem) ?? []

  if (!visibleFees.length) return null

  const handleOpenFeeModal = (fee) => {
    setOpenTaxModal?.({ open: true, data: fee, type: 'fee' })
  }

  return visibleFees.map((fee, index) => {
    const feeName = fee?.name
      ? t(fee.name.toUpperCase().replace(/ /g, '_'), fee.name)
      : t('INHERIT_FROM_BUSINESS', 'Inherit from business')
    const actionLabel = `${t('INFO', 'Info')}: ${feeName}`

    return (
      <BillRow key={getFeeKey(fee, index)} rowKind='fee'>
        <td className={iconVariant === 'icon' ? 'icon' : undefined} data-bill-row-slot='label'>
          {feeName}
          {shouldShowFeeRateDetails(fee) && (
            <span>
              ({fee?.fixed > 0 && `${parsePrice(fee?.fixed)}${fee.percentage > 0 ? ' + ' : ''}`}{fee.percentage > 0 && `${fee.percentage}%`})
            </span>
          )}
          {setOpenTaxModal && iconVariant === 'icon' && IconWrapper && (
            <BillRowAction
              label={actionLabel}
              onClick={() => handleOpenFeeModal(fee)}
              variant='icon'
              Wrapper={IconWrapper}
            />
          )}
          {setOpenTaxModal && iconVariant === 'exclamation' && ExclamationWrapper && (
            <BillRowAction
              label={actionLabel}
              onClick={() => handleOpenFeeModal(fee)}
              variant='exclamation'
              Wrapper={ExclamationWrapper}
            />
          )}
        </td>
        <td data-bill-row-slot='amount'>{parsePrice(getFeeAmount(fee))}</td>
      </BillRow>
    )
  })
}
