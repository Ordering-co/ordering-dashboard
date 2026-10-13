import React, { useEffect, useState } from 'react'
import { useLanguage } from '../../../../../../index'
import { CheckSquareFill, Square } from 'react-bootstrap-icons'
import {
  Container,
  ContentWrapper,
  CreditCardPaymentsContainer,
  Divider,
  PaymethodItem
} from './styles'

export const PaymentMethods = (props) => {
  const {
    paymethodsList,
    handleChangePaymethodIds,
    paymethodIds
  } = props

  const [, t] = useLanguage()
  const [excludePaymethods, setExcludedPaymethods] = useState([])
  const [creditCardPymethods, setCreditCardPaymethods] = useState([])
  const methodsPay = ['google_pay', 'apple_pay']

  const handleChangeIds = (id) => {
    let updateIds = []
    if (paymethodIds.includes(id)) updateIds = paymethodIds.filter(paymethodId => paymethodId !== id)
    else updateIds = [...paymethodIds, id]
    handleChangePaymethodIds(updateIds)
  }

  useEffect(() => {
    if (!paymethodsList?.loading && paymethodsList?.paymethods?.length > 0) {
      handleChangeIds(paymethodsList?.paymethods[0].id)
    }
  }, [paymethodsList])

  useEffect(() => {
    const paymethodsNotAllowed = []
    const paymethodsCreditCard = []
    const paymentsCreditCards = [...methodsPay, 'stripe', 'stripe_checkout', 'paypal']
    paymethodsCreditCard.push(...paymentsCreditCards)
    setExcludedPaymethods(paymethodsNotAllowed)
    setCreditCardPaymethods(paymethodsCreditCard)
  }, [])

  return (
    <Container>
      <h2>{t('PAYMENT_METHODS', 'Payment methods')}<sup>*</sup></h2>
      <ContentWrapper>
        {!paymethodsList?.loading && paymethodsList?.paymethods?.filter(paymethod => !creditCardPymethods.includes(paymethod.gateway) && !excludePaymethods.includes(paymethod.gateway)).map((paymethod, idx) => (
          <PaymethodItem key={paymethod?.id} isBorderTop={idx === 0} onClick={() => handleChangeIds(paymethod.id)}>
            {paymethodIds.includes(paymethod?.id) ? <CheckSquareFill className='enabled' /> : <Square />}
            <span>{t(paymethod?.gateway?.toUpperCase(), paymethod?.name)}</span>
          </PaymethodItem>
        ))}
        <Divider />
        <CreditCardPaymentsContainer>
          <h2>{t('CREDIT_CARD_PAYMENTS', 'Credit card payments')}</h2>
          {!paymethodsList?.loading && paymethodsList?.paymethods?.filter(paymethod => creditCardPymethods.includes(paymethod.gateway) && !excludePaymethods.includes(paymethod.gateway)).map((paymethod, idx) => (
            <PaymethodItem
              key={paymethod?.id}
              isBorderTop={idx === 0}
              onClick={() => handleChangeIds(paymethod.id)}
            >
              {paymethodIds.includes(paymethod?.id) ? <CheckSquareFill className='enabled' /> : <Square />}
              <span>{t(paymethod?.gateway?.toUpperCase(), paymethod?.name)}</span>
            </PaymethodItem>
          ))}
        </CreditCardPaymentsContainer>
      </ContentWrapper>
    </Container>
  )
}
