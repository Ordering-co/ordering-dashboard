import React, { useEffect, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { Button, Checkbox, Input } from '../../../styles'
import { Select } from '../../../styles/Select/FirstSelect'
import { RecordCircleFill, Circle, ChevronRight } from 'react-bootstrap-icons'
import { useForm } from 'react-hook-form'
import { Alert, SideBar, Modal, RecipientSelect } from '../../Shared'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { EnterprisePromotionConditions } from '../EnterprisePromotionConditions'

import {
  RulesContainer,
  FormInput,
  FormInnerContainer,
  SectionTitle,
  CouponContainer,
  CouponHeader,
  CouponContent,
  CouponCodeContainer,
  DiscountOption,
  CondtionItem,
  Option,
  SelectWrapper,
  DiscountContainer,
  AutomaticEnableWrapper,
  PublicEnableWrapper
} from './styles'

export const EnterprisePromotionRules = (props) => {
  const {
    isAddMode,
    promotionState,
    formState,
    actionState,
    handleChangeInput,
    handleChangeItem,
    handleAddPromotion,
    handleUpdateClick,
    setMoveDistance,
    setSideBarWidth,
    isExpand
  } = props

  const [, t] = useLanguage()
  const { width } = useWindowSize()
  const formMethods = useForm()

  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [isShowConditions, setIsShowConditions] = useState(false)

  const conditionTypes = [
    { value: 1, content: <Option>{t('SUBTOTAL', 'Subtotal')}</Option> },
    { value: 2, content: <Option>{t('PRODUCTS', 'Products')}</Option> },
    { value: 3, content: <Option>{t('CATEGORIES', 'Categories')}</Option> }
  ]

  const promotionTypes = [
    { value: 1, content: <Option>{t('MOBILE_FRONT_SUB_TOTAL', 'Subtotal')}</Option>, enabled: true },
    {
      value: 2,
      content: <Option>{t('DELIVERY_FEE', 'Delivery fee')}</Option>,
      enabled: (typeof formState.changes?.condition_type !== 'undefined'
        ? formState.changes?.condition_type
        : promotionState.promotion?.condition_type) === 1
    },
    {
      value: 3,
      content: <Option>{t('BUSINESS_SERVICE_FEE', 'Service fee')}</Option>,
      enabled: (typeof formState.changes?.condition_type !== 'undefined'
        ? formState.changes?.condition_type
        : promotionState.promotion?.condition_type) === 1
    }
  ]

  const discountTypes = [
    {
      value: 1,
      content: <Option>{t('PERCENTAGE', 'Percentage')}</Option>,
      enabled: (typeof formState.changes?.condition_type !== 'undefined'
        ? formState.changes?.condition_type
        : promotionState.promotion?.condition_type) === 1
    },
    { value: 2, content: <Option>{t('PRICE', 'Price')}</Option>, enabled: true }
  ]

  const onSubmit = () => {
    if (Object.keys(formState.changes).length > 0) {
      if (isAddMode) {
        handleAddPromotion()
      } else {
        handleUpdateClick()
      }
    }
  }

  const hanndleClickApply = () => {
    if (width > 1300) {
      setSideBarWidth(isExpand ? width : 1300)
      setMoveDistance(700)
    }
    setIsShowConditions(true)
  }

  const handleMaxPercentValidate = () => {
    const rateType = formState.changes?.rate_type ?? promotionState.promotion?.rate_type
    if (rateType !== 1) return true
    const rate = formState.changes?.rate ?? promotionState?.promotion?.rate ?? ''
    if (parseFloat(rate) <= 100) {
      return true
    } else {
      return t('VALIDATION_ERROR_MAX_NUMERIC', 'The _attribute_ may not be greater than _max_.')
        .replace('_attribute_', t('PERCENTAGE', 'Percentage'))
        .replace('_max_', 100)
    }
  }

  const handleMinAmountValidate = (value) => {
    if (value < 1) {
      return t('VALIDATION_ERROR_MIN_NUMERIC', 'The _attribute_ may not be less than _min_.')
        .replace('_attribute_', t('MINIMUM_AMOUNT', 'Minimum amount'))
        .replace('_min_', 1)
    }
  }

  useEffect(() => {
    if (Object.keys(formMethods.errors).length > 0) {
      const content = Object.values(formMethods.errors).map(error => error.message)
      setAlertState({
        open: true,
        content
      })
    }
  }, [formMethods.errors])

  useEffect(() => {
    if (width < 1300) {
      setMoveDistance(0)
    } else {
      if (isShowConditions) {
        setMoveDistance(700)
      }
    }
  }, [width])

  useEffect(() => {
    const rate = formState.changes?.rate ?? promotionState?.promotion?.rate ?? ''
    formMethods.setValue('rate', rate)
  }, [formState.changes?.rate, promotionState?.promotion?.rate])

  useEffect(() => {
    if ((typeof formState.changes?.condition_type !== 'undefined'
      ? formState.changes?.condition_type
      : promotionState.promotion?.condition_type) !== 1) {
      handleChangeItem({ rate_type: 2, target: 1 })
    }
  }, [formState.changes?.condition_type])

  return (
    <RulesContainer>
      <FormInput onSubmit={formMethods.handleSubmit(onSubmit)}>
        <FormInnerContainer>
          <DiscountContainer>
            <div>
              <label>{t('CONDITION_TYPE', 'Condition type')}</label>
              <Select
                defaultValue={
                  typeof formState.changes?.condition_type !== 'undefined'
                    ? formState.changes?.condition_type
                    : promotionState.promotion?.condition_type
                }
                options={conditionTypes}
                onChange={val => handleChangeItem({ condition_type: val })}
              />
            </div>
            {(typeof formState.changes?.condition_type !== 'undefined'
              ? formState.changes?.condition_type
              : promotionState.promotion?.condition_type) !== 1 && (
              <div>
                <label>{t('MINIMUM_PRODUCTS', 'Minimum products')}</label>
                <Input
                  name='minimum'
                  id='minimum_amount'
                  placeholder={0}
                  defaultValue={formState.changes?.minimum ?? promotionState?.promotion?.minimum ?? ''}
                  onChange={handleChangeInput}
                  onKeyPress={(e) => {
                    if (!/^[0-9.]$/.test(e.key)) {
                      e.preventDefault()
                    }
                  }}
                  ref={formMethods.register({
                    required: t('VALIDATION_ERROR_REQUIRED', 'The _attribute_ field is required.').replace('_attribute_', t('MINIMUM_AMOUNT', 'Minimum amount')),
                    validate: handleMinAmountValidate
                  })}
                  autoComplete='off'
                  type='number'
                />
              </div>
            )}
          </DiscountContainer>
          {(typeof formState.changes?.condition_type !== 'undefined'
            ? formState.changes?.condition_type
            : promotionState.promotion?.condition_type) === 1 && (
            <>
              <SectionTitle>{t('PROMOTION_TYPES', 'Promotion types')}</SectionTitle>
              <SelectWrapper>
                <Select
                  defaultValue={
                    (typeof formState.changes?.condition_type !== 'undefined'
                      ? formState.changes?.condition_type
                      : promotionState.promotion?.condition_type) !== 1
                      ? 1
                      : typeof formState.changes?.target !== 'undefined'
                        ? formState.changes?.target
                        : promotionState.promotion?.target
                  }
                  options={promotionTypes.filter(promotionType => promotionType.enabled)}
                  onChange={val => handleChangeItem({ target: val })}
                />
              </SelectWrapper>
            </>
          )}
          <DiscountContainer>
            {(typeof formState.changes?.condition_type !== 'undefined'
              ? formState.changes?.condition_type
              : promotionState.promotion?.condition_type) === 1 && (
              <div>
                <label>{t('DISCOUNT_TYPE', 'Discount type')}</label>
                <Select
                  defaultValue={formState.changes?.rate_type ?? promotionState.promotion?.rate_type}
                  options={discountTypes.filter(discountType => discountType.enabled)}
                  onChange={val => handleChangeItem({ rate_type: val })}
                />
              </div>
            )}
            <div>
              <label>{(typeof formState.changes?.condition_type !== 'undefined'
                ? formState.changes?.condition_type
                : promotionState.promotion?.condition_type) === 1
                ? t('VALUE', 'Value')
                : t('FREE_PRODUCTS', 'Free products')}</label>
              <Input
                name='rate'
                id='discount_value'
                placeholder={0}
                onChange={handleChangeInput}
                onKeyPress={(e) => {
                  if (!/^[0-9.]$/.test(e.key)) {
                    e.preventDefault()
                  }
                }}
                ref={formMethods.register({
                  required: t('VALIDATION_ERROR_REQUIRED', 'The _attribute_ field is required.').replace('_attribute_', t('RATE', 'Rate')),
                  validate: handleMaxPercentValidate
                })}
                autoComplete='off'
              />
            </div>
          </DiscountContainer>

          <SectionTitle>{t('QUESTION_HOW_GOING_APPLIED', 'How it\'s going to be applied?')}</SectionTitle>
          <CouponContainer>
            <CouponHeader
              active={(formState.changes?.type === 2 || (!formState?.changes.type && promotionState?.promotion?.type === 2))}
              onClick={() => handleChangeItem({ type: 2 })}
            >
              {(formState.changes?.type === 2 || (!formState?.changes.type && promotionState?.promotion?.type === 2))
                ? (
                <RecordCircleFill />
                  )
                : (
                <Circle />
                  )}
              <span>{t('COUPON', 'Coupon')}</span>
            </CouponHeader>
            {(formState.changes?.type === 2 || (!formState?.changes.type && promotionState?.promotion?.type === 2)) && (
              <CouponContent>
                <CouponCodeContainer>
                  <label>{t('COUPON_CODE', 'Coupon code')}</label>
                  <Input
                    name='coupon'
                    value={formState.changes?.coupon ?? promotionState?.promotion?.coupon ?? ''}
                    onChange={e => handleChangeItem({ coupon: e.target.value.replace(/\s+/g, '') })}
                  />
                </CouponCodeContainer>
              </CouponContent>
            )}
          </CouponContainer>
          <DiscountOption>
            <CouponHeader
              active={(formState.changes?.type === 1 || (!formState?.changes.type && promotionState?.promotion?.type === 1))}
              onClick={() => handleChangeItem({ type: 1 })}
            >
              {(formState.changes?.type === 1 || (!formState?.changes.type && promotionState?.promotion?.type === 1))
                ? (
                <RecordCircleFill />
                  )
                : (
                <Circle />
                  )}
              <span>{t('DISCOUNT', 'discount')}</span>
            </CouponHeader>
          </DiscountOption>
          <AutomaticEnableWrapper>
            <Checkbox
              checked={
                typeof formState.changes?.auto !== 'undefined'
                  ? formState.changes?.auto
                  : promotionState.promotion?.auto
              }
              onChange={e => handleChangeItem({ auto: e.target.checked })}
            />
            <span>{t('AUTOMATIC_OFFER', 'Automatic offer')}</span>
          </AutomaticEnableWrapper>
          <PublicEnableWrapper>
            <Checkbox
              checked={
                typeof formState.changes?.public !== 'undefined'
                  ? formState.changes?.public
                  : promotionState.promotion?.public
              }
              onChange={e => handleChangeItem({ public: e.target.checked })}
            />
            <div>
              <p>{t('PUBLIC', 'Public')}</p>
              <p>{t('USERS_WILL_ABLE_TO_SEE', 'Users will be able to see it')}</p>
            </div>
          </PublicEnableWrapper>
          <RecipientSelect
            labelKey='SPONSOR'
            labelFallback='Sponsor'
            value={formState.changes?.sponsor ?? promotionState.promotion?.sponsor ?? 'business'}
            onChange={(val) => handleChangeItem({ sponsor: val })}
          />
          <SectionTitle>{t('CONDITIONS', 'Conditions')}</SectionTitle>
          <CondtionItem
            active={isShowConditions}
            onClick={() => hanndleClickApply()}
          >
            <div>
              {isShowConditions ? <RecordCircleFill /> : <Circle />}
              <span>{t('FRONT_VISUALS_APPLY', 'Apply')}</span>
            </div>
            <ChevronRight />
          </CondtionItem>
        </FormInnerContainer>
        <Button
          borderRadius='8px'
          color='primary'
          type='submit'
          disabled={Object.keys(formState.changes).length === 0 || actionState.loading}
        >
          {isAddMode ? t('ADD', 'Add') : t('SAVE', 'Save')}
        </Button>
      </FormInput>
      <Alert
        title={t('PROFILE', 'Profile')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => setAlertState({ open: false, content: [] })}
        onAccept={() => setAlertState({ open: false, content: [] })}
        closeOnBackdrop={false}
      />
      {width >= 1300
        ? (
            isShowConditions && (
              <SideBar
                isBorderShow
                sidebarId='promotion_conditions_details'
                defaultSideBarWidth='700'
                open={isShowConditions}
                onClose={() => {
                  setMoveDistance(0)
                  setSideBarWidth(isExpand ? width : 600)
                  setIsShowConditions(false)
                }}
              >
                <EnterprisePromotionConditions {...props} />
              </SideBar>
            ))
        : (
            isShowConditions
              ? <Modal
                  width='70%'
                  open={isShowConditions}
                  isTopPosition
                  onClose={() => {
                    setMoveDistance(0)
                    setSideBarWidth(isExpand ? width : 600)
                    setIsShowConditions(false)
                  }}
                >
                  <EnterprisePromotionConditions {...props} />
                </Modal>
              : null)}
    </RulesContainer>
  )
}
