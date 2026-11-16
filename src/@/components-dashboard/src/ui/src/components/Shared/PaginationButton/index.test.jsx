import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import styled, { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { PaginationButton } from '.'
import { PageButton, WrapperPageState, WrapperPagination } from './styles'
import {
  PageButton as SharedPageButton,
  WrapperPageState as SharedWrapperPageState,
  WrapperPagination as SharedWrapperPagination
} from '../UI/PaginationButton'

const renderPagination = (content, selectedTheme = createDashboardTheme(theme)) => render(
  <ThemeProvider theme={selectedTheme}>{content}</ThemeProvider>
)

describe('PaginationButton contracts', () => {
  it('keeps the literal range, zero-argument callbacks and implicit form submit buttons', () => {
    const prevPaginate = vi.fn()
    const nextPaginate = vi.fn()
    const submit = vi.fn(event => event.preventDefault())
    renderPagination(
      <form aria-label='Compact pagination form' onSubmit={submit}>
        <PaginationButton
          pageSize={10}
          total={23}
          currentPage={2}
          totalPages={3}
          prevPaginate={prevPaginate}
          nextPaginate={nextPaginate}
        />
      </form>
    )

    expect(screen.getByText('11-20 of 23')).toBeInTheDocument()
    const previous = screen.getByRole('button', { name: 'Previous page' })
    const next = screen.getByRole('button', { name: 'Next page' })
    expect(previous).not.toHaveAttribute('type')
    expect(next).not.toHaveAttribute('type')
    expect(previous.type).toBe('submit')
    expect(next.type).toBe('submit')
    fireEvent.click(previous)
    fireEvent.click(next)
    expect(prevPaginate).toHaveBeenCalledOnce()
    expect(prevPaginate).toHaveBeenCalledWith()
    expect(nextPaginate).toHaveBeenCalledOnce()
    expect(nextPaginate).toHaveBeenCalledWith()
    expect(submit).toHaveBeenCalledTimes(2)
  })

  it('keeps boundary buttons disabled without callbacks or form submission', () => {
    const prevPaginate = vi.fn()
    const nextPaginate = vi.fn()
    const submit = vi.fn(event => event.preventDefault())
    const rendered = renderPagination(
      <form onSubmit={submit}>
        <PaginationButton pageSize={10} total={7} currentPage={1} totalPages={1} prevPaginate={prevPaginate} nextPaginate={nextPaginate} />
      </form>
    )

    expect(screen.getByText('1-7 of 7')).toBeInTheDocument()
    const previous = screen.getByRole('button', { name: 'Previous page' })
    const next = screen.getByRole('button', { name: 'Next page' })
    expect(previous).toBeDisabled()
    expect(next).toBeDisabled()
    fireEvent.click(previous)
    fireEvent.click(next)
    expect(prevPaginate).not.toHaveBeenCalled()
    expect(nextPaginate).not.toHaveBeenCalled()
    expect(submit).not.toHaveBeenCalled()

    rendered.rerender(
      <ThemeProvider theme={createDashboardTheme(theme)}>
        <PaginationButton pageSize={10} total={25} currentPage={3} totalPages={3} prevPaginate={prevPaginate} nextPaginate={nextPaginate} />
      </ThemeProvider>
    )
    expect(screen.getByText('21-25 of 25')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  it('uses the reviewed Lucide arrows and exact styled piece identities', () => {
    expect(PageButton).toBe(SharedPageButton)
    expect(WrapperPageState).toBe(SharedWrapperPageState)
    expect(WrapperPagination).toBe(SharedWrapperPagination)
    for (const Component of [PageButton, WrapperPageState, WrapperPagination]) {
      expect(typeof Component.styledComponentId).toBe('string')
    }

    const attrsTheme = { ...createDashboardTheme(theme, { mode: 'dark' }), rtl: true }
    const ExtendedPageButton = styled(PageButton).attrs({ theme: attrsTheme, title: 'Extended compact page' })`
      margin-left: 11px;
    `
    renderPagination(<ExtendedPageButton aria-label='Extended compact'><span>Arrow</span></ExtendedPageButton>)
    const extended = screen.getByRole('button', { name: 'Extended compact' })
    expect(extended).not.toHaveAttribute('type')
    expect(extended).toHaveAttribute('title', 'Extended compact page')
    expect(extended).toHaveStyle({ marginLeft: '11px' })
    expect(getComputedStyle(extended).getPropertyValue('--od-compact-pagination-surface')).toBe('#17181A')

    const rendered = renderPagination(
      <PaginationButton pageSize={10} total={20} currentPage={1} totalPages={2} prevPaginate={vi.fn()} nextPaginate={vi.fn()} />
    )
    const icons = rendered.container.querySelectorAll('svg')
    expect(icons).toHaveLength(2)
    icons.forEach(icon => {
      expect(icon).toHaveAttribute('aria-hidden', 'true')
      expect(icon).toHaveAttribute('stroke-width', '1.75')
      expect(icon).toHaveAttribute('width', '16px')
      expect(icon).toHaveAttribute('height', '16px')
    })
  })

  it('preserves compact PageButton refs and distinct as and forwardedAs behavior', () => {
    const asRef = React.createRef()
    const forwardedRef = React.createRef()
    renderPagination(
      <>
        <PageButton ref={asRef} as='a' href='#compact' aria-label='Compact as anchor'>Anchor</PageButton>
        <PageButton ref={forwardedRef} forwardedAs='a' aria-label='Compact forwarded'>Forwarded</PageButton>
      </>
    )

    const anchor = screen.getByRole('link', { name: 'Compact as anchor' })
    const forwarded = screen.getByRole('button', { name: 'Compact forwarded' })
    expect(anchor.tagName).toBe('A')
    expect(anchor).toHaveAttribute('href', '#compact')
    expect(anchor).not.toHaveAttribute('type')
    expect(asRef.current).toBe(anchor)
    expect(forwarded.tagName).toBe('BUTTON')
    expect(forwarded).toHaveAttribute('as', 'a')
    expect(forwarded).not.toHaveAttribute('type')
    expect(forwarded.type).toBe('submit')
    expect(forwardedRef.current).toBe(forwarded)
  })
})
