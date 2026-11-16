/* eslint-disable import/first */
// J2 row 18 (stores-5-15a-channels-qr O1): the printed page of a QR code says which store and which table or spot it is for, so
// several printed codes can be told apart. The page is still only what `printRef` holds: the code and, under it, those names.
import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, text) => text],
  useSite: () => [{ loading: false }]
}))
vi.mock('../../../../hooks/useWebsiteUrl', () => ({ useStoreWebsiteUrl: () => 'https://shop.example.com/store/alpha' }))
vi.mock('../../../../contexts/ProjectContext', () => ({ useProjectState: () => [{ loading: false, websiteProduct: true }] }))
vi.mock('react-qr-code', () => ({ default: ({ value }) => <svg data-testid='qr' data-value={value} /> }))
// react-to-print renders the trigger; what it prints is `content()`, the node of `printRef`
const printed = vi.hoisted(() => ({ content: null }))
vi.mock('react-to-print', () => ({
  default: ({ trigger, content }) => {
    printed.content = content
    return trigger()
  }
}))

import { BusinessQRCodeOption } from '../index'

const EAT_IN = { key: 'eat_in', value: 3, title: 'Eat in' }
const CURBSIDE = { key: 'curbside', value: 5, title: 'Curbside' }
const DELIVERY = { key: 'delivery', value: 1, title: 'Delivery' }
const STORE = { id: 7, name: 'Alpha Pizza', slug: 'alpha' }

const generate = (number) => {
  if (number != null) fireEvent.change(screen.getByLabelText(/number/i), { target: { value: number } })
  fireEvent.click(screen.getByRole('button', { name: 'Generate Code' }))
}
const page = () => printed.content()

describe('BusinessQRCodeOption · the printed page', () => {
  it('Eat in: the code, the name of the store and «Table 12» under it', () => {
    render(<BusinessQRCodeOption item={EAT_IN} business={STORE} />)
    generate('12')
    const sheet = page()
    expect(within(sheet).getByTestId('qr')).toBeInTheDocument()
    expect(sheet).toHaveTextContent('Alpha Pizza')
    expect(sheet).toHaveTextContent('Table 12')
  })

  it('Curbside and the others with a number say «Spot 4»', () => {
    render(<BusinessQRCodeOption item={CURBSIDE} business={STORE} />)
    generate('4')
    expect(page()).toHaveTextContent('Spot 4')
    expect(page()).toHaveTextContent('Alpha Pizza')
  })

  it('says the number the code was made with, not one typed after it', () => {
    render(<BusinessQRCodeOption item={EAT_IN} business={STORE} />)
    generate('12')
    fireEvent.change(screen.getByLabelText(/number/i), { target: { value: '13' } })
    expect(page()).toHaveTextContent('Table 12')
    expect(page()).not.toHaveTextContent('Table 13')
  })

  it('Delivery (no number): the store and the order type', () => {
    render(<BusinessQRCodeOption item={DELIVERY} business={STORE} />)
    generate()
    expect(page()).toHaveTextContent('Alpha Pizza')
    expect(page()).toHaveTextContent('Delivery')
  })
})
