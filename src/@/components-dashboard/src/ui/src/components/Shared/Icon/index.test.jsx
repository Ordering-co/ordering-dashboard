import React, { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BookOpen, CalendarDays, Columns3, Earth, Gift, History, Info, Maximize2, Minimize2, Monitor, PanelLeft, Repeat, Search, ShoppingBag, ShoppingBasket, Star, Truck, TriangleAlert, UserCheck, X } from './index'

describe('Ordering.co Lucide wrapper', () => {
  it('keeps decorative glyphs out of the accessible name and forwards the SVG ref', () => {
    const ref = createRef()
    render(<button aria-label='Search orders'><Search ref={ref} data-testid='glyph' /></button>)
    const svg = screen.getByTestId('glyph')
    expect(svg.tagName.toLowerCase()).toBe('svg')
    expect(ref.current).toBe(svg)
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('width', '16px')
    expect(svg).toHaveAttribute('height', '16px')
    expect(svg).toHaveAttribute('stroke-width', '1.75')
    expect(screen.getByRole('button', { name: 'Search orders' })).toBeInTheDocument()
  })

  it('preserves explicit accessible names, dimensions, CSS hooks and handlers', () => {
    const click = vi.fn()
    render(<X aria-label='Close preview' size={24} strokeWidth={2} className='existing-hook' onClick={click} />)
    const svg = screen.getByRole('img', { name: 'Close preview' })
    expect(svg).toHaveClass('existing-hook')
    expect(svg).toHaveAttribute('width', '24')
    expect(svg).toHaveAttribute('stroke-width', '2')
    fireEvent.click(svg)
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('supports a titled standalone icon without a second text label', () => {
    render(<Search title='Search orders' />)
    expect(screen.getByRole('img', { name: 'Search orders' })).toBeInTheDocument()
    expect(screen.getByTitle('Search orders').tagName.toLowerCase()).toBe('title')
  })

  it('exposes the reviewed sidebar expansion pair with canonical defaults', () => {
    render(<><Maximize2 data-testid='maximize' /><Minimize2 data-testid='minimize' /></>)
    expect(screen.getByTestId('maximize')).toHaveClass('lucide-maximize-2')
    expect(screen.getByTestId('minimize')).toHaveClass('lucide-minimize-2')
    for (const icon of [screen.getByTestId('maximize'), screen.getByTestId('minimize')]) {
      expect(icon).toHaveAttribute('aria-hidden', 'true')
      expect(icon).toHaveAttribute('width', '16px')
      expect(icon).toHaveAttribute('stroke-width', '1.75')
    }
  })

  it('exposes the reviewed floating-selector glyphs with canonical defaults', () => {
    render(
      <>
        <BookOpen data-testid='book' />
        <CalendarDays data-testid='calendar' />
        <Columns3 data-testid='columns' />
      </>
    )

    expect(screen.getByTestId('book')).toHaveClass('lucide-book-open')
    expect(screen.getByTestId('calendar')).toHaveClass('lucide-calendar-days')
    expect(screen.getByTestId('columns')).toHaveClass('lucide-columns-3')
    for (const icon of [screen.getByTestId('book'), screen.getByTestId('calendar'), screen.getByTestId('columns')]) {
      expect(icon).toHaveAttribute('aria-hidden', 'true')
      expect(icon).toHaveAttribute('width', '16px')
      expect(icon).toHaveAttribute('stroke-width', '1.75')
    }
  })

  it('exposes the reviewed feedback glyphs with canonical defaults', () => {
    render(<><Info data-testid='info' /><TriangleAlert data-testid='warning' /></>)

    expect(screen.getByTestId('info')).toHaveClass('lucide-info')
    expect(screen.getByTestId('warning')).toHaveClass('lucide-triangle-alert')
    for (const icon of [screen.getByTestId('info'), screen.getByTestId('warning')]) {
      expect(icon).toHaveAttribute('aria-hidden', 'true')
      expect(icon).toHaveAttribute('width', '16px')
      expect(icon).toHaveAttribute('stroke-width', '1.75')
    }
  })

  // redesign AC-D (G5): the glyphs of the promotion templates
  it('exposes the promotion template glyphs with canonical defaults', () => {
    const glyphs = {
      'lucide-user-check': UserCheck,
      'lucide-repeat': Repeat,
      'lucide-truck': Truck,
      'lucide-shopping-basket': ShoppingBasket,
      'lucide-gift': Gift,
      'lucide-star': Star,
      'lucide-history': History,
      'lucide-shopping-bag': ShoppingBag
    }
    render(<>{Object.entries(glyphs).map(([name, Glyph]) => <Glyph key={name} data-testid={name} />)}</>)
    for (const name of Object.keys(glyphs)) {
      const icon = screen.getByTestId(name)
      expect(icon).toHaveClass(name)
      expect(icon).toHaveAttribute('aria-hidden', 'true')
      expect(icon).toHaveAttribute('width', '16px')
      expect(icon).toHaveAttribute('stroke-width', '1.75')
    }
  })

  // redesign B2: Builder's type glyphs (kiosk app, franchise website, dashboard), which were react-bootstrap-icons
  it('exposes the Builder type glyphs with canonical defaults', () => {
    const glyphs = { 'lucide-monitor': Monitor, 'lucide-earth': Earth, 'lucide-panel-left': PanelLeft }
    render(<>{Object.entries(glyphs).map(([name, Glyph]) => <Glyph key={name} data-testid={name} />)}</>)
    for (const name of Object.keys(glyphs)) {
      const icon = screen.getByTestId(name)
      expect(icon).toHaveClass(name)
      expect(icon).toHaveAttribute('aria-hidden', 'true')
      expect(icon).toHaveAttribute('width', '16px')
      expect(icon).toHaveAttribute('stroke-width', '1.75')
    }
  })
})
