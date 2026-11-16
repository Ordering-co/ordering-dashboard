/* eslint-disable import/first */
// · «What's new» on the Home: one card at a time from the running announcements, ‹ › and the dots to move, ✕ to hide
// one, nothing when there is none.
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({}))

vi.mock('../../../../../../index', () => ({ useLanguage: () => [{}, (_key, text) => text] }))
vi.mock('../../../../hooks/useFeatureAnnouncements', () => ({
  useFeatureAnnouncements: () => ({ announcements: state.announcements, dismiss: state.dismiss })
}))

import { WhatsNew } from '../WhatsNew'

const card = (id, title) => ({ id, texts: () => ({ title, description: `${title} line`, action: 'Set it up' }), url: `/${id}` })

beforeEach(() => {
  state.announcements = [card('google', 'Order with Google'), card('other', 'Another feature')]
  state.dismiss = vi.fn()
})
afterEach(cleanup)

describe('WhatsNew', () => {
  it('shows one card at a time and moves with the arrows and the dots, never on its own', () => {
    render(<WhatsNew onNavigate={vi.fn()} />)
    expect(screen.getByText('Order with Google')).toBeInTheDocument()
    expect(screen.queryByText('Another feature')).toBeNull()
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Another feature')).toBeInTheDocument()
    expect(screen.getByText('2 of 2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show Order with Google' }))
    expect(screen.getByText('Order with Google')).toBeInTheDocument()
  })

  it('opens the page of the card inside the dashboard', () => {
    const onNavigate = vi.fn()
    render(<WhatsNew onNavigate={onNavigate} />)
    const link = screen.getByRole('link', { name: 'Set it up' })
    expect(link).toHaveAttribute('href', '/google')
    fireEvent.click(link, { button: 0 })
    expect(onNavigate).toHaveBeenCalledWith('/google')
  })

  it('hides the card shown with ✕', () => {
    render(<WhatsNew />)
    fireEvent.click(screen.getByRole('button', { name: 'Hide Order with Google' }))
    expect(state.dismiss).toHaveBeenCalledWith('google')
  })

  it('has no arrows or dots for a single card, and draws nothing without one', () => {
    state.announcements = [card('google', 'Order with Google')]
    const { unmount } = render(<WhatsNew />)
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
    unmount()
    state.announcements = []
    const { container } = render(<WhatsNew />)
    expect(container).toBeEmptyDOMElement()
  })
})
