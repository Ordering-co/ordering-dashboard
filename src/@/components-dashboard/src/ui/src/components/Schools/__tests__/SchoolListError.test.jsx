/* eslint-disable import/first */
// redesign SC-B1 (M-SC03): the notice of a list that could not be loaded. It is an error with a way out, never «No … yet».
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({ catalog: {} }))

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (key, text) => mockState.catalog[key] ?? text]
}))

import { SchoolListError } from '../SchoolListError'

beforeEach(() => { mockState.catalog = {} })
afterEach(cleanup)

describe('SchoolListError', () => {
  it('is an announced error with the title and the hint when there is no message', () => {
    render(<SchoolListError message={null} onRetry={() => {}} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('data-tone', 'error')
    expect(alert).toHaveTextContent('This could not be loaded')
    expect(alert).toHaveTextContent('Check your connection and try again.')
  })

  it('a message of the API is shown translated', () => {
    mockState.catalog = { THE_SCHOOL_DOES_NOT_EXIST: 'La escuela no existe' }
    render(<SchoolListError message='The school does not exist' onRetry={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('La escuela no existe')
    expect(screen.queryByText('Check your connection and try again.')).toBeNull()
  })

  it('a message with no translation is shown as it came', () => {
    render(<SchoolListError message='Server said no' onRetry={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Server said no')
  })

  it.each([[true], [''], ['   '], [undefined], [['a list']]])('a message that is not text (%j) falls back to the hint', (message) => {
    render(<SchoolListError message={message} onRetry={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Check your connection and try again.')
  })

  it('takes the title and the hint from the catalog', () => {
    mockState.catalog = { SCHOOL_LOAD_FAILED: 'No se pudo cargar', SCHOOL_LOAD_FAILED_HINT: 'Revisa tu conexión.' }
    render(<SchoolListError onRetry={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar')
    expect(screen.getByRole('alert')).toHaveTextContent('Revisa tu conexión.')
  })

  it('«Retry» is a button that calls onRetry once', async () => {
    const onRetry = vi.fn()
    render(<SchoolListError message='x' onRetry={onRetry} />)
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('«Retry» uses the catalog', () => {
    mockState.catalog = { RETRY: 'Reintentar' }
    render(<SchoolListError onRetry={() => {}} />)
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('never says «No … yet»', () => {
    render(<SchoolListError onRetry={() => {}} />)
    expect(screen.queryByText(/\bNo\b.*\byet\b/i)).toBeNull()
  })
})
