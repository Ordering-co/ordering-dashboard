import { useSession } from '../../../index'

/**
 * Returns true when the user is a business-owner with the "selected access"
 * role (user.selected_access === true). Those users get a restricted view:
 * only Delivery/Pickup & More and Payment Methods sections, and within
 * Payment Methods only Braintree gateways.
 * Admins (level 0) and regular BOs without the flag return false.
 */
export const useSelectedAccessRole = () => {
  const [{ user }] = useSession()
  if (user?.level === 0) return false
  return user?.selected_access === true
}
