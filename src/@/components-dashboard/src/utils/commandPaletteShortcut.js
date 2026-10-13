/**
 * Command palette keyboard shortcut. Pure, no React.
 *
 * ⌘K on macOS and Ctrl+K on Windows and Linux. On macOS Ctrl+K stays free
 * (it deletes to the end of the line in text fields).
 */

export const isMacPlatform = (nav = typeof navigator !== 'undefined' ? navigator : undefined) => {
  const platform = nav?.userAgentData?.platform || nav?.platform || nav?.userAgent || ''
  return /mac|iphone|ipad|ipod/i.test(platform)
}

export const getCommandPaletteShortcut = (isMac = isMacPlatform()) => ({
  isMac,
  keys: isMac ? ['⌘', 'K'] : ['Ctrl', 'K'],
  label: isMac ? '⌘K' : 'Ctrl+K',
  ariaKeyShortcuts: isMac ? 'Meta+K' : 'Control+K'
})

/**
 * `true` for the palette shortcut. Rich text editors that already handle the
 * key (Summernote opens its link dialog) keep it.
 */
export const isCommandPaletteShortcut = (event, isMac = isMacPlatform()) => {
  if (!event || event.defaultPrevented) return false
  if (String(event.key || '').toLowerCase() !== 'k') return false
  if (event.shiftKey || event.altKey) return false
  const modifier = isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey
  if (!modifier) return false
  if (event.target?.isContentEditable) return false
  return true
}
