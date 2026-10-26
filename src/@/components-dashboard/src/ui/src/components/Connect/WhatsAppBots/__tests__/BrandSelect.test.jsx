import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { BrandSelect } from '../BrandSelect'

const brands = [
  { id: 1, name: 'Alpha', enabled: true },
  { id: 2, name: 'Closed', enabled: false }
]

describe('Brand select', () => {
  it('loads the next page when the list reaches the end', () => {
    const onLoadMore = vi.fn()
    const onChange = vi.fn()
    renderWithProviders(
      <BrandSelect
        aria-label='Brand'
        value='1'
        brands={brands}
        hasNextPage
        onLoadMore={onLoadMore}
        onChange={onChange}
        disabledLabel='Disabled'
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Brand' }))
    fireEvent.click(screen.getByRole('option', { name: 'Closed (Disabled)' }))
    expect(onChange).not.toHaveBeenCalled()

    const list = screen.getByRole('listbox')
    Object.defineProperty(list, 'scrollHeight', { value: 400, configurable: true })
    Object.defineProperty(list, 'clientHeight', { value: 192, configurable: true })
    Object.defineProperty(list, 'scrollTop', { value: 180, configurable: true })
    fireEvent.scroll(list)

    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })
})
