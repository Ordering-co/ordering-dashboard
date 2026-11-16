/**
 * Base UI positioners (Menu, Popover, Tooltip) take offsets as numbers. To keep
 * those offsets on the token scale instead of literals in code, resolve the CSS
 * length variable to pixels when the popup positions itself, inside the scope
 * that defines it (so candidates and dark scopes apply).
 *
 *   <Menu.Positioner sideOffset={tokenOffset('--od-space-1')} />
 */
export const tokenPx = (name, scope) => {
  if (typeof document === 'undefined') return 0
  const host = scope?.isConnected ? scope : document.body
  const probe = document.createElement('span')
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;inline-size:var(${name})`
  host.appendChild(probe)
  const px = probe.getBoundingClientRect().width
  probe.remove()
  return Number.isFinite(px) ? px : 0
}

/** A Base UI `sideOffset` / `alignOffset` function that reads a token. */
export const tokenOffset = name => ({ positioner }) => tokenPx(name, positioner)
