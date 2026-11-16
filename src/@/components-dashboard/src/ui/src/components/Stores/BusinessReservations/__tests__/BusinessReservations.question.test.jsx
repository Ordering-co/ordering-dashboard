/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// tanda P: the code added a literal «?» after the key, and es, de, it, nl and tr already carry it in the catalog:
// «Bieten Sie eine Tischreservierung an??». The catalog now carries it in every language, but the live dictionary of a project
// only has it after i18n:sync:live, so the code adds it only when the text does not end in a question mark already.
const mocks = vi.hoisted(() => ({ dictionary: {} }))
vi.mock('~components', () => ({
  useLanguage: () => [{}, (key, fallback) => mocks.dictionary[key] ?? fallback]
}))

import { BusinessReservations } from '../index'

const business = {
  id: 7,
  configs: [
    { id: 11, key: 'reservation_enabled', value: '1' },
    { id: 12, key: 'reservation_setting', value: '' }
  ]
}

const renderReservations = () => render(
  <BusinessReservations business={business} businessId={7} handleUpdateBusinessConfigs={vi.fn()} actionStatus={{ loading: false }} />
)

describe('BusinessReservations · the master question', () => {
  it('shows one question mark when the translation carries it', () => {
    mocks.dictionary = { DO_YOU_OFFER_TABLE_RESERVATION: 'Bieten Sie eine Tischreservierung an?' }
    renderReservations()
    expect(screen.getByRole('switch', { name: 'Bieten Sie eine Tischreservierung an?' })).toBeInTheDocument()
  })

  it('adds the question mark to a live text that has none yet (en, fr, pt… before the catalog sync), and not to ؟ or ;', () => {
    mocks.dictionary = { DO_YOU_OFFER_TABLE_RESERVATION: 'Do you offer table reservation' }
    const { unmount } = renderReservations()
    expect(screen.getByRole('switch', { name: 'Do you offer table reservation?' })).toBeInTheDocument()
    unmount()
    mocks.dictionary = { DO_YOU_OFFER_TABLE_RESERVATION: 'هل تقدمون حجز الطاولات؟' }
    const ar = renderReservations()
    expect(screen.getByRole('switch', { name: 'هل تقدمون حجز الطاولات؟' })).toBeInTheDocument()
    ar.unmount()
    mocks.dictionary = { DO_YOU_OFFER_TABLE_RESERVATION: 'Προσφέρετε κράτηση τραπεζιού;' }
    renderReservations()
    expect(screen.getByRole('switch', { name: 'Προσφέρετε κράτηση τραπεζιού;' })).toBeInTheDocument()
  })

  it('the English default carries its own question mark', () => {
    mocks.dictionary = {}
    renderReservations()
    expect(screen.getByRole('switch', { name: 'Do you offer table reservation?' })).toBeInTheDocument()
  })
})
