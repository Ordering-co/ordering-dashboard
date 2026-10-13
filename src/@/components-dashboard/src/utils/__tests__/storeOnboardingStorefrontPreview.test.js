import { it, expect } from 'vitest'
import { storefrontDraftBusiness } from '../storeOnboardingStorefrontPreview'
import { createDraft } from '../storeOnboarding'
it('projects only the current public draft in the native business shape, preserving menu media and zero prices', () => {
  const { form } = createDraft('private@example.com')
  Object.assign(form, { name: 'Restaurant', token: 'secret', logo: 'data:image/png;base64,aW1hZ2U=', categories: [{ key: 'private-key', name: 'Food', products: [{ name: 'Free item', price: '0', description: 'Sample', images: 'https://cdn.example/food.png' }] }] })
  const business = storefrontDraftBusiness(form)
  expect(business).toMatchObject({ name: 'Restaurant', slug: 'onboarding_preview', enabled: true, lazy_load_products_recommended: true })
  expect(business.products[0]).toMatchObject({ price: 0, name: 'Free item', images: 'https://cdn.example/food.png' })
  expect(business.products[0].category_id).toBe(business.categories[0].id)
  expect(business.schedule).toHaveLength(7)
  expect(JSON.stringify(business)).not.toMatch(/private@example|private-key|secret|journal|payments/)
})
it('keeps an empty menu empty and rejects executable or credential-bearing images', () => {
  const business = storefrontDraftBusiness({ name: 'Empty', logo: 'https://user:secret@cdn.example/logo', categories: [] })
  expect(business.lazy_load_products_recommended).toBe(true)
  expect(business.categories).toEqual([])
  expect(business.products).toEqual([])
  expect(business.logo).toBe('')
})

it('uses the same Delivery priority in the preview after Pickup was selected first', () => {
  const business = storefrontDraftBusiness({ orderTypes: [2, 1], categories: [] })
  expect(business.types).toEqual([1, 2])
})
