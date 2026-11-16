import React from 'react'

import { getTaxAmount, getTaxesByTarget, getTaxKey, shouldShowTaxBillRow, shouldShowTaxRate } from '../../../utils/taxBillUtils'
import { verifyDecimals } from '../../../utils/billFormatting'
import { BillRow } from './bill-row-styles'
import { BillRowAction } from './sharedBillRowAction'

// A tax saved with a key as its name (DELIVERY_TAX) reaches the screen raw when the dictionary
// has no entry for it. When `t` hands the key back, say it as words: «Delivery tax». A single
// word (an acronym such as VAT) is left alone.
const readableTaxName = (label, key) => {
  if (label !== key || !key.includes('_')) return label
  const words = key.toLowerCase().replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

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

  const targetTaxes = getTaxesByTarget(taxes, target).filter(shouldShowTaxBillRow)

  if (!targetTaxes.length) return null

  const handleOpenTaxModal = (tax) => {
    setOpenTaxModal?.({ open: true, data: tax, type: 'tax' })
  }

  return targetTaxes.map((tax, index) => {
    const taxKey = tax?.name?.toUpperCase().replace(/ /g, '_')
    const taxName = tax?.name
      ? readableTaxName(t(taxKey, tax.name), taxKey)
      : t('INHERIT_FROM_BUSINESS', 'Inherit from business')
    const actionLabel = `${t('INFO', 'Info')}: ${taxName}`

    return (
      <BillRow key={getTaxKey(tax, index)} rowKind='tax'>
        <td className={iconVariant === 'icon' ? 'icon' : undefined} data-bill-row-slot='label'>
          {taxName}
          {shouldShowTaxRate(tax) && (
            <span>{`(${verifyDecimals(tax.rate, parseNumber)}%)`}</span>
          )}
          {setOpenTaxModal && iconVariant === 'icon' && IconWrapper && (
            <BillRowAction
              label={actionLabel}
              onClick={() => handleOpenTaxModal(tax)}
              variant='icon'
              Wrapper={IconWrapper}
            />
          )}
          {setOpenTaxModal && iconVariant === 'exclamation' && ExclamationWrapper && (
            <BillRowAction
              label={actionLabel}
              onClick={() => handleOpenTaxModal(tax)}
              variant='exclamation'
              Wrapper={ExclamationWrapper}
            />
          )}
        </td>
        <td data-bill-row-slot='amount'>{parsePrice(getTaxAmount(tax))}</td>
      </BillRow>
    )
  })
}
