import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

import { Markups as MarkupsController, useLanguage } from '../../../../../index'
import { CheckSquareFill, List as MenuIcon, Square } from 'react-bootstrap-icons'
import { Button, IconButton, Switch } from '../../../styles'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { Alert, ColumnAllowSettingPopover, Confirm, Pagination, SearchBar } from '../../Shared'
import { SideBar } from '../../Shared/SideBar'
import { MarkupForm } from '../MarkupForm'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'

import {
  MarkupsContainer,
  HeaderContainer,
  HeaderTitleContainer,
  ActionsWrapper,
  Table,
  Thead,
  Tbody,
  PagesBottomContainer,
  StatusWrapper,
  CheckBoxWrapper,
  MarkupIdWrapper,
  EmptyWrapper
} from './styles'
import { useOpenFromQuery } from '../../../hooks/useOneShotQuery'

const MarkupsUI = (props) => {
  const {
    markupsList,
    getMarkups,
    createMarkup,
    updateMarkup,
    deleteMarkups,
    actionState,
    businessesState,
    businessesPaginationProps,
    handleChangeBusinessPage,
    searchBusinesses,
    sitesState,
    paginationProps,
    setPaginationProps,
    searchValue,
    handleChangeSearch,
    isUseQuery
  } = props

  const query = new URLSearchParams(useLocation().search)
  const [, t] = useLanguage()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const autoOpenedIdRef = useRef(null)
  const pendingQueryIdRef = useRef(null)

  const deliveryTypeOptions = useMemo(() => ([
    { value: 'all', content: t('ALL_DELIVERY_TYPES', 'All delivery types') },
    { value: 'delivery', content: t('DELIVERY', 'Delivery') },
    { value: 'pickup', content: t('PICKUP', 'Pickup') },
    { value: 'eatin', content: t('EAT_IN', 'Eat in') },
    { value: 'curbside', content: t('CURBSIDE', 'Curbside') },
    { value: 'drive_thru', content: t('DRIVE_THRU', 'Drive thru') },
    { value: 'seat_delivery', content: t('SEAT_DELIVERY', 'Seat delivery') },
    { value: 'catering_delivery', content: t('CATERING_DELIVERY', 'Catering delivery') },
    { value: 'catering_pickup', content: t('CATERING_PICKUP', 'Catering pickup') },
    { value: 'reservation', content: t('RESERVATION', 'Reservation') }
  ]), [t])

  const markupTypeOptions = useMemo(() => ([
    { value: 'percentage', content: t('PERCENTAGE', '%') },
    { value: 'fixed', content: t('FIXED', 'Fixed') }
  ]), [t])

  const roundingOptions = useMemo(() => ([
    { value: 0.00, content: <div style={{ paddingLeft: 10 }}>0.00</div> },
    { value: 0.25, content: <div style={{ paddingLeft: 10 }}>0.25</div> },
    { value: 0.50, content: <div style={{ paddingLeft: 10 }}>0.50</div> },
    { value: 0.75, content: <div style={{ paddingLeft: 10 }}>0.75</div> },
    { value: 0.99, content: <div style={{ paddingLeft: 10 }}>0.99</div> }
  ]), [])

  const [isOpenForm, setIsOpenForm] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const businessOptions = useMemo(() => {
    const base = [{ value: 'all', content: t('ALL_BUSINESSES', 'All businesses') }]
    const list = Array.isArray(businessesState?.businesses) ? businessesState.businesses : []
    const fromList = list.map((b) => ({ value: b.id, content: b.name }))

    const editingMarkup = editingId && Array.isArray(markupsList?.markups)
      ? markupsList.markups.find((m) => Number(m?.id) === Number(editingId))
      : null
    if (editingMarkup?.business_id != null && editingMarkup?.business) {
      const alreadyInList = fromList.some((opt) => Number(opt.value) === Number(editingMarkup.business_id))
      if (!alreadyInList) {
        fromList.unshift({
          value: editingMarkup.business.id,
          content: editingMarkup.business.name || String(editingMarkup.business_id)
        })
      }
    }

    return base.concat(fromList)
  }, [businessesState?.businesses, editingId, markupsList?.markups, t])

  const sitesOptions = useMemo(() => {
    const base = [{ value: 'all', content: t('ALL_SITES', 'All sites') }]
    const list = Array.isArray(sitesState?.sites) ? sitesState.sites : []
    return base.concat(list.map((s) => ({ value: s.id, content: s.name || String(s.id) })))
  }, [sitesState?.sites, t])

  const [businessSearchValue, setBusinessSearchValue] = useState('')
  const [sitesSearchValue, setSitesSearchValue] = useState('')
  const [alertState, setAlertState] = useState({ open: false, content: [] })

  const handleOpenAlert = (content) => {
    const normalized = Array.isArray(content)
      ? content
      : content
        ? [String(content)]
        : []
    setAlertState({ open: true, content: normalized })
  }

  const handleBusinessSearchChange = (val) => {
    setBusinessSearchValue(val ?? '')
    searchBusinesses?.(val ?? '')
  }

  const filteredSitesOptions = useMemo(() => {
    const search = String(sitesSearchValue || '').trim().toLowerCase()
    if (!search) return sitesOptions
    return (sitesOptions || []).filter((opt) => {
      const text = typeof opt?.content === 'string' ? opt.content : ''
      return text.toLowerCase().includes(search)
    })
  }, [sitesOptions, sitesSearchValue])

  const [formState, setFormState] = useState({
    name: '',
    enabled: true,
    business_id: 'all',
    site_id: 'all',
    delivery_type: 'all',
    rounding_values: [],
    products_markup_type: 'percentage',
    products_markup_value: '',
    apply_to_suboptions: true,
    apply_same_value: true,
    suboptions_markup_type: 'percentage',
    suboptions_markup_value: ''
  })

  const [allowColumns, setAllowColumns] = useState({
    name: true,
    business: true,
    status: true
  })

  const optionsDefault = [
    { value: 'name', content: t('NAME', 'Name') },
    { value: 'business', content: t('BUSINESS', 'Business') },
    { value: 'status', content: t('STATUS', 'Status') }
  ]

  const handleChangeAllowColumns = (column) => {
    setAllowColumns((prev) => ({
      ...prev,
      [column]: !prev[column]
    }))
  }

  const [selectedMarkupIds, setSelectedMarkupIds] = useState([])
  const [confirmState, setConfirmState] = useState({ open: false, content: '', handleOnAccept: null })

  const isAllChecked = useMemo(() => {
    const items = Array.isArray(markupsList?.markups) ? markupsList.markups : []
    if (items.length === 0) return false
    return items.every((m) => selectedMarkupIds.includes(m.id))
  }, [markupsList?.markups, selectedMarkupIds])

  const handleToggleMarkupId = (e, id) => {
    e?.stopPropagation?.()
    if (!id) return
    setSelectedMarkupIds((prev) => {
      const exists = prev.includes(id)
      if (exists) return prev.filter((x) => x !== id)
      return prev.concat(id)
    })
  }

  const handleSelectAllMarkups = (e) => {
    e?.stopPropagation?.()
    const items = Array.isArray(markupsList?.markups) ? markupsList.markups : []
    if (items.length === 0) return
    setSelectedMarkupIds((prev) => {
      const nextIds = items.map((m) => m.id)
      const allSelected = nextIds.every((id) => prev.includes(id))
      return allSelected ? [] : nextIds
    })
  }

  const handleClickDeleteSelected = () => {
    if (selectedMarkupIds.length === 0) return
    setConfirmState({
      open: true,
      content: t('QUESTION_DELETE_MARKUPS', 'Are you sure to delete these markups?'),
      handleOnAccept: async () => {
        setConfirmState((prev) => ({ ...prev, open: false }))
        const res = await deleteMarkups?.(selectedMarkupIds)
        if (res?.error) return
        setSelectedMarkupIds([])
      }
    })
  }

  const isValidMarkupIdQuery = (value) => {
    const normalized = String(value ?? '').trim()
    return !!normalized && /^\d+$/.test(normalized)
  }

  const handleSearch = (search) => {
    const normalized = String(search ?? '').trim()
    const pageSize = paginationProps?.pageSize ?? 10

    setPaginationProps((prev) => ({ ...prev, currentPage: 1 }))

    if (isValidMarkupIdQuery(normalized)) {
      addQueryToUrl({ id: normalized, page: 1, pageSize })
    } else {
      removeQueryToUrl(['id'])
      addQueryToUrl({ page: 1, pageSize })
    }

    handleChangeSearch?.(normalized)
  }

  const handleChangePage = (page) => {
    const nextPage = Number(page) >= 1 ? Number(page) : 1
    setPaginationProps((prev) => ({ ...prev, currentPage: nextPage }))
    getMarkups(nextPage, paginationProps.pageSize)
  }

  const handleChangePageSize = (pageSize) => {
    const nextPageSize = Number(pageSize) >= 1 ? Number(pageSize) : 10
    setPaginationProps((prev) => ({ ...prev, pageSize: nextPageSize, currentPage: 1 }))
    getMarkups(1, nextPageSize)
  }

  const handleRowKeyDown = (e, id) => {
    if (!id) return
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    handleOpenEdit(id)
  }

  const handleResetForm = () => {
    setIsEdit(false)
    setEditingId(null)
    setFormState({
      name: '',
      enabled: true,
      business_id: 'all',
      site_id: 'all',
      delivery_type: 'all',
      rounding_values: [],
      products_markup_type: 'percentage',
      products_markup_value: '',
      apply_to_suboptions: true,
      apply_same_value: true,
      suboptions_markup_type: 'percentage',
      suboptions_markup_value: ''
    })
  }

  const handleOpenCreate = () => {
    handleResetForm()
    removeQueryToUrl(['id'])
    setIsOpenForm(true)
  }

  // `?add=1` (command palette) opens the add form like the button
  useOpenFromQuery('add', () => handleOpenCreate())

  const handleOpenEdit = async (id) => {
    handleResetForm()
    setIsEdit(true)
    setEditingId(id)
    setIsOpenForm(true)

    const markup = (markupsList?.markups || []).find((m) => Number(m?.id) === Number(id)) || null
    if (!markup) {
      const msg = t('NOT_FOUND', 'Not found')
      handleOpenAlert(msg)
      return
    }
    addQueryToUrl({ id: markup?.id })
    const rounding = Array.isArray(markup?.rounding_values) ? markup.rounding_values : []
    const products = markup?.rules?.products || {}
    const suboptions = markup?.rules?.suboptions || {}
    const applyToSuboptions = Number(suboptions?.markup_value ?? 0) !== 0

    setFormState((prev) => ({
      ...prev,
      name: markup?.name ?? '',
      enabled: !!markup?.enabled,
      business_id: markup?.business_id ?? 'all',
      site_id: markup?.site_id ?? 'all',
      delivery_type: markup?.delivery_type ?? 'all',
      rounding_values: rounding,
      products_markup_type: products?.markup_type ?? 'percentage',
      products_markup_value: (products?.markup_value ?? '') === 0 ? '0' : String(products?.markup_value ?? ''),
      apply_to_suboptions: applyToSuboptions,
      apply_same_value: applyToSuboptions
        ? (products?.markup_type === suboptions?.markup_type) && (Number(products?.markup_value) === Number(suboptions?.markup_value))
        : true,
      suboptions_markup_type: suboptions?.markup_type ?? (products?.markup_type ?? 'percentage'),
      suboptions_markup_value: (suboptions?.markup_value ?? '') === 0 ? '0' : String(suboptions?.markup_value ?? '')
    }))
  }

  const handleToggleRounding = (val) => {
    setFormState((prev) => {
      const next = Array.isArray(prev.rounding_values) ? [...prev.rounding_values] : []
      const index = next.findIndex(v => Number(v) === Number(val))
      if (index >= 0) next.splice(index, 1)
      else next.push(val)
      return { ...prev, rounding_values: next }
    })
  }

  const buildPayload = () => {
    const name = String(formState.name || '').trim()
    if (!name) return { error: true, result: t('NAME_IS_REQUIRED', 'Name is required') }
    if (name.length > 100) return { error: true, result: t('NAME_MAX_100', 'Name max 100 chars') }

    const businessId = formState.business_id === 'all' || formState.business_id === '' ? null : formState.business_id
    const siteId = formState.site_id === 'all' || formState.site_id === '' ? null : formState.site_id
    const deliveryType = formState.delivery_type === 'all' || formState.delivery_type === '' ? null : formState.delivery_type

    const productsMarkupValue = Number(formState.products_markup_value)
    if (Number.isNaN(productsMarkupValue)) return { error: true, result: t('INVALID_PRODUCTS_VALUE', 'Invalid products markup value') }
    if (formState.products_markup_type === 'percentage') {
      const raw = String(formState.products_markup_value ?? '').trim()
      if (raw && !/^\d{1,3}$/.test(raw)) return { error: true, result: t('INVALID_PRODUCTS_VALUE', 'Invalid products markup value') }
      if (productsMarkupValue > 999) return { error: true, result: t('INVALID_PRODUCTS_VALUE', 'Invalid products markup value') }
    }

    const products = {
      markup_type: formState.products_markup_type,
      markup_value: productsMarkupValue
    }

    let suboptions = {
      markup_type: 'fixed',
      markup_value: 0
    }

    if (formState.apply_to_suboptions) {
      if (formState.apply_same_value) {
        suboptions = { ...products }
      } else {
        const suboptionsMarkupValue = Number(formState.suboptions_markup_value)
        if (Number.isNaN(suboptionsMarkupValue)) return { error: true, result: t('INVALID_SUBOPTIONS_VALUE', 'Invalid suboptions markup value') }
        if (formState.suboptions_markup_type === 'percentage') {
          const raw = String(formState.suboptions_markup_value ?? '').trim()
          if (raw && !/^\d{1,3}$/.test(raw)) return { error: true, result: t('INVALID_SUBOPTIONS_VALUE', 'Invalid suboptions markup value') }
          if (suboptionsMarkupValue > 999) return { error: true, result: t('INVALID_SUBOPTIONS_VALUE', 'Invalid suboptions markup value') }
        }
        suboptions = {
          markup_type: formState.suboptions_markup_type,
          markup_value: suboptionsMarkupValue
        }
      }
    }

    const payload = {
      name,
      business_id: businessId,
      site_id: siteId,
      delivery_type: deliveryType,
      rules: { products, suboptions },
      enabled: !!formState.enabled
    }

    // NOTE: allow sending empty array to clear rounding values on edit
    if (Array.isArray(formState.rounding_values)) {
      payload.rounding_values = formState.rounding_values.map((v) => Number(v))
    }

    return { error: false, result: payload }
  }

  const handleSubmit = async () => {
    const built = buildPayload()
    if (built.error) {
      handleOpenAlert(built.result)
      return
    }

    const payload = built.result
    const res = isEdit
      ? await updateMarkup?.(editingId, payload)
      : await createMarkup?.(payload)

    if (res?.error) {
      const msg = Array.isArray(res?.result) ? res.result : (res?.result ? [String(res.result)] : [t('ERROR', 'Error')])
      handleOpenAlert(msg)
      return
    }
    setIsOpenForm(false)
  }

  const handleUpdateEnabled = (id, enabled) => {
    updateMarkup?.(id, { enabled })
  }

  useEffect(() => {
    if (!actionState?.error || actionState?.loading) return
    handleOpenAlert(actionState.error)
  }, [actionState?.error, actionState?.loading])

  useEffect(() => {
    const qs = window?.location?.search ?? ''
    const urlQuery = new URLSearchParams(qs)
    const idFromUrl = urlQuery.get('id')
    if (isValidMarkupIdQuery(idFromUrl)) {
      // Controller resets to page 1 when searching
      const normalizedId = String(idFromUrl).trim()
      const pageSize = paginationProps?.pageSize ?? 10
      addQueryToUrl({ id: normalizedId, page: 1, pageSize })
      handleChangeSearch?.(String(idFromUrl).trim())
      setPaginationProps((prev) => ({ ...prev, currentPage: 1 }))
    }
  }, [])

  useEffect(() => {
    if (!isUseQuery) return
    if (!paginationProps?.currentPage || !paginationProps?.pageSize || !paginationProps?.totalPages) return
    addQueryToUrl({
      page: paginationProps.currentPage,
      pageSize: paginationProps.pageSize
    })
  }, [paginationProps?.currentPage, paginationProps?.pageSize, paginationProps?.totalPages, isUseQuery])

  useEffect(() => {
    if (markupsList?.loading) return
    const id = query.get('id')
    if (id === null) {
      autoOpenedIdRef.current = null
      pendingQueryIdRef.current = null
      return
    }

    const numericId = parseInt(id, 10)
    if (!numericId || Number.isNaN(numericId)) return

    const list = Array.isArray(markupsList?.markups) ? markupsList.markups : []
    const markup = list.find((m) => Number(m?.id) === numericId)

    if (markup) {
      pendingQueryIdRef.current = null
      if (autoOpenedIdRef.current === numericId) return
      autoOpenedIdRef.current = numericId
      handleOpenEdit(numericId)
    } else {
      if (pendingQueryIdRef.current === numericId) return
      pendingQueryIdRef.current = numericId
      handleSearch(String(numericId))
    }
  }, [markupsList])

  return (
    <>
      <MarkupsContainer>
        <HeaderContainer>
          <HeaderTitleContainer>
            {isCollapse && (
              <IconButton
                color='black'
                onClick={() => handleMenuCollapse(false)}
              >
                <MenuIcon />
              </IconButton>
            )}
            <h1>{t('MARKUPS', 'Markups')}</h1>
          </HeaderTitleContainer>
          <ActionsWrapper>
            <Button
              color='lightPrimary'
              borderRadius='8px'
              onClick={handleOpenCreate}
            >
              {t('ADD_MARKUP', 'Add markup')}
            </Button>
            <Button
              color='primary'
              borderRadius='8px'
              disabled={selectedMarkupIds.length === 0 || !!actionState?.loading}
              onClick={handleClickDeleteSelected}
            >
              {t('DELETE', 'Delete')}
            </Button>
            <SearchBar
              lazyLoad
              onSearch={handleSearch}
              search={searchValue}
              placeholder={t('SEARCH', 'Search')}
            />
          </ActionsWrapper>
        </HeaderContainer>

        {markupsList?.error && (
          <EmptyWrapper>
            {Array.isArray(markupsList.error)
              ? markupsList.error.join(', ')
              : String(markupsList.error)}
          </EmptyWrapper>
        )}

        <Table>
          <Thead>
            <tr>
              <th style={{ width: 90 }}>
                <MarkupIdWrapper>
                  <CheckBoxWrapper
                    className='row-checkbox'
                    isChecked={!markupsList?.loading && isAllChecked}
                    onClick={(e) => handleSelectAllMarkups(e)}
                    role='button'
                    tabIndex={0}
                    aria-label={t('SELECT_ALL', 'Select all')}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSelectAllMarkups(e)}
                  >
                    {(!markupsList?.loading && isAllChecked)
                      ? <CheckSquareFill />
                      : <Square />}
                  </CheckBoxWrapper>
                  {t('ID', 'ID')}
                </MarkupIdWrapper>
              </th>
              {allowColumns?.name && (
                <th>{t('NAME', 'Name')}</th>
              )}
              {allowColumns?.business && (
                <th>{t('BUSINESS', 'Business')}</th>
              )}
              {allowColumns?.status && (
                <th style={{ width: 220 }}>{t('STATUS', 'Status')}</th>
              )}
              <th style={{ width: 60 }}>
                <ColumnAllowSettingPopover
                  allowColumns={allowColumns}
                  optionsDefault={optionsDefault}
                  handleChangeAllowColumns={handleChangeAllowColumns}
                />
              </th>
            </tr>
          </Thead>
          <Tbody>
            {markupsList?.loading && (
              [...Array(paginationProps?.pageSize || 10).keys()].map((i) => (
                <tr key={i}>
                  <td><Skeleton width={70} /></td>
                  {allowColumns?.name && (
                    <td><Skeleton width={240} /></td>
                  )}
                  {allowColumns?.business && (
                    <td><Skeleton width={180} /></td>
                  )}
                  {allowColumns?.status && (
                    <td><Skeleton width={160} /></td>
                  )}
                  <td />
                </tr>
              ))
            )}

            {!markupsList?.loading && (markupsList?.markups || []).map((markup) => (
              <tr
                key={markup?.id}
                role='button'
                tabIndex={0}
                aria-label={t('EDIT', 'Edit')}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  if (e.target.closest('.row-checkbox')) return
                  handleOpenEdit(markup?.id)
                }}
                onKeyDown={(e) => handleRowKeyDown(e, markup?.id)}
              >
                <td>
                  <MarkupIdWrapper className='row-checkbox'>
                    <CheckBoxWrapper
                      className='row-checkbox'
                      isChecked={selectedMarkupIds.includes(markup?.id)}
                      onClick={(e) => handleToggleMarkupId(e, markup?.id)}
                      role='button'
                      tabIndex={0}
                      aria-label={t('SELECT', 'Select')}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleToggleMarkupId(e, markup?.id)}
                    >
                      {selectedMarkupIds.includes(markup?.id) ? <CheckSquareFill /> : <Square />}
                    </CheckBoxWrapper>
                    {markup?.id}
                  </MarkupIdWrapper>
                </td>
                {allowColumns?.name && (
                  <td>{markup?.name || '-'}</td>
                )}
                {allowColumns?.business && (
                  <td>{markup?.business_id == null ? t('GLOBAL', 'Global') : (markup?.business?.name ?? '-')}</td>
                )}
                {allowColumns?.status && (
                  <td>
                    <StatusWrapper>
                      <p>
                        {t('ENABLE', 'Enable')}
                      </p>
                      <span
                        className='row-checkbox'
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        role='presentation'
                        style={{ display: 'flex', alignItems: 'center' }}
                      >
                        <Switch
                          className='enable_control'
                          defaultChecked={!!markup?.enabled}
                          disabled={!!actionState?.loading}
                          onChange={(val) => updateMarkup?.(markup?.id, { enabled: val })}
                        />
                      </span>
                    </StatusWrapper>
                  </td>
                )}
                <td />
              </tr>
            ))}
          </Tbody>
        </Table>

        {!markupsList?.loading && (markupsList?.markups?.length ?? 0) === 0 && !markupsList?.error && (
          <EmptyWrapper>
            {t('NO_DATA', 'No data')}
          </EmptyWrapper>
        )}

        {!markupsList?.loading && (paginationProps?.totalPages ?? 0) > 0 && (
          <PagesBottomContainer>
            {(markupsList?.markups?.length ?? 0) > 0 && (
              <Pagination
                currentPage={paginationProps?.currentPage}
                totalPages={paginationProps?.totalPages}
                handleChangePage={handleChangePage}
                defaultPageSize={paginationProps?.pageSize}
                handleChangePageSize={handleChangePageSize}
              />
            )}
          </PagesBottomContainer>
        )}
      </MarkupsContainer>
      {isOpenForm && (
        <SideBar
          open={isOpenForm}
          defaultSideBarWidth={600}
          moveDistance={0}
          onClose={() => {
            setIsOpenForm(false)
            removeQueryToUrl(['id'])
          }}
          showExpandIcon={false}
        >
          <MarkupForm
            t={t}
            isEdit={isEdit}
            actionLoading={actionState?.loading}
            markupId={editingId}
            formState={formState}
            setFormState={setFormState}
            handleToggleRounding={handleToggleRounding}
            handleSubmit={handleSubmit}
            onUpdateEnabled={handleUpdateEnabled}
            filteredBusinessOptions={businessOptions}
            filteredSitesOptions={filteredSitesOptions}
            deliveryTypeOptions={deliveryTypeOptions}
            roundingOptions={roundingOptions}
            markupTypeOptions={markupTypeOptions}
            businessSearchValue={businessSearchValue}
            setBusinessSearchValue={handleBusinessSearchChange}
            businessPagination={businessesPaginationProps}
            handleChangeBusinessPage={handleChangeBusinessPage}
            businessesLoading={businessesState?.loading}
            sitesSearchValue={sitesSearchValue}
            setSitesSearchValue={setSitesSearchValue}
          />
        </SideBar>
      )}

      <Alert
        title={t('WEB_APPNAME', 'Ordering')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => setAlertState({ open: false, content: [] })}
        onAccept={() => setAlertState({ open: false, content: [] })}
        closeOnBackdrop={false}
      />

      <Confirm
        width='700px'
        title={t('WEB_APPNAME', 'Ordering')}
        content={confirmState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={confirmState.open}
        onClose={() => setConfirmState((prev) => ({ ...prev, open: false }))}
        onCancel={() => setConfirmState((prev) => ({ ...prev, open: false }))}
        onAccept={confirmState.handleOnAccept}
        closeOnBackdrop={false}
      />
    </>
  )
}

export const Markups = (props) => {
  const query = new URLSearchParams(useLocation().search)
  const defaultPage = query.get('page') || 1
  const defaultPageSize = query.get('pageSize') || 10

  const markupsProps = {
    ...props,
    UIComponent: MarkupsUI,
    paginationSettings: {
      initialPage: props.isUseQuery && !isNaN(defaultPage) ? Number(defaultPage) : 1,
      pageSize: props.isUseQuery && !isNaN(defaultPageSize) ? Number(defaultPageSize) : 10,
      controlType: 'pages'
    }
  }

  return <MarkupsController {...markupsProps} />
}
