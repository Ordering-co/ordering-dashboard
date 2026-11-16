import React from 'react'

import { useLanguage } from '../../../../../index'
import { CreditCard, Ellipsis, LoaderCircle, Trash2 } from '../../Shared/Icon'
import { Menu } from '../../Shared/Product'

const DOTS = '••••'

// The names the card networks write themselves; any other brand gets its first letter in capitals (`unionpay` → «Unionpay»).
const BRAND_NAMES = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover' }

export const brandName = (brand, fallback) => {
  if (typeof brand !== 'string' || !brand.trim()) return fallback
  const key = brand.trim().toLowerCase()
  return BRAND_NAMES[key] ?? `${key.charAt(0).toUpperCase()}${key.slice(1)}`
}

// «Mastercard •••• 4444»: the card as a sentence, for the menu's name and the confirmation's title.
export const cardName = (card, fallback) => `${brandName(card?.data?.brand, fallback)} ${DOTS} ${card?.data?.last4 ?? ''}`.trim()

// redesign BM-B (D3, M-BM6, M-BM10, M-BM11, M-BM12): one saved card. The row is a pressed-state button (not a radio: choosing
// a card is a POST, and a radio's arrows would write on every key). The ⋮ menu is the row's sibling, never inside the button.
// redesign (row 51 R1-3, main-1): `menuRef` is the ⋮ trigger, so the focus can come back to it when the confirmation is
// cancelled; `disabled` is the whole picker locked (the dialog is charging): the row and the ⋮ stop answering, and the ⋮ stays in place.
export const CardRow = ({ card, selected, busy, locked, disabled, canDelete, rowRef, menuRef, onChoose, onDelete }) => {
  const [, t] = useLanguage()
  const fallback = t('CARD', 'Card')
  const name = cardName(card, fallback)

  return (
    <li className='odc-pmp-card' data-selected={selected ? '' : undefined}>
      <button
        ref={rowRef}
        type='button'
        className='odc-pmp-card-btn'
        aria-pressed={selected}
        aria-busy={busy || undefined}
        aria-disabled={disabled || (locked && !selected) ? true : undefined}
        onClick={() => onChoose(card)}
      >
        <CreditCard className='odc-icon odc-pmp-card-icon' />
        <span className='odc-pmp-card-name'>
          <span className='odc-pmp-card-brand'>{brandName(card?.data?.brand, fallback)}</span>
          {' '}
          <span className='odc-figure'>{DOTS} {card?.data?.last4}</span>
        </span>
        {' '}
        {(card?.default || busy) && (
          <span className='odc-pmp-card-end'>
            {card?.default && <span className='odc-pmp-default'>{t('DEFAULT', 'Default')}</span>}
            {busy && <LoaderCircle className='odc-icon odc-pmp-spin' />}
          </span>
        )}
      </button>
      {canDelete && (
        <Menu
          icon={Ellipsis}
          label={t('CARD_ACTIONS', 'Card actions: _card_').split('_card_').join(name)}
          className='odc-pmp-card-menu'
          triggerProps={{ ref: menuRef, disabled: disabled || undefined }}
          items={[
            { key: 'delete', label: t('DELETE_CARD', 'Delete card'), icon: Trash2, tone: 'danger', onSelect: () => onDelete(card) }
          ]}
        />
      )}
    </li>
  )
}
