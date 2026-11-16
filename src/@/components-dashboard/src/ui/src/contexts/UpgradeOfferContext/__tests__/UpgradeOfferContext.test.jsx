/* eslint-disable import/first */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { mockFetch, mockFetchError } from '../../../../../../../../__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({
  token: 'a-token',
  root: 'https://api.example.com'
}))

vi.mock('../../../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: mocks.root }]
}))
vi.mock('../../../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: mocks.token }]
}))

import { UpgradeOfferProvider, useUpgradeOffer } from '..'

const Probe = () => {
  const { offer, isModalOpen, openModal, closeModal } = useUpgradeOffer()
  return (
    <div>
      <pre data-testid='offer'>{JSON.stringify(offer)}</pre>
      <span data-testid='isModalOpen'>{String(isModalOpen)}</span>
      <button onClick={openModal}>open</button>
      <button onClick={closeModal}>close</button>
    </div>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('UpgradeOfferProvider', () => {
  it('fetches the offer once and shares it with every consumer', async () => {
    mockFetch({ error: false, result: { id: 812, language: 'en' } })
    render(
      <UpgradeOfferProvider>
        <Probe />
        <Probe />
      </UpgradeOfferProvider>
    )
    await waitFor(() => {
      expect(JSON.parse(screen.getAllByTestId('offer')[0].textContent)).toEqual({ id: 812, language: 'en' })
    })
    expect(JSON.parse(screen.getAllByTestId('offer')[1].textContent)).toEqual({ id: 812, language: 'en' })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('offer is null on a network error', async () => {
    mockFetchError('network down')
    render(
      <UpgradeOfferProvider>
        <Probe />
      </UpgradeOfferProvider>
    )
    await waitFor(() => {
      expect(screen.getByTestId('offer').textContent).toBe('null')
    })
  })

  it('offer is null on error:true', async () => {
    mockFetch({ error: true, result: 'not allowed' })
    render(
      <UpgradeOfferProvider>
        <Probe />
      </UpgradeOfferProvider>
    )
    await waitFor(() => {
      expect(screen.getByTestId('offer').textContent).toBe('null')
    })
  })

  it('openModal/closeModal toggle isModalOpen for every consumer', async () => {
    mockFetch({ error: false, result: null })
    render(
      <UpgradeOfferProvider>
        <Probe />
      </UpgradeOfferProvider>
    )
    expect(screen.getByTestId('isModalOpen').textContent).toBe('false')
    fireEvent.click(screen.getByText('open'))
    expect(screen.getByTestId('isModalOpen').textContent).toBe('true')
    fireEvent.click(screen.getByText('close'))
    expect(screen.getByTestId('isModalOpen').textContent).toBe('false')
  })

  it('useUpgradeOffer outside the provider returns the inert default (no throw)', () => {
    render(<Probe />)
    expect(screen.getByTestId('offer').textContent).toBe('null')
    expect(screen.getByTestId('isModalOpen').textContent).toBe('false')
  })
})
