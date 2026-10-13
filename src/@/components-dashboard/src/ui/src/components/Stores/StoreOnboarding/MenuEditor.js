import React, { useEffect, useRef, useState } from 'react'
import { useStoreOnboardingLanguage } from '../../../../../utils/useStoreOnboardingLanguage'
import { menuItemFields, newKey } from '../../../../../utils/storeOnboarding'
import { BusinessProductAddFormUI } from '../BusinessProductAddForm'
import { BusinessProductsCategoyInfo } from '../BusinessProductsCategoyInfo'
import { Card, Fields, Button, TextButton, ErrorBox, MenuItem, MenuFormFrame, MenuToolbar, MenuCategoryHeader, MenuActions } from './styles'

const NativeMenuForm = ({ target, onSave, onSaved, onCancel }) => {
  const [, t] = useStoreOnboardingLanguage()
  const [changes, setChanges] = useState(() => ({ enabled: true, name: '', description: '', ...(target.kind === 'product' && { price: '' }), ...target.item }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(true)
  const submitting = useRef(false)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const change = patch => {
    if (!active.current || submitting.current) return
    const fields = menuItemFields[target.kind]
    setChanges(value => ({ ...value, ...Object.fromEntries(Object.entries(patch).filter(([key]) => fields.includes(key))) }))
    setError('')
  }
  const save = async () => {
    if (!active.current || submitting.current) return
    if (!changes.name.trim() || (target.kind === 'product' && (String(changes.price).trim() === '' || !Number.isFinite(Number(changes.price)) || Number(changes.price) < 0))) {
      setError(t('STORE_ONBOARDING_FIX_FIELDS', 'Complete or check these fields:') + ' ' + (target.kind === 'product' ? `${t('PRODUCT_NAME', 'Product name')}, ${t('PRICE', 'Price')}` : t('CATEGORY_NAME', 'Category name')))
      return
    }
    submitting.current = true
    setSaving(true)
    const patch = Object.fromEntries(menuItemFields[target.kind].filter(key => target.isNew ? changes[key] !== undefined : changes[key] !== target.item[key]).map(key => [key, changes[key]]))
    let saved = false
    try { saved = await onSave({ ...target, patch }) } catch {}
    if (!active.current) return
    submitting.current = false
    setSaving(false)
    if (saved) onSaved(target, patch)
    else setError(t('STORE_ONBOARDING_STORAGE_ERROR', 'Your browser could not save your progress. Free up browser storage and try again.'))
  }
  const props = {
    onboardingMode: true,
    formState: { changes, loading: saving, result: { error: false } },
    handleChangeInput: event => change({ [event.target.name]: event.target.value }),
    handleChangeItem: change,
    handleUpdateClick: save,

    handlechangeImage: () => {}
  }
  return <Card>
    <h2>{target.kind === 'category' ? t('ADD_CATEGORY', 'Add category') : t('ADD_PRODUCT', 'Add product')}</h2>
    {target.kind === 'product' && target.categoryName && <p>{t('CATEGORY', 'Category')}: <strong>{target.categoryName}</strong></p>}
    {error && <ErrorBox role='alert'>{error}</ErrorBox>}
    <MenuFormFrame disabled={saving}>
      {target.kind === 'category'
        ? <BusinessProductsCategoyInfo {...props} isAddMode category={target.item} parentCategories={[]} />
        : <BusinessProductAddFormUI {...props} />}
    </MenuFormFrame>
    <TextButton disabled={saving} onClick={onCancel}>{t('CANCEL', 'Cancel')}</TextButton>
  </Card>
}

export const MenuEditor = ({ categories, mode, disabled, onChange, onEditingChange }) => {
  const [, t] = useStoreOnboardingLanguage()
  const makeTarget = (kind, category, product) => ({ kind, mode, categoryKey: category?.key || newKey(), categoryName: category?.name, productKey: kind === 'product' ? product?.key || newKey() : undefined, item: (kind === 'product' ? product : category) || {}, isNew: !(kind === 'product' ? product : category) })
  const [target, setTarget] = useState(() => {
    const unnamedCategory = categories.find(category => !category.name.trim())
    if (unnamedCategory) return makeTarget('category', unnamedCategory)
    return categories.length ? null : makeTarget('category')
  })
  const [error, setError] = useState(false)
  const editing = Boolean(target && !disabled)
  useEffect(() => { onEditingChange(editing); return () => onEditingChange(false) }, [editing, onEditingChange])
  const open = (kind, category, product) => {
    setError(false)
    if (kind === 'product' && !category.name.trim()) { setTarget(makeTarget('category', category)); return }
    setTarget(makeTarget(kind, category, product))
  }
  const remove = async (category, product) => {
    const saved = await onChange({ mode, kind: product ? 'product' : 'category', categoryKey: category.key, productKey: product?.key, remove: true })
    if (!saved) setError(true)
  }
  const saved = (item, patch) => {
    if (item.kind === 'category' && (item.isNew || !item.item.products?.length)) {
      setTarget(makeTarget('product', { key: item.categoryKey, name: patch.name || item.item.name, products: [] }))
    } else setTarget(null)
  }
  if (editing) return <NativeMenuForm key={`${target.categoryKey}:${target.productKey || ''}`} target={target} onSave={onChange} onSaved={saved} onCancel={() => setTarget(null)} />
  return <Fields>
    {error && <ErrorBox role='alert'>{t('STORE_ONBOARDING_STORAGE_ERROR', 'Your browser could not save your progress. Free up browser storage and try again.')}</ErrorBox>}
    {categories.length > 0 && <MenuToolbar><h2>{t('CATEGORIES', 'Categories')}</h2><Button disabled={disabled} onClick={() => open('category')}>+ {t('ADD_CATEGORY', 'Add category')}</Button></MenuToolbar>}
    {!categories.length && <Card>
      <h2>{t('STORE_ONBOARDING_FIRST_CATEGORY_TITLE', 'Start with a category')}</h2>
      <p>{t('STORE_ONBOARDING_FIRST_CATEGORY_HINT', 'Create a category before adding its products.')}</p>
      <MenuActions><Button $primary disabled={disabled} onClick={() => open('category')}>+ {t('ADD_CATEGORY', 'Add category')}</Button></MenuActions>
    </Card>}
    {categories.map((category, ci) => <Card key={category.key}>
      <MenuCategoryHeader>
        <MenuItem>
          {category.image && <img src={category.image} alt={category.name} />}
          <div><h2>{category.name || t('STORE_ONBOARDING_FIRST_CATEGORY_TITLE', 'Start with a category')}</h2>{category.description && <p>{category.description}</p>}</div>
        </MenuItem>
        <MenuActions>
          <Button $primary disabled={disabled || !category.name.trim()} onClick={() => open('product', category)}>+ {t('ADD_PRODUCT', 'Add product')}</Button>
          <TextButton disabled={disabled} aria-label={`${t('EDIT', 'Edit')} ${category.name}`} onClick={() => open('category', category)}>{t('EDIT', 'Edit')}</TextButton>
          <TextButton disabled={disabled} aria-label={`${t('DELETE_CATEGORY', 'Delete category')} ${ci + 1}`} onClick={() => remove(category)}>{t('DELETE', 'Delete')}</TextButton>
        </MenuActions>
      </MenuCategoryHeader>
      {category.products.map((product, pi) => <MenuItem className='product-row' key={product.key}>
        {product.images && <img src={product.images} alt={product.name || t('PRODUCT_NAME', 'Product name')} />}
        <div><strong>{product.name || t('STORE_ONBOARDING_FINISH_PRODUCT', 'Finish this product')}</strong><p>{product.price}</p></div>
        <MenuActions>
          <TextButton disabled={disabled || !category.name.trim()} aria-label={`${t('EDIT', 'Edit')} ${product.name || t('PRODUCT_NAME', 'Product name')}`} onClick={() => open('product', category, product)}>{t('EDIT', 'Edit')}</TextButton>
          <TextButton disabled={disabled} aria-label={`${t('DELETE_PRODUCT', 'Delete product')} ${pi + 1}`} onClick={() => remove(category, product)}>{t('DELETE', 'Delete')}</TextButton>
        </MenuActions>
      </MenuItem>)}
      {!category.products.length && <p>{t('STORE_ONBOARDING_FIRST_PRODUCT_HINT', 'Add the first product to this category.')}</p>}
    </Card>)}
  </Fields>
}
