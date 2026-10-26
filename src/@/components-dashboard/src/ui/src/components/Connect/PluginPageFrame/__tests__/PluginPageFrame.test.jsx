import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback]
}))

import { PluginPageFrame } from '../index'

/**
 * The plugin page inside a plugin modal (docs/PLUGIN_PAGES.md): a loading
 * state until the page has loaded, and the height the page or the modal asks
 * for.
 */
const box = (container) => container.firstChild

describe('PluginPageFrame', () => {
  it('says it is loading while the launch has not given a URL yet', () => {
    const { container } = renderWithProviders(<PluginPageFrame url={null} name='Clover' fits />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading Clover…')
    expect(container.querySelector('iframe')).toBeNull()
  })

  it('hides the page until it loads, then shows it without the loading state', () => {
    const { container } = renderWithProviders(<PluginPageFrame url='https://clover.test/setup' name='Clover' fits />)
    const frame = container.querySelector('iframe')

    expect(frame).toHaveAttribute('src', 'https://clover.test/setup')
    expect(screen.getByRole('status')).toBeInTheDocument()

    fireEvent.load(frame)

    expect(screen.queryByRole('status')).toBeNull()
  })

  it('opens a page that fits at its remembered height and then follows the page', () => {
    const { container, rerender } = renderWithProviders(<PluginPageFrame url={null} name='Clover' fits initialHeight={472} />)
    expect(box(container)).toHaveStyle({ height: '472px' })

    rerender(<PluginPageFrame url='https://clover.test/setup' name='Clover' fits initialHeight={472} height={500} />)
    expect(box(container)).toHaveStyle({ height: '500px' })
  })

  it('keeps the fixed height for a plugin without a launch', () => {
    const { container } = renderWithProviders(<PluginPageFrame url='https://other.test/setup' name='Other' />)

    expect(box(container)).toHaveStyle({ height: '85%' })
  })

  it('names the integration when the plugin has no name', () => {
    renderWithProviders(<PluginPageFrame url={null} />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading Integration…')
  })
})
