import { useEffect, useState } from 'react'
import { useApi, useSession } from '../../../../../index'

export const DRIVER_PLATE_KEY = 'plate'

export const useDriverPlate = (userId) => {
  const [ordering] = useApi()
  const [session] = useSession()

  const [plate, setPlate] = useState('')
  const [savedPlate, setSavedPlate] = useState('')
  const [metafieldId, setMetafieldId] = useState(null)
  const [state, setState] = useState({ loading: false, error: null })

  const requestHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.token}`
  }

  const getPlate = async () => {
    if (!userId) return
    try {
      setState({ loading: true, error: null })
      const response = await fetch(`${ordering.root}/users/${userId}/metafields`, {
        method: 'GET',
        headers: requestHeaders
      })
      const { error, result } = await response.json()
      if (error) {
        setState({ loading: false, error: Array.isArray(result) ? result[0] : result })
        return
      }
      const metafield = result?.find?.(field => field?.key === DRIVER_PLATE_KEY)
      setMetafieldId(metafield?.id ?? null)
      setPlate(metafield?.value ?? '')
      setSavedPlate(metafield?.value ?? '')
      setState({ loading: false, error: null })
    } catch (err) {
      setState({ loading: false, error: err.message })
    }
  }

  const savePlate = async () => {
    const value = plate.trim().toUpperCase()
    if (value === savedPlate) return true
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

      const { error, result } = await response.json()
      if (error) {
        setState({ loading: false, error: Array.isArray(result) ? result[0] : result })
        return false
      }

      setMetafieldId(value ? (result?.id ?? metafieldId) : null)
      setPlate(value)
      setSavedPlate(value)
      setState({ loading: false, error: null })
      return true
    } catch (err) {
      setState({ loading: false, error: err.message })
      return false
    }
  }

  useEffect(() => {
    getPlate()
  }, [userId])

  return {
    plate,
    setPlate,
    savePlate,
    isPlateDirty: plate.trim().toUpperCase() !== savedPlate,
    plateState: state
  }
}
