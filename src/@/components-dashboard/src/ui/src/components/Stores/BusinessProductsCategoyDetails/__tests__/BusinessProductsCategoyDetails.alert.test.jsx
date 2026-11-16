/* eslint-disable import/first */
// redesign bugs E (row 42 D18): a failed save showed the editor's alert and its Information form's alert, both titled
// «Business type». The editor shows it once, named Category, and tells the form not to.
import React from 'react'
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import themeJson from '~/theme.json'

const mocks = vi.hoisted(() => ({ infoProps: [] }))

vi.mock('~components', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))
vi.mock('~ui', async () => {
  const React = await import('react')
  return {
    Alert: ({ open, title, content }) => open ? React.createElement('div', { role: 'alert', 'aria-label': title }, content) : null,
    Confirm: () => null,
    Button: ({ children, ...props }) => React.createElement('button', { type: 'button', onClick: props.onClick }, children),
    Modal: () => null
  }
})
vi.mock('../../../../../../components/BusinessProductsCategoyDetails', () => ({
  BusinessProductsCategoyDetails: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))
vi.mock('../../SeoOptions', () => ({ SeoOptions: () => null }))
vi.mock('../../BusinessCategoryInfoSettingList', () => ({ BusinessCategoryInfoSettingList: () => null }))
vi.mock('../../BusinessProductsCategoyInfo', () => ({
  BusinessProductsCategoyInfo: (props) => {
    mocks.infoProps.push(props)
    return null
  }
}))
vi.mock('../../SnoozeComponent', () => ({ SnoozeComponent: () => null }))

import { BusinessProductsCategoyDetails } from '../index'

afterEach(() => {
  cleanup()
  mocks.infoProps.length = 0
})

describe('BusinessProductsCategoyDetails · API error', () => {
  it('shows a failed save once, in an alert named Category, and the Information form is told not to', () => {
    renderWithProviders(
      <BusinessProductsCategoyDetails
        businessState={{ loading: false, business: {} }}
        formState={{ changes: { name: 'Pizzas' }, result: { error: true, result: ['The name is taken'] } }}
        categorySelected={{ id: 5, name: 'Pizzas' }}
        handleChangeItem={vi.fn()}
        handleChangeCheckBox={vi.fn()}
        handleUpdateClick={vi.fn()}
      />,
      { initialEntries: ['/stores/list'], theme: themeJson }
    )
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('alert', { name: 'Category' })).toHaveTextContent('The name is taken')
    expect(mocks.infoProps.at(-1)).toMatchObject({ resultErrorShownByHost: true })
  })
})
