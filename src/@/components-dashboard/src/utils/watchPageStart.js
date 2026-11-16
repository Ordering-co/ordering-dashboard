// promoted from Shared/UI/SidebarMenu.jsx. The phone drawer and the ⌘K navigation both leave the focus on <body> (the control that
// had it unmounts) and the page they open is lazy, so its title paints late. See focusPageStart for the target.
import { focusPageStart, isShown } from './focusPageStart'

// (row 20a, second pass): pages behind React.lazy/Suspense paint a skeleton first, so two frames after the menu closed
// the title of the chosen page may not be there yet, or the focus lands on a skeleton element that unmounts afterwards (and falls to
// <body>). For a bounded window, claim the start of the new page as soon as it has a visible h1, every time the focus is lost
// (on <body>, on an element that was removed, or still inside the closed menu). It stops the moment the person acts (pointerdown or
// keydown, also in the frames before it arms), the focus is on any other connected element, the window ends or the caller cancels.
const PAGE_START_WATCH_MS = 3000
export const watchPageStart = (nav, { onlyIfLost = false } = {}) => {
  let ours = null
  let finished = false
  let observer = null
  let timer = 0
  let interval = 0
  const hasTitle = () => [...document.querySelectorAll('h1')].some(h1 => !nav?.contains(h1) && isShown(h1))
  let claiming = false
  let armed = false
  const claim = () => {
    // focus() fires focusout on the element that loses it, while <body> is still the active element: do not re-enter.
    claiming = true
    try { focusPageStart(nav) } finally { claiming = false }
    ours = document.activeElement === document.body ? null : document.activeElement
  }
  const stop = () => {
    if (finished) return
    finished = true
    observer?.disconnect()
    clearTimeout(timer)
    clearInterval(interval)
    document.removeEventListener('pointerdown', stop, true)
    document.removeEventListener('keydown', stop, true)
    document.removeEventListener('focusout', onFocusOut)
    document.removeEventListener('focusin', onFocusIn)
  }
  const isLost = () => {
    const active = document.activeElement
    return !active || active === document.body || !active.isConnected || !!nav?.contains(active)
  }
  function check () {
    if (finished || claiming || !armed) return
    const active = document.activeElement
    if (isLost()) {
      if (hasTitle()) claim()
    } else if (active === ours) {
      // What this watch focused is still there; a main container is replaced by the title once the page paints one.
      if (ours.tagName !== 'H1' && hasTitle()) claim()
    } else {
      stop()
    }
  }
  // (review): with `onlyIfLost` the destination may move the focus into its own panel or field at any time. The browser does
  // that in two steps (focusout with <body> active, then focusin), so the focusout is judged once the focus has landed, and a focusin on
  // any other control (not ours, not the menu) means the destination took it: the watch ends instead of pulling it back to the title.
  function onFocusOut () {
    if (onlyIfLost) setTimeout(check, 0)
    else check()
  }
  function onFocusIn (event) {
    if (!onlyIfLost || finished || claiming) return
    const target = event.target
    if (target && target !== ours && target !== document.body && !nav?.contains(target)) stop()
  }
  // The listeners that stop it start with the collapse; it only acts (arm) once the route had two frames to paint.
  // `onlyIfLost` is for a caller whose destination may have put the focus inside by itself (a panel or a form opened by ⌘K):
  // arming then claims the page start only if the focus was actually lost, instead of taking it from that panel.
  const arm = () => {
    if (finished) return
    armed = true
    if (onlyIfLost) check()
    else claim()
  }
  document.addEventListener('pointerdown', stop, true)
  document.addEventListener('keydown', stop, true)
  document.addEventListener('focusout', onFocusOut)
  document.addEventListener('focusin', onFocusIn)
  observer = new MutationObserver(check)
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'inert', 'aria-hidden', 'style', 'class'] })
  interval = setInterval(check, 150)
  // A page with no title at all (onlyIfLost): at the end of the window the focus still lost goes to the main container, not to <body>.
  timer = setTimeout(() => {
    if (onlyIfLost && armed && !finished && isLost()) claim()
    stop()
  }, PAGE_START_WATCH_MS)
  return { arm, stop }
}
