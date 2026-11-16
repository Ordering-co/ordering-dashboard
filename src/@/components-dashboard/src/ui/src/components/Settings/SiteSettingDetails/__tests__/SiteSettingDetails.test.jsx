/* eslint-disable import/first */
// the configs of a site (opened from Settings › Sales channels) draw Product controls. Text is a TextField, a Yes/No
// select is a Switch, any other select is the Product select (with the «Custom» free text when the config is customizable).
// Every edit still goes through handleChangeConfig(value, siteId, configId) with the value main sent (an option keeps its type).
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const translate = (_key, fallback) => fallback
const session = [{ loading: false, token: 'token' }]
// useSession: read by the legacy select of main, so the test can run red against it
vi.mock('../../../../../../index', () => ({ useLanguage: () => [{ dictionary: {} }, translate], useSession: () => session }))

import { SiteSettingDetails } from '../index'

const configs = () => [
  { id: 1, key: 'site_title', name: 'Site title', type: 1, value: 'Old title' },
  { id: 2, key: 'login_enabled', name: 'Login enabled', description: 'Lets customers log in', type: 2, value: '1', options: [{ text: 'yes', value: '1' }, { text: 'no', value: '0' }] },
  { id: 3, key: 'menu_size', name: 'Menu size', type: 2, value: 1, options: [{ text: 'small', value: 1 }, { text: 'large', value: 2 }] },
  { id: 4, key: 'home_mode', name: 'Home mode', type: 2, value: 'my own text', customizable: true, options: [{ text: 'classic', value: 'classic' }] },
  { id: 5, key: 'no_options', name: 'No options', type: 2, value: 'x' }
]

const renderSite = ({ flat = true, siteConfigsState, siteGroupConfigsState, handleChangeConfig = vi.fn() } = {}) => {
  const list = configs()
  const view = renderWithProviders(
    <SiteSettingDetails
      selectedSiteId={34}
      siteConfigsState={siteConfigsState ?? { loading: false, configs: list, error: null }}
      siteGroupConfigsState={siteGroupConfigsState ?? { loading: false, categories: flat ? [] : [{ name: 'Login', description: 'How customers log in', configs: list }] }}
      handleChangeConfig={handleChangeConfig}
    />
  )
  return { ...view, handleChangeConfig }
}

describe.each([['the flat list', true], ['the grouped categories', false]])('SiteSettingDetails with Product controls, %s', (_name, flat) => {
  it('draws no legacy control', () => {
    const { container } = renderSite({ flat })
    expect(container.querySelector('.form-control, .form-group, .select, .react-loading-skeleton')).toBeNull()
    expect(container.querySelectorAll('.odc-field').length).toBeGreaterThan(0)
  })

  it('a text config is a TextField that sends every keystroke', async () => {
    const { handleChangeConfig } = renderSite({ flat })
    const input = screen.getByRole('textbox', { name: 'Site title' })
    expect(input).toHaveValue('Old title')
    await userEvent.type(input, '!')
    expect(handleChangeConfig).toHaveBeenLastCalledWith('Old title!', 34, 1)
    expect(input).toHaveValue('Old title!')
  })

  it('an exact Yes/No select is a Switch that sends the option values', async () => {
    const { handleChangeConfig } = renderSite({ flat })
    const toggle = screen.getByRole('switch', { name: 'Login enabled' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Lets customers log in')).toBeInTheDocument()
    await userEvent.click(toggle)
    expect(handleChangeConfig).toHaveBeenLastCalledWith('0', 34, 2)
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(toggle)
    expect(handleChangeConfig).toHaveBeenLastCalledWith('1', 34, 2)
  })

  it('another select is the Product select and hands back the option value with its type', async () => {
    const { handleChangeConfig } = renderSite({ flat })
    const picker = screen.getByRole('combobox', { name: /Menu size/ })
    expect(picker).toHaveTextContent('Small')
    await userEvent.click(picker)
    await userEvent.click(await screen.findByRole('option', { name: 'Large' }))
    expect(handleChangeConfig).toHaveBeenLastCalledWith(2, 34, 3)
    expect(screen.getByRole('combobox', { name: /Menu size/ })).toHaveTextContent('Large')
  })

  it('a customizable select keeps «Custom» with its free text', async () => {
    const { handleChangeConfig } = renderSite({ flat })
    const picker = () => screen.getByRole('combobox', { name: /Home mode/ })
    expect(picker()).toHaveTextContent('Custom')
    const custom = screen.getByRole('textbox', { name: 'Home mode · Custom' })
    expect(custom).toHaveValue('my own text')
    await userEvent.type(custom, '!')
    expect(handleChangeConfig).toHaveBeenLastCalledWith('my own text!', 34, 4)

    await userEvent.click(picker())
    await userEvent.click(await screen.findByRole('option', { name: 'Classic' }))
    expect(handleChangeConfig).toHaveBeenLastCalledWith('classic', 34, 4)
    expect(screen.queryByRole('textbox', { name: 'Home mode · Custom' })).toBeNull()

    // as main: picking Custom again sends the stored value and gives the free text back with it
    await userEvent.click(picker())
    await userEvent.click(await screen.findByRole('option', { name: 'Custom' }))
    expect(handleChangeConfig).toHaveBeenLastCalledWith('my own text', 34, 4)
    expect(screen.getByRole('textbox', { name: 'Home mode · Custom' })).toHaveValue('my own text')
  })

  // replaces the legacy «secret keeps the 20px spacing of the legacy fields» check: every config, secret or not, is one hub row
  it('draws every config, a secret too, in the same hub row', () => {
    const list = [{ id: 6, key: 'some_site_password', name: 'Site Secret Token', type: 7, value: 'type-seven-secret-8888' }, ...configs()]
    renderSite({ siteConfigsState: { loading: false, configs: list, error: null }, siteGroupConfigsState: { loading: false, categories: flat ? [] : [{ name: 'Keys', configs: list }] } })
    const show = screen.getByRole('button', { name: 'Show Site Secret Token' })
    expect(show.closest('.odc-hub-row')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Site title' }).closest('.odc-hub-row')).toBeInTheDocument()
  })

  it('a select without options says so', () => {
    renderSite({ flat })
    expect(screen.getByText('There is no options value')).toBeInTheDocument()
  })
})

describe('SiteSettingDetails states', () => {
  it('keeps the section heading and draws a category as a heading with its description', () => {
    renderSite({ flat: false })
    expect(screen.getByRole('heading', { name: 'All Settings' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
    expect(screen.getByText('How customers log in')).toBeInTheDocument()
  })

  it('loads with Product skeletons', () => {
    const { container } = renderSite({ siteConfigsState: { loading: true, configs: [], error: null }, siteGroupConfigsState: { loading: true, categories: [] } })
    expect(container.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()
    expect(container.querySelector('.react-loading-skeleton')).toBeNull()
  })

  it('an error is a Product error state with the same message', () => {
    renderSite({ siteConfigsState: { loading: false, configs: [], error: ['Not found'] }, siteGroupConfigsState: { loading: false, categories: [] } })
    expect(screen.getByRole('alert')).toHaveTextContent('Sorry, we couldn\'t find the config.')
  })
})
