import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'

export const LanguageTransSpread = (props) => {
  const {
    UIComponent,
    translationList,
    handleUpdateTranslationList,
    getTranslations,
    isShowProductType,
    selectedProductType
  } = props

  const [ordering] = useApi()
  const [{ token, loading }] = useSession()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: null } })
  const curCell = { row: -1, col: -1 }
  const [removing, setRemoving] = useState(false)

  /**
   * Method to select and deselect a row from spreadSheet table
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
    hotTableObj.deselectCell()
    hotTableObj.selectCell(row, col)
  }

  const handleoutsideClickDeselects = () => {
    curCell.row = -1
    curCell.col = -1
    return false
  }

  /**
   * Method to update and add translations
   */
  const handleItemChange = (b, accionHanson, hotTableObj) => {
    if (removing) {
      setRemoving(false)
      return
    }
    b = !b ? [] : b
    const changes = []
    const itemToAdd = []
    const itemToUpdate = []
    const errors = []
    for (let i = 0; i < b.length; i++) {
      const error = {
        key: false,
        text: false
      }
      if (b[i][2] !== b[i][3]) {
        let valid = true
        for (let j = 0; j < changes.length; j++) {
          if (changes[j] === b[i][0]) {
            valid = false
            break
          }
        }
        if (valid) {
          changes.push(b[i][0])
          const row = hotTableObj.getSourceDataAtRow(b[i][0])
          hotTableObj.validateRows(changes, function (res) {})
          if (!row.key) {
            error.key = true
            if (errors.indexOf(t('KEY_REQUIRED')) === -1) errors.push(t('KEY_REQUIRED'))
          }
          if ((isShowProductType && !row.value) || (!isShowProductType && !row.text)) {
            error.text = true
            if (errors.indexOf(t('TEXT_REQUIRED')) === -1) errors.push(t('TEXT_REQUIRED'))
          }
          if (isShowProductType && !error.key) {
            const productPrefix = selectedProductType.toUpperCase()
            if (!row.key.startsWith(`${productPrefix}_`)) {
              row.key = `${productPrefix}_${row.key}`
            }
          }
          const isExistKey = translationList?.translations?.find((translation) => (translation?.key === row?.key))
          if ((!isShowProductType && !row.id) || (isShowProductType && !isExistKey)) {
            if (error.key || error.text) continue
            row.row = b[i][0]
            itemToAdd.push(row)
          } else {
            if (error.key || error.text) continue
            itemToUpdate.push(row)
          }
        }
      }
    }
    if (errors.length > 0) {
      setFormState({ ...formState, result: { error: true, result: errors } })
    }
    if (itemToUpdate.length > 0) {
      createBulkTranslations(itemToUpdate, false, hotTableObj)
    }
    if (itemToAdd.length > 0) {
      createBulkTranslations(itemToAdd, true, hotTableObj)
    }
  }

  /**
   * Method to update translation from API
   */
  const createBulkTranslations = async (params, isPost, hotTableObj) => {
    if (loading) return
    try {
      setFormState({ ...formState, loading: true })
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      let body = {
        translations: JSON.stringify(params)
      }
      if (isShowProductType) {
        body = {
          ...body,
          version: 'v2',
          product: selectedProductType
        }
      }
      const requestOptions = {
        method: isPost ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      }

      const functionFetch = `${ordering.root}/bulks/translations`

      const response = await fetch(functionFetch, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setFormState({
          ...formState,
          loading: false,
          result: {
            error: false,
            result
          }
        })
        if (!isPost) {
          const translations = translationList?.translations.map(translation => {
            for (const item of params) {
              if (item.key === translation.key) {
                return {
                  ...translation,
                  key: item.key,
                  [isShowProductType ? 'value' : 'text']: item.text
                }
              }
            }
            return translation
          })
          handleUpdateTranslationList(translations)
        } else {
          getTranslations()
        }
        showToast(ToastType.Success, isPost ? t('WEB_APP_LANG_ADDED', 'Language item added') : t('WEB_APP_LANG_SAVED', 'Language change saved'))
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
      if (isPost) {
        for (let i = params.length - 1; i >= 0; i--) {
          hotTableObj.alter('remove_row', params[i].row)
        }
      }
    }
  }

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          creationFormState={formState}
          handleItemChange={handleItemChange}
          handleAfterSectionEnd={handleAfterSectionEnd}
          handleoutsideClickDeselects={handleoutsideClickDeselects}
        />
      )}
    </>
  )
}

LanguageTransSpread.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Object for translations
   */
  translationList: PropTypes.object,
  /**
   * Function to update translations
   */
  handleUpdateTranslationList: PropTypes.func,
  /**
   * Function to get translation list
   */
  getTranslations: PropTypes.func
}
