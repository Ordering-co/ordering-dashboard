import { useApi, useSite } from '../../../index'
import { useProjectState } from '../contexts/ProjectContext'
import { getPreferredSiteUrl } from '../utils/getPreferredSiteUrl'

export const useWebsiteUrl = () => {
  const [ordering, { configurations }] = useApi()
  const [{ sites, loading }] = useSite()
  const [projectStatus] = useProjectState()

  if (loading) return null

  return getPreferredSiteUrl({
    sites,
    configurations,
    ordering,
    websiteProduct: projectStatus?.websiteProduct || null
  })
}

export const useStoreWebsiteUrl = (slug) => {
  const websiteUrl = useWebsiteUrl()
  return websiteUrl && slug ? `${websiteUrl.replace(/\/+$/, '')}/store/${encodeURIComponent(slug)}` : null
}
