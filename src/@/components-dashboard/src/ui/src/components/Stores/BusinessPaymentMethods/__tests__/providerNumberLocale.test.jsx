/* eslint-disable import/first */
// redesign bugs C: the number fields of a provider form (ePayco's fees) read numbers in the dashboard's language, not in
// the browser's. With the dashboard in Spanish, «1,5» is one and a half; in a browser in English it used to be saved as 1.
import React from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import theme from '~/theme.json'

const language = vi.hoisted(() => ({ code: 'es' }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: language.code } }, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: 0 } }],
  useConfig: () => [{ configs: {} }],
  useApi: () => [{ project: 'acme' }],
  useToast: () => [{}, { showToast: () => {} }]
}))

import { PaymentOptionEpayco } from '../../PaymentOptionEpayco'

const record = {
  id: 5,
  paymethod_id: 1,
  enabled: true,
  sandbox: false,
  data: { receiver_id: '991', receiver_fee_percentage: '2', receiver_fee_fixed: '0', split_receivers: [] },
  data_sandbox: {},
  allowed_order_types: [1],
  sites: [],
  devices: []
}

const setup = () => {
  const user = userEvent.setup()
  const onSave = vi.fn().mockResolvedValue({ ok: true })
  renderWithProviders(
    <PaymentOptionEpayco
      paymethod={{ id: 1, gateway: 'epayco', name: 'ePayco', data_template: null }}
      businessPaymethod={record}
      gatewayName='ePayco'
      storeName='Burger Hub'
      sites={[]}
      devices={[]}
      orderTypes={[{ value: 1, text: 'Delivery' }]}
      onSave={onSave}
      onTabChange={() => {}}
    />,
    { theme }
  )
  return { user, onSave }
}

const typeFee = async (user, text) => {
  const field = screen.getByRole('textbox', { name: 'Receiver fee (%)' })
  await user.clear(field)
  await user.type(field, text)
  await user.tab()
}

describe('provider number fields follow the dashboard language', () => {
  it('with the dashboard in Spanish, «1,5» is saved as 1.5', async () => {
    language.code = 'es'
    const { user, onSave } = setup()
    await typeFee(user, '1,5')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ data: { ...record.data, receiver_fee_percentage: '1.5' } })
  })

  it('with the dashboard in English, «1.5» is saved as 1.5', async () => {
    language.code = 'en'
    const { user, onSave } = setup()
    await typeFee(user, '1.5')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ data: { ...record.data, receiver_fee_percentage: '1.5' } })
  })
})
