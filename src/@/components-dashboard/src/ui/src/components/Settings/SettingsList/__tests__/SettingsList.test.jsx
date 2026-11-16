import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useConfig: () => [{ configs: {} }],
  SettingsList: () => null
}))

vi.mock('../../../Shared', () => ({
  Alert: ({ content, open }) => open
    ? <div role='alert'>{(Array.isArray(content) ? content : [content]).filter(Boolean).join(' ')}</div>
    : null,
  ColorPicker: () => null,
  NotFoundSource: () => null
}))

vi.mock('../../SettingsSelectUI', () => ({
  SettingsSelectUI: ({ config, handleSelectChange }) => (
    <label>
      {config?.name || config?.key}
      <button type='button' aria-label={`Enable ${config?.key}`} onClick={() => handleSelectChange('1')}>
        Enable {config?.key}
      </button>
    </label>
  )
}))

import { SettingsListUI } from '../index'

const leftoverConfig = {
  id: 99,
  key: 'allow_driver_reject_order',
  name: 'Allow drivers to reject assigned orders',
  type: 1,
  value: '1'
}

// The API casts `options` to an array before it reaches the dashboard.
const yesNo = [{ text: 'YES', value: '1' }, { text: 'NO', value: '0' }]

const facebookConfigs = (enabled) => ([
  { id: 1, key: 'facebook_login_enabled', name: 'Enable Facebook Login', type: 2, value: enabled, options: yesNo },
  { id: 2, key: 'facebook_id', name: 'Facebook Application ID', type: 1, value: 'app-id' },
  { id: 3, key: 'facebook_secret', name: 'Facebook Application Secret Key', type: 7, value: 'shh' }
])

const stripeConfigs = (sandbox) => ([
  { id: 10, key: 'stripe_sandbox', name: 'Sandbox mode', type: 2, value: sandbox, options: yesNo },
  { id: 11, key: 'stripe_publishable', name: 'Live publishable key', type: 1, value: 'pk_live' },
  { id: 12, key: 'stripe_secret', name: 'Live secret key', type: 7, value: 'sk_live' },
  { id: 13, key: 'stripe_publishable_sandbox', name: 'Sandbox publishable key', type: 1, value: 'pk_test' },
  { id: 14, key: 'stripe_secret_sandbox', name: 'Sandbox secret key', type: 7, value: 'sk_test' }
])

const listProps = ({ configs, focus, category, settingsState, handleClickUpdate, handleInputChange, setAvailableModifyData } = {}) => ({
  category,
  settingsState: settingsState || { loading: false, error: null, API: false, changes: [] },
  configs,
  formState: { changes: [] },
  configOptionsToHide: [],
  handleClickUpdate,
  handleInputChange,
  setAvailableModifyData,
  focus
})

const renderList = ({
  configs = [leftoverConfig],
  focus = 'allow_driver_reject_order',
  category = { key: 'enterprise_delivery_driver_assignment_and_scheduling' },
  settingsState,
  handleClickUpdate,
  handleInputChange,
  setAvailableModifyData
} = {}) =>
  renderWithProviders(<SettingsListUI {...listProps({ configs, focus, category, settingsState, handleClickUpdate, handleInputChange, setAvailableModifyData })} />)

const focusId = (key) => `settings-focus-${key}`

const spyScrollTargets = () => {
  const targets = []
  vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function () {
    targets.push(this.id)
  })
  return targets
}

describe('SettingsListUI', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders a focused leftover config and does not throw without scrollIntoView', () => {
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = undefined

    expect(() => renderList()).not.toThrow()
    expect(document.getElementById(focusId('allow_driver_reject_order'))).toBeTruthy()
    expect(screen.getByText('When on, a driver can tap Reject after an order is assigned. When off, they must take it.')).toBeInTheDocument()

    Element.prototype.scrollIntoView = original
  })

  describe('dependent fields', () => {
    it('unmounts dependents while the master switch is off', () => {
      renderList({ configs: facebookConfigs('0'), focus: '', category: { key: 'facebook' } })

      expect(document.getElementById(focusId('facebook_login_enabled'))).toBeTruthy()
      expect(document.getElementById(focusId('facebook_id'))).toBeNull()
      expect(document.getElementById(focusId('facebook_secret'))).toBeNull()
      expect(screen.queryByText('Facebook Application ID')).toBeNull()
      expect(screen.queryByText('Facebook Application Secret Key')).toBeNull()
    })

    it('renders dependents once the master switch is on', () => {
      renderList({ configs: facebookConfigs('1'), focus: '', category: { key: 'facebook' } })

      expect(document.getElementById(focusId('facebook_id'))).toBeTruthy()
      expect(document.getElementById(focusId('facebook_secret'))).toBeTruthy()
      expect(screen.getByText('Facebook Application ID')).toBeInTheDocument()
    })

    it('mounts dependents when the master flips in the same session', () => {
      const view = renderList({ configs: facebookConfigs('0'), focus: '', category: { key: 'facebook' } })
      expect(document.getElementById(focusId('facebook_id'))).toBeNull()

      view.rerender(
        <SettingsListUI {...listProps({ configs: facebookConfigs('1'), focus: '', category: { key: 'facebook' } })} />
      )
      expect(document.getElementById(focusId('facebook_id'))).toBeTruthy()
    })

    it('redirects a focus on a hidden dependent to its master', () => {
      const targets = spyScrollTargets()
      renderList({ configs: facebookConfigs('0'), focus: 'facebook_secret', category: { key: 'facebook' } })

      expect(targets).toEqual([focusId('facebook_login_enabled')])
    })

    it('keeps the focus on a visible dependent', () => {
      const targets = spyScrollTargets()
      renderList({ configs: facebookConfigs('1'), focus: 'facebook_secret', category: { key: 'facebook' } })

      expect(targets).toEqual([focusId('facebook_secret')])
    })

    it('shows only the key pair matching the sandbox mode and redirects the live focus', () => {
      const targets = spyScrollTargets()
      renderList({ configs: stripeConfigs('1'), focus: 'stripe_publishable', category: { key: 'stripe' } })

      expect(document.getElementById(focusId('stripe_publishable_sandbox'))).toBeTruthy()
      expect(document.getElementById(focusId('stripe_secret_sandbox'))).toBeTruthy()
      expect(document.getElementById(focusId('stripe_publishable'))).toBeNull()
      expect(document.getElementById(focusId('stripe_secret'))).toBeNull()
      expect(targets).toEqual([focusId('stripe_sandbox')])
    })

    it('does not leak an uncontrolled value into a sibling row when rows shift', () => {
      const view = renderList({ configs: stripeConfigs('0'), focus: '', category: { key: 'stripe' } })
      expect(document.getElementById(focusId('stripe_secret')).querySelector('input').value).toBe('sk_live')

      view.rerender(
        <SettingsListUI {...listProps({ configs: stripeConfigs('1'), focus: '', category: { key: 'stripe' } })} />
      )
      expect(document.getElementById(focusId('stripe_secret_sandbox')).querySelector('input').value).toBe('sk_test')
    })

    it('shows the live key pair when sandbox mode is off', () => {
      renderList({ configs: stripeConfigs('0'), focus: '', category: { key: 'stripe' } })

      expect(document.getElementById(focusId('stripe_publishable'))).toBeTruthy()
      expect(document.getElementById(focusId('stripe_secret'))).toBeTruthy()
      expect(document.getElementById(focusId('stripe_publishable_sandbox'))).toBeNull()
      expect(document.getElementById(focusId('stripe_secret_sandbox'))).toBeNull()
    })

    it('keeps a dependent visible when its master is not part of the category', () => {
      const orphan = facebookConfigs('0').filter(config => config.key !== 'facebook_login_enabled')
      renderList({ configs: orphan, focus: '', category: { key: 'facebook' } })

      expect(document.getElementById(focusId('facebook_id'))).toBeTruthy()
      expect(document.getElementById(focusId('facebook_secret'))).toBeTruthy()
    })

    it('does not warn about duplicate keys while the skeleton is loading', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      renderList({
        configs: facebookConfigs('1'),
        focus: '',
        category: { key: 'facebook' },
        settingsState: { loading: true, error: null, API: false, changes: [] }
      })

      expect(spy.mock.calls.some(args => String(args[0]).includes('unique "key" prop'))).toBe(false)
    })

    it('does not force dependents to be required (pure visibility)', () => {
      renderList({ configs: facebookConfigs('1'), focus: '', category: { key: 'facebook' } })

      expect(document.getElementById(focusId('facebook_id')).querySelector('input')).not.toHaveAttribute('required')
      expect(document.getElementById(focusId('facebook_secret')).querySelector('input')).not.toHaveAttribute('required')
      expect(screen.queryByText('Required')).toBeNull()
    })

    it('lets the master turn on locally and forwards the change', async () => {
      const handleInputChange = vi.fn()
      const configs = facebookConfigs('0').map(config => (
        config.key === 'facebook_id' || config.key === 'facebook_secret'
          ? { ...config, value: '' }
          : config
      ))

      renderList({
        configs,
        focus: '',
        category: { key: 'facebook' },
        handleInputChange
      })

      await userEvent.click(screen.getByRole('button', { name: 'Enable facebook_login_enabled' }))

      expect(handleInputChange).toHaveBeenCalledWith('1', 1)
    })

    it('keeps hint-like values on non dependent text configs', () => {
      const copyConfig = { id: 77, key: 'checkout_comment_hint', name: 'Comment hint', type: 1, value: 'Add your comment here' }
      renderList({ configs: [copyConfig], focus: '', category: { key: 'checkout' } })

      const input = document.getElementById(focusId('checkout_comment_hint')).querySelector('input')
      expect(input.value).toBe('Add your comment here')
      expect(input).toHaveAttribute('placeholder', 'Comment hint')
    })

    it('renders instructional stored text as the placeholder, not the value', () => {
      const configs = facebookConfigs('1').map(config => (
        config.key === 'facebook_id'
          ? { ...config, value: 'Add your Facebook ID' }
          : config
      ))

      renderList({ configs, focus: '', category: { key: 'facebook' } })

      const input = document.getElementById(focusId('facebook_id')).querySelector('input')
      expect(input.value).toBe('')
      expect(input).toHaveAttribute('placeholder', 'Add your Facebook ID')
    })

    describe('save rules (pure visibility + payload sanitization)', () => {
      const withCredentials = (enabled, id, secret) => facebookConfigs(enabled).map(config => {
        if (config.key === 'facebook_id') return { ...config, value: id }
        if (config.key === 'facebook_secret') return { ...config, value: secret }
        return config
      })
      const pendingSave = (configs) => ({ loading: false, error: null, API: false, changes: [configs[0]] })

      it('allows Save with the master on and empty dependents (no forced required)', async () => {
        const handleClickUpdate = vi.fn()
        const configs = withCredentials('1', '', '')
        renderList({ configs, focus: '', category: { key: 'facebook' }, settingsState: pendingSave(configs), handleClickUpdate })

        const save = screen.getByRole('button', { name: 'Save' })
        expect(save).toBeEnabled()
        expect(screen.queryByText('This field is required')).toBeNull()
        await userEvent.click(save)
        expect(handleClickUpdate).toHaveBeenCalledTimes(1)
      })

      it('allows Save with the master on and ghost values', async () => {
        const handleClickUpdate = vi.fn()
        const configs = withCredentials('1', 'ghost-id', 'ghost-secret')
        renderList({ configs, focus: '', category: { key: 'facebook' }, settingsState: pendingSave(configs), handleClickUpdate })

        await userEvent.click(screen.getByRole('button', { name: 'Save' }))
        expect(handleClickUpdate).toHaveBeenCalledTimes(1)
      })

      it('unmounts dependents when the master turns off and still allows Save', async () => {
        const handleClickUpdate = vi.fn()
        const on = withCredentials('1', '', '')
        const view = renderList({ configs: on, focus: '', category: { key: 'facebook' }, settingsState: pendingSave(on), handleClickUpdate })
        expect(document.getElementById(focusId('facebook_id'))).toBeTruthy()

        const off = withCredentials('0', '', '')
        view.rerender(<SettingsListUI {...listProps({ configs: off, focus: '', category: { key: 'facebook' }, settingsState: pendingSave(off), handleClickUpdate })} />)

        expect(document.getElementById(focusId('facebook_id'))).toBeNull()
        await userEvent.click(screen.getByRole('button', { name: 'Save' }))
        expect(handleClickUpdate).toHaveBeenCalledTimes(1)
      })

      it('hides Save when there are no pending changes', () => {
        renderList({
          configs: facebookConfigs('1'),
          focus: '',
          category: { key: 'facebook' },
          settingsState: { loading: false, error: null, API: false, changes: [] }
        })

        expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
      })

      it('hides Save when the only pending changes belong to hidden dependents', () => {
        const off = withCredentials('0', '', '')
        const hiddenChange = off.find(config => config.key === 'facebook_id')
        renderList({ configs: off, focus: '', category: { key: 'facebook' }, settingsState: { loading: false, error: null, API: false, changes: [hiddenChange] } })

        expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
      })

      it('reports modify availability over visible configs only', () => {
        const setAvailableModifyData = vi.fn()
        renderList({ configs: withCredentials('0', '', ''), focus: '', category: { key: 'facebook' }, setAvailableModifyData })
        expect(setAvailableModifyData).toHaveBeenLastCalledWith(true)

        setAvailableModifyData.mockClear()
        renderList({ configs: withCredentials('1', '', ''), focus: '', category: { key: 'facebook' }, setAvailableModifyData })
        expect(setAvailableModifyData).toHaveBeenLastCalledWith(false)
      })
    })

    it('saves when visible dependents are filled', async () => {
      const handleClickUpdate = vi.fn()
      const configs = facebookConfigs('1')

      renderList({
        configs,
        focus: '',
        category: { key: 'facebook' },
        settingsState: { loading: false, error: null, API: false, changes: [configs[0]] },
        handleClickUpdate
      })

      await userEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(handleClickUpdate).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.queryByText('This field is required')).toBeNull()
    })

    it('renders leftover type 6 as an order-type table', () => {
      renderList({
        configs: [{
          id: 50,
          key: 'preorder_minimum_days',
          name: 'Set Minimum Preorder Days',
          description: 'Set the minimum preorder days in advance',
          type: 6,
          value: 'delivery,2|pickup,3|eatin,1|catering_delivery,5'
        }],
        focus: '',
        category: { key: 'addon_catering' }
      })

      // redesign (owner decision 32 A): the hub names this key as settingsConfigNames.js does, whatever the API sends
      expect(screen.getByText('Set minimum preorder days')).toBeTruthy()
      expect(screen.getByText('Order type')).toBeTruthy()
      expect(screen.getByText('Days')).toBeTruthy()
      expect(screen.getByText('Delivery')).toBeTruthy()
      expect(screen.getByText('Pickup')).toBeTruthy()
      expect(screen.getByText('Eat in')).toBeTruthy()
      expect(screen.queryByText('DELIVERY')).toBeNull()
      expect(screen.queryByText('EATIN')).toBeNull()
      expect(screen.getByText(/catering delivery/i)).toBeTruthy()
    })

    it('renders custom-block master switches above the dependent block', () => {
      renderList({
        configs: [
          {
            id: 41,
            key: 'multi_business_checkout_delivery_fee_discount_percentage_cart_1',
            name: 'Cart 1',
            type: 1,
            value: '5'
          },
          {
            id: 40,
            key: 'checkout_multi_business_enabled',
            name: 'Enable Multi-Business Checkout',
            type: 2,
            value: '1',
            options: yesNo
          }
        ],
        focus: '',
        category: { key: 'addon_multi_business_checkout' }
      })

      const master = screen.getByText('Enable multi-business checkout') // (decision 32 A): the dashboard's name
      const block = screen.getByText('Delivery fee discount by cart')
      expect(master.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('renders Reservation Enabled above the reservation table', () => {
      renderList({
        configs: [
          {
            id: 80,
            key: 'reservation_setting',
            name: 'Reservation Setting',
            type: 1,
            value: '{"min_guests_reservation":1}'
          },
          {
            id: 81,
            key: 'reservation_enabled',
            name: 'Reservation Enabled',
            type: 2,
            value: '1',
            options: yesNo
          }
        ],
        focus: '',
        category: { key: 'store_reservation' }
      })

      const master = screen.getByText('Reservation enabled') // (decision 32 A): the dashboard's name
      const block = screen.getByText('Reservation setting')
      expect(master.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
  })

  // redesign stores 5.12 (ceded by the coordinator): the default text of VALIDATION_ERROR_NUMERIC is the catalog's
  // («The _attribute_ must be a number.»), filled with the field's name; a template literal there became the catalog's English.
  it('names the field when a platform fee is not a number', async () => {
    const handleClickUpdate = vi.fn()
    const fee = { id: 20, key: 'platform_fee_percentage', name: 'Platform fee percentage', type: 1, value: 'abc' }
    const props = listProps({
      configs: [fee],
      focus: '',
      category: { key: 'platform_fees' },
      settingsState: { loading: false, error: null, API: false, changes: [fee] },
      handleClickUpdate
    })
    renderWithProviders(<SettingsListUI {...props} formState={{ changes: [fee] }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    // (decision 32 A): the dashboard's name of platform_fee_percentage
    expect(await screen.findByText(/The Percentage platform fee must be a number\./)).toBeTruthy()
    expect(screen.queryByText(/_attribute_|\$\{/)).toBeNull()
    expect(handleClickUpdate).not.toHaveBeenCalled()
  })

  // redesign D-81 (R-3, owner, 2026-10-19): the optional `leaveGuard` registers this form in a page's leave host.
  describe('leaveGuard (a page that asks before a way out with unsaved work)', () => {
    const title = { id: 301, key: 'dashboard_title', name: 'Title', type: 1, value: 'Acme Admin-EU' }
    const hiddenDependent = { id: 2, key: 'facebook_id', name: 'Facebook Application ID', type: 1, value: 'x' }
    const master = { id: 1, key: 'facebook_login_enabled', name: 'Enable Facebook Login', type: 2, value: '0', options: yesNo }

    const setup = (overrides = {}) => {
      const holder = { entry: null }
      const register = vi.fn((ref) => { holder.entry = ref; return () => { holder.entry = null } })
      const onCountChange = vi.fn()
      const handleClickUpdate = vi.fn()
      const handleDiscardChanges = vi.fn()
      const build = ({ changes = [], result } = {}, extra = {}) => (
        <SettingsListUI
          {...listProps({
            configs: [title],
            focus: '',
            category: { key: 'dashboard_theme' },
            settingsState: { loading: false, error: null, API: false, changes, result },
            handleClickUpdate
          })}
          formState={{ changes }}
          handleDiscardChanges={handleDiscardChanges}
          leaveGuard={{ register, onCountChange }}
          {...overrides}
          {...extra}
        />
      )
      return { holder, register, onCountChange, handleClickUpdate, handleDiscardChanges, build }
    }

    it('registers one entry, clean until a change is pending, and counts the changes', () => {
      const { holder, register, onCountChange, build } = setup()
      const view = renderWithProviders(build())
      expect(register).toHaveBeenCalledTimes(1)
      expect(holder.entry.current.isDirty()).toBe(false)
      expect(holder.entry.current.count()).toBe(0)
      view.rerender(build({ changes: [title] }))
      expect(holder.entry.current.isDirty()).toBe(true)
      expect(holder.entry.current.count()).toBe(1)
      expect(onCountChange).toHaveBeenLastCalledWith(1)
      view.unmount()
      expect(onCountChange).toHaveBeenLastCalledWith(0)
      expect(holder.entry).toBeNull()
    })

    it('does not count a change to a dependent hidden by its master (it is never sent)', () => {
      const { holder, build } = setup()
      renderWithProviders(build({ changes: [{ ...hiddenDependent, value: 'y' }] }, { configs: [master, hiddenDependent] }))
      expect(holder.entry.current.isDirty()).toBe(false)
    })

    it('without a leaveGuard nothing is registered and nothing is reported', () => {
      const { register, onCountChange, build } = setup()
      renderWithProviders(build({ changes: [title] }, { leaveGuard: undefined }))
      expect(register).not.toHaveBeenCalled()
      expect(onCountChange).not.toHaveBeenCalled()
    })

    it('Discard is the controller\'s handleDiscardChanges', () => {
      const { holder, handleDiscardChanges, build } = setup()
      renderWithProviders(build({ changes: [title] }))
      holder.entry.current.discard()
      expect(handleDiscardChanges).toHaveBeenCalledTimes(1)
    })

    it('Save runs the same submit as the Save button, and answers {ok: true} once the chain of PUTs is over', async () => {
      const { holder, handleClickUpdate, build } = setup()
      const view = renderWithProviders(build({ changes: [title] }))
      let answer
      act(() => { holder.entry.current.save().then(value => { answer = value }) })
      expect(handleClickUpdate).toHaveBeenCalledTimes(1)
      view.rerender(build({ changes: [title] }, { saving: true, settingsState: { loading: false, error: null, API: true, changes: [title] } }))
      await act(async () => {})
      expect(answer).toBeUndefined()
      view.rerender(build({ changes: [], result: { error: false, result: 'ok' } }))
      await act(async () => {})
      expect(answer).toEqual({ ok: true })
    })

    it('Save answers {ok: false} when the API refused (the person stays with the changes)', async () => {
      const { holder, build } = setup()
      const view = renderWithProviders(build({ changes: [title] }))
      let answer
      act(() => { holder.entry.current.save().then(value => { answer = value }) })
      view.rerender(build({ changes: [title] }, { saving: true, settingsState: { loading: false, error: null, API: true, changes: [title] } }))
      view.rerender(build({ changes: [title], result: { error: true, result: ['Title taken'] } }))
      await act(async () => {})
      expect(answer).toEqual({ ok: false })
    })

    it('Save answers {ok: false} at once when a rule stops it, and sends nothing', async () => {
      const { holder, handleClickUpdate, build } = setup()
      const fee = { id: 20, key: 'platform_fee_percentage', name: 'Platform fee percentage', type: 1, value: 'abc' }
      renderWithProviders(build({ changes: [fee] }, { configs: [fee] }))
      let answer
      await act(async () => { answer = await holder.entry.current.save() })
      expect(answer).toEqual({ ok: false })
      expect(handleClickUpdate).not.toHaveBeenCalled()
    })
  })
})
