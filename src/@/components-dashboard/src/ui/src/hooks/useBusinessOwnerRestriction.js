import { useSession, useApi } from '../../../index'

const EATSTREET_PROJECTS = ['eatstreet', 'eatstreetstaging']

export const useBusinessOwnerRestriction = () => {
  const [{ user }] = useSession()
  const [ordering] = useApi()
  const isEatstreet = EATSTREET_PROJECTS.includes(ordering?.project)
  const isBusinessOwner = user?.level !== 0
  return isEatstreet && isBusinessOwner
}
