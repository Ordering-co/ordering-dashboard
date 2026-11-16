import React, { createRef, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Dialog } from '../Dialog'
import { LeaveDialog, LeaveGuardContext, useLeaveGuard, useLeaveGuardHost } from '../LeaveGuard'
import { SectionSplit, useSectionSplit } from '../SectionSplit'
import { useEditorPanel } from '../useEditorPanel'
import { hasActiveDialogLayer } from '../../UI/dialog-layer'
import { captureSidebarDismissal, ownsCapturedSidebarDismissal, registerSidebar } from '../../UI/sidebar-layer'

// redesign Tiendas 2.B: the list and detail of a section. jsdom resolves no CSS variable and has no layout, so
// tokenPx() and the measured sizes are driven by a getBoundingClientRect mock: a probe element carries `inline-size:var(--token)`
// in its inline style and the mock answers with the token's value; the root of the piece answers `rootRect`.
const CSS = readFileSync(path.resolve(__dirname, '../section-split.css'), 'utf8')

const TOKENS = { '--od-x-search': 280, '--od-x-panel-narrow': 440, '--od-space-4': 16 } // minSplit = 736
const originalRect = Element.prototype.getBoundingClientRect
const originalWidth = window.innerWidth
const originalHeight = window.innerHeight
let rootRect
let overrides

const rectOf = ({ top = 0, left = 0, width = 0, height = 0 }) => (
  { top, left, width, height, right: left + width, bottom: top + height, x: left, y: top }
)

beforeEach(() => {
  rootRect = { width: 1200 }
  overrides = new Map()
  window.innerWidth = 1440
  Element.prototype.getBoundingClientRect = function () {
    const cssText = this.style?.cssText || ''
    const hit = Object.entries(TOKENS).find(([name]) => cssText.includes(`var(${name})`))
    if (hit) return rectOf({ width: hit[1] })
    if (overrides.has(this)) return rectOf(overrides.get(this))
    if (this.classList?.contains('odc-section-split')) return rectOf(rootRect)
    return rectOf({})
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  Element.prototype.getBoundingClientRect = originalRect
  window.innerWidth = originalWidth
  window.innerHeight = originalHeight
  document.body.innerHTML = ''
})

const resizeTo = width => act(() => {
  window.innerWidth = width
  window.dispatchEvent(new Event('resize'))
})

const esc = target => fireEvent.keyDown(target, { key: 'Escape', code: 'Escape' })
const silence = () => vi.spyOn(console, 'error').mockImplementation(() => {})

// ── Fixtures ──
const Rows = ({ onOpen, version = 0 }) => (
  <ul>
    {['a', 'b', 'c'].map(key => (
      <li key={key} data-section-split-key={key}>
        <button type='button' key={version} onClick={() => onOpen(key)}>{`Row ${key}`}</button>
      </li>
    ))}
  </ul>
)

const Harness = ({ initial = null, onClose, renderList, detail, splitRef, ...props }) => {
  const [current, setCurrent] = useState(initial)
  const [version, setVersion] = useState(0)
  return (
    <SectionSplit
      ref={splitRef}
      open={current != null}
      detailKey={current ?? 'new'}
      onClose={() => {
        onClose?.()
        setCurrent(null)
      }}
      detailTitle={`Zone ${current}`}
      closeLabel='Close zone'
      backLabel='Zones'
      list={renderList ? renderList(setCurrent) : <Rows onOpen={setCurrent} version={version} />}
      detail={detail ?? (
        <div>
          <input aria-label='Zone name' />
          <button type='button' onClick={() => setCurrent('c')}>Go to c</button>
          <button type='button' onClick={() => setVersion(v => v + 1)}>Refresh list</button>
        </div>
      )}
      {...props}
    />
  )
}

const Controlled = ({ open = false, k = 'a', ...props }) => (
  <>
    <button type='button'>Outside</button>
    <SectionSplit
      open={open}
      detailKey={k}
      onClose={() => {}}
      detailTitle={`Zone ${k}`}
      closeLabel='Close zone'
      backLabel='Zones'
      list={<Rows onOpen={() => {}} />}
      detail={<div><button type='button'>Inner</button></div>}
      {...props}
    />
  </>
)

const root = () => document.querySelector('.odc-section-split')
const listEl = () => document.querySelector('.odc-section-split-list')
const detailEl = () => document.querySelector('.odc-section-split-detail')
const rowButton = key => screen.getByText(`Row ${key}`, { selector: 'button' }) // by text: a hidden list is out of the roles
const openRow = async (user, key = 'a') => user.click(rowButton(key))

describe('Product SectionSplit — its names', () => {
  it('throws a clear Error without closeLabel', () => {
    silence()
    expect(() => render(<Harness closeLabel={undefined} />)).toThrow('SectionSplit needs a closeLabel')
  })

  it('throws a clear Error without backLabel', () => {
    silence()
    expect(() => render(<Harness backLabel={undefined} />)).toThrow('SectionSplit needs a backLabel')
  })

  it('throws without detailTitle when a record is open', () => {
    silence()
    expect(() => render(<Harness initial='a' detailTitle={undefined} />)).toThrow('SectionSplit needs a detailTitle')
  })

  it('does not need a detailTitle while closed', () => {
    expect(() => render(<Harness detailTitle={undefined} />)).not.toThrow()
    expect(detailEl()).toBeNull()
  })

  it('paints empty labels and title without throwing (an empty translation is not a missing one)', () => {
    render(<Harness initial='a' detailTitle='' closeLabel='' backLabel='' />)
    expect(document.querySelector('.odc-section-split-title').textContent).toBe('')
    expect(document.querySelector('.odc-section-split-head [data-icon-only]')).toHaveAttribute('aria-label', '')
    resizeTo(1024)
    expect(document.querySelector('.odc-section-split-back button').textContent).toBe('')
  })

  it('names the detail by its title (h3) and keeps the key of the record', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openRow(user, 'b')
    const region = screen.getByRole('region', { name: 'Zone b' })
    expect(region).toBe(detailEl())
    expect(region.tagName).toBe('SECTION')
    expect(region).toHaveAttribute('data-key', 'b')
    expect(region).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('heading', { level: 3, name: 'Zone b' })).toBeInTheDocument()
  })

  it('draws no text of its own', () => {
    const { container } = render(<Harness initial='a' />)
    expect(container.textContent).toBe('Row aRow bRow cZone aGo to cRefresh list')
  })
})

describe('Product SectionSplit — mode', () => {
  it('goes side by side from the default split breakpoint (1440)', () => {
    render(<Harness initial='a' />)
    expect(root()).toHaveAttribute('data-mode', 'split')
    expect(root()).toHaveAttribute('data-view', 'split')
  })

  it('stacks below it (1024)', () => {
    window.innerWidth = 1024
    render(<Harness initial='a' />)
    expect(root()).toHaveAttribute('data-mode', 'stack')
    expect(root()).toHaveAttribute('data-view', 'detail')
  })

  it('splitFrom is opt-in: the same 1024 room stacks by default and splits with splitFrom={1000}', () => {
    window.innerWidth = 1024
    const { unmount } = render(<Harness initial='a' />)
    expect(root()).toHaveAttribute('data-mode', 'stack')
    unmount()
    render(<Harness initial='a' splitFrom={1000} />)
    expect(root()).toHaveAttribute('data-mode', 'split')
  })

  it('splitFrom is a floor: a room under it stacks', () => {
    window.innerWidth = 990
    render(<Harness initial='a' splitFrom={1000} />)
    expect(root()).toHaveAttribute('data-mode', 'stack')
  })

  it('stacks when its own root is narrower than a list (280) plus the narrow detail (440) plus a gap (16), even at 1440', () => {
    rootRect = { width: 735 }
    render(<Harness initial='a' />)
    expect(root()).toHaveAttribute('data-mode', 'stack')
  })

  it('goes side by side when its root fits exactly 736', () => {
    rootRect = { width: 736 }
    render(<Harness initial='a' />)
    expect(root()).toHaveAttribute('data-mode', 'split')
  })

  it('follows the window when it is resized', () => {
    render(<Harness initial='a' />)
    expect(root()).toHaveAttribute('data-mode', 'split')
    resizeTo(1024)
    expect(root()).toHaveAttribute('data-mode', 'stack')
    resizeTo(1440)
    expect(root()).toHaveAttribute('data-mode', 'split')
  })

  it('follows the measured root when the ResizeObserver fires', () => {
    const callbacks = []
    const notify = entries => callbacks.forEach(callback => callback(entries))
    class FakeResizeObserver {
      constructor (callback) { callbacks.push(callback) }
      observe () {}
      disconnect () {}
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    try {
      render(<Harness initial='a' />)
      expect(root()).toHaveAttribute('data-mode', 'split')
      act(() => notify([{ contentRect: { width: 500 } }]))
      expect(root()).toHaveAttribute('data-mode', 'stack')
      act(() => notify([{ contentRect: { width: 900 } }]))
      expect(root()).toHaveAttribute('data-mode', 'split')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('stays in the list view with a closed record, in either mode', () => {
    const { unmount } = render(<Harness />)
    expect(root()).toHaveAttribute('data-view', 'list')
    unmount()
    window.innerWidth = 1024
    render(<Harness />)
    expect(root()).toHaveAttribute('data-view', 'list')
  })

  it('reads the direction from the product dir', () => {
    render(<ThemeProvider theme={{ rtl: true }}><Harness /></ThemeProvider>)
    expect(root()).toHaveAttribute('dir', 'rtl')
    expect(root()).toHaveClass('odc-root')
  })
})

describe('Product SectionSplit — views', () => {
  it('closed: the list is visible and there is no detail', () => {
    render(<Harness />)
    expect(listEl()).not.toHaveAttribute('hidden')
    expect(listEl()).not.toHaveAttribute('inert')
    expect(detailEl()).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('side by side: both are shown, with the X and no back button', () => {
    render(<Harness initial='a' />)
    expect(listEl()).not.toHaveAttribute('hidden')
    expect(listEl()).not.toHaveAttribute('inert')
    expect(detailEl()).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Close zone' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zones' })).toBeNull()
    expect(document.querySelector('.odc-section-split-back')).toBeNull()
  })

  it('stacked: the list stays mounted but hidden and inert; the detail has a back button and no X', () => {
    window.innerWidth = 1024
    render(<Harness initial='a' />)
    expect(listEl()).toHaveAttribute('hidden')
    expect(listEl()).toHaveAttribute('inert')
    expect(listEl()).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('button', { name: 'Zones' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close zone' })).toBeNull()
  })

  it('un-hides the list when the detail closes', async () => {
    window.innerWidth = 1024
    const user = userEvent.setup()
    render(<Harness initial='a' />)
    await user.click(screen.getByRole('button', { name: 'Zones' }))
    expect(listEl()).not.toHaveAttribute('hidden')
    expect(listEl()).not.toHaveAttribute('inert')
    expect(detailEl()).toBeNull()
  })

  it('puts the header actions between the title and the X, and the footer at the bottom of the detail', () => {
    render(<Harness initial='a' headerActions={<button type='button'>More</button>} footer={<div>Save bar</div>} />)
    const head = document.querySelector('.odc-section-split-head')
    expect([...head.children].map(node => node.className.split(' ')[0] || node.tagName)).toEqual([
      'odc-section-split-title', 'odc-section-split-actions', 'odc-btn'
    ])
    expect(detailEl().lastElementChild).toHaveClass('odc-section-split-foot')
    expect(detailEl().lastElementChild).toHaveTextContent('Save bar')
    expect(document.querySelector('.odc-section-split-body')).toContainElement(screen.getByLabelText('Zone name'))
  })

  it('omits the actions and the foot when not given', () => {
    render(<Harness initial='a' />)
    expect(document.querySelector('.odc-section-split-actions')).toBeNull()
    expect(document.querySelector('.odc-section-split-foot')).toBeNull()
  })

  it('answers a closed default context outside a SectionSplit', () => {
    let seen
    const Probe = () => {
      seen = useSectionSplit()
      return null
    }
    render(<Probe />)
    expect(seen.open).toBe(false)
    expect(seen.mode).toBe('split')
    const proceed = vi.fn()
    seen.requestLeave(proceed)
    expect(proceed).toHaveBeenCalledTimes(1)
    expect(typeof seen.registerCloseGuard(() => true)).toBe('function')
  })

  it('tells the content its mode and whether a record is open', async () => {
    let seen
    const Probe = () => {
      seen = useSectionSplit()
      return <p>{`${seen.mode}|${seen.open}`}</p>
    }
    const { rerender } = render(<Controlled detail={<Probe />} />)
    expect(seen).toBeUndefined()
    rerender(<Controlled open detail={<Probe />} />)
    expect(screen.getByText('split|true')).toBeInTheDocument()
    resizeTo(1024)
    expect(screen.getByText('stack|true')).toBeInTheDocument()
  })
})

describe('Product SectionSplit — onExtendChange', () => {
  it('is not called on a closed first render', () => {
    const onExtendChange = vi.fn()
    render(<Harness onExtendChange={onExtendChange} />)
    expect(onExtendChange).not.toHaveBeenCalled()
  })

  it('is called with true when a record opens and with false when it closes', async () => {
    const onExtendChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onExtendChange={onExtendChange} />)
    await openRow(user)
    expect(onExtendChange.mock.calls).toEqual([[true]])
    await user.click(screen.getByRole('button', { name: 'Close zone' }))
    expect(onExtendChange.mock.calls).toEqual([[true], [false]])
  })

  it('does not repeat while the record changes', async () => {
    const onExtendChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onExtendChange={onExtendChange} />)
    await openRow(user)
    await user.click(rowButton('b'))
    expect(onExtendChange.mock.calls).toEqual([[true]])
  })

  it('is called with true on a first render that is already open', () => {
    const onExtendChange = vi.fn()
    render(<Harness initial='a' onExtendChange={onExtendChange} />)
    expect(onExtendChange.mock.calls).toEqual([[true]])
  })

  it('releases it with false when it unmounts while open, and only then', () => {
    const onExtendChange = vi.fn()
    const { unmount } = render(<Harness initial='a' onExtendChange={onExtendChange} />)
    unmount()
    expect(onExtendChange.mock.calls).toEqual([[true], [false]])
  })

  it('does not call it on unmount when it was already closed', async () => {
    const onExtendChange = vi.fn()
    const user = userEvent.setup()
    const { unmount } = render(<Harness onExtendChange={onExtendChange} />)
    await openRow(user)
    await user.click(screen.getByRole('button', { name: 'Close zone' }))
    onExtendChange.mockClear()
    unmount()
    expect(onExtendChange).not.toHaveBeenCalled()
  })

  it('calls the latest callback without re-running', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(<Controlled onExtendChange={first} />)
    rerender(<Controlled onExtendChange={second} />)
    rerender(<Controlled open onExtendChange={second} />)
    expect(first).not.toHaveBeenCalled()
    expect(second.mock.calls).toEqual([[true]])
  })
})

describe('Product SectionSplit — close guards', () => {
  it('the X goes through closeGuard: it blocks onClose and receives proceed', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const closeGuard = vi.fn(() => true)
    render(<Harness initial='a' onClose={onClose} closeGuard={closeGuard} />)
    await user.click(screen.getByRole('button', { name: 'Close zone' }))
    expect(closeGuard).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(detailEl()).not.toBeNull()
    const proceed = closeGuard.mock.calls[0][0]
    expect(typeof proceed).toBe('function')
    act(() => proceed())
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(detailEl()).toBeNull()
  })

  it('closes straight away when the guard does not take over', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const closeGuard = vi.fn(() => false)
    render(<Harness initial='a' onClose={onClose} closeGuard={closeGuard} />)
    await user.click(screen.getByRole('button', { name: 'Close zone' }))
    expect(closeGuard).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('the back button (stacked) goes through the guard too', async () => {
    window.innerWidth = 1024
    const user = userEvent.setup()
    const onClose = vi.fn()
    const closeGuard = vi.fn(() => true)
    render(<Harness initial='a' onClose={onClose} closeGuard={closeGuard} />)
    await user.click(screen.getByRole('button', { name: 'Zones' }))
    expect(closeGuard).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  const GuardChild = ({ guard }) => {
    const { registerCloseGuard } = useSectionSplit()
    useEffect(() => registerCloseGuard(guard), [registerCloseGuard, guard])
    return null
  }
  const GuardedDetail = ({ guard }) => {
    const [on, setOn] = useState(true)
    return (
      <div>
        {on && <GuardChild guard={guard} />}
        <button type='button' onClick={() => setOn(false)}>Drop guard</button>
      </div>
    )
  }

  it('a guard registered by a child through useSectionSplit() blocks the close, and unregisters on unmount', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const guard = vi.fn(() => true)
    render(<Harness initial='a' onClose={onClose} detail={<GuardedDetail guard={guard} />} />)
    await user.click(screen.getByRole('button', { name: 'Close zone' }))
    expect(guard).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Drop guard' }))
    await user.click(screen.getByRole('button', { name: 'Close zone' }))
    expect(guard).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('registerCloseGuard returns the function that unregisters', () => {
    const splitRef = createRef()
    let register
    const Grab = () => {
      register = useSectionSplit().registerCloseGuard
      return null
    }
    const onClose = vi.fn()
    render(<Harness initial='a' onClose={onClose} splitRef={splitRef} detail={<Grab />} />)
    const guard = vi.fn(() => true)
    const unregister = register(guard)
    act(() => splitRef.current.requestClose())
    expect(guard).toHaveBeenCalledTimes(1)
    unregister()
    act(() => splitRef.current.requestClose())
    expect(guard).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('exposes requestClose and requestLeave through the ref', () => {
    const splitRef = createRef()
    render(<Harness initial='a' splitRef={splitRef} />)
    expect(Object.keys(splitRef.current).sort()).toEqual(['requestClose', 'requestLeave'])
  })

  it('requestLeave(proceed) runs proceed when no guard takes over', () => {
    const splitRef = createRef()
    const onClose = vi.fn()
    const proceed = vi.fn()
    render(<Harness initial='a' onClose={onClose} splitRef={splitRef} />)
    act(() => splitRef.current.requestLeave(proceed))
    expect(proceed).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('requestLeave(proceed) hands proceed to the guard and runs nothing else when it takes over', () => {
    const splitRef = createRef()
    const proceed = vi.fn()
    const closeGuard = vi.fn(() => true)
    render(<Harness initial='a' closeGuard={closeGuard} splitRef={splitRef} />)
    act(() => splitRef.current.requestLeave(proceed))
    expect(closeGuard).toHaveBeenCalledWith(proceed, undefined)
    expect(proceed).not.toHaveBeenCalled()
  })

  it('runs the closeGuard prop first, then the registered ones in order; the first that takes over wins', () => {
    const splitRef = createRef()
    const calls = []
    let register
    const Grab = () => {
      register = useSectionSplit().registerCloseGuard
      return null
    }
    const closeGuard = vi.fn(() => { calls.push('prop'); return false })
    render(<Harness initial='a' closeGuard={closeGuard} splitRef={splitRef} detail={<Grab />} />)
    register(() => { calls.push('one'); return false })
    register(() => { calls.push('two'); return true })
    register(() => { calls.push('three'); return true })
    const proceed = vi.fn()
    act(() => splitRef.current.requestLeave(proceed))
    expect(calls).toEqual(['prop', 'one', 'two'])
    expect(proceed).not.toHaveBeenCalled()
  })

  it('reads the latest onClose and closeGuard without re-registering', () => {
    const splitRef = createRef()
    const first = vi.fn()
    const second = vi.fn()
    const Wrapper = ({ onClose }) => (
      <SectionSplit ref={splitRef} open detailKey='a' onClose={onClose} detailTitle='Zone a' closeLabel='Close zone' backLabel='Zones' list={null} detail={null} />
    )
    const { rerender } = render(<Wrapper onClose={first} />)
    const handle = splitRef.current
    rerender(<Wrapper onClose={second} />)
    act(() => splitRef.current.requestClose())
    expect(splitRef.current).toBe(handle)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})

// A stand-in for the editor panel of the store (useEditorPanel) around the piece.
const EditorPanel = ({ onClose, children }) => {
  const ref = useRef(null)
  useEditorPanel({ open: true, panelRef: ref, onClose, resetKey: 'store' })
  return <div ref={ref} tabIndex={-1} data-testid='editor'>{children}</div>
}

// A stand-in for the legacy SideBar (U/SideBar at >= 1000): fixed in the body, in the sidebar layer, closes on its own Escape.
const LegacySideBar = ({ onClose }) => {
  const ref = useRef(null)
  useEffect(() => {
    const unregister = registerSidebar(ref)
    const capture = event => captureSidebarDismissal(event, hasActiveDialogLayer())
    const onKey = event => {
      if (!ownsCapturedSidebarDismissal(event, ref)) return
      if (event.code === 'Escape') onClose()
    }
    document.addEventListener('keydown', capture, true)
    document.addEventListener('keydown', onKey)
    return () => {
      unregister()
      document.removeEventListener('keydown', capture, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [])
  return createPortal(<aside ref={ref} data-testid='legacy'><button type='button'>Legacy action</button></aside>, document.body)
}

const WithLegacy = () => {
  const [on, setOn] = useState(false)
  return (
    <div>
      <button type='button' onClick={() => setOn(true)}>Open legacy</button>
      {on && <LegacySideBar onClose={() => setOn(false)} />}
    </div>
  )
}

describe('Product SectionSplit — Escape', () => {
  it('closes the detail through the guards', () => {
    const onClose = vi.fn()
    render(<Harness initial='a' onClose={onClose} />)
    esc(detailEl())
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(detailEl()).toBeNull()
  })

  it('goes through closeGuard', () => {
    const onClose = vi.fn()
    const closeGuard = vi.fn(() => true)
    render(<Harness initial='a' onClose={onClose} closeGuard={closeGuard} />)
    esc(detailEl())
    expect(closeGuard).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('also works stacked, from a control in the detail', () => {
    window.innerWidth = 1024
    const onClose = vi.fn()
    render(<Harness initial='a' onClose={onClose} />)
    esc(screen.getByRole('button', { name: 'Go to c' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores other keys, a prevented Escape and a composing one', () => {
    const onClose = vi.fn()
    render(<Harness initial='a' onClose={onClose} />)
    fireEvent.keyDown(detailEl(), { key: 'Enter', code: 'Enter' })
    fireEvent.keyDown(detailEl(), { key: 'Escape', code: 'Escape', isComposing: true })
    const prevented = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true })
    const stopper = event => event.preventDefault()
    document.body.addEventListener('keydown', stopper)
    detailEl().dispatchEvent(prevented)
    document.body.removeEventListener('keydown', stopper)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not listen while closed', () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    esc(document.body)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('stops listening once it closes', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness initial='a' onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Close zone' }))
    onClose.mockClear()
    esc(document.body)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not close the editor panel with the same Escape, and the next Escape closes the editor', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onEditorClose = vi.fn()
    render(<EditorPanel onClose={onEditorClose}><Harness onClose={onClose} /></EditorPanel>)
    await openRow(user)
    expect(document.activeElement).toBe(detailEl())
    esc(document.activeElement)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onEditorClose).not.toHaveBeenCalled()
    expect(detailEl()).toBeNull()
    esc(document.activeElement)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onEditorClose).toHaveBeenCalledTimes(1)
  })

  it('a legacy fixed SideBar opened from the detail closes first and the detail stays', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onEditorClose = vi.fn()
    render(<EditorPanel onClose={onEditorClose}><Harness initial='a' onClose={onClose} detail={<WithLegacy />} /></EditorPanel>)
    await user.click(screen.getByRole('button', { name: 'Open legacy' }))
    expect(screen.getByTestId('legacy')).toBeInTheDocument()
    esc(screen.getByRole('button', { name: 'Legacy action' }))
    expect(screen.queryByTestId('legacy')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(onEditorClose).not.toHaveBeenCalled()
    expect(detailEl()).not.toBeNull()
    esc(screen.getByRole('button', { name: 'Open legacy' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onEditorClose).not.toHaveBeenCalled()
  })

  it('an Escape in a text field only takes the focus out of it; the next one closes', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness initial='a' onClose={onClose} />)
    const input = screen.getByLabelText('Zone name')
    await user.click(input)
    await user.keyboard('north')
    esc(input)
    expect(onClose).not.toHaveBeenCalled()
    expect(input).toHaveValue('north')
    expect(document.activeElement).toBe(detailEl())
    esc(document.activeElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a select trigger with its list open keeps the Escape; closed, the Escape closes', () => {
    const onClose = vi.fn()
    render(<Harness initial='a' onClose={onClose} detail={<button type='button' aria-haspopup='listbox' aria-expanded='true'>Status</button>} />)
    const trigger = screen.getByRole('button', { name: 'Status' })
    esc(trigger)
    expect(onClose).not.toHaveBeenCalled()
    trigger.setAttribute('aria-expanded', 'false')
    esc(trigger)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('an open menu in the page takes the Escape and the detail stays', () => {
    const onClose = vi.fn()
    render(<Harness initial='a' onClose={onClose} />)
    const menu = document.createElement('div')
    menu.setAttribute('role', 'menu')
    document.body.appendChild(menu)
    esc(detailEl())
    expect(onClose).not.toHaveBeenCalled()
    menu.remove()
    esc(detailEl())
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a menu that is hidden, ending or inside the detail does not count', () => {
    const onClose = vi.fn()
    render(<Harness initial='a' onClose={onClose} detail={<div role='menu'>Inside</div>} />)
    const hidden = document.createElement('div')
    hidden.setAttribute('role', 'listbox')
    hidden.setAttribute('aria-hidden', 'true')
    const ending = document.createElement('div')
    ending.setAttribute('role', 'menu')
    ending.setAttribute('data-ending-style', '')
    document.body.append(hidden, ending)
    esc(detailEl())
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('an open dialog layer takes the Escape and the detail stays', async () => {
    const onClose = vi.fn()
    render(
      <>
        <Harness initial='a' onClose={onClose} />
        <Dialog open onOpenChange={() => {}} title='Discard changes' closeLabel='Close dialog'><p>Sure?</p></Dialog>
      </>
    )
    await waitFor(() => expect(hasActiveDialogLayer()).toBe(true))
    esc(detailEl())
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('Product SectionSplit — focus', () => {
  it('opening from a row moves the focus to the detail, and closing gives it back to that row', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openRow(user, 'b')
    expect(document.activeElement).toBe(detailEl())
    await user.click(screen.getByRole('button', { name: 'Close zone' }))
    expect(document.activeElement).toBe(rowButton('b'))
  })

  it('stacked, the back button gives the focus back to the row too', async () => {
    window.innerWidth = 1024
    const user = userEvent.setup()
    render(<Harness />)
    await openRow(user, 'c')
    expect(document.activeElement).toBe(detailEl())
    await user.click(screen.getByRole('button', { name: 'Zones' }))
    expect(document.activeElement).toBe(rowButton('c'))
  })

  it('opens with a plain focus() stacked (it scrolls into view) and without scrolling side by side', () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    const callOnDetail = () => focus.mock.calls.find((_, index) => focus.mock.contexts[index] === detailEl())
    const { rerender, unmount } = render(<Controlled />)
    rerender(<Controlled open />)
    expect(callOnDetail()).toEqual([{ preventScroll: true }])
    unmount()
    focus.mockClear()
    window.innerWidth = 1024
    const second = render(<Controlled />)
    second.rerender(<Controlled open />)
    expect(callOnDetail()).toBeDefined()
    expect(callOnDetail()[0]).toBeUndefined()
  })

  it('after the opener left the page, closing focuses the row that carries data-section-split-key', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const opener = rowButton('a')
    await user.click(opener)
    await user.click(screen.getByRole('button', { name: 'Refresh list' }))
    expect(opener.isConnected).toBe(false)
    esc(detailEl())
    expect(document.activeElement).toBe(rowButton('a'))
    expect(document.activeElement).not.toBe(opener)
  })

  it('a keyed row that is not focusable hands the focus to its first focusable control', () => {
    const keyed = { open: false }
    const { rerender } = render(<Controlled {...keyed} />)
    rowButton('b').focus()
    rerender(<Controlled open k='b' />)
    rowButton('b').remove()
    const li = document.querySelector('[data-section-split-key="b"]')
    const replacement = document.createElement('a')
    replacement.setAttribute('href', '#b')
    li.appendChild(replacement)
    rerender(<Controlled open={false} k='b' />)
    expect(document.activeElement).toBe(replacement)
  })

  it('with nothing focusable in the list, closing focuses the list root (never the body)', async () => {
    const user = userEvent.setup()
    const renderList = setCurrent => (
      <ul>
        {['a', 'b'].map(key => <li key={key} data-section-split-key={key} onClick={() => setCurrent(key)}>{`Item ${key}`}</li>)}
      </ul>
    )
    render(<Harness renderList={renderList} />)
    await user.click(screen.getByText('Item a'))
    expect(document.activeElement).toBe(detailEl())
    await user.click(screen.getByRole('button', { name: 'Close zone' }))
    expect(document.activeElement).toBe(listEl())
    expect(document.activeElement).not.toBe(document.body)
  })

  it('a mouse click on a row that takes no focus (activeElement is body) still ends on the keyed row when it can have it', () => {
    const renderList = setCurrent => (
      <ul>
        {['a', 'b'].map(key => <li key={key} tabIndex={-1} data-section-split-key={key} onClick={() => setCurrent(key)}>{`Item ${key}`}</li>)}
      </ul>
    )
    render(<Harness renderList={renderList} />)
    expect(document.activeElement).toBe(document.body)
    fireEvent.click(screen.getByText('Item b'))
    expect(document.activeElement).toBe(detailEl())
    esc(detailEl())
    expect(document.activeElement).toBe(screen.getByText('Item b'))
  })

  it('a mouse click on a row with nothing focusable ends on the list root', () => {
    const renderList = setCurrent => (
      <ul>
        {['a', 'b'].map(key => <li key={key} data-section-split-key={key} onClick={() => setCurrent(key)}>{`Item ${key}`}</li>)}
      </ul>
    )
    render(<Harness renderList={renderList} />)
    fireEvent.click(screen.getByText('Item b'))
    esc(detailEl())
    expect(document.activeElement).toBe(listEl())
  })

  it('leaves the focus alone when something outside the piece took it before the close', () => {
    const { rerender } = render(<Controlled />)
    rowButton('a').focus()
    rerender(<Controlled open />)
    const outside = screen.getByRole('button', { name: 'Outside' })
    outside.focus()
    rerender(<Controlled open={false} />)
    expect(document.activeElement).toBe(outside)
  })

  it('leaves the focus where it is when it is already on a control of the list', () => {
    const { rerender } = render(<Controlled />)
    rowButton('a').focus()
    rerender(<Controlled open />)
    rowButton('c').focus()
    rerender(<Controlled open={false} />)
    expect(document.activeElement).toBe(rowButton('c'))
  })

  it('side by side, changing record with the focus on a list control keeps the focus there', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openRow(user, 'a')
    await user.click(rowButton('b'))
    expect(screen.getByRole('region', { name: 'Zone b' })).toBeInTheDocument()
    expect(document.activeElement).toBe(rowButton('b'))
  })

  it('side by side, changing record with the focus inside the detail moves it to the new detail', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openRow(user, 'a')
    await user.click(screen.getByRole('button', { name: 'Go to c' }))
    expect(screen.getByRole('region', { name: 'Zone c' })).toBeInTheDocument()
    expect(document.activeElement).toBe(detailEl())
  })

  it('side by side, changing record with the focus on the body moves it to the detail', () => {
    const { rerender } = render(<Controlled />)
    rerender(<Controlled open k='a' />)
    ;(document.activeElement).blur()
    expect(document.activeElement).toBe(document.body)
    rerender(<Controlled open k='b' />)
    expect(document.activeElement).toBe(detailEl())
  })

  it('stacked, changing record moves the focus to the detail even from the (hidden) list', () => {
    window.innerWidth = 1024
    const { rerender } = render(<Controlled />)
    rowButton('a').focus()
    rerender(<Controlled open k='a' />)
    rowButton('b').focus()
    expect(document.activeElement).toBe(rowButton('b'))
    rerender(<Controlled open k='b' />)
    expect(document.activeElement).toBe(detailEl())
  })

  it('side by side, the same change leaves a list control with the focus (the contrast of the stacked case)', () => {
    const { rerender } = render(<Controlled />)
    rowButton('a').focus()
    rerender(<Controlled open k='a' />)
    rowButton('b').focus()
    rerender(<Controlled open k='b' />)
    expect(document.activeElement).toBe(rowButton('b'))
  })

  it('moving from side by side to stacked with the focus in the list moves it to the detail', () => {
    const { rerender } = render(<Controlled />)
    rowButton('a').focus()
    rerender(<Controlled open />)
    rowButton('b').focus()
    expect(root()).toHaveAttribute('data-mode', 'split')
    resizeTo(1024)
    expect(root()).toHaveAttribute('data-mode', 'stack')
    expect(listEl()).toHaveAttribute('inert')
    expect(document.activeElement).toBe(detailEl())
  })

  it('moving to stacked leaves a focus that is inside the detail where it is', () => {
    const { rerender } = render(<Controlled />)
    rowButton('a').focus()
    rerender(<Controlled open />)
    screen.getByRole('button', { name: 'Inner' }).focus()
    resizeTo(1024)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Inner' }))
  })

  it('does not take the focus when it is closed', () => {
    render(<Controlled />)
    const outside = screen.getByRole('button', { name: 'Outside' })
    outside.focus()
    resizeTo(1024)
    expect(document.activeElement).toBe(outside)
  })
})

describe('Product SectionSplit — sticky detail (measured height)', () => {
  const ScrollHost = ({ children }) => <div data-testid='scroller' style={{ overflowY: 'auto' }}>{children}</div>
  const maxOf = () => root().style.getPropertyValue('--odc-section-split-max')

  const prepareScroller = () => {
    const scroller = screen.getByTestId('scroller')
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 600 })
    Object.defineProperty(scroller, 'clientTop', { configurable: true, value: 0 })
    overrides.set(scroller, { top: 100, height: 600 })
    return scroller
  }

  it('measures what the nearest scroller shows below the top of the root, and drops it when it closes', () => {
    const { rerender } = render(<ScrollHost><Controlled /></ScrollHost>)
    prepareScroller()
    rootRect = { width: 1200, top: 300, height: 2000 }
    rerender(<ScrollHost><Controlled open /></ScrollHost>)
    expect(maxOf()).toBe('400px')
    rerender(<ScrollHost><Controlled /></ScrollHost>)
    expect(maxOf()).toBe('')
  })

  it('uses the whole scroller when the root starts above its visible top', () => {
    const { rerender } = render(<ScrollHost><Controlled /></ScrollHost>)
    prepareScroller()
    rootRect = { width: 1200, top: -250, height: 2000 }
    rerender(<ScrollHost><Controlled open /></ScrollHost>)
    expect(maxOf()).toBe('600px')
  })

  it('measures again on scroll of the scroller, coalesced with requestAnimationFrame', () => {
    const frames = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => frames.push(callback))
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    const { rerender } = render(<ScrollHost><Controlled /></ScrollHost>)
    const scroller = prepareScroller()
    rootRect = { width: 1200, top: 300, height: 2000 }
    rerender(<ScrollHost><Controlled open /></ScrollHost>)
    expect(maxOf()).toBe('400px')
    rootRect = { width: 1200, top: 350, height: 2000 }
    fireEvent.scroll(scroller)
    fireEvent.scroll(scroller)
    expect(maxOf()).toBe('400px')
    expect(frames).toHaveLength(1)
    act(() => frames[0](0))
    expect(maxOf()).toBe('350px')
  })

  // the store editor is a fixed panel inside the shell's <main>, which clips (overflow hidden) with no height of its own.
  // An ancestor above a fixed box does not clip it, so the walk stops there: before, the shell's 0 px <main> made the detail 0 px.
  it('stops at a fixed ancestor: what is above it does not clip the detail', () => {
    const Shell = ({ children }) => (
      <div data-testid='shell-main' style={{ overflow: 'hidden' }}>
        <div data-testid='fixed-panel' style={{ position: 'fixed', overflow: 'hidden' }}>
          <ScrollHost>{children}</ScrollHost>
        </div>
      </div>
    )
    const { rerender } = render(<Shell><Controlled /></Shell>)
    prepareScroller()
    const shell = screen.getByTestId('shell-main')
    Object.defineProperty(shell, 'clientHeight', { configurable: true, value: 0 })
    Object.defineProperty(shell, 'clientTop', { configurable: true, value: 0 })
    overrides.set(shell, { top: 0, height: 0 })
    const panel = screen.getByTestId('fixed-panel')
    Object.defineProperty(panel, 'clientHeight', { configurable: true, value: 900 })
    Object.defineProperty(panel, 'clientTop', { configurable: true, value: 0 })
    overrides.set(panel, { top: 0, height: 900 })
    rootRect = { width: 1200, top: 300, height: 2000 }
    rerender(<Shell><Controlled open /></Shell>)
    expect(maxOf()).toBe('400px')
  })

  it('uses the viewport when no ancestor scrolls', () => {
    window.innerHeight = 800
    rootRect = { width: 1200, top: 200, height: 2000 }
    render(<Controlled open />)
    expect(maxOf()).toBe('600px')
  })

  it('clamps to zero when the root is below the visible area', () => {
    window.innerHeight = 800
    rootRect = { width: 1200, top: 900, height: 2000 }
    render(<Controlled open />)
    expect(maxOf()).toBe('0px')
  })

  it('is not measured while stacked or closed', () => {
    window.innerWidth = 1024
    const { rerender } = render(<Controlled />)
    expect(maxOf()).toBe('')
    rerender(<Controlled open />)
    expect(maxOf()).toBe('')
  })

  it('removes the listeners and the pending frame when it closes', () => {
    const cancel = vi.spyOn(window, 'cancelAnimationFrame')
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 7)
    const { rerender } = render(<ScrollHost><Controlled /></ScrollHost>)
    const scroller = prepareScroller()
    rerender(<ScrollHost><Controlled open /></ScrollHost>)
    fireEvent.scroll(scroller)
    rerender(<ScrollHost><Controlled /></ScrollHost>)
    expect(cancel).toHaveBeenCalledWith(7)
  })
})

describe('Product SectionSplit — the CSS', () => {
  const code = CSS.replace(/\/\*[\s\S]*?\*\//g, '')

  it('says in its header why it takes no containing block', () => {
    const header = CSS.slice(0, CSS.indexOf('*/'))
    for (const name of ['container-type', 'contain', 'transform', 'filter', 'backdrop-filter', 'perspective', 'will-change']) {
      expect(header).toContain(name)
    }
  })

  it.each([
    ['container-type', /container-type/],
    ['container-name', /container-name/],
    ['contain', /(^|[\s;{])contain\s*:/],
    ['transform', /transform/],
    ['filter (and backdrop-filter)', /filter/],
    ['perspective', /perspective/],
    ['will-change', /will-change/],
    ['z-index', /z-index/]
  ])('has no %s outside comments (a legacy fixed SideBar must paint over the page)', (_, pattern) => {
    expect(code).not.toMatch(pattern)
  })

  it('is side by side only in the split view, with the detail sticky', () => {
    expect(code).toMatch(/\.odc-section-split\[data-view='split'\]\s*\{[^}]*clamp\(var\(--od-x-panel-narrow\), 40%, var\(--od-x-dialog-lg\)\)/)
    expect(code).toMatch(/data-view='split'\]\s*>\s*\.odc-section-split-detail\s*\{[^}]*position:\s*sticky/)
    expect(code).toContain('max-block-size: var(--odc-section-split-max, none)')
  })
})

// redesign stores 2.A + 2.B (): inside a leave-guard host (the store editor shell), every way out of the host
// asks the open detail first (useNestedLeaveGuard); the host only goes on once the piece lets go.
describe('SectionSplit — inside a leave-guard host (P/LeaveGuard)', () => {
  const HostWith = ({ onHost, children }) => {
    const host = useLeaveGuardHost()
    onHost(host)
    return <LeaveGuardContext.Provider value={host.context}>{children}</LeaveGuardContext.Provider>
  }
  const Piece = props => (
    <SectionSplit open detailKey={1} detailTitle='Zone Fast Bite principal' closeLabel='Close zone' backLabel='Zones' onClose={() => {}} list={<div />} detail={<div />} {...props} />
  )

  it('a way out of the host stops at the detail guard and goes on when it calls proceed', () => {
    let host
    let later
    const closeGuard = vi.fn(go => { later = go; return true })
    const proceed = vi.fn()
    render(<HostWith onHost={value => { host = value }}><Piece closeGuard={closeGuard} /></HostWith>)
    act(() => { host.requestLeave(proceed) })
    expect(closeGuard).toHaveBeenCalledTimes(1)
    expect(proceed).not.toHaveBeenCalled()
    act(() => later())
    expect(proceed).toHaveBeenCalledTimes(1)
  })

  it('hands the host onCancel to its guards, so a guard that keeps the user can say so', () => {
    let host
    const closeGuard = vi.fn((go, cancel) => { cancel?.(); return true })
    const proceed = vi.fn()
    const onCancel = vi.fn()
    render(<HostWith onHost={value => { host = value }}><Piece closeGuard={closeGuard} /></HostWith>)
    act(() => { host.requestLeave(proceed, onCancel) })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(proceed).not.toHaveBeenCalled()
  })

  it('with no guard taking over, the host proceeds at once; once unmounted it no longer asks the piece', () => {
    let host
    const closeGuard = vi.fn(() => false)
    const proceed = vi.fn()
    const { rerender } = render(<HostWith onHost={value => { host = value }}><Piece closeGuard={closeGuard} /></HostWith>)
    act(() => { host.requestLeave(proceed) })
    expect(proceed).toHaveBeenCalledTimes(1)
    rerender(<HostWith onHost={value => { host = value }}><div /></HostWith>)
    act(() => { host.requestLeave(proceed) })
    expect(closeGuard).toHaveBeenCalledTimes(1)
    expect(proceed).toHaveBeenCalledTimes(2)
  })
})

// review F3-2/F3-3: the recipe of decisions.md (instruction 5). The form of the detail uses useLeaveGuard with the piece's
// registerCloseGuard, so it is an entry of the host AND a guard of the piece. A way out of the host asks about it once and keeps the
// host's onCancel; a way out of the piece (its X) asks about it once too.
describe('SectionSplit — a useLeaveGuard form in the detail, inside the host', () => {
  const Form = ({ dirty, onDiscard }) => {
    const { registerCloseGuard } = useSectionSplit()
    useLeaveGuard({ dirty, discard: onDiscard, save: () => true, registerCloseGuard })
    return <input aria-label='Name' defaultValue='Zone' />
  }
  const Editor = ({ onHost, onClose }) => {
    const host = useLeaveGuardHost()
    onHost(host)
    const [dirty, setDirty] = useState(true)
    return (
      <LeaveGuardContext.Provider value={host.context}>
        <SectionSplit
          open
          detailKey={1}
          detailTitle='Zone'
          closeLabel='Close zone'
          backLabel='Zones'
          onClose={onClose}
          list={<div />}
          detail={<Form dirty={dirty} onDiscard={() => setDirty(false)} />}
        />
        <LeaveDialog {...host.dialog} title='Discard the changes?' keepLabel='Keep editing' saveLabel='Save and continue' discardLabel='Discard' closeLabel='Close' />
      </LeaveGuardContext.Provider>
    )
  }

  it('a way out of the host asks once and proceeds once on «Discard»', async () => {
    let host
    const proceed = vi.fn()
    render(<Editor onHost={value => { host = value }} onClose={() => {}} />)
    act(() => { host.requestLeave(proceed) })
    expect(await screen.findAllByRole('alertdialog')).toHaveLength(1)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(proceed).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('«Keep editing» on a way out of the host calls the host onCancel', async () => {
    let host
    const proceed = vi.fn()
    const onCancel = vi.fn()
    render(<Editor onHost={value => { host = value }} onClose={() => {}} />)
    act(() => { host.requestLeave(proceed, onCancel) })
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Keep editing' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(proceed).not.toHaveBeenCalled()
  })

  it('the X of the detail asks once about the form and closes on «Discard»', async () => {
    const onClose = vi.fn()
    render(<Editor onHost={() => {}} onClose={onClose} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Close zone' }))
    expect(await screen.findAllByRole('alertdialog')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })
})

// redesign stores 5.18 (R5.8-02 of 5.8): OPT-IN. Stacked, the detail replaces the list where the user was, often low in a
// long list; the piece only focused it, so its header (title, «‹ back», tabs) stayed above the screen. With `revealDetail` it brings the
// top of the detail into view each time a record opens or another one replaces it, stacked only.
describe('Product SectionSplit — revealDetail (opt-in)', () => {
  const frame = () => act(() => new Promise(resolve => window.requestAnimationFrame(() => resolve())))
  let scrolled
  let original
  beforeEach(() => {
    scrolled = []
    original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (options) { scrolled.push([this.className, options]) }
  })
  afterEach(() => {
    Element.prototype.scrollIntoView = original
  })

  it('stacked, scrolls the detail to its top when a record opens and when another replaces it', async () => {
    window.innerWidth = 390
    const user = userEvent.setup()
    render(<Harness revealDetail />)
    await openRow(user, 'a')
    await frame()
    expect(scrolled).toEqual([['odc-section-split-detail', { block: 'start' }]])
    await user.click(screen.getByRole('button', { name: 'Go to c' }))
    await frame()
    expect(scrolled).toHaveLength(2)
  })

  it('side by side it does not scroll (the detail is sticky in view)', async () => {
    const user = userEvent.setup()
    render(<Harness revealDetail />)
    await openRow(user, 'a')
    await frame()
    expect(root().dataset.mode).toBe('split')
    expect(scrolled).toEqual([])
  })

  it('without the prop the piece is as before: it does not scroll', async () => {
    window.innerWidth = 390
    const user = userEvent.setup()
    render(<Harness />)
    await openRow(user, 'a')
    await frame()
    expect(scrolled).toEqual([])
  })
})
