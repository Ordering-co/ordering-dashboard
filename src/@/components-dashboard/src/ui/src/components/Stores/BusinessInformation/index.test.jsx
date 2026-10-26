import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, it, expect, beforeEach } from 'vitest'
import { ThemeProvider } from 'styled-components'
import theme from '~/theme.json'
import { BusinessInformation } from './index'

const h = vi.hoisted(() => ({
  save: vi.fn(),
  businesses: vi.fn(),
  showToast: vi.fn(),
  formMethods: null,
  session: { token: 'local-test-token', user: { id: 7, level: 0 } },
  ordering: { project: 'local-test' },
  configs: { configs: { format_number_currency: { value: '$' } } }
}))
h.ordering.businesses = h.businesses

vi.mock('../../../../../contexts/SessionContext', () => ({
  useSession: () => [h.session]
}))
vi.mock('../../../../../contexts/ApiContext', () => ({
  useApi: () => [h.ordering]
}))
vi.mock('../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [h.configs]
}))
vi.mock('../../../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useToast: () => [{}, { showToast: h.showToast }]
}))
vi.mock('../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback]
}))

vi.mock('react-popper', () => ({
  usePopper: () => ({ styles: {}, attributes: {}, update: vi.fn() })
}))

vi.mock('react-hook-form', async () => {
  const actual = await vi.importActual('react-hook-form')
  return {
    ...actual,
    useForm: (...args) => {
      const methods = actual.useForm(...args)
      h.formMethods = methods
      return methods
    }
  }
})

vi.mock('../../../../../index', async () => {
  const { BusinessFormDetails } = await vi.importActual('../../../../../components/BusinessFormDetails')
  const { CODES } = await vi.importActual('../../../../../constants/code-numbers')
  return {
    useLanguage: () => [{}, (key, fallback) => fallback],
    useConfig: () => [h.configs],
    useSession: () => [h.session],
    useApi: () => [h.ordering],
    CODES,
    BusinessFormDetails,
    DragAndDrop: ({ children }) => <>{children}</>,
    ExamineClick: ({ children }) => <>{children}</>
  }
})

vi.mock('../../Shared', async () => {
  const { ColorPicker } = await vi.importActual('../../Shared/ColorPicker')
  return {
    Alert: (props) => props.open
      ? (
        <div data-testid='alert'>
          <span>{props.title}</span>
          {(Array.isArray(props.content) ? props.content : [props.content]).map((line, i) => <p key={i}>{line}</p>)}
          <button type='button' onClick={props.onAccept}>{props.acceptText}</button>
        </div>
        )
      : null,
    Modal: (props) => <div data-testid='modal'>{props.children}</div>,
    ImageCrop: () => null,
    ColorPicker
  }
})

const ribbonFixture = {
  id: 91,
  enabled: true,
  text: 'Local special',
  color: '#7b2cbf',
  shape: 'capsule_shape'
}

const businessFixture = {
  id: 91,
  name: 'Local store',
  enabled: false,
  featured: false,
  vertical: 'store',
  description: 'Store description',
  phone: '5551112222',
  external_id: '99',
  ribbon: ribbonFixture
}

const renderUI = (props) => (
  <ThemeProvider theme={theme}>
    <BusinessInformation {...props} />
  </ThemeProvider>
)

const setup = (business = businessFixture) => {
  const onSuccess = vi.fn()
  const view = render(renderUI({ business, handleSuccessUpdate: onSuccess }))
  return { onSuccess, ...view }
}

const nameInput = (container) => container.querySelector('input[name=name]')
const saveButton = () => screen.getByRole('button', { name: 'Save' })
const changeName = (container, value) => fireEvent.change(nameInput(container), { target: { value } })
const clickSave = () => fireEvent.click(saveButton())
const ribbonSwitch = (container) => container.querySelector('[class*=RibbonSwitchWrapper] input[type=checkbox]')
const shapeBoxes = (container) => container.querySelectorAll('[class*=ShapeBoxWrapper]')
const colorBox = (container) => container.querySelector('[class*=ColorBox]')
const openColorPicker = (container) => {
  if (screen.queryByLabelText('hex')) return
  fireEvent.click(colorBox(container).parentElement)
}
const hexInput = () => screen.getByLabelText('hex')
const pickColor = (container, hex) => {
  openColorPicker(container)
  fireEvent.change(hexInput(), { target: { value: hex } })
}
const pickedHexValue = (container) => {
  openColorPicker(container)
  return hexInput().value.replace('#', '').toLowerCase()
}

const ACCESS = { accessToken: 'local-test-token' }

beforeEach(() => {
  h.businesses.mockReturnValue({ save: h.save })
  h.save.mockImplementation((changes) => Promise.resolve({
    content: {
      error: false,
      result: {
        ...businessFixture,
        ...changes,
        ribbon: { ...(businessFixture.ribbon || {}), ...(changes?.ribbon || {}) }
      }
    }
  }))
})

it('sends only the dirty name field when a persisted enabled ribbon is present', async () => {
  const { container, onSuccess } = setup()
  expect(colorBox(container)).toBeTruthy()
  expect(pickedHexValue(container)).toBe('7b2cbf')
  expect(saveButton()).toBeDisabled()
  changeName(container, 'Local store edited')
  expect(saveButton()).toBeEnabled()
  clickSave()
  await waitFor(() => expect(h.businesses).toHaveBeenCalledWith(91))
  expect(h.save).toHaveBeenCalledTimes(1)
  expect(h.save).toHaveBeenCalledWith({ name: 'Local store edited' }, ACCESS)
  await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({
    id: 91,
    enabled: false,
    phone: '5551112222',
    ribbon: ribbonFixture
  })))
  expect(screen.queryByTestId('alert')).toBeNull()
})

it('sends only the dirty name field when the business hydrates after the first render', async () => {
  const onSuccess = vi.fn()
  const view = render(renderUI({ business: null, handleSuccessUpdate: onSuccess }))
  view.rerender(renderUI({ business: businessFixture, handleSuccessUpdate: onSuccess }))
  await waitFor(() => expect(colorBox(view.container)).toBeTruthy())
  changeName(view.container, 'Local store edited')
  clickSave()
  await waitFor(() => expect(h.save).toHaveBeenCalledWith({ name: 'Local store edited' }, ACCESS))
  expect(h.save).toHaveBeenCalledTimes(1)
  expect(screen.queryByTestId('alert')).toBeNull()
})

it('hydrates the ribbon values when a persisted enabled ribbon gains color and shape', async () => {
  const onSuccess = vi.fn()
  const partial = {
    ...businessFixture,
    ribbon: { id: 91, enabled: true, text: 'Local special' }
  }
  const view = render(renderUI({ business: partial, handleSuccessUpdate: onSuccess }))
  await waitFor(() => expect(colorBox(view.container)).toBeTruthy())
  view.rerender(renderUI({ business: businessFixture, handleSuccessUpdate: onSuccess }))
  openColorPicker(view.container)
  await waitFor(() => expect(hexInput().value.toLowerCase()).toBe('7b2cbf'))
  changeName(view.container, 'Local store edited')
  clickSave()
  await waitFor(() => expect(h.save).toHaveBeenCalledWith({ name: 'Local store edited' }, ACCESS))
  expect(h.save).toHaveBeenCalledTimes(1)
  expect(screen.queryByTestId('alert')).toBeNull()
})

it('still requires ribbon color and shape when an enabled ribbon has none', async () => {
  const { container } = setup({
    ...businessFixture,
    ribbon: { id: 91, enabled: true, text: 'Local special' }
  })
  changeName(container, 'Local store edited')
  clickSave()
  await waitFor(() => {
    expect(screen.getByText('The Ribbon color field is required')).toBeTruthy()
    expect(screen.getByText('The Ribbon shape field is required')).toBeTruthy()
  })
  expect(h.save).not.toHaveBeenCalled()
})

it('still requires ribbon color when a persisted enabled ribbon has an empty color', async () => {
  const { container } = setup({
    ...businessFixture,
    ribbon: { id: 91, enabled: true, text: 'Local special', color: '', shape: 'capsule_shape' }
  })
  changeName(container, 'Local store edited')
  clickSave()
  await waitFor(() => expect(screen.getByText('The Ribbon color field is required')).toBeTruthy())
  expect(screen.queryByText('The Ribbon shape field is required')).toBeNull()
  expect(h.save).not.toHaveBeenCalled()
})

it('saves an unrelated name edit when the business has no ribbon', async () => {
  const { container } = setup({ ...businessFixture, ribbon: null })
  changeName(container, 'Local store edited')
  clickSave()
  await waitFor(() => expect(h.save).toHaveBeenCalledWith({ name: 'Local store edited' }, ACCESS))
  expect(h.save).toHaveBeenCalledTimes(1)
  expect(screen.queryByTestId('alert')).toBeNull()
})

it('seeds canonical ribbon defaults when a business with no ribbon is enabled for the first time', async () => {
  const { container } = setup({ ...businessFixture, ribbon: null })
  fireEvent.click(ribbonSwitch(container))
  await waitFor(() => expect(colorBox(container)).toBeTruthy())
  expect(pickedHexValue(container)).toBe('0083fe')
  await waitFor(() => expect(saveButton()).toBeEnabled())
  clickSave()
  await waitFor(() => expect(h.save).toHaveBeenCalledWith({
    ribbon: { color: '#0083FE', text: 'ribbon', shape: 'rectangle', enabled: true }
  }, ACCESS))
  expect(h.save).toHaveBeenCalledTimes(1)
  expect(screen.queryByTestId('alert')).toBeNull()
})

it('keeps first-enable customizations across off/on toggles before saving', async () => {
  const { container } = setup({ ...businessFixture, ribbon: null })
  fireEvent.click(ribbonSwitch(container))
  await waitFor(() => expect(colorBox(container)).toBeTruthy())
  fireEvent.change(container.querySelector('input[name=text]'), { target: { value: 'My ribbon text' } })
  pickColor(container, '#112233')
  await waitFor(() => expect(saveButton()).toBeEnabled())
  fireEvent.click(ribbonSwitch(container))
  fireEvent.click(ribbonSwitch(container))
  await waitFor(() => expect(saveButton()).toBeEnabled())
  clickSave()
  await waitFor(() => expect(h.save).toHaveBeenCalledWith({
    ribbon: { color: '#112233', text: 'My ribbon text', shape: 'rectangle', enabled: true }
  }, ACCESS))
  expect(h.save).toHaveBeenCalledTimes(1)
  expect(screen.queryByTestId('alert')).toBeNull()
})

it('accepts the save after enabling a persisted disabled ribbon with color and shape', async () => {
  const { container } = setup({
    ...businessFixture,
    ribbon: { ...ribbonFixture, enabled: false }
  })
  fireEvent.click(ribbonSwitch(container))
  clickSave()
  await waitFor(() => expect(h.save).toHaveBeenCalledWith({ ribbon: { enabled: true } }, ACCESS))
  expect(h.save).toHaveBeenCalledTimes(1)
  expect(screen.queryByTestId('alert')).toBeNull()
})

it('keeps hydrated ribbon values across off/on toggles of an enabled ribbon', async () => {
  const { container } = setup()
  fireEvent.click(ribbonSwitch(container))
  fireEvent.click(ribbonSwitch(container))
  changeName(container, 'Local store edited')
  clickSave()
  await waitFor(() => expect(h.save).toHaveBeenCalledWith({
    name: 'Local store edited',
    ribbon: { enabled: true }
  }, ACCESS))
  expect(h.save).toHaveBeenCalledTimes(1)
  expect(screen.queryByTestId('alert')).toBeNull()
})

it('sends only the edited ribbon color in the save payload', async () => {
  const { container } = setup()
  pickColor(container, '#ff8800')
  await waitFor(() => expect(saveButton()).toBeEnabled())
  clickSave()
  await waitFor(() => expect(h.save).toHaveBeenCalledWith({ ribbon: { color: '#ff8800' } }, ACCESS))
  expect(h.save).toHaveBeenCalledTimes(1)
  expect(screen.queryByTestId('alert')).toBeNull()
})

it('saves the latest picked color when saving right after choosing it', async () => {
  const { container } = setup()
  changeName(container, 'Local store edited')
  pickColor(container, '#ff8800')
  clickSave()
  await waitFor(() => expect(h.save).toHaveBeenCalledWith({
    name: 'Local store edited',
    ribbon: { color: '#ff8800' }
  }, ACCESS))
  expect(h.save).toHaveBeenCalledTimes(1)
})

it('keeps an unresolved ribbon shape error after a color change until it is corrected', async () => {
  const { container } = setup({
    ...businessFixture,
    ribbon: { id: 91, enabled: true, text: 'Local special', color: '#7b2cbf' }
  })
  changeName(container, 'Local store edited')
  clickSave()
  await waitFor(() => expect(screen.getByText('The Ribbon shape field is required')).toBeTruthy())
  expect(h.save).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
  pickColor(container, '#ff8800')
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 900)) })
  expect(h.formMethods.errors.shape).toBeTruthy()
  expect(h.save).not.toHaveBeenCalled()
  fireEvent.click(shapeBoxes(container)[1])
  clickSave()
  await waitFor(() => expect(h.save).toHaveBeenCalledWith({
    name: 'Local store edited',
    ribbon: { color: '#ff8800', shape: 'rectangle_round' }
  }, ACCESS))
  expect(h.save).toHaveBeenCalledTimes(1)
})

it('sends only the edited ribbon shape in the save payload', async () => {
  const { container } = setup()
  fireEvent.click(shapeBoxes(container)[1])
  clickSave()
  await waitFor(() => expect(h.save).toHaveBeenCalledWith({ ribbon: { shape: 'rectangle_round' } }, ACCESS))
  expect(h.save).toHaveBeenCalledTimes(1)
  expect(screen.queryByTestId('alert')).toBeNull()
})

it('keeps the ribbon valid across a failed save retry and a later successful save', async () => {
  const { container, onSuccess } = setup()
  h.save.mockRejectedValueOnce(new Error('Network Error'))
  changeName(container, 'Local store edited')
  clickSave()
  await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1))
  expect(h.save).toHaveBeenCalledWith({ name: 'Local store edited' }, ACCESS)
  expect(pickedHexValue(container)).toBe('7b2cbf')
  await waitFor(() => expect(screen.getByText('Network Error')).toBeTruthy())
  fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
  clickSave()
  await waitFor(() => expect(h.save).toHaveBeenCalledTimes(2))
  expect(h.save).toHaveBeenNthCalledWith(2, { name: 'Local store edited' }, ACCESS)
  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(saveButton()).toBeDisabled())
  changeName(container, 'Local store renamed again')
  clickSave()
  await waitFor(() => expect(h.save).toHaveBeenNthCalledWith(3, { name: 'Local store renamed again' }, ACCESS))
  expect(screen.queryByTestId('alert')).toBeNull()
})
