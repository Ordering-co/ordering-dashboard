/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const state = vi.hoisted(() => ({ level: 0, emit: null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: { level: state.level } }],
  useEvent: () => [{ emit: state.emit }]
}))

import { ProductStartGuide } from '../index'

const business = { id: 3202, name: 'QA Store' }

const renderGuide = () => {
  const onClose = vi.fn()
  const onImportMenu = vi.fn()
  renderWithProviders(
    <ProductStartGuide business={business} onClose={onClose} onImportMenu={onImportMenu} />
  )
  return { onClose, onImportMenu }
}

describe('ProductStartGuide', () => {
  beforeEach(() => {
    state.level = 0
    state.emit = vi.fn()
  })

  it('offers empty menu, import and POS to an admin', () => {
    renderGuide()
    expect(screen.getByTestId('product-start-guide-empty')).toBeInTheDocument()
    expect(screen.getByTestId('product-start-guide-import')).toBeInTheDocument()
    expect(screen.getByTestId('product-start-guide-pos')).toBeInTheDocument()
    expect(screen.queryByText('Import Menu (Only if USA and Canada)')).not.toBeInTheDocument()
  })

  it('hides the importer from a business owner, who cannot sync menus in api-core', () => {
    state.level = 2
    renderGuide()
    expect(screen.queryByTestId('product-start-guide-import')).not.toBeInTheDocument()
    expect(screen.getByTestId('product-start-guide-pos')).toBeInTheDocument()
  })

  it('opens the importers for the store', () => {
    const { onImportMenu } = renderGuide()
    fireEvent.click(screen.getByTestId('product-start-guide-import'))
    expect(onImportMenu).toHaveBeenCalledTimes(1)
  })

  it('takes the store to POS & Menu Sync', () => {
    const { onClose } = renderGuide()
    fireEvent.click(screen.getByTestId('product-start-guide-pos'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(state.emit).toHaveBeenCalledWith('go_to_page', { page: 'pos_menu', search: '?id=3202' })
  })

  it('closes the guide to start with an empty menu', () => {
    const { onClose, onImportMenu } = renderGuide()
    fireEvent.click(screen.getByTestId('product-start-guide-empty'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onImportMenu).not.toHaveBeenCalled()
  })
})
