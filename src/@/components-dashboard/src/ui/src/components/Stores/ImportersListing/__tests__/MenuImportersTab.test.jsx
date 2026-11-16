/* eslint-disable import/first */
// (main #488), ported to the redesign: the menu importers of the Stores / Products Importers panel always have an explicit
// target store. From Stores the store is picked first (every «Import Menu» is disabled until then); from Products it is the open one.
import React from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  menuDialog: null,
  gloriaDialog: null,
  emit: vi.fn(),
  api: { project: 'demo', root: 'https://api.example.com', businesses: () => ({ select: () => ({ get: () => Promise.resolve({ content: { error: true } }) }) }) }
}))

vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' }, dictionary: {} }, (_key, text) => text],
  useApi: () => [mocks.api],
  useEvent: () => [{ emit: mocks.emit }]
}))
vi.mock('~components', () => ({
  useLanguage: () => [{ language: { code: 'en' }, dictionary: {} }, (_key, text) => text],
  useApi: () => [mocks.api],
  useEvent: () => [{ emit: mocks.emit }]
}))
vi.mock('../../BusinessSelectHeader', () => ({
  BusinessSelectHeader: ({ changeBusinessState }) => (
    <button type='button' onClick={() => changeBusinessState({ id: 7, name: 'Downtown' })}>pick-downtown</button>
  )
}))
vi.mock('../../../Connect/Importers/MenuImportDialog', () => ({
  MenuImportDialog: (props) => {
    mocks.menuDialog = props
    return <div data-testid='menu-dialog-stub' data-card={props.card.id} data-business={props.business?.id} />
  }
}))
vi.mock('../../../Connect/Importers/GloriaFoodImportDialog', () => ({
  GloriaFoodImportDialog: (props) => {
    mocks.gloriaDialog = props
    return <div data-testid='gloria-dialog-stub' data-business={props.business?.id} />
  }
}))

import { MenuImportersTab } from '../MenuImportersTab'
import { IMPORTER_CARDS } from '../../../Connect/Importers/importerCards'

const importButtons = () => IMPORTER_CARDS.map(card => screen.getByTestId(`importer-import-${card.id}`))

beforeEach(() => {
  mocks.menuDialog = null
  mocks.gloriaDialog = null
  localStorage.clear()
})
afterEach(cleanup)

describe('MenuImportersTab', () => {
  it('from Stores: no store yet, so the hint shows and every «Import Menu» is disabled', () => {
    render(<MenuImportersTab />)
    expect(screen.getByTestId('menu-importers-store-hint')).toHaveTextContent('Select the store you want to import the menu into.')
    expect(screen.getByTestId('menu-importers-store-select')).toHaveTextContent('Select business')
    importButtons().forEach(button => expect(button).toBeDisabled())
  })

  it('from Stores: picking a store enables the rows and the import keeps that store', async () => {
    const user = userEvent.setup()
    render(<MenuImportersTab />)
    await user.click(screen.getByTestId('menu-importers-store-select'))
    await user.click(screen.getByRole('button', { name: 'pick-downtown' }))
    expect(screen.queryByTestId('menu-importers-store-hint')).toBeNull()
    expect(screen.getByTestId('menu-importers-store-select')).toHaveTextContent('Downtown')
    importButtons().forEach(button => expect(button).toBeEnabled())
    await user.click(screen.getByTestId('importer-import-doordash'))
    expect(screen.getByTestId('menu-dialog-stub')).toHaveAttribute('data-business', '7')
  })

  it('from Products: the open store is the target, by name, and GloriaFood opens its own dialog with it', async () => {
    const user = userEvent.setup()
    const onImportClose = vi.fn()
    render(<MenuImportersTab business={{ id: 3, name: 'Uptown' }} onImportClose={onImportClose} />)
    expect(within(screen.getByTestId('menu-importers-store')).getByTestId('menu-importers-store-name')).toHaveTextContent('Uptown')
    expect(screen.queryByTestId('menu-importers-store-select')).toBeNull()
    await user.click(screen.getByTestId('importer-import-gloriafood'))
    expect(screen.getByTestId('gloria-dialog-stub')).toHaveAttribute('data-business', '3')
    mocks.gloriaDialog.onClose()
    expect(onImportClose).toHaveBeenCalledTimes(1)
  })

  it('from Products while the store loads: no name yet and nothing can start', () => {
    render(<MenuImportersTab business={{ id: 3, name: 'Uptown' }} businessLoading />)
    expect(screen.getByTestId('menu-importers-store-name')).not.toHaveTextContent('Uptown')
    importButtons().forEach(button => expect(button).toBeDisabled())
  })
})
