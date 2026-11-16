/* eslint-disable import/first */
// redesign stores 5.2 (decision D8): the two tabs of a product category on P/Tabs. Covered: the two tabs by name, the
// selected one is marked, and activating the other tells the consumer by key.
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockModule = vi.hoisted(() => () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', mockModule)
// `~components` and the relative index are the same module: both mocks must say the same
vi.mock('~components', mockModule)

import { BusinessCategoryInfoSettingList } from '../index'

describe('BusinessCategoryInfoSettingList', () => {
  it('shows the Information and SEO Options tabs in a tablist named «Category sections», the selected one marked', () => {
    render(<BusinessCategoryInfoSettingList selectedInfoItem='information' handleSelectInfoItem={() => {}} />)
    expect(screen.getByRole('tablist', { name: 'Category sections' })).toBeTruthy()
    expect(screen.getAllByRole('tab')).toHaveLength(2)
    expect(screen.getByRole('tab', { name: 'Information' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'SEO Options' }).getAttribute('aria-selected')).toBe('false')
  })

  it('marks the other tab when the consumer selects it', () => {
    render(<BusinessCategoryInfoSettingList selectedInfoItem='seo_options' handleSelectInfoItem={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Information' }).getAttribute('aria-selected')).toBe('false')
    expect(screen.getByRole('tab', { name: 'SEO Options' }).getAttribute('aria-selected')).toBe('true')
  })

  it('activating the other tab calls handleSelectInfoItem with its key', async () => {
    const user = userEvent.setup()
    const select = vi.fn()
    render(<BusinessCategoryInfoSettingList selectedInfoItem='information' handleSelectInfoItem={select} />)
    await user.click(screen.getByRole('tab', { name: 'SEO Options' }))
    expect(select).toHaveBeenCalledTimes(1)
    expect(select).toHaveBeenCalledWith('seo_options')
  })

  it('activating the selected tab again does not call it', async () => {
    const user = userEvent.setup()
    const select = vi.fn()
    render(<BusinessCategoryInfoSettingList selectedInfoItem='information' handleSelectInfoItem={select} />)
    await user.click(screen.getByRole('tab', { name: 'Information' }))
    expect(select).not.toHaveBeenCalled()
  })
})
