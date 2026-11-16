import React, { useEffect, useRef, useState } from 'react'
import { useLanguage, useConfig, useOrder, OrderTypeControl } from '../../../../../../index'
import { Option } from './styles'
import { InlineNotice } from '../../../Shared/Product'
import { SegmentedControl, SEGMENTED_MAX_OPTIONS } from '../../../Shared/Product/SegmentedControl'
import { translateApiMessage } from '../../../../../../utils/translateApiMessage' // redesign W0-2d (T0-7)
import '../steps.css'

const OrderTypeSelectorUI = (props) => {
  const {
    typeSelected,
    defaultValue,
    orderTypes,
    pendingType,
    onTypeSettled,
    failure,
    handleChangeOrderType
  } = props

  const [, t] = useLanguage()
  const [configState] = useConfig()

  const configTypes = configState?.configs?.order_types_allowed?.value.split('|').map(value => Number(value)) || []
  const allowedTypes = configTypes.length > 0
    ? orderTypes.filter(type => configTypes.includes(type.value))
    : orderTypes
  // redesign F6c (Q2-19): a label, not a question.
  const label = t('DELIVERY_TYPE', 'Delivery type')
  // The type the order really has, or the one just pressed while the options save. If the project does not
  // allow it, nothing is pressed (and every type, the first one too, can be chosen) instead of showing a type
  // the order does not carry.
  const current = pendingType || typeSelected || defaultValue
  // The order has the new type: what was pressed is no longer pending.
  useEffect(() => { onTypeSettled?.() }, [typeSelected])
  const value = allowedTypes.some(type => type.value === current) ? String(current) : ''
  const handleChange = (next) => handleChangeOrderType(Number(next))

  return (
    // redesign F6f (Q5-03): the wizard finds the control here to give it the focus when a retry of the type works.
    <div className='odc-steps' data-order-type=''>
      <h4 className='odc-steps-heading'>{label}</h4>
      {allowedTypes.length <= SEGMENTED_MAX_OPTIONS
        ? (
          <SegmentedControl
            label={label}
            value={value}
            onValueChange={handleChange}
            options={allowedTypes.map(type => ({ value: String(type.value), label: type.name }))}
          />
          )
        : (
          <select
            className='odc-steps-select'
            aria-label={label}
            value={value}
            onChange={event => handleChange(event.target.value)}
          >
            {!value && <option value='' disabled>{t('SELECT_DELIVERY_TYPE', 'Select delivery type')}</option>}
            {allowedTypes.map(type => (
              <option key={type.value} value={String(type.value)}>{type.name}</option>
            ))}
          </select>
          )}
      {/* redesign F6d (Q3-12): the refusal is written here, under the control, when no host takes it. */}
      {failure && <InlineNotice tone='danger' role='alert'>{failure}</InlineNotice>}
    </div>
  )
}

// `content` is what the legacy select drew for each type; the segmented control and the select of the step use `name`.
export const OrderTypeSelector = (props) => {
  const { onFailure } = props
  const [, t] = useLanguage()
  const [, { changeType }] = useOrder()
  const [pendingType, setPendingType] = useState(null)
  const [failure, setFailure] = useState(null)

  // Tells the refusal: to the host when it has a place for it (the wizard's notice), else under the control.
  // The host also gets the way to ask for the same type again, which its «Try again» uses (redesign F6e, P5-01).
  const tellFailure = (text, retry) => {
    if (onFailure) onFailure(text, retry)
    else setFailure(text)
  }

  // redesign F6d (P4-03): the global Alert of main translated every message by its slug (INTERNAL_ERROR, an API key);
  // the quiet failure goes through the same translation. With a host the notice has its own «Try again» action, so
  // the sentence does not say it again (redesign F6e, P5-01).
  const translate = (message) => translateApiMessage(
    t,
    message,
    onFailure
      ? t('CUSTOM_ORDER_TYPE_ERROR', 'The delivery type could not be changed.')
      : t('SOMETHING_WENT_WRONG_TRY_AGAIN', 'Something went wrong. Try again.')
  )

  // The retry runs the latest handler: the one of the render that failed may hold an older order.
  const latestChange = useRef(null)

  // redesign F6c (Q2-13): the change is asked for quietly (the global Alert is the legacy empty «Error» modal),
  // and a refusal is told with the text the API gave. redesign F6d (Q3-12): inline, not in a dialog centred on the
  // page that crossed the edge of the wizard and repeated the banner of the step.
  const handleChangeOrderType = async (type) => {
    setPendingType(type)
    setFailure(null)
    const result = await changeType(type, { silent: true })
    if (result?.ok === false) {
      setPendingType(null)
      tellFailure(translate(result.error), () => latestChange.current(type))
    } else {
      onFailure?.(null)
    }
  }
  latestChange.current = handleChangeOrderType

  const orderTypeProps = {
    ...props,
    UIComponent: OrderTypeSelectorUI,
    orderTypes: props.orderTypes || [
      {
        value: 1,
        name: t('DELIVERY', 'Delivery'),
        content: <Option>{t('DELIVERY', 'Delivery')}</Option>
      },
      {
        value: 2,
        name: t('PICKUP', 'Pickup'),
        content: <Option>{t('PICKUP', 'Pickup')}</Option>
      },
      {
        value: 3,
        name: t('EAT_IN', 'Eat in'),
        content: <Option>{t('EAT_IN', 'Eat in')}</Option>
      },
      {
        value: 4,
        name: t('CURBSIDE', 'Curbside'),
        content: <Option>{t('CURBSIDE', 'Curbside')}</Option>
      },
      {
        value: 5,
        name: t('DRIVE_THRU', 'Drive thru'),
        content: <Option>{t('DRIVE_THRU', 'Drive thru')}</Option>
      }
    ]
  }
  return (
    // The props of the quiet change come after the spread: the layer guard pins the `orderTypeProps` literal.
    <OrderTypeControl
      {...orderTypeProps}
      pendingType={pendingType}
      failure={failure}
      onTypeSettled={() => setPendingType(null)}
      handleChangeOrderType={props.handleChangeOrderType || handleChangeOrderType}
    />
  )
}
