/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { Route } from 'react-router-dom'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({
  session: { auth: true },
  infoShare: [{ isCollapse: false }, { handleMenuCollapse: () => {} }]
}))

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [mocks.session]
}))

vi.mock('../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => mocks.infoShare
}))

import { PageNotFound } from '..'

const LocationProbe = () => (
  <Route render={({ location }) => <output data-testid='location'>{location.pathname}</output>} />
)

const renderPage = (options) => renderWithProviders(<><PageNotFound /><LocationProbe /></>, options)

describe('PageNotFound', () => {
  let handleMenuCollapse

  beforeEach(() => {
    handleMenuCollapse = vi.fn()
    mocks.session = { auth: true }
    mocks.infoShare = [{ isCollapse: false }, { handleMenuCollapse }]
  })

  it('tells a logged-in user the page is not available and offers their start page', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: "This page isn't available" })).toBeInTheDocument()
    expect(screen.getByText("It may not exist, or your account can't open it.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to your start page' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument()
  })

  it('offers the open-menu button when the sidebar is collapsed and opens it', () => {
    mocks.infoShare = [{ isCollapse: true }, { handleMenuCollapse }]
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))

    expect(handleMenuCollapse).toHaveBeenCalledWith(false)
  })

  it('points a logged-out visitor to log in, with no menu button', () => {
    mocks.session = { auth: false }
    mocks.infoShare = [{ isCollapse: true }, { handleMenuCollapse }]
    renderPage()

    expect(screen.getByText('Check the address, or log in to continue.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to log in' })).toHaveAttribute('href', '/login')
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument()
  })

  it('navigates inside the app on a plain click and leaves a modified click to the browser', () => {
    renderPage({ initialEntries: ['/nope'] })
    expect(screen.getByTestId('location')).toHaveTextContent('/nope')
    const link = screen.getByRole('link', { name: 'Go to your start page' })

    const modified = fireEvent.click(link, { button: 0, metaKey: true })
    // fireEvent returns false when preventDefault ran: a modified click must stay the browser's
    expect(modified).toBe(true)
    expect(screen.getByTestId('location')).toHaveTextContent('/nope')

    const plain = fireEvent.click(link, { button: 0 })
    expect(plain).toBe(false)
    expect(screen.getByTestId('location')).toHaveTextContent('/')
    expect(screen.getByTestId('location')).not.toHaveTextContent('/nope')
  })

  it('renders without an InfoShare provider', () => {
    mocks.infoShare = [{}, () => {}]

    expect(() => renderPage()).not.toThrow()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})
