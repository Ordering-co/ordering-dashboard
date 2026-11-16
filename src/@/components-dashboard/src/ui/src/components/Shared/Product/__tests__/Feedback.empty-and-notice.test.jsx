// two opt-in props of the feedback pieces. EmptyState `titleAs` (SC-5 of ): a page whose only content is an
// EmptyState has a heading. InlineNotice `live` (N-FD3 of ): a static note is a note, not a live region.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EmptyState } from '../Feedback'
import { InlineNotice } from '../FilterBar'

describe('EmptyState · titleAs (SC-5)', () => {
  it('draws the title as a <p>, as always, by default', () => {
    render(<EmptyState title='No schools yet' description='Add one.' />)
    expect(screen.queryByRole('heading')).toBeNull()
    const title = screen.getByText('No schools yet')
    expect(title.tagName).toBe('P')
    expect(title).toHaveClass('odc-state-title')
  })

  it('draws it as the heading asked for, with the same class (so the same look)', () => {
    render(<EmptyState title='No schools yet' titleAs='h2' />)
    const heading = screen.getByRole('heading', { level: 2, name: 'No schools yet' })
    expect(heading).toHaveClass('odc-state-title')
  })

  it('takes any level from h1 to h6', () => {
    const { rerender } = render(<EmptyState title='Nothing' titleAs='h1' />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    rerender(<EmptyState title='Nothing' titleAs='h6' />)
    expect(screen.getByRole('heading', { level: 6 })).toBeInTheDocument()
  })

  it('falls back to <p> for a tag that is not a heading (never an arbitrary element)', () => {
    render(<EmptyState title='Nothing' titleAs='script' />)
    expect(screen.getByText('Nothing').tagName).toBe('P')
  })

  it('keeps the alert of the error tone with a heading title', () => {
    render(<EmptyState tone='error' title='We could not load it' titleAs='h2' />)
    expect(screen.getByRole('alert')).toContainElement(screen.getByRole('heading', { level: 2 }))
  })
})

// SC-6 (of ): a page whose only content is an EmptyState (the 404) needs a page-sized title, not a 14px line.
describe('EmptyState · size (SC-6)', () => {
  const css = readFileSync(resolve(__dirname, '../feedback.css'), 'utf8')

  it('has no size mark by default, as always', () => {
    const { container } = render(<EmptyState title='Nothing' />)
    expect(container.firstChild).not.toHaveAttribute('data-size')
  })

  it("marks size='page' and draws its title at the page title's size", () => {
    const { container } = render(<EmptyState title="This page isn't available" titleAs='h1' size='page' />)
    expect(container.firstChild).toHaveAttribute('data-size', 'page')
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('odc-state-title')
    const rule = css.match(/\.odc-state\[data-size='page'\] \.odc-state-title\s*\{([^}]*)\}/)
    expect(rule?.[1]).toMatch(/font-size:\s*var\(--od-x-type-title-size\)/)
    expect(rule?.[1]).toMatch(/line-height:\s*var\(--od-x-leading-title\)/)
  })

  it('ignores a size it does not know', () => {
    const { container } = render(<EmptyState title='Nothing' size='huge' />)
    expect(container.firstChild).not.toHaveAttribute('data-size')
  })
})

describe('InlineNotice · live (N-FD3)', () => {
  it('is a polite status by default, as always', () => {
    render(<InlineNotice tone='info'>Saved</InlineNotice>)
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
  })

  it('is a static note with live={false}: role note, not a live region', () => {
    render(<InlineNotice tone='info' live={false}>Sign in with your project</InlineNotice>)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('note')).toHaveTextContent('Sign in with your project')
  })

  it('does not pass `live` on to the DOM, and an explicit role still wins', () => {
    const { container, rerender } = render(<InlineNotice tone='info' live={false}>Text</InlineNotice>)
    expect(container.firstChild).not.toHaveAttribute('live')
    rerender(<InlineNotice tone='danger' live={false} role='alert'>Text</InlineNotice>)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
