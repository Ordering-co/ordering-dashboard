import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CatalogCard } from '../CatalogCard'

// redesign F1 (N-FD2, N-SU1): the static catalog card (media, title, one line, foot with links) that Home, /connect/overview,
// /free-downloads and /support each copied. The piece carries no text of its own: everything it paints is passed in.
const rawCss = readFileSync(resolve(__dirname, '../catalog-card.css'), 'utf8')
const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, '')

const rule = selector => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\>]/g, '\\$&')
  const match = css.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`))
  return match ? match[1] : ''
}

const renderCard = (props = {}) => render(
  <ul>
    <CatalogCard title='Sales team' description='Pricing and plans.' {...props} />
  </ul>
)

describe('CatalogCard', () => {
  it('throws without a title (the contract of P/)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<ul><CatalogCard description='x' /></ul>)).toThrow(Error)
    spy.mockRestore()
  })

  it('is a list item by default, with an h2 title and a description', () => {
    const { container } = renderCard()
    const root = container.querySelector('li.odc-catalog-card')
    expect(root).not.toBeNull()
    expect(within(root).getByRole('heading', { level: 2, name: 'Sales team' })).toBeInTheDocument()
    expect(within(root).getByText('Pricing and plans.').tagName).toBe('P')
  })

  it('takes the heading level and the root element from the consumer', () => {
    const { container } = render(<CatalogCard as='article' titleAs='h3' title='More' />)
    expect(container.querySelector('article.odc-catalog-card')).not.toBeNull()
    expect(screen.getByRole('heading', { level: 3, name: 'More' })).toBeInTheDocument()
  })

  it('merges className and passes every other prop (data-*, aria-*) to the root', () => {
    const { container } = renderCard({ className: 'odc-su-card', 'data-option': 'sales', 'aria-label': 'x' })
    const root = container.querySelector('li')
    expect(root).toHaveClass('odc-catalog-card', 'odc-su-card')
    expect(root).toHaveAttribute('data-option', 'sales')
    expect(root).toHaveAttribute('aria-label', 'x')
  })

  it('paints no empty wrapper for what is not passed (no media, meta, description or footer)', () => {
    const { container } = render(<ul><CatalogCard title='Only a title' /></ul>)
    const root = container.querySelector('li')
    expect(root.querySelector('.odc-catalog-card-media')).toBeNull()
    expect(root.querySelector('.odc-catalog-card-meta')).toBeNull()
    expect(root.querySelector('.odc-catalog-card-description')).toBeNull()
    expect(root.querySelector('.odc-catalog-card-foot')).toBeNull()
  })

  it('paints the media, the meta line and the footer where they were passed, in reading order', () => {
    const { container } = renderCard({
      media: <svg className='odc-icon' aria-hidden='true' />,
      meta: <><span>By Ordering</span><span> · </span><span>Web app</span></>,
      footer: <a className='odc-btn' href='https://example.test'>Open</a>
    })
    const root = container.querySelector('li')
    const order = [...root.querySelectorAll('.odc-catalog-card-media, h2, .odc-catalog-card-meta, .odc-catalog-card-description, .odc-catalog-card-foot')]
      .map(node => node.className.split(' ')[0] || node.tagName)
    expect(order).toEqual(['odc-catalog-card-media', 'odc-catalog-card-title', 'odc-catalog-card-meta', 'odc-catalog-card-description', 'odc-catalog-card-foot'])
    expect(root.querySelector('.odc-catalog-card-meta').textContent).toBe('By Ordering · Web app')
    expect(within(root.querySelector('.odc-catalog-card-foot')).getByRole('link', { name: 'Open' })).toHaveAttribute('href', 'https://example.test')
  })

  it('has no text of its own: the card reads exactly what was passed', () => {
    const { container } = render(
      <ul><CatalogCard title='T' description='D' meta='M' footer={<span>F</span>} media={<span>I</span>} /></ul>
    )
    expect(container.querySelector('li').textContent).toBe('IT' + 'M' + 'D' + 'F')
  })

  it('marks the media kind and the layout so the CSS can tell them apart, icon and stack by default', () => {
    const { container, rerender } = renderCard({ media: <span /> })
    expect(container.querySelector('li')).toHaveAttribute('data-layout', 'stack')
    expect(container.querySelector('.odc-catalog-card-media')).toHaveAttribute('data-kind', 'icon')
    rerender(<ul><CatalogCard title='T' layout='inline' mediaKind='picture' media={<span />} /></ul>)
    expect(container.querySelector('li')).toHaveAttribute('data-layout', 'inline')
    expect(container.querySelector('.odc-catalog-card-media')).toHaveAttribute('data-kind', 'picture')
  })
})

describe('catalog-card.css', () => {
  it('draws the card with the tokens of the product card and shrinks inside a grid track', () => {
    const card = rule('.odc-catalog-card')
    expect(card).toMatch(/display:\s*flex/)
    expect(card).toMatch(/flex-direction:\s*column/)
    expect(card).toMatch(/min-inline-size:\s*0/)
    expect(card).toMatch(/padding:\s*var\(--od-space-4\)/)
    expect(card).toMatch(/background:\s*var\(--od-surface\)/)
    expect(card).toMatch(/border:\s*var\(--od-x-hairline\) solid var\(--od-border\)/)
    expect(card).toMatch(/border-radius:\s*var\(--od-radius-component\)/)
  })

  it('pins the foot to the bottom and lets a long label wrap inside the card (decision 12: 12px gap, 44px areas never cross)', () => {
    const foot = rule('.odc-catalog-card-foot')
    expect(foot).toMatch(/margin-block-start:\s*auto/)
    expect(foot).toMatch(/flex-wrap:\s*wrap/)
    expect(foot).toMatch(/gap:\s*var\(--od-space-3\)/)
    const button = rule('.odc-catalog-card-foot > .odc-btn')
    expect(button).toMatch(/max-inline-size:\s*100%/)
    expect(button).toMatch(/min-block-size:\s*var\(--od-x-control-height\)/)
    expect(button).toMatch(/block-size:\s*auto/)
    expect(button).toMatch(/white-space:\s*normal/)
    expect(button).toMatch(/text-align:\s*start/)
  })

  it('never splits a word of the title (decision 35) and keeps a line of the description near 65 characters', () => {
    expect(rule('.odc-catalog-card-title')).toMatch(/overflow-wrap:\s*break-word/)
    expect(rule('.odc-catalog-card-description')).toMatch(/max-inline-size:\s*calc\(var\(--od-x-measure\) \* 1\.5\)/)
  })

  it('uses logical properties only, so right to left needs no second set of rules', () => {
    expect(css).not.toMatch(/(?:^|[\s;{])(?:width|height|min-width|max-width|min-height|max-height|margin-left|margin-right|padding-left|padding-right|left|right|border-left|border-right):/m)
    expect(css).not.toMatch(/text-align:\s*(?:left|right)/)
  })

  it('has no literal color, font size or pixel length outside the media query', () => {
    const body = css.replace(/@media[^{]*\{/g, '@media {')
    expect(body).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(body).not.toMatch(/rgba?\(/)
    expect(body).not.toMatch(/\d(?:px|rem|em)\b/)
  })
})
