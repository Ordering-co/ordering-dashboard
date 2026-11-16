// redesign billing-modal (C-4): promoted from Shared/UI/SidebarMenu.jsx, the second user is the Billing
// dialog, whose opener unmounts while it is open (or never existed: the past-due start-up opens it by itself).

export const isShown = element => !element.closest('[hidden], [inert], [aria-hidden="true"]') && element.getClientRects().length > 0

// redesign 5.1 audit (H4): when the menu closes and the button that opened it is gone (the page
// header's menu button unmounts while the menu is open), focus must not fall to <body>. It goes to
// the first visible h1 and, if the page has none, to the main container; neither is focusable by
// itself, so it gets a tabindex of -1 only until it loses focus.
// (#76a): the shell's <main> is `display: contents`: it has no client rects and focus() on it does nothing. An element
// with no box is replaced by its first child that has one (the page's own root), never used as the target.
const boxOf = element => {
  if (!element) return null
  if (isShown(element)) return element
  return [...element.children].map(boxOf).find(Boolean) || null
}

export const PAGE_START_ATTRIBUTE = 'data-odc-page-start'

export const focusPageStart = nav => {
  const heading = [...document.querySelectorAll('h1')].find(h1 => !nav?.contains(h1) && isShown(h1))
  const target = heading || boxOf(document.querySelector('main, [role="main"]')) || boxOf(nav?.nextElementSibling) || nav?.nextElementSibling
  if (!target) return
  if (target.tabIndex < 0 && !target.hasAttribute('tabindex')) {
    target.setAttribute('tabindex', '-1')
    target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true })
  }
  // the destination is not always `.odc-pagehead-title` (a 404 or offline h1, a main container), the only element the brand
  // ring was written for, so it left the browser's own. The mark lets the shell's CSS (sidebar.css) give any destination the brand ring
  // while it has the focus. Added once per claim, gone when the focus leaves, like the tabindex.
  if (!target.hasAttribute(PAGE_START_ATTRIBUTE)) {
    target.setAttribute(PAGE_START_ATTRIBUTE, '')
    target.addEventListener('blur', () => target.removeAttribute(PAGE_START_ATTRIBUTE), { once: true })
  }
  target.focus()
}
