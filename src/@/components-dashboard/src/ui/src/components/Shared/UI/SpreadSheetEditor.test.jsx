/* eslint-disable import/first */
import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

const runtime = vi.hoisted(() => ({
  hotInstance: null,
  hotTableProps: null,
  hotTableRenders: 0,
  showToast: null
}))

vi.mock('@handsontable/react', async () => {
  const ReactModule = await vi.importActual('react')
  return {
    HotColumn: props => (
      <div
        data-testid='hot-column'
        data-code={props.data}
        data-readonly={String(Boolean(props.readOnly))}
        data-title={props.title}
        data-type={props.type}
      />
    ),
    HotTable: ReactModule.forwardRef((props, ref) => {
      runtime.hotTableProps = props
      runtime.hotTableRenders += 1
      ReactModule.useImperativeHandle(ref, () => ({ hotInstance: runtime.hotInstance }))
      return (
        <div className='handsontable' data-testid='hot-table'>
          <table><tbody><tr><td>Grid</td></tr></tbody></table>
          {props.children}
        </div>
      )
    })
  }
})

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (key, fallback) => fallback || `translated:${key}`],
  useToast: () => [null, { showToast: runtime.showToast }],
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' }
}))

import SpreadSheetEditor from './SpreadSheetEditor'

const lightTheme = createDashboardTheme(theme)
const rtlDarkTheme = { ...createDashboardTheme(theme, { mode: 'dark' }), rtl: true }
const renderWithTheme = (content, currentTheme = lightTheme) => render(
  <ThemeProvider theme={currentTheme}>{content}</ThemeProvider>
)

const createHotInstance = () => {
  const plugin = { paste: vi.fn() }
  return {
    getPlugin: vi.fn(() => plugin),
    listen: vi.fn(),
    plugin,
    toVisualColumn: vi.fn(column => column),
    updateSettings: vi.fn()
  }
}

const clipboardItem = (parts) => ({
  types: Object.keys(parts),
  getType: vi.fn(type => Promise.resolve({ text: () => Promise.resolve(parts[type]) }))
})

beforeEach(() => {
  runtime.hotInstance = createHotInstance()
  runtime.hotTableProps = null
  runtime.hotTableRenders = 0
  runtime.showToast = vi.fn()
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { read: vi.fn(() => Promise.resolve([])), readText: vi.fn(() => Promise.resolve('')) }
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('L2d-C12 SpreadSheetEditor', () => {
  it('preserves memo export, settings, headers and owner-scoped context menu container', async () => {
    expect(SpreadSheetEditor.$$typeof).toBe(Symbol.for('react.memo'))
    const headerItems = [
      { title: 'ID', readOnly: true, code: 'id', type: 'numeric' },
      { title: 'Name', readOnly: false, code: 'name', type: 'text' }
    ]
    const data = [{ id: 1, name: 'Product' }]
    const rendered = renderWithTheme(
      <SpreadSheetEditor
        headerItems={headerItems}
        hotTableData={data}
        isRedo
        isRemove
        isUndo
      />,
      rtlDarkTheme
    )

    const root = screen.getByRole('region', { name: 'Spreadsheet' })
    expect(root).toHaveAttribute('data-slot', 'spreadsheet')
    expect(root).toHaveAttribute('dir', 'rtl')
    expect(root.querySelector('[data-slot="spreadsheet-scrollport"]')).toBeInTheDocument()
    expect(getComputedStyle(root).getPropertyValue('--od-entity-selector-surface')).toBe(rtlDarkTheme.ordering.semantic.surface.default)
    expect(runtime.hotTableProps.data).toBe(data)
    const menuHost = document.body.querySelector('[data-slot="spreadsheet-menu-host"]')
    expect(menuHost).toHaveAttribute('dir', 'rtl')
    expect(getComputedStyle(menuHost).getPropertyValue('--od-entity-selector-surface')).toBe(rtlDarkTheme.ordering.semantic.surface.default)
    await waitFor(() => expect(runtime.hotTableProps.settings.contextMenu.uiContainer).toBe(menuHost))
    expect(runtime.hotTableProps.settings).toMatchObject({
      licenseKey: 'non-commercial-and-evaluation',
      autoRowSize: false,
      autoColumnSize: false,
      width: '100%',
      height: '100%',
      minSpareRows: 1,
      stretchH: 'all',
      copyPaste: true,
      undo: true
    })
    expect(Object.keys(runtime.hotTableProps.settings.contextMenu.items)).toEqual(['copy', 'undo', 'redo', 'remove_row', 'paste'])
    expect(Object.fromEntries(Object.entries(runtime.hotTableProps.settings.contextMenu.items).map(([key, item]) => [key, item.name]))).toEqual({
      copy: 'Copy',
      undo: 'Undo',
      redo: 'Redo',
      remove_row: 'Remove row',
      paste: 'Paste'
    })
    const columns = screen.getAllByTestId('hot-column')
    expect(columns[0]).toHaveAttribute('data-title', 'ID')
    expect(columns[0]).toHaveAttribute('data-readonly', 'true')
    expect(columns[0]).toHaveAttribute('data-code', 'id')
    expect(columns[0]).toHaveAttribute('data-type', 'numeric')
    expect(columns[1]).toHaveAttribute('data-title', 'Name')
    rendered.unmount()
    expect(document.body.querySelector('[data-slot="spreadsheet-menu-host"]')).not.toBeInTheDocument()
  })

  it('keeps hotInstance callback payloads only on the original callbacks', () => {
    const callbacks = {
      handleAfterSectionEnd: vi.fn(),
      handleItemChange: vi.fn(),
      handleoutsideClickDeselects: vi.fn(),
      handleRowRemove: vi.fn()
    }
    renderWithTheme(<SpreadSheetEditor {...callbacks} hotTableData={[]} />)
    const event = new MouseEvent('click')
    runtime.hotTableProps.afterChange([['name', 'old', 'new']], 'edit')
    runtime.hotTableProps.beforeRemoveRow(2, 3, [2, 3, 4])
    runtime.hotTableProps.afterSelectionEnd(1, 2, 3, 4)
    runtime.hotTableProps.outsideClickDeselects(event)
    expect(callbacks.handleItemChange).toHaveBeenCalledWith([['name', 'old', 'new']], 'edit', runtime.hotInstance)
    expect(callbacks.handleRowRemove).toHaveBeenCalledWith(2, 3, [2, 3, 4], runtime.hotInstance)
    expect(callbacks.handleAfterSectionEnd).toHaveBeenCalledWith(1, 2, 3, 4, runtime.hotInstance)
    expect(callbacks.handleoutsideClickDeselects).toHaveBeenCalledWith(event)
  })

  // redesign D-9 (owner, 2026-10-19): Handsontable cancels the removal when `beforeRemoveRow` returns false
  it('returns what handleRowRemove returns so a host can cancel the removal, and nothing without one', () => {
    const handleRowRemove = vi.fn(() => false)
    const { unmount } = renderWithTheme(<SpreadSheetEditor handleRowRemove={handleRowRemove} hotTableData={[]} />)
    expect(runtime.hotTableProps.beforeRemoveRow(2, 3, [2, 3, 4])).toBe(false)
    handleRowRemove.mockReturnValue(undefined)
    expect(runtime.hotTableProps.beforeRemoveRow(2, 3, [2, 3, 4])).toBeUndefined()
    unmount()
    renderWithTheme(<SpreadSheetEditor hotTableData={[]} />)
    expect(runtime.hotTableProps.beforeRemoveRow(0, 1, [0])).toBeUndefined()
  })

  it('keeps business-product visual readonly/loading rules and safe physical ID rendering', () => {
    runtime.hotInstance.toVisualColumn.mockImplementation(column => column + 5)
    const rendered = renderWithTheme(<SpreadSheetEditor hotTableData={[]} isBusinessProducts />)
    const settings = runtime.hotTableProps.settings
    const physicalId = settings.cells(0, 0, 'id')
    expect(physicalId.readOnly).toBe(false)
    expect(physicalId.renderer).toEqual(expect.any(Function))
    const td = document.createElement('td')
    physicalId.renderer(runtime.hotInstance, td, 0, 0, 'id', '<img src=x onerror=alert(1)>', physicalId)
    expect(td.querySelector('span.product-id')).toHaveTextContent('<img src=x onerror=alert(1)>')
    expect(td.querySelector('img')).not.toBeInTheDocument()
    td.textContent = 'unchanged'
    physicalId.renderer(runtime.hotInstance, td, 0, 0, 'id', null, physicalId)
    expect(td).toHaveTextContent('unchanged')

    runtime.hotInstance.toVisualColumn.mockImplementation(column => column)
    expect(settings.cells(0, 0, 'id').readOnly).toBe(true)
    rendered.rerender(<ThemeProvider theme={lightTheme}><SpreadSheetEditor hotTableData={[]} isBusinessProducts isLoading /></ThemeProvider>)
    expect(runtime.hotTableProps.settings.cells(0, 3, 'price').readOnly).toBe(true)
  })

  it('preserves numeric key filtering including clipboard and AltGr branches', () => {
    renderWithTheme(<SpreadSheetEditor hotTableData={[]} />)
    const beforeKeyDown = runtime.hotTableProps.settings.beforeKeyDown
    const context = {
      getCellMeta: vi.fn(() => ({ type: 'numeric' })),
      getSelectedLast: vi.fn(() => [0, 1])
    }
    const letter = { keyCode: 65, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() }
    beforeKeyDown.call(context, letter)
    expect(letter.preventDefault).toHaveBeenCalledOnce()
    expect(letter.stopImmediatePropagation).toHaveBeenCalledOnce()

    const digit = { keyCode: 53, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() }
    beforeKeyDown.call(context, digit)
    expect(digit.preventDefault).not.toHaveBeenCalled()
    const paste = { ctrlKey: true, keyCode: 86, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() }
    beforeKeyDown.call(context, paste)
    expect(paste.preventDefault).not.toHaveBeenCalled()
    const altGrCopy = { altKey: true, ctrlKey: true, keyCode: 67, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() }
    beforeKeyDown.call(context, altGrCopy)
    expect(altGrCopy.preventDefault).toHaveBeenCalledOnce()

    context.getSelectedLast.mockReturnValue(null)
    beforeKeyDown.call(context, letter)
    expect(letter.preventDefault).toHaveBeenCalledOnce()
    context.getSelectedLast.mockReturnValue([0, 1])
    context.getCellMeta.mockReturnValue({ type: 'text' })
    beforeKeyDown.call(context, letter)
    expect(letter.preventDefault).toHaveBeenCalledOnce()
  })

  it('updates hidden physical columns through the existing instance', async () => {
    const rendered = renderWithTheme(<SpreadSheetEditor hotTableData={[]} hiddenColumns={[1, 3]} />)
    await waitFor(() => expect(runtime.hotInstance.updateSettings).toHaveBeenCalledWith({ hiddenColumns: { columns: [1, 3] } }))
    runtime.hotInstance.updateSettings.mockClear()
    rendered.rerender(<ThemeProvider theme={lightTheme}><SpreadSheetEditor hotTableData={[]} hiddenColumns={[2]} /></ThemeProvider>)
    expect(runtime.hotInstance.updateSettings).toHaveBeenCalledWith({ hiddenColumns: { columns: [2] } })
  })

  // redesign W1 n.º 8 B (owner, 2026-10-21): no background clipboard poll. Ctrl/Cmd+V is Handsontable's own paste
  // event; the context-menu Paste reads the clipboard when it is clicked.
  it('does not poll the clipboard in the background, and Paste stays enabled', async () => {
    vi.useFakeTimers()
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    renderWithTheme(<SpreadSheetEditor hotTableData={[]} />)
    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })
    expect(setIntervalSpy.mock.calls.filter(call => call[1] === 500)).toHaveLength(0)
    expect(navigator.clipboard.readText).not.toHaveBeenCalled()
    expect(navigator.clipboard.read).not.toHaveBeenCalled()
    const paste = runtime.hotTableProps.settings.contextMenu.items.paste
    expect(paste.disabled === undefined || paste.disabled() !== true).toBe(true)
  })

  it('reads text/html and text/plain when Paste is clicked, so a table from Excel or Sheets keeps its cells', async () => {
    const html = '<table><tr><td>A</td><td>1</td></tr></table>'
    navigator.clipboard.read.mockResolvedValue([clipboardItem({ 'text/html': html, 'text/plain': 'A\t1' })])
    renderWithTheme(<SpreadSheetEditor hotTableData={[]} />)
    const rendersBefore = runtime.hotTableRenders
    await act(async () => {
      await runtime.hotTableProps.settings.contextMenu.items.paste.callback()
    })
    expect(navigator.clipboard.read).toHaveBeenCalledOnce()
    expect(runtime.hotInstance.listen).toHaveBeenCalledOnce()
    expect(runtime.hotInstance.getPlugin).toHaveBeenCalledWith('copyPaste')
    expect(runtime.hotInstance.plugin.paste).toHaveBeenCalledWith('A\t1', html)
    // reading the clipboard must not re-render the grid (it would close an open context menu)
    expect(runtime.hotTableRenders).toBe(rendersBefore)
    expect(runtime.showToast).not.toHaveBeenCalled()
  })

  it('pastes plain text when the clipboard has no html, and falls back to readText without read()', async () => {
    navigator.clipboard.read.mockResolvedValue([clipboardItem({ 'text/plain': 'B\t2' })])
    renderWithTheme(<SpreadSheetEditor hotTableData={[]} />)
    await act(async () => {
      await runtime.hotTableProps.settings.contextMenu.items.paste.callback()
    })
    expect(runtime.hotInstance.plugin.paste).toHaveBeenLastCalledWith('B\t2')

    delete navigator.clipboard.read
    navigator.clipboard.readText.mockResolvedValue('C\t3')
    await act(async () => {
      await runtime.hotTableProps.settings.contextMenu.items.paste.callback()
    })
    expect(navigator.clipboard.readText).toHaveBeenCalledOnce()
    expect(runtime.hotInstance.plugin.paste).toHaveBeenLastCalledWith('C\t3')
  })

  it('tells the person to use Ctrl/Cmd+V when the browser refuses the clipboard, and pastes nothing', async () => {
    navigator.clipboard.read.mockRejectedValue(new Error('clipboard denied'))
    navigator.clipboard.readText.mockRejectedValue(new Error('clipboard denied'))
    renderWithTheme(<SpreadSheetEditor hotTableData={[]} />)
    expect(Object.keys(runtime.hotTableProps.settings.contextMenu.items)).toEqual(['copy', 'paste'])
    await act(async () => {
      await runtime.hotTableProps.settings.contextMenu.items.paste.callback()
    })
    expect(runtime.hotInstance.plugin.paste).not.toHaveBeenCalled()
    expect(runtime.showToast).toHaveBeenCalledWith('INFO', 'Your browser blocked the clipboard. Paste with Ctrl+V (⌘V on a Mac).')
  })

  it('does not emit callbacks when the original hotInstance gate is absent', () => {
    runtime.hotInstance = null
    const handleItemChange = vi.fn()
    const handleoutsideClickDeselects = vi.fn()
    renderWithTheme(<SpreadSheetEditor hotTableData={[]} handleItemChange={handleItemChange} handleoutsideClickDeselects={handleoutsideClickDeselects} />)
    fireEvent.click(screen.getByTestId('hot-table'))
    runtime.hotTableProps.afterChange([], 'edit')
    runtime.hotTableProps.outsideClickDeselects(new MouseEvent('click'))
    expect(handleItemChange).not.toHaveBeenCalled()
    expect(handleoutsideClickDeselects).not.toHaveBeenCalled()
  })
})
