// redesign stores 3.D: the Sync videos are a click-to-play facade. `loading='lazy'` does not stop Chromium from asking
// YouTube when the frame is near the viewport, so before pressing Play there is no iframe and no request to youtube.com / ytimg.com.
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text]
}))

import { SyncVideo } from '../SyncVideo'
import { BusinessSyncBasic } from '../../BusinessSyncBasic'
import { BusinessSyncItsaCheckmate } from '../../BusinessSyncItsaCheckmate'

const theme = { images: { general: { deliverect: 'deliverect.png', ItsaCheckmateLogo: 'itsa.png' } } }
const DELIVERECT_SRC = 'https://www.youtube.com/embed/_v8nPmW_E-0?playlist=_v8nPmW_E-0&loop=1'
const ITSA_SRC = 'https://www.youtube.com/embed/_caZDl4ZFp0?feature=oembed'

const mount = (ui) => render(
  <ThemeProvider theme={theme}>
    <MemoryRouter>{ui}</MemoryRouter>
  </ThemeProvider>
)

// every attribute of every node: nothing in the DOM may point at YouTube before the user asks
const youtubeReferences = (container) => [...container.querySelectorAll('*')].flatMap(node =>
  [...node.attributes].filter(attribute => /youtube|ytimg/i.test(attribute.value)).map(attribute => `${node.tagName}[${attribute.name}]`)
)

describe('SyncVideo: before pressing Play', () => {
  it.each([
    ['Deliverect', BusinessSyncBasic, DELIVERECT_SRC],
    ['ItsaCheckmate', BusinessSyncItsaCheckmate, ITSA_SRC]
  ])('%s page: no iframe and nothing that points at YouTube or ytimg in the DOM', (_name, Page) => {
    const { container } = mount(<Page />)
    expect(container.querySelector('iframe')).toBeNull()
    expect(youtubeReferences(container)).toEqual([])
    expect(container.innerHTML).not.toMatch(/youtube|ytimg/i)
    // the only images are the provider logo: no video thumbnail
    expect([...container.querySelectorAll('img')].map(img => img.getAttribute('src'))).toHaveLength(1)
  })

  it('shows one native button in a 16:9 frame with the title visible and «Play video: title» as its name', () => {
    const { container } = mount(<SyncVideo src={DELIVERECT_SRC} title='Deliverect video' />)
    const button = screen.getByRole('button', { name: 'Play video: Deliverect video' })
    expect(button.tagName).toBe('BUTTON')
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveTextContent('Deliverect video')
    expect(button.querySelector('svg')).not.toBeNull()
    expect(container.querySelector('.stores-sync-video')).toContainElement(button)
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('names the Deliverect button from its page title', () => {
    mount(<BusinessSyncBasic />)
    expect(screen.getByRole('button', { name: 'Play video: Deliverect video' })).toBeInTheDocument()
  })

  it('names the ItsaCheckmate button from its page title', () => {
    mount(<BusinessSyncItsaCheckmate />)
    expect(screen.getByRole('button', { name: 'Play video: ItsaCheckmate video' })).toBeInTheDocument()
  })
})

describe('SyncVideo: after pressing Play', () => {
  it.each([
    ['Deliverect', DELIVERECT_SRC, `${DELIVERECT_SRC}&autoplay=1`],
    ['ItsaCheckmate', ITSA_SRC, `${ITSA_SRC}&autoplay=1`],
    ['a src without a query', 'https://www.youtube.com/embed/abc', 'https://www.youtube.com/embed/abc?autoplay=1']
  ])('%s: mounts the iframe with the original src plus autoplay=1, replaces the button and takes the focus', async (_name, src, expected) => {
    const user = userEvent.setup()
    const { container } = mount(<SyncVideo src={src} title='A video' />)
    await user.click(screen.getByRole('button', { name: 'Play video: A video' }))
    const frame = container.querySelector('iframe')
    expect(frame).not.toBeNull()
    expect(frame).toHaveAttribute('src', expected)
    expect(frame).toHaveAttribute('title', 'A video')
    expect(frame).toHaveAttribute('loading', 'lazy')
    expect(frame).toHaveAttribute('allow', 'autoplay; encrypted-media; picture-in-picture')
    expect(frame).toHaveAttribute('allowfullscreen')
    expect(screen.queryByRole('button')).toBeNull()
    // review r1 #1: the focus goes to the frame around the player, not into the cross-origin iframe, so Escape still
    // reaches the Sheet; the next Tab enters the player
    const group = screen.getByRole('group', { name: 'A video' })
    expect(document.activeElement).toBe(group)
    expect(group).toContainElement(frame)
    expect(document.activeElement).not.toBe(frame)
  })

  it('also opens with the keyboard (Enter on the focused button)', async () => {
    const user = userEvent.setup()
    const { container } = mount(<SyncVideo src={ITSA_SRC} title='A video' />)
    await user.tab()
    expect(screen.getByRole('button', { name: 'Play video: A video' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(container.querySelector('iframe')).toHaveAttribute('src', `${ITSA_SRC}&autoplay=1`)
  })
})
