/* eslint-disable import/first */
import React, { useState } from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign fix-qa E9: «Message customer» switches to the Chat tab; the focus goes with it, to the composer of the
// chat (or to the chat itself when the order has ended and there is no composer), not left on a button that is
// now in a hidden tab.
vi.mock('../../../../../../index', () => ({
  GoogleAutocompleteInput: props => <input aria-label={props.placeholder} />,
  GoogleMapsMap: () => <div data-testid='map' />,
  useConfig: () => [{ configs: {} }],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: 0 } }],
  useUtils: () => [{ optimizeImage: value => value }]
}))

vi.mock('../../../../utils', () => ({ getUserType: () => false }))
vi.mock('../../DriverSelector', () => ({ DriverSelector: () => null }))
vi.mock('../../CompanySelector', () => ({ CompanySelector: () => null }))
vi.mock('../../ReviewCustomer', () => ({ ReviewCustomer: () => null }))

import { OrderContactInformation } from '..'

const order = {
  id: 42,
  status: 7,
  delivery_type: 1,
  business: { name: 'Restaurant' },
  customer: { id: 7, name: 'Ada', lastname: 'Lovelace', cellphone: '5552000', email: 'ada@example.test' }
}

const baseProps = {
  addressState: {},
  commentInfoState: {},
  customerInfoState: { customer: {}, loading: false },
  handleChangeCustomerInfoState: vi.fn(),
  handleOpenMessages: vi.fn(),
  handleUpdateCustomerInfo: vi.fn(),
  setAddressState: vi.fn(),
  setCommentInfostate: vi.fn(),
  order
}

// The panel as OrderDetails builds it: the details tab, and the chat pane that stays mounted but hidden.
const Panel = ({ composer = true }) => {
  const [tab, setTab] = useState('details')
  return (
    <div id='orderDetails'>
      <div hidden={tab !== 'details'}>
        <OrderContactInformation {...baseProps} onSelectTab={setTab} />
      </div>
      <div className='odc-od-chat-pane' hidden={tab !== 'chat'}>
        <div className='odt-chat' tabIndex={-1} data-chat-root=''>
          {composer && <input name='message' aria-label='Write a message...' data-chat-composer='' />}
        </div>
      </div>
    </div>
  )
}

describe('Message customer', () => {
  it('moves the focus to the chat composer when it switches to the Chat tab', async () => {
    renderWithProviders(<Panel />)
    fireEvent.click(screen.getByRole('button', { name: 'Message Ada' }))
    await vi.waitFor(() => expect(screen.getByRole('textbox', { name: 'Write a message...' })).toHaveFocus())
  })

  it('moves the focus to the chat itself when the order has ended and there is no composer', async () => {
    renderWithProviders(<Panel composer={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Message Ada' }))
    await vi.waitFor(() => expect(document.querySelector('[data-chat-root]')).toHaveFocus())
  })
})
