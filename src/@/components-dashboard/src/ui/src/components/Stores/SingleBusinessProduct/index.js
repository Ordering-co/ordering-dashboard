import React, { useState, useEffect, useRef } from 'react'
import LegacySkeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import {
  useUtils,
  useLanguage,
  SingleBusinessProduct as SingleBusinessProductController
} from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { bytesConverter } from '../../../utils'
import { InlineNotice, Menu, Skeleton, Switch, cx } from '../../Shared/Product'
import { focusReorderTrigger, getReorderState, reorderMenuItems, reorderTriggerProps } from '../../Shared/Product/reorder'
import { Ellipsis, GripVertical, Image as ImageIcon, TriangleAlert } from '../../Shared/Icon'
import { SingleListBusinessContainer, InfoBlock } from './styles'
import '../BusinessProductList/catalog-products.css'

// redesign SP-F3 (C): a product of /stores/products, as a <tbody> of the table (a row) or as a card under 768px. The controller of
// the row (SingleBusinessProduct, `~components`) wraps it, as it did: it keeps the save of the Enabled switch, the image and the rank.
// What changes: the thumbnail and the name are buttons, the grip is the only drag handle, the Enabled switch is a controlled Product
// Switch that is busy while it saves and goes back (and says why, in the row) when the save fails (M-12, D12), and the same data is
// drawn as a card on a phone. The spreadsheet view keeps its skeleton and its rows as they were.

const COLUMN_IDS = ['products', 'description', 'price', 'cost_price', 'tax', 'fee']
const IMAGE_ACCEPT = 'image/png, image/jpeg, image/jpg'
const MAX_IMAGE_KB = 2048

const firstMessage = (error) => (Array.isArray(error) ? error : [error])
  .map(item => (typeof item === 'string' ? item : item?.message))
  .find(Boolean)

const SheetRow = ({ isSkeleton, product, productFormState }) => {
  const [{ parsePrice }] = useUtils()
  return isSkeleton
    ? (
    <SingleListBusinessContainer>
      <tr>
        <td>
          <InfoBlock>
            <p><LegacySkeleton width={40} height={20} /></p>
          </InfoBlock>
        </td>
        <td>
          <InfoBlock>
            <p><LegacySkeleton width={80} height={15} /></p>
          </InfoBlock>
        </td>
        <td>
          <InfoBlock className='description'>
            <p><LegacySkeleton width={100} height={15} /></p>
          </InfoBlock>
        </td>
        <td>
          <LegacySkeleton width={80} height={15} />
        </td>
        <td>
          <LegacySkeleton width={20} height={20} />
        </td>
        <td>
          <LegacySkeleton width={80} height={15} />
        </td>
      </tr>
    </SingleListBusinessContainer>
      )
    : (
    <SingleListBusinessContainer>
      <tr>
        <td>
          {
            product?.id && (
              <InfoBlock>
                <p>{product?.id}</p>
              </InfoBlock>
            )
          }
        </td>
        <td>
          {
            product?.name && (
              <InfoBlock>
                <p>{product?.name}</p>
              </InfoBlock>
            )
          }
        </td>
        <td>
          {
            product?.description && (
              <InfoBlock>
                <p>{product?.description}</p>
              </InfoBlock>
            )
          }
        </td>
        <td>
          {
            product?.price && (
              <InfoBlock>
                <p>{parsePrice(product?.price)}</p>
              </InfoBlock>
            )
          }
        </td>
        <td>
          {
            product?.offer_price && (
              <InfoBlock>
                <p>{parsePrice(productFormState?.changes?.offer_price)}</p>
              </InfoBlock>
            )
          }
        </td>
        <td>
          {
            product?.quantity && (
              <InfoBlock>
                <p>{product?.quantity}</p>
              </InfoBlock>
            )
          }
        </td>
      </tr>
    </SingleListBusinessContainer>
      )
}

// ---- loading: the shape of what will come ------------------------------------------------------------------------------------------

const SKELETON_CELLS = {
  products: () => (
    <th scope='row'>
      <span className='odc-cp-product'>
        <Skeleton shape='box' size='var(--od-x-avatar)' block='var(--od-x-avatar)' />
        <Skeleton size='var(--od-x-search-min)' />
      </span>
    </th>
  ),
  description: () => <td><Skeleton size='var(--od-x-search)' /></td>,
  price: () => <td data-align='end'><Skeleton size='calc(var(--od-x-avatar-lg) * 2)' align='end' /></td>,
  cost_price: () => <td data-align='end'><Skeleton size='calc(var(--od-x-avatar-lg) * 2)' align='end' /></td>,
  tax: () => <td><Skeleton size='var(--od-x-search-min)' /></td>,
  fee: () => <td><Skeleton size='var(--od-x-cell-person)' /></td>
}

const RowSkeleton = ({ columnOrder }) => (
  <tbody className='odc-cp-row' data-skeleton='' aria-hidden='true'>
    <tr>
      {columnOrder.map(id => (
        <React.Fragment key={id}>
          {React.cloneElement(SKELETON_CELLS[id](), {
            'data-sticky': id === 'products' && columnOrder[0] === 'products' ? 'start' : undefined
          })}
          {id === 'products' && (
            <td data-sticky={columnOrder[0] === 'products' ? 'status' : undefined}>
              <Skeleton size='var(--od-x-switch-width)' block='var(--od-x-switch-height)' />
            </td>
          )}
        </React.Fragment>
      ))}
    </tr>
  </tbody>
)

const CardSkeleton = () => (
  <li className='odc-cp-card' data-skeleton='' aria-hidden='true'>
    <div className='odc-cp-card-head'>
      <Skeleton shape='box' size='var(--od-x-avatar)' block='var(--od-x-avatar)' />
      <Skeleton size='60%' />
    </div>
    <Skeleton size='80%' />
    <Skeleton size='40%' />
  </li>
)

// ---- a product ---------------------------------------------------------------------------------------------------------------------

const ProductItem = (props) => {
  const {
    variant,
    columnOrder: columnOrderProp,
    allowColumns,
    product,
    handleChangeProductActive,
    handleUpdateClick,
    handleOpenProductDetails,
    productFormState,
    handlechangeImage,
    isEditMode,
    productDetailsId,
    dataSelected,
    business,
    taxes,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    isLastProduct,
    isProductsBottom,
    hasSubcategories,
    canReorder,
    category,
    handleMoveProduct,
    handleSaveImage,
    reorderEdge,
    isFiltered
  } = props

  const [, t] = useLanguage()
  const [{ parsePrice, optimizeImage }] = useUtils()
  const [pending, setPending] = useState(null) // the value being saved; null when nothing is
  const [failure, setFailure] = useState(null) // { text } or { error }: what the row says when a save did not go through
  const mounted = useRef(true)
  const containerRef = useRef(null)
  const fileInputRef = useRef(null)
  useEffect(() => () => { mounted.current = false }, [])

  const isCard = variant === 'card'
  const columnOrder = columnOrderProp || COLUMN_IDS.filter(id => allowColumns?.[id] !== false)
  // `main` let the drag start with a category that has no subcategories with products; «All products» (no category chosen) would
  // write the rank among products of different categories, so there it is off (decision of SP-F3).
  const canDrag = !isCard && (canReorder ?? !hasSubcategories)
  // redesign J2 (, row 9, D-43 (a)): «Move up» / «Move down» in the ⋯ menu, where the drag would work, and on the card too
  // (the card has no drag). The siblings are the products of the category, by rank; the same request as the drag is sent.
  // J2 review H3: not while the category is searched (the results are not the whole order)
  const canMove = (canReorder ?? !hasSubcategories) && !isFiltered && typeof handleMoveProduct === 'function'
  // `productFormState.changes` is filled from the product by the controller's effect; until it runs the product itself is drawn
  const data = { ...product, ...productFormState?.changes }
  const isActive = product.id === productDetailsId
  const name = data.name || ''

  const failureText = (reason) => (reason?.text ?? translateApiMessage(t, firstMessage(reason?.error), t('STORES_CHANGE_FAILED', "We couldn't save the change.")))

  // ---- Enabled: controlled by the stored value of the product; busy while it saves; back (and a notice) when it fails ----
  const handleToggle = async (next) => {
    if (pending !== null) return
    setFailure(null)
    setPending(next)
    let result
    try {
      result = await handleChangeProductActive(next)
    } catch (error) {
      result = { ok: false, error }
    }
    if (!mounted.current) return
    setPending(null)
    if (result && result.ok === false) setFailure({ error: result.error })
  }

  // ---- the image: the same filter as in main. J2 row 12 (P-10, D-56 d): it is saved when it is chosen (`handleSaveImage`); a
  // controller without it keeps main's save with the next click outside the row ----
  const handleFiles = async (files) => {
    if (files?.length !== 1) return
    setFailure(null)
    const type = files[0].type.split('/')[0]
    if (type !== 'image') {
      setFailure({ text: t('ERROR_ONLY_IMAGES', 'Only images can be accepted') })
      return
    }
    if (bytesConverter(files[0]?.size) > MAX_IMAGE_KB) {
      setFailure({ text: t('IMAGE_MAXIMUM_SIZE', 'The maximum image size is 2 megabytes') })
      return
    }
    if (typeof handleSaveImage !== 'function') return handlechangeImage(files[0])
    const result = await handleSaveImage(files[0])
    if (mounted.current && result && result.ok === false) setFailure({ error: result.error })
  }

  // ---- Move up / Move down: the rank of the neighbour goes through the request of the drag; the row says why when it fails ----
  const handleMove = async (rank) => {
    setFailure(null)
    let result
    try {
      result = await handleMoveProduct(rank)
    } catch (error) {
      result = { ok: false, error }
    }
    if (result && result.ok === false) {
      if (mounted.current) setFailure({ error: result.error })
      return
    }
    focusReorderTrigger('product', product.id) // the list is drawn in its new order and the row may have been mounted again
  }

  const imageBusy = Boolean(productFormState?.loading)
  const openChooser = () => {
    if (imageBusy) return
    fileInputRef.current?.click()
  }

  useEffect(() => {
    // `main` listened on every row always; the listener only does something while the image waits to be saved
    if (!isEditMode) return undefined
    const closeProductEdit = async (e) => {
      if (containerRef.current?.contains(e.target)) return
      if (e.target.closest?.('.popup-component')) return
      if (Object.keys(productFormState?.changes || {}).length > 0 && !productFormState?.loading) {
        const result = await handleUpdateClick()
        if (mounted.current && result && result.ok === false) setFailure({ error: result.error })
      }
    }
    document.addEventListener('click', closeProductEdit)
    return () => document.removeEventListener('click', closeProductEdit)
  }, [isEditMode, productFormState])

  // ---- opening the product: the name, and the rest of the row (not the switch, the grip or the thumbnail) ----
  const open = () => handleOpenProductDetails(product)
  const handleRowClick = (event) => {
    if (event.target.closest('button, a, input, label, [data-odc-no-open]')) return
    open()
  }

  // ---- what the row shows ----
  const taxProduct = data.tax ?? taxes?.[`id:${data.tax_id}`] ?? business?.tax
  const taxProductType = taxProduct?.type || business?.tax_type
  const taxTypeText = taxProductType === 1 ? t('INCLUDED_ON_PRICE', 'Included on price') : t('NOT_INCLUDED_ON_PRICE', 'Not included on price')
  const taxText = (
    <>
      <bdi className='odc-figure'>{taxProduct?.rate ?? taxProduct ?? 0}%</bdi> ({taxTypeText})
    </>
  )
  const feeText = (
    <bdi className='odc-figure'>{parsePrice(data.fee?.fixed ?? 0)} + {data.fee?.percentage ?? business?.service_fee}%</bdi>
  )
  const priceText = <bdi className='odc-figure'>{parsePrice(data.price || 0)}</bdi>
  const costText = data.cost_price ? <bdi className='odc-figure'>{parsePrice(data.cost_price)}</bdi> : null
  const image = data.images ? optimizeImage(data.images, 'h_50,c_limit') : null

  const label = (template) => template.replace('_name_', name)
  const enableLabel = label(t('CATALOG_ENABLE_PRODUCT', 'Enable _name_'))

  const thumb = (
    <>
      <button
        type='button'
        className='odc-cp-thumb'
        data-odc-no-open=''
        aria-label={label(t('CATALOG_CHANGE_IMAGE_OF', 'Change image of _name_'))}
        aria-disabled={imageBusy || undefined}
        onClick={openChooser}
        onDragOver={event => { event.preventDefault(); event.stopPropagation() }}
        onDrop={event => {
          event.preventDefault()
          event.stopPropagation()
          if (!imageBusy) handleFiles(event.dataTransfer?.files)
        }}
      >
        {image ? <img src={image} alt='' loading='lazy' /> : <ImageIcon className='odc-icon' />}
      </button>
      <input
        ref={fileInputRef}
        type='file'
        hidden
        tabIndex={-1}
        aria-hidden='true'
        accept={IMAGE_ACCEPT}
        disabled={imageBusy}
        onChange={event => {
          handleFiles(event.target.files)
          event.target.value = ''
        }}
      />
    </>
  )

  const nameButton = (
    <button
      type='button'
      className='odc-cp-name'
      dir='auto'
      title={name}
      aria-current={isActive ? 'true' : undefined}
      onClick={open}
    >
      {name}
    </button>
  )

  const enabledSwitch = (withText) => (
    <span className='odc-cp-control' data-odc-no-open=''>
      <Switch
        checked={pending !== null ? pending : Boolean(product?.enabled)}
        busy={pending !== null}
        aria-label={enableLabel}
        label={enableLabel}
        onCheckedChange={handleToggle}
      >
        {withText ? t('ENABLED', 'Enabled') : undefined}
      </Switch>
    </span>
  )

  // The menu is drawn in a portal, but React events still bubble to the row: a click on its items must not open the product.
  const moveMenu = canMove && (
    <span className='odc-cp-control' data-odc-no-open='' onClick={event => event.stopPropagation()}>
      <Menu
        icon={Ellipsis}
        label={label(t('CATALOG_ROW_ACTIONS', 'More actions for _name_'))}
        triggerProps={{ size: 'sm', ...reorderTriggerProps('product', product.id) }}
        items={reorderMenuItems({
          state: getReorderState(category?.products, product.id),
          labels: { up: t('MOVE_UP', 'Move up'), down: t('MOVE_DOWN', 'Move down') },
          // J2 review H2: at the edge of a page the neighbour is not loaded; say how to reach it
          notes: {
            up: reorderEdge?.up ? t('REORDER_PAGE_EDGE_UP', 'It is the first on this page. Show more per page to move it up.') : undefined,
            down: reorderEdge?.down ? t('REORDER_PAGE_EDGE_DOWN', 'It is the last on this page. Show more per page to move it down.') : undefined
          },
          onMove: handleMove
        })}
      />
    </span>
  )

  const notice = failure && (
    <InlineNotice tone='danger' icon={TriangleAlert} role='alert' className='odc-cp-notice'>
      {failureText(failure)}
    </InlineNotice>
  )

  // ---- phone: the card (everything the row shows, no drag: it does not work by touch) ----
  if (isCard) {
    return (
      <li
        ref={containerRef}
        className='odc-cp-card'
        data-index={product.id}
        data-active={isActive ? '' : undefined}
        onClick={handleRowClick}
      >
        <div className='odc-cp-card-head'>
          {thumb}
          {nameButton}
        </div>
        {data.description && <p className='odc-cp-card-text' title={data.description} dir='auto'>{data.description}</p>}
        <dl className='odc-cp-facts'>
          <div className='odc-cp-fact'><dt>{t('PRICE', 'Price')}</dt><dd>{priceText}</dd></div>
          {costText && <div className='odc-cp-fact'><dt>{t('PRODUCT_COST', 'Product cost')}</dt><dd>{costText}</dd></div>}
          <div className='odc-cp-fact'><dt>{t('TAX', 'Tax')}</dt><dd>{taxText}</dd></div>
          <div className='odc-cp-fact'><dt>{t('FEE', 'Fee')}</dt><dd>{feeText}</dd></div>
        </dl>
        <div className='odc-cp-card-foot' data-odc-no-open=''>
          {enabledSwitch(true)}
          {moveMenu}
          {notice}
        </div>
      </li>
    )
  }

  // ---- the row ----
  const CELLS = {
    products: (sticky) => (
      <th scope='row' key='products' data-sticky={sticky}>
        <span className='odc-cp-product'>
          {canDrag && (
            <span
              className='odc-cp-grip'
              data-odc-no-open=''
              aria-hidden='true'
              draggable
              onDragStart={event => handleDragStart?.(event, product)}
            >
              <GripVertical className='odc-icon' />
            </span>
          )}
          {thumb}
          {nameButton}
        </span>
      </th>
    ),
    description: () => (
      <td key='description'>
        {data.description ? <span className='odc-cp-text' title={data.description} dir='auto'>{data.description}</span> : null}
      </td>
    ),
    price: () => <td key='price' data-align='end'>{priceText}</td>,
    cost_price: () => <td key='cost_price' data-align='end'>{costText}</td>,
    tax: () => <td key='tax' title={`${taxProduct?.rate ?? taxProduct ?? 0}% (${taxTypeText})`}>{taxText}</td>,
    fee: () => <td key='fee' title={`${parsePrice(data.fee?.fixed ?? 0)} + ${data.fee?.percentage ?? business?.service_fee}%`}>{feeText}</td>
  }

  return (
    <tbody
      ref={containerRef}
      className={cx('odc-cp-row', canDrag && 'draggable-product')}
      data-index={product.id}
      data-clickable=''
      data-active={isActive ? '' : undefined}
      data-accept={dataSelected && dataSelected === product?.id?.toString() ? '' : undefined}
      data-border-bottom={isProductsBottom && isLastProduct ? '' : undefined}
      onClick={handleRowClick}
      onDragOver={canDrag ? event => handleDragOver?.(event, isLastProduct) : undefined}
      onDrop={canDrag
        ? async event => {
          setFailure(null)
          const result = await handleDrop(event)
          if (mounted.current && result && result.ok === false) setFailure({ error: result.error })
        }
        : undefined}
      onDragEnd={canDrag ? event => handleDragEnd(event) : undefined}
    >
      <tr>
        {/* tanda AE (owner decision 37): Enabled and the row menu follow Products (pinned with it when it is first), so the
            pinned cells never cover a column at the start of the scroll, and reading and Tab go product, switch, menu, then the rest */}
        {columnOrder.map((id, index) => (
          <React.Fragment key={id}>
            {CELLS[id](id === 'products' && index === 0 ? 'start' : undefined)}
            {id === 'products' && <td data-sticky={index === 0 ? 'status' : undefined}>{enabledSwitch(false)}{moveMenu}</td>}
          </React.Fragment>
        ))}
      </tr>
      {failure && (
        <tr className='odc-cp-notice-row' data-odc-no-open=''>
          <td colSpan={columnOrder.length + 1}>{notice}</td>
        </tr>
      )}
    </tbody>
  )
}

const SingleBusinessProductUI = (props) => {
  const { isSkeleton, viewMethod, variant, columnOrder, allowColumns } = props
  if (viewMethod === 'spreedsheet') return <SheetRow {...props} />
  if (isSkeleton) {
    return variant === 'card'
      ? <CardSkeleton />
      : <RowSkeleton columnOrder={columnOrder || COLUMN_IDS.filter(id => allowColumns?.[id] !== false)} />
  }
  return <ProductItem {...props} />
}

export const SingleBusinessProduct = (props) => {
  const { isSkeleton } = props
  const singleBusinessProductProps = {
    ...props,
    UIComponent: SingleBusinessProductUI
  }
  return (
    <>
      {isSkeleton
        ? (
        <SingleBusinessProductUI {...props} />
          )
        : (
        <SingleBusinessProductController {...singleBusinessProductProps} />
          )}
    </>
  )
}
