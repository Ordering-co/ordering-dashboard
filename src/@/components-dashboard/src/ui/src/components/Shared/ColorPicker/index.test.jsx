import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi, it, expect, beforeEach, afterEach } from 'vitest'
import { ThemeProvider } from 'styled-components'
import theme from '~/theme.json'
import { ColorPicker } from './index'
import { AppTheme } from '../../MyProducts/BasicAppSettings/AppTheme'

const h = vi.hoisted(() => ({
  onChangeColor: vi.fn(),
  updateTheme: vi.fn(),
  updateAppValues: vi.fn(),
  showToast: vi.fn()
}))

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback],
  useToast: () => [{}, { showToast: h.showToast }],
  ToastType: { Success: 'SUCCESS', Error: 'ERROR', Info: 'INFO' }
}))

vi.mock('../../Shared', async () => {
  const { ColorPicker } = await vi.importActual('../../Shared/ColorPicker')
  return { ColorPicker }
})

const renderPicker = (props) => render(
  <ThemeProvider theme={theme}>
    <ColorPicker defaultColor='#123456' onChangeColor={h.onChangeColor} {...props} />
  </ThemeProvider>
)

const openPicker = (container) => {
  if (screen.queryByLabelText('hex')) return
  fireEvent.click(container.querySelector('[class*=ColorBox]').parentElement)
}
const hexInput = () => screen.getByLabelText('hex')
const pick = (container, hex) => {
  openPicker(container)
  fireEvent.change(hexInput(), { target: { value: hex } })
}
const advance = async (ms) => act(async () => { vi.advanceTimersByTime(ms) })

beforeEach(() => {
  vi.useFakeTimers()
  h.updateTheme.mockResolvedValue({ error: false, result: { id: 5 } })
})

afterEach(() => {
  vi.useRealTimers()
})

it('holds the callback for 750ms and reports only the newest color once', async () => {
  const { container } = renderPicker()
  pick(container, '#ff8800')
  await advance(749)
  expect(h.onChangeColor).not.toHaveBeenCalled()
  pick(container, '#aabbcc')
  await advance(749)
  expect(h.onChangeColor).not.toHaveBeenCalled()
  await advance(1)
  expect(h.onChangeColor).toHaveBeenCalledTimes(1)
  expect(h.onChangeColor).toHaveBeenCalledWith('#aabbcc')
})

it('notifies immediately when debounce is disabled and does not fire again at 750ms', async () => {
  const { container } = renderPicker({ debounce: false })
  pick(container, '#ff8800')
  expect(h.onChangeColor).toHaveBeenCalledTimes(1)
  expect(h.onChangeColor).toHaveBeenCalledWith('#ff8800')
  await advance(1000)
  expect(h.onChangeColor).toHaveBeenCalledTimes(1)
})

it('cancels a pending debounced callback when the picker unmounts', async () => {
  const { container, unmount } = renderPicker()
  pick(container, '#ff8800')
  unmount()
  await advance(1000)
  expect(h.onChangeColor).not.toHaveBeenCalled()
})

it('keeps the AppTheme consumer on the 750ms debounce with its existing payload', async () => {
  const app = { baseActions: [{ id: 5, text_content: '#123456' }] }
  const appTheme = [{ id: 5, name: 'Primary', text_content: '#123456' }]
  const { container } = render(
    <ThemeProvider theme={theme}>
      <AppTheme
        app={app}
        appTheme={appTheme}
        updateTheme={h.updateTheme}
        updateAppValues={h.updateAppValues}
      />
    </ThemeProvider>
  )
  pick(container, '#ff8800')
  await advance(749)
  expect(h.updateTheme).not.toHaveBeenCalled()
  await advance(1)
  expect(h.updateTheme).toHaveBeenCalledTimes(1)
  expect(h.updateTheme).toHaveBeenCalledWith({
    id: 5,
    type: 'colors',
    body: JSON.stringify({ text_content: '#ff8800' })
  })
})
