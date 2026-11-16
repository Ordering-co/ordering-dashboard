/* eslint-disable import/first */
// redesign stores 5.11: the store's wallets in line, in the Payment methods list (decision B-3). A two-value boolean config is
// a switch named by the row; any other `type 2` is a radio group; a `type 7` is a secret field that saves when it is left. Real controller,
// fake network: what is asserted is what reaches `/business/:id/configs/:id` and what the control shows afterwards.
import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({ configs: {}, toasts: [] }))

vi.mock('../../../../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', loading: false, user: { level: 0 } }]
}))
vi.mock('../../../../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test/v400/en/demo' }]
}))
vi.mock('../../../../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: (type, message) => mocks.toasts.push([type, message]) }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../../../../index', async () => {
  const { BusinessWalletsList } = await import('../../../../../../components/BusinessWalletsList')
  return {
    useLanguage: () => [{}, (key, fallback) => fallback || key],
    useConfig: () => [{ configs: mocks.configs }],
    useToast: () => [{}, { showToast: () => {} }],
    ToastType: { Error: 'error' },
    BusinessWalletsList
  }
})

import { BusinessWalletsList } from '../index'

const YES_NO = [{ text: 'YES', value: '1' }, { text: 'NO', value: '0' }]
const cash = { id: 653, key: 'wallet_cash_enabled', type: 2, value: '1', options: YES_NO }
const points = { id: 654, key: 'wallet_credit_point_enabled', type: 2, value: '1', options: YES_NO }
const CASH = 'Wallet cash enabled'
const POINTS = 'Wallet credit point enabled'

const answer = (body) => ({ json: async () => body })
const fetchMock = vi.fn()
let save // (id, body) => the API's answer; per test

const renderWallets = (configs, { search = '', loyalty = true } = {}) => {
  fetchMock.mockImplementation(async (url, options) => {
    if (String(url).endsWith('/loyalty_plans')) {
      return answer({ error: false, result: loyalty ? [{ type: 'credit_point', businesses: [{ business_id: 1505 }] }] : [] })
    }
    const id = Number(String(url).split('/').pop())
    const body = JSON.parse(options.body)
    return save(id, body, configs.find(config => config.id === id))
  })
  return renderWithProviders(
    <BusinessWalletsList business={{ id: 1505, configs }} handleSuccessUpdate={() => {}} />,
    { initialEntries: [`/stores/list${search}`] }
  )
}
const saves = () => fetchMock.mock.calls.filter(([url]) => !String(url).endsWith('/loyalty_plans'))
const savedAs = (calls) => calls.map(([url, options]) => [String(url).replace('https://api.test/v400/en/demo', ''), JSON.parse(options.body)])

beforeEach(() => {
  fetchMock.mockReset()
  mocks.toasts.length = 0
  mocks.configs = { wallet_cash_enabled: { value: '1' }, wallet_credit_point_enabled: { value: '1' } }
  save = (id, body, stored) => answer({ error: false, result: { ...stored, ...body } })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BusinessWalletsList (5.11, B-3)', () => {
  it('the two real configs are two switches named by their rows, checked from the stored "1", under an h4 «Wallets»', async () => {
    renderWallets([cash, points])
    const cashSwitch = await screen.findByRole('switch', { name: CASH })
    const pointsSwitch = screen.getByRole('switch', { name: POINTS })
    expect(cashSwitch).toHaveAttribute('aria-checked', 'true')
    expect(pointsSwitch).toHaveAttribute('aria-checked', 'true')
    expect(screen.getAllByRole('switch')).toHaveLength(2)
    expect(screen.getByRole('heading', { level: 4, name: 'Wallets' })).toBeInTheDocument()
  })

  it('a stored "0" is an unchecked switch', async () => {
    renderWallets([cash, { ...points, value: '0' }])
    expect(await screen.findByRole('switch', { name: POINTS })).toHaveAttribute('aria-checked', 'false')
  })

  it('shows a skeleton while it loads and the same visibility rules as main (flag off, no loyalty plan)', async () => {
    mocks.configs = { wallet_cash_enabled: { value: '1' }, wallet_credit_point_enabled: { value: '1' } }
    renderWallets([cash, points], { loyalty: false })
    expect(screen.getByRole('status', { name: 'Loading' })).toHaveAttribute('aria-busy', 'true')
    await screen.findByRole('switch', { name: CASH })
    expect(screen.queryByRole('switch', { name: POINTS })).not.toBeInTheDocument()
  })

  it('shows nothing when no wallet flag is on', async () => {
    mocks.configs = {}
    renderWallets([cash, points])
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Loading' })).not.toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: 'Wallets' })).not.toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('toggling posts the same value main saved ({ value: "0" }) to /business/:id/configs/:id, and stays off', async () => {
    const user = userEvent.setup()
    renderWallets([cash, points])
    const pointsSwitch = await screen.findByRole('switch', { name: POINTS })
    await user.click(pointsSwitch)

    await waitFor(() => expect(saves()).toHaveLength(1))
    expect(savedAs(saves())).toEqual([['/business/1505/configs/654', { value: '0' }]])
    expect(saves()[0][1].method).toBe('POST')
    await waitFor(() => expect(screen.getByRole('switch', { name: POINTS })).toHaveAttribute('aria-checked', 'false'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(mocks.toasts.map(([, message]) => message)).toEqual(['Changes saved'])

    await user.click(screen.getByRole('switch', { name: POINTS }))
    await waitFor(() => expect(saves()).toHaveLength(2))
    expect(savedAs(saves())[1]).toEqual(['/business/1505/configs/654', { value: '1' }])
  })

  it('the pair "true"/"false" is a switch too, and posts the option\'s own value', async () => {
    const user = userEvent.setup()
    const flags = { ...cash, value: 'false', options: [{ text: 'YES', value: 'true' }, { text: 'NO', value: 'false' }] }
    renderWallets([flags])
    const sw = await screen.findByRole('switch', { name: CASH })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    await user.click(sw)
    await waitFor(() => expect(saves()).toHaveLength(1))
    expect(savedAs(saves())[0][1]).toEqual({ value: 'true' })
  })

  it('a failed save puts the switch back and says why in line (and no error toast)', async () => {
    const user = userEvent.setup()
    save = () => answer({ error: true, result: ['Not allowed for this store'] })
    renderWallets([cash, points])
    await user.click(await screen.findByRole('switch', { name: CASH }))

    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent('Not allowed for this store')
    expect(screen.getByRole('switch', { name: CASH })).toHaveAttribute('aria-checked', 'true')
    expect(mocks.toasts.filter(([type]) => type === 'error')).toEqual([])
  })

  it('a failure with no text says «We couldn\'t save the change.»', async () => {
    const user = userEvent.setup()
    save = () => answer({ error: true, result: [] })
    renderWallets([cash])
    await user.click(await screen.findByRole('switch', { name: CASH }))
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn\'t save the change.')
  })

  it('a type 2 with three options is a radio group that saves the picked value, with the options translated as before', async () => {
    const user = userEvent.setup()
    const modes = { ...cash, value: 'weekly', options: [{ text: 'Weekly', value: 'weekly' }, { text: 'Monthly', value: 'monthly' }, { text: 'Never', value: 'never' }] }
    renderWallets([modes])
    const group = await screen.findByRole('radiogroup', { name: CASH })
    expect(within(group).getAllByRole('radio').map(radio => radio.textContent)).toEqual(['WEEKLY', 'MONTHLY', 'NEVER'])
    expect(within(group).getByRole('radio', { name: 'WEEKLY' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()

    await user.click(within(group).getByRole('radio', { name: 'MONTHLY' }))
    await waitFor(() => expect(saves()).toHaveLength(1))
    expect(savedAs(saves())).toEqual([['/business/1505/configs/653', { value: 'monthly' }]])
    await waitFor(() => expect(screen.getByRole('radio', { name: 'MONTHLY' })).toHaveAttribute('aria-checked', 'true'))
  })

  it('a failed radio save shows the stored value again with a danger notice', async () => {
    const user = userEvent.setup()
    save = () => answer({ error: true, result: ['Mode not available'] })
    const modes = { ...cash, value: 'weekly', options: [{ text: 'Weekly', value: 'weekly' }, { text: 'Monthly', value: 'monthly' }, { text: 'Never', value: 'never' }] }
    renderWallets([modes])
    await user.click(await screen.findByRole('radio', { name: 'NEVER' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Mode not available')
    expect(screen.getByRole('radio', { name: 'WEEKLY' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'NEVER' })).toHaveAttribute('aria-checked', 'false')
  })

  describe('type 7', () => {
    const secret = { id: 654, key: 'wallet_credit_point_enabled', type: 7, value: 'old-secret', options: null }
    const field = () => screen.findByLabelText(POINTS, { selector: 'input' })

    it('is a SecretField named by the row: typing saves nothing, leaving it saves the whole value once', async () => {
      const user = userEvent.setup()
      renderWallets([secret])
      const input = await field()
      expect(input).toHaveAttribute('type', 'password')
      expect(input).toHaveValue('old-secret')
      await user.clear(input)
      await user.type(input, 'new-secret')
      expect(saves()).toHaveLength(0)
      await user.tab()
      await user.tab()
      await waitFor(() => expect(saves()).toHaveLength(1))
      expect(savedAs(saves())).toEqual([['/business/1505/configs/654', { value: 'new-secret' }]])
    })

    it('Enter saves once', async () => {
      const user = userEvent.setup()
      renderWallets([secret])
      const input = await field()
      await user.clear(input)
      await user.type(input, 'entered{Enter}')
      await waitFor(() => expect(saves()).toHaveLength(1))
      expect(savedAs(saves())[0][1]).toEqual({ value: 'entered' })
      expect(input).not.toHaveFocus()
    })

    it('an unchanged value saves nothing', async () => {
      const user = userEvent.setup()
      renderWallets([secret])
      await user.click(await field())
      await user.tab()
      await user.tab()
      expect(saves()).toHaveLength(0)
    })

    it('a failed save is told under the field, and leaving it again retries the same value', async () => {
      const user = userEvent.setup()
      save = () => answer({ error: true, result: ['Invalid secret'] })
      renderWallets([secret])
      const input = await field()
      await user.clear(input)
      await user.type(input, 'bad{Enter}')
      expect(await screen.findByText('Invalid secret')).toBeInTheDocument()
      expect(saves()).toHaveLength(1)

      await user.click(input)
      await user.tab()
      await waitFor(() => expect(saves()).toHaveLength(2))
    })
  })

  it('?wallet=654 scrolls to that wallet and focuses its control', async () => {
    const scroll = vi.fn()
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scroll
    try {
      renderWallets([cash, points], { search: '?id=1505&section=payment_methods&wallet=654' })
      const target = await screen.findByRole('switch', { name: POINTS })
      await waitFor(() => expect(target).toHaveFocus())
      expect(scroll).toHaveBeenCalled()
      expect(scroll.mock.contexts.at(-1)).toBe(target)
      expect(screen.getByRole('switch', { name: CASH })).not.toHaveFocus()
    } finally {
      Element.prototype.scrollIntoView = original
    }
  })

  it('without ?wallet nothing takes the focus', async () => {
    renderWallets([cash, points])
    await screen.findByRole('switch', { name: CASH })
    expect(document.body).toHaveFocus()
  })

  it('has no side panel: a click on a row opens nothing, and the file keeps no legacy piece', async () => {
    const user = userEvent.setup()
    renderWallets([cash, points])
    await user.click(await screen.findByText(CASH))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.querySelector('[class*="SideBar"], [class*="sidebar"]')).toBeNull()

    const source = readFileSync(resolve(process.cwd(), 'src/@/components-dashboard/src/ui/src/components/Stores/BusinessWalletsList/index.js'), 'utf8')
    for (const legacy of ['SideBar', 'FirstSelect', 'react-loading-skeleton', 'react-bootstrap-icons', './styles', '<input', 'setIsOpenWalletDetails', 'setIsExtendExtraOpen', 'handleClosePaymethodDetails']) {
      expect(source).not.toContain(legacy)
    }
  })
})
