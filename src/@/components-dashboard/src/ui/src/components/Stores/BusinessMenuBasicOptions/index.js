import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { getScheduleLabels } from '../../../utils/scheduleLabels'
import { Button, Checkbox, InlineNotice, SaveBar, ScheduleEditor, SearchField, TextArea, TextField } from '../../Shared/Product'
import { BusinessMenuCategoryTreeNode } from '../BusinessMenuCategoryTreeNode'
import { orderTypesValues } from './utils'
import { buildCategoryIndex, countSelected, flattenCategories, isDefaultSchedule, matchProductIds, validateMenuForm } from './treeModel'
import './business-menu-basic.css'

// redesign stores 5.5b: the «Basic» tab of a menu on the Product pieces, in one column: name, order types, schedule,
// comments and products. The form is the controller's (handleChangeInput, handleChangeScheduleState, the selected products); this
// draws it and saves through the P/SaveBar (count, Discard, Save, the error with Retry), like the Channels tab. The tree keeps its
// own checkboxes; Basic owns which categories are open («Expand all», the search) and what the search lets through. The category index
// the tree needs is built here from business.categories, not read from the controller (which computes its list before they arrive).
// `validationAttempt` (opt-in, a counter) is how the leave guard's Save, which validates with the same validateMenuForm, makes this tab
// show what is missing.

const SAVED_MS = 2500

// the first message of what the controller answers (a string or a list of them), or null
const firstMessage = (error) => {
  const message = Array.isArray(error) ? error[0] : error
  return typeof message === 'string' && message.trim() ? message : null
}

const byRank = (a, b) => (a?.rank ?? 0) - (b?.rank ?? 0)

export const BusinessMenuBasicOptions = (props) => {
  const {
    business,
    businessMenuState,
    formState,
    handleChangeInput,
    handleUpdateBusinessMenuOption,
    handleAddBusinessMenuOption,
    selectedProductsIds,
    setSelectedProductsIds,
    selectedProducts,
    setSelectedProducts,
    handleChangeScheduleState,
    pendingChangeKeys,
    discardChanges,
    validationAttempt
  } = props
  const [, t] = useLanguage()
  const menu = businessMenuState?.menu || {}
  const changes = formState?.changes || {}
  const isNew = !menu.id

  const [nameAttempted, setNameAttempted] = useState(false)
  const [productsAttempted, setProductsAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorText, setErrorText] = useState(null)
  const [saved, setSaved] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const [scheduleKey, setScheduleKey] = useState(0)
  const nameRef = useRef(null)
  const savingRef = useRef(false)
  const mounted = useRef(true)
  const savedTimer = useRef(null)
  const lastMenuId = useRef(menu.id)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(savedTimer.current)
    }
  }, [])

  // Another menu opens in the same tab: nothing of the last one stays (errors, search, open categories).
  useEffect(() => {
    if (lastMenuId.current === menu.id) return
    lastMenuId.current = menu.id
    setNameAttempted(false)
    setProductsAttempted(false)
    setErrorText(null)
    setSaved(false)
    setSearch('')
    setExpandedIds(new Set())
  }, [menu.id])

  // The leave guard's Save found something missing and brought the user here: mark it as a failed Save does. The focus waits for the
  // paint (this tab may have just mounted, and the dialog that asked is closing).
  useEffect(() => {
    if (!(typeof validationAttempt === 'number' && validationAttempt > 0)) return undefined
    const check = validateMenuForm({ menu, changes, selectedProductsIds })
    if (check.nameBlank) setNameAttempted(true)
    if (check.productsMissing) setProductsAttempted(true)
    if (!check.nameBlank) return undefined
    const frame = requestAnimationFrame(() => nameRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [validationAttempt])

  const orderTypes = orderTypesValues({ t })
  const name = changes.name ?? menu.name ?? ''
  const useBusinessSchedule = !!(changes.use_business_schedule ?? menu.use_business_schedule)
  const allProducts = !!(changes.all_products ?? menu.all_products)

  // A copy: sorting business.categories in place would reorder the business of the whole page (G3-08).
  const categories = useMemo(() => [...(Array.isArray(business?.categories) ? business.categories : [])].sort(byRank), [business?.categories])
  const model = useMemo(() => flattenCategories(business?.categories), [business?.categories])
  const matched = useMemo(() => matchProductIds(model, search), [model, search])
  const searching = matched !== null
  const selectedCount = countSelected(model, selectedProductsIds)
  const subCategoriesList = useMemo(() => buildCategoryIndex(business?.categories), [business?.categories])
  const categoryIds = subCategoriesList.map(category => category.id)
  const allExpanded = categoryIds.length > 0 && categoryIds.every(id => expandedIds.has(id))

  const toggleExpanded = (id) => {
    setExpandedIds(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => setExpandedIds(allExpanded ? new Set() : new Set(categoryIds))

  const setField = (key, value) => handleChangeInput({ target: { name: key, value } })

  // The controller already ignores what it seeds on open. A new menu also gets the week the Schedule controller seeds: not an edit.
  const pendingKeys = Array.isArray(pendingChangeKeys) ? pendingChangeKeys : []
  const count = pendingKeys.filter(key => !(isNew && key === 'schedule' && isDefaultSchedule(changes.schedule))).length

  const validation = validateMenuForm({ menu, changes, selectedProductsIds })
  const nameBlank = validation.nameBlank
  const showNameError = nameAttempted && nameBlank
  const showProductsError = productsAttempted && validation.productsMissing

  const touched = () => {
    setErrorText(null)
    setSaved(false)
  }

  const discard = () => {
    touched()
    setNameAttempted(false)
    setProductsAttempted(false)
    setSearch('')
    // the editor reads the saved schedule again
    setScheduleKey(key => key + 1)
    discardChanges?.()
  }

  // What a failed Save shows: the notice of what is missing and the focus on the name when that is what is missing.
  const markInvalid = () => {
    if (validation.nameBlank) {
      setNameAttempted(true)
      nameRef.current?.focus()
    }
    if (validation.productsMissing) setProductsAttempted(true)
  }

  const save = async () => {
    if (savingRef.current) return { ok: false }
    touched()
    if (!validation.ok) {
      markInvalid()
      return { ok: false }
    }
    savingRef.current = true
    setSaving(true)
    let result
    try {
      result = await (isNew ? handleAddBusinessMenuOption() : handleUpdateBusinessMenuOption())
    } catch (error) {
      result = { ok: false, error: error?.message }
    }
    savingRef.current = false
    if (!mounted.current) return result?.ok === false ? { ok: false, error: result.error } : { ok: true }
    setSaving(false)
    if (result?.ok === false) {
      setErrorText(translateApiMessage(t, firstMessage(result.error), t('STORES_CHANGE_FAILED', "We couldn't save the change.")))
      return { ok: false, error: result.error }
    }
    setNameAttempted(false)
    setProductsAttempted(false)
    setSaved(true)
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => { if (mounted.current) setSaved(false) }, SAVED_MS)
    return { ok: true }
  }

  const countText = (count === 1
    ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change')
    : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes')).replace('_count_', count)

  const countLine = t('STORES_MENU_PRODUCTS_SELECTED', '_count_ of _total_ products selected')
    .replace('_count_', selectedCount)
    .replace('_total_', model.productIds.size)

  return (
    <div className='odc-bmb' tabIndex={-1}>
      <TextField
        ref={nameRef}
        name='name'
        label={t('MENU_NAME', 'Menu name')}
        required
        requiredLabel={t('REQUIRED', 'Required')}
        value={name}
        error={showNameError ? t('NAME_REQUIRED', 'The name is required.') : undefined}
        onChange={value => setField('name', value)}
      />

      <fieldset className='odc-bmb-section'>
        <legend className='odc-bmb-heading'>{t('ORDER_TYPES', 'Order types')}</legend>
        <div className='odc-bmb-types-box'>
          <div className='odc-bmb-types'>
            {orderTypes.map(orderType => (
              <Checkbox
                key={orderType.value}
                checked={!!(changes[orderType.key] ?? menu[orderType.key])}
                onCheckedChange={() => setField(orderType.key, !(changes[orderType.key] ?? menu[orderType.key]))}
              >
                {orderType.content}
              </Checkbox>
            ))}
          </div>
        </div>
      </fieldset>

      <section className='odc-bmb-section'>
        <h3 className='odc-bmb-heading'>{t('SCHEDULE', 'Schedule')}</h3>
        <Checkbox
          checked={useBusinessSchedule}
          onCheckedChange={() => setField('use_business_schedule', !useBusinessSchedule)}
        >
          {t('USE_BUSINESS_SCHEDULE', 'Use business schedule')}
        </Checkbox>
        {!useBusinessSchedule && (
          <div className='odc-bmb-schedule'>
            <ScheduleEditor
              key={`${menu.id ?? 'new'}-${scheduleKey}`}
              scheduleList={changes.schedule ?? menu.schedule}
              handleChangeScheduleState={handleChangeScheduleState}
              labels={getScheduleLabels(t)}
            />
          </div>
        )}
      </section>

      <TextArea
        name='comment'
        label={t('COMMENTS', 'Comments')}
        rows={4}
        placeholder={t('WRITE_HERE', 'Write here')}
        value={changes.comment ?? menu.comment ?? ''}
        onChange={value => setField('comment', value)}
      />

      <section className='odc-bmb-section'>
        <h3 className='odc-bmb-heading'>{t('PRODUCTS', 'Products')}</h3>
        <Checkbox
          checked={allProducts}
          onCheckedChange={() => setField('all_products', !allProducts)}
        >
          {t('ALL_PRODUCTS', 'All products')}
        </Checkbox>
        {!allProducts && (
          <>
            <div className='odc-bmb-toolbar'>
              <SearchField
                className='odc-bmb-search'
                value={search}
                onChange={setSearch}
                label={t('SEARCH_PRODUCTS', 'Search products')}
                placeholder={t('SEARCH_PRODUCTS', 'Search products')}
                clearLabel={t('CLEAR_SEARCH', 'Clear search')}
              />
              {!searching && (
                <Button onClick={toggleAll}>
                  {allExpanded ? t('STORES_MENU_COLLAPSE_ALL', 'Collapse all') : t('STORES_MENU_EXPAND_ALL', 'Expand all')}
                </Button>
              )}
            </div>
            <p className='odc-bmb-count' aria-live='polite'>{countLine}</p>
            {searching && matched.size === 0
              ? <InlineNotice tone='info'>{t('STORES_MENU_NO_PRODUCTS_MATCH', 'No products match your search.')}</InlineNotice>
              : (
                <div className='odc-bmb-tree'>
                  {categories.map(category => (
                    <BusinessMenuCategoryTreeNode
                      key={category.id}
                      index={0}
                      category={category}
                      selectedProductsIds={selectedProductsIds}
                      setSelectedProductsIds={setSelectedProductsIds}
                      selectedProducts={selectedProducts}
                      setSelectedProducts={setSelectedProducts}
                      subCategoriesList={subCategoriesList}
                      expandedIds={expandedIds}
                      onToggleExpanded={toggleExpanded}
                      forceExpanded={searching}
                      visibleProductIds={matched}
                    />
                  ))}
                </div>
                )}
            {showProductsError && (
              <InlineNotice tone='danger' role='alert'>
                {t('ERROR_MENU_PRODUCTS', 'You have not selected any product for the menu')}
              </InlineNotice>
            )}
          </>
        )}
      </section>

      <SaveBar
        label={t('SAVE_CHANGES', 'Save changes')}
        formSelector='.odc-bmb'
        count={count}
        countText={countText}
        saving={saving}
        errorText={errorText}
        onRetry={save}
        retryLabel={t('RETRY', 'Retry')}
        saved={saved}
        savedText={t('SAVED', 'Saved')}
        discardLabel={t('DISCARD', 'Discard')}
        saveLabel={isNew ? t('ADD', 'Add') : t('SAVE', 'Save')}
        onDiscard={discard}
        onSave={save}
      />
    </div>
  )
}
