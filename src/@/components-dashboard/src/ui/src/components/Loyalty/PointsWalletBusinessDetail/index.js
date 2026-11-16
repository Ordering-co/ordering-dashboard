import React, { useEffect, useRef, useState } from 'react'
import { useLanguage, useUtils, PointsWalletBusinessDetail as PointsWalletBusinessDetailController } from '../../../../../index'
import { useForm } from 'react-hook-form'
import { Alert } from '../../Shared'
import { Button, RadioGroup, Switch, TextField } from '../../Shared/Product'
import './points-wallet-business-detail.css'

// the wallet rules (general, or one store's) in Product pieces: P/TextField for the rates, the maximum and the days,
// P/Switch for «Maximum of points», P/RadioGroup for the expiration and a primary P/Button for Save. Same controller props,
// handlers, payloads, validations and alerts as main.

const decimalsOnly = (e) => {
  if (!/^[0-9.]$/.test(e.key)) e.preventDefault()
}

const digitsOnly = (e) => {
  if (!/^[0-9]$/.test(e.key)) e.preventDefault()
}

const PointsWalletBusinessDetailUI = (props) => {
  const {
    walletData,
    formState,
    handleChangeInput,
    handleClickSubmit,
    isBusiness,
    hideName,
    selectedBusinessList,
    handleChangeItem,
    formStateConfigs,
    onDirtyChange
  } = props

  const [, t] = useLanguage()
  const [{ parsePrice }] = useUtils()
  const { handleSubmit } = useForm()
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [expiration, setExpiration] = useState(null)
  const [isMaximum, setIsMaximum] = useState(false)
  const [maxValue, setMaxValue] = useState('')

  // a parent that guards leaving (the Settings hub) hears whether the form holds values that differ from the
  // saved ones; typing a value back to the saved one is clean. Without `onDirtyChange` nothing is reported.
  const changes = formState?.changes || {}
  const isDirty = Object.keys(changes).some(key => String(changes[key] ?? '') !== String(walletData?.[key] ?? ''))
  const onDirtyChangeRef = useRef(onDirtyChange)
  onDirtyChangeRef.current = onDirtyChange
  useEffect(() => {
    onDirtyChangeRef.current && onDirtyChangeRef.current(isDirty)
  }, [isDirty])
  useEffect(() => () => {
    onDirtyChangeRef.current && onDirtyChangeRef.current(false)
  }, [])

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  // The controller reads `evt.target.name` and `evt.target.value`, as it did from the legacy inputs. The input keeps its
  // `name` too: the Settings hub reads the change events that bubble up to the form's wrapper.
  const changeInput = name => value => handleChangeInput({ target: { name, value } })

  const handleChangeExpirtation = (index) => {
    if (index) {
      setExpiration(index)
      return
    }
    setExpiration(null)
    handleChangeItem({ expire_after_minutes: null })
    setMaxValue('')
  }

  const handleClickSwitch = (value) => {
    setIsMaximum(value)
    if (!value) handleChangeItem({ maximum_accumulation: null })
  }

  const handleChangeMaxValue = (value) => {
    setMaxValue(value)
    if (value) handleChangeItem({ expire_after_minutes: (value * 24 * 60) })
    else handleChangeItem({ expire_after_minutes: null })
  }

  const onSubmit = () => {
    if (!walletData) {
      const findBusiness = selectedBusinessList.find(business => business.wallet_enabled)
      if (!findBusiness) {
        setAlertState({ open: true, content: t('SELECT_LEAST_ONE_BUSINESS', 'Select at least one business.') })
        return
      }
    }
    if (Object.keys(formState?.changes).length > 0) {
      if (formState?.changes?.redemption_rate === '') {
        setAlertState({
          open: true,
          content: t(
            'VALIDATION_ERROR_REQUIRED',
            'Value is required'
          ).replace('_attribute_', 'redemption_rate')
        })
        return
      }
      if (formState?.changes?.accumulation_rate === '') {
        setAlertState({
          open: true,
          content: t(
            'VALIDATION_ERROR_REQUIRED',
            'Value is required'
          ).replace('_attribute_', 'accumulation_rate')
        })
        return
      }
      handleClickSubmit && handleClickSubmit()
      return
    }
    if (formStateConfigs?.changes?.length > 0) {
      handleClickSubmit && handleClickSubmit()
    }
  }

  useEffect(() => {
    if (!formState.error) return
    setAlertState({
      open: true,
      content: formState.error
    })
  }, [formState?.error])

  useEffect(() => {
    if (formState?.changes?.maximum_accumulation
      ? formState?.changes?.maximum_accumulation
      : walletData?.maximum_accumulation) {
      setIsMaximum(true)
    } else {
      setIsMaximum(false)
    }
  }, [walletData?.maximum_accumulation])

  useEffect(() => {
    if (walletData?.expire_after_minutes) {
      setMaxValue(walletData?.expire_after_minutes / (24 * 60))
      setExpiration('days')
    } else {
      setExpiration(null)
      setMaxValue('')
    }
  }, [walletData?.expire_after_minutes])

  const isCash = walletData?.type === 'cashback'
  // main: a key typed in the form wins even when emptied; else the saved value
  const valueOf = (key) => {
    const value = (typeof formState?.changes?.[key] !== 'undefined') ? formState?.changes?.[key] : walletData?.[key]
    return value == null ? '' : String(value)
  }

  return (
    <form className='pwbd' data-business={isBusiness ? '' : undefined} noValidate onSubmit={handleSubmit(onSubmit)}>
      {walletData?.name && !hideName && (
        <h2 className='pwbd-title'>{walletData?.name}</h2>
      )}

      <section className='pwbd-section'>
        {/* the cash wallet card spoke of points */}
        <h3>{isCash ? t('CASH_WALLET_REDEMPTION', 'Cash redemption') : t('POINTS_REDEMPTION', 'Points redemption')}</h3>
        <div className='pwbd-rate'>
          <TextField
            label={t('VALUE', 'Value')}
            name='redemption_rate'
            className='odc-figure'
            fieldClassName='pwbd-rate-field'
            inputMode='decimal'
            autoComplete='off'
            value={valueOf('redemption_rate')}
            onChange={changeInput('redemption_rate')}
            onKeyPress={decimalsOnly}
          />
          <span className='pwbd-rate-text'>= <span className='odc-figure'>{parsePrice(1)}</span></span>
        </div>
      </section>

      <section className='pwbd-section'>
        <h3>{isCash ? t('CASH_WALLET_ACCUMULATION', 'Cash accumulation') : t('POINTS_ACCUMULATION', 'Points accumulation')}</h3>
        {/* ST7: the cash wallet credits money; the points help stays on the points wallet. A new key: the live catalog owns the old one.
            api-core credits round(subtotal after discounts × accumulation_rate, 2), so the help says how much money one order earns. */}
        <p className='pwbd-help'>
          {isCash
            ? t('CASH_WALLET_ACCUMULATION_RATE_HELP', 'The order subtotal (after discounts) is multiplied by this number. Example: 0.05 credits _amount_ on a _subtotal_ order (5%).')
              .replace('_amount_', parsePrice(5))
              .replace('_subtotal_', parsePrice(100))
            : t('AMOUNT_POINTS_ASSIGN_TO_ORDER_SUBTOTAL', 'Amount of points to assign in relation to the order subtotal')}
        </p>
        <div className='pwbd-rate'>
          <span className='pwbd-rate-text'><span className='odc-figure'>{parsePrice(1)}</span> =</span>
          <TextField
            label={t('VALUE', 'Value')}
            name='accumulation_rate'
            className='odc-figure'
            fieldClassName='pwbd-rate-field'
            inputMode='decimal'
            autoComplete='off'
            placeholder={isCash ? t('CASH_WALLET_ACCUMULATION_PLACEHOLDER', 'e.g. 0.05') : t('POINTS_ACCUMULATION_PLACEHOLDER', '00 points')}
            value={valueOf('accumulation_rate')}
            onChange={changeInput('accumulation_rate')}
            onKeyPress={decimalsOnly}
          />
        </div>
        {isBusiness && (
          <>
            <Switch className='pwbd-switch' checked={isMaximum} onCheckedChange={handleClickSwitch}>
              {t('MAXIMUM_OF_POINTS', 'Maximum of points')}
            </Switch>
            {isMaximum && (
              <TextField
                aria-label={t('MAXIMUM_OF_POINTS', 'Maximum of points')}
                name='maximum_accumulation'
                className='odc-figure'
                fieldClassName='pwbd-field'
                inputMode='decimal'
                value={String(formState?.changes?.maximum_accumulation ?? walletData?.maximum_accumulation ?? '')}
                onChange={changeInput('maximum_accumulation')}
                onKeyPress={decimalsOnly}
              />
            )}
          </>
        )}
      </section>

      {isBusiness && (
        <section className='pwbd-section'>
          <RadioGroup
            label={t('EXPIRATION', 'Expiration')}
            options={[
              { value: 'no', label: t('NO', 'No') },
              { value: 'days', label: t('EXPIRATION_IN_DAYS', 'Expiration in days') }
            ]}
            value={expiration ? 'days' : 'no'}
            onValueChange={value => handleChangeExpirtation(value === 'days' ? 'days' : null)}
          />
          {expiration && (
            <TextField
              label={t('DAYS', 'Days')}
              name='expire_after_minutes'
              className='odc-figure'
              fieldClassName='pwbd-field'
              inputMode='numeric'
              value={String(maxValue)}
              onChange={handleChangeMaxValue}
              onKeyPress={digitsOnly}
            />
          )}
        </section>
      )}

      {/* Owner decision 26 B (2026-10-21, ): the four refund keys (refund_*_allow_when_order_cancelled) are edited only by their
          switch in the addon card of the hub (sticky bar and guard), the one home of docs/SETTINGS.md. main also drew them here as
          Yes/No selects that saved on their own. */}
      <div className='pwbd-foot'>
        <Button
          variant='primary'
          type='submit'
          busy={Boolean(formState?.loading)}
          disabled={Object.keys(formState?.changes).length === 0 && formStateConfigs?.changes?.length === 0}
        >
          {walletData ? t('SAVE', 'Save') : t('ADD', 'Add')}
        </Button>
      </div>
      <Alert
        title={t('POINTS_WALLET', 'Points wallet')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => closeAlert()}
        onAccept={() => closeAlert()}
        closeOnBackdrop={false}
      />
    </form>
  )
}

export const PointsWalletBusinessDetail = (props) => {
  const pointsWalletBusinessDetailProps = {
    ...props,
    UIComponent: PointsWalletBusinessDetailUI
  }
  return <PointsWalletBusinessDetailController {...pointsWalletBusinessDetailProps} />
}
