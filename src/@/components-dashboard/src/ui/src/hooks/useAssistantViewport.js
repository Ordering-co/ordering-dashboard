import { useLayoutEffect, useRef } from 'react'

export const useAssistantViewport = (active, fixed = false) => {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!active || !element) return
    const viewport = window.visualViewport
    const update = () => {
      const top = viewport?.offsetTop || 0
      const height = viewport?.height || window.innerHeight
      const available = fixed ? height : height + top - element.getBoundingClientRect().top
      element.style.setProperty('--assistant-viewport-top', `${top}px`)
      element.style.setProperty('--assistant-viewport-height', `${Math.max(0, available)}px`)
    }
    update()
    window.addEventListener('resize', update)
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    return () => {
      window.removeEventListener('resize', update)
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
    }
  }, [active, fixed])

  return ref
}
