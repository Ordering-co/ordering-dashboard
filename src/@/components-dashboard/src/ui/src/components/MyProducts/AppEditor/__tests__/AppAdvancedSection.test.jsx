/* eslint-disable import/first */
// what the Advanced sections of an app paint and write, with the real controls (the website editor's AdvancedSection with
// `isApp`). Covered: the blocks only an app has (the homepage image, «Homepage image fullscreen», the navigation bar, the Maweja app
// design), the image rules of an app (ImageBox's own: PNG, as the legacy page gave an app no format), the hint of the checkboxes, and
// that the draft is written at the same paths as the legacy page. What is painted where: AppAdvancedParity.test.jsx.
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const translate = (_key, text) => text

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, translate],
  useConfig: () => [{ configs: {} }],
  useApi: () => [{ project: 'demo' }, {}],
  useToast: () => [{}, { showToast: vi.fn() }],
  ToastType: { Error: 'error' },
  ExamineClick: ({ children }) => <>{children}</>,
  DragAndDrop: ({ children }) => <>{children}</>
}))
vi.mock('../../../Shared/UI/ImageCrop', () => ({ ImageCrop: () => null }))

import { AdvancedSection } from '../../OrderingWebsite/SectionsEditor/AdvancedSection'
import { getImageError } from '../../OrderingWebsite/SectionsEditor/ProductSettingList'
import { IMAGE_BOX_FORMAT } from '../../AdvancedSettings/ImageBox'

const dashboardTheme = createDashboardTheme(theme)

const Harness = ({ initial = {}, onWrite, ...rest }) => {
  const [advancedValues, setAdvancedValues] = React.useState(initial)
  return (
    <AdvancedSection
      isApp
      advancedValues={advancedValues}
      setAdvancedValues={(next) => { onWrite(next); setAdvancedValues(next) }}
      themesList={{ loading: false, themes: [{ id: 3, structure: {} }] }}
      {...rest}
    />
  )
}

const show = (sectionId, props = {}) => {
  const onWrite = vi.fn()
  renderWithProviders(<Harness sectionId={sectionId} onWrite={onWrite} {...props} />, { theme: dashboardTheme })
  return { onWrite, last: () => onWrite.mock.calls.at(-1)?.[0] }
}

describe('· the Advanced sections only an app has', () => {
  it('homepage: the homepage image, with the format ImageBox gives an app (PNG)', () => {
    show('homepage', { isKiosk: true })
    expect(screen.getByText('Homepage image')).toBeInTheDocument()
    expect(screen.getByText('1350 x 400 px · Format: PNG')).toBeInTheDocument()
  })

  it('an app image takes what ImageBox took for an app: PNG only (the legacy rule), and the same size limit', () => {
    const file = (name, type, size = 1000) => ({ name, type, size })
    expect(getImageError(file('a.png', 'image/png'), translate, IMAGE_BOX_FORMAT)).toBeNull()
    expect(getImageError(file('a.jpg', 'image/jpeg'), translate, IMAGE_BOX_FORMAT)).toBe('Invalid file type. Allowed format is PNG')
    expect(getImageError(file('a.png', 'image/png', 4 * 1024 * 1024), translate, IMAGE_BOX_FORMAT)).toBe('The maximum image size is 3 MB')
    // a website's is unchanged
    expect(getImageError(file('a.jpg', 'image/jpeg'), translate)).toBeNull()
  })

  it('advanced_images keeps «Homepage image fullscreen» for an app, between the two dummy images, as a plain flag', async () => {
    const user = userEvent.setup()
    const view = show('advanced_images')
    const box = screen.getByRole('checkbox', { name: 'Homepage image fullscreen' })
    expect(box).toHaveAttribute('aria-checked', 'false')
    await user.click(box)
    expect(view.last().my_products.components.images.components.homepage_image_fullscreen).toBe(true)
    expect(screen.getAllByText(/Format: PNG/)).toHaveLength(2)
  })

  it('a franchise app has no «Homepage image fullscreen» (as the legacy page)', () => {
    show('advanced_images', { isFranchise: true })
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('navigation_bar: «checked = shown in your app»; unchecking writes `hidden = true`', async () => {
    const user = userEvent.setup()
    const view = show('navigation_bar')
    expect(screen.getByText('Checked items are shown in your app.')).toBeInTheDocument()
    expect(screen.queryByText('Checked items are shown on your website.')).toBeNull()
    expect(screen.getAllByRole('checkbox').map(node => node.textContent.trim())).toEqual(['Browse', 'Orders', 'My carts', 'Wallet', 'Profile'])
    await user.click(screen.getByRole('checkbox', { name: 'Orders' }))
    expect(view.last().bar_menu.components.orders.hidden).toBe(true)
  })

  it('app_design (Maweja): «Original» until one is chosen, and the choice is written at `app_design.components.layout.type`', async () => {
    const user = userEvent.setup()
    const view = show('app_design', { isMaweja: true })
    expect(screen.getByRole('radio', { name: 'Original' })).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('radio', { name: 'Maweja' }))
    expect(view.last().app_design.components.layout.type).toBe('maweja')
  })

  it('a section the app does not have paints nothing (app design without Maweja, menu options and order tracking in an app)', () => {
    show('app_design')
    show('menu_options')
    show('order_tracking')
    expect(document.querySelector('.odc-ows-form')).toBeNull()
  })
})
