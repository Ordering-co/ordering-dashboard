import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

/**
 * Component to create importer form without UI component
 */

export const ImporterForm = (props) => {
  const {
    UIComponent,
    handleSuccessAdd,
    handleSuccessUpdateImporter,
    selectedImporter,
    handleCustomEditImporter,
    handleCustomAddImporter
  } = props
  const [ordering] = useApi()
  const [session] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()
  const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: false } })
  const [mappingState, setMappingState] = useState({})
  const [fieldList, setFieldList] = useState({})
  const [metafieldList, setMetaFieldList] = useState({})
  const [isEdit, setIsEdit] = useState(false)
  const [editState, setEditState] = useState({})

  const integerKeys = [
    'business_id', 'external_business_id', 'category_id', 'external_category_id', 'external_parent_category_id',
    'product_id', 'rank', 'external_product_id', 'extra_id', 'external_extra_id', 'extra_option_id', 'external_extra_option_id',
    'extra_option_suboption_id', 'external_extra_option_suboption_id'
  ]
  /**
 * Update form state data
 * @param {EventTarget} e Related HTML event
 */
  const handleChangeInput = (e, isMany) => {
    let currentChanges = {}
    if (isMany) {
      Object.values(e).map(obj => {
        currentChanges = {
          ...currentChanges,
          [obj.name]: obj.value
        }
      })
    } else {
      currentChanges = {
        [e.target.name]: e.target.value
      }
    }
    setFormState({
      ...formState,
      changes: { ...formState.changes, ...currentChanges }
    })
  }

  const handleChangeMappingInput = (e, isMany) => {
    let mappingData = {}
    if (isMany) {
      Object.values(e).map(obj => {
        mappingData = {
          ...mappingData,
          [obj.name]: obj.value
        }
      })
    } else {
      mappingData = {
        [e.target.name]: e.target.value
      }
    }
    if (integerKeys.includes(e.target.name) && e.target.value === '') {
      const removeKey = e.target.name
      const _mappingState = mappingState

      delete _mappingState[removeKey]
      setMappingState({ ..._mappingState })
      return
    }
    setMappingState({
      ...mappingState, ...mappingData
    })
  }

  const addNewField = (key, value) => {
    const field = { [key]: parseInt(value) }
    setFieldList({
      ...fieldList, ...field
    })
    clearFieldForm()
  }

  const removeField = (fieldKey) => {
    const _fieldList = { ...fieldList }
    delete _fieldList[fieldKey]
    setFieldList(_fieldList)
  }

  const addNewMetaField = (key, value) => {
    const field = { [key]: parseInt(value) }
    setMetaFieldList({
      ...metafieldList, ...field
    })
    clearFieldForm()
  }

  const removeMetaField = (metaFieldKey) => {
    const _metafieldList = { ...metafieldList }
    delete _metafieldList[metaFieldKey]
    setMetaFieldList(_metafieldList)
  }

  const handleChangeSelect = (type, value) => {
    let currentChanges = {}
    currentChanges = { [type]: value }
    setFormState({
      ...formState,
      changes: { ...formState.changes, ...currentChanges }
    })

    if (!isEdit) {
      setMappingState({})
      clearMappingForm()
    }
  }

  const clearMappingForm = () => {
    if (document.getElementById('importer-form')) {
      document.getElementById('importer-form').reset()
    }
  }

  const clearFieldForm = () => {
    if (document.getElementById('field-form')) {
      document.getElementById('field-form').reset()
    }
  }

  const clearImorterForm = () => {
    clearMappingForm()
    clearFieldForm()
    setMappingState({})
    setFieldList({})
    setEditState({})
    setFormState({
      ...formState,
      changes: {}
    })
  }

  const handleEditState = (seletedImpoter) => {
    let _metafieldList = {}
    _metafieldList = seletedImpoter?.mapping?.metafields
    if (typeof _metafieldList === 'object' && _metafieldList !== null) {
      setMetaFieldList(_metafieldList)
    }

    let _fieldList = {}
    _fieldList = seletedImpoter?.mapping?.fields
    if (typeof _fieldList === 'object' && _fieldList !== null) {
      setFieldList(_fieldList)
    }

    let _mappingState = {}
    _mappingState = seletedImpoter?.mapping
    setMappingState(_mappingState)
    setEditState({
      ...editState,
      name: seletedImpoter?.name,
      slug: seletedImpoter?.slug,
      type: seletedImpoter?.type,
      mapping: _mappingState,
      fields: _fieldList,
      metafields: _metafieldList
    })
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        name: seletedImpoter?.name,
        // slug: seletedImpoter?.slug,
        type: seletedImpoter?.type
      }
    })
  }

  const handleCreateImporter = async (updatedChanges) => {
    if (handleCustomAddImporter) {
      handleCustomAddImporter(formState.changes)
      return
    }
    showToast(ToastType.Info, t('LOADING', 'Loading'))
    const data = updatedChanges ? { ...updatedChanges } : { ...formState.changes }
    try {
      setFormState({ ...formState, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify(data)
      }
      const response = await fetch(`${ordering.root}/importers`, requestOptions)
      const { error, result } = await response.json()

      if (error) {
        setFormState({
          ...formState,
          loading: false,
          result: {
            error: true,
            result
          }
        })
      } else {
        showToast(ToastType.Success, t('IMPORTER_SAVED', 'Importer saved'))
        clearImorterForm()
        setFormState({
          loading: false,
          changes: {},
          result: {
            error: false,
            result
          }
        })
        if (handleSuccessAdd) {
          handleSuccessAdd(result)
        }
        if (props.onClose) {
          props.onClose()
        }
      }
    } catch (error) {
      setFormState({
        ...formState,
        result: {
          error: true,
          result: [error.message]
        },
        loading: false
      })
    }
  }

  /**
   * Function to update importer
   */
  const editImporter = async (updatedChanges) => {
    if (handleCustomEditImporter) {
      handleCustomEditImporter(formState.changes)
      return
    }
    showToast(ToastType.Info, t('LOADING', 'Loading'))
    const data = updatedChanges ? { ...updatedChanges } : { ...formState.changes }
    try {
      setFormState({ ...formState, loading: true })
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify(data)
      }
      const response = await fetch(`${ordering.root}/importers/${selectedImporter?.id}`, requestOptions)
      const { error, result } = await response.json()

      if (error) {
        setFormState({
          ...formState,
          loading: false,
          result: {
            error: true,
            result
          }
        })
      } else {
        showToast(ToastType.Success, t('IMPORTER_SAVED', 'Importer saved'))
        clearImorterForm()
        setFormState({
          loading: false,
          changes: {},
          result: {
            error: false,
            result
          }
        })

        handleSuccessUpdateImporter && handleSuccessUpdateImporter(result)
        props.onClose && props.onClose()
      }
    } catch (error) {
      setFormState({
        ...formState,
        result: {
          error: true,
          result: [error.message]
        },
        loading: false
      })
    }
  }

  useEffect(() => {
    if (Object.keys(metafieldList).length !== 0) {
      setMappingState({
        ...mappingState,
        metafields: metafieldList
      })
    }
  }, [metafieldList])

  useEffect(() => {
    if (Object.keys(fieldList).length !== 0) {
      setMappingState({
        ...mappingState,
        fields: fieldList
      })
    }
  }, [fieldList])

  useEffect(() => {
    if (Object.keys(mappingState).length !== 0) {
      const data = { ...mappingState }
      setFormState({
        ...formState,
        changes: {
          ...formState.changes,
          mapping: JSON.stringify(data)
        }
      })
    }
  }, [mappingState])

  const downloadCSV = () => {
    const allowedBusinessImporters = {
      business_id: 10,
      external_business_id: 120,
      name: 'House mine',
      logo: '"https://res.cloudinary.com/ordering2/image/upload/f_auto,q_auto,h_100,c_limit/v1539095959/crya6ibldlsz4hjyo03e.jpg"',
      email: 'test@ordering.co',
      slug: 'test_slug',
      header: '"https://s3.amazonaws.com/ordering-images2/res/ordering/image/upload/bqvntsurh8opknu58z9f/1534196989.jpg"',
      about: 'test about',
      address: '"5th Avenue, New York, NY, USA"',
      location: '"{""lat"":40.7552112,""lng"":-73.982322}"',
      timezone: 'America/New_York',
      description: 'test description',
      cellphone: '123123123123',
      phone: '123123',
      featured: 1,
      enabled: 1,
      front_layout: 'food',
      seo_image: '"https://res.cloudinary.com/ordering2/image/upload/f_auto,q_auto,h_100,c_limit/v1539095959/crya6ibldlsz4hjyo03e.jpg"',
      seo_title: 'seo title',
      seo_description: 'seo description',

      category_id: 10,
      external_category_id: 120,
      external_parent_category_id: 130,
      product_id: 10,
      image: '"https://s3.amazonaws.com/ordering-images2/res/ordering/image/upload/wmpfkcedo4y2kwxcamve/1534167067.png"',
      rank: 10,
      parent_category_id: 20,

      external_product_id: 100,
      price: 10,
      images: '"https://s3.amazonaws.com/ordering-images2/res/ordering/image/upload/lx0zuprnuozhqmaa97jj/1534200630.jpg"',
      sku: 'test_sku',
      inventoried: 1,
      quantity: 10,
      upselling: 1,
      in_offer: 1,
      offer_price: 10,
      offer_rate: 0,
      offer_rate_type: 1,
      offer_include_options: 1,
      tax_id: 10,
      fee_id: 10,
      estimated_person: '"test person"',
      barcode: '"0123456789"',
      barcode_alternative: '"0123"',
      seo_keywords: 'test key',
      hide_special_instructions: 1,
      maximum_per_order: 2,
      minimum_per_order: 1,

      extra_id: 10,
      external_extra_id: 100,
      extra_option_id: 10,
      external_extra_option_id: 100,
      extra_option_suboption_id: 10,
      external_extra_option_suboption_id: 100,
      min: 1,
      max: 1
    }

    const uniqueKeys = ['slug', 'name', 'sku', 'seo_keywords']

    let csvFields = {}
    if (selectedImporter?.type === 'sync_multiple') {
      selectedImporter.mapping.forEach(mapping => {
        const _mapping = { ...mapping }
        const fields = { ..._mapping.fields }
        const typeName = _mapping.type.replace('sync_', '').replace(/_/g, ' ')
        const newFields = {}
        for (const key in fields) {
          newFields[typeName + ' ' + key] = fields[key]
        }
        delete _mapping.fields
        delete _mapping.metafields
        delete _mapping.type
        const _csvFields = { ..._mapping, ...newFields }
        csvFields = { ...csvFields, ..._csvFields }
      })
    } else {
      const _mappingState = { ...mappingState }
      const fields = { ..._mappingState.fields }
      delete _mappingState.fields
      delete _mappingState.metafields
      csvFields = { ..._mappingState, ...fields }
    }

    const values = Object.values(csvFields)
    const max = Math.max(...values)
    const csvHeaders = Array(max + 1).fill('')
    const csvRow1 = Array(max + 1).fill('')
    const csvRow2 = Array(max + 1).fill('')
    for (const key in csvFields) {
      const fieldName = key.replace(/_/g, ' ')
      csvHeaders[csvFields[key]] = fieldName.charAt(0).toUpperCase() + fieldName.slice(1)

      if (selectedImporter?.type !== 'sync_multiple') {
        csvRow1[csvFields[key]] = allowedBusinessImporters[key] || ' '
        if (integerKeys.includes(key)) {
          csvRow2[csvFields[key]] = allowedBusinessImporters[key] + 1
        } else if (uniqueKeys.includes(key)) {
          csvRow2[csvFields[key]] = allowedBusinessImporters[key] + '_2'
        } else {
          csvRow2[csvFields[key]] = allowedBusinessImporters[key] || ' '
        }
      }
    }

    if (selectedImporter?.type === 'sync_multiple') {
      selectedImporter.mapping.forEach(mapping => {
        const _mapping = { ...mapping }
        const fields = { ..._mapping.fields }
        delete _mapping.fields
        delete _mapping.type
        for (const key in _mapping) {
          csvRow1[_mapping[key]] = allowedBusinessImporters[key] || ' '
          if (integerKeys.includes(key)) {
            csvRow2[_mapping[key]] = allowedBusinessImporters[key] + 1
          } else if (uniqueKeys.includes(key)) {
            csvRow2[_mapping[key]] = allowedBusinessImporters[key] + '_2'
          } else {
            csvRow2[_mapping[key]] = allowedBusinessImporters[key] || ' '
          }
        }
        for (const key in fields) {
          csvRow1[fields[key]] = allowedBusinessImporters[key] || ' '
          if (integerKeys.includes(key)) {
            csvRow2[fields[key]] = allowedBusinessImporters[key] + 1
          } else if (uniqueKeys.includes(key)) {
            csvRow2[fields[key]] = allowedBusinessImporters[key] + '_2'
          } else {
            csvRow2[fields[key]] = allowedBusinessImporters[key] || ' '
          }
        }
      })
    }

    const rows = [
      csvHeaders,
      csvRow1,
      csvRow2
    ]
    const csvContent = rows.map(e => e.join(',')).join('\n')
    const link = document.createElement('a')
    link.download = editState?.type + '.csv'
    const blob = new Blob(['\ufeff', csvContent], { type: 'text/csv' })
    const reader = new FileReader()
    reader.readAsDataURL(blob)
    reader.onload = () => {
      link.href = reader.result
      link.click()
    }
  }

  const handleUpdateMultipleMapping = (updatedMapping) => {
    setEditState({
      ...editState,
      mapping: updatedMapping
    })
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        mapping: JSON.stringify(updatedMapping)
      }
    })
  }

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          formState={formState}
          mappingState={mappingState}
          fieldList={fieldList}
          metafieldList={metafieldList}
          editState={editState}
          isEdit={isEdit}
          handleChangeInput={handleChangeInput}
          handleChangeSelect={handleChangeSelect}
          handleChangeMappingInput={handleChangeMappingInput}
          addNewField={addNewField}
          removeField={removeField}
          addNewMetaField={addNewMetaField}
          removeMetaField={removeMetaField}
          clearImorterForm={clearImorterForm}
          setIsEdit={setIsEdit}
          handleCreateImporter={handleCreateImporter}
          handleEditState={handleEditState}
          editImporter={editImporter}
          downloadCSV={downloadCSV}
          handleUpdateMultipleMapping={handleUpdateMultipleMapping}
        />
      )}
    </>
  )
}

ImporterForm.propTypes = {
  /**
   * Function to update importer list
   */
  handleSuccessUpdateImporter: PropTypes.func,
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
