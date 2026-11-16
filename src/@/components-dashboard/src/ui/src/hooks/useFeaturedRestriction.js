import { useSession } from '../../../index'

/**
 * main: Featured (the column, the switch, the bulk Feature/Unfeature and the filter) is for administrators only.
 * True when the session cannot feature stores: every level but 0. It replaces the EatStreet owner restriction main removed.
 */
export const useFeaturedRestriction = () => {
  const [{ user }] = useSession()
  return user?.level !== 0
}
