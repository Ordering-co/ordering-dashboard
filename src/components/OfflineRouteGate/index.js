import React, { useRef } from 'react'
import { useLocation } from 'react-router-dom'

// the routes of the shell while the browser has no network. They used to be unmounted (`{online && routes}`), so a short cut
// erased what the person had typed. They now stay mounted and, while there is no network, hidden and inert: the offline page (a sibling
// in ShellMain) shows in their place, and when the network is back the page reappears with its state.
//  - `hidden` takes the page out of sight and of the accessibility tree; `inert` also keeps it out of the tab order and out of reach of
//    a click. React 18 only renders `inert` as an attribute when it is a string, hence the empty string.
//  - `isShown` (utils/focusPageStart) skips anything under `[hidden], [inert]`, so «Skip to content», the menu's page-start watch and
//    the dialogs' focus return never pick the hidden page.
//  - Online it draws no box (`display: contents`, like ShellMain), so the page stays a direct flex child of the layout.
export const OfflineRouteGate = ({ online, children }) => (
  <div
    data-slot='offline-route-gate'
    hidden={!online}
    inert={online ? undefined : ''}
    style={online ? { display: 'contents' } : undefined}
  >
    {children}
  </div>
)

// (review): the routes keep matching the last location the app had with the network. A page that was never opened is a chunk
// to download: navigating to it offline (menu, ⌘K, a link) made `lazyWithReload` reload the tab, which then failed for good
// (chrome-error) and lost everything. Offline the URL still changes; the new page mounts once the network is back.
export const useRoutesLocation = (online) => {
  const location = useLocation()
  const last = useRef(location)
  if (online) last.current = location
  return last.current
}
