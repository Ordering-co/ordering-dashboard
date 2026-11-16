import React, { useEffect, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { defaultTheme, renderWithProviders as renderWithDefaultTheme } from '~/__tests__/helpers/testUtils'

// (R9 leftovers of /591): the store-rules form and the level detail tell their parent when they hold
// unsaved values through an optional `onDirtyChange`, so the Settings hub can guard leaving the section (decision 17).
// The controllers are replaced by stand-ins that own `formState` the way the real ones do; the UI under test is the real one.
// `t` marks the strings it translates, so a label that bypasses it is visible.
vi.mock('../../../../../index', () => {
  const useFormState = (resetOn) => {
    const [formState, setFormState] = useState({ loading: false, error: null, changes: {} })
    useEffect(() => { setFormState(prev => ({ ...prev, changes: {} })) }, [resetOn])
    const handleChangeInput = event => setFormState(prev => ({
      ...prev,
      changes: { ...prev.changes, [event.target.name]: event.target.value }
    }))
    return { formState, setFormState, handleChangeInput }
  }
  return {
    useLanguage: () => [{}, (_key, fallback) => `${fallback} (t)`],
    useUtils: () => [{ parsePrice: value => `$${value}`, optimizeImage: value => value }],
    useConfig: () => [{ configs: {} }],
    DragAndDrop: ({ children }) => <div>{children}</div>,
    ExamineClick: ({ children }) => <div>{children}</div>,
    PointsWalletBusinessDetail: ({ UIComponent, ...props }) => {
      const state = useFormState(props.walletData)
      return (
        <UIComponent
          {...props}
          formState={state.formState}
          formStateConfigs={{ loading: false, changes: [], error: null }}
          setFormState={state.setFormState}
          handleChangeInput={state.handleChangeInput}
          handleChangeItem={changes => state.setFormState(prev => ({ ...prev, changes: { ...prev.changes, ...changes } }))}
          handleClickSubmit={() => state.setFormState(prev => ({ ...prev, changes: {} }))}
          saveChanges={() => {}}
        />
      )
    },
    LoyaltyLevelDetail: ({ UIComponent, ...props }) => {
      const state = useFormState(props.level)
      return (
        <UIComponent
          {...props}
          formState={state.formState}
          handleChangeInput={state.handleChangeInput}
          handleChangeItem={changes => state.setFormState(prev => ({ ...prev, changes: { ...prev.changes, ...changes } }))}
          handleDeleteLevel={() => {}}
          handlechangeImage={() => {}}
          addLevel={() => {}}
          updateLevel={() => state.setFormState(prev => ({ ...prev, changes: {} }))}
        />
      )
    },
    PointsWalletBusinessList: ({ UIComponent, ...props }) => (
      <UIComponent
        {...props}
        businessList={{
          loading: false,
          businesses: [{ id: 7, name: 'Store A', wallet_enabled: true, loyalty_plan_id: 1, redemption_rate: 100, accumulation_rate: 2 }]
        }}
        pointWallet={{ id: 1, type: 'credit_point' }}
        handleCheckBox={() => {}}
        handleUpdateBusinessList={() => {}}
        paginationProps={{ currentPage: 1, totalPages: 1, pageSize: 10 }}
        setPaginationProps={() => {}}
        searchValue=''
        handleChangeSearch={() => {}}
      />
    ),
    PointsWalletLevels: ({ UIComponent, ...props }) => (
      <UIComponent
        {...props}
        levelList={{ loading: false, levels: [{ id: 3, name: 'Level 1', accumulation_rate: 2, minimum_points: 10 }] }}
        handleAddLevelList={() => {}}
        handleUpdateLevelList={() => {}}
        handleDeleteLevelList={() => {}}
      />
    )
  }
})

vi.mock('../../Shared', () => ({
  Alert: () => null,
  Confirm: () => null,
  ImageCrop: () => null,
  Pagination: () => null,
  SearchBar: () => null,
  SideBar: ({ children }) => <div>{children}</div>,
  Modal: ({ children, open }) => (open ? <div>{children}</div> : null)
}))

vi.mock('../../Settings', () => ({
  SettingsSelectUI: () => <div data-testid='legacy-refund-select' />
}))

import { PointsWalletBusinessDetail } from '../PointsWalletBusinessDetail'
import { PointsWalletBusinessList } from '../PointsWalletBusinessList'
import { PointsWalletLevels } from '../PointsWalletLevels'
import { LoyaltyLevelDetail } from '../LoyaltyLevelDetail'

const lastCall = fn => fn.mock.calls.at(-1)

// The level screens read a few more brand colors than the shared test theme carries.
const theme = {
  ...defaultTheme,
  colors: { ...defaultTheme.colors, secundary: '#e9ecef', secundaryLight: '#f8f9fa', secundaryDarkContrast: '#333333' }
}
const renderWithProviders = (ui, options = {}) => renderWithDefaultTheme(ui, { theme, ...options })

describe('PointsWalletBusinessDetail', () => {
  const saved = { id: 1, loyalty_plan_id: 1, redemption_rate: 100, accumulation_rate: 2 }

  // Owner decision 26 B (2026-10-21, ): the four refund keys are edited only by their switch in the addon card of the hub
  // (sticky bar and guard), one home; the wallet card no longer repeats them as Yes/No selects with their own Save.
  it('does not repeat the refund switches as selects, for points or cash wallets (owner decision 26)', () => {
    for (const type of ['credit_point', 'cashback']) {
      const { unmount } = renderWithProviders(<PointsWalletBusinessDetail walletData={{ ...saved, type }} />)
      expect(screen.queryByTestId('legacy-refund-select')).not.toBeInTheDocument()
      unmount()
    }
  })

  it('translates the submit button', () => {
    const { unmount } = renderWithProviders(<PointsWalletBusinessDetail walletData={saved} isBusiness />)
    expect(screen.getByRole('button', { name: 'Save (t)' })).toBeInTheDocument()
    unmount()

    renderWithProviders(<PointsWalletBusinessDetail selectedBusinessList={[]} />)
    expect(screen.getByRole('button', { name: 'Add (t)' })).toBeInTheDocument()
  })

  it('reports dirty while a field differs from the saved store rules, clean when it goes back and on unmount', () => {
    const onDirtyChange = vi.fn()
    const { unmount } = renderWithProviders(
      <PointsWalletBusinessDetail walletData={saved} isBusiness onDirtyChange={onDirtyChange} />
    )
    expect(onDirtyChange).not.toHaveBeenCalledWith(true)

    const redemption = screen.getByDisplayValue('100')
    fireEvent.change(redemption, { target: { name: 'redemption_rate', value: '150' } })
    expect(lastCall(onDirtyChange)).toEqual([true])

    fireEvent.change(redemption, { target: { name: 'redemption_rate', value: '100' } })
    expect(lastCall(onDirtyChange)).toEqual([false])

    fireEvent.change(redemption, { target: { name: 'redemption_rate', value: '150' } })
    expect(lastCall(onDirtyChange)).toEqual([true])
    unmount()
    expect(lastCall(onDirtyChange)).toEqual([false])
  })

  it('is clean again once the changes are submitted', async () => {
    const onDirtyChange = vi.fn()
    renderWithProviders(<PointsWalletBusinessDetail walletData={saved} isBusiness onDirtyChange={onDirtyChange} />)
    fireEvent.change(screen.getByDisplayValue('100'), { target: { name: 'redemption_rate', value: '150' } })
    expect(lastCall(onDirtyChange)).toEqual([true])

    fireEvent.click(screen.getByRole('button', { name: 'Save (t)' }))
    await waitFor(() => expect(lastCall(onDirtyChange)).toEqual([false]))
  })

  it('works without the hub callback', () => {
    renderWithProviders(<PointsWalletBusinessDetail walletData={saved} isBusiness />)
    expect(() => fireEvent.change(screen.getByDisplayValue('100'), { target: { name: 'redemption_rate', value: '150' } })).not.toThrow()
  })
})

describe('PointsWalletBusinessList', () => {
  it('hands the dirty flag of the open store detail to its parent', () => {
    const onDirtyChange = vi.fn()
    renderWithProviders(
      <PointsWalletBusinessList handleParentSidebarMove={() => {}} onDirtyChange={onDirtyChange} />
    )
    fireEvent.click(screen.getByText('Store A'))
    fireEvent.change(screen.getByDisplayValue('100'), { target: { name: 'redemption_rate', value: '150' } })
    expect(lastCall(onDirtyChange)).toEqual([true])
  })

  it('opens the store detail without a parent callback', () => {
    renderWithProviders(<PointsWalletBusinessList handleParentSidebarMove={() => {}} />)
    fireEvent.click(screen.getByText('Store A'))
    expect(() => fireEvent.change(screen.getByDisplayValue('100'), { target: { name: 'redemption_rate', value: '150' } })).not.toThrow()
  })

  it('names the redeem column with its own key', () => {
    renderWithProviders(<PointsWalletBusinessList handleParentSidebarMove={() => {}} />)
    expect(screen.getByRole('columnheader', { name: 'Redeem (t)' })).toBeInTheDocument()
  })
})

describe('LoyaltyLevelDetail', () => {
  const level = { id: 3, name: 'Level 1', accumulation_rate: 2, minimum_points: 10 }

  it('translates the submit button', () => {
    const { unmount } = renderWithProviders(<LoyaltyLevelDetail level={level} />)
    expect(screen.getByRole('button', { name: 'Save (t)' })).toBeInTheDocument()
    unmount()

    renderWithProviders(<LoyaltyLevelDetail level={{}} />)
    expect(screen.getByRole('button', { name: 'Add (t)' })).toBeInTheDocument()
  })

  it('reports dirty while the open level differs from the saved one, clean when it goes back and on unmount', () => {
    const onDirtyChange = vi.fn()
    const { unmount } = renderWithProviders(<LoyaltyLevelDetail level={level} onDirtyChange={onDirtyChange} />)
    expect(onDirtyChange).not.toHaveBeenCalledWith(true)

    const name = screen.getByDisplayValue('Level 1')
    fireEvent.change(name, { target: { name: 'name', value: 'Gold' } })
    expect(lastCall(onDirtyChange)).toEqual([true])

    fireEvent.change(name, { target: { name: 'name', value: 'Level 1' } })
    expect(lastCall(onDirtyChange)).toEqual([false])

    fireEvent.change(name, { target: { name: 'name', value: 'Gold' } })
    expect(lastCall(onDirtyChange)).toEqual([true])
    unmount()
    expect(lastCall(onDirtyChange)).toEqual([false])
  })

  it('is clean again once the level is saved', async () => {
    const onDirtyChange = vi.fn()
    renderWithProviders(<LoyaltyLevelDetail level={level} onDirtyChange={onDirtyChange} />)
    fireEvent.change(screen.getByDisplayValue('Level 1'), { target: { name: 'name', value: 'Gold' } })
    expect(lastCall(onDirtyChange)).toEqual([true])

    fireEvent.click(screen.getByRole('button', { name: 'Save (t)' }))
    await waitFor(() => expect(lastCall(onDirtyChange)).toEqual([false]))
  })

  it('treats a new level with something typed as dirty', () => {
    const onDirtyChange = vi.fn()
    renderWithProviders(<LoyaltyLevelDetail level={{}} onDirtyChange={onDirtyChange} />)
    fireEvent.change(screen.getByPlaceholderText('name (t)'), { target: { name: 'name', value: 'Gold' } })
    expect(lastCall(onDirtyChange)).toEqual([true])
  })
})

describe('PointsWalletLevels', () => {
  it('hands the dirty flag of the open level to its parent', () => {
    const onDirtyChange = vi.fn()
    renderWithProviders(<PointsWalletLevels handleParentSidebarMove={() => {}} onDirtyChange={onDirtyChange} />)
    fireEvent.click(screen.getByText('Level 1'))
    fireEvent.change(screen.getAllByDisplayValue('Level 1')[0], { target: { name: 'name', value: 'Gold' } })
    expect(lastCall(onDirtyChange)).toEqual([true])
  })

  it('opens a level without a parent callback', () => {
    renderWithProviders(<PointsWalletLevels handleParentSidebarMove={() => {}} />)
    fireEvent.click(screen.getByText('Level 1'))
    expect(() => fireEvent.change(screen.getAllByDisplayValue('Level 1')[0], { target: { name: 'name', value: 'Gold' } })).not.toThrow()
  })
})
