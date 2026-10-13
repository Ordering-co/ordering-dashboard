import { useState, useEffect } from 'react'
import { getAssistantOffset } from '../utils/assistantDock'

/**
 * Size of the room the dashboard has: the window minus the docked assistant
 * panel, if it is open
 */
export const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: undefined,
    height: undefined
  })

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth - getAssistantOffset(),
        height: window.innerHeight
      })
    }

    window.addEventListener('resize', handleResize)
    handleResize()

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return windowSize
}
