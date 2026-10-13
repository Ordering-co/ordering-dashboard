import React, { useEffect, useMemo, useState } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

import { CustomerFees as CustomerFeesController, useLanguage, useUtils } from '../../../../../index'
import { CheckSquareFill, Square } from 'react-bootstrap-icons'

import { Button, Switch } from '../../../styles'
import { Input } from '../../../styles/Inputs'
import { Select } from '../../../styles/Select/FirstSelect'
import { Alert, Confirm, Modal, Pagination, RecipientSelect, SearchBar } from '../../Shared'

import {
  CustomerFeesContainer,
  HeaderContainer,
  ActionsWrapper,
  Table,
  Thead,
  Tbody,
  PagesBottomContainer,
  StatusWrapper,
  CheckBoxWrapper,
  FeeIdWrapper,
  FeeNameWrapper,
  ConditionBadge,
  ConditionsColumn,
  FormContainer,
  FormHeader,
  FormSection,
  FieldsColumn,
  FieldsRow,
  Field,
  FieldHint,
  FormActions,
  LegacyFeeContainer,
  DateToggleWrapper
} from './styles'

const CustomerFeesUI = (props) => {
  const {
    businessId,
    feesList,
    getFees,
    createFee,
    updateFee,
    deleteFees,
    searchValue,
    handleChangeSearch,
    paginationProps,
    setPaginationProps,
    sitesState,
    paymethodsState,
    actionState,
    // Legacy fee props (passed from BusinessTaxAndFees)
    business,
    formState: legacyFormState,
    setFormState: setLegacyFormState
  } = props

  const [, t] = useLanguage()
  const [{ parsePrice }] = useUtils()

  const hasCustomerFees = !feesList?.loading && (feesList?.fees?.length > 0 || (paginationProps?.totalItems != null && paginationProps.totalItems > 0))

  const handleChangeLegacyFormState = (newChange) => {
    if (!setLegacyFormState) return
    setLegacyFormState({
      ...legacyFormState,
      changes: {
        ...legacyFormState?.changes,
        ...newChange
      }
    })
  }

  const deliveryTypeOptions = useMemo(() => ([
    { value: 'all', content: t('ALL_DELIVERY_TYPES', 'All delivery types') },
    { value: 'delivery', content: t('DELIVERY', 'Delivery') },
    { value: 'pickup', content: t('PICKUP', 'Pickup') },
    { value: 'eatin', content: t('EATING', 'Eat in') },
    { value: 'curbside', content: t('CURBSIDE', 'Curbside') },
    { value: 'drive_thru', content: t('DRIVE_THRU', 'Drive thru') },
    { value: 'seat_delivery', content: t('SEAT_DELIVERY', 'Seat delivery') },
    { value: 'catering_delivery', content: t('CATERING_DELIVERY', 'Catering delivery') },
    { value: 'catering_pickup', content: t('CATERING_PICKUP', 'Catering pickup') },
    { value: 'reservation', content: t('RESERVATION', 'Reservation') }
  ]), [t])

  const sitesOptions = useMemo(() => {
    const base = [{ value: 'all', content: t('ALL_SITES', 'All sites') }]
    const list = Array.isArray(sitesState?.sites) ? sitesState.sites : []
    return base.concat(list.map((s) => ({ value: s.id, content: s.name || String(s.id) })))
  }, [sitesState?.sites, t])

  const paymethodsOptions = useMemo(() => {
    const base = [{ value: 'all', content: t('ALL_PAYMENT_METHODS', 'All payment methods') }]
    const list = Array.isArray(paymethodsState?.paymethods) ? paymethodsState.paymethods : []
    return base.concat(list.map((p) => ({ value: p.id, content: p.name || String(p.id) })))
  }, [paymethodsState?.paymethods, t])

  const [isOpenFeeForm, setIsOpenFeeForm] = useState(false)
  const [isEditFee, setIsEditFee] = useState(false)
  const [editingFeeId, setEditingFeeId] = useState(null)
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [confirmState, setConfirmState] = useState({ open: false, content: '', handleOnAccept: null })

  const [feeFormState, setFeeFormState] = useState({
    name: '',
    description: '',
    enabled: true,
    fixed: '',
    percentage: '',
    fixed_minimum: '',
    delivery_type: 'all',
    site_id: 'all',
    paymethod_id: 'all',
    recipient: 'business',
    start_date: '',
    end_date: ''
  })

  const [selectedFeeIds, setSelectedFeeIds] = useState([])

  const [showDateRange, setShowDateRange] = useState(false)
  const [deliveryTypeSearch, setDeliveryTypeSearch] = useState('')
  const [siteSearch, setSiteSearch] = useState('')
  const [paymethodSearch, setPaymethodSearch] = useState('')

  const handleOpenAlert = (content) => {
    const normalized = Array.isArray(content)
      ? content
      : content
        ? [String(content)]
        : []
    setAlertState({ open: true, content: normalized })
  }

  const isAllFeesChecked = useMemo(() => {
    const items = Array.isArray(feesList?.fees) ? feesList.fees : []
    if (items.length === 0) return false
    return items.every((f) => selectedFeeIds.includes(f.id))
  }, [feesList?.fees, selectedFeeIds])

  const handleToggleFeeId = (e, id) => {
    e?.stopPropagation?.()
    if (!id) return
    setSelectedFeeIds((prev) => {
      const exists = prev.includes(id)
      if (exists) return prev.filter((x) => x !== id)
      return prev.concat(id)
    })
  }

  const handleSelectAllFees = (e) => {
    e?.stopPropagation?.()
    const items = Array.isArray(feesList?.fees) ? feesList.fees : []
    if (items.length === 0) return
    setSelectedFeeIds((prev) => {
      const nextIds = items.map((f) => f.id)
      const allSelected = nextIds.every((id) => prev.includes(id))
      return allSelected ? [] : nextIds
    })
  }

  const handleClickDeleteSelectedFees = () => {
    if (selectedFeeIds.length === 0) return
    setConfirmState({
      open: true,
      content: t('QUESTION_DELETE_FEES', 'Are you sure to delete these fees?'),
      handleOnAccept: async () => {
        setConfirmState((prev) => ({ ...prev, open: false }))
        const res = await deleteFees?.(selectedFeeIds)
        if (res?.error) return
        setSelectedFeeIds([])
      }
    })
  }

  const handleChangeFeesPage = (page) => {
    const nextPage = Number(page) >= 1 ? Number(page) : 1
    setPaginationProps((prev) => ({ ...prev, currentPage: nextPage }))
    getFees(nextPage, paginationProps.pageSize)
  }

  const handleChangeFeesPageSize = (pageSize) => {
    const nextPageSize = Number(pageSize) >= 1 ? Number(pageSize) : 10
    setPaginationProps((prev) => ({ ...prev, pageSize: nextPageSize, currentPage: 1 }))
    getFees(1, nextPageSize)
  }

  const handleResetFeeForm = () => {
    setIsEditFee(false)
    setEditingFeeId(null)
    setFeeFormState({
      name: '',
      description: '',
      enabled: true,
      fixed: '',
      percentage: '',
      fixed_minimum: '',
      delivery_type: 'all',
      site_id: 'all',
      paymethod_id: 'all',
      recipient: 'business',
      start_date: '',
      end_date: ''
    })
    setShowDateRange(false)
    setDeliveryTypeSearch('')
    setSiteSearch('')
    setPaymethodSearch('')
  }

  const handleOpenCreateFee = () => {
    if (!businessId) {
      handleOpenAlert(t('BUSINESS_REQUIRED', 'Business is required'))
      return
    }
    handleResetFeeForm()
    setIsOpenFeeForm(true)
  }

  const handleOpenEditFee = (id) => {
    const fee = (feesList?.fees || []).find((f) => Number(f?.id) === Number(id)) || null
    if (!fee) {
      handleOpenAlert(t('NOT_FOUND', 'Not found'))
      return
    }

    handleResetFeeForm()
    setIsEditFee(true)
    setEditingFeeId(id)
    setIsOpenFeeForm(true)
    setShowDateRange(!!(fee?.start_date || fee?.end_date))

    setFeeFormState({
      name: fee?.name ?? '',
      description: fee?.description ?? '',
      enabled: !!fee?.enabled,
      fixed: fee?.fixed != null ? String(fee.fixed) : '',
      percentage: fee?.percentage != null ? String(fee.percentage) : '',
      fixed_minimum: fee?.fixed_minimum != null ? String(fee.fixed_minimum) : '',
      delivery_type: fee?.delivery_type ?? 'all',
      site_id: fee?.site_id ?? 'all',
      paymethod_id: fee?.paymethod_id ?? 'all',
      recipient: fee?.recipient ?? 'business',
      start_date: fee?.start_date ? fee.start_date.split(' ')[0] : '',
      end_date: fee?.end_date ? fee.end_date.split(' ')[0] : ''
    })
  }

  const normalizeDecimalInput = (value) => {
    const cleaned = String(value).replace(/[^0-9.]/g, '')
    const parts = cleaned.split('.')
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('')
    }
    return cleaned
  }

  const normalizePercentageInput = (value) => {
    const cleaned = normalizeDecimalInput(value)
    const num = parseFloat(cleaned)
    if (!Number.isNaN(num) && num > 100) {
      return '100'
    }
    return cleaned
  }

  const handleChangeForm = (key, value) => {
    setFeeFormState((prev) => ({ ...prev, [key]: value }))
  }

  const buildFeePayload = () => {
    const name = String(feeFormState.name || '').trim()
    if (!name) return { error: true, result: t('NAME_IS_REQUIRED', 'Name is required') }
    if (name.length > 255) return { error: true, result: t('NAME_MAX_255', 'Name max 255 chars') }

    const fixed = feeFormState.fixed !== '' ? Number(feeFormState.fixed) : 0
    if (Number.isNaN(fixed)) return { error: true, result: t('INVALID_FIXED_VALUE', 'Invalid fixed value') }

    const percentage = feeFormState.percentage !== '' ? Number(feeFormState.percentage) : 0
    if (Number.isNaN(percentage)) return { error: true, result: t('INVALID_PERCENTAGE_VALUE', 'Invalid percentage value') }
    if (percentage < 0 || percentage > 100) return { error: true, result: t('PERCENTAGE_RANGE', 'Percentage must be between 0 and 100') }

    const fixedMinimum = feeFormState.fixed_minimum !== '' ? Number(feeFormState.fixed_minimum) : null
    if (fixedMinimum !== null && Number.isNaN(fixedMinimum)) return { error: true, result: t('INVALID_FIXED_MINIMUM', 'Invalid fixed minimum value') }

    const payload = {
      name,
      description: String(feeFormState.description || '').trim(),
      enabled: !!feeFormState.enabled,
      fixed,
      percentage,
      fixed_minimum: fixedMinimum,
      delivery_type: feeFormState.delivery_type === 'all' ? null : feeFormState.delivery_type,
      site_id: feeFormState.site_id === 'all' ? null : feeFormState.site_id,
      paymethod_id: feeFormState.paymethod_id === 'all' ? null : feeFormState.paymethod_id,
      recipient: feeFormState.recipient || 'business',
      start_date: feeFormState.start_date || null,
      end_date: feeFormState.end_date || null
    }

    return { error: false, result: payload }
  }

  const handleSubmitFee = async () => {
    const built = buildFeePayload()
    if (built.error) {
      handleOpenAlert(built.result)
      return
    }

    const payload = built.result
    const res = isEditFee
      ? await updateFee?.(editingFeeId, payload)
      : await createFee?.(payload)

    if (res?.error) {
      const msg = Array.isArray(res?.result) ? res.result : (res?.result ? [String(res.result)] : [t('ERROR', 'Error')])
      handleOpenAlert(msg)
      return
    }
    setIsOpenFeeForm(false)
  }

  const handleToggleFeeEnabled = async (id, enabled) => {
    const res = await updateFee?.(id, { enabled: !!enabled })
    if (res?.error) {
      const msg = Array.isArray(res?.result) ? res.result : [t('ERROR', 'Error')]
      handleOpenAlert(msg)
    }
  }

  useEffect(() => {
    if (!actionState?.error || actionState?.loading) return
    handleOpenAlert(actionState.error)
  }, [actionState?.error, actionState?.loading])

  const formatCurrency = (amount) => {
    const num = Number(amount)
    if (Number.isNaN(num)) return '-'
    return parsePrice(num)
  }

  const getSiteName = (siteId) => {
    if (!siteId) return null
    const site = (sitesState?.sites || []).find((s) => s.id === siteId)
    return site?.name || `Site #${siteId}`
  }

  const getPaymethodName = (paymethodId) => {
    if (!paymethodId) return null
    const pm = (paymethodsState?.paymethods || []).find((p) => p.id === paymethodId)
    return pm?.name || `PM #${paymethodId}`
  }

  const getDeliveryTypeName = (type) => {
    if (!type) return null
    const option = deliveryTypeOptions.find((o) => o.value === type)
    return option?.content || type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')
  }

  const filteredDeliveryTypeOptions = useMemo(() => {
    if (!deliveryTypeSearch) return deliveryTypeOptions
    return deliveryTypeOptions.filter((opt) =>
      opt.content?.toLowerCase().includes(deliveryTypeSearch.toLowerCase())
    )
  }, [deliveryTypeOptions, deliveryTypeSearch])

  const filteredSitesOptions = useMemo(() => {
    if (!siteSearch) return sitesOptions
    return sitesOptions.filter((opt) =>
      opt.content?.toLowerCase().includes(siteSearch.toLowerCase())
    )
  }, [sitesOptions, siteSearch])

  const filteredPaymethodsOptions = useMemo(() => {
    if (!paymethodSearch) return paymethodsOptions
    return paymethodsOptions.filter((opt) =>
      opt.content?.toLowerCase().includes(paymethodSearch.toLowerCase())
    )
  }, [paymethodsOptions, paymethodSearch])

  return (
    <>
      {feesList?.loading
        ? (
            <div style={{ marginTop: 20 }}>
              <Skeleton height={40} count={5} />
            </div>
          )
        : !hasCustomerFees
            ? (
                <LegacyFeeContainer>
                  <div className='legacy-field'>
                    <label>{t('SERVICE_FEE_SETTINGS', 'Service fee settings in %')}</label>
                    <Input
                      placeholder='0.00%'
                      defaultValue={business?.service_fee}
                      onChange={e => handleChangeLegacyFormState({ service_fee: e.target.value })}
                    />
                  </div>
                  <Button
                    color='primary'
                    borderRadius='8px'
                    onClick={handleOpenCreateFee}
                    disabled={actionState?.loading || !businessId}
                  >
                    {t('USE_ADVANCED_FEE', 'Use advanced fee settings')}
                  </Button>
                </LegacyFeeContainer>
              )
            : (
                <CustomerFeesContainer>
                  <HeaderContainer>
                    <SearchBar
                      placeholder={t('SEARCH', 'Search')}
                      onSearch={handleChangeSearch}
                      search={searchValue}
                      lazyLoad
                    />
                    <ActionsWrapper>
                      <Button
                        color='lightPrimary'
                        borderRadius='8px'
                        disabled={selectedFeeIds.length === 0 || actionState?.loading}
                        onClick={handleClickDeleteSelectedFees}
                      >
                        {t('DELETE', 'Delete')}
                      </Button>
                      <Button
                        color='primary'
                        borderRadius='8px'
                        onClick={handleOpenCreateFee}
                        disabled={actionState?.loading || !businessId}
                      >
                        {t('ADD_NEW', 'Add new')}
                      </Button>
                    </ActionsWrapper>
                  </HeaderContainer>

                  <Table>
                    <Thead>
                      <tr>
                        <th style={{ width: 45 }}>
                          <CheckBoxWrapper onClick={handleSelectAllFees} isChecked={isAllFeesChecked}>
                            {isAllFeesChecked ? <CheckSquareFill /> : <Square />}
                          </CheckBoxWrapper>
                        </th>
                        <th>ID</th>
                        <th>{t('NAME', 'Name')}</th>
                        <th>{t('AMOUNT', 'Amount')}</th>
                        <th>{t('CONDITIONS', 'Conditions')}</th>
                        <th>{t('STATUS', 'Status')}</th>
                      </tr>
                    </Thead>
                    <Tbody>
                      {(feesList?.fees || []).map((fee) => {
                        const isChecked = selectedFeeIds.includes(fee?.id)
                        return (
                          <tr
                            key={fee.id}
                            role='row'
                            tabIndex={0}
                            onClick={() => handleOpenEditFee(fee.id)}
                          >
                            <td>
                              <CheckBoxWrapper
                                isChecked={isChecked}
                                onClick={(e) => handleToggleFeeId(e, fee.id)}
                              >
                                {isChecked ? <CheckSquareFill /> : <Square />}
                              </CheckBoxWrapper>
                            </td>
                            <td>
                              <FeeIdWrapper>{fee.id}</FeeIdWrapper>
                            </td>
                            <td><FeeNameWrapper>{fee?.name}</FeeNameWrapper></td>
                            <td>
                              {`${fee?.fixed != null ? formatCurrency(fee.fixed) : formatCurrency(0)} + ${fee?.percentage != null ? fee.percentage : 0}%`}
                              {fee?.fixed_minimum != null && (
                                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                                  {t('MIN', 'Min')}: {formatCurrency(fee.fixed_minimum)}
                                </div>
                              )}
                            </td>
                            <td>
                              <ConditionsColumn>
                                {fee?.site_id && (
                                  <ConditionBadge>{getSiteName(fee.site_id)}</ConditionBadge>
                                )}
                                {fee?.paymethod_id && (
                                  <ConditionBadge>{getPaymethodName(fee.paymethod_id)}</ConditionBadge>
                                )}
                                {fee?.delivery_type && (
                                  <ConditionBadge>{getDeliveryTypeName(fee.delivery_type)}</ConditionBadge>
                                )}
                                {!fee?.site_id && !fee?.paymethod_id && !fee?.delivery_type && '-'}
                              </ConditionsColumn>
                            </td>
                            <td>
                              <StatusWrapper>
                                <span
                                  className='enable_control'
                                  onClick={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  role='button'
                                  tabIndex={-1}
                                >
                                  <Switch
                                    defaultChecked={!!fee?.enabled}
                                    onChange={(val) => handleToggleFeeEnabled(fee.id, val)}
                                  />
                                </span>
                              </StatusWrapper>
                            </td>
                          </tr>
                        )
                      })}
                    </Tbody>
                  </Table>

                  <PagesBottomContainer>
                    <Pagination
                      currentPage={paginationProps?.currentPage}
                      totalPages={paginationProps?.totalPages}
                      defaultPageSize={paginationProps?.pageSize}
                      handleChangePage={handleChangeFeesPage}
                      handleChangePageSize={handleChangeFeesPageSize}
                    />
                  </PagesBottomContainer>
                </CustomerFeesContainer>
              )
      }

      {/* Fee Form Modal */}
      {isOpenFeeForm && (
        <Modal
          width='700px'
          height='650px'
          open={isOpenFeeForm}
          onClose={() => setIsOpenFeeForm(false)}
          padding='0'
        >
          <FormContainer>
            <FormHeader>
              <div>
                <h1>
                  {feeFormState.name?.trim()
                    ? feeFormState.name
                    : (isEditFee ? t('EDIT_CUSTOMER_FEE', 'Edit Customer Fee') : t('ADD_CUSTOMER_FEE', 'Add Customer Fee'))}
                </h1>
                {isEditFee && (
                  <Switch
                    defaultChecked={!!feeFormState.enabled}
                    onChange={(val) => handleChangeForm('enabled', val)}
                  />
                )}
              </div>
            </FormHeader>

            <FormSection>
              <FieldsColumn>
                <Field>
                  <label>{t('NAME', 'Name')}</label>
                  <Input
                    value={feeFormState.name}
                    onChange={(e) => handleChangeForm('name', e.target.value)}
                    placeholder={t('ENTER_FEE_NAME', 'Enter fee name')}
                    maxLength={255}
                  />
                </Field>

                <Field>
                  <label>{t('DESCRIPTION', 'Description')}</label>
                  <Input
                    value={feeFormState.description}
                    onChange={(e) => handleChangeForm('description', e.target.value)}
                    placeholder={t('ENTER_FEE_DESCRIPTION', 'Enter fee description')}
                    maxLength={500}
                  />
                </Field>

                <FieldsRow>
                  <Field>
                    <label>{t('FIXED_AMOUNT', 'Fixed Amount')}</label>
                    <Input
                      value={feeFormState.fixed}
                      onChange={(e) => handleChangeForm('fixed', normalizeDecimalInput(e.target.value))}
                      placeholder='0.00'
                    />
                  </Field>
                  <Field>
                    <label>{t('PERCENTAGE', 'Percentage')}</label>
                    <Input
                      value={feeFormState.percentage}
                      onChange={(e) => handleChangeForm('percentage', normalizePercentageInput(e.target.value))}
                      placeholder='0%'
                    />
                  </Field>
                </FieldsRow>

                <Field>
                  <label>{t('FIXED_MINIMUM', 'Fixed Minimum')}</label>
                  <Input
                    value={feeFormState.fixed_minimum}
                    onChange={(e) => handleChangeForm('fixed_minimum', normalizeDecimalInput(e.target.value))}
                    placeholder={t('OPTIONAL', 'Optional')}
                  />
                  <FieldHint>
                    {t('FIXED_MINIMUM_DESCRIPTION', 'Minimum amount charged to the customer. If the calculated fee (fixed + percentage) is less than this value, this minimum will be applied instead.')}
                  </FieldHint>
                </Field>

                <FieldsRow>
                  <Field>
                    <label>{t('DELIVERY_TYPE', 'Delivery Type')}</label>
                    <Select
                      options={filteredDeliveryTypeOptions}
                      defaultValue={feeFormState.delivery_type || 'all'}
                      onChange={(val) => handleChangeForm('delivery_type', val)}
                      placeholder={t('SELECT_DELIVERY_TYPE', 'Select delivery type')}
                      optionInnerMaxHeight='175px'
                      isShowSearchBar
                      searchValue={deliveryTypeSearch}
                      handleChangeSearch={setDeliveryTypeSearch}
                      searchBarIsCustomLayout
                      searchBarIsNotLazyLoad
                    />
                  </Field>
                  <Field>
                    <label>{t('PAYMENT_METHOD', 'Payment Method')}</label>
                    <Select
                      options={filteredPaymethodsOptions}
                      defaultValue={feeFormState.paymethod_id || 'all'}
                      onChange={(val) => handleChangeForm('paymethod_id', val)}
                      placeholder={t('SELECT_PAYMENT_METHOD', 'Select payment method')}
                      optionInnerMaxHeight='175px'
                      isShowSearchBar
                      searchValue={paymethodSearch}
                      handleChangeSearch={setPaymethodSearch}
                      searchBarIsCustomLayout
                      searchBarIsNotLazyLoad
                    />
                  </Field>
                </FieldsRow>

                <Field>
                  <label>{t('SITE', 'Site')} ({t('PLATFORM', 'Platform')})</label>
                  <Select
                    options={filteredSitesOptions}
                    defaultValue={feeFormState.site_id || 'all'}
                    onChange={(val) => handleChangeForm('site_id', val)}
                    placeholder={t('SELECT_SITE', 'Select site')}
                    optionInnerMaxHeight='175px'
                    isShowSearchBar
                    searchValue={siteSearch}
                    handleChangeSearch={setSiteSearch}
                    searchBarIsCustomLayout
                    searchBarIsNotLazyLoad
                  />
                </Field>

                <Field>
                  <RecipientSelect
                    value={feeFormState.recipient ?? 'business'}
                    onChange={(val) => handleChangeForm('recipient', val)}
                  />
                </Field>

                <DateToggleWrapper>
                  <Switch
                    defaultChecked={showDateRange}
                    onChange={(val) => {
                      setShowDateRange(val)
                      if (!val) {
                        handleChangeForm('start_date', '')
                        handleChangeForm('end_date', '')
                      }
                    }}
                  />
                  <div>
                    <span>{t('LIMIT_BY_DATE', 'Limit by date range')}</span>
                    <FieldHint>
                      {t('LIMIT_BY_DATE_HINT', 'Without a date range, this fee applies indefinitely.')}
                    </FieldHint>
                  </div>
                </DateToggleWrapper>

                {showDateRange && (
                  <FieldsRow>
                    <Field>
                      <label>{t('START_DATE', 'Start Date')}</label>
                      <Input
                        type='date'
                        value={feeFormState.start_date}
                        onChange={(e) => handleChangeForm('start_date', e.target.value)}
                      />
                    </Field>
                    <Field>
                      <label>{t('END_DATE', 'End Date')}</label>
                      <Input
                        type='date'
                        value={feeFormState.end_date}
                        onChange={(e) => handleChangeForm('end_date', e.target.value)}
                      />
                    </Field>
                  </FieldsRow>
                )}
              </FieldsColumn>
            </FormSection>

            <FormActions>
              <Button
                color='primary'
                borderRadius='8px'
                onClick={handleSubmitFee}
                disabled={actionState?.loading}
              >
                {isEditFee ? t('SAVE_CHANGES', 'Save changes') : t('CREATE', 'Create')}
              </Button>
            </FormActions>
          </FormContainer>
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

export const CustomerFees = (props) => {
  const {
    businessId,
    business,
    formState,
    setFormState,
    handleUpdateBusinessClick,
    ...rest
  } = props

  const customerFeesProps = {
    ...rest,
    businessId,
    business,
    formState,
    setFormState,
    handleUpdateBusinessClick,
    UIComponent: CustomerFeesUI
  }

  return <CustomerFeesController {...customerFeesProps} />
}
