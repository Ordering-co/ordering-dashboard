import React, { useState, useEffect } from 'react'
import { useLanguage, useUtils, useOrder } from '../../../../../../index'
import { Avatar, Button, Dialog, IconButton, SearchField, Skeleton } from '../../../Shared/Product'
import { Minus, Plus, Trash2 } from '../../../Shared/Icon'
import { Confirm } from '../../../Shared'
import { ProductForm } from '../ProductForm'
import '../steps.css'

const SKELETON_ROWS = 3

// Redesign 5.5-B: search + product rows (name and price), the cart lines with 32/44px quantity steppers,
// and ProductForm in a Product dialog. Same product list, same server search, same cart handlers.
export const SelectProducts = (props) => {
  const {
    productList,
    handeUpdateProductCart,
    cart,
    business,
    getProducts
  } = props

  const [, t] = useLanguage()
  const [{ optimizeImage, parsePrice }] = useUtils()
  const [, { removeProduct }] = useOrder()

  const [searchValue, setSearchValue] = useState('')
  const [openProduct, setOpenProduct] = useState(false)
  const [curProduct, setCurProduct] = useState(null)
  const [selectedProductCart, setSelectedProductCart] = useState(null)
  const [isCartProduct, setIsCartProduct] = useState(false)
  const [confirm, setConfirm] = useState({ open: false, content: null, handleOnAccept: null })

  const handleSelectProduct = (product) => {
    setIsCartProduct(false)
    setSelectedProductCart(null)
    setCurProduct(product)
    setOpenProduct(true)
  }

  const handleEditProduct = (product) => {
    setIsCartProduct(true)
    setCurProduct(null)
    setSelectedProductCart(product)
    setOpenProduct(true)
  }

  const closeModalProductForm = () => {
    setCurProduct(null)
    setOpenProduct(false)
  }

  const handleDeleteClick = (product) => {
    setConfirm({
      open: true,
      content: t('QUESTION_DELETE_PRODUCT', 'Are you sure that you want to delete the product?'),
      handleOnAccept: () => {
        removeProduct(product, cart)
        setConfirm({ ...confirm, open: false })
      }
    })
  }

  const onChange = (product) => {
    handleSelectProduct(product)
    setSearchValue('')
  }

  useEffect(() => {
    if (productList?.products) {
      const productsExist = productList?.products?.filter(product => (product?.name || '').toLocaleLowerCase().includes(searchValue.toLocaleLowerCase()))
      if (productsExist.length <= 3) {
        getProducts(searchValue)
      }
    }
  }, [searchValue])

  const loading = !!productList?.loading
  const visible = loading || !productList?.products
    ? []
    : productList.products.filter(product => (product?.name || '').toLocaleLowerCase().includes(searchValue.toLocaleLowerCase()))
  const formProduct = curProduct || selectedProductCart

  return (
    <div className='odc-steps'>
      <h4 className='odc-steps-heading'>{t('WAHT_WANT_TO_BUY', 'What do you want us to buy?')}</h4>
      <SearchField
        label={t('SEARCH_PRODUCTS', 'Search products')}
        placeholder={t('SEARCH_PRODUCTS', 'Search products')}
        clearLabel={t('CLEAR', 'Clear')}
        value={searchValue}
        onChange={setSearchValue}
      />
      <ul className='odc-steps-list' data-scroll='' aria-label={t('SELECT_PRODUCT', 'Select product')} aria-busy={loading || undefined}>
        {loading && Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <li key={index} className='odc-steps-skeleton-row'><Skeleton size='60%' /></li>
        ))}
        {visible.map(product => (
          <li key={product?.id}>
            <button type='button' className='odc-steps-row' onClick={() => onChange(product)}>
              <Avatar
                kind='business'
                name={product?.name}
                src={product?.images ? optimizeImage(product.images, 'h_50,c_limit') : undefined}
              />
              <span className='odc-steps-row-main'>
                <span className='odc-steps-row-name'>{product?.name}</span>
              </span>
              {typeof product?.price === 'number' && (
                <span className='odc-steps-row-price odc-figure'>{parsePrice(product.price)}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {!loading && productList?.products && visible.length === 0 && (
        <p className='odc-steps-hint'>{t('NO_PRODUCTS_FOUND', 'No products found.')}</p>
      )}
      {cart?.products?.length > 0 && (
        <ul className='odc-steps-list' aria-label={t('ITEMS', 'Items')}>
          {cart.products.map((product, index) => (
            <li key={`${product.id}_${index}`} className='odc-steps-cart-line'>
              <Avatar
                kind='business'
                name={product?.name}
                src={product?.images ? optimizeImage(product.images, 'h_50,c_limit') : undefined}
              />
              <span className='odc-steps-row-main'>
                <span className='odc-steps-row-name'>{product?.name}</span>
                {typeof product?.total === 'number' && (
                  <span className='odc-steps-row-meta odc-figure'>{parsePrice(product.total)}</span>
                )}
              </span>
              <span className='odc-steps-stepper'>
                <IconButton
                  icon={Minus}
                  label={t('DECREMENT_QUANTITY', 'Decrease quantity')}
                  disabled={product?.quantity === 1}
                  onClick={() => handeUpdateProductCart(product, false)}
                />
                <span className='odc-steps-qty odc-num'>
                  <span className='odc-sr-only'>{t('QUANTITY', 'Quantity')}</span>
                  {product?.quantity}
                </span>
                <IconButton
                  icon={Plus}
                  label={t('INCREMENT_QUANTITY', 'Increase quantity')}
                  disabled={product?.maximum_per_order === product?.quantity}
                  onClick={() => handeUpdateProductCart(product, true)}
                />
              </span>
              <span className='odc-steps-line-actions'>
                <Button
                  variant='ghost'
                  aria-label={t('EDIT_PRODUCT', 'Edit product')}
                  onClick={() => handleEditProduct(product)}
                >
                  {t('EDIT', 'Edit')}
                </Button>
                <IconButton
                  icon={Trash2}
                  label={t('DELETE_PRODUCT', 'Delete product')}
                  onClick={() => handleDeleteClick(product)}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
      {openProduct && (
        <Dialog
          open={openProduct}
          size='md'
          className='odc-steps-product-dialog'
          title={formProduct?.name || t('PRODUCT', 'Product')}
          closeLabel={t('CLOSE', 'Close')}
          onOpenChange={next => { if (!next) closeModalProductForm() }}
        >
          <ProductForm
            isCartProduct={isCartProduct}
            product={curProduct}
            productCart={selectedProductCart}
            businessSlug={business?.slug}
            businessId={business?.id}
            categoryId={curProduct?.category_id || selectedProductCart?.category_id}
            productId={curProduct?.id || selectedProductCart?.id}
            onSave={() => setOpenProduct(false)}
            productAddedToCartLength={cart?.products?.reduce((productsLength, Cproduct) => { return productsLength + (Cproduct?.id === curProduct?.id ? Cproduct?.quantity : 0) }, 0) || 0}
          />
        </Dialog>
      )}

      <Confirm
        title={t('PRODUCT', 'Product')}
        content={confirm.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={confirm.open}
        onClose={() => setConfirm({ ...confirm, open: false })}
        onCancel={() => setConfirm({ ...confirm, open: false })}
        onAccept={confirm.handleOnAccept}
        closeOnBackdrop={false}
      />
    </div>
  )
}
