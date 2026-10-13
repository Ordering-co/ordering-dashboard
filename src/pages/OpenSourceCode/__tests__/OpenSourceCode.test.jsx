import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const renderDownloads = vi.hoisted(() => vi.fn())
vi.mock('~ui', () => ({ SourceCodeDownloads: props => { renderDownloads(props); return <div data-testid='source-downloads' /> } }))
import { OpenSourceCode } from '../index'

describe('Open Source Code page wrapper', () => {
  it('delegates to the wired component without introducing API/session logic', () => {
    renderWithProviders(<OpenSourceCode title='controlled-page-prop' />)
    expect(screen.getByTestId('source-downloads')).toBeInTheDocument()
    expect(renderDownloads).toHaveBeenCalledWith({ title: 'controlled-page-prop' })
  })
})
