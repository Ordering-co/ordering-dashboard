const prefix = 'ordering-media:'
const fields = ['image', 'header', 'images']
const isReference = value => typeof value === 'string' && value.startsWith(prefix)
const mapMedia = (draft, map) => {
  const category = item => ({ ...item, ...Object.fromEntries(fields.filter(key => item[key]).map(key => [key, map(item[key])])), products: item.products.map(product => ({ ...product, ...Object.fromEntries(fields.filter(key => product[key]).map(key => [key, map(product[key])])) })) })
  return { ...draft, form: { ...draft.form, logo: map(draft.form.logo), categories: draft.form.categories.map(category), ...(draft.form.menuDrafts && { menuDrafts: Object.fromEntries(Object.entries(draft.form.menuDrafts).map(([mode, items]) => [mode, items.map(category)])) }) } }
}
const mediaReferences = draft => {
  const refs = new Set()
  if (draft) mapMedia(draft, value => { if (isReference(value)) refs.add(value); return value })
  return refs
}
export const hasDraftMediaReferences = draft => {
  let found = false
  mapMedia(draft, value => { if (isReference(value)) found = true; return value })
  return found
}
const transaction = (keys, mode, operation) => new Promise((resolve, reject) => {
  if (!globalThis.indexedDB) return reject(new Error('media_storage_unavailable'))
  const open = indexedDB.open('ordering-store-onboarding-media', 1)
  open.onupgradeneeded = () => open.result.createObjectStore('media')
  open.onerror = () => reject(open.error)
  let cancelled = false
  open.onblocked = () => { cancelled = true; reject(new Error('media_storage_blocked')) }
  open.onsuccess = () => {
    const db = open.result
    if (cancelled) { db.close(); return }
    let tx
    try {
      tx = db.transaction('media', mode)
      const store = tx.objectStore('media')
      const records = new Map()
      tx.oncomplete = () => { db.close(); resolve(records) }
      tx.onabort = () => { db.close(); reject(tx.error || new Error('media_storage_failed')) }
      tx.onerror = () => {}
      for (const key of keys) {
        const request = operation(store, key)
        request.onsuccess = () => records.set(key, request.result)
      }
    } catch (error) { tx?.abort(); db.close(); reject(error) }
  }
})
export const createDraftMedia = storageKey => {
  const values = new Map()
  const references = new Map()
  const committed = new Set()
  const pending = new Map()
  const owner = (draft, reference) => `${storageKey}:${draft.nonce}:${reference}`
  const resolve = draft => mapMedia(draft, value => {
    if (!isReference(value)) return value
    const key = owner(draft, value)
    if (!committed.has(key)) throw new Error('missing_draft_media')
    return values.get(key)
  })
  const load = async draft => {
    const keys = new Set()
    mapMedia(draft, value => { if (isReference(value) && !committed.has(owner(draft, value))) keys.add(owner(draft, value)); return value })
    if (keys.size) {
      const records = await transaction(keys, 'readonly', (store, key) => store.get(key))
      for (const [key, value] of records) {
        if (typeof value !== 'string' || !value.startsWith('data:image/')) throw new Error('missing_draft_media')
        values.set(key, value); committed.add(key)
        if (!references.has(draft.nonce)) references.set(draft.nonce, new Map())
        references.get(draft.nonce).set(value, key.slice(key.lastIndexOf(prefix)))
      }
    }
    return resolve(draft)
  }
  const remove = (keys, mayRemove = () => true) => {
    const selected = [...keys].filter(mayRemove)
    if (!selected.length) return null
    const deleted = new Set()
    return transaction(selected, 'readwrite', (store, key) => {
      if (!mayRemove(key)) return store.get(key)
      deleted.add(key)
      return store.delete(key)
    }).then(() => {
      for (const key of deleted) { values.delete(key); committed.delete(key) }
    })
  }
  const collect = (previous, next, current = () => true) => {
    if (!previous || previous.nonce !== next.nonce) return null
    const retained = mediaReferences(next)
    const keys = [...mediaReferences(previous)].filter(ref => !retained.has(ref)).map(ref => owner(previous, ref))
    return remove(keys, current)
  }
  const encode = (draft, previous = null) => {
    const writes = new Map()
    const waits = new Set()
    const reusable = previous ? mediaReferences(previous) : null
    const selected = new Map()
    const compact = mapMedia(draft, value => {
      if (!value?.startsWith('data:image/')) return value
      if (!references.has(draft.nonce)) references.set(draft.nonce, new Map())
      const images = references.get(draft.nonce)
      let reference = selected.get(value) || images.get(value)
      if (!reference || (!selected.has(value) && reusable && !reusable.has(reference))) {
        reference = `${prefix}${crypto.randomUUID()}`
        images.set(value, reference)
      }
      selected.set(value, reference)
      const key = owner(draft, reference)
      if (!committed.has(key)) {
        if (pending.has(key)) waits.add(pending.get(key))
        else writes.set(key, value)
      }
      return reference
    })
    if (writes.size) {
      const write = transaction(writes.keys(), 'readwrite', (store, key) => store.put(writes.get(key), key)).then(() => {
        for (const [key, value] of writes) { values.set(key, value); committed.add(key) }
      }).finally(() => { for (const key of writes.keys()) pending.delete(key) })
      for (const key of writes.keys()) pending.set(key, write)
      waits.add(write)
    }
    return { draft: compact, ready: waits.size ? Promise.all(waits) : null, discard: mayRemove => remove(writes.keys(), key => mayRemove(key.slice(key.lastIndexOf(prefix)))) }
  }
  return { load, resolve, encode, collect }
}

export const deleteDraftMedia = async (storageKey, beforeDelete = () => true) => {
  const range = IDBKeyRange.bound(`${storageKey}:`, `${storageKey}:\uffff`)
  const records = await transaction([storageKey], 'readonly', store => store.getAllKeys(range))
  const keys = records.get(storageKey)
  if (!beforeDelete()) return false
  if (keys.length) await transaction(keys, 'readwrite', (store, key) => store.delete(key))
  return true
}
