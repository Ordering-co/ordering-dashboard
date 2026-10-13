import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  COMMAND_PALETTE_RECENT_LIMIT,
  getCommandPaletteRecentKey,
  pushCommandPaletteRecent,
  readCommandPaletteRecent
} from '../commandPaletteRecent'
import { getCommandPaletteShortcut, isCommandPaletteShortcut, isMacPlatform } from '../commandPaletteShortcut'
import { seedCommandPaletteI18n } from '../commandPaletteI18nSeed'

describe('command palette recents', () => {
  afterEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('scopes recents by project and user', () => {
    expect(getCommandPaletteRecentKey({ project: 'demo', userId: 3 })).toBe('command_palette_recent:demo:3')
    expect(getCommandPaletteRecentKey({ project: 'demo' })).toBeNull()
  })

  it('stores the newest first, unique and limited', () => {
    const key = 'command_palette_recent:demo:1'
    for (let index = 0; index < COMMAND_PALETTE_RECENT_LIMIT + 2; index++) {
      pushCommandPaletteRecent(key, { id: `nav:${index}`, title: `Page ${index}`, path: `/p${index}`, extra: 'dropped' })
    }
    pushCommandPaletteRecent(key, { id: 'nav:6', title: 'Page 6', path: '/p6' })
    const recent = readCommandPaletteRecent(key)
    expect(recent).toHaveLength(COMMAND_PALETTE_RECENT_LIMIT)
    expect(recent[0].id).toBe('nav:6')
    expect(recent.filter(item => item.id === 'nav:6')).toHaveLength(1)
    expect(recent[0].extra).toBeUndefined()
  })

  it('rejects unsafe or broken entries and storage errors', () => {
    const key = 'command_palette_recent:demo:2'
    pushCommandPaletteRecent(key, { id: 'x', path: 'https://evil.test' })
    expect(readCommandPaletteRecent(key)).toEqual([])
    window.localStorage.setItem(key, '{broken')
    expect(readCommandPaletteRecent(key)).toEqual([])
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    // Blocked storage: the palette keeps the list for this session only
    expect(pushCommandPaletteRecent(key, { id: 'nav:a', path: '/a' })).toEqual([{ id: 'nav:a', path: '/a' }])
    vi.restoreAllMocks()
    expect(readCommandPaletteRecent(key)).toEqual([])
    expect(readCommandPaletteRecent(null)).toEqual([])
  })
})

describe('command palette shortcut', () => {
  const event = (overrides) => ({ key: 'k', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, target: {}, ...overrides })

  it('uses ⌘K on macOS and Ctrl+K elsewhere', () => {
    expect(isCommandPaletteShortcut(event({ metaKey: true }), true)).toBe(true)
    expect(isCommandPaletteShortcut(event({ ctrlKey: true }), true)).toBe(false)
    expect(isCommandPaletteShortcut(event({ ctrlKey: true }), false)).toBe(true)
    expect(isCommandPaletteShortcut(event({ metaKey: true }), false)).toBe(false)
    expect(isCommandPaletteShortcut(event({ key: 'K', ctrlKey: true }), false)).toBe(true)
  })

  it('leaves the key to editors and other shortcuts', () => {
    expect(isCommandPaletteShortcut(event({ ctrlKey: true, shiftKey: true }), false)).toBe(false)
    expect(isCommandPaletteShortcut(event({ ctrlKey: true, defaultPrevented: true }), false)).toBe(false)
    expect(isCommandPaletteShortcut(event({ ctrlKey: true, target: { isContentEditable: true } }), false)).toBe(false)
    expect(isCommandPaletteShortcut(event({ key: 'j', ctrlKey: true }), false)).toBe(false)
    expect(isCommandPaletteShortcut(null, false)).toBe(false)
  })

  it('describes the shortcut for each platform', () => {
    expect(getCommandPaletteShortcut(true)).toMatchObject({ label: '⌘K', ariaKeyShortcuts: 'Meta+K' })
    expect(getCommandPaletteShortcut(false)).toMatchObject({ label: 'Ctrl+K', ariaKeyShortcuts: 'Control+K' })
    expect(isMacPlatform({ platform: 'MacIntel' })).toBe(true)
    expect(isMacPlatform({ userAgentData: { platform: 'Windows' } })).toBe(false)
  })
})

describe('seedCommandPaletteI18n', () => {
  it('calls t with literal keys and ignores a missing t', () => {
    const t = vi.fn()
    seedCommandPaletteI18n(t)
    expect(t).toHaveBeenCalledWith('SETTINGS_GROUP_PAYMENTS', 'Payments')
    expect(() => seedCommandPaletteI18n(undefined)).not.toThrow()
  })
})
