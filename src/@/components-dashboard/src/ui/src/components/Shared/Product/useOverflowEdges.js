import { useLayoutEffect, useRef } from 'react'

import './overflow-fade.css'

// A scroller that has not reached an edge shows more content past it. 1px of slack
// absorbs the sub-pixel rounding of scrollLeft on zoomed or scaled screens.
const SLACK = 1

const mark = (node, name, on) => {
  if (on) node.setAttribute(name, '')
  else node.removeAttribute(name)
}

const measure = node => {
  // Modern browsers run scrollLeft from 0 to a negative number in RTL, so the distance
  // scrolled from the start edge is the same in both directions.
  const scrolled = Math.abs(node.scrollLeft)
  const room = node.scrollWidth - node.clientWidth
  mark(node, 'data-overflow-start', room > SLACK && scrolled > SLACK)
  mark(node, 'data-overflow-end', room > SLACK && scrolled < room - SLACK)
}

const detach = watch => {
  if (watch.node) watch.node.removeEventListener('scroll', watch.update)
  watch.observer?.disconnect()
  watch.node = null
  watch.observer = null
  watch.update = null
}

/**
 * Keeps `data-overflow-start` / `data-overflow-end` on a sideways scroller while
 * there is more content past that edge, so the CSS can fade it (`odc-fade-x`,
 * overflow-fade.css). The edges are logical: in RTL the start edge is on the right.
 * It measures on mount, on every render of the owner, on scroll, and whenever the
 * scroller or one of its children changes size. Nothing is hidden and nothing is
 * removed from the tab order: the fade only says that the row goes on.
 */
export const useOverflowEdges = ref => {
  const watch = useRef({ node: null, observer: null, update: null })

  // After every render: pills and tabs come and go with the owner's props, and the
  // scroller itself may appear later, so attach to the current node and watch its children.
  useLayoutEffect(() => {
    const current = watch.current
    const node = ref.current
    if (current.node !== node) {
      detach(current)
      if (node) {
        current.node = node
        current.update = () => measure(node)
        node.addEventListener('scroll', current.update, { passive: true })
        current.observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(current.update)
        current.observer?.observe(node)
      }
    }
    if (!node) return
    measure(node)
    Array.from(node.children).forEach(child => current.observer?.observe(child))
  })

  useLayoutEffect(() => {
    const current = watch.current
    return () => detach(current)
  }, [])
}
