import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { Select } from '../../../styles/Select'
import { ChevronLeft, ChevronRight } from '../Icon'
import {
  Option,
  PageButton,
  PageGap,
  PageSizeContainer,
  PageSizeTitle,
  PaginationButtonContainer,
  PaginationContainer
} from './pagination-styles'
import './pagination.css'

const filterPages = (visiblePages, totalPages) => visiblePages.filter(page => page <= totalPages)

const getVisiblePages = (page, total) => {
  if (total < 7) return filterPages([1, 2, 3, 4, 5, 6], total)
  if (page % 5 >= 0 && page > 4 && page + 2 < total) return [1, page - 1, page, page + 1, total]
  if (page % 5 >= 0 && page > 4 && page + 2 >= total) return [1, total - 3, total - 2, total - 1, total]
  return [1, 2, 3, 4, 5, total]
}

export const Pagination = React.memo((props) => {
  const {
    currentPage,
    totalPages,
    handleChangePage,
    defaultPageSize,
    handleChangePageSize,
    isHidePagecontrol,
    paginationSize
  } = props
  const [, t] = useLanguage()
  const pageSizeOptions = useMemo(() => [
    { value: 10, content: <Option>10</Option> },
    { value: 25, content: <Option>25</Option> },
    { value: 50, content: <Option>50</Option> }
  ], [])
  const [visiblePages, setVisiblePages] = useState([])
  const [activePage, setActivePage] = useState(currentPage)

  const changePage = useCallback((page) => {
    if (page === activePage) return
    setActivePage(page)
    setVisiblePages(filterPages(getVisiblePages(page, totalPages), totalPages))
    handleChangePage(page)
  }, [activePage, totalPages, handleChangePage])

  useEffect(() => {
    if (!totalPages) return
    setVisiblePages(getVisiblePages(null, totalPages))
  }, [totalPages])

  useEffect(() => {
    setActivePage(currentPage)
    setVisiblePages(filterPages(getVisiblePages(currentPage, totalPages), totalPages))
  }, [currentPage, totalPages])

  return (
    <PaginationContainer>
      <PaginationButtonContainer>
        <PageButton
          disabled={activePage === 1}
          aria-label={t('PREVIOUS_PAGE', 'Previous page')}
          onClick={() => (activePage !== 1) && changePage(activePage - 1)}
        >
          <ChevronLeft />
        </PageButton>

        {visiblePages.map((page, index, array) => (
          <React.Fragment key={page}>
            {array[index - 1] + 2 <= page && <PageGap aria-hidden='true'>...</PageGap>}
            <PageButton
              active={activePage === page}
              aria-label={`${t('PAGE', 'Page')} ${page}`}
              aria-current={activePage === page ? 'page' : undefined}
              onClick={() => changePage(page)}
            >
              {page}
            </PageButton>
          </React.Fragment>
        ))}

        <PageButton
          disabled={activePage === totalPages}
          aria-label={t('NEXT_PAGE', 'Next page')}
          onClick={() => (activePage !== totalPages) && changePage(activePage + 1)}
        >
          <ChevronRight />
        </PageButton>
      </PaginationButtonContainer>
      {!isHidePagecontrol && (
        <PageSizeContainer>
          <PageSizeTitle>{t('ITEMS_PER_PAGE', 'Items per page')}</PageSizeTitle>
          <Select
            isSecondIcon
            notAsync
            minWidth='70px'
            defaultValue={defaultPageSize || paginationSize}
            options={pageSizeOptions}
            onChange={size => handleChangePageSize(size)}
          />
        </PageSizeContainer>
      )}
    </PaginationContainer>
  )
})

Pagination.displayName = 'Pagination'
