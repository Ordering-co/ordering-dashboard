import React from 'react'
import { useTheme } from 'styled-components'
import BsInfoCircle from '@meronex/icons/bs/BsInfoCircle'

import { getFeeAmount, getFeeKey, shouldShowFeeItem, shouldShowFeeRateDetails } from '../../../utils/feeBillUtils'

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

  const theme = useTheme()

  const visibleFees = fees?.filter(shouldShowFeeItem) ?? []

  if (!visibleFees.length) return null

  const handleOpenFeeModal = (fee) => {
    setOpenTaxModal?.({ open: true, data: fee, type: 'fee' })
  }

  const InfoIcon = () => (
    <BsInfoCircle size='20' color={theme.colors.primary} />
  )

  return visibleFees.map((fee, index) => (
    <tr key={getFeeKey(fee, index)}>
      <td className={iconVariant === 'icon' ? 'icon' : undefined}>
        {fee?.name
          ? t(fee.name.toUpperCase().replace(/ /g, '_'), fee.name)
          : t('INHERIT_FROM_BUSINESS', 'Inherit from business')}
        {shouldShowFeeRateDetails(fee) && (
          <span>
            ({fee?.fixed > 0 && `${parsePrice(fee?.fixed)}${fee.percentage > 0 ? ' + ' : ''}`}{fee.percentage > 0 && `${fee.percentage}%`})
          </span>
        )}
        {setOpenTaxModal && iconVariant === 'icon' && IconWrapper && (
          <IconWrapper onClick={() => handleOpenFeeModal(fee)}>
            <InfoIcon />
          </IconWrapper>
        )}
        {setOpenTaxModal && iconVariant === 'exclamation' && ExclamationWrapper && (
          <ExclamationWrapper onClick={() => handleOpenFeeModal(fee)}>
            <InfoIcon />
          </ExclamationWrapper>
        )}
      </td>
      <td>{parsePrice(getFeeAmount(fee))}</td>
    </tr>
  ))
}
