import { useSession } from '../../../contexts/SessionContext'

export const firstLetterCapital = (text) => {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

export const getUserType = (type = '') => {
  const [{ user }] = useSession()
  if (!type) return true
  if (type === 'readOnlyBusinessOwner') return !!user?.readOnlyBusinessOwner
  if (type === 'readOnlyAdmin') return !!user?.readOnlyAdmin
  if (type === 'readOnlyDeliveryManager') return !!user?.readOnlyDeliveryManager
  if (type === 'viewOnlyBusinessOwner') return !!user?.viewOnlyBusinessOwner

  return false
}
