import React, { useState } from 'react'
import { useLanguage } from '../../../../../index'
import { Pencil, Check2 } from 'react-bootstrap-icons'
import { Button } from '../../../styles'
import { Modal } from '../../Shared'
import { EnterprisePromotionEditCondition } from '../EnterprisePromotionEditCondition'
import { EnterprisePromotionOrderTypes } from '../EnterprisePromotionOrderTypes'
import { EnterprisePromotionPaymethods } from '../EnterprisePromotionPaymethods'
import { EnterprisePromotionSchedule } from '../EnterprisePromotionSchedule'
import { EnterprisePromotionSpecficProducts } from '../EnterprisePromotionSpecficProducts'
import { EnterprisePromotionSpecficCategory } from '../EnterprisePromotionSpecficCategory'
import { EnterprisePromotionDeliveryzones } from '../EnterprisePromotionDeliveryzones'
import { EnterprisePromotionMaxOrders } from '../EnterprisePromotionMaxOrders'

import {
  ConditionsContainer,
  Header,
  ConditionItem,
  EditButton,
  CheckboxWrapper
} from './styles'

export const EnterprisePromotionConditions = (props) => {
  const {
    isAddMode,
    formState,
    actionState,
    promotionState,
    handleRemoveKey,
    handleUpdateClick,
    selectedBusinessIds,
    handleAddPromotion,
    handleChangeItem
  } = props

  const [, t] = useLanguage()
  const [openSingleModal, setOpenSingleModal] = useState(false)
  const [openMultipleModal, setOpenMultipleModal] = useState(null)
  const [selectedCondition, setSelectedCondition] = useState(null)
  const [selectedTitle, setSelectedTitle] = useState(null)

  const singleConditions = [
    'limit', 'limit_per_user', 'max_discount', 'minimum', 'valid_from_after_user_last_order_minutes', 'valid_until_after_user_last_order_minutes'
  ]

  const specifics = ['products', 'categories', 'delivery_zones']

  const handlePromotionEdit = (e, condition, title) => {
    const inValid = e.target.closest('.condition-checkbox')
    if (inValid) return
    setSelectedCondition(condition)
    setSelectedTitle(title)
    if (singleConditions.includes(condition)) {
      setOpenSingleModal(true)
    } else {
      setOpenMultipleModal(true)
    }
  }

  const conditions = [
    { id: 1, title: t('PRODUCTS_SPECIFIC', 'Product specific'), attribute: 'products', enabled: true },
    { id: 2, title: t('CATEGORIE_SPECIFIC', 'Categories specific'), attribute: 'categories', enabled: true },
    { id: 3, title: t('SCHEDULE_LIMIT', 'Schedule limit'), attribute: 'schedule', enabled: true },
    { id: 4, title: t('OFFER_MAX_AMOUNT_TIMES', 'Max. amount of times that can be used '), attribute: 'limit', enabled: true },
    { id: 5, title: t('OFFER_LIMIT_TIMES_PER_USER', 'Max. amount of times that can be used per user'), attribute: 'limit_per_user', enabled: true },
    { id: 6, title: t('OFFER_USER_ORDER_COUNT', 'Max. amount of orders in platform of user'), attribute: 'user_order_count', enabled: true },
    { id: 7, title: t('PAYMEN_METHODS_ALLOWED', 'Payment methods allowed'), attribute: 'paymethods', enabled: true },
    { id: 8, title: t('MAX_AMOUNT_TO_DISCOUNT', 'Maximum discount limit'), attribute: 'max_discount', enabled: true },
    { id: 9, title: t('DELIVERY_ZONE', 'Delivery zones'), attribute: 'delivery_zones', enabled: true },
    { id: 10, title: t('FRONT_MAIN_EMAIL_ORDER_TYPE', 'Order Type'), attribute: 'order_types_allowed', enabled: true },
    { id: 11, title: t('MINUTES_FROM_LAST_ORDER', 'Minutes from the last order'), attribute: 'valid_from_after_user_last_order_minutes', enabled: true },
    { id: 12, title: t('MINUTES_UNTIL_LAST_ORDER', 'Minutes until the last order'), attribute: 'valid_until_after_user_last_order_minutes', enabled: true },
    {
      id: 13,
      title: t('MINIMUN_PURCHASED', 'Minimum purchase'),
      attribute: 'minimum',
      enabled: (typeof formState.changes?.condition_type !== 'undefined'
        ? formState.changes?.condition_type
        : promotionState.promotion?.condition_type) === 1
    }
  ]

  const handleClickSave = () => {
    if (!isAddMode) handleUpdateClick()
    setOpenSingleModal(false)
    setOpenMultipleModal(false)
  }

  const handleCloseModal = () => {
    if (selectedCondition) {
      handleRemoveKey(selectedCondition)
    }
    setOpenSingleModal(false)
    setOpenMultipleModal(false)
  }

  const handleIncludeOptions = () => {
    const includeOptions = (typeof formState.changes.include_options !== 'undefined'
      ? formState.changes.include_options
      : promotionState.promotion?.include_options)
    handleChangeItem({ include_options: !includeOptions })
  }

  return (
    <>
      <ConditionsContainer>
        <Header>
          <h1>{t('CONDITIONS', 'Conditions')}</h1>
        </Header>

        {conditions.filter(condition => condition.enabled).map((condition, index) => (
          <ConditionItem
            key={index}
            onClick={e => handlePromotionEdit(e, condition.attribute, condition.title)}
          >
            <div>
              {
                (typeof formState.changes[condition.attribute] !== 'undefined'
                  ? formState.changes[condition.attribute]
                  : Array.isArray(promotionState.promotion[condition.attribute])
                    ? promotionState.promotion[condition.attribute]?.length
                    : promotionState.promotion[condition.attribute])
                  ? (
                    <CheckboxWrapper
                      className='condition-checkbox'
                      active
                      isCursorAllowed
                      onClick={() => handleChangeItem({ [condition.attribute]: null })}
                    >
                      <Check2 />
                    </CheckboxWrapper>
                    )
                  : <CheckboxWrapper className='condition-checkbox' />
              }
              <span>{condition.title}</span>
            </div>
            <EditButton>
              <Pencil />
            </EditButton>
          </ConditionItem>
        ))}
        <ConditionItem
          onClick={() => handleIncludeOptions()}
        >
          <div>
            {(typeof formState.changes.include_options !== 'undefined'
              ? formState.changes.include_options
              : promotionState.promotion?.include_options)
              ? (
                <CheckboxWrapper isCursorAllowed active>
                  <Check2 />
                </CheckboxWrapper>
                )
              : (
                <CheckboxWrapper isCursorAllowed />
                )}
            <span>{t('', 'Include options')}</span>
          </div>
        </ConditionItem>

        <Button
          borderRadius='8px'
          color='primary'
          onClick={() => isAddMode ? handleAddPromotion() : handleUpdateClick()}
          disabled={Object.keys(formState.changes).length === 0 || actionState.loading}
        >
          {isAddMode ? t('ADD', 'Add') : t('SAVE', 'Save')}
        </Button>
      </ConditionsContainer>
      {openSingleModal && (
        <Modal
          width='600px'
          open={openSingleModal}
          onClose={() => handleCloseModal()}
        >
          <EnterprisePromotionEditCondition
            {...props}
            title={selectedTitle}
            condition={selectedCondition}
            onClickDone={() => handleClickSave()}
          />
        </Modal>
      )}
      {openMultipleModal && (
        <Modal
          width={specifics.includes(selectedCondition) ? '70%' : '600px'}
          open={openMultipleModal}
          onClose={() => handleCloseModal()}
        >
          {selectedCondition === 'products' && (
            <EnterprisePromotionSpecficProducts
              {...props}
              onClickDone={() => handleClickSave()}
            />
          )}
          {selectedCondition === 'categories' && (
            <EnterprisePromotionSpecficCategory
              {...props}
              onClickDone={() => handleClickSave()}
            />
          )}
          {selectedCondition === 'user_order_count' && (
            <EnterprisePromotionMaxOrders
              {...props}
              onClickDone={() => handleClickSave()}
            />
          )}
          {selectedCondition === 'order_types_allowed' && (
            <EnterprisePromotionOrderTypes
              {...props}
              onClickDone={() => handleClickSave()}
            />
          )}
          {selectedCondition === 'paymethods' && (
            <EnterprisePromotionPaymethods
              {...props}
              onClickDone={() => handleClickSave()}
            />
          )}
          {selectedCondition === 'delivery_zones' && (
            <EnterprisePromotionDeliveryzones
              {...props}
              businessIds={selectedBusinessIds}
              onClickDone={() => handleClickSave()}
            />
          )}
          {selectedCondition === 'schedule' && (
            <EnterprisePromotionSchedule
              {...props}
              onClickDone={() => handleClickSave()}
            />
          )}
        </Modal>
      )}
    </>
  )
}
