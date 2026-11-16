import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useLanguage, PagesList as PagesListController } from '../../../../../index'
import { Modal } from '../../Shared'
import { Ellipsis, Menu as MenuIcon } from '../../Shared/Icon'
import {
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  IconButton,
  Menu,
  Pagination,
  SearchField,
  Switch
} from '../../Shared/Product'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { PageForm } from '../PageForm'
import { addQueryToUrl } from '../../../utils'
import './cms.css'

const PAGE_SIZES = [10, 25, 50]

// «Showing _from_–_to_ of _total_» with the numbers as figures (decision 11)
const fillTemplate = (template, values, figure) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figure(values[name])}</React.Fragment> : part
})

const CmsUI = (props) => {
  const {
    pagesListState,
    handleChangeState,
    handleUpdatePageList,
    handleDeletePage,
    avoidExpand
  } = props

  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [searchValue, setSearchValue] = useState(null)

  const [openModal, setOpenModal] = useState(false)
  const [curPageId, setCurPageId] = useState(null)
  const [confirm, setConfirm] = useState({ open: false, pageId: null })

  const query = new URLSearchParams(useLocation().search)
  const defaultPage = query.get('page') || 1
  const defaultPageSize = query.get('pageSize') || 10
  // Change page
  const [currentPage, setCurrentPage] = useState(Number(defaultPage) || 1)
  const [pagesPerPage, setPagesPerPage] = useState(Number(defaultPageSize) || 10)

  // Get current products
  const [currentPages, setCurrentPages] = useState([])
  const [totalPages, setTotalPages] = useState(null)
  const [totalItems, setTotalItems] = useState(0)

  const handleChangePage = (page) => {
    setCurrentPage(page)
  }

  const handleChangePageSize = (pageSize) => {
    const expectedPage = Math.ceil(((currentPage - 1) * pagesPerPage + 1) / pageSize)
    setCurrentPage(expectedPage)
    setPagesPerPage(pageSize)
  }

  useEffect(() => {
    if (pagesListState.loading) return
    let pages = []
    if (searchValue) {
      pages = pagesListState.pages.filter(page => page.name?.toLowerCase().includes(searchValue?.toLowerCase()))
    } else {
      pages = [...pagesListState.pages]
    }
    const _totalPages = Math.ceil(pages.length / pagesPerPage)
    const indexOfLastPost = currentPage * pagesPerPage
    const indexOfFirstPost = indexOfLastPost - pagesPerPage
    const _currentProducts = pages.slice(indexOfFirstPost, indexOfLastPost)
    setTotalPages(_totalPages)
    setTotalItems(pages.length)
    setCurrentPages(_currentProducts)
  }, [pagesListState, currentPage, pagesPerPage, searchValue])

  // Delete asks first.
  const onClickDeletePage = (pageId) => {
    setConfirm({ open: true, pageId })
  }

  const handleAcceptDelete = () => {
    const { pageId } = confirm
    setConfirm({ open: false, pageId: null })
    handleDeletePage(pageId)
  }

  const handleEditPage = (pageId) => {
    setCurPageId(pageId)
    setOpenModal(true)
  }

  useEffect(() => {
    if (!currentPage || !pagesPerPage || !totalPages) return
    addQueryToUrl({
      page: currentPage,
      pageSize: pagesPerPage
    })
  }, [currentPage, pagesPerPage, totalPages])

  const columns = [
    {
      id: 'name',
      header: t('STATIC_PAGE', 'Static page'),
      rowHeader: true,
      wrap: true,
      cell: page => <span dir='auto'>{page?.name}</span>
    },
    {
      id: 'enabled',
      header: t('ENABLE', 'Enable'),
      className: 'odc-cms-shrink',
      cell: page => (
        <Switch
          defaultChecked={page?.enabled}
          label={`${t('ENABLE', 'Enable')}: ${page?.name ?? ''}`}
          onCheckedChange={(enabled) => handleChangeState(page.id, 'enabled', enabled)}
        />
      )
    },
    {
      id: 'actions',
      header: null,
      srHeader: t('ACTIONS', 'Actions'),
      align: 'end',
      className: 'odc-cms-shrink',
      // The menu items live in a portal: their clicks still bubble (React) to the row and would open the editor.
      cell: page => (
        <span data-odc-no-open='' onClick={event => event.stopPropagation()}>
          <Menu
            icon={Ellipsis}
            label={t('PAGE_ROW_ACTIONS', 'Actions for _name_').replace('_name_', page?.name ?? '')}
            items={[
              { key: 'edit', label: t('EDIT', 'Edit'), onSelect: () => handleEditPage(page.id) },
              { key: 'delete', label: t('DELETE', 'Delete'), tone: 'danger', onSelect: () => onClickDeletePage(page.id) }
            ]}
          />
        </span>
      )
    }
  ]

  return (
    <>
      <div className='odc-root odc-cms'>
        {!avoidExpand && (
          <div className='odc-cms-title'>
            {isCollapse && (
              <IconButton icon={MenuIcon} label={t('MENU', 'Menu')} onClick={() => handleMenuCollapse(false)} />
            )}
            <h1>{t('PAGES_MANAGER', 'Static Pages Manager')}</h1>
          </div>
        )}
        <div className='odc-cms-toolbar'>
          <SearchField
            className='odc-cms-search'
            value={searchValue ?? ''}
            onChange={val => setSearchValue(val)}
            label={t('SEARCH', 'Search')}
            placeholder={t('SEARCH', 'Search')}
            clearLabel={t('CLEAR_SEARCH', 'Clear search')}
          />
          <Button variant='primary' onClick={() => handleEditPage(null)}>
            {t('ADD_PAGE', 'Add page')}
          </Button>
        </div>
        <DataTable
          label={t('STATIC_PAGE', 'Static page')}
          columns={columns}
          rows={currentPages}
          getRowId={page => page.id}
          onOpenRow={page => handleEditPage(page.id)}
          loading={pagesListState.loading}
          loadingLabel={t('LOADING', 'Loading')}
          skeletonRows={pagesPerPage}
          empty={searchValue ? <EmptyState role='status' title={t('NO_RESULTS_FOUND', 'No results found')} /> : null}
        />
        {!pagesListState.loading && (
          <div className='odc-cms-foot'>
            <Button variant='link' onClick={() => handleEditPage(null)}>
              {t('ADD_NEW_STATIC_PAGE', 'Add new static page')}
            </Button>
            <Pagination
              page={currentPage}
              pageSize={pagesPerPage}
              total={totalItems}
              pageSizeOptions={PAGE_SIZES}
              onPageChange={handleChangePage}
              onPageSizeChange={(size) => handleChangePageSize(size)}
              showPageInput
              label={t('PAGINATION', 'Pagination')}
              previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
              nextLabel={t('NEXT_PAGE', 'Next page')}
              pageSizeLabel={t('ITEMS_PER_PAGE', 'Items per page')}
              pageLabel={t('PAGE', 'Page')}
              pageOfLabel={(total, figure) => fillTemplate(t('PAGE_OF_TOTAL', 'of _total_'), { total }, figure)}
              rangeLabel={(from, to, total, figure) => fillTemplate(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from, to, total }, figure)}
              pageStatusLabel={(current, total) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(total))}
            />
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirm.open}
        title={t('QUESTION_DELETE_PAGE', 'Are you sure that you want to delete this page?')}
        confirmLabel={t('DELETE_PAGE', 'Delete page')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={handleAcceptDelete}
        onCancel={() => setConfirm({ open: false, pageId: null })}
      />
      {openModal && (
        <Modal
          width='70%'
          open={openModal}
          onClose={() => setOpenModal(false)}
          closeOnBackdrop={false}
        >
          <PageForm
            pageId={curPageId}
            pageList={pagesListState.pages}
            handleSuccessUpdate={handleUpdatePageList}
            handleCancel={() => setOpenModal(false)}
          />
        </Modal>
      )}
    </>
  )
}

export const Cms = (props) => {
  const pageListProps = {
    ...props,
    UIComponent: CmsUI
  }
  return <PagesListController {...pageListProps} />
}
