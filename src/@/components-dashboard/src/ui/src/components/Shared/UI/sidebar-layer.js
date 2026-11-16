const sidebarRefs = new Set()
const dismissalSnapshots = new WeakMap()

const connectedSidebars = () => [...sidebarRefs]
  .map(ref => ref.current)
  .filter(element => element?.isConnected)

const deepestMatch = (elements, candidates) => {
  for (const element of elements) {
    const matches = candidates.filter(candidate => candidate === element || candidate.contains(element))
    if (!matches.length) continue
    return matches.reduce((deepest, candidate) => (
      deepest.contains(candidate) ? candidate : deepest
    ))
  }
  return null
}

const paintedSidebar = candidates => {
  if (typeof document.elementsFromPoint !== 'function') return null
  const rects = candidates.map(element => element.getBoundingClientRect())
    .filter(rect => rect.width > 0 && rect.height > 0)
  if (rects.length !== candidates.length) return null
  const left = Math.max(...rects.map(rect => rect.left))
  const right = Math.min(...rects.map(rect => rect.right))
  const top = Math.max(...rects.map(rect => rect.top))
  const bottom = Math.min(...rects.map(rect => rect.bottom))
  if (left >= right || top >= bottom) return null
  return deepestMatch(document.elementsFromPoint((left + right) / 2, (top + bottom) / 2), candidates)
}

const domTopSidebar = candidates => candidates.reduce((top, candidate) => {
  if (top.contains(candidate)) return candidate
  if (candidate.contains(top)) return top
  return top.compareDocumentPosition(candidate) & 4 ? candidate : top
})

const topPaintedSidebar = () => {
  const candidates = connectedSidebars()
  if (!candidates.length) return null
  return paintedSidebar(candidates) || domTopSidebar(candidates)
}

export const registerSidebar = ref => {
  sidebarRefs.add(ref)
  return () => sidebarRefs.delete(ref)
}

export const isTopPaintedSidebar = ref => {
  if (!ref.current?.isConnected) return false
  return topPaintedSidebar() === ref.current
}

export const captureSidebarDismissal = (event, modalBlocked) => {
  if (event.type === 'keydown' && event.code !== 'Escape') return
  if (dismissalSnapshots.has(event)) return
  dismissalSnapshots.set(event, {
    modalBlocked,
    owner: modalBlocked ? null : topPaintedSidebar()
  })
}

export const ownsCapturedSidebarDismissal = (event, ref) => {
  const snapshot = dismissalSnapshots.get(event)
  return Boolean(snapshot && !snapshot.modalBlocked && snapshot.owner === ref.current)
}
