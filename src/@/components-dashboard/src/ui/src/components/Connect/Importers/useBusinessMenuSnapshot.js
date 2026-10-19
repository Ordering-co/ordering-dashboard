import { useCallback, useState } from 'react'
import { useApi } from '~components'

const SNAPSHOT_FIELDS = ['id', 'categories', 'available_products_count']

/**
 * Category and product counts of a business, read from the Ordering API.
 * Evidence for an import result; never throws, `null` when the read fails.
 * @returns {Promise<{ categories: number, products: number } | null>}
 */
export const fetchBusinessMenuSnapshot = async (ordering, businessId) => {
  if (!ordering || businessId == null) return null
  try {
    const { content } = await ordering.businesses(businessId).select(SNAPSHOT_FIELDS).get()
    if (content?.error || !content?.result) return null
    const { categories, available_products_count: products } = content.result
    return {
      categories: Array.isArray(categories) ? categories.length : 0,
      products: Number(products) || 0
    }
  } catch {
    return null
  }
}

/** On-demand snapshot for a `Check now` action. Nothing is fetched until `refetch`. */
export const useBusinessMenuSnapshot = (businessId) => {
  const [ordering] = useApi()
  const [snapshot, setSnapshot] = useState(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  const refetch = useCallback(async () => {
    setLoading(true)
    const next = await fetchBusinessMenuSnapshot(ordering, businessId)
    setSnapshot(next)
    setFailed(next === null)
    setLoading(false)
    return next
  }, [ordering, businessId])

  return { snapshot, loading, failed, refetch }
}
