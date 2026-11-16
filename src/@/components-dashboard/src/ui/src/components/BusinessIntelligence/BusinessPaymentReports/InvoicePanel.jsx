import React from 'react'

import { useLanguage } from '../../../../../index'
import { Maximize2, Minimize2 } from '../../Shared/Icon'
import { IconButton, RecordPanel, useSplitView } from '../../Shared/Product'
import { BusinessPaymentInvoiceDetail } from '../BusinessPaymentInvoiceDetail'
import './panels.css'

// The text of a translation with its `_slot_` markers replaced by nodes (the id keeps its own `.odc-figure` element)
const fill = (text, slots) => {
  const names = Object.keys(slots)
  return String(text)
    .split(new RegExp(`(${names.join('|')})`))
    .map((part, index) => (names.includes(part) ? <React.Fragment key={index}>{slots[part]}</React.Fragment> : part))
}

/**
 * redesign business-payments FD (D8): the panel of one invoice, a RecordPanel of Product inside the SplitView the shell
 * mounts. The body is the printable document (`BusinessPaymentInvoiceDetail`), unchanged; the header adds the Expand
 * button («Click to expand» of main). `expanded` and `onExpandedChange` are the shell's.
 */
export const InvoicePanel = ({ invoiceId, onClose, expanded = false, onExpandedChange }) => {
  const [, t] = useLanguage()
  const split = useSplitView()
  const phone = split.mode === 'full'

  const headerActions = !phone && onExpandedChange
    ? (
      <IconButton
        icon={expanded ? Minimize2 : Maximize2}
        label={expanded ? t('COLLAPSE', 'Collapse') : t('EXPAND', 'Expand')}
        onClick={() => onExpandedChange(!expanded)}
      />
      )
    : null

  return (
    <RecordPanel
      className='bpp-panel'
      data-kind='invoice'
      title={fill(t('BUSINESS_PAYMENTS_INVOICE_NUMBER', 'Invoice #_id_'), { _id_: <span className='odc-figure'>{invoiceId}</span> })}
      closeLabel={phone ? t('BACK', 'Back') : t('CLOSE', 'Close')}
      onClose={onClose}
      headerActions={headerActions}
    >
      <BusinessPaymentInvoiceDetail invoiceId={invoiceId} />
    </RecordPanel>
  )
}
