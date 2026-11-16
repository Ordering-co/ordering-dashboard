// redesign bugs E (row 42 D18): a failed save of a category showed two alerts, both titled «Business type»: this form's and
// the category editor's. Inside the editor the form leaves the API error to its host; alone (store onboarding) it still shows it.
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from 'styled-components'
import theme from '~/theme.json'
import { BusinessProductsCategoyInfo } from '../index'

vi.mock('../../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (_, fallback) => fallback] }))
vi.mock('../../../../../../contexts/ConfigContext', () => ({ useConfig: () => [{ configs: {} }] }))
vi.mock('../../../Shared/Confirm', () => ({
  Alert: ({ open, title, content }) => open ? <div role='alert' aria-label={title}>{content}</div> : null,
  Confirm: () => null
}))
vi.mock('../../../Shared/Modal', () => ({ Modal: () => null }))
vi.mock('../../../Shared/ImageCrop', () => ({ ImageCrop: () => null }))
vi.mock('../../../Shared/ColorPicker', () => ({ ColorPicker: () => null }))

afterEach(cleanup)

const failed = { changes: { name: 'Pizzas' }, result: { error: true, result: ['The name is taken'] } }
const draw = (props = {}) => render(
  <ThemeProvider theme={theme}>
    <BusinessProductsCategoyInfo formState={failed} category={{ id: 5, name: 'Pizzas' }} parentCategories={[]} handleChangeItem={vi.fn()} {...props} />
  </ThemeProvider>
)

describe('BusinessProductsCategoyInfo · API error', () => {
  it('alone, shows the API error in an alert named Category', () => {
    draw()
    expect(screen.getByRole('alert', { name: 'Category' })).toHaveTextContent('The name is taken')
  })

  it('inside the category editor, leaves the API error to the editor (one alert, not two)', () => {
    draw({ resultErrorShownByHost: true })
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
