// redesign bi FC (D10, BI-07, BI-08, BI-09, BI-14, BI-15, auditor 11): the card of a report block and its icon action.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { scanSource } from '../../../../../../../../../../scripts/product-ui/literal-guard.mjs'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback]
}))

import { Download } from '../../../Shared/Icon'
import { ReportCard, CardAction } from '../ReportCard'

const noop = () => {}

describe('ReportCard', () => {
  it('is a section named by its title, an h3 by default and sentence-case text, not capitals', () => {
    renderWithProviders(<ReportCard title='Orders by status'><p>body</p></ReportCard>)
    const region = screen.getByRole('region', { name: 'Orders by status' })
    expect(region.tagName).toBe('SECTION')
    const heading = screen.getByRole('heading', { level: 3, name: 'Orders by status' })
    expect(region).toHaveAttribute('aria-labelledby', heading.id)
    expect(heading.id).not.toBe('')
    expect(heading.textContent).toBe('Orders by status')
  })

  it('takes the heading level the page gives it', () => {
    renderWithProviders(<ReportCard title='Service' headingLevel={2}><p>body</p></ReportCard>)
    expect(screen.getByRole('heading', { level: 2, name: 'Service' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument()
  })

  it('puts the className and the id on the section', () => {
    renderWithProviders(<ReportCard title='Service' id='block-service' className='mine'><p>body</p></ReportCard>)
    const region = screen.getByRole('region', { name: 'Service' })
    expect(region).toHaveAttribute('id', 'block-service')
    expect(region).toHaveClass('odc-bi-card', 'mine')
  })

  it('paints the children and no busy flag when it has data', () => {
    renderWithProviders(<ReportCard title='Service'><p>the body</p></ReportCard>)
    expect(screen.getByText('the body')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Service' })).not.toHaveAttribute('aria-busy')
  })

  it('paints the actions on the title row', () => {
    const onClick = vi.fn()
    renderWithProviders(
      <ReportCard title='Service' actions={<CardAction icon={Download} label='Download CSV of Service' onClick={onClick} />}>
        <p>body</p>
      </ReportCard>
    )
    const region = screen.getByRole('region', { name: 'Service' })
    const button = within(region).getByRole('button', { name: 'Download CSV of Service' })
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  describe('loading (BI-08)', () => {
    it('is busy and paints a skeleton with the final chart height instead of the children', () => {
      const { container } = renderWithProviders(<ReportCard title='Service' loading><p>the body</p></ReportCard>)
      expect(screen.getByRole('region', { name: 'Service' })).toHaveAttribute('aria-busy', 'true')
      expect(screen.queryByText('the body')).not.toBeInTheDocument()
      const skeleton = container.querySelector('.odc-skeleton')
      expect(skeleton).not.toBeNull()
      expect(skeleton.style.inlineSize).toBe('100%')
      expect(skeleton.style.blockSize).toBe('var(--od-x-chart-height)')
    })

    it('paints the skeleton of the consumer, with its own box, when it brings one', () => {
      const { container } = renderWithProviders(<ReportCard title='Service' loading skeleton={<div data-testid='mine' />}><p>the body</p></ReportCard>)
      expect(screen.getByTestId('mine')).toBeInTheDocument()
      expect(container.querySelector('.odc-skeleton')).toBeNull()
    })

    it('loading wins over an old error and over empty', () => {
      renderWithProviders(<ReportCard title='Service' loading error={new Error('x')} empty><p>the body</p></ReportCard>)
      expect(screen.getByRole('region', { name: 'Service' })).toHaveAttribute('aria-busy', 'true')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByText('No data')).not.toBeInTheDocument()
    })
  })

  describe('error (BI-07)', () => {
    it('says which block failed and offers Try again, which calls onRetry', () => {
      const onRetry = vi.fn()
      renderWithProviders(<ReportCard title='Orders by status' error={new Error('boom')} onRetry={onRetry}><p>the body</p></ReportCard>)
      expect(screen.getByRole('alert')).toHaveTextContent('Orders by status could not be loaded.')
      expect(screen.queryByText('the body')).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('moves the focus to the title of the block after Try again (the button leaves)', () => {
      renderWithProviders(<ReportCard title='Orders by status' error onRetry={noop}><p>the body</p></ReportCard>)
      const heading = screen.getByRole('heading', { level: 3, name: 'Orders by status' })
      expect(heading).toHaveAttribute('tabindex', '-1')
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(document.activeElement).toBe(heading)
    })

    it('does not throw when there is no onRetry', () => {
      renderWithProviders(<ReportCard title='Orders by status' error><p>the body</p></ReportCard>)
      expect(() => fireEvent.click(screen.getByRole('button', { name: 'Try again' }))).not.toThrow()
    })
  })

  describe('empty (D10)', () => {
    it('says No data by default in the empty box', () => {
      const { container } = renderWithProviders(<ReportCard title='Service' empty><p>the body</p></ReportCard>)
      expect(screen.queryByText('the body')).not.toBeInTheDocument()
      const box = container.querySelector('.odc-bi-card-empty')
      expect(box).not.toBeNull()
      expect(box).toHaveTextContent('No data')
    })

    it('says the text of the block when it brings one', () => {
      renderWithProviders(<ReportCard title='Service' empty emptyText='No ratings in this period'><p>the body</p></ReportCard>)
      expect(screen.getByText('No ratings in this period')).toBeInTheDocument()
      expect(screen.queryByText('No data')).not.toBeInTheDocument()
    })
  })
})

describe('CardAction (BI-09, BI-15)', () => {
  it('is a native button named by its label, which is also its title', () => {
    renderWithProviders(<CardAction icon={Download} label='Download CSV of Service' onClick={noop} />)
    const button = screen.getByRole('button', { name: 'Download CSV of Service' })
    expect(button.tagName).toBe('BUTTON')
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveAttribute('title', 'Download CSV of Service')
    expect(button).toHaveAttribute('data-size', 'md')
    expect(button).toBeEnabled()
  })

  it('is disabled for real (attribute, not only grey) and ignores a click', () => {
    const onClick = vi.fn()
    renderWithProviders(<CardAction icon={Download} label='Download CSV of Service' onClick={onClick} disabled />)
    const button = screen.getByRole('button', { name: 'Download CSV of Service' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('disabled')
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})

// redesign bi FC (D11, decision 5 of 00-common): the kit stylesheet speaks tokens only and logical properties
describe('analytics-kit.css', () => {
  const file = path.join(__dirname, '..', 'analytics-kit.css')
  const css = readFileSync(file, 'utf8')

  it('has no literal color, size, weight, duration or z-index', () => {
    expect(scanSource(css, file)).toEqual([])
  })

  it('has no physical direction property (RTL)', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(bare.match(/(?:^|[\s;{])(?:margin|padding|border)-(?:left|right|top|bottom)\s*:|(?:^|[\s;{])(?:left|right|top|bottom|(?:min-|max-)?width|(?:min-|max-)?height)\s*:|text-align\s*:\s*(?:left|right)/gm) ?? []).toEqual([])
  })

  it('only uses the odc-bi prefix for its own classes', () => {
    const classes = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/\.[a-z][\w-]*/g) ?? []
    const own = classes.filter(name => !name.startsWith('.odc-bi-'))
    expect(own).toEqual([])
  })
})
