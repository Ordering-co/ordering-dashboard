import React, { useEffect, useState } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import {
  useConfig,
  useLanguage,
  useToast,
  useUtils,
  ToastType,
  PayoutRules as PayoutRulesController
} from '../../../../../index'
import {
  PAYOUT_RULE_EXAMPLE_ORDER,
  getPayoutRuleExample,
  isSamePayoutRule,
  toPayoutRuleForm,
  validatePayoutRuleForm
} from '../../../../../components/PayoutRules/payoutRuleHelpers'
import { Alert, Confirm } from '../Confirm'
import { Button } from '../../../styles'
import { Select } from '../../../styles/Select'
import {
  RuleActions,
  RuleCard,
  RuleCardHeader,
  RuleCardHelp,
  RuleCardTitle,
  RuleExample,
  RuleExampleLine,
  RuleExampleTitle,
  RuleExampleTotal,
  RuleFieldError,
  RuleInputs,
  RuleNotice,
  RuleOption,
  RuleRow,
  RuleRowControl,
  RuleRowHelp,
  RuleRowNumber,
  RuleRowText,
  RuleRowTitle,
  RuleRows,
  RuleToggle,
  RuleToggleButton,
  RuleUnit
} from './styles'

const PayoutRuleFormUI = (props) => {
  const {
    scope,
    ownerId,
    ruleState,
    actionState,
    handleSaveRule,
    handleInheritRule
  } = props

  const [, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [{ parsePrice }] = useUtils()
  const [, { showToast }] = useToast()
  const [values, setValues] = useState(() => toPayoutRuleForm(scope, null))
  const [errors, setErrors] = useState({})
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [isOverriding, setIsOverriding] = useState(false)
  const [confirmInherit, setConfirmInherit] = useState(false)

  const isPlatform = scope === 'platform'
  // With an owner the form is its own rule: it follows the global one until it is given one ("Override")
  const isOwner = !!ownerId
  const isReadOnly = isOwner && !isOverriding
  const currencySymbol = configs?.format_number_currency?.value?.trim() || '$'
  const fixedUnit = t('PAYOUT_RULE_UNIT_FIXED', '_currency_ fixed per order').replace('_currency_', currencySymbol)
  const baseUnits = [
    { value: 'subtotal', content: <RuleOption>{t('PAYOUT_RULE_UNIT_SUBTOTAL', '% of product subtotal')}</RuleOption> },
    { value: 'total', content: <RuleOption>{t('PAYOUT_RULE_UNIT_TOTAL', '% of order total')}</RuleOption> }
  ]

  // The driver's amount per order is one number with its unit: the API keeps it as a type, a base and a field per type
  const isOrderPercentage = values.order_type === 'percentage'
  const perOrderField = isOrderPercentage ? 'order_percentage' : 'order_fixed'

  const handleChangeValue = (field, value) => {
    setValues(prev => ({ ...prev, [field]: value }))
    setErrors(prev => {
      if (!prev[field]) return prev
      const { [field]: _removed, ...rest } = prev
      return rest
    })
  }

  const handleChangePerOrderUnit = (unit) => {
    const nextField = unit === 'fixed' ? 'order_fixed' : 'order_percentage'
    setValues(prev => {
      const next = {
        ...prev,
        order_type: unit === 'fixed' ? 'fixed' : 'percentage',
        order_base: unit === 'fixed' ? prev.order_base : unit
      }
      if (nextField !== perOrderField) {
        // The number on screen follows its unit; the field left behind goes back to what is saved
        next[nextField] = prev[perOrderField]
        next[perOrderField] = toPayoutRuleForm(scope, ruleState.rule)[perOrderField]
      }
      return next
    })
    setErrors(prev => {
      const { order_fixed: _fixed, order_percentage: _percentage, ...rest } = prev
      return rest
    })
  }

  const rows = isPlatform
    ? [
        {
          key: 'fixed',
          field: 'fixed',
          title: t('PAYOUT_RULE_PART_FIXED', 'Fixed amount'),
          help: t('PAYOUT_RULE_PART_FIXED_HELP', 'Kept from every order.'),
          unitText: fixedUnit
        },
        {
          key: 'percentage',
          field: 'percentage',
          title: t('PAYOUT_RULE_PART_PERCENTAGE', 'Percentage'),
          help: t('PAYOUT_RULE_PART_PERCENTAGE_HELP', 'A share of the order.'),
          unit: { value: values.percentage_base, options: baseUnits, onChange: value => handleChangeValue('percentage_base', value) }
        }
      ]
    : [
        {
          key: 'order',
          field: perOrderField,
          title: t('PAYOUT_RULE_PART_ORDER', 'Per order'),
          help: t('PAYOUT_RULE_PART_ORDER_HELP', 'What the driver earns for the order itself.'),
          unit: {
            value: isOrderPercentage ? values.order_base : 'fixed',
            options: [{ value: 'fixed', content: <RuleOption>{fixedUnit}</RuleOption> }, ...baseUnits],
            onChange: handleChangePerOrderUnit
          }
        },
        {
          key: 'delivery_fee',
          field: 'delivery_fee_percentage',
          title: t('PAYOUT_RULE_PART_DELIVERY_FEE', 'Delivery fee'),
          help: t('PAYOUT_RULE_PART_DELIVERY_FEE_HELP', 'Share of the delivery fee the customer paid.'),
          unitText: t('PAYOUT_RULE_UNIT_DELIVERY_FEE', '% of the delivery fee')
        },
        {
          key: 'tip',
          field: 'tip_percentage',
          title: t('PAYOUT_RULE_PART_TIP', 'Tip'),
          help: t('PAYOUT_RULE_PART_TIP_HELP', 'Share of the customer\'s tip.'),
          unitText: t('PAYOUT_RULE_UNIT_TIP', '% of the tip')
        },
        {
          key: 'extra_fixed',
          field: 'additional_fixed',
          title: t('PAYOUT_RULE_PART_EXTRA_FIXED', 'Extra fixed amount'),
          help: t('PAYOUT_RULE_PART_EXTRA_HELP', 'Optional. Added to every delivery.'),
          unitText: fixedUnit
        },
        {
          key: 'extra_percentage',
          field: 'additional_percentage',
          title: t('PAYOUT_RULE_PART_EXTRA_PERCENTAGE', 'Extra percentage'),
          help: t('PAYOUT_RULE_PART_EXTRA_HELP', 'Optional. Added to every delivery.'),
          unit: { value: values.additional_base, options: baseUnits, onChange: value => handleChangeValue('additional_base', value) }
        }
      ]

  const errorCopy = {
    amount: t('PAYOUT_RULE_ERROR_AMOUNT', 'Enter an amount of 0 or more, with up to 2 decimals.'),
    percentage: t('PAYOUT_RULE_ERROR_PERCENTAGE', 'Enter a percentage from 0 to 100, with up to 2 decimals.')
  }

  const hasChanges = isOwner
    ? isOverriding && !isSamePayoutRule(scope, values, ruleState.override)
    : !isSamePayoutRule(scope, values, ruleState.rule)
  const example = getPayoutRuleExample(scope, values)
  const toPrice = (cents) => typeof cents === 'number' && !Number.isNaN(cents) ? parsePrice(cents / 100) : '—'

  const handleSubmit = async () => {
    const invalid = validatePayoutRuleForm(scope, values)
    setErrors(invalid)
    if (Object.keys(invalid).length) return
    const { error, result } = await handleSaveRule(values)
    if (error) {
      if (result?.length) setAlertState({ open: true, content: result })
      return
    }
    showToast(ToastType.Success, t('PAYOUT_RULE_SAVED', 'Payout rule saved'))
  }

  const handleChooseInherit = () => {
    if (!isOverriding) return
    if (ruleState.override) {
      setConfirmInherit(true)
      return
    }
    // Nothing was saved for this owner yet: back to what it follows
    setIsOverriding(false)
    setValues(toPayoutRuleForm(scope, ruleState.rule))
    setErrors({})
  }

  const handleAcceptInherit = async () => {
    setConfirmInherit(false)
    const { error, result } = await handleInheritRule()
    if (error) {
      if (result?.length) setAlertState({ open: true, content: result })
      return
    }
    showToast(ToastType.Success, t('PAYOUT_RULE_INHERITED', 'Now follows the global rule'))
  }

  useEffect(() => {
    if (ruleState.loading) return
    setValues(toPayoutRuleForm(scope, ruleState.rule))
    setErrors({})
    setIsOverriding(!!ruleState.override)
  }, [ruleState.loading, ruleState.rule, ruleState.override])

  return (
    <RuleCard>
      <RuleCardHeader>
        <RuleCardTitle>
          {isPlatform
            ? t('PAYOUT_RULE_PLATFORM_TITLE', 'Platform fee')
            : t('PAYOUT_RULE_DRIVER_TITLE', 'Driver payment')}
        </RuleCardTitle>
        <RuleCardHelp>
          {isOwner && (isPlatform
            ? t('PAYOUT_RULE_PLATFORM_OWNER_HELP', 'The platform keeps the sum of these two parts from each order of this store.')
            : t('PAYOUT_RULE_DRIVER_OWNER_HELP', 'This driver earns the sum of these five parts for each delivery.'))}
          {!isOwner && (isPlatform
            ? t('PAYOUT_RULE_PLATFORM_HELP', 'The platform keeps the sum of these two parts from each order. It applies to every restaurant without its own rule.')
            : t('PAYOUT_RULE_DRIVER_HELP', 'A driver earns the sum of these five parts for each delivery. It applies to every driver without their own rule.'))}
        </RuleCardHelp>
      </RuleCardHeader>

      {ruleState.loading && <Skeleton height={44} count={2} />}

      {!ruleState.loading && ruleState.error && (
        <RuleFieldError role='alert'>{ruleState.error.join(' ')}</RuleFieldError>
      )}

      {!ruleState.loading && !ruleState.error && (
        <>
          {isOwner && (
            <RuleToggle role='radiogroup' aria-label={t('PAYOUT_RULE_SOURCE', 'Rule to follow')}>
              <RuleToggleButton
                type='button'
                role='radio'
                aria-checked={!isOverriding}
                $active={!isOverriding}
                disabled={actionState.loading}
                onClick={handleChooseInherit}
              >
                {t('PAYOUT_RULE_INHERIT', 'Inherit global')}
              </RuleToggleButton>
              <RuleToggleButton
                type='button'
                role='radio'
                aria-checked={isOverriding}
                $active={isOverriding}
                disabled={actionState.loading}
                onClick={() => setIsOverriding(true)}
              >
                {t('PAYOUT_RULE_OVERRIDE', 'Override')}
              </RuleToggleButton>
            </RuleToggle>
          )}
          {!ruleState.rule && (
            <RuleNotice>
              {isOwner
                ? t('PAYOUT_RULE_NOT_SET_OWNER', 'No global rule is saved yet. Orders stay in review until one is saved or a rule is set here.')
                : t('PAYOUT_RULE_NOT_SET', 'No rule is saved yet. Orders stay in review until you save one.')}
            </RuleNotice>
          )}
          <RuleRows>
            {rows.map((row, i) => (
              <RuleRow key={row.key}>
                <RuleRowNumber aria-hidden='true'>{i + 1}</RuleRowNumber>
                <RuleRowText>
                  <RuleRowTitle>{row.title}</RuleRowTitle>
                  <RuleRowHelp>{row.help}</RuleRowHelp>
                </RuleRowText>
                <RuleRowControl>
                  <RuleInputs $invalid={!!errors[row.field]} $readOnly={isReadOnly}>
                    <input
                      type='text'
                      inputMode='decimal'
                      autoComplete='off'
                      className='form-control'
                      value={values[row.field] ?? ''}
                      aria-label={row.title}
                      aria-invalid={!!errors[row.field]}
                      disabled={isReadOnly}
                      onChange={e => handleChangeValue(row.field, e.target.value)}
                    />
                    {row.unit
                      ? (
                        <Select
                          defaultValue={row.unit.value}
                          options={row.unit.options}
                          onChange={row.unit.onChange}
                        />
                        )
                      : <RuleUnit>{row.unitText}</RuleUnit>}
                  </RuleInputs>
                  {errors[row.field] && <RuleFieldError role='alert'>{errorCopy[errors[row.field]]}</RuleFieldError>}
                </RuleRowControl>
              </RuleRow>
            ))}
          </RuleRows>

          <RuleExample>
            <RuleExampleTitle>{t('PAYOUT_RULE_EXAMPLE', 'Example')}</RuleExampleTitle>
            <RuleRowHelp>
              {t('PAYOUT_RULE_EXAMPLE_ORDER', 'Order with _products_ in products, _delivery_fee_ delivery fee and _tip_ tip. The customer pays _total_.')
                .replace('_products_', toPrice(PAYOUT_RULE_EXAMPLE_ORDER.subtotal))
                .replace('_delivery_fee_', toPrice(PAYOUT_RULE_EXAMPLE_ORDER.delivery_fee))
                .replace('_tip_', toPrice(PAYOUT_RULE_EXAMPLE_ORDER.tip))
                .replace('_total_', toPrice(PAYOUT_RULE_EXAMPLE_ORDER.total))}
            </RuleRowHelp>
            {rows.map((row, i) => (
              <RuleExampleLine key={row.key}>
                <span>{i + 1}. {row.title}</span>
                <span>{toPrice(example.parts[row.key])}</span>
              </RuleExampleLine>
            ))}
            <RuleExampleTotal>
              <span>
                {isPlatform
                  ? t('PAYOUT_RULE_EXAMPLE_PLATFORM_TOTAL', 'Platform keeps')
                  : t('PAYOUT_RULE_EXAMPLE_DRIVER_TOTAL', 'Driver receives')}
              </span>
              <strong data-testid={`payout-rule-${scope}-example-total`}>{toPrice(example.total)}</strong>
            </RuleExampleTotal>
          </RuleExample>

          {hasChanges && (
            <RuleActions>
              <Button color='primary' disabled={actionState.loading} onClick={handleSubmit}>
                {actionState.loading ? t('LOADING', 'Loading') : t('SAVE', 'Save')}
              </Button>
            </RuleActions>
          )}
        </>
      )}

      <Alert
        title={t('SETTINGS_SECTION_STRIPE_CONNECT', 'Stripe Connect')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => setAlertState({ open: false, content: [] })}
        onAccept={() => setAlertState({ open: false, content: [] })}
        closeOnBackdrop={false}
      />
      <Confirm
        width='700px'
        title={t('SETTINGS_SECTION_STRIPE_CONNECT', 'Stripe Connect')}
        content={t('PAYOUT_RULE_INHERIT_CONFIRM', 'Remove this rule? The global rule will apply to the orders placed from now on.')}
        acceptText={t('ACCEPT', 'Accept')}
        open={confirmInherit}
        onClose={() => setConfirmInherit(false)}
        onCancel={() => setConfirmInherit(false)}
        onAccept={handleAcceptInherit}
        closeOnBackdrop={false}
      />
    </RuleCard>
  )
}

export const PayoutRuleForm = (props) => (
  <PayoutRulesController
    {...props}
    UIComponent={PayoutRuleFormUI}
  />
)
