import React, { createRef, useState } from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RecordPanel } from '../RecordPanel'
import { SplitView } from '../SplitView'

// redesign W0-7 (T0-26)
const CSS = readFileSync(path.resolve(__dirname, '../record-panel.css'), 'utf8')

afterEach(() => {
  vi.restoreAllMocks()
  document.getElementById('app-modals')?.remove()
})

const DISCARD = {
  discardTitle: 'Discard your changes?',
  discardDescription: 'What you typed is not saved yet.',
  discardConfirmLabel: 'Discard',
  keepEditingLabel: 'Keep editing'
}

const BASE = { title: 'Store editor', closeLabel: 'Close' }

// A consumer: the draft is its own state, and `dirty` says whether it differs from what is saved.
const Editor = ({ onClose, panelRef, withDiscard = true, ...props }) => {
  const [draft, setDraft] = useState('')
  return (
    <RecordPanel
      ref={panelRef}
      {...BASE}
      {...(withDiscard ? DISCARD : {})}
      dirty={withDiscard ? draft !== '' : undefined}
      onClose={onClose}
      footer={<button type='button'>Save store</button>}
      {...props}
    >
      <label>
        Store name
        <input value={draft} onChange={event => setDraft(event.target.value)} />
      </label>
    </RecordPanel>
  )
}

const closeButton = () => screen.getByRole('button', { name: 'Close' })

describe('RecordPanel — contract', () => {
  it('names the panel: a level-2 heading with the title, and a close button with its name', () => {
    render(<Editor />)
    expect(screen.getByRole('heading', { level: 2, name: 'Store editor' })).toBeInTheDocument()
    expect(closeButton()).toHaveAttribute('aria-label', 'Close')
  })

  it('draws its subtitle, status, header actions and footer, and no text of its own', () => {
    const { container } = render(
      <RecordPanel
        {...BASE}
        subtitle={<span>Main street 1</span>}
        status={<span>Open</span>}
        headerActions={<button type='button'>Open as page</button>}
        footer={<button type='button'>Save store</button>}
      >
        <p>Body</p>
      </RecordPanel>
    )
    expect(container.textContent).toBe('Store editorOpenOpen as pageMain street 1BodySave store')
    expect(screen.getByRole('button', { name: 'Open as page' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save store' })).toBeInTheDocument()
  })

  it.each([
    ['title', { title: undefined }, 'RecordPanel needs a title'],
    ['title (null)', { title: null }, 'RecordPanel needs a title'],
    ['closeLabel', { closeLabel: undefined }, 'RecordPanel needs a closeLabel'],
    ['a discardTitle with dirty', { dirty: true, ...DISCARD, discardTitle: undefined }, 'RecordPanel needs a discardTitle when it has dirty'],
    ['a keepEditingLabel with dirty', { dirty: false, ...DISCARD, keepEditingLabel: undefined }, 'RecordPanel needs a keepEditingLabel when it has dirty'],
    ['tabs or nav, not both', { tabs: { label: 'Sections', items: [], value: 'a', onValueChange () {} }, nav: <nav /> }, 'RecordPanel takes tabs or nav, not both']
  ])('throws a clear Error without %s', (_, props, message) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<RecordPanel {...BASE} {...props} />)).toThrow(message)
  })

  it('paints an empty title instead of throwing (an empty translation is a value)', () => {
    render(<RecordPanel title='' closeLabel='Close' />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('')
  })
})

describe('RecordPanel — tabs', () => {
  const Tabbed = () => {
    const [value, setValue] = useState('general')
    return (
      <RecordPanel
        {...BASE}
        tabs={{
          label: 'Store sections',
          value,
          onValueChange: setValue,
          items: [
            { value: 'general', label: 'General', content: <label>Description <textarea /></label> },
            { value: 'hours', label: 'Hours', content: <p>Opening hours</p> }
          ]
        }}
      />
    )
  }

  it('draws the tabs of Product with the label as the name of the tablist', () => {
    render(<Tabbed />)
    expect(screen.getByRole('tablist', { name: 'Store sections' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true')
  })

  it('keeps every panel mounted: a draft survives a tab switch', async () => {
    const user = userEvent.setup()
    render(<Tabbed />)
    const draft = screen.getByLabelText('Description')
    await user.type(draft, 'Best pizza in town')
    await user.click(screen.getByRole('tab', { name: 'Hours' }))
    expect(screen.getByRole('tab', { name: 'Hours' })).toHaveAttribute('aria-selected', 'true')
    // the other panel is still in the document (hidden), with the same node and what was typed in it
    expect(draft).toBeInTheDocument()
    expect(draft).not.toBeVisible()
    expect(screen.getByText('Opening hours')).toBeVisible()
    await user.click(screen.getByRole('tab', { name: 'General' }))
    expect(screen.getByLabelText('Description')).toBe(draft)
    expect(draft).toHaveValue('Best pizza in town')
    expect(draft).toBeVisible()
  })
})

// redesign (row 91 O1): `tabs.wrap` is forwarded to Tabs, opt-in. Without it the tabs are what they were (one row that scrolls).
describe('RecordPanel — tabs.wrap', () => {
  const withTabs = (extra = {}) => render(
    <RecordPanel
      {...BASE}
      tabs={{
        label: 'Admin sections',
        value: 'a',
        onValueChange: () => {},
        items: [{ value: 'a', label: 'Profile', content: <p>A</p> }, { value: 'b', label: 'Push tokens', content: <p>B</p> }],
        ...extra
      }}
    />
  )

  it('forwards tabs.wrap: the tabs break into lines (data-wrap on the Tabs root, no sideways fade)', () => {
    const { container } = withTabs({ wrap: true })
    expect(container.querySelector('.odc-record-tabs')).toHaveAttribute('data-wrap', 'true')
    expect(screen.getByRole('tablist')).not.toHaveClass('odc-fade-x')
  })

  it('without tabs.wrap nothing changes: no data-wrap, the list keeps its fade', () => {
    const { container } = withTabs()
    expect(container.querySelector('[data-wrap]')).toBeNull()
    expect(screen.getByRole('tablist')).toHaveClass('odc-fade-x')
  })
})

// redesign (row 63 Q-05, from batch D): a long name used to wrap without limit and, in a narrow panel, push the actions of the header
// onto their own line. The title is clamped (two lines, then an ellipsis) and gives way before the actions do; its full text is in the DOM and
// in its `title` when it is a string.
describe('RecordPanel — long titles (row 63 Q-05)', () => {
  const bare = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
  const body = selector => {
    const found = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(([, sel]) => sel.trim().replace(/\s+/g, ' ') === selector)
    return found ? found[2].replace(/\s+/g, ' ') : ''
  }
  const LONG = 'Maria de los Angeles Fernandez-Villalobos y Hernandez de la Cruz Montenegro'

  it('puts a string title in the title attribute of the heading, and keeps the text in the DOM', () => {
    render(<RecordPanel {...BASE} title={LONG} />)
    const heading = screen.getByRole('heading', { level: 2, name: LONG })
    expect(heading).toHaveAttribute('title', LONG)
    expect(heading).toHaveTextContent(LONG)
  })

  it('a title that is a node (a skeleton) gets no title attribute', () => {
    render(<RecordPanel {...BASE} title={<span data-testid='skeleton'>...</span>} />)
    expect(screen.getByRole('heading', { level: 2 })).not.toHaveAttribute('title')
  })

  it('the heading shrinks (min-inline-size 0), clips and ends in an ellipsis: two lines, as the page header', () => {
    const title = body('.odc-record-title')
    expect(title).toMatch(/min-inline-size:\s*0/)
    expect(title).toMatch(/overflow:\s*hidden/)
    expect(title).toMatch(/-webkit-line-clamp:\s*2/)
    expect(title).toMatch(/text-overflow:\s*ellipsis/)
  })

  // live checks: drivers companies at 1440 (a 519px panel) wraps its row from 600px, where a narrow-panel-only rule did not reach; and
  // review F-1: a basis-0 title lost to a wide inline status («Orderi / ng…»). The title keeps its own size (`0 1 auto`, as before) and
  // can never claim the room of the actions: its width is capped by what they need (four control heights cover three buttons and the gaps)
  it('the title keeps its own flex and is capped short of the actions, so a wrapping row keeps them on its line', () => {
    const title = body('.odc-record-title')
    expect(title).toMatch(/flex:\s*0 1 auto/)
    expect(title).toMatch(/max-inline-size:\s*calc\(100% - var\(--od-x-control-height\) \* 4\)/)
    expect(body('.odc-record-actions')).toMatch(/flex:\s*none/)
    expect(bare).not.toMatch(/\.odc-record-head-row > \.odc-record-title\s*\{/)
  })
})

describe('RecordPanel — nav slot', () => {
  it('leaves the slot and the layout to the nav it is given, beside the body', () => {
    const { container } = render(
      <RecordPanel {...BASE} nav={<nav aria-label='Sections'><a href='#a'>Basics</a></nav>}>
        <p>Section body</p>
      </RecordPanel>
    )
    const root = container.querySelector('.odc-record')
    expect(root).toHaveAttribute('data-layout', 'nav')
    expect(within(root.querySelector('.odc-record-nav')).getByRole('navigation', { name: 'Sections' })).toBeInTheDocument()
    expect(root.querySelector('.odc-record-body')).toHaveTextContent('Section body')
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('follows the container, not the window: column from 640px, row above the body below it', () => {
    expect(CSS).toMatch(/container-name:\s*odc-record/)
    expect(CSS).toMatch(/@container odc-record \(min-width: 640px\)[\s\S]*grid-template-columns:\s*var\(--od-x-record-nav/)
  })
})

describe('RecordPanel — discard guard', () => {
  it('closes straight away when there is nothing to discard (no dialog)', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Editor onClose={onClose} />)
    await user.click(closeButton())
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('closes straight away without dirty at all', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Editor onClose={onClose} withDiscard={false} />)
    await user.type(screen.getByLabelText('Store name'), 'typed but not guarded')
    await user.click(closeButton())
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('asks «Discard your changes?» with the focus on «Keep editing»; keeping does not close and gives the field its focus back', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Editor onClose={onClose} />)
    const field = screen.getByLabelText('Store name')
    await user.type(field, 'Pizza')
    await user.click(closeButton())

    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    expect(within(dialog).getByText('What you typed is not saved yet.')).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Keep editing' })).toHaveFocus())
    expect(onClose).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(onClose).not.toHaveBeenCalled()
    await waitFor(() => expect(field).toHaveFocus())
    expect(field).toHaveValue('Pizza')
  })

  it('«Discard» closes', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Editor onClose={onClose} />)
    await user.type(screen.getByLabelText('Store name'), 'Pizza')
    await user.click(closeButton())
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  })

  it('Escape on the dialog is «Keep editing», not a close', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Editor onClose={onClose} />)
    await user.type(screen.getByLabelText('Store name'), 'Pizza')
    await user.click(closeButton())
    await screen.findByRole('alertdialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(onClose).not.toHaveBeenCalled()
  })

  it('stops guarding once what was typed is gone (dirty false closes directly)', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Editor onClose={onClose} />)
    const field = screen.getByLabelText('Store name')
    await user.type(field, 'a')
    await user.clear(field)
    await user.click(closeButton())
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('a host that owns Escape (a Sheet) asks through ref.requestClose()', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const panelRef = createRef()
    render(<Editor onClose={onClose} panelRef={panelRef} />)
    await user.type(screen.getByLabelText('Store name'), 'Pizza')
    act(() => panelRef.current.requestClose())
    await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('marks the state in data-dirty', async () => {
    const user = userEvent.setup()
    const { container } = render(<Editor />)
    expect(container.querySelector('.odc-record')).not.toHaveAttribute('data-dirty')
    await user.type(screen.getByLabelText('Store name'), 'x')
    expect(container.querySelector('.odc-record')).toHaveAttribute('data-dirty')
  })
})

// redesign SB-B0 (auditor 2)
describe('RecordPanel — fullWidth', () => {
  it('does not mark the root without the prop (the page column of --od-x-page-content stays)', () => {
    const { container } = render(<Editor />)
    expect(container.querySelector('.odc-record')).not.toHaveAttribute('data-full-width')
  })

  it('does not mark the root with fullWidth false', () => {
    const { container } = render(<Editor fullWidth={false} />)
    expect(container.querySelector('.odc-record')).not.toHaveAttribute('data-full-width')
  })

  it('marks the root with data-full-width, and does not pass the prop down to the DOM', () => {
    const { container } = render(<Editor fullWidth />)
    const root = container.querySelector('.odc-record')
    expect(root).toHaveAttribute('data-full-width')
    expect(root).not.toHaveAttribute('fullwidth')
  })

  it('lifts the page column only when opened as a page with fullWidth, and leaves the default rule as it was', () => {
    expect(CSS).toMatch(/\.odc-record\[data-expanded\]\s*\{\s*--odc-record-bound:\s*max\(0%, calc\(\(100% - var\(--od-x-page-content\)\) \/ 2\)\);/)
    expect(CSS).toMatch(/\.odc-record\[data-expanded\]\[data-full-width\]\s*\{\s*--odc-record-bound:\s*0%;/)
  })
})

describe('RecordPanel — inside a SplitView', () => {
  // jsdom has no layout: the viewport is a number and matchMedia answers the (min|max)-width queries against it.
  const originalMatchMedia = window.matchMedia
  const setWidth = width => {
    window.innerWidth = width
    window.matchMedia = query => ({
      media: query,
      matches: query.split(/\s+and\s+/).every(part => {
        const [, kind, value] = part.match(/\(\s*(min|max)-width:\s*(\d+)px\s*\)/) || []
        return kind === 'min' ? width >= Number(value) : kind === 'max' ? width <= Number(value) : false
      }),
      addEventListener () {},
      removeEventListener () {}
    })
  }

  const Page = ({ onClose, panelProps }) => {
    const [open, setOpen] = useState(true)
    return (
      <SplitView
        open={open}
        onClose={() => { onClose(); setOpen(false) }}
        panelLabel='Store panel'
        resizeLabel='Resize the panel'
        list={<button type='button'>Open store</button>}
        panel={<Editor {...panelProps} />}
      />
    )
  }

  afterEach(() => {
    window.innerWidth = 1024
    window.matchMedia = originalMatchMedia
  })

  it('Escape goes through the guard: the first one leaves the field, the second asks; Keep editing returns to the field', async () => {
    setWidth(1400)
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Page onClose={onClose} />)
    const field = screen.getByLabelText('Store name')
    await user.type(field, 'Pizza')
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await user.keyboard('{Escape}')
    const dialog = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
    expect(onClose).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(field).toHaveFocus())
    expect(screen.getByRole('complementary', { name: 'Store panel' })).toBeInTheDocument()
  })

  it('Discard closes the panel through the split view', async () => {
    setWidth(1400)
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Page onClose={onClose} />)
    await user.type(screen.getByLabelText('Store name'), 'Pizza')
    await user.click(closeButton())
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Store panel' })).toBeNull())
  })

  it('without dirty, Escape closes the panel at once', async () => {
    setWidth(1400)
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Page onClose={onClose} />)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('on a phone the way out is a Back arrow at the start, with the same name', () => {
    setWidth(500)
    render(<Page onClose={vi.fn()} panelProps={{ closeLabel: 'Back to stores' }} />)
    const back = screen.getByRole('button', { name: 'Back to stores' })
    const heading = screen.getByRole('heading', { level: 2, name: 'Store editor' })
    expect(back.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(back.querySelector('.odc-icon-flip')).not.toBeNull()
  })
})

// redesign (OP-20, OP-23, from ). jsdom has no layout, so these read the CSS; the measures were taken in a browser.
describe('RecordPanel — layout defects', () => {
  const bare = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
  const body = selector => {
    const found = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(([, sel]) => sel.trim().replace(/\s+/g, ' ') === selector)
    return found ? found[2].replace(/\s+/g, ' ') : ''
  }

  it('OP-20: the sticky save bar sticks to the real foot of the body, offset by the same value the body pads its foot with', () => {
    const scroller = body('.odc-record-body')
    expect(scroller).toMatch(/--odc-record-pad-end:\s*var\(--od-space-6\)/)
    // the air under a record without a bar is that padding, still there
    expect(scroller).toMatch(/padding-block:\s*var\(--od-space-4\) var\(--odc-record-pad-end\)/)
    expect(body('.odc-record-body .odc-savebar')).toMatch(/inset-block-end:\s*calc\(var\(--odc-record-pad-end\) \* -1\)/)
  })

  it('OP-23: the tab list in the panel takes the panel width, not 8px more, and keeps its hairline across it', () => {
    const list = body('.odc-record-tabs > .odc-tabs-list')
    // the list of Tabs reaches 4px past its box for the ring (tabs.css); here the padding is already the gutter, so it gives that back
    expect(list).toMatch(/margin-inline:\s*0/)
    expect(list).toMatch(/background-size:\s*100% var\(--od-x-hairline\)/)
    expect(list).toMatch(/padding-inline:\s*calc\(var\(--odc-record-gutter\) \+ var\(--odc-record-bound\)\)/)
  })
})
