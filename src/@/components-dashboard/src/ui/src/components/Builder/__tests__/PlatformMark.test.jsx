import React from 'react'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import { PlatformMark } from '../PlatformMark'
import { PlatformIcon, TypeGlyph } from '../BuilderShared'

// redesign B2: the platform marks of Builder, drawn here instead of react-bootstrap-icons (brand marks never enter Shared/Icon)
describe('PlatformMark', () => {
  it.each([['ios', 'apple'], ['android', 'android']])('draws the %s mark, decorative', (platform, mark) => {
    const { container } = render(<PlatformMark platform={platform} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('data-mark', mark)
    expect(svg).toHaveAttribute('fill', 'currentColor')
    expect(svg.querySelector('path').getAttribute('d').length).toBeGreaterThan(100)
  })

  it('draws the phone glyph for any other platform', () => {
    const { container } = render(<PlatformMark platform='web' />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).not.toHaveAttribute('data-mark')
    expect(svg.getAttribute('class')).toContain('lucide')
  })

  it('is what PlatformIcon draws', () => {
    const { container } = render(<PlatformIcon platform='ios' />)
    expect(container.querySelector('svg')).toHaveAttribute('data-mark', 'apple')
  })
})

// redesign B2: the type glyphs are product glyphs of Shared/Icon (Lucide), no longer react-bootstrap-icons
describe('TypeGlyph', () => {
  it.each([
    ['marketplace_app', 'lucide-layout-grid'],
    ['franchise_app', 'lucide-map-pin'],
    ['store_app', 'lucide-store'],
    ['driver_app', 'lucide-truck'],
    ['kiosk_app', 'lucide-monitor'],
    ['marketplace_website', 'lucide-globe'],
    ['franchise_website', 'lucide-earth'],
    ['dashboard', 'lucide-panel-left'],
    ['unknown', 'lucide-phone']
  ])('draws %s as %s', (type, glyph) => {
    const { container } = render(<TypeGlyph type={type} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveClass(glyph)
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })
})
