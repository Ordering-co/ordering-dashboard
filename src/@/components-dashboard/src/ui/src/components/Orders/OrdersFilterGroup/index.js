import React, { useState, useEffect, useRef, useId } from 'react'
import { useLanguage, useApi, useSession, OrdersFilter as OrdersFilterController } from '../../../../../index'
import { BusinessesSelector } from '../BusinessesSelector'
import { DriversGroupTypeSelector } from '../DriversGroupTypeSelector'
import { DateTypeSelector } from '../DateTypeSelector'
import { CitySelector } from '../../Shared'
import { DeliveryTypeSelector } from '../DeliveryTypeSelector'
import { PaymethodTypeSelector } from '../PaymethodTypeSelector'
import { CountryFilter } from '../CountryFilter'
import { CurrencyFilter } from '../CurrencyFilter'
import { AdminsSelector } from '../AdminsSelector'
import { Button, IconButton } from '../../Shared/Product/Button'
import { Sheet } from '../../Shared/Product/Sheet'
import { CirclePlus, Trash2 } from '../../Shared/Icon'
import { getUniqueId } from '../../../utils'
import { Select } from '../../../styles/Select/FirstSelect'
import { SelectSurfaceContext } from '../../Shared/UI/selectPlacement'
import { SelectFieldLabelContext } from '../../Shared/UI/FirstSelect'
import { useFilterValues } from '../../../contexts/FilterValuesContext'
import '../OrdersFilterBar/orders-filter-bar.css'
import './orders-filter-group.css'

import { Option } from './styles'
import { LogisticStatusDot } from '../OrdersTable/styles'
import { useIsPhone } from '../../Shared/Product/useIsPhone' // redesign W1-1 (T1-1): was useOrderCardsViewport (OrdersTable/OrderCard)

// redesign fix-qa: every picker of the sheet opts in to lists that start at the trigger, are as wide as it,
// flip up without room and stay inside the sheet body (Shared/UI/selectPlacement.js); other screens do not.
const SHEET_SELECT_SURFACE = { fitTrigger: true }

const SheetBody = ({ children }) => (
  <SelectSurfaceContext.Provider value={SHEET_SELECT_SURFACE}>
    <div className='odc-ofs-body'>{children}</div>
  </SelectSurfaceContext.Provider>
)

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/** A group of fields under a visible heading (C7). */
const FieldGroup = ({ title, children }) => {
  const titleId = useId()
  return (
    <section className='odc-ofs-group' aria-labelledby={titleId}>
      <h3 id={titleId} className='odc-ofs-group-title'>{title}</h3>
      {children}
    </section>
  )
}

/** A native text field with its own visible label, never only a placeholder. */
const TextField = ({ label, value, onChange, onKeyDown, inputMode, name, type = 'text', className }) => {
  const id = useId()
  return (
    <div className={className ? `odc-ofs-field ${className}` : 'odc-ofs-field'}>
      <label htmlFor={id} className='odc-ofs-label'>{label}</label>
      <input
        id={id}
        type={type}
        name={name}
        className='odc-ofs-input'
        autoComplete='off'
        value={value || ''}
        inputMode={inputMode}
        onKeyDown={onKeyDown}
        onChange={onChange}
      />
    </div>
  )
}

/**
 * A field whose control is one of the existing selectors (a dropdown, not a native
 * input): a named group, labelled by the visible text. `field` lets the pills of the
 * filter bar send the focus here.
 */
const PickerField = ({ label, field, children }) => {
  const labelId = useId()
  return (
    <div className='odc-ofs-field' role='group' aria-labelledby={labelId} data-orders-filter-field={field}>
      <span id={labelId} className='odc-ofs-label'>{label}</span>
      {/* redesign F6i-2 (A3-02): the select inside names its trigger with this visible label followed by its value. */}
      <SelectFieldLabelContext.Provider value={labelId}>
        {children}
      </SelectFieldLabelContext.Provider>
    </div>
  )
}

/**
 * Text of a picker that never wraps: it truncates and carries its full text as `title`.
 * Without `title` it is the empty-state placeholder (a short «Any», muted).
 */
const PickerText = ({ children, title }) => (
  <span
    className={title ? 'odc-ofs-text' : 'odc-ofs-text odc-ofs-placeholder'}
    title={title}
  >
    {children}
  </span>
)

// redesign F6c-2 (Q2-16): the API catalog may write a word in lower case («assigned»); the options of the sheet all
// start with a capital.
const sentenceCase = (text) => {
  const value = String(text ?? '')
  return value ? value.charAt(0).toLocaleUpperCase() + value.slice(1) : value
}

const OrdersFilterGroupUI = (props) => {
  const {
    filterModalOpen,
    setFilterModalOpen,
    initialFocusField,
    filterValues,
    driverGroupList,
    paymethodsList,
    businessesList,
    citiesList,
    adminsList,
    handleChangeDateType,
    handleChangeFromDate,
    handleChangeEndDate,
    handleChangeBusinesses,
    handleChangeCity,
    handleChangeDeliveryType,
    handleChangePaymethodType,
    handleResetFilterValues,
    handleChangeFilterValues,
    handleChangeOrderId,
    handleOrderIdKeyDown,
    handleChangeCountryCode,
    handleChangeCurrency,
    handleChangeMetaFieldValue,
    handleAddMetaField,
    handleChangeAdmin,
    handleDeleteMetafield,
    handleChangeChildFilterValue,
    handleFilterValues,
    handleChangeOfferId,
    handleChangeGroupUnassigned
  } = props

  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [metafield, setMetaField] = useState({ key: '', value: '' })
  const [isShow, setIsShow] = useState(false)
  const [forterPluginInstalled, setForterPluginInstalled] = useState(false)
  const metafieldRef = useRef()
  // redesign 5.6-B: under 768px of viewport the sheet rises from the bottom (C8); the same sheet, side `end`, above.
  const isPhone = useIsPhone()

  const logisticStatusOption = (value, text) => {
    const label = sentenceCase(text)
    return {
      value,
      content: (
        <Option>
          <PickerText title={label}>{label}</PickerText>
          <LogisticStatusDot className='odc-ofs-dot' status={value} />
        </Option>
      )
    }
  }

  const textOption = (value, text) => {
    const label = sentenceCase(text)
    return {
      value,
      content: <Option><PickerText title={label}>{label}</PickerText></Option>
    }
  }

  // An empty picker says «Any» (the label above already names the field).
  const anyPlaceholder = <PickerText>{t('ANY', 'Any')}</PickerText>
  // redesign F6c-2 (Q2-16): a single choice can go back to no filter. «Any» is the first row; chosen, it reads like
  // the empty picker (muted) and sends `null`, what the chip's X and Clear leave.
  const anyOption = {
    value: '',
    content: <Option><PickerText title={t('ANY', 'Any')}>{t('ANY', 'Any')}</PickerText></Option>,
    showOnSelected: <Option>{anyPlaceholder}</Option>
  }
  const orAny = (onChange) => (value) => onChange(value === '' ? null : value)

  const logisticStatusList = [
    anyOption,
    logisticStatusOption(0, t('PENDING', 'Pending')),
    logisticStatusOption(1, t('IN_PROGRESS', 'In progress')),
    logisticStatusOption(2, t('IN_QUEUE', 'In queue')),
    logisticStatusOption(3, t('EXPIRED', 'Expired')),
    logisticStatusOption(4, t('RESOLVED', 'Resolved'))
  ]

  const assignedFilterOptions = [
    anyOption,
    textOption(0, t('ASSIGNED', 'Assigned')),
    textOption(1, t('UNASSIGNED', 'Unassigned'))
  ]

  const fraudStatusOptions = [
    anyOption,
    textOption('invalid', t('FRAUD_DECLINED', 'Declined')),
    textOption('error', t('FRAUD_FAIL_OPEN', 'Fail-open'))
  ]

  useEffect(() => {
    if (!token || !ordering?.root) return
    // redesign W0 close: no state update after unmount (the request still goes out once, as before)
    let active = true
    const checkForterPlugin = async () => {
      try {
        const response = await fetch(`${ordering.root}/plugins/key/braintree`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        })
        const { error, result } = await response.json()
        if (active) setForterPluginInstalled(!error && !!result)
      } catch {
        if (active) setForterPluginInstalled(false)
      }
    }
    checkForterPlugin()
    return () => { active = false }
  }, [token, ordering])

  const handleAcceptFilter = () => {
    handleChangeFilterValues(filterValues)
    handleFilterValues(filterValues)
    setFilterModalOpen(false)
  }

  const handleClearFilter = () => {
    handleResetFilterValues()
    handleChangeFilterValues({})
  }

  const handleAddMetafieldValue = () => {
    handleAddMetaField({
      id: getUniqueId(),
      key: metafield?.key,
      value: metafield?.value
    })
    setMetaField({ key: '', value: '' })
    setIsShow(false)
  }

  const handleDeleteMetafieldValue = (id) => {
    handleDeleteMetafield(id)
  }

  const handleClickOutside = (e) => {
    if (!isShow) return
    const outsideCalendar = !metafieldRef.current?.contains(e.target)
    if (outsideCalendar) {
      setIsShow(false)
    }
  }

  useEffect(() => {
    window.addEventListener('mouseup', handleClickOutside)
    return () => window.removeEventListener('mouseup', handleClickOutside)
  }, [isShow])

  // The Date and Business pills open the sheet on their own field.
  const focusRequestedField = () => {
    if (!initialFocusField) return undefined
    const field = document.querySelector(`[data-orders-filter-field="${initialFocusField}"]`)
    return field?.querySelector(FOCUSABLE) || undefined
  }

  const fields = {
    metaName: t('METAFIELD_NAME', 'Metafield name'),
    metaValue: t('METAFIELD_VALUE', 'Metafield value')
  }

  return (
    <Sheet
      open={!!filterModalOpen}
      onOpenChange={(open) => setFilterModalOpen && setFilterModalOpen(open)}
      title={t('FILTERS', 'Filters')}
      closeLabel={t('CLOSE', 'Close')}
      side={isPhone ? 'bottom' : 'end'}
      initialFocus={initialFocusField ? focusRequestedField : undefined}
      className='odc-ofs-sheet'
      footer={(
        <>
          <Button onClick={() => handleClearFilter()}>{t('CLEAR', 'Clear')}</Button>
          <Button variant='primary' onClick={() => handleAcceptFilter()}>{t('APPLY', 'Apply')}</Button>
        </>
      )}
    >
      <SheetBody>
        <FieldGroup title={t('ORDER', 'Order')}>
          <div className='odc-ofs-row'>
            {/* (main #493): the order ID takes digits only (letters and symbols are not typed) */}
            <TextField
              label={t('ORDER_ID', 'Order ID')}
              value={filterValues?.orderId}
              inputMode='numeric'
              onKeyDown={handleOrderIdKeyDown}
              onChange={(e) => handleChangeOrderId(e)}
            />
            <PickerField label={t('DATE', 'Date')} field='date'>
              <DateTypeSelector
                filterValues={filterValues}
                handleChangeDateType={handleChangeDateType}
                handleChangeFromDate={handleChangeFromDate}
                handleChangeEndDate={handleChangeEndDate}
              />
            </PickerField>
          </div>
          <PickerField label={t('DELIVERY_TYPE', 'Delivery type')} field='deliveryType'>
            <DeliveryTypeSelector
              filterValues={filterValues}
              handleChangeDeliveryType={handleChangeDeliveryType}
            />
          </PickerField>
        </FieldGroup>

        <FieldGroup title={t('CUSTOMER', 'Customer')}>
          <div className='odc-ofs-row'>
            <TextField
              label={t('CUSTOMER_NAME', 'Customer name')}
              value={filterValues?.customerName}
              onChange={(e) => handleChangeChildFilterValue({ customerName: e?.target?.value })}
            />
            <TextField
              label={t('CUSTOMER_LASTNAME', 'Customer last name')}
              value={filterValues?.customerLastname}
              onChange={(e) => handleChangeChildFilterValue({ customerLastname: e?.target?.value })}
            />
          </div>
          <div className='odc-ofs-row'>
            <TextField
              label={t('CUSTOMER_EMAIL', 'Customer email')}
              value={filterValues?.customerEmail}
              onChange={(e) => handleChangeChildFilterValue({ customerEmail: e?.target?.value })}
            />
            <TextField
              label={t('CUSTOMER_CELLPHONE', 'Customer cellphone')}
              value={filterValues?.customerCellphone}
              onChange={(e) => handleChangeChildFilterValue({ customerCellphone: e?.target?.value })}
            />
          </div>
        </FieldGroup>

        <FieldGroup title={t('LOCATION', 'Location')}>
          <PickerField label={t('BUSINESS', 'Business')} field='business'>
            <BusinessesSelector
              filterValues={filterValues}
              businessesList={businessesList}
              handleChangeBusinesses={handleChangeBusinesses}
            />
          </PickerField>
          <div className='odc-ofs-row'>
            <PickerField label={t('COUNTRY', 'Country')} field='country'>
              <CountryFilter
                filterValues={filterValues}
                handleChangeCountryCode={handleChangeCountryCode}
              />
            </PickerField>
            <PickerField label={t('CITY', 'City')} field='city'>
              <CitySelector
                cities={citiesList}
                filterValues={filterValues}
                handleChangeCity={handleChangeCity}
              />
            </PickerField>
          </div>
          <PickerField label={t('CURRENCY', 'Currency')} field='currency'>
            <CurrencyFilter
              filterValues={filterValues}
              handleChangeCurrency={handleChangeCurrency}
            />
          </PickerField>
        </FieldGroup>

        <FieldGroup title={t('LOGISTICS', 'Logistics')}>
          <PickerField label={t('DRIVER_GROUP_ASSIGNED', 'Driver group (assigned)')} field='driverGroup'>
            <DriversGroupTypeSelector
              driverGroupList={driverGroupList}
              handleChangeGroup={handleChangeGroupUnassigned}
              filterValues={filterValues.groupTypesUnassigned}
              title={t('ANY', 'Any')}
            />
          </PickerField>
          <div className='odc-ofs-row'>
            <PickerField label={t('ORDERS_FILTER_DRIVER_STATUS', 'Driver status')} field='assigned'>
              <Select
                options={assignedFilterOptions}
                className='select odc-ofs-select-single'
                defaultValue={filterValues?.assigned ?? ''}
                placeholder={anyPlaceholder}
                ariaLabel={t('ORDERS_FILTER_DRIVER_STATUS', 'Driver status')}
                onChange={orAny((value) => handleChangeChildFilterValue({ assigned: value }))}
              />
            </PickerField>
            <PickerField label={t('ORDERS_FILTER_LOGISTIC_STATUS', 'Logistic status')} field='logisticStatus'>
              <Select
                options={logisticStatusList}
                className='select odc-ofs-select-single'
                defaultValue={filterValues?.logisticStatus ?? ''}
                placeholder={anyPlaceholder}
                ariaLabel={t('ORDERS_FILTER_LOGISTIC_STATUS', 'Logistic status')}
                onChange={orAny((value) => handleChangeChildFilterValue({ logisticStatus: value }))}
              />
            </PickerField>
          </div>
        </FieldGroup>

        <FieldGroup title={t('FILTER_GROUP_PAYMENT_MARKETING', 'Payment and marketing')}>
          <PickerField label={t('PAYMENT_METHOD', 'Payment method')} field='paymethod'>
            <PaymethodTypeSelector
              paymethodsList={paymethodsList}
              filterValues={filterValues}
              handleChangePaymethodType={handleChangePaymethodType}
            />
          </PickerField>
          <div className='odc-ofs-row'>
            <TextField
              label={t('COUPON', 'Coupon')}
              value={filterValues?.coupon}
              onChange={(e) => handleChangeChildFilterValue({ coupon: e?.target?.value })}
            />
            <TextField
              label={t('OFFER_ID', 'Offer ID')}
              value={filterValues?.offerId}
              onChange={(e) => handleChangeOfferId(e)}
            />
          </div>
          <PickerField label={t('ADMINISTRATOR', 'Administrator')} field='administrator'>
            <AdminsSelector
              filterValues={filterValues}
              adminsList={adminsList}
              handleChangeAdmin={handleChangeAdmin}
            />
          </PickerField>
          {forterPluginInstalled && (
            <PickerField label={t('FRAUD_STATUS', 'Fraud status')} field='fraudStatus'>
              <Select
                options={fraudStatusOptions}
                className='select odc-ofs-select-single'
                defaultValue={filterValues?.fraudStatus ?? ''}
                placeholder={anyPlaceholder}
                ariaLabel={t('FRAUD_STATUS', 'Fraud status')}
                onChange={orAny((value) => handleChangeChildFilterValue({ fraudStatus: value }))}
              />
            </PickerField>
          )}
        </FieldGroup>

        <FieldGroup title={t('METAFIELDS', 'Metafields')}>
          {filterValues?.metafield.map(item => (
            <div className='odc-ofs-row odc-ofs-meta' key={item.id}>
              <TextField
                label={fields.metaName}
                name='key'
                value={item.key}
                onChange={(e) => handleChangeMetaFieldValue(e, item.id)}
              />
              {item?.key && (
                <div className='odc-ofs-meta-value'>
                  <TextField
                    label={fields.metaValue}
                    name='value'
                    value={item?.value}
                    onChange={(e) => handleChangeMetaFieldValue(e, item.id)}
                  />
                  <IconButton
                    icon={Trash2}
                    label={t('DELETE', 'Delete')}
                    onClick={() => handleDeleteMetafieldValue(item.id)}
                  />
                </div>
              )}
            </div>
          ))}
          {!isShow && (
            <div>
              <Button variant='link' onClick={() => setIsShow(true)}>{t('ADD_METAFIELD', 'Add a metafield')}</Button>
            </div>
          )}
          {isShow && (
            <div className='odc-ofs-row odc-ofs-meta' ref={metafieldRef}>
              <TextField
                label={fields.metaName}
                name='key'
                value={metafield.key}
                onChange={(e) => setMetaField({ ...metafield, key: e.target.value })}
              />
              {metafield?.key && (
                <div className='odc-ofs-meta-value'>
                  <TextField
                    label={fields.metaValue}
                    name='value'
                    value={metafield.value}
                    onChange={(e) => setMetaField({ ...metafield, value: e.target.value })}
                  />
                  <IconButton
                    icon={CirclePlus}
                    label={t('ADD', 'Add')}
                    onClick={handleAddMetafieldValue}
                  />
                </div>
              )}
            </div>
          )}
        </FieldGroup>
      </SheetBody>
    </Sheet>
  )
}

/**
 * The filters sheet (C7, C8). The trigger, the «Filters applied» notice and the clear
 * link live in OrdersFilterBar; this draws only the sheet, opened by `filterModalOpen`.
 * `initialFocusField` ('date', 'business', ...) is the field that gets the focus.
 */
export const OrdersFilterGroup = (props) => {
  const [filterValues, { handleFilterValues }] = useFilterValues()
  const [savedFilterValues, setSavedFilterValues] = useState(filterValues)

  useEffect(() => {
    setSavedFilterValues(filterValues)
  }, [filterValues])

  const FilterControlProps = {
    ...props,
    UIComponent: OrdersFilterGroupUI,
    driverGroupList: props.driverGroupList,
    filterValues: savedFilterValues,
    setFilterValues: setSavedFilterValues,
    handleFilterValues
  }
  return (
    <>
      <OrdersFilterController {...FilterControlProps} />
    </>
  )
}
