import { hasDraftMediaReferences } from './storeOnboardingDraftMedia'
import { onboardingWebsiteCandidates, onboardingWebsiteUrl, isOnboardingFranchise } from './storeOnboardingWebsite'
import { websitePrimaryColor, websiteColorValues, validWebsiteColor, validWebsiteTarget } from './storeOnboardingAppearance'
import { regionalConfigUpdates } from './storeOnboardingRegional'
import { menuMediaPayload, businessPayload, zonePayload, slugify, validateForm } from './storeOnboarding'

export const createOnboardingApi = ({ root, token, fetcher = fetch, signal: lifecycleSignal, websiteProduct = null }) => {
  const request = async (path, { method = 'GET', body, signal, withPagination = false } = {}) => {
    const abort = new AbortController()
    const parent = signal || lifecycleSignal
    const cancel = () => abort.abort()
    if (parent?.aborted) throw new Error('cancelled')
    parent?.addEventListener('abort', cancel, { once: true })
    const timer = setTimeout(cancel, 30000)
    try {
      const url = new URL(`${root}${path}`)
      if (method === 'GET') url.searchParams.set('mode', 'dashboard')
      const response = await fetcher(url.href, {
        method,
        signal: abort.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-INTERNAL-PRODUCT-X': 'dashboard' },
        ...(body !== undefined && { body: JSON.stringify(body) })
      })
      let content
      try { content = await response.json() } catch { throw new Error('invalid_response') }
      if (parent?.aborted || abort.signal.aborted) throw new Error('cancelled')
      if (!response.ok || content.error !== false || content.result == null) {
        const error = new Error('request_failed')
        error.rejected = response.status >= 400 && response.status < 500 && response.status !== 408
        throw error
      }
      return withPagination ? { result: content.result, pagination: content.pagination } : content.result
    } finally { clearTimeout(timer); parent?.removeEventListener('abort', cancel) }
  }
  const list = async (path, signal) => {
    const result = await request(path, { signal })
    if (!Array.isArray(result) || result.some(item => !item || !Number.isInteger(Number(item.id)) || Number(item.id) <= 0)) throw new Error('invalid_response')
    return result
  }
  const query = (path, attribute, value) => `${path}?${new URLSearchParams({ where: JSON.stringify([{ attribute, value }]), page_size: '2' })}`
  const find = async (path, attribute, value) => {
    const rows = await list(query(path, attribute, value))
    const found = rows.filter(row => String(row[attribute]) === String(value))
    if (found.length > 1) throw new Error('ambiguous_resource')
    return found[0]
  }
  const requireId = result => {
    if (!result || !Number.isInteger(Number(result.id)) || Number(result.id) <= 0) throw new Error('invalid_response')
    return result
  }
  const discover = async (draft, signal) => {
    if (draft?.journal?.businessId) {
      const own = await list(`${query('/business', 'id', Number(draft.journal.businessId))}&params=id`, signal)
      if (own.some(store => Number(store.id) === Number(draft.journal.businessId))) return true
      return (await list('/business?params=id&page_size=1', signal)).length === 0 ? 'reset-required' : 'reset-ready'
    }
    if (draft?.journal?.started || draft?.journal?.published) return true
    return (await list('/business?params=id&page_size=1', signal)).length === 0
  }
  const bootstrap = async signal => {
    const [paymethods, configs, countries] = await Promise.all([list('/paymethods', signal), request('/configs', { signal }), list('/countries', signal).catch(() => [])])
    if (!Array.isArray(configs) || configs.some(c => !c || typeof c.key !== 'string')) throw new Error('invalid_response')
    return { countries, paymethods: paymethods.filter(p => p.enabled && ['cash', 'card_delivery'].includes(p.gateway)), configs: Object.fromEntries(configs.map(c => [c.key, c])) }
  }
  const completeWebsiteRows = async (path, signal) => {
    const { result, pagination } = await request(`${path}?page_size=100`, { signal, withPagination: true })
    if (!Array.isArray(result)) throw new Error('invalid_website_catalog')
    if (pagination != null) {
      if (typeof pagination !== 'object' || Array.isArray(pagination)) throw new Error('invalid_website_catalog')
      for (const key of ['current_page', 'total_pages', 'total', 'total_items']) {
        const value = pagination[key]
        if (value == null) continue
        if (!['number', 'string'].includes(typeof value) || (typeof value === 'string' && !/^\d+$/.test(value)) || !Number.isFinite(Number(value)) || !Number.isInteger(Number(value)) || Number(value) < 0) throw new Error('invalid_website_catalog')
      }
      if (result.length && ((pagination.total_pages != null && Number(pagination.total_pages) === 0) || (pagination.current_page != null && Number(pagination.current_page) !== 1))) throw new Error('invalid_website_catalog')
      for (const key of ['total', 'total_items']) {
        if (pagination[key] != null && Number(pagination[key]) < result.length) throw new Error('invalid_website_catalog')
        if (pagination[key] != null && Number(pagination[key]) > result.length) throw new Error('incomplete_website_catalog')
      }
      if (Number(pagination.total_pages ?? 1) > 1 || (pagination.next_page && pagination.next_page !== '0')) throw new Error('incomplete_website_catalog')
    }
    if (result.length >= 100) throw new Error('incomplete_website_catalog')
    return result
  }
  const websiteTheme = async (siteId, themeId, signal) => {
    const rows = await completeWebsiteRows(`/sites/${siteId}/themes`, signal)
    if (!Array.isArray(rows) || rows.some(row => !row || !['number', 'string'].includes(typeof row.theme_id) || !Number.isInteger(Number(row.theme_id)) || Number(row.theme_id) <= 0)) throw new Error('invalid_website_theme')
    const matches = themeId ? rows.filter(row => Number(row.theme_id) === Number(themeId)) : rows
    if (matches.length !== 1) throw new Error('ambiguous_website_theme')
    return matches[0]
  }
  const getWebsiteSites = async signal => {
    const sites = await completeWebsiteRows('/sites', signal)
    if (sites.some(site => !site || !['number', 'string'].includes(typeof site.id) || !Number.isInteger(Number(site.id)) || Number(site.id) <= 0)) throw new Error('invalid_website_catalog')
    return sites
  }
  const getWebsiteAppearance = async signal => {
    const sites = await getWebsiteSites(signal)
    const candidates = onboardingWebsiteCandidates(sites, { websiteProduct })
    if (candidates.length !== 1) throw new Error('ambiguous_website')
    const site = candidates[0]
    const theme = await websiteTheme(site.id, null, signal)
    return { siteId: Number(site.id), themeId: Number(theme.theme_id), color: websitePrimaryColor(theme.values), preview: { url: onboardingWebsiteUrl(site, { root, websiteProduct }), apiRoot: root, code: isOnboardingFranchise(site) ? 'web_franchises_x' : site.code } }
  }
  const checkWebsiteColor = async form => {
    if (!form.websiteColor) return null
    const target = form.websiteAppearanceTarget
    if (!validWebsiteColor(form.websiteColor) || !validWebsiteTarget(target)) throw new Error('invalid_website_color')
    const sites = await getWebsiteSites()
    const candidates = onboardingWebsiteCandidates(sites, { websiteProduct })
    if (candidates.length !== 1 || Number(candidates[0].id) !== target.siteId) throw new Error('website_target_changed')
    const theme = await websiteTheme(target.siteId, target.themeId)
    websiteColorValues(theme.values, form.websiteColor)
    return { target, theme }
  }
  const saveWebsiteColor = async form => {
    const appearance = await checkWebsiteColor(form)
    if (!appearance) return
    const { target, theme } = appearance
    if (websitePrimaryColor(theme.values)?.toLowerCase() === form.websiteColor.toLowerCase()) return
    await request(`/sites/${target.siteId}/themes/${target.themeId}`, { method: 'POST', body: { values: JSON.stringify(websiteColorValues(theme.values, form.websiteColor)) } })
    const confirmed = await websiteTheme(target.siteId, target.themeId)
    if (websitePrimaryColor(confirmed.values)?.toLowerCase() !== form.websiteColor.toLowerCase()) throw new Error('website_color_unconfirmed')
  }
  let publishing = false
  const publish = async (draft, ownerId, checkpoint) => {
    if (publishing) throw new Error('already_publishing')
    publishing = true
    const j = draft.journal
    const recovering = Boolean(j.started)
    const save = () => checkpoint(draft)
    try {
      if (!Number.isInteger(Number(ownerId)) || Number(ownerId) <= 0 || validateForm(draft.form).length) throw new Error('invalid_form')
      if (j.published) return { id: j.businessId, slug: j.slug }
      if (hasDraftMediaReferences(draft)) throw new Error('missing_draft_media')
      const meta = await bootstrap()
      const paymentIds = draft.form.payments.map(gateway => {
        const found = meta.paymethods.find(p => p.gateway === gateway)
        if (!found) throw new Error('payment_unavailable')
        return found.id
      })
      for (const key of ['order_types_allowed', 'default_order_type']) if (!Number.isInteger(Number(meta.configs[key]?.id)) || Number(meta.configs[key].id) <= 0) throw new Error('missing_order_config')
      await checkWebsiteColor(draft.form)
      const payload = businessPayload(draft, ownerId)
      if (!j.started) {
        const existing = await list('/business?params=id,external_id,slug&page_size=1')
        if (existing.length) throw new Error('store_already_exists')
        j.started = true
        await save()
      }
      let business
      if (j.businessId) business = requireId(await request(`/business/${j.businessId}?params=id,slug,enabled,external_id`))
      else {
        business = await find('/business', 'slug', payload.slug)
        if (!business) {
          if ((await list('/business?params=id&page_size=1')).length) throw new Error('store_already_exists')
          try { business = requireId(await request('/business', { method: 'POST', body: payload })) } catch (error) {
            if (!recovering && error.rejected) { j.started = false; await save() }
            throw error
          }
        }
        j.businessId = business.id
        j.slug = business.slug
        await save()
      }
      if (business.slug !== payload.slug || business.external_id !== payload.external_id) throw new Error('store_identity_mismatch')
      const base = `/business/${j.businessId}`
      if (business.enabled === true && j.resourcesComplete) {
        j.published = true; draft.step = 6; await save()
        return business
      }
      if (business.enabled === true) throw new Error('store_activated_outside_onboarding')
      if (j.resourcesComplete) { j.resourcesComplete = false; await save() }
      const zones = await list(`${base}/deliveryzones`)
      let selectedZone
      if (draft.form.orderTypes.includes(1)) {
        selectedZone = zones.find(z => Number(z.id) === Number(j.zoneId)) || zones.find(z => z.name === draft.form.zone.name.trim()) || (zones.length === 1 ? zones[0] : null)
        if (selectedZone) {
          selectedZone = requireId(await request(`${base}/deliveryzones/${selectedZone.id}`, { method: 'PUT', body: zonePayload(draft.form) }))
        } else selectedZone = requireId(await request(`${base}/deliveryzones`, { method: 'POST', body: zonePayload(draft.form) }))
        j.zoneId = selectedZone.id
        await save()
      }
      for (const zone of zones) {
        if (zone.enabled && Number(zone.id) !== Number(selectedZone?.id)) await request(`${base}/deliveryzones/${zone.id}`, { method: 'PUT', body: { enabled: false } })
      }
      const existingPayments = await list(`${base}/paymethods`)
      const globalPaymentId = payment => Number(payment.paymethod_id ?? payment.paymethod?.id)
      for (const paymethodId of paymentIds) {
        const own = existingPayments.find(p => globalPaymentId(p) === Number(paymethodId))
        const body = { enabled: true, sandbox: false, allowed_order_types: JSON.stringify(draft.form.orderTypes) }
        const payment = own
          ? requireId(await request(`${base}/paymethods/${own.id}`, { method: 'PUT', body }))
          : requireId(await request(`${base}/paymethods`, { method: 'POST', body: { paymethod_id: paymethodId, ...body } }))
        j.payments[paymethodId] = payment.id
        await save()
      }
      for (const payment of existingPayments) {
        if (payment.enabled && !paymentIds.some(id => Number(id) === globalPaymentId(payment))) await request(`${base}/paymethods/${payment.id}`, { method: 'PUT', body: { enabled: false } })
      }
      for (const category of draft.form.categories) {
        const slug = `${slugify(category.name)}_${category.key.slice(0, 8)}`
        const own = await find(`${base}/categories`, 'slug', slug)
        const created = own || requireId(await request(`${base}/categories`, { method: 'POST', body: { name: category.name.trim(), slug, enabled: true, ...menuMediaPayload(category, 'category') } }))
        if (created.enabled === false) await request(`${base}/categories/${created.id}`, { method: 'PUT', body: { enabled: true } })
        j.categories[category.key] = created.id
        await save()
        for (const product of category.products) {
          const path = `${base}/categories/${j.categories[category.key]}/products`
          const slug = `${slugify(product.name)}_${product.key.slice(0, 8)}`
          const own = await find(path, 'slug', slug)
          const created = own || requireId(await request(path, { method: 'POST', body: { name: product.name.trim(), slug, price: Number(product.price), enabled: true, ...menuMediaPayload(product, 'product') } }))
          if (created.enabled === false) await request(`${path}/${created.id}`, { method: 'PUT', body: { enabled: true } })
          j.products[product.key] = created.id
          await save()
        }
      }
      await saveWebsiteColor(draft.form)
      const allowed = [...draft.form.orderTypes].sort().join('|')
      const defaultType = ['delivery', 'pickup', 'eatin', 'curbside', 'drivethru'][Math.min(...draft.form.orderTypes) - 1]
      if (String(meta.configs.order_types_allowed.value) !== allowed) await request(`/configs/${meta.configs.order_types_allowed.id}`, { method: 'PUT', body: { value: allowed } })
      if (meta.configs.default_order_type.value !== defaultType) await request(`/configs/${meta.configs.default_order_type.id}`, { method: 'PUT', body: { value: defaultType } })
      const currentRows = await request('/configs')
      if (!Array.isArray(currentRows) || currentRows.some(c => !c || typeof c.key !== 'string')) throw new Error('invalid_response')
      const currentConfigs = Object.fromEntries(currentRows.map(c => [c.key, c]))
      for (const update of regionalConfigUpdates(currentConfigs, meta.countries)) await request(`/configs/${update.id}`, { method: 'PUT', body: { value: update.value } })
      j.resourcesComplete = true
      await save()
      const activated = requireId(await request(base, { method: 'POST', body: { enabled: true } }))
      if (activated.enabled !== true) throw new Error('publication_unconfirmed')
      j.published = true
      draft.step = 6
      await save()
      return activated
    } finally { publishing = false }
  }
  return { request, list, discover, bootstrap, publish, getWebsiteAppearance, getWebsiteSites }
}
