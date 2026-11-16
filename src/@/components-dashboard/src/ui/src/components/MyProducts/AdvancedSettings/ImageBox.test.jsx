/* eslint-disable import/first */
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { variables } from '~/brand/ordering.tokens.generated'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useToast: () => [null, { showToast: vi.fn() }],
  ToastType: { Error: 'error' },
  DragAndDrop: ({ children }) => <div>{children}</div>,
  // Same contract as the real ExamineClick: hidden file input whose own click does not bubble.
  ExamineClick: ({ childId, childRef, children }) => (
    <div>
      <input
        type='file'
        id={childId}
        data-testid='file-input'
        ref={(e) => childRef && childRef(e)}
        onClick={(e) => e.stopPropagation()}
        onChange={() => {}}
        style={{ display: 'none' }}
      />
      {children}
    </div>
  )
}))
vi.mock('../../Shared', () => ({
  ImageCrop: () => null,
  Modal: ({ children }) => <div>{children}</div>,
  Alert: () => null
}))

import { ImageBox } from './ImageBox'

const here = path.dirname(new URL(import.meta.url).pathname)
const stylesSource = fs.readFileSync(path.join(here, 'styles.js'), 'utf8')
const theme = JSON.parse(fs.readFileSync(path.resolve(here, '../../../../../../../../theme.json'), 'utf8'))

const luminance = (hex) => {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value
  const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const ruleBody = (selector) => {
  const start = stylesSource.indexOf(selector)
  return stylesSource.slice(start, stylesSource.indexOf('`\n\nexport', start))
}

describe('ImageBox keyboard access', () => {
  it('exposes the box as a named button reachable by keyboard', () => {
    renderWithProviders(<ImageBox id='logo' title='Logo' ratio='1:1' />)
    const box = screen.getByRole('button', { name: 'Logo' })
    expect(box).toHaveAttribute('tabindex', '0')
  })

  it.each(['Enter', ' '])('opens the same file input on %j', (key) => {
    renderWithProviders(<ImageBox id='logo' title='Logo' ratio='1:1' />)
    const input = screen.getByTestId('file-input')
    const click = vi.spyOn(input, 'click')
    fireEvent.keyDown(screen.getByRole('button', { name: 'Logo' }), { key })
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('still opens the file input on click and calls handleClick', () => {
    const handleClick = vi.fn()
    renderWithProviders(<ImageBox id='logo' title='Logo' ratio='1:1' handleClick={handleClick} />)
    const click = vi.spyOn(screen.getByTestId('file-input'), 'click')
    fireEvent.click(screen.getByRole('button', { name: 'Logo' }))
    expect(click).toHaveBeenCalledTimes(1)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('ignores other keys', () => {
    renderWithProviders(<ImageBox id='logo' title='Logo' ratio='1:1' />)
    const click = vi.spyOn(screen.getByTestId('file-input'), 'click')
    fireEvent.keyDown(screen.getByRole('button', { name: 'Logo' }), { key: 'a' })
    expect(click).not.toHaveBeenCalled()
  })

  it('is not a button when it is not editable', () => {
    renderWithProviders(<ImageBox id='logo' title='Logo' ratio='1:1' editable={false} />)
    expect(screen.queryByRole('button', { name: 'Logo' })).toBeNull()
  })
})

describe('ImageBox text contrast', () => {
  const muted = variables.light['--od-text-muted']

  it('UploadImageIcon uses a brand token readable on its box', () => {
    expect(ruleBody('export const UploadImageIcon =')).toContain('color: var(--od-text-muted);')
    expect(contrast(muted, theme.colors.secundaryDarkContrast)).toBeGreaterThanOrEqual(4.5)
  })

  it('ImgInfoWrapper p uses a brand token readable on the page', () => {
    expect(ruleBody('export const ImgInfoWrapper =')).toContain('color: var(--od-text-muted);')
    expect(contrast(muted, variables.light['--od-bg'])).toBeGreaterThanOrEqual(4.5)
  })
})
