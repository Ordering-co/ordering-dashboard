import { useEffect, useRef, useState } from 'react'
import { useApi, useLanguage, useSession } from '../../../../../index'
import { toAlertContent } from '../../../../../utils/alertContent'

export const DRIVER_PLATE_KEY = 'plate'

// redesign UF-B3 (M-UF18, M-UF5): the plate is the `plate` metafield of the driver. What changes against main:
// a non-2xx answer is an error even when its body has no `error`, the error is always a text (never an object, never empty),
// and an answer that arrives after the component left or after another user was opened is ignored. Same endpoints, same
// bodies, same upper-casing and the same «plate first, then the user» order (the caller decides it).

const INITIAL = { loading: false, error: null }

export const useDriverPlate = (userId) => {
  const [ordering] = useApi()
  const [session] = useSession()
  const [, t] = useLanguage()

  const [plate, setPlate] = useState('')
  const [savedPlate, setSavedPlate] = useState('')
  const [metafieldId, setMetafieldId] = useState(null)
  const [state, setState] = useState(INITIAL)
  // Counts the user the hook is about: it moves on when the user changes and when the component leaves, and an answer
  // that was asked under an older count is dropped.
  const generation = useRef(0)

  const requestHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.token}`
  }

  const saveFailure = t('USER_SAVE_ERROR', 'We couldn\'t save the changes. Try again.')
  const loadFailure = t('USER_FORM_PLATE_LOAD_ERROR', 'We couldn\'t load the license plate.')

  // One text for whatever went wrong: the message of the API when there is one, else the generic sentence.
  const failureText = (body, fallback) => toAlertContent(body?.result ?? body?.message, fallback)[0] ?? fallback

  const getPlate = async (current) => {
    if (!userId) return
    try {
      setState({ loading: true, error: null })
      const response = await fetch(`${ordering.root}/users/${userId}/metafields`, {
        method: 'GET',
        headers: requestHeaders
      })
      const body = await response.json()
      if (current !== generation.current) return
      if (!response.ok || body?.error) {
        setState({ loading: false, error: failureText(body, loadFailure) })
        return
      }
      const metafield = body?.result?.find?.(field => field?.key === DRIVER_PLATE_KEY)
      setMetafieldId(metafield?.id ?? null)
      setPlate(metafield?.value ?? '')
      setSavedPlate(metafield?.value ?? '')
      setState({ loading: false, error: null })
    } catch (err) {
      if (current !== generation.current) return
      setState({ loading: false, error: toAlertContent(err?.message, loadFailure)[0] })
    }
  }

  const savePlate = async () => {
    const value = plate.trim().toUpperCase()
    if (value === savedPlate) return true
    const current = generation.current
    try {
      setState({ loading: true, error: null })

      let response
      if (!value && metafieldId) {
        response = await fetch(`${ordering.root}/users/${userId}/metafields/${metafieldId}`, {
          method: 'DELETE',
          headers: requestHeaders
        })
      } else if (metafieldId) {
        response = await fetch(`${ordering.root}/users/${userId}/metafields/${metafieldId}`, {
          method: 'PUT',
          headers: requestHeaders,
          body: JSON.stringify({ key: DRIVER_PLATE_KEY, value, value_type: 'text' })
        })
      } else if (value) {
        response = await fetch(`${ordering.root}/users/${userId}/metafields`, {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify({ key: DRIVER_PLATE_KEY, value, value_type: 'text' })
        })
      } else {
        setState({ loading: false, error: null })
        return true
      }

      const body = await response.json()
      // the user changed or the form left while it was writing: nothing here belongs to the screen any more
      if (current !== generation.current) return false
      if (!response.ok || body?.error) {
        setState({ loading: false, error: failureText(body, saveFailure) })
        return false
      }

      setMetafieldId(value ? (body?.result?.id ?? metafieldId) : null)
      setPlate(value)
      setSavedPlate(value)
      setState({ loading: false, error: null })
      return true
    } catch (err) {
      if (current !== generation.current) return false
      setState({ loading: false, error: toAlertContent(err?.message, saveFailure)[0] })
      return false
    }
  }

  useEffect(() => {
    generation.current += 1
    // nothing of the user before stays on screen while the new one is read
    setPlate('')
    setSavedPlate('')
    setMetafieldId(null)
    setState(INITIAL)
    getPlate(generation.current)
    return () => { generation.current += 1 }
  }, [userId])

  return {
    plate,
    setPlate,
    savePlate,
    // redesign UF-B3 (M-UF18): «Discard» puts the saved plate back
    resetPlate: () => {
      setPlate(savedPlate)
      setState(current => (current.error ? { ...current, error: null } : current))
    },
    isPlateDirty: plate.trim().toUpperCase() !== savedPlate,
    plateState: state
  }
}
