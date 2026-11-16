import React, { useEffect, useRef, useState } from 'react'
import {
  useLanguage,
  BusinessSharedMenuProductDetails as BusinessSharedMenuProductDetailsController
} from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { AsyncSwitch, NumberField, SaveBar, SearchField, useLeaveGuard, useSectionSplit } from '../../Shared/Product'
import './shared-menu-product-details.css'

// redesign stores 5.6 (G3-04, decisions 4 and 5): the product of a shared menu is the detail of a P/SectionSplit (the piece
// titles it with the name). Price and quantity are P/NumberField (the quantity has a label now) saved with the P/SaveBar and guarded
// when the user leaves; the three properties and every extra, option and suboption are P/AsyncSwitch (they save at once, go back and
// say why when it fails). The controller answers `{ ok, error }` to all of them. The visibility rules of the tree and the search
// (case-insensitive on both sides) are the ones of main.

const SAVED_MS = 2500
const FAILURE_FALLBACK = "We couldn't save the change."

// the first text of what the controller answers: a string, `{ message }` or a list of them
const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(message => typeof message === 'string' && message.trim()) ?? null

const hasError = error => (Array.isArray(error) ? error.length > 0 : Boolean(error))

// a number or null: NumberField takes nothing else
const toNumber = (value) => {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const matches = (item, needle) => (item?.name || '').toLowerCase().includes(needle)

const showSuboption = (suboption, needle) => matches(suboption, needle)

const showOption = (option, needle) => (
  matches(option, needle) || (option.suboptions || []).some(suboption => showSuboption(suboption, needle))
)

const showExtra = (extra, needle) => (
  matches(extra, needle) || (extra.options || []).some(option => showOption(option, needle))
)

const BusinessSharedMenuProductDetailsUI = (props) => {
  const {
    productState,
    formState,
    handleChangeField,
    pendingChangeKeys,
    isDirty,
    saveChanges,
    discardChanges,
    handleToggleProperty,
    handleUpdateExtra,
    handleUpdateOption,
    handleUpdateSuboption
  } = props

  const [, t] = useLanguage()
  const { registerCloseGuard } = useSectionSplit()
  const [searchValue, setSearchValue] = useState('')
  const [saved, setSaved] = useState(false)
  const mounted = useRef(true)
  const savedTimer = useRef(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(savedTimer.current)
    }
  }, [])

  const product = productState?.product || {}
  const changes = formState?.changes || {}
  const keys = Array.isArray(pendingChangeKeys) ? pendingChangeKeys : []
  const count = isDirty ? (keys.length || 1) : 0
  const failureText = t('STORES_CHANGE_FAILED', FAILURE_FALLBACK)

  // Closing the product by any way (X, «‹ Products», Esc, another product, the menu) asks first when price or quantity are typed and not saved.
  useLeaveGuard({
    dirty: Boolean(isDirty),
    count: keys.length || 1,
    save: saveChanges,
    discard: discardChanges,
    registerCloseGuard
  })

  const changeField = (name, value) => {
    setSaved(false)
    handleChangeField(name, value)
  }

  const save = async () => {
    setSaved(false)
    let result
    try {
      result = await saveChanges()
    } catch (error) {
      result = { ok: false, error: error?.message }
    }
    if (mounted.current && result?.ok !== false) {
      setSaved(true)
      clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => { if (mounted.current) setSaved(false) }, SAVED_MS)
    }
    return result
  }

  const discard = () => {
    setSaved(false)
    discardChanges?.()
  }

  const fieldLabels = {
    price: t('PRICE', 'Price'),
    quantity: t('STORES_SHARED_PRODUCT_QUANTITY', 'Quantity')
  }
  const names = keys.map(key => fieldLabels[key] ?? key)
  const countText = (count === 1
    ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change')
    : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes')).replace('_count_', count)
  const errorText = hasError(formState?.error)
    ? translateApiMessage(t, firstMessage(formState.error), failureText)
    : null

  const needle = searchValue.toLowerCase()
  const extras = product.extras || []

  const toggle = (checked, onToggle, label) => (
    <AsyncSwitch checked={!!checked} onToggle={onToggle} failureText={failureText}>
      <span className='odc-smpd-name' dir='auto'>{label}</span>
    </AsyncSwitch>
  )

  return (
    <div className='odc-smpd' tabIndex={-1}>
      <div className='odc-smpd-fields'>
        <NumberField
          label={t('PRICE', 'Price')}
          min={0}
          value={toNumber('price' in changes ? changes.price : product.price)}
          onChange={value => changeField('price', value)}
        />
        <NumberField
          label={t('STORES_SHARED_PRODUCT_QUANTITY', 'Quantity')}
          min={0}
          step={1}
          format={{ maximumFractionDigits: 0 }}
          value={toNumber('quantity' in changes ? changes.quantity : product.quantity)}
          onChange={value => changeField('quantity', value)}
        />
      </div>

      <div className='odc-smpd-switches'>
        {toggle(product.inventoried, next => handleToggleProperty('inventoried', next), t('INVENTORIED', 'Limit product quantity'))}
        {toggle(product.featured, next => handleToggleProperty('featured', next), t('FEATURED', 'Featured'))}
        {toggle(product.upselling, next => handleToggleProperty('upselling', next), t('UPSELLING', 'Upselling'))}
      </div>

      {extras.length > 0 && (
        <section className='odc-smpd-options'>
          <h4 className='odc-smpd-subtitle'>{t('PRODUCT_OPTIONS', 'Product options')}</h4>
          <SearchField
            className='odc-smpd-search'
            value={searchValue}
            onChange={setSearchValue}
            label={t('SEARCH', 'Search')}
            placeholder={t('SEARCH', 'Search')}
            clearLabel={t('CLEAR_SEARCH', 'Clear search')}
          />
          <ul className='odc-smpd-tree'>
            {extras.filter(extra => showExtra(extra, needle)).map(extra => (
              <li key={extra.id} className='odc-smpd-node'>
                {toggle(extra.enabled, next => handleUpdateExtra(extra.id, next), extra.name ?? '')}
                {extra.enabled && (
                  <ul className='odc-smpd-tree'>
                    {(extra.options || []).filter(option => showOption(option, needle)).map(option => (
                      <li key={option.id} className='odc-smpd-node'>
                        {toggle(option.enabled, next => handleUpdateOption(option.id, next), option.name ?? '')}
                        {option.enabled && (
                          <ul className='odc-smpd-tree'>
                            {(option.suboptions || []).filter(suboption => showSuboption(suboption, needle)).map(suboption => (
                              <li key={suboption.id} className='odc-smpd-node'>
                                {toggle(suboption.enabled, next => handleUpdateSuboption(suboption.id, next), suboption.name ?? '')}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <SaveBar
        label={t('SAVE_CHANGES', 'Save changes')}
        formSelector='.odc-smpd'
        count={count}
        countText={countText}
        names={names}
        moreText={n => t('SETTINGS_UNSAVED_MORE', '+_count_').replace('_count_', n)}
        saving={!!formState?.saving}
        errorText={errorText}
        onRetry={save}
        retryLabel={t('RETRY', 'Retry')}
        saved={saved}
        savedText={t('SAVED', 'Saved')}
        discardLabel={t('DISCARD', 'Discard')}
        saveLabel={t('SAVE', 'Save')}
        onDiscard={discard}
        onSave={save}
      />
    </div>
  )
}

export const BusinessSharedMenuProductDetails = (props) => {
  const detailsProps = {
    ...props,
    UIComponent: BusinessSharedMenuProductDetailsUI
  }
  return <BusinessSharedMenuProductDetailsController {...detailsProps} />
}
