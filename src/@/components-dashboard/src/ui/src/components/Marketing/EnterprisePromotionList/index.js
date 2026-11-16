import React, { useEffect } from 'react'
import { useLanguage } from '../../../../../index'
import { addQueryToUrl } from '../../../utils'
import { Button } from '../../Shared/Product'
import { PromotionsTable } from '../PromotionsDirectory/PromotionsTable'

// redesign PE-B2 (decisions 3, 4, 8, 9; PE-15): the Advanced list is now a thin adapter. The table, its states and its pager are
// `PromotionsTable variant='advanced'` (PE-B1); this maps what the controller (K/EnterprisePromotionList) and the page hand over to it,
// keeps the three things the old list did around the table (the pager's page math, the `?page`/`?pageSize` address, and the way back from
// a page left empty) and the «Add new promotion» link below it.
//
// @param {object}   props.promotionListState  `{ promotions, loading, error }` of the controller.
// @param {object}   props.paginationProps     `{ currentPage, pageSize, totalItems, totalPages, from }` of the controller.
// @param {Function} props.getPromotions       `(page, pageSize) => void`.
// @param {Function} props.handleOpenDetails   `(promotion | null) => void`: the page opens its panel (null = a new promotion).
// @param {*}        [props.activeId]          The id of the promotion that is open in the panel.
// @param {Function} [props.handleEnablePromotion]  `(id, enabled) => Promise<{ ok, error }>`.
// @param {Function} [props.onDelete]          `(promotion) => void`: the page asks before deleting.
// @param {Function} [props.onSearch]          `(text) => void`: «Clear search» of the empty result.
// @param {string}   [props.searchValue]
// @param {boolean}  [props.loadedOnce]        `false` until the first load has ended: the table shows its skeleton, not «No promotions yet».
// @param {boolean}  [props.isUseQuery]        The page writes `?page` and `?pageSize` after each load.
// The drag props are the controller's own (`handleDragStart`, `handleAllowDrop`, `handleDrop`, `handleDragEnd`, `dataSelected`,
// `isPromotionBottom`): the unchanged handlers look the row up by the `draggable_promotion` class the table keeps.

// What S/Pagination offered
const PAGE_SIZE_OPTIONS = [10, 25, 50]

export const EnterprisePromotionList = (props) => {
  const {
    toolbar,
    promotionListState,
    paginationProps,
    getPromotions,
    handleOpenDetails,
    activeId,
    handleEnablePromotion,
    onDelete,
    onSearch,
    searchValue,
    loadedOnce,
    isUseQuery,
    dataSelected,
    handleDragStart,
    handleAllowDrop,
    handleDrop,
    handleDragEnd,
    isPromotionBottom
  } = props

  const [, t] = useLanguage()

  const currentPage = paginationProps?.currentPage
  const pageSize = paginationProps?.pageSize
  const promotions = promotionListState?.promotions ?? []
  const loading = Boolean(promotionListState?.loading) || loadedOnce === false

  const handleChangePage = (page) => {
    getPromotions?.(page, pageSize)
  }

  // the page that keeps the first row on screen when the size changes (the old math)
  const handleChangePageSize = (size) => {
    const expectedPage = Math.ceil(paginationProps?.from / size) || 1
    getPromotions?.(Math.max(expectedPage, 1), size)
  }

  // A page left empty (its promotions were deleted) asks again: the same page, or the one before when it was the last. An error is not an
  // empty page: «Retry» is the person's.
  useEffect(() => {
    if (promotionListState?.loading || promotionListState?.error || promotions.length > 0 || !(paginationProps?.totalPages > 1)) return
    if (paginationProps.currentPage !== paginationProps.totalPages) {
      handleChangePage(paginationProps.currentPage)
    } else {
      handleChangePage(paginationProps.currentPage - 1)
    }
  }, [promotionListState?.promotions, paginationProps])

  useEffect(() => {
    if (!isUseQuery || !currentPage || !pageSize || !paginationProps?.totalPages) return
    addQueryToUrl({ page: currentPage, pageSize })
  }, [currentPage, pageSize, paginationProps?.totalPages])

  const addPromotion = () => handleOpenDetails?.(null)

  return (
    <>
      <PromotionsTable
        variant='advanced'
        promotions={promotions}
        loading={loading}
        error={promotionListState?.error}
        onRetry={() => getPromotions?.(currentPage ?? 1, pageSize ?? PAGE_SIZE_OPTIONS[0])}
        activeId={activeId}
        onOpen={promotion => handleOpenDetails?.(promotion)}
        onToggle={(promotion, enabled) => handleEnablePromotion?.(promotion.id, enabled)}
        onDelete={onDelete}
        drag={{
          onDragStart: handleDragStart,
          onDragOver: handleAllowDrop,
          onDrop: handleDrop,
          onDragEnd: handleDragEnd,
          targetId: dataSelected,
          targetBottom: isPromotionBottom
        }}
        pagination={{
          page: currentPage,
          pageSize,
          total: paginationProps?.totalItems,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          onPageChange: handleChangePage,
          onPageSizeChange: handleChangePageSize
        }}
        searchValue={searchValue}
        onClearSearch={() => onSearch?.('')}
        emptyAction={<Button variant='primary' onClick={addPromotion}>{t('ADD_PROMOTION', 'Add promotion')}</Button>}
        toolbar={toolbar}
      />
      <div className='odc-promo-add'>
        <Button variant='link' onClick={addPromotion}>{t('ADD_NEW_PROMOTION', 'Add new promotion')}</Button>
      </div>
    </>
  )
}
