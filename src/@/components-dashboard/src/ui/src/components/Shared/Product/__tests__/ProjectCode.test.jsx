import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ProjectCode } from '../ProjectCode'

// redesign F2 (N-SU2): the note «project code + Copy» that /support and /free-downloads each wrote. The piece has no text:
// the sentence, the label of the code and the four words of Copy come from the page.
const rawCss = readFileSync(resolve(__dirname, '../project-code.css'), 'utf8')
const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, '')

const rule = selector => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\>]/g, '\\$&')
  const match = css.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`))
  return match ? match[1] : ''
}

const copy = {
  label: 'Copy project code',
  copyLabel: 'Copy',
  copiedLabel: 'Copied',
  failedLabel: "We couldn't copy."
}
const base = { note: 'Our team will ask for your project code.', codeLabel: 'Project code', copy }

describe('ProjectCode', () => {
  it.each([
    ['note', { note: undefined }],
    ['codeLabel', { codeLabel: undefined }],
    ['copy', { copy: undefined }],
    ['copy.label', { copy: { ...copy, label: undefined } }],
    ['copy.copyLabel', { copy: { ...copy, copyLabel: undefined } }],
    ['copy.copiedLabel', { copy: { ...copy, copiedLabel: undefined } }],
    ['copy.failedLabel', { copy: { ...copy, failedLabel: undefined } }]
  ])('throws without %s (the contract of P/: the page passes every word)', (_name, missing) => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<ProjectCode {...base} project='orderingv1' {...missing} />)).toThrow(Error)
    spy.mockRestore()
  })

  it('is a static note (not a live region) that reads the sentence, the label and the code as left-to-right text', () => {
    render(<ProjectCode {...base} project='orderingv1' />)
    const note = screen.getByRole('note')
    // the notice itself is no live region (the Copy button keeps its own polite status for «Copied»)
    expect(note).toHaveAttribute('role', 'note')
    expect(within(note).getByText('Our team will ask for your project code.')).toBeInTheDocument()
    expect(within(note).getByText('Project code')).toBeInTheDocument()
    const bdi = within(note).getByText('orderingv1')
    expect(bdi.tagName).toBe('BDI')
    expect(bdi).toHaveAttribute('dir', 'ltr')
    expect(bdi.closest('code')).not.toBeNull()
  })

  it('puts a small Copy button in the action of the notice, named by the page', () => {
    render(<ProjectCode {...base} project='orderingv1' />)
    const button = within(screen.getByRole('note')).getByRole('button', { name: 'Copy project code' })
    expect(button).toHaveAttribute('data-size', 'sm')
    expect(button.closest('.odc-notice-action')).not.toBeNull()
  })

  it('keeps only the sentence without a project: no label, no code, no Copy', () => {
    const { container } = render(<ProjectCode {...base} />)
    expect(screen.getByRole('note')).toHaveTextContent('Our team will ask for your project code.')
    expect(screen.queryByText('Project code')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelector('code')).toBeNull()
    expect(container.querySelector('.odc-notice-action')).toBeNull()
  })

  it('has no text of its own, merges className and passes every other prop to the notice', () => {
    const { container } = render(<ProjectCode {...base} project='p' className='odc-su-x' data-x='1' />)
    const root = container.querySelector('.odc-notice')
    expect(root).toHaveClass('odc-project-code', 'odc-su-x')
    expect(root).toHaveAttribute('data-tone', 'info')
    expect(root).toHaveAttribute('data-x', '1')
    expect(root.textContent).toBe('Our team will ask for your project code.' + 'Project code' + 'p' + 'Copy' + 'Copied')
  })
})

describe('project-code.css', () => {
  it('takes no gutter of its own and lets the note shrink inside the page grid', () => {
    const notice = rule('.odc-notice.odc-project-code')
    expect(notice).toMatch(/margin:\s*0/)
    expect(notice).toMatch(/min-inline-size:\s*0/)
  })

  it('wraps the sentence and the code on baselines, 12px apart across and 4px down', () => {
    const text = rule('.odc-project-code .odc-notice-text')
    expect(text).toMatch(/display:\s*flex/)
    expect(text).toMatch(/flex-wrap:\s*wrap/)
    expect(text).toMatch(/align-items:\s*baseline/)
    expect(text).toMatch(/column-gap:\s*var\(--od-space-3\)/)
    expect(text).toMatch(/row-gap:\s*var\(--od-space-1\)/)
  })

  it('draws the code as a mono chip that wraps instead of running out of the note', () => {
    const code = rule('.odc-project-code-code')
    expect(code).toMatch(/min-inline-size:\s*0/)
    expect(code).toMatch(/padding-inline:\s*var\(--od-space-2\)/)
    expect(code).toMatch(/background:\s*var\(--od-surface\)/)
    expect(code).toMatch(/border:\s*var\(--od-x-hairline\) solid var\(--od-border\)/)
    expect(code).toMatch(/border-radius:\s*var\(--od-radius-control\)/)
    expect(code).toMatch(/font-family:\s*var\(--od-font-mono\)/)
    expect(code).toMatch(/font-size:\s*var\(--od-x-type-ui-size\)/)
    expect(code).toMatch(/overflow-wrap:\s*anywhere/)
    expect(rule('.odc-project-code-label')).toMatch(/color:\s*var\(--od-text-muted\)/)
    expect(rule('.odc-project-code-value')).toMatch(/max-inline-size:\s*100%/)
  })

  it('uses logical properties and tokens only', () => {
    expect(css).not.toMatch(/(?:^|[\s;{])(?:width|height|min-width|max-width|min-height|max-height|margin-left|margin-right|padding-left|padding-right|left|right|border-left|border-right):/m)
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(css).not.toMatch(/rgba?\(/)
    expect(css).not.toMatch(/\d(?:px|rem|em)\b/)
  })
})
