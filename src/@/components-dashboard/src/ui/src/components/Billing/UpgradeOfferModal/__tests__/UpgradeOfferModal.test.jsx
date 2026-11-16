/* eslint-disable import/first */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  offer: null,
  projectCode: 'acme',
  trialModalOpen: false
}))

vi.mock('../../../../contexts/ProjectContext', () => ({
  useProjectState: () => [{ project: { code: mocks.projectCode } }]
}))
vi.mock('../../../../contexts/TrialExtensionContext', () => ({
  useTrialExtension: () => ({ isModalOpen: mocks.trialModalOpen })
}))
// The modal's open flag now lives in UpgradeOfferContext (shared with the sidebar card); a real
// useState here reproduces that reactivity without rendering the actual provider/fetch.
vi.mock('../../../../contexts/UpgradeOfferContext', () => ({
  useUpgradeOffer: () => {
    const [isModalOpen, setIsModalOpen] = React.useState(false)
    return {
      offer: mocks.offer,
      isModalOpen,
      openModal: () => setIsModalOpen(true),
      closeModal: () => setIsModalOpen(false)
    }
  }
}))

import { UpgradeOfferModal } from '..'

const localDateString = (daysAgo = 0) => {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const OFFER_EN = {
  id: 812,
  language: 'en',
  project: { name: 'Pizza Roma' },
  current_plan: { name: 'Legacy One Time Payment Platform - Limited Plan - No Updates - No Support (Hosting Yearly Fee)' },
  save: 50,
  featured: {
    name: 'Marketplace Platform. All Inclusive (5,000 orders) + AI Suite',
    default: true,
    save: 50,
    periods: {
      annual: { price: '$2,499', save: 50, reference: '$5,000', saving: '$2,501', per_month: '$208' },
      monthly: { price: '$399', save: 20, reference: '$500', saving: '$101', per_month: null }
    }
  },
  others: [{
    name: 'Marketplace Platform. All Inclusive (5,000 orders) + AI Suite',
    default: false,
    save: 0,
    periods: {
      annual: { price: '$5,000', save: 0, reference: null, saving: null, per_month: '$417' },
      monthly: { price: '$500', save: 0, reference: null, saving: null, per_month: null }
    }
  }],
  due_at: '2026-12-14T00:00:00+00:00',
  due_at_label: 'December 14, 2026',
  link: 'https://accounts.ordering.co/upgrade/abc'
}

const seenKey = (projectCode, offerId) => `upgrade_offer_seen:${projectCode}:${offerId}`

afterEach(() => {
  window.localStorage.clear()
  document.getElementById('app-modals')?.remove()
  mocks.offer = null
  mocks.projectCode = 'acme'
  mocks.trialModalOpen = false
})

describe('UpgradeOfferModal', () => {
  it('shows nothing when there is no offer (result: null, an error, or a malformed payload)', () => {
    mocks.offer = null
    render(<UpgradeOfferModal />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens with the offer the first time it is seen', async () => {
    mocks.offer = OFFER_EN
    render(<UpgradeOfferModal />)
    expect(await screen.findByRole('dialog', { name: 'Upgrade Pizza Roma and save up to 50%' })).toBeInTheDocument()
  })

  it('marks the offer as seen today once shown, and does not reopen on a second mount today', async () => {
    mocks.offer = OFFER_EN
    const { unmount } = render(<UpgradeOfferModal />)
    await screen.findByRole('dialog')
    expect(window.localStorage.getItem(seenKey('acme', 812))).toBe(localDateString())
    unmount()

    render(<UpgradeOfferModal />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not show it again if it was already seen today', () => {
    window.localStorage.setItem(seenKey('acme', 812), localDateString())
    mocks.offer = OFFER_EN
    render(<UpgradeOfferModal />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows it again (and re-marks it) if it was last seen yesterday', async () => {
    window.localStorage.setItem(seenKey('acme', 812), localDateString(1))
    mocks.offer = OFFER_EN
    render(<UpgradeOfferModal />)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(window.localStorage.getItem(seenKey('acme', 812))).toBe(localDateString())
  })

  it('waits for the trial extension modal instead of opening alongside it', async () => {
    mocks.offer = OFFER_EN
    mocks.trialModalOpen = true
    render(<UpgradeOfferModal />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(window.localStorage.getItem(seenKey('acme', 812))).toBeNull()
  })

  it('renders the Spanish copy when the offer language is "es"', async () => {
    mocks.offer = { ...OFFER_EN, language: 'es' }
    render(<UpgradeOfferModal />)
    expect(await screen.findByRole('dialog', { name: 'Actualiza Pizza Roma y ahorra hasta un 50%' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
    expect(screen.getByText('Ahora no')).toBeInTheDocument()
    expect(screen.getByText('Actualizar con 50% de descuento')).toBeInTheDocument()
  })

  it('shows "Recommended" with no strikethrough price when save is 0', async () => {
    mocks.offer = {
      ...OFFER_EN,
      save: 0,
      featured: {
        ...OFFER_EN.featured,
        save: 0,
        periods: {
          annual: { price: '$5,000', save: 0, reference: null, saving: null, per_month: '$417' },
          monthly: { price: '$500', save: 0, reference: null, saving: null, per_month: null }
        }
      },
      others: []
    }
    render(<UpgradeOfferModal />)
    const dialog = await screen.findByRole('dialog', { name: 'Your upgrade options for Pizza Roma' })
    expect(screen.getByText('Recommended')).toBeInTheDocument()
    expect(dialog.querySelector('.odc-upgrade-offer-strike')).toBeNull()
    expect(screen.getByText('Upgrade my plan')).toBeInTheDocument()
  })

  it('"Not now" closes the modal', async () => {
    mocks.offer = OFFER_EN
    render(<UpgradeOfferModal />)
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByText('Not now'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('the upgrade button is a link to the offer, in a new tab, and closes the modal', async () => {
    mocks.offer = OFFER_EN
    render(<UpgradeOfferModal />)
    await screen.findByRole('dialog')
    const link = screen.getByRole('link', { name: 'Upgrade with 50% off' })
    expect(link).toHaveAttribute('href', 'https://accounts.ordering.co/upgrade/abc')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    fireEvent.click(link)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the comparison table of other plans', async () => {
    mocks.offer = OFFER_EN
    render(<UpgradeOfferModal />)
    await screen.findByRole('dialog')
    expect(screen.getByText('$5,000 / year')).toBeInTheDocument()
    expect(screen.getByText('$500 / month')).toBeInTheDocument()
  })

  it('skips the comparison table when there are no other plans', async () => {
    mocks.offer = { ...OFFER_EN, id: 813, others: [] }
    const { container } = render(<UpgradeOfferModal />)
    await screen.findByRole('dialog')
    expect(container.querySelector('.odc-upgrade-offer-table')).toBeNull()
  })
})
