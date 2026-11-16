/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// bugs E D17a: the duration options said `{('HOUR', 'hour')}`, a comma expression that never called t()
vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (key) => `T(${key})`],
  useConfig: () => [{ configs: { appointments: { value: true } } }],
  DragAndDrop: ({ children }) => <div>{children}</div>,
  ExamineClick: ({ children }) => <div>{children}</div>,
  BusinessProductCreator: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
vi.mock('../../../Shared', () => ({
  Alert: () => null,
  ImageCrop: () => null,
  Modal: () => null
}))
vi.mock('../../../../styles/Select/FirstSelect', () => ({
  Select: ({ options }) => (
    <ul>{options.map(option => <li key={option.value}>{option.content}</li>)}</ul>
  )
}))

import { BusinessProductAddFormUI } from '../index'

describe('BusinessProductAddForm duration options (D17a)', () => {
  it('translates the hour and custom options through t()', () => {
    renderWithProviders(
      <BusinessProductAddFormUI
        formState={{ loading: false, changes: { enabled: true, type: 'service' }, result: { error: false } }}
        business={{ id: 1 }}
        handleChangeInput={() => {}}
        handleChangeItem={() => {}}
        handleUpdateClick={() => {}}
        handlechangeImage={() => {}}
      />
    )
    expect(screen.getByText('T(HOUR)')).toBeInTheDocument()
    expect(screen.getByText('T(CUSTOM)')).toBeInTheDocument()
    expect(screen.queryByText('hour')).not.toBeInTheDocument()
    expect(screen.queryByText('custom')).not.toBeInTheDocument()
  })
})
