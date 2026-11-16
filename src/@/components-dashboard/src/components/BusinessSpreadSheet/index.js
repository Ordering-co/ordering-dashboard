import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useUtils } from '../../contexts/UtilsContext'

export const BusinessSpreadSheet = (props) => {
  const {
    UIComponent,
    categoryState,
    business,
    handleUpdateBusinessState,
    categoryId,
    categorySelected,
    handleUpdateCategoryState
  } = props

  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [, { showToast }] = useToast()
  const [{ token, loading }] = useSession()
  const [{ parsePrice }] = useUtils()
  const [formState, setFormState] = useState({ products: null, loading: false, result: { error: false } })
  const [removingWithSupr, setRemovingWithSupr] = useState(false)
  // redesign D-9 (owner, 2026-10-19): the rows waiting for the owner's answer, `{ ids, count, names }`
  const [pendingRemoval, setPendingRemoval] = useState(null)
  const [undo, setUndo] = useState(false)
  const [curCell, setCurCell] = useState({
    row: -1,
    col: -1
  })
  const taxShowbusiness = `${business.tax}% ${business.tax_type === 1 ? t('INCLUDED_ON_PRICE', 'Included on price') : t('NOT_INCLUDED_ON_PRICE', 'Not included on price')}`
  const feeShowbusiness = `${parsePrice(0)} + ${business.service_fee}%`

  /**
   * Method to remove a row from spreadSheet table
   * @param {Number} row Number of selected row
   * @param {Number} col Number of selected col
   * @param {Number} row1 Number of selected row
   * @param {Number} col1 Number of selected col
   * @param {Object} hotTableObj Object for spreadSheet mode table
   */
  const handleAfterSectionEnd = (row, col, row1, col1, hotTableObj) => {
    if ((curCell.row === row && curCell.col === col) || (row !== row1 || col !== col1)) return
    curCell.row = row
    curCell.col = col
    setCurCell({
      row,
      col
    })
    hotTableObj.deselectCell()
    hotTableObj.selectCell(row, col)
  }

  const handleoutsideClickDeselects = () => {
    setCurCell({
      row: -1,
      col: -1
    })
    return false
  }

  /**
   * Hook for Handsontable's `beforeRemoveRow`, used by both the context-menu «Remove row» and the emptied-row path of
   * `handleItemChange`. redesign D-9 (owner, 2026-10-19): rows with an id are not deleted here. The removal is
   * held back (returning `false` makes Handsontable keep the rows) as `pendingRemoval` until `confirmRemoval()`. Rows that
   * were never saved have no id and go at once, as before.
   * @param {Number} row Number of selected row
   * @param {Number} amount Count of selected row
   * @param {Array} datarows Numbers of selected row
   * @param {Object} hotTableObj Object for spreadSheet mode table
   */
  const handleRowRemove = (row, amount, dataRows, hotTableObj) => {
    if (!hotTableObj) return
    const toRemove = []
    const saved = []
    for (const dataRow of dataRows) {
      const sourceRow = hotTableObj?.getSourceDataAtRow(dataRow)
      toRemove.push(sourceRow?.id)
      if (sourceRow?.id) {
        // an emptied row has lost its name: the saved product still has it
        const product = (categoryState?.products || []).find(item => item.id === sourceRow.id)
        saved.push({ id: sourceRow.id, name: product?.name || sourceRow.name })
      }
    }
    if (removingWithSupr) {
      setRemovingWithSupr(false)
    }
    if (saved.length > 0) {
      // Handsontable calls this hook once per block when a removal has several non-contiguous blocks (Cmd/Ctrl
      // multi-selection, or several emptied rows): merge into what is already waiting instead of replacing it. It is
      // null again after a confirm or a cancel, so the next removal starts fresh.
      setPendingRemoval(previous => {
        const ids = [...(previous?.ids || [])]
        const names = [...(previous?.names || [])]
        for (const { id, name } of saved) {
          if (ids.includes(id)) continue
          ids.push(id)
          if (name) names.push(name)
        }
        return { ids, count: ids.length, names }
      })
      return false
    }
    setTimeout(() => {
      deleteProducts(toRemove)
    }, 1)
  }

  const confirmRemoval = async () => {
    if (!pendingRemoval) return
    const deleted = await deleteProducts(pendingRemoval.ids)
    setPendingRemoval(null)
    // when the delete did not happen the grid may still show emptied cells: bring it back to what is saved
    if (!deleted) getProductsByCategoryId()
  }

  const cancelRemoval = async () => {
    setPendingRemoval(null)
    // nothing was deleted: reload what is saved, which also restores the cells the user had emptied
    await getProductsByCategoryId()
  }

  const handleItemChange = (changeItems, accionHanson, hotTableObj) => {
    if (undo) {
      setUndo(false)
      return
    }
    if (accionHanson !== 'loadData') {
      changeItems = !changeItems ? [] : changeItems
      const changes = []
      const itemToRemove = []
      const itemToUpdate = []
      const itemToAdd = []
      const id = categoryId || categorySelected?.id
      changeItems.forEach(item => {
        const error = {
          name: false,
          price: false
        }
        if (item[2] !== item[3]) {
          let valid = true
          for (let j = 0; j < changes.length; j++) {
            if (changes[j] === item[0]) {
              valid = false
              break
            }
          }
          if (valid) {
            changes.push(item[0])
            const row = hotTableObj.getSourceDataAtRow(item[0])
            hotTableObj.validateRows(changes, function (res) { })
            if (!row.name && (row.price || row.quantity || row.description)) {
              error.name = true
              setFormState({
                ...formState,
                result: {
                  error: true,
                  result: [t('NAME_REQUIRED', 'Name Required')]
                }
              })
            }
            if (row.price && typeof (row.price) !== 'number') {
              const price = parseFloat(row.price)
              if (!price) {
                error.price = true
                setFormState({
                  ...formState,
                  result: {
                    error: true,
                    // bugs E D15: the key has no text in the catalog, so it showed the raw key or nothing
                    result: [t('PRODUCT_PRICE_NUMBER', 'The price must be a number')]
                  }
                })
              } else row.price = price
            }
            if (row.quantity && typeof (row.quantity) !== 'number' && row.quantity !== 'NA') {
              const quantity = parseFloat(row.quantity)
              if (!quantity) {
                error.quantity = true
              } else row.quantity = quantity
            }
            if (!row.id) {
              if (!(error.price || error.name || error.quantity)) {
                const _add = {
                  name: row.name,
                  description: row.description ? row.description : '',
                  price: row.price ? row.price : 0,
                  cost_price: row?.cost_price || 0,
                  category_id: id,
                  business_id: business?.id
                }
                if ((row.quantity && row.quantity !== 'NA') || row.quantity === 0) {
                  _add.quantity = row.quantity
                  _add.inventoried = true
                }
                itemToAdd.push(_add)
              }
            } else {
              if (!row.name && !row.price && !row.description) {
                row.row = item[0]
                itemToRemove.push(row)
              } else {
                if (!(error.price || error.name || error.quantity)) {
                  if (!row.description) row.description = null
                  const _update = {
                    id: row.id,
                    name: row.name,
                    description: row.description ? row.description : '',
                    price: row.price ? row.price : 0,
                    inventoried: row?.inventoried || false,
                    category_id: id,
                    business_id: business?.id
                  }
                  if (typeof row?.offer_price !== 'undefined') {
                    _update.offer_price = row.offer_price
                  }
                  if (typeof row?.cost_price !== 'undefined') {
                    _update.cost_price = row.cost_price
                  }
                  if ((row.quantity && row.quantity !== 'NA') || row.quantity === 0) {
                    _update.quantity = row.quantity
                  }
                  itemToUpdate.push(_update)
                }
              }
            }
          }
        }
      })

      if (itemToAdd.length > 0) {
        editProducts(itemToAdd, true, hotTableObj)
      }

      if (itemToUpdate.length > 0) {
        editProducts(itemToUpdate, false, hotTableObj)
      }

      if (itemToRemove.length > 0) {
        // each emptied row is removed by its own index: `[row, amount]` blocks, not "N rows from the first one"
        const rowsToRemove = [...new Set(itemToRemove.map(item => item.row))].sort((a, b) => a - b)
        hotTableObj.alter('remove_row', rowsToRemove.map(row => [row, 1]))
        setRemovingWithSupr(true)
      }
    }
  }

  const editProducts = async (params, isPost, hotTableObj) => {
    if (loading) return
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true })
      const requestOptions = {
        method: isPost ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ products: JSON.stringify(params) })
      }

      const functionFetch = `${ordering.root}/bulks/products`

      const response = await fetch(functionFetch, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setFormState({
          ...formState,
          loading: false,
          result: {
            error: false,
            result: isPost ? t('PRODUCT_CREATED', 'Product created') : t('PRODUCT_UPDATE', 'Product updated')
          }
        })
        showToast(ToastType.Success, isPost ? t('PRODUCT_CREATED', 'Product created') : t('PRODUCT_UPDATE', 'Product updated'))
        getProductsByCategoryId()
      } else {
        setFormState({
          ...formState,
          loading: false,
          result: {
            error: true,
            result
          }
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        result: {
          error: true,
          result: err.message
        },
        loading: false
      })
    }
  }

  /**
   * Method to edit a product
   */
  const getProductsByCategoryId = async () => {
    if (loading) return
    try {
      const id = categoryId || categorySelected?.id
      // bugs E D15: with no category there is nothing to reload; it used to throw on `categorySelected.id` and
      // land in the catch as an error message.
      if (!id) return
      const params = {
        business_id: business?.id,
        category_id: parseInt(id)
      }
      const { content: { error, result } } = await ordering.businesses(business?.id).categories(parseInt(id)).products().parameters(params).get()
      if (!error) {
        if (handleUpdateBusinessState) {
          const _categories = business?.categories.map(item => {
            if (parseInt(item.id) === parseInt(id)) {
              return {
                ...item,
                products: result
              }
            }
            return item
          })
          handleUpdateBusinessState({ ...business, categories: _categories })
        }
        if (handleUpdateCategoryState) {
          handleUpdateCategoryState({ ...categoryState, products: result })
        }
        setFormState({
          ...formState,
          products: result.map(product => ({
            ...product,
            taxShow: !product?.tax ? taxShowbusiness : `${product.tax?.rate}% ${business.tax?.type === 1 ? t('INCLUDED_ON_PRICE', 'Included on price') : t('NOT_INCLUDED_ON_PRICE', 'Not included on price')}`,
            feeShow: !product?.fee ? feeShowbusiness : `${parsePrice(product.fee?.fixed)} + ${product.fee?.percentage}%`
          })),
          loading: false,
          result: {
            error: false,
            result: t('PRODUCT_SAVED', 'Product saved')
          }
        })
      } else {
        setFormState({
          ...formState,
          loading: false,
          result: {
            error: true,
            result
          }
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        result: {
          error: true,
          result: err.message
        },
        loading: false
      })
    }
  }

  const deleteProducts = async (params) => {
    if (loading) return false
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ products: JSON.stringify(params) })
      }

      const functionFetch = `${ordering.root}/bulks/products`

      const response = await fetch(functionFetch, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setFormState({
          ...formState,
          loading: false,
          result: {
            error: false,
            result: t('PRODUCT_DELETED', 'Product deleted')
          }
        })
        showToast(ToastType.Success, t('PRODUCT_DELETED', 'Product deleted'))
        getProductsByCategoryId()
        return true
      } else {
        setFormState({
          ...formState,
          loading: false,
          result: {
            error: true,
            result
          }
        })
        return false
      }
    } catch (err) {
      setFormState({
        ...formState,
        result: {
          error: true,
          result: err.message
        },
        loading: false
      })
      return false
    }
  }

  useEffect(() => {
    const spreadProducts = []
    for (const product of categoryState.products) {
      const taxShow = !product?.tax ? taxShowbusiness : `${product.tax?.rate}% ${business.tax?.type === 1 ? t('INCLUDED_ON_PRICE', 'Included on price') : t('NOT_INCLUDED_ON_PRICE', 'Not included on price')}`
      const feeShow = !product.fee ? feeShowbusiness : `${parsePrice(product.fee?.fixed)} + ${product.fee?.percentage}%`
      const _product = {
        ...product,
        taxShow,
        feeShow
      }
      spreadProducts.push(_product)
    }
    setFormState({ ...formState, products: spreadProducts })
  }, [categoryState?.products])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          handleItemChange={handleItemChange}
          spreadSheetState={formState}
          handleRowRemove={handleRowRemove}
          pendingRemoval={pendingRemoval}
          confirmRemoval={confirmRemoval}
          cancelRemoval={cancelRemoval}
          handleAfterSectionEnd={handleAfterSectionEnd}
          handleoutsideClickDeselects={handleoutsideClickDeselects}
        />
      )}
    </>
  )
}

BusinessSpreadSheet.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Object for a business
   */
  businessState: PropTypes.object,
  /**
    * Function to set a business state
    */
  setBusinessState: PropTypes.func
}
