import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

import SCHEMA from './themeNodesFixture.json'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

import { CONTROLS, ColorControl, ResetValue } from '../ThemeSchemaEditor/controls'

// redesign B3b (decision 2): the colour of a component is ThemeColorField, a Base UI Popover in the overlay host
// that doesn't trap the focus; and the other controls are Product pieces.

const t = (_key, fallback) => fallback

const withAlphaOn = (path) => {
  const schema = structuredClone(SCHEMA)
  const node = path.split('.').reduce((group, key) => group[key], schema)
  node.$extensions['co.ordering.editor'] = { ...node.$extensions['co.ordering.editor'], alpha: true }
  return schema
}

const renderColor = ({ schema = SCHEMA, value = '{color.surface_alt}' } = {}) => {
  const onChange = vi.fn()
  renderWithProviders(
    <>
      <ColorControl ctx={{ t, schema, current: {}, edits: {} }} path='components.choice.base.hover' label='Hover' value={value} onChange={onChange} />
      <button type='button'>After</button>
    </>
  )
  const trigger = screen.getByRole('button', { name: /^Hover:/ })
  const open = async () => {
    fireEvent.click(trigger)
    return screen.findByRole('dialog', { name: 'Hover' })
  }
  return { onChange, trigger, open }
}

describe('ThemeColorField', () => {
  it('opens a popover from the swatch button, and Escape closes it with the focus back on the button', async () => {
    const { trigger, open } = renderColor()
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    const popup = await open()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(trigger).toHaveAttribute('aria-controls', popup.id)
    // A non-modal layer: nothing behind it is inert or hidden
    expect(screen.getByRole('button', { name: 'After' })).not.toHaveAttribute('inert')
    within(popup).getByRole('button', { name: 'Primary' }).focus()
    fireEvent.keyDown(document.activeElement, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('doesn’t trap the focus: Tab from its last stop closes it and goes on to the next control', async () => {
    const { open } = renderColor({ schema: withAlphaOn('components.choice.base.hover') })
    const popup = await open()
    const slider = within(popup).getByRole('slider', { name: 'Pick a color opacity' })
    slider.focus()
    fireEvent.keyDown(slider, { key: 'Tab' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(screen.getByRole('button', { name: 'After' })).toHaveFocus())
  })

  it('follows a theme color picked in the grid, and closes', async () => {
    const { onChange, trigger, open } = renderColor()
    const popup = await open()
    const grid = within(popup).getByRole('button', { name: 'Secondary' })
    expect(grid).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(grid)
    expect(onChange).toHaveBeenLastCalledWith('{color.secondary}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('marks the theme color it follows, and names it Theme', async () => {
    const { trigger, open } = renderColor({ value: '{color.primary}' })
    expect(trigger).toHaveAccessibleName('Hover: Primary')
    expect(trigger).toHaveTextContent('Theme')
    const popup = await open()
    expect(within(popup).getByRole('button', { name: 'Primary' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('takes a custom color typed as hex, and says what isn’t one without saving it', async () => {
    const { onChange, open } = renderColor({ value: '#336699' })
    const popup = await open()
    const hex = within(popup).getByRole('textbox', { name: 'Custom color' })
    expect(hex).toHaveValue('#336699')
    // A colour on its way is not saved nor called wrong while it is typed: #00a is saved as #0000AA on leaving the field
    fireEvent.change(hex, { target: { value: '#00a' } })
    expect(onChange).not.toHaveBeenCalled()
    expect(within(popup).queryByRole('alert')).toBeNull()
    fireEvent.blur(hex)
    expect(onChange).toHaveBeenLastCalledWith('#0000AA')
    fireEvent.change(hex, { target: { value: '#00aa00' } })
    expect(onChange).toHaveBeenLastCalledWith('#00AA00')
    onChange.mockClear()
    fireEvent.change(hex, { target: { value: '#00aa0' } })
    expect(within(popup).queryByRole('alert')).toBeNull()
    fireEvent.keyDown(hex, { key: 'Enter' })
    expect(within(popup).getByRole('alert')).toHaveTextContent('Use a hex color like #1E6BD6.')
    expect(hex).toHaveValue('#00aa0')
    expect(onChange).not.toHaveBeenCalled()
    // The browser's picker is still there
    fireEvent.change(within(popup).getByLabelText('Pick a color'), { target: { value: '#ff0000' } })
    expect(onChange).toHaveBeenLastCalledWith('#FF0000')
  })

  it('says the opacity as a percentage on a native range', async () => {
    const { onChange, open } = renderColor({ schema: withAlphaOn('components.choice.base.hover'), value: 'rgba(0,0,0,0.4)' })
    const popup = await open()
    const slider = within(popup).getByRole('slider', { name: 'Pick a color opacity' })
    expect(slider).toHaveAttribute('type', 'range')
    expect(slider).toHaveAttribute('aria-valuetext', '40 %')
    fireEvent.change(slider, { target: { value: '25' } })
    expect(onChange).toHaveBeenLastCalledWith('rgba(0,0,0,0.25)')
  })
})

describe('Theme controls on Product pieces', () => {
  const ctx = { schema: SCHEMA, t, current: {}, edits: {} }

  it('switches with a Product switch', () => {
    const onChange = vi.fn()
    renderWithProviders(<CONTROLS.toggle ctx={ctx} path='visibility.header.cart' label='Cart button' value onChange={onChange} />)
    const toggle = screen.getByRole('switch', { name: 'Cart button' })
    expect(toggle).toHaveClass('odc-switch')
    fireEvent.click(toggle)
    expect(onChange).toHaveBeenLastCalledWith(false)
  })

  it('draws segmented options as Product radio cards with their drawings', () => {
    const onChange = vi.fn()
    const schema = { easing: { $type: 'string', $value: 'linear', $extensions: { 'co.ordering.editor': { control: 'segmented', options: ['linear', 'ease', 'ease_in', 'ease_out', 'ease_in_out'].map(value => ({ value, drawing: `EASING_CURVES:${value}` })) } } } }
    renderWithProviders(<CONTROLS.segmented ctx={{ schema, t }} path='easing' label='Easing' value='ease' onChange={onChange} />)
    const group = screen.getByRole('radiogroup', { name: 'Easing' })
    expect(group).toHaveAttribute('data-variant', 'cards')
    expect(within(group).getAllByRole('radio')).toHaveLength(5)
    expect(within(group).getByRole('radio', { name: 'Ease' })).toBeChecked()
    expect(group.querySelectorAll('.odc-radio-media svg')).toHaveLength(5)
    fireEvent.click(within(group).getByRole('radio', { name: 'Ease out' }))
    expect(onChange).toHaveBeenLastCalledWith('ease_out')
  })

  // main html is edited in the rich editor (Tiptap) now; ThemeSchemaEditor and Shared/RichHtmlEditor tests cover it

  it('resets with a Product icon button', () => {
    const onClick = vi.fn()
    renderWithProviders(<ResetValue label='Restore Primary to its default' onClick={onClick} />)
    const reset = screen.getByRole('button', { name: 'Restore Primary to its default' })
    expect(reset).toHaveClass('odc-btn')
    fireEvent.click(reset)
    expect(onClick).toHaveBeenCalled()
  })
})
