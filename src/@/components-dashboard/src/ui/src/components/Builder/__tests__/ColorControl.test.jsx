import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

import SCHEMA from './themeNodesFixture.json'

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))
vi.mock('../../../styles', async () => {
  const ReactActual = await vi.importActual('react')
  return {
    Button: ReactActual.forwardRef(({ color, borderRadius, outline, ...props }, ref) => <button ref={ref} {...props} />)
  }
})

import { ColorControl } from '../ThemeSchemaEditor/controls'

const t = (_key, fallback) => fallback

/** The fixture with `alpha` on the given color nodes, as 26.1.0 marks translucent colors. */
const withAlphaOn = (...paths) => {
  const schema = JSON.parse(JSON.stringify(SCHEMA))
  paths.forEach(path => {
    const node = path.split('.').reduce((group, key) => group[key], schema)
    node.$extensions['co.ordering.editor'] = { ...node.$extensions['co.ordering.editor'], alpha: true }
  })
  return schema
}

const renderColor = ({ schema, path, value, label = 'Overlay' }) => {
  const onChange = vi.fn()
  renderWithProviders(<ColorControl ctx={{ t, schema, current: {}, edits: {} }} path={path} label={label} value={value} onChange={onChange} />)
  return onChange
}

describe('ColorControl opacity', () => {
  it('lets a translucent token change its opacity, saved as rgba(), transparent or hex', () => {
    const onChange = renderColor({ schema: withAlphaOn('tokens.color.overlay'), path: 'tokens.color.overlay', value: 'rgba(0,0,0,0.4)' })
    const slider = screen.getByRole('slider', { name: 'Overlay opacity' })
    expect(slider).toHaveValue('40')
    fireEvent.change(slider, { target: { value: '25' } })
    expect(onChange).toHaveBeenLastCalledWith('rgba(0,0,0,0.25)')
    fireEvent.change(slider, { target: { value: '0' } })
    expect(onChange).toHaveBeenLastCalledWith('transparent')
    fireEvent.change(slider, { target: { value: '100' } })
    expect(onChange).toHaveBeenLastCalledWith('#000000')
  })

  it('has no opacity where the schema doesn’t allow it, and picks opaque colors there', () => {
    const onChange = renderColor({ schema: SCHEMA, path: 'tokens.color.primary', value: '#336699', label: 'Primary' })
    expect(screen.queryByRole('slider')).toBeNull()
    fireEvent.change(screen.getByLabelText('Primary'), { target: { value: '#ff0000' } })
    expect(onChange).toHaveBeenLastCalledWith('#FF0000')
  })

  it('keeps a component’s theme color until its opacity changes, then saves the color it shows', () => {
    const onChange = renderColor({ schema: withAlphaOn('components.choice.base.hover'), path: 'components.choice.base.hover', value: '{color.surface_alt}', label: 'Hover' })
    fireEvent.click(screen.getByRole('button', { name: /^Hover:/ }))
    const slider = screen.getByRole('slider', { name: 'Pick a color opacity' })
    expect(slider).toHaveValue('100')
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.change(slider, { target: { value: '50' } })
    expect(onChange).toHaveBeenLastCalledWith(expect.stringMatching(/^rgba\(\d{1,3},\d{1,3},\d{1,3},0\.5\)$/))
  })

  it('names a theme color shown translucent with its opacity', () => {
    renderColor({ schema: withAlphaOn('components.choice.base.hover'), path: 'components.choice.base.hover', value: '{color.overlay}', label: 'Hover' })
    expect(screen.getByRole('button', { name: /^Hover: .* · 40 %$/ })).toBeInTheDocument()
  })
})
