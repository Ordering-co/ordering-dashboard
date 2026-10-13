import React, { useEffect, useMemo, useState } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

import { Markups as MarkupsController, useLanguage } from '../../../../../index'
import { CheckSquareFill, Square } from 'react-bootstrap-icons'

import { Button, Switch } from '../../../styles'
import { Alert, Confirm, Modal, Pagination, SearchBar } from '../../Shared'
import { MarkupForm } from '../MarkupForm'

import {
  BusinessMarkupsContainer,
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
  Badge,
  EmptyWrapper
} from './styles'

const BusinessMarkupsUI = (props) => {
  const {
    businessId,
    markupsList,
    getMarkups,
    createMarkup,
    updateMarkup,
    deleteMarkups,
    actionState,
    sitesState,
    paginationProps,
    setPaginationProps,
    searchValue,
    handleChangeSearch
  } = props

  const [, t] = useLanguage()

  const deliveryTypeOptions = useMemo(() => ([
    { value: 'all', content: t('ALL_DELIVERY_TYPES', 'All delivery types') },
    { value: 'delivery', content: t('DELIVERY', 'Delivery') },
    { value: 'pickup', content: t('PICKUP', 'Pickup') },
    { value: 'eatin', content: t('EATING', 'Eating') },
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

  const sitesOptions = useMemo(() => {
    const base = [{ value: 'all', content: t('ALL_SITES', 'All sites') }]
    const list = Array.isArray(sitesState?.sites) ? sitesState.sites : []
    return base.concat(list.map((s) => ({ value: s.id, content: s.name || String(s.id) })))
  }, [sitesState?.sites, t])

  const [isOpenForm, setIsOpenForm] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [editingId, setEditingId] = useState(null)
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
    business_id: businessId,
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

  const getEditableMarkups = () => {
    const safeBusinessId = Number(businessId)
    const items = Array.isArray(markupsList?.markups) ? markupsList.markups : []
    return items.filter((m) => Number(m?.business_id) === safeBusinessId)
  }

  const [selectedMarkupIds, setSelectedMarkupIds] = useState([])
  const [confirmState, setConfirmState] = useState({ open: false, content: '', handleOnAccept: null })

  const isAllChecked = useMemo(() => {
    const items = getEditableMarkups()
    if (items.length === 0) return false
    return items.every((m) => selectedMarkupIds.includes(m.id))
  }, [markupsList?.markups, selectedMarkupIds, businessId])

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
    const items = getEditableMarkups()
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

  const handleRowKeyDown = (e, id, isReadonly) => {
    if (!id) return
    if (isReadonly) return
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
      business_id: businessId,
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
    if (!businessId) {
      handleOpenAlert(t('BUSINESS_REQUIRED', 'Business is required'))
      return
    }
    handleResetForm()
    setIsOpenForm(true)
  }

  const handleOpenEdit = async (id) => {
    const safeBusinessId = Number(businessId)
    const markup = (markupsList?.markups || []).find((m) => Number(m?.id) === Number(id)) || null
    if (!markup) {
      handleOpenAlert(t('NOT_FOUND', 'Not found'))
      return
    }
    const isReadonly = markup?.business_id == null || Number(markup?.business_id) !== safeBusinessId
    if (isReadonly) {
      handleOpenAlert(t('GLOBAL_MARKUP_READONLY', 'This is a global markup and cannot be edited from the business settings.'))
      return
    }

    handleResetForm()
    setIsEdit(true)
    setEditingId(id)
    setIsOpenForm(true)

    const rounding = Array.isArray(markup?.rounding_values) ? markup.rounding_values : []
    const products = markup?.rules?.products || {}
    const suboptions = markup?.rules?.suboptions || {}
    const applyToSuboptions = Number(suboptions?.markup_value ?? 0) !== 0

    setFormState((prev) => ({
      ...prev,
      name: markup?.name ?? '',
      enabled: !!markup?.enabled,
      business_id: safeBusinessId,
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

    const safeBusinessId = Number(businessId)
    if (!safeBusinessId || Number.isNaN(safeBusinessId)) {
      return { error: true, result: t('BUSINESS_REQUIRED', 'Business is required') }
    }

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
      business_id: safeBusinessId,
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

  const handleToggleEnabled = async (id, enabled) => {
    const safeBusinessId = Number(businessId)
    const markup = (markupsList?.markups || []).find((m) => Number(m?.id) === Number(id)) || null
    if (!markup) return
    if (markup?.business_id == null || Number(markup?.business_id) !== safeBusinessId) {
      handleOpenAlert(t('GLOBAL_MARKUP_READONLY', 'This is a global markup and cannot be edited from the business settings.'))
      return
    }
    const res = await updateMarkup?.(id, { enabled: !!enabled })
    if (res?.error) {
      const msg = Array.isArray(res?.result) ? res.result : [t('ERROR', 'Error')]
      handleOpenAlert(msg)
    }
  }

  return (
    <>
      <BusinessMarkupsContainer>
        <HeaderContainer>
          <HeaderTitleContainer>
            <h1>{t('MARKUPS', 'Markups')}</h1>
          </HeaderTitleContainer>
          <ActionsWrapper>
            <Button
              color='lightPrimary'
              borderRadius='8px'
              disabled={selectedMarkupIds.length === 0 || actionState?.loading}
              onClick={handleClickDeleteSelected}
            >
              {t('DELETE', 'Delete')}
            </Button>
            <Button
              color='primary'
              borderRadius='8px'
              onClick={handleOpenCreate}
              disabledWithOpacity={actionState?.loading || !businessId}
            >
              {t('ADD_NEW', 'Add new')}
            </Button>
          </ActionsWrapper>
        </HeaderContainer>

        <div style={{ marginTop: 15 }}>
          <SearchBar
            placeholder={t('SEARCH', 'Search')}
            onSearch={handleChangeSearch}
            search={searchValue}
            lazyLoad
          />
        </div>

        {markupsList?.loading
          ? (
            <div style={{ marginTop: 20 }}>
              <Skeleton height={40} count={8} />
            </div>
            )
          : (
            <>
              {(markupsList?.markups?.length > 0)
                ? (
                  <Table>
                    <Thead>
                      <tr>
                        <th style={{ width: 45 }}>
                          <CheckBoxWrapper onClick={handleSelectAllMarkups} isChecked={isAllChecked}>
                            {isAllChecked ? <CheckSquareFill /> : <Square />}
                          </CheckBoxWrapper>
                        </th>
                        <th>ID</th>
                        <th>{t('NAME', 'Name')}</th>
                        <th>{t('STATUS', 'Status')}</th>
                      </tr>
                    </Thead>
                    <Tbody>
                      {(markupsList?.markups || []).map((markup) => {
                        const safeBusinessId = Number(businessId)
                        const isReadonly = markup?.business_id == null || Number(markup?.business_id) !== safeBusinessId
                        const isChecked = selectedMarkupIds.includes(markup?.id)
                        return (
                          <tr
                            key={markup.id}
                            className={isReadonly ? 'readonly' : ''}
                            role='row'
                            tabIndex={0}
                            aria-label={t('MARKUP_ROW', 'Markup row')}
                            onKeyDown={(e) => handleRowKeyDown(e, markup.id, isReadonly)}
                            onClick={() => {
                              if (isReadonly) {
                                handleOpenAlert(t('GLOBAL_MARKUP_READONLY', 'This is a global markup and cannot be edited from the business settings.'))
                                return
                              }
                              handleOpenEdit(markup.id)
                            }}
                          >
                            <td>
                              <CheckBoxWrapper
                                isChecked={isChecked}
                                onClick={(e) => {
                                  if (isReadonly) {
                                    e?.stopPropagation?.()
                                    handleOpenAlert(t('GLOBAL_MARKUP_READONLY', 'This is a global markup and cannot be edited from the business settings.'))
                                    return
                                  }
                                  handleToggleMarkupId(e, markup.id)
                                }}
                              >
                                {isChecked ? <CheckSquareFill /> : <Square />}
                              </CheckBoxWrapper>
                            </td>
                            <td>
                              <MarkupIdWrapper>
                                {markup.id}
                              </MarkupIdWrapper>
                            </td>
                            <td>
                              {markup?.name}
                              {isReadonly && <Badge>{t('GLOBAL', 'Global')}</Badge>}
                            </td>
                            <td>
                              <StatusWrapper>
                                <p>{t('ENABLE', 'Enable')}</p>
                                <span
                                  className='enable_control'
                                  onClick={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  role='button'
                                  tabIndex={-1}
                                  aria-label={t('TOGGLE_ENABLED', 'Toggle enabled')}
                                >
                                  <Switch
                                    defaultChecked={!!markup?.enabled}
                                    disabled={isReadonly}
                                    onChange={(val) => handleToggleEnabled(markup.id, val)}
                                  />
                                </span>
                              </StatusWrapper>
                            </td>
                          </tr>
                        )
                      })}
                    </Tbody>
                  </Table>
                  )
                : (
                  <EmptyWrapper>
                    {t('NO_MARKUPS', 'No markups found')}
                  </EmptyWrapper>
                  )}

              <PagesBottomContainer>
                <Pagination
                  currentPage={paginationProps?.currentPage}
                  totalPages={paginationProps?.totalPages}
                  defaultPageSize={paginationProps?.pageSize}
                  handleChangePage={handleChangePage}
                  handleChangePageSize={handleChangePageSize}
                />
              </PagesBottomContainer>
            </>
            )}
      </BusinessMarkupsContainer>

      {isOpenForm && (
        <Modal
          width='80%'
          open={isOpenForm}
          onClose={() => setIsOpenForm(false)}
          padding='20px 0 0 0'
        >
          <MarkupForm
            t={t}
            isEdit={isEdit}
            actionLoading={actionState?.loading}
            isShowBusinessSelect={false}
            markupId={editingId}
            formState={formState}
            setFormState={setFormState}
            handleToggleRounding={handleToggleRounding}
            handleSubmit={handleSubmit}
            onUpdateEnabled={handleUpdateEnabled}
            filteredSitesOptions={filteredSitesOptions}
            deliveryTypeOptions={deliveryTypeOptions}
            roundingOptions={roundingOptions}
            markupTypeOptions={markupTypeOptions}
            businessSearchValue=''
            setBusinessSearchValue={() => { }}
            sitesSearchValue={sitesSearchValue}
            setSitesSearchValue={setSitesSearchValue}
          />
        </Modal>
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

export const BusinessMarkups = (props) => {
  const businessId = props?.businessId
  const businessMarkupsProps = {
    ...props,
    businessId,
    includeGlobalMarkups: true,
    isFetchBusinesses: false,
    isFetchSites: true,
    asDashboard: true,
    UIComponent: BusinessMarkupsUI
  }

  return <MarkupsController {...businessMarkupsProps} />
}
