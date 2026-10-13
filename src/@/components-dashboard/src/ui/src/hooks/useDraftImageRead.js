import { useEffect, useRef, useState } from 'react'

export const useDraftImageRead = enabled => {
  const reader = useRef(null)
  const active = useRef(true)
  const [reading, setReading] = useState(false)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      const pending = reader.current
      reader.current = null
      if (pending?.readyState === 1) pending.abort()
    }
  }, [])
  const read = (file, onLoad, onError) => {
    if (!enabled || !active.current) return
    const previous = reader.current
    reader.current = null
    if (previous?.readyState === 1) previous.abort()
    const next = new window.FileReader()
    reader.current = next
    setReading(true)
    const finish = callback => {
      if (!active.current || reader.current !== next) return
      reader.current = null
      setReading(false)
      callback()
    }
    next.onload = () => finish(() => onLoad(next.result))
    next.onerror = () => finish(onError)
    next.readAsDataURL(file)
  }
  return { read, reading }
}
