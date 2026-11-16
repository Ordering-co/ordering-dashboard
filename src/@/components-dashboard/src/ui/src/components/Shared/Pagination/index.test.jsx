/* eslint-disable import/first */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import styled, { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

vi.mock('../../../styles/Select', () => ({
  Select: ({ options, defaultValue, onChange }) => (
    <select aria-label='Page size' defaultValue={defaultValue} onChange={event => onChange(Number(event.target.value))}>
      {options.map(option => <option key={option.value} value={option.value}>{option.value}</option>)}
    </select>
  )
}))

import { Pagination } from '.'
import {
  Option,
  PageButton,
  PageGap,
  PageSizeContainer,
  PageSizeTitle,
  PaginationButtonContainer,
  PaginationContainer
} from './styles'
import * as SharedPaginationStyles from '../UI/pagination-styles'

const renderPagination = props => render(
  <ThemeProvider theme={createDashboardTheme(theme)}>
    <Pagination {...props} />
  </ThemeProvider>
)

describe('Pagination contracts', () => {
  it('uses native controls while preserving range callbacks and boundaries', async () => {
    const handleChangePage = vi.fn()
    const submit = vi.fn(event => event.preventDefault())
    render(
      <ThemeProvider theme={createDashboardTheme(theme)}>
        <form aria-label='Pagination form' onSubmit={submit}>
          <Pagination currentPage={1} totalPages={8} isHidePagecontrol handleChangePage={handleChangePage} />
        </form>
      </ThemeProvider>
    )

    const previous = screen.getByRole('button', { name: 'Previous page' })
    expect(previous).toBeDisabled()
    screen.getAllByRole('button').forEach(button => expect(button).toHaveAttribute('type', 'button'))
    expect(await screen.findByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page')
    fireEvent.click(screen.getByRole('button', { name: 'Page 1' }))
    expect(handleChangePage).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }))
    expect(handleChangePage).toHaveBeenCalledWith(2)
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page')
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(handleChangePage).toHaveBeenLastCalledWith(3)
    expect(submit).not.toHaveBeenCalled()
  })

  it('keeps page-size fallback and scalar numeric callback', () => {
    const handleChangePageSize = vi.fn()
    renderPagination({
      currentPage: 1,
      totalPages: 3,
      paginationSize: 25,
      handleChangePage: vi.fn(),
      handleChangePageSize
    })

    const pageSize = screen.getByRole('combobox', { name: 'Page size' })
    expect(pageSize).toHaveValue('25')
    fireEvent.change(pageSize, { target: { value: '50' } })
    expect(handleChangePageSize).toHaveBeenCalledWith(50)
  })

  it('keeps long ranges, both gaps and controlled page updates', async () => {
    const handleChangePage = vi.fn()
    const rendered = renderPagination({ currentPage: 6, totalPages: 10, isHidePagecontrol: true, handleChangePage })
    expect(await screen.findAllByText('...')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Page 6' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Page 10' })).toBeInTheDocument()

    rendered.rerender(
      <ThemeProvider theme={createDashboardTheme(theme)}>
        <Pagination currentPage={9} totalPages={10} isHidePagecontrol handleChangePage={handleChangePage} />
      </ThemeProvider>
    )
    expect(screen.getByRole('button', { name: 'Page 9' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Page 7' })).toBeInTheDocument()
    expect(handleChangePage).not.toHaveBeenCalled()
  })

  it('reexports the actual styled pieces and keeps extensions and final attrs live', () => {
    const components = {
      Option,
      PageButton,
      PageGap,
      PageSizeContainer,
      PageSizeTitle,
      PaginationButtonContainer,
      PaginationContainer
    }
    for (const [name, Component] of Object.entries(components)) {
      expect(Component).toBe(SharedPaginationStyles[name])
      expect(typeof Component.styledComponentId).toBe('string')
    }

    const attrsTheme = { ...createDashboardTheme(theme, { mode: 'dark' }), rtl: true }
    const ExtendedButton = styled(PageButton).attrs({ active: true, theme: attrsTheme, title: 'Extended page' })`
      margin-left: 9px;
    `
    render(
      <ThemeProvider theme={createDashboardTheme(theme)}>
        <ExtendedButton aria-label='Extended'>4</ExtendedButton>
      </ThemeProvider>
    )
    const button = screen.getByRole('button', { name: 'Extended' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveAttribute('title', 'Extended page')
    expect(button).toHaveStyle({ marginLeft: '9px' })
    expect(getComputedStyle(button).getPropertyValue('--od-pagination-page-background')).toBe('var(--od-pagination-action)')
    expect(getComputedStyle(button).getPropertyValue('--od-pagination-border-strong')).toBe('#5B5E64')
  })

  it('preserves native PageButton refs and distinct as and forwardedAs behavior', () => {
    const asRef = React.createRef()
    const forwardedRef = React.createRef()
    render(
      <ThemeProvider theme={createDashboardTheme(theme)}>
        <>
          <PageButton ref={asRef} as='a' href='#page' aria-label='Page as anchor'>Anchor</PageButton>
          <PageButton ref={forwardedRef} forwardedAs='a' aria-label='Page forwarded'>Forwarded</PageButton>
        </>
      </ThemeProvider>
    )

    const anchor = screen.getByRole('link', { name: 'Page as anchor' })
    const forwarded = screen.getByRole('button', { name: 'Page forwarded' })
    expect(anchor.tagName).toBe('A')
    expect(anchor).toHaveAttribute('href', '#page')
    expect(anchor).toHaveAttribute('type', 'button')
    expect(asRef.current).toBe(anchor)
    expect(forwarded.tagName).toBe('BUTTON')
    expect(forwarded).toHaveAttribute('as', 'a')
    expect(forwarded).toHaveAttribute('type', 'button')
    expect(forwardedRef.current).toBe(forwarded)
  })
})
