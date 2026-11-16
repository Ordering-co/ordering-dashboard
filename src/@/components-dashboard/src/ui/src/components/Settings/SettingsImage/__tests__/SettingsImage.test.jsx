/* eslint-disable import/first */
// n.º 1, D-56 (a), settings P-6 (owner, 2026-10-20): inside the Settings hub the image is a pending change of the save bar
// (`onPick`, `onRestore`); without them it saves at once, as before.
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback ?? key],
  useUtils: () => [{ optimizeImage: url => url }],
  DragAndDrop: ({ children }) => <div>{children}</div>,
  ExamineClick: ({ children, childRef }) => <div><input type='file' data-testid='file' ref={childRef} />{children}</div>
}))

// The crop modal hands the cropped image straight back; Confirm is a plain pair of buttons.
vi.mock('../../../Shared', () => ({
  Alert: () => null,
  Modal: ({ open, children }) => (open ? <div>{children}</div> : null),
  ImageCrop: ({ handleChangePhoto }) => <button type='button' onClick={() => handleChangePhoto('data:image/png;base64,CROP')}>crop</button>,
  Confirm: ({ open, onAccept, acceptText }) => (open ? <button type='button' onClick={onAccept}>{`confirm ${acceptText}`}</button> : null)
}))

import { SettingsImage } from '../index'
import imageStyles from '../styles.js?raw'
import { variables } from '~/brand/ordering.tokens.generated'

const config = { id: 9, key: 'dashboard_logo', name: 'Logo', type: 5, value: 'https://res.cloudinary.com/x/logo.png' }

describe('SettingsImage', () => {
  it('with onRestore, «Restore default» hands the change over and saves nothing', async () => {
    const saveConfig = vi.fn()
    const onRestore = vi.fn()
    render(<SettingsImage config={config} saveConfig={saveConfig} onPick={vi.fn()} onRestore={onRestore} />)
    await userEvent.click(screen.getByRole('button', { name: 'Restore default' }))
    await userEvent.click(screen.getByRole('button', { name: 'confirm Restore default' }))
    expect(onRestore).toHaveBeenCalledTimes(1)
    expect(saveConfig).not.toHaveBeenCalled()
  })

  it('without them, «Restore default» saves at once, as before', async () => {
    const saveConfig = vi.fn()
    render(<SettingsImage config={config} saveConfig={saveConfig} />)
    await userEvent.click(screen.getByRole('button', { name: 'Restore default' }))
    await userEvent.click(screen.getByRole('button', { name: 'confirm Restore default' }))
    expect(saveConfig).toHaveBeenCalledWith(9, { value: '' })
  })
})

// (Gift cards): the «Put your image here» box was a div with a click handler, out of the Tab order, and its white
// text sat on a grey scrim, under AA.
describe('SettingsImage upload box', () => {
  it('is a named button in the Tab order that opens the file chooser from the keyboard', async () => {
    const user = userEvent.setup()
    render(<SettingsImage config={config} saveConfig={vi.fn()} />)
    const box = screen.getByRole('button', { name: 'Logo: Put your image here' })
    const file = screen.getByTestId('file')
    const open = vi.spyOn(file, 'click').mockImplementation(() => {})

    await user.tab()
    expect(box).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(open).toHaveBeenCalledTimes(1)
    await user.keyboard(' ')
    expect(open).toHaveBeenCalledTimes(2)
    await user.click(box)
    expect(open).toHaveBeenCalledTimes(3)
  })

  it('names each box with its own config, so several images are not several «Put your image here»', () => {
    render(
      <>
        <SettingsImage config={{ ...config, id: 1, name: 'Card front' }} saveConfig={vi.fn()} />
        <SettingsImage config={{ ...config, id: 2, name: 'Card back' }} saveConfig={vi.fn()} />
      </>
    )
    expect(screen.getByRole('button', { name: 'Card front: Put your image here' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Card back: Put your image here' })).toBeInTheDocument()
  })

  it('paints its text with brand tokens that reach AA in both color modes, and shows a focus ring', () => {
    const block = imageStyles.slice(imageStyles.indexOf('export const UploadImageIcon '), imageStyles.indexOf('export const ImageActions'))
    expect(block).toContain('color: var(--od-text)')
    expect(block).toContain('background: var(--od-surface)')
    expect(block).not.toMatch(/#fff|#ffffff/i)
    expect(imageStyles).toContain('brandFocusOutline')

    const luminance = hex => {
      const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const ratio = (a, b) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
      return (hi + 0.05) / (lo + 0.05)
    }
    for (const mode of ['light', 'dark']) {
      expect(ratio(variables[mode]['--od-text'], variables[mode]['--od-surface']), mode).toBeGreaterThanOrEqual(4.5)
    }
  })
})
