import React from 'react'

import { useLanguage } from '../../../../../index'
import { Menu } from '../../Shared/Product'
import { useCartContact } from './useCartContact'
import './queue-table.css'

// redesign OC-C (contact, D-4): the «Contact» menu of a cart row or card. One control per row (one Tab stop in the table);
// the actions are named with their object («Call +1 555 0100»), never an icon alone. A guest has nothing to offer, so the
// menu is not drawn at all (the cell shows «—» with the reason, QueueTable). The trigger reads «Contact» and is named
// «Contact Ana Ruiz» for a screen reader (its visible text is inside its name).
// What the menu chooses never opens the row or the card: the menu's popup lives in a portal, but React still bubbles its
// events to the row, so the wrapper stops the click here.
export const ContactMenu = ({ cart, detail }) => {
  const [, t] = useLanguage()
  const { actions, contact } = useCartContact(cart, detail)
  if (!actions.length) return null
  const who = contact.name || contact.email || contact.phone
  return (
    <span className='odc-oq-contact' data-odc-no-open='' onClick={event => event.stopPropagation()}>
      <Menu
        label={t('OPEN_CARTS_CONTACT', 'Contact')}
        items={actions}
        align='end'
        triggerProps={{
          size: 'sm',
          'aria-label': t('OPEN_CARTS_CONTACT_NAMED', 'Contact _name_').replace('_name_', who)
        }}
      />
    </span>
  )
}
