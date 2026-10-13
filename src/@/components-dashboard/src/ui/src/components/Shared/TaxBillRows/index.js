import React from 'react'
import { useTheme } from 'styled-components'
import BsInfoCircle from '@meronex/icons/bs/BsInfoCircle'

import { getTaxAmount, getTaxesByTarget, getTaxKey, shouldShowTaxBillRow, shouldShowTaxRate } from '../../../utils/taxBillUtils'
import { verifyDecimals } from '../../../utils'

export const TaxBillRows = (props) => {
  const {
    taxes,
    target,
    setOpenTaxModal,
    parsePrice,
    parseNumber,
    t,
    iconVariant = 'icon',
    IconWrapper,
    ExclamationWrapper
  } = props

  const theme = useTheme()
  const targetTaxes = getTaxesByTarget(taxes, target).filter(shouldShowTaxBillRow)

  if (!targetTaxes.length) return null

  const handleOpenTaxModal = (tax) => {
    setOpenTaxModal?.({ open: true, data: tax, type: 'tax' })
  }

  const InfoIcon = () => (
    <BsInfoCircle size='20' color={theme.colors.primary} />
  )

  return targetTaxes.map((tax, index) => (
    <tr key={getTaxKey(tax, index)}>
      <td className={iconVariant === 'icon' ? 'icon' : undefined}>
        {tax?.name
          ? t(tax.name.toUpperCase().replace(/ /g, '_'), tax.name)
          : t('INHERIT_FROM_BUSINESS', 'Inherit from business')}
        {shouldShowTaxRate(tax) && (
          <span>{`(${verifyDecimals(tax.rate, parseNumber)}%)`}</span>
        )}
        {setOpenTaxModal && iconVariant === 'icon' && IconWrapper && (
          <IconWrapper onClick={() => handleOpenTaxModal(tax)}>
            <InfoIcon />
          </IconWrapper>
        )}
        {setOpenTaxModal && iconVariant === 'exclamation' && ExclamationWrapper && (
          <ExclamationWrapper onClick={() => handleOpenTaxModal(tax)}>
            <InfoIcon />
          </ExclamationWrapper>
        )}
      </td>
      <td>{parsePrice(getTaxAmount(tax))}</td>
    </tr>
  ))
}
