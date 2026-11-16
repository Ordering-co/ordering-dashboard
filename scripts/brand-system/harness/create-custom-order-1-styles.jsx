import React, { useState } from 'react'

import {
  CardCvcField,
  CardExpiryField,
  CardNumberField,
  ErrorMessage as CardErrorMessage,
  FormRow,
  FormStripe,
  ZipcodeField
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/CardForm/styles'
import {
  FormContainer as CustomCardForm,
  InputContainer as CustomCardInputs
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/CardFormCustom/styles'
import {
  CartBillContainer,
  IconContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/CartBill/styles'
import {
  Flag,
  WarningMessage,
  WrapperPlaceOrderButton
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/Checkout/styles'
import { CouponContainer } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/CouponControl/styles'
import {
  ButtonWrapper,
  DetailsContainer,
  FormControl,
  RaidoButton,
  ToggleOptions
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/CustomOrderDetails/styles'
import {
  DriverTipContainer,
  DriverTipLabel,
  TipCard,
  WrapperInput as TipWrapperInput,
  WrapperTips
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/DriverTips/styles'
import { Container as MapContainer } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/Map/styles'
import {
  Option as OrderTypeOption,
  SelectWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/OrderTypeSelector/styles'
import {
  ErrorText as CashErrorText,
  FormCash,
  PaymentCashContainer,
  WrapperInput as CashWrapperInput
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/PaymentOptionCash/styles'
import { Container as PaypalContainer } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/PaymentOptionPaypal/styles'
import {
  Container as SquareContainer,
  PaymentSquareContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/PaymentOptionSquare/styles'
import { Button, Input } from '../../../src/@/components-dashboard/src/ui/src/styles'

export const CreateCustomOrder1StylesFixture = () => {
  const [tip, setTip] = useState(10)
  const [byProducts, setByProducts] = useState(true)

  return (
    <main data-testid='create-custom-order-1-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>
      <section data-testid='details-family' aria-label='Custom order details'>
        <DetailsContainer>
          <h2 data-testid='details-title'>Create custom order</h2>
          <h3 data-testid='details-section-title'>Customer</h3>
          <FormControl>
            <label htmlFor='fixture-external-id'>
              External id
              <span data-testid='details-field-hint'>Optional</span>
            </label>
            <Input id='fixture-external-id' defaultValue='EXT-00000000012345' />
          </FormControl>
          <ToggleOptions>
            <RaidoButton type='button' aria-pressed={byProducts} onClick={() => setByProducts(true)}>
              <span data-testid='details-radio-label'>Order by products</span>
            </RaidoButton>
            <RaidoButton type='button' aria-pressed={!byProducts} onClick={() => setByProducts(false)}>
              <span>Order by total</span>
            </RaidoButton>
          </ToggleOptions>
          <ButtonWrapper><Button color='primary' type='button'>Place Order</Button></ButtonWrapper>
        </DetailsContainer>
      </section>

      <section data-testid='order-type-family' aria-label='Order type'>
        <SelectWrapper>
          <p data-testid='order-type-title'>How will you delivery type?</p>
          <div className='select' data-testid='order-type-value'>Delivery</div>
        </SelectWrapper>
        <OrderTypeOption><span data-testid='order-type-option'>Curbside</span></OrderTypeOption>
        <MapContainer data-testid='map-surface' role='region' aria-label='Delivery map' />
      </section>

      <section data-testid='tips-family' aria-label='Driver tips'>
        <DriverTipContainer>
          <h3>Driver Tips</h3>
          <p data-testid='tips-copy'>100% of the tip goes to your driver</p>
          <WrapperTips>
            {[5, 10, 15].map(option => (
              <TipCard
                key={option}
                type='button'
                aria-pressed={tip === option}
                className={tip === option ? 'active' : ''}
                data-testid={`tip-${option}`}
                onClick={() => setTip(option)}
              >
                {`${option}%`}
              </TipCard>
            ))}
          </WrapperTips>
          <DriverTipLabel htmlFor='fixture-tip' data-testid='tips-label'>Custom</DriverTipLabel>
          <TipWrapperInput>
            <Input id='fixture-tip' defaultValue='12' />
            <Button color='primary' type='button'>Apply Tip</Button>
          </TipWrapperInput>
        </DriverTipContainer>
      </section>

      <section data-testid='bill-family' aria-label='Cart bill'>
        <CartBillContainer>
          <h3>Summary</h3>
          <table aria-label='Order bill'>
            <tbody>
              <tr>
                <td className='icon' data-testid='bill-row'>
                  Long promotional offer name for a marketplace campaign
                  <IconContainer>
                    <button type='button' aria-label='Offer Long promotional offer name for a marketplace campaign'>i</button>
                    <button type='button' aria-label='Delete Long promotional offer name for a marketplace campaign'>x</button>
                  </IconContainer>
                </td>
                <td>- $12.00</td>
              </tr>
            </tbody>
          </table>
          <CouponContainer>
            <Input aria-label='Discount coupon' defaultValue='WELCOME' />
            <Button color='primary' type='button'>Apply</Button>
          </CouponContainer>
          {/* The total table keeps the upstream #loyalty compatibility selector,
              so the fixture renders that cell to cover its content role. */}
          <table className='total' aria-label='Order total'>
            <tbody>
              <tr>
                <td data-testid='bill-total'>Total</td>
                <td id='loyalty' data-testid='bill-loyalty'>$120.00</td>
              </tr>
            </tbody>
          </table>
        </CartBillContainer>
      </section>

      <section data-testid='checkout-family' aria-label='Checkout'>
        <WarningMessage role='status'>
          <p data-testid='checkout-warning'>Your order is being processed, please wait a little more.</p>
        </WarningMessage>
        <Flag data-testid='checkout-flag'>Required</Flag>
        <WrapperPlaceOrderButton>
          <span data-testid='checkout-total'>$120.00</span>
          <Button color='primary' type='button'>Place Order</Button>
        </WrapperPlaceOrderButton>
      </section>

      <section data-testid='payment-family' aria-label='Payment options'>
        <PaymentCashContainer>
          <FormCash>
            <CashWrapperInput>
              <label htmlFor='fixture-cash' data-testid='cash-label'>Don&apos;t have exact amount?</label>
              <Input id='fixture-cash' defaultValue='150.00' />
            </CashWrapperInput>
            <CashErrorText role='alert' data-testid='cash-error'>This value must be greater than order total</CashErrorText>
          </FormCash>
        </PaymentCashContainer>
        <PaymentSquareContainer>
          <SquareContainer>
            <form>
              <button type='button' id='gift-card-button' data-testid='square-action'>Pay with Gift Card</button>
            </form>
          </SquareContainer>
        </PaymentSquareContainer>
        <PaypalContainer><p>Paypal boundary</p></PaypalContainer>
        <FormStripe onSubmit={event => event.preventDefault()}>
          <FormRow>
            <CardNumberField>
              <label htmlFor='fixture-card-number' data-testid='card-label'>Card number</label>
              <input id='fixture-card-number' defaultValue='4242 4242 4242 4242' data-testid='card-input' />
              <CardErrorMessage role='alert' data-testid='card-error'>Your card number is incomplete.</CardErrorMessage>
            </CardNumberField>
            <CardExpiryField><label>Expire date</label></CardExpiryField>
            <CardCvcField><label>CVC</label></CardCvcField>
            <ZipcodeField data-testid='card-zipcode' defaultValue='75001' />
          </FormRow>
        </FormStripe>
        <CustomCardForm>
          <CustomCardInputs>
            <Input aria-label='Card number' defaultValue='4242 4242 4242 4242' />
          </CustomCardInputs>
        </CustomCardForm>
      </section>
    </main>
  )
}
