import React, { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import {
  useLanguage,
  useApi,
  useToast,
  ToastType,
  BusinessProductsListing as BusinessProductsListingController
} from '../../../../../index'
import { BusinessProductsCategoyDetails } from '../BusinessProductsCategoyDetails'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { Modal, SideBar } from '../../Shared'
import { Button, EmptyState, InlineNotice } from '../../Shared/Product'
import { TriangleAlert } from '../../Shared/Icon'
import { BusinessProductList } from '../BusinessProductList'
import { CatalogCategories } from '../CatalogCategories'
import { ProductDetails } from '../ProductDetails'
import { SingleBusinessCategoryEdit } from '../SingleBusinessCategoryEdit'
import { BusinessSelectHeader } from '../BusinessSelectHeader'
import { BatchImageForm } from '../BatchImageForm'
import { BusinessDetails } from '../BusinessDetails'
import { ProductStartGuide } from '../ProductStartGuide'
import { BusinessImporters } from '../../Connect/BusinessImporters'
import { addQueryToUrl, removeQueryToUrl, stringToSlug } from '../../../utils'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { useStoreWebsiteUrl } from '../../../hooks/useWebsiteUrl'
import { CatalogHeader, CatalogSearch } from './CatalogHeader'

import './catalog.css'

const BusinessProductsListingUI = (props) => {
  const {
    categorySelected,
    searchValue,
    handleChangeCategory,
    handleChangeSearch,
    errors,
    businessState,
    onProductRedirect,
    handleStoresRedirect,
    slug,
    categoryId,
    productId,
    isInitialRender,
    handleUpdateInitialRender,
    handleUpdateBusinessState,
    setCategorySelected,
    setBusinessSlug,
    openCategories,
    setFormTaxState,
    formTaxState,
    catalogState,
    retryCatalogs,
    taxes,
    setTaxes,
    fees,
    setFees,
    getBusiness,
    businessTypes,
    setBusinessTypes,
    categoryState,
    handleUpdateCategoryState,
    getPageProducts
  } = props

  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()
  const { width } = useWindowSize()
  const isPhone = useIsPhone()
  const [ordering] = useApi()
  const [, { showToast }] = useToast()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [viewMethod, setViewMethod] = useState('list')
  const [templateLoading, setTemplateLoading] = useState(false)

  const handleUseSchoolTemplate = async () => {
    if (templateLoading) return
    setTemplateLoading(true)
    showToast(ToastType.Info, t('LOADING', 'Loading'))
    const days = [
      { day: 1, key: 'MONDAY', name: 'Monday' },
      { day: 2, key: 'TUESDAY', name: 'Tuesday' },
      { day: 3, key: 'WEDNESDAY', name: 'Wednesday' },
      { day: 4, key: 'THURSDAY', name: 'Thursday' },
      { day: 5, key: 'FRIDAY', name: 'Friday' }
    ]
    try {
      const created = []
      for (let i = 0; i < days.length; i++) {
        const name = t(`SCHOOL_DAY_${days[i].key}`, days[i].name)
        const { content } = await ordering
          .businesses(parseInt(businessState?.business?.id))
          .categories()
          .save({ name, slug: stringToSlug(name), rank: i + 1, enabled: true, preparation_day_of_week: days[i].day })
        if (content?.error) {
          showToast(ToastType.Error, Array.isArray(content.result) ? content.result[0] : content.result)
          break
        }
        created.push({ ...content.result, products: [], subcategories: [] })
      }
      if (created.length && handleUpdateBusinessState) {
        handleUpdateBusinessState({ ...businessState.business, categories: [...(businessState.business?.categories || []), ...created] })
        showToast(ToastType.Success, t('SCHOOL_TEMPLATE_CREATED', 'Weekly categories created'))
      }
    } catch (err) {
      showToast(ToastType.Error, err.message)
    } finally {
      setTemplateLoading(false)
    }
  }
  const [currentCategory, setCurrentCategory] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [showSelectHeader, setShowSelectHeader] = useState(false)
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  const [productsPerPage, setProductsPerPage] = useState(10)
  const [batchImageFormOpen, setBatchImageFormOpen] = useState(false)
  const [openSidebar, setOpenSidebar] = useState(null)
  const [showPopup, setShowPopup] = useState(false)

  const handleCloseImporters = () => {
    setOpenSidebar(null)
    getBusiness()
  }
  const [allowSpreadColumns, setAllowSpreadColumns] = useState({
    id: true,
    name: true,
    description: true,
    price: true,
    cost_price: true,
    inventoried: true,
    quantity: true
  })
  const spreadColumnOptions = [
    {
      value: 'cost_price',
      content: t('PRODUCT_COST', 'Product cost')
    },
    {
      value: 'inventoried',
      content: t('INVENTORY', 'Inventory')
    },
    {
      value: 'quantity',
      content: t('QUANTITY', 'Quantity')
    }
  ]
  const handleChangeAllowSpreadColumns = (type) => {
    setAllowSpreadColumns({
      ...allowSpreadColumns,
      [type]: !allowSpreadColumns[type]
    })
  }

  const taxesCatalogError = !!catalogState?.taxes.error
  const feesCatalogError = !!catalogState?.fees.error
  const catalogError = taxesCatalogError || feesCatalogError
  const catalogErrorMessage = taxesCatalogError && feesCatalogError
    ? t('PRODUCT_FISCAL_CATALOGS_LOAD_ERROR', 'Could not load taxes and fees. Please try again.')
    : taxesCatalogError
      ? t('PRODUCT_TAX_CATALOG_LOAD_ERROR', 'Could not load taxes. Please try again.')
      : t('PRODUCT_FEE_CATALOG_LOAD_ERROR', 'Could not load fees. Please try again.')

  const handleOpenCategoryDetails = (category = null, isInitialRender) => {
    setOpenSidebar(null)
    setSelectedProduct(null)
    setCurrentCategory(category)
    if (category && category?.id !== null) {
      setCategorySelected(category)
      setOpenSidebar('category_details')
      if (!isInitialRender) {
        addQueryToUrl({ category: category.id })
      }
    } else {
      setCurrentCategory(null)
      setOpenSidebar('category_details')
    }
  }

  const handleCloseEdit = () => {
    onProductRedirect && onProductRedirect({
      slug,
      category: null,
      product: null
    })
    setCurrentCategory(null)
    setOpenSidebar(null)
    removeQueryToUrl(['category'])
  }

  // J2 row 13 (stores-products P-14, D-56 f): the product editor holds its unsaved edits; opening another product or «Add product»
  // asks it first (`leaveGuardRef`, as the store list asks the store editor). With no edits it goes at once.
  const productEditorLeaveRef = useRef(null)
  const leaveProductEditor = (go) => {
    const editor = openSidebar === 'product_details' ? productEditorLeaveRef.current : null
    if (editor?.requestLeave) editor.requestLeave(go)
    else go()
  }

  const handleOpenProductDetails = (product, isInitialRender) => {
    const go = () => {
      setSelectedProduct(product)
      setOpenSidebar('product_details')
      if (!isInitialRender) {
        onProductRedirect({
          slug: businessState?.business?.slug,
          product: product.id,
          category: product.category_id
        })
      }
    }
    if (openSidebar === 'product_details' && String(selectedProduct?.id) === String(product?.id)) return go()
    leaveProductEditor(go)
  }

  const handleCloseProductDetails = () => {
    setOpenSidebar(null)
    setSelectedProduct(null)
    handleUpdateInitialRender(false)
    onProductRedirect({
      slug: businessState?.business?.slug
    })
  }

  // redesign SP-F1 SP-10: Add product also works on the spreadsheet view (the form is not drawn inside the list branch)
  const handleProductAdd = (status) => {
    if (status) {
      leaveProductEditor(() => setOpenSidebar('add_product'))
    } else {
      setOpenSidebar(null)
    }
  }

  const handleSelectHeader = (open) => {
    setShowSelectHeader(typeof open === 'boolean' ? open : !showSelectHeader)
  }

  const handleClose = () => {
    setShowSelectHeader(false)
  }

  const changeBusinessState = (business) => {
    handleClose()
    setSelectedBusiness(business)
    setCategorySelected(null)
    setBusinessSlug(business?.slug)
    onProductRedirect({ slug: business?.slug })
  }

  useEffect(() => {
    if (categoryId && productId) {
      handleUpdateInitialRender(true)
    }
  }, [])
  useEffect(() => {
    if (!isInitialRender || !businessState?.business?.slug) return
    setOpenSidebar('product_details')
    onProductRedirect({
      slug: businessState?.business?.slug,
      product: productId,
      category: categoryId
    })
  }, [businessState.business?.slug, isInitialRender])

  const openBatchImageUploader = () => {
    setBatchImageFormOpen(true)
  }

  const storeUrl = useStoreWebsiteUrl(businessState?.business?.slug)

  const handleOpenSite = () => {
    if (!storeUrl || businessState?.loading) return
    window.open(storeUrl, '_blank', 'noopener,noreferrer')
  }

  // Close the panels when the user switches store. Only on a real change of
  // slug: on mount it ran in the same commit as the effect above and undid
  // isInitialRender, so a product link (?category=&product=) never opened
  // its panel; and a link's pending product must not reopen in another store
  const previousSlugRef = useRef(slug)
  useEffect(() => {
    if (previousSlugRef.current === slug) return
    previousSlugRef.current = slug
    if (slug) {
      setOpenSidebar(null)
      setSelectedProduct(null)
      handleUpdateInitialRender(false)
    }
  }, [slug])

  useEffect(() => {
    if (!slug) {
      setSelectedBusiness(null)
      setOpenSidebar(null)
      handleChangeSearch(null)
      setViewMethod('list')
      setShowSelectHeader(true)
    }
  }, [slug])

  // bugs E D25: the guide opened on every new object of the business (each getBusiness, each handleUpdateBusinessState), so
  // closing it was undone by the next reload. It opens once per store (by id) while the store has no categories: another empty store opens
  // it again, and a store whose guide the person closed (or used) does not get it back.
  const guideOpenedForRef = useRef(new Set())
  useEffect(() => {
    // redesign SP-F1 SP-06: a store that failed to load is not a store without categories
    if (businessState?.business && businessState?.business?.categories?.length === 0 && !businessState?.error) {
      const storeKey = String(businessState.business.id ?? businessState.business.slug ?? '')
      if (guideOpenedForRef.current.has(storeKey)) return
      guideOpenedForRef.current.add(storeKey)
      setShowPopup(true)
    }
  }, [businessState?.business])

  // bugs E SP-19 / D7: the store (by id) whose first category this page already chose. Refresh is `getBusiness`, and the
  // effect below ran on every end of a load: it put the person back on the first category. Once a store has had its first category chosen,
  // a reload keeps what the person has (a category, or «All products») unless the category is gone.
  const categoryChosenForRef = useRef(null)
  const findCategory = (categories, id) => {
    for (const category of categories || []) {
      if (category?.id === id) return category
      const nested = findCategory(category?.subcategories, id)
      if (nested) return nested
    }
    return null
  }

  useEffect(() => {
    if (businessState.loading) return
    const categoryId = query.get('category')
    const productId = query.get('product')
    if (categoryId && productId) {
      const initCategory = businessState.business?.categories?.find(category => category.id === Number(categoryId))
      const initProduct = initCategory?.products?.find(product => product.id === Number(productId))
      if (initCategory) {
        handleChangeCategory(null, initCategory)
        categoryChosenForRef.current = businessState.business?.id
      }
      if (initProduct) {
        handleOpenProductDetails(initProduct, true)
      }
    } else if (categoryId && !productId) {
      const initCategory = businessState.business?.categories?.find(category => category.id === Number(categoryId))
      if (initCategory) {
        handleChangeCategory(null, initCategory)
        handleOpenCategoryDetails(initCategory, true)
        categoryChosenForRef.current = businessState.business?.id
      }
    } else {
      // redesign SP-F1 SP-03 (SP-19): the first category is the one with the lowest `rank`, the one the tree draws first
      const categories = businessState?.business?.categories
      if (!categories) return
      const alreadyChosen = categories.length > 0 && businessState.business?.id != null && categoryChosenForRef.current === businessState.business.id
      if (alreadyChosen) {
        // «All products» (no category): keep it, and reload its list (the controller only reloads the list of a chosen category)
        if (!categorySelected) {
          getPageProducts(true, 1)
          return
        }
        // the category still exists: keep it (the controller reloads its products)
        if (findCategory(categories, categorySelected.id)) return
      }
      setCategorySelected([...categories].sort((a, b) => a.rank - b.rank)[0])
      if (categories.length > 0) categoryChosenForRef.current = businessState.business?.id
    }
  }, [businessState.loading])

  const storeName = selectedBusiness?.name || businessState?.business?.name
  const productsErrorMessage = Array.isArray(errors) ? errors[0] : errors
  const showStoreError = Boolean(businessState?.error) && !businessState?.loading
  const showProductsError = Boolean(errors) && !categoryState?.loading

  // redesign SP-FA: the head, then two columns (categories | products), or the error in their place
  return (
    <>
      <div className='odc-root odc-cat-page'>
        <CatalogHeader
          storeName={storeName}
          loadingStore={Boolean(slug) && !storeName && Boolean(businessState?.loading)}
          hasStore={Boolean(slug)}
          selectorOpen={showSelectHeader}
          onToggleSelector={handleSelectHeader}
          selector={showSelectHeader && (
            <BusinessSelectHeader
              close={handleClose}
              isOpen={showSelectHeader}
              changeBusinessState={changeBusinessState}
              noActiveStatusCondition
            />
          )}
          onOpenMenu={isCollapse ? () => handleMenuCollapse(false) : undefined}
          canAddProduct={Boolean(categorySelected)}
          addProductDisabled={businessState?.business?.categories?.length === 0}
          onAddProduct={() => handleProductAdd(true)}
          onAddCategory={() => handleOpenCategoryDetails()}
          showWeeklyTemplate={businessState?.business?.vertical === 'school' && businessState?.business?.categories?.length === 0}
          templateLoading={templateLoading}
          onUseTemplate={handleUseSchoolTemplate}
          setOpenSidebar={setOpenSidebar}
          onImportSuccess={getBusiness}
          business={businessState?.business}
          businessLoading={Boolean(businessState?.loading)}
          onRefresh={() => getBusiness()}
          refreshing={Boolean(businessState?.loading)}
          siteDisabled={!storeUrl || Boolean(businessState?.loading)}
          onOpenSite={handleOpenSite}
          onOpenStore={() => {
            addQueryToUrl({ id: businessState?.business?.id })
            setOpenSidebar('business_details')
          }}
          categoryName={categorySelected?.name}
          isPhone={isPhone}
        />
        {slug && showStoreError && (
          <div className='odc-cat-error'>
            <EmptyState
              tone='error'
              icon={TriangleAlert}
              title={t('CATALOG_STORE_LOAD_ERROR', "We couldn't load this store.")}
              description={translateApiMessage(t, Array.isArray(businessState.error) ? businessState.error[0] : businessState.error, null)}
              action={<Button onClick={() => getBusiness()}>{t('RETRY', 'Retry')}</Button>}
            />
          </div>
        )}
        {/* main: the taxes or fees catalog failed to load; the products still edit, and Retry asks only for the failed ones */}
        {catalogError && (
          <div className='odc-cat-error' role='alert'>
            <InlineNotice
              tone='danger'
              icon={TriangleAlert}
              live={false}
              action={(
                <Button size='sm' onClick={retryCatalogs} disabled={catalogState.taxes.loading && catalogState.fees.loading}>
                  {t('RETRY', 'Retry')}
                </Button>
              )}
            >
              {catalogErrorMessage}
            </InlineNotice>
          </div>
        )}
        {slug && !showStoreError && (
          <div className='odc-cat-body'>
            <div className='odc-cat-side'>
              <CatalogCategories
                businessState={businessState}
                categorySelected={categorySelected}
                onClickCategory={handleChangeCategory}
                handleOpenCategoryDetails={handleOpenCategoryDetails}
                openCategories={openCategories}
                handleUpdateBusinessState={handleUpdateBusinessState}
                setCategorySelected={setCategorySelected}
                setCurrentCategory={setCurrentCategory}
              />
            </div>
            <div className='odc-cat-main'>
              <div className='odc-cat-subhead'>
                <SingleBusinessCategoryEdit
                  {...props}
                  category={categorySelected}
                  categorySelected={categorySelected}
                  handleChangeCategory={handleChangeCategory}
                  business={businessState?.business}
                  handleOpenCategoryDetails={handleOpenCategoryDetails}
                  viewMethod={viewMethod}
                  onViewMethodChange={setViewMethod}
                  searchSlot={(
                    <CatalogSearch
                      value={searchValue}
                      onSearch={handleChangeSearch}
                      inCategory={Boolean(categorySelected)}
                    />
                  )}
                  onOpenBatchImages={openBatchImageUploader}
                  allowSpreadColumns={allowSpreadColumns}
                  spreadColumnOptions={spreadColumnOptions}
                  handleChangeAllowSpreadColumns={handleChangeAllowSpreadColumns}
                />
              </div>
              <div className='odc-cat-list'>
                {showProductsError
                  ? (
                    <EmptyState
                      tone='error'
                      icon={TriangleAlert}
                      title={t('CATALOG_PRODUCTS_LOAD_ERROR', "We couldn't load the products.")}
                      description={translateApiMessage(t, productsErrorMessage, null)}
                      action={<Button onClick={() => getPageProducts(true, 1)}>{t('RETRY', 'Retry')}</Button>}
                    />
                    )
                  : (
                    <BusinessProductList
                      {...props}
                      categorySelected={categorySelected}
                      productDetailsId={selectedProduct?.id}
                      viewMethod={viewMethod}
                      handleOpenProductDetails={handleOpenProductDetails}
                      handleParentProductAdd={handleProductAdd}
                      isParentProductAdd={openSidebar === 'add_product'}
                      allowSpreadColumns={allowSpreadColumns}
                      productsPerPage={productsPerPage}
                      setProductsPerPage={setProductsPerPage}
                    />
                    )}
              </div>
            </div>
          </div>
        )}
      </div>
      {
        openSidebar === 'category_details' && (
          <SideBar
            open={openSidebar === 'category_details'}
            onClose={handleCloseEdit}
            sidebarId='editCategory'
          >
            <BusinessProductsCategoyDetails
              {...props}
              onClose={handleCloseEdit}
              handleChangeCategory={handleChangeCategory}
              category={currentCategory}
              businessState={businessState}
              categorySelected={categorySelected}
            />
          </SideBar>
        )
      }
      {openSidebar === 'product_details' && (
        <ProductDetails
          open={openSidebar === 'product_details'}
          onClose={handleCloseProductDetails}
          leaveGuardRef={productEditorLeaveRef}
          product={selectedProduct}
          productId={productId}
          categoryId={categoryId}
          business={businessState?.business}
          handleUpdateBusinessState={handleUpdateBusinessState}
          setFormTaxState={setFormTaxState}
          formTaxState={formTaxState}
          catalogState={catalogState}
          retryCatalogs={retryCatalogs}
          taxes={taxes}
          setTaxes={setTaxes}
          fees={fees}
          setFees={setFees}
          categoryState={categoryState}
          handleUpdateCategoryState={handleUpdateCategoryState}
          getPageProducts={getPageProducts}
        />
      )}
      {openSidebar === 'business_details' && (
        <BusinessDetails
          open={openSidebar === 'business_details'}
          businessId={selectedBusiness?.id || businessState?.business?.id}
          handleSucessRemoveBusiness={() => handleStoresRedirect()}
          // handleSucessUpdateBusiness={handleSucessUpdateBusiness}
          onClose={() => {
            setOpenSidebar(null)
            removeQueryToUrl(['id'])
          }}
          businessTypes={businessTypes}
          setBusinessTypes={setBusinessTypes}
        />
      )}
      {batchImageFormOpen && (
        <Modal
          width={width > 1440 ? '40%' : '60%'}
          padding='20px'
          open={batchImageFormOpen}
          onClose={() => setBatchImageFormOpen(false)}
        >
          <BatchImageForm
            {...props}
            onClose={() => setBatchImageFormOpen(false)}
          />
        </Modal>
      )}
      {showPopup && !businessState?.error && (
        <Modal
          width='769px'
          padding='25px'
          open={showPopup}
          onClose={() => setShowPopup(false)}
        >
          <ProductStartGuide
            business={businessState?.business}
            onClose={() => setShowPopup(false)}
            onImportMenu={() => {
              setShowPopup(false)
              setOpenSidebar('importers')
            }}
          />
        </Modal>
      )}
      {openSidebar === 'importers' && (
        <BusinessImporters
          open={openSidebar === 'importers'}
          business={businessState?.business}
          onClose={handleCloseImporters}
          onGoToProducts={handleCloseImporters}
        />
      )}
    </>
  )
}

export const BusinessProductsListing = (props) => {
  const [isInitialRender, setIsInitialRender] = useState(false)

  const businessProductslistingProps = {
    ...props,
    UIComponent: BusinessProductsListingUI,
    shareWithAssistant: true,
    isInitialRender,
    handleUpdateInitialRender: (val) => setIsInitialRender(val)
  }
  return (
    <BusinessProductsListingController {...businessProductslistingProps} />
  )
}
