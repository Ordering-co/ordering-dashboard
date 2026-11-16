import React, { useState, useEffect } from 'react'
import {
  useLanguage,
  useUtils,
  SingleBusinessCategory as SingleBusinessCategoryController
} from '../../../../../index'
import { Alert, ColumnAllowSettingPopover } from '../../Shared'
import { Button, IconButton, SegmentedControl, Skeleton } from '../../Shared/Product'
import { Image as ImageIcon, Pencil } from '../../Shared/Icon'
import '../BusinessProductList/catalog-products.css'

// redesign SP-F3 (C): the head of the chosen category on /stores/products. Image, name as the heading of the products, the pencil that
// opens the category, and on the other side the bar of the list: the page's search (`searchSlot`), List / Spreadsheet and, on the sheet,
// «Upload images in batch» and the columns of the sheet. Those controls live in the page (S/BusinessProductsListing); it gives them as
// props, and without them there is no bar (the head is then what it was: image, name, pencil).
//
// The head only shows the category: nothing here calls `handleInputChange` or `handlechangeImage` of the controller, so `isEditMode`
// never turned on and main's autosave on a click outside never ran. That global `click` listener (one per mount) is gone.

export const SingleBusinessCategoryUI = (props) => {
  const {
    categorySelected,
    isSkeleton,
    handleOpenCategoryDetails,
    categoryFormState,
    viewMethod,
    onViewMethodChange,
    searchSlot,
    onOpenBatchImages,
    allowSpreadColumns,
    spreadColumnOptions,
    handleChangeAllowSpreadColumns
  } = props

  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()

  const [alertState, setAlertState] = useState({ open: false, content: [] })

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  useEffect(() => {
    if (categoryFormState?.result?.error) {
      setAlertState({
        open: true,
        content: categoryFormState?.result?.result
      })
    }
  }, [categoryFormState?.result])

  // bugs E R-5: the «all» entry is «All products», the same words as the tree and the catalog head (it said «All»).
  const name = categorySelected?.name || t('ALL_PRODUCTS', 'All products')
  const image = categoryFormState?.changes?.image
  // with «All» the pencil opens the form to add a category, as in main: its name says so
  const pencilLabel = categorySelected?.name
    ? t('CATALOG_EDIT_CATEGORY', 'Edit _name_').replace('_name_', categorySelected.name)
    : t('ADD_CATEGORY', 'Add category')

  const isSheet = viewMethod === 'spreedsheet'
  const sheetTools = isSheet && (onOpenBatchImages || (spreadColumnOptions && handleChangeAllowSpreadColumns))
  const hasBar = Boolean(searchSlot || onViewMethodChange || sheetTools)

  return (
    <>
      <div className='odc-root odc-ch' data-index={categorySelected?.id}>
        <div className='odc-ch-title'>
          {isSkeleton
            ? (
              <>
                <Skeleton shape='box' size='var(--od-x-avatar-lg)' block='var(--od-x-avatar-lg)' />
                <span className='odc-ch-skeleton'><Skeleton /></span>
              </>
              )
            : (
              <>
                <span className='odc-ch-image'>
                  {image
                    ? <img src={optimizeImage(image, 'h_50,c_limit')} alt='' loading='lazy' />
                    : <ImageIcon className='odc-icon' />}
                </span>
                <h2 className='odc-ch-name' dir='auto' title={name}>{name}</h2>
                <IconButton
                  icon={Pencil}
                  label={pencilLabel}
                  onClick={() => handleOpenCategoryDetails(categorySelected)}
                />
              </>
              )}
        </div>

        {hasBar && !isSkeleton && (
          <div className='odc-ch-bar'>
            {searchSlot && <div className='odc-ch-search'>{searchSlot}</div>}
            {onViewMethodChange && (
              <div className='odc-ch-viewswitch'>
                <SegmentedControl
                  label={t('VIEW', 'View')}
                  value={viewMethod}
                  onValueChange={onViewMethodChange}
                  options={[
                    { value: 'list', label: t('LIST', 'List') },
                    { value: 'spreedsheet', label: t('SPREADSHEET', 'Spreadsheet') }
                  ]}
                />
              </div>
            )}
            {sheetTools && (
              <div className='odc-ch-sheet-tools'>
                {onOpenBatchImages && (
                  <Button icon={ImageIcon} onClick={() => onOpenBatchImages()}>
                    {t('UPLOAD_IMAGES_BATCH', 'Upload images in batch')}
                  </Button>
                )}
                {spreadColumnOptions && handleChangeAllowSpreadColumns && (
                  <ColumnAllowSettingPopover
                    allowColumns={allowSpreadColumns}
                    optionsDefault={spreadColumnOptions}
                    handleChangeAllowColumns={handleChangeAllowSpreadColumns}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <Alert
        title={t('CATEGORY', 'Category')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => closeAlert()}
        onAccept={() => closeAlert()}
        closeOnBackdrop={false}
      />
    </>
  )
}

export const SingleBusinessCategoryEdit = (props) => {
  const { isSkeleton } = props
  const singleBusinessCategoryProps = {
    ...props,
    UIComponent: SingleBusinessCategoryUI
  }
  return (
    <>
      {isSkeleton
        ? (
        <SingleBusinessCategoryUI {...props} />
          )
        : (
        <SingleBusinessCategoryController {...singleBusinessCategoryProps} />
          )}
    </>
  )
}
