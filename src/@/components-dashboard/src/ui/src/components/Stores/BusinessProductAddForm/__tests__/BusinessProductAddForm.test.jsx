/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../Shared', () => ({ Alert: () => null, ImageCrop: () => null, Modal: () => null }))

vi.mock('../../../../styles', () => ({
  Button: ({ children }) => <button>{children}</button>,
  Input: () => <input />,
  TextArea: () => <textarea />
}))

vi.mock('../../../../styles/Select/FirstSelect', () => ({ Select: () => <div data-testid='select' /> }))
vi.mock('../../../../styles/MultiSelect', () => ({ MultiSelect: () => null }))
vi.mock('../../../../styles/StandardField', () => ({ StandardField: () => null }))
vi.mock('../../../../hooks/useDraftImageRead', () => ({ useDraftImageRead: () => ({ reading: false }) }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useConfig: () => [{ configs: {} }],
  DragAndDrop: ({ children }) => <div>{children}</div>,
  ExamineClick: ({ children }) => <div>{children}</div>,
  BusinessProductCreator: () => null
}))

import { BusinessProductAddFormUI } from '..'

const baseProps = {
  formState: { loading: false, changes: {} },
  handleChangeInput: vi.fn(),
  handleUpdateClick: vi.fn(),
  handlechangeImage: vi.fn(),
  handleChangeItem: vi.fn(),
  business: {}
}

describe('BusinessProductAddFormUI', () => {
  it('offers the product type on a project without any appointments config', () => {
    renderWithProviders(<BusinessProductAddFormUI {...baseProps} />)

    expect(screen.getByText('Type')).toBeInTheDocument()
  })

  it('keeps the product type out of store onboarding', () => {
    renderWithProviders(<BusinessProductAddFormUI {...baseProps} onboardingMode />)

    expect(screen.queryByText('Type')).not.toBeInTheDocument()
  })
})
