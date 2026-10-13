const parseApiResponse = async response => {
  const content = await response.json()
  if (!response.ok || content?.error) {
    const result = content?.result
    const message = Array.isArray(result) ? result.join(' ') : result?.message || result || 'The promotion could not be saved.'
    throw new Error(String(message))
  }
  return content.result
}

export const savePromotionJourney = async ({ root, token, payload, promotionId, enabled = false }) => {
  const response = await fetch(`${root}/offers${promotionId ? `/${promotionId}` : ''}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ ...payload, enabled: !!enabled })
  })
  return parseApiResponse(response)
}

export const updatePromotionJourneyStatus = async ({ root, token, promotionId, enabled }) => {
  if (!promotionId) throw new Error('A saved promotion is required before changing its status.')
  const response = await fetch(`${root}/offers/${promotionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ enabled })
  })
  return parseApiResponse(response)
}

export const deletePromotionJourney = async ({ root, token, promotionId }) => {
  if (!promotionId) throw new Error('A saved promotion is required before deletion.')
  const response = await fetch(`${root}/offers/${promotionId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  })
  if (response.status === 204) return { id: promotionId }
  return parseApiResponse(response)
}

export const getPromotionLoyaltyLevels = async ({ root, token }) => {
  const response = await fetch(`${root}/loyalty_levels`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  })
  return parseApiResponse(response)
}

export const getAllPromotionBusinesses = async ({ ordering, token, userLevel, pageSize = 100 }) => {
  const safePageSize = Math.max(1, Number(pageSize) || 100)
  const fetchPage = async page => {
    let content

    if (userLevel === 0) {
      const response = await fetch(`${ordering.root}/backoffice/businesses?params=id,name,slug&page=${page}&page_size=${safePageSize}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      })
      content = await response.json()
      if (!response.ok) content = { error: true, result: content?.result || content }
    } else {
      const endpoint = ordering
        .setAccessToken(token)
        .businesses()
        .select(['id', 'name', 'slug'])
        .asDashboard()
      const response = await endpoint.get({ query: { page, page_size: safePageSize } })
      content = response.content
    }

    if (content?.error) {
      const result = content?.result
      const message = Array.isArray(result) ? result.join(' ') : result?.message || result || 'Businesses could not be loaded.'
      throw new Error(String(message))
    }
    return content
  }

  const firstPage = await fetchPage(1)
  const totalPages = Math.max(1, Number(firstPage?.pagination?.total_pages) || 1)
  const businesses = Array.isArray(firstPage?.result) ? [...firstPage.result] : []
  for (let page = 2; page <= totalPages; page++) {
    const content = await fetchPage(page)
    if (Array.isArray(content?.result)) businesses.push(...content.result)
  }
  return businesses
}
