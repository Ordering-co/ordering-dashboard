import { IDBFactory, IDBKeyRange, IDBObjectStore } from 'fake-indexeddb'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createDraft } from '../storeOnboarding'
import { createDraftMedia, deleteDraftMedia } from '../storeOnboardingDraftMedia'
beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('IDBKeyRange', IDBKeyRange) })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
const image = 'data:image/png;base64,aW1hZ2U='
it('commits one shared image before compact metadata and rehydrates logo, categories and both menu drafts', async () => {
  const draft = createDraft('owner@example.com')
  draft.form.logo = image
  draft.form.categories = [{ key: 'cat', name: 'Food', image, products: [{ key: 'prod', name: 'Pizza', price: '2', images: image }] }]
  draft.form.menuDrafts = { manual: draft.form.categories, sample: draft.form.categories }
  const put = vi.spyOn(IDBObjectStore.prototype, 'put')
  const storage = createDraftMedia('project:user')
  const encoded = storage.encode(draft)
  expect(JSON.stringify(encoded.draft)).not.toContain('data:image')
  expect(() => storage.resolve(encoded.draft)).toThrow('missing_draft_media')
  await encoded.ready
  expect(put).toHaveBeenCalledOnce()
  expect(await createDraftMedia('project:user').load(encoded.draft)).toEqual(draft)
  const typing = storage.encode({ ...draft, form: { ...draft.form, name: 'Edited name' } })
  expect(typing.ready).toBeNull()
  expect(put).toHaveBeenCalledOnce()
})
it('keeps owner isolation and fails on missing persisted images rather than silently dropping them', async () => {
  const draft = createDraft('owner@example.com'); draft.form.logo = image
  const storage = createDraftMedia('tenantA:user'); const encoded = storage.encode(draft); await encoded.ready
  await expect(createDraftMedia('tenantB:user').load(encoded.draft)).rejects.toThrow('missing_draft_media')
  const other = { ...encoded.draft, nonce: crypto.randomUUID() }
  await expect(createDraftMedia('tenantA:user').load(other)).rejects.toThrow('missing_draft_media')
})
it('supports retry after media writes fail and does not mark failed data as durable', async () => {
  const draft = createDraft('owner@example.com'); draft.form.logo = image
  const storage = createDraftMedia('tenant:user')
  const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => { throw new Error('quota') })
  const first = storage.encode(draft)
  await expect(first.ready).rejects.toThrow('quota')
  expect(() => storage.resolve(first.draft)).toThrow('missing_draft_media')
  put.mockRestore()
  const next = storage.encode(draft); await next.ready
  expect(storage.resolve(next.draft).form.logo).toBe(image)
})
it('cleans only the completed project owner media', async () => {
  const draft = createDraft('owner@example.com'); draft.form.logo = image
  const a = createDraftMedia('a:user').encode(draft); const b = createDraftMedia('b:user').encode(draft)
  await Promise.all([a.ready, b.ready]); await deleteDraftMedia('a:user')
  await expect(createDraftMedia('a:user').load(a.draft)).rejects.toThrow('missing_draft_media')
  expect((await createDraftMedia('b:user').load(b.draft)).form.logo).toBe(image)
})

it('does not collect retained references from either saved menu mode', async () => {
  const storage = createDraftMedia('tenant:user'); const draft = createDraft('owner@example.com'); draft.form.logo = image
  const old = storage.encode(draft); await old.ready
  const retained = { ...old.draft, form: { ...old.draft.form, logo: '', menuDrafts: { manual: [{ key: 'cat', name: 'Food', image: old.draft.form.logo, products: [] }] } } }
  await storage.collect(old.draft, retained)
  expect((await createDraftMedia('tenant:user').load(retained)).form.menuDrafts.manual[0].image).toBe(image)
})
it('restores an image from a stale cache under a new durable reference after another tab collected it', async () => {
  const a = createDraftMedia('tenant:user'); const draft = createDraft('owner@example.com'); draft.form.logo = image
  const first = a.encode(draft); await first.ready
  const b = createDraftMedia('tenant:user'); const cached = await b.load(first.draft)
  const empty = { ...first.draft, form: { ...first.draft.form, logo: '' } }
  await a.collect(first.draft, empty)
  const restored = b.encode(cached, empty); await restored.ready
  expect(restored.draft.form.logo).not.toBe(first.draft.form.logo)
  expect((await createDraftMedia('tenant:user').load(restored.draft)).form.logo).toBe(image)
})
it('does not invalidate cache or delete media when ownership changes before the transaction', async () => {
  const storage = createDraftMedia('tenant:user'); const draft = createDraft('owner@example.com'); draft.form.logo = image
  const old = storage.encode(draft); await old.ready
  const empty = { ...old.draft, form: { ...old.draft.form, logo: '' } }
  let checks = 0
  await storage.collect(old.draft, empty, () => ++checks === 1)
  expect(storage.resolve(old.draft).form.logo).toBe(image)
  expect((await createDraftMedia('tenant:user').load(old.draft)).form.logo).toBe(image)
})
it('takes a cleanup snapshot before releasing progress and preserves images written afterward', async () => {
  const old = createDraft('owner@example.com'); old.form.logo = image
  const encodedOld = createDraftMedia('tenant:user').encode(old); await encodedOld.ready
  const next = createDraft('owner@example.com'); next.form.logo = image
  let writing
  await deleteDraftMedia('tenant:user', () => { writing = createDraftMedia('tenant:user').encode(next); return true })
  await writing.ready
  expect((await createDraftMedia('tenant:user').load(writing.draft)).form.logo).toBe(image)
})

it('discards uncommitted replacement bytes while retaining the last referenced image', async () => {
  const storage = createDraftMedia('tenant:user'); const draft = createDraft('owner@example.com'); draft.form.logo = image
  const old = storage.encode(draft); await old.ready
  const replaced = storage.encode({ ...draft, form: { ...draft.form, logo: 'data:image/png;base64,Yg==' } }, old.draft); await replaced.ready
  await replaced.discard(ref => !JSON.stringify(old.draft).includes(ref))
  expect((await createDraftMedia('tenant:user').load(old.draft)).form.logo).toBe(image)
  await expect(createDraftMedia('tenant:user').load(replaced.draft)).rejects.toThrow('missing_draft_media')
})
it('does not remove a newer owner snapshot when the reset guard rejects cleanup', async () => {
  const draft = createDraft('owner@example.com'); draft.form.logo = image
  const encoded = createDraftMedia('tenant:user').encode(draft); await encoded.ready
  expect(await deleteDraftMedia('tenant:user', () => false)).toBe(false)
  expect((await createDraftMedia('tenant:user').load(encoded.draft)).form.logo).toBe(image)
})
