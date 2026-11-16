import React, { useState } from 'react'

import {
  AddNewCard,
  CardItem,
  CardItemActions,
  CardItemActionsWrapper,
  CardItemContent as StripeCardItemContent,
  OptionStripeContainer,
  WarningMessage
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/PaymentOptionStripe/styles'
import {
  Container as WalletContainer,
  SectionLeft,
  SectionLeftText
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/PaymentOptionWallet/styles'
import {
  CardItemContent as SelectedCardContent,
  PayCard,
  PayCardSelected,
  PaymentMethodsContainer,
  PaymentMethodsList
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/PaymentOptions/styles'
import {
  PriceContent,
  ProductActions,
  ProductMeta,
  ProductName,
  ProductTagWrapper,
  Properties,
  SectionTitle,
  TitleWrapper as ProductTitleWrapper,
  WeightUnitItem,
  WeightUnitSwitch
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/ProductForm/styles'
import { Container as IngredientContainer } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/ProductIngredient/styles'
import {
  Flag,
  Title as OptionTitle,
  TitleContainer,
  WrapHeader
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/ProductOption/styles'
import {
  Container as SubOptionContainer,
  IconControl,
  LeftOptionContainer,
  PositionControl,
  QuantityControl,
  RightOptionContainer,
  SuboptionPrice,
  Text as SubOptionText
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/ProductOptionSubOption/styles'
import {
  Option as BusinessOption,
  SelectWrapper as BusinessSelectWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/SelectBusinesses/styles'
import {
  CustomerAddressWrapper,
  OptionsToSelectContainer,
  SavedPlaces,
  SearchBarContainer,
  SearchBarWrapper,
  SectionContainer,
  SelectOption as CustomerSelectOption,
  SelectedUserWrapper,
  WrapperImage as CustomerWrapperImage
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/SelectCustomer/styles'
import {
  Option as ProductOptionRow,
  ProductEditDeleteActions,
  ProductQuantityActionsContainer,
  SelectOption as ProductSelectOption,
  SelectWrapper as ProductSelectWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/SelectProducts/styles'
import {
  CardContainer,
  CardInfo,
  PriceWrapper,
  RibbonBox,
  SoldOut,
  TitleWrapper as CardTitleWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/SingleProductCard/styles'
import { ErrorMessage as ElementsError } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/StripeElementsForm/styles'
import {
  FormGroup,
  FormRedirect
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/StripeRedirectForm/styles'
import { TaxInformationContainer } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CreateCustomOrder/TaxInformation/styles'
import { Button, IconButton, Input } from '../../../src/@/components-dashboard/src/ui/src/styles'

// Presentation-only fixture: the real styled surfaces, no controller, SDK,
// payment gateway, account or network. Every action here is the native element
// the adopted screens now render.
export const CreateCustomOrder2StylesFixture = () => {
  const [method, setMethod] = useState('stripe')
  const [cardSelected, setCardSelected] = useState(true)
  const [ingredient, setIngredient] = useState(true)
  const [suboption, setSuboption] = useState(true)
  const [position, setPosition] = useState('whole')
  const [unit, setUnit] = useState('pieces')

  return (
    <main data-testid='create-custom-order-2-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>
      <PaymentMethodsContainer data-testid='payment-methods'>
        <PaymentMethodsList>
          {['cash', 'stripe'].map(gateway => (
            <PayCard
              key={gateway}
              as='button'
              type='button'
              aria-pressed={method === gateway}
              className={method === gateway ? 'active' : ''}
              onClick={() => setMethod(gateway)}
            >
              <span className='brand' aria-hidden='true'>▣</span>
              <span className='name' data-testid={`method-${gateway}`}>{gateway}</span>
            </PayCard>
          ))}
        </PaymentMethodsList>
        <PayCardSelected>
          <SelectedCardContent>
            <span className='checks' aria-hidden='true'>◉</span>
            <span className='brand' aria-hidden='true'>▤</span>
            <span data-testid='selected-card'>XXXX-XXXX-XXXX-4242</span>
          </SelectedCardContent>
        </PayCardSelected>
      </PaymentMethodsContainer>

      <OptionStripeContainer data-testid='stripe-cards'>
        <WarningMessage data-testid='stripe-warning'>Sorry, you need to login to use this method</WarningMessage>
        <CardItem isCursor>
          <StripeCardItemContent
            aria-pressed={cardSelected}
            onClick={() => setCardSelected(value => !value)}
          >
            <span className='checks' aria-hidden='true'>◉</span>
            <span className='brand' aria-hidden='true'>▤</span>
            <span data-testid='stripe-card-number'>XXXX-XXXX-XXXX-4242</span>
            <span className='missing-zipcode' data-testid='stripe-card-missing'>(Missing zipcode)</span>
          </StripeCardItemContent>
          <CardItemActions>
            <CardItemActionsWrapper>
              <button type='button' aria-label='Delete card' data-testid='stripe-card-delete'>
                <span aria-hidden='true'>🗑</span>
              </button>
            </CardItemActionsWrapper>
          </CardItemActions>
        </CardItem>
        <AddNewCard>
          <button type='button' data-testid='stripe-add-card'>Add new card</button>
        </AddNewCard>
      </OptionStripeContainer>

      <WalletContainer data-testid='wallet-row'>
        <SectionLeft>
          <input id='fixture-wallet-cash' type='checkbox' defaultChecked />
          <SectionLeftText>
            <label htmlFor='fixture-wallet-cash'>Pay with Cash Wallet</label>
          </SectionLeftText>
        </SectionLeft>
        <div><span data-testid='wallet-balance'>$25.00</span></div>
      </WalletContainer>

      <section data-testid='product-form' aria-label='Product form'>
        <ProductTitleWrapper>
          <ProductName data-testid='product-name'><span>Double cheeseburger</span></ProductName>
          <button type='button' className='favorite' aria-pressed='false' aria-label='Favorite product'>
            <span aria-hidden='true'>♡</span>
          </button>
        </ProductTitleWrapper>
        <Properties>
          <PriceContent>
            <p data-testid='product-price'>$12.00</p>
            <span className='offer-price' data-testid='product-offer-price'>$15.00</span>
          </PriceContent>
          <ProductMeta><span data-testid='product-meta'>320 cal</span></ProductMeta>
        </Properties>
        <ProductTagsList />
        <SectionTitle data-testid='product-section-title'>Ingredients</SectionTitle>
        <IngredientContainer
          as='button'
          type='button'
          aria-pressed={ingredient}
          onClick={() => setIngredient(value => !value)}
        >
          <span aria-hidden='true'>☑</span>
          <span data-testid='ingredient-name'>Cheddar cheese</span>
        </IngredientContainer>

        <WrapHeader>
          <TitleContainer>
            <OptionTitle data-testid='option-title'>
              <span>Choose a side</span>
              <span data-testid='option-title-note'>Choose up to 2</span>
            </OptionTitle>
          </TitleContainer>
          <Flag data-testid='option-flag' required>Required</Flag>
        </WrapHeader>

        <SubOptionContainer data-testid='suboption-row'>
          <LeftOptionContainer
            as='button'
            type='button'
            aria-pressed={suboption}
            onClick={() => setSuboption(value => !value)}
          >
            <IconControl aria-hidden='true'>☑</IconControl>
            <SubOptionText>
              <span className='name' data-testid='suboption-name'>French fries</span>
            </SubOptionText>
          </LeftOptionContainer>
          <RightOptionContainer>
            <QuantityControl data-testid='suboption-quantity'>
              <button type='button' aria-label='Decrease quantity'><span aria-hidden='true'>−</span></button>
              2
              <button type='button' aria-label='Increase quantity'><span aria-hidden='true'>+</span></button>
            </QuantityControl>
            <PositionControl data-testid='suboption-position'>
              {['left', 'whole', 'right'].map(value => (
                <button
                  key={value}
                  type='button'
                  aria-label={value}
                  aria-pressed={position === value}
                  onClick={() => setPosition(value)}
                >
                  <span aria-hidden='true'>◐</span>
                </button>
              ))}
            </PositionControl>
          </RightOptionContainer>
          <SuboptionPrice data-testid='suboption-price'>+ $2.00</SuboptionPrice>
        </SubOptionContainer>

        <ProductActions data-testid='product-actions' style={{ position: 'static' }}>
          <div className='price-amount-block'>
            <div className='price'>
              <h4 data-testid='product-total'>$24.00</h4>
              <span data-testid='product-limit'>Minimum 2 to order</span>
            </div>
            <div className='incdec-control show-weight-unit'>
              <button type='button' className='qty-step' aria-label='Decrease quantity'><span aria-hidden='true'>−</span></button>
              <Input className='qty' aria-label='Quantity' readOnly value='2' />
              <button type='button' className='qty-step' aria-label='Increase quantity'><span aria-hidden='true'>+</span></button>
              <WeightUnitSwitch>
                <WeightUnitItem as='button' type='button' aria-pressed={unit === 'pieces'} active={unit === 'pieces'} onClick={() => setUnit('pieces')} data-testid='weight-pieces'>pcs</WeightUnitItem>
                <WeightUnitItem as='button' type='button' aria-pressed={unit === 'kg'} active={unit === 'kg'} onClick={() => setUnit('kg')}>kg</WeightUnitItem>
              </WeightUnitSwitch>
            </div>
          </div>
          <Button className='add' color='primary' type='button'>Add</Button>
        </ProductActions>
      </section>

      <SectionContainer data-testid='customer-section'>
        <p data-testid='customer-copy'>Search with the phone the customer who will assign the custom order.</p>
        <SearchBarContainer>
          <SearchBarWrapper>
            <Input aria-label='Phone number' placeholder='Phone number' />
            <span className='loading' data-testid='customer-spinner'>
              <svg viewBox='0 0 16 16' width='16' height='16' aria-hidden='true' focusable='false'><circle cx='8' cy='8' r='6' fill='none' stroke='currentColor' strokeWidth='2' /></svg>
            </span>
            <OptionsToSelectContainer data-testid='customer-options'>
              <CustomerSelectOption as='button' type='button'>
                <span data-testid='customer-option'>+1 555 0100</span>
                <CustomerWrapperImage as='span' aria-hidden='true'>◧</CustomerWrapperImage>
                <span className='name'>Ada Lovelace</span>
              </CustomerSelectOption>
              <p data-testid='customer-results-note'>
                <button type='button' className='new'>New user</button>
              </p>
            </OptionsToSelectContainer>
          </SearchBarWrapper>
        </SearchBarContainer>
        <SelectedUserWrapper data-testid='customer-selected'>
          <CustomerSelectOption as='button' type='button' aria-label='Change customer: +1 555 0100 Ada Lovelace'>
            <span>+1 555 0100</span>
            <CustomerWrapperImage as='span' aria-hidden='true'>◧</CustomerWrapperImage>
            <span className='name'>Ada Lovelace</span>
          </CustomerSelectOption>
          <Button circle outline color='primary' type='reset' className='remove_option' aria-label='Remove customer'>
            <span aria-hidden='true'>✕</span>
          </Button>
        </SelectedUserWrapper>
        <CustomerAddressWrapper data-testid='customer-address'>
          <div>
            <span aria-hidden='true'>⌂</span>
            <span data-testid='customer-address-copy'>1 Infinite Loop, Cupertino</span>
          </div>
          <button type='button' data-testid='customer-address-action'>Change</button>
        </CustomerAddressWrapper>
      </SectionContainer>

      <SavedPlaces data-testid='saved-places'>
        <h2 data-testid='saved-places-title'>Ada Lovelace</h2>
        <p data-testid='saved-places-copy'>Select customer address</p>
      </SavedPlaces>

      <BusinessSelectWrapper data-testid='business-select'>
        <p data-testid='business-select-label'>Select business</p>
        <div className='select' data-testid='business-select-control'>Downtown store</div>
        <BusinessOption><span data-testid='business-option-name'>Downtown store</span></BusinessOption>
      </BusinessSelectWrapper>

      <section data-testid='cart-products' aria-label='Cart products'>
        <ProductSelectWrapper>
          <div className='select' data-testid='products-select-control'>Select product</div>
        </ProductSelectWrapper>
        <ProductSelectOption>
          <span className='name' data-testid='cart-product-name'>Double cheeseburger</span>
        </ProductSelectOption>
        <ProductQuantityActionsContainer>
          <IconButton color='black' aria-label='Decrease quantity'><span aria-hidden='true'>−</span></IconButton>
          <Input type='number' aria-label='Quantity' readOnly disabled value='2' />
          <IconButton color='black' aria-label='Increase quantity'><span aria-hidden='true'>+</span></IconButton>
        </ProductQuantityActionsContainer>
        <ProductEditDeleteActions>
          <IconButton color='black' aria-label='Edit product'><span aria-hidden='true'>✎</span></IconButton>
          <IconButton color='black' aria-label='Delete product'><span aria-hidden='true'>🗑</span></IconButton>
        </ProductEditDeleteActions>
        <ProductOptionRow><span data-testid='products-option-name'>Downtown store</span></ProductOptionRow>
      </section>

      <TaxInformationContainer data-testid='tax-information'>
        <h2 data-testid='tax-title'>Description: Sales tax (Included on price)</h2>
        <h3 data-testid='tax-section-title'>Other products with this Tax:</h3>
        <CardContainer className='product-card' data-testid='product-card'>
          <div>
            <CardInfo>
              <CardTitleWrapper>
                <h3 data-testid='card-title'>Double cheeseburger</h3>
              </CardTitleWrapper>
              <PriceWrapper isOffPrice>
                <span className='current-price' data-testid='card-price'>$12.00</span>
                <span className='off-price' data-testid='card-off-price'>$15.00</span>
              </PriceWrapper>
              <p data-testid='card-description'>Two beef patties, cheddar and house sauce.</p>
            </CardInfo>
            <RibbonBox data-testid='card-ribbon'>New</RibbonBox>
            <SoldOut data-testid='card-sold-out'>SOLD OUT</SoldOut>
          </div>
        </CardContainer>
      </TaxInformationContainer>

      <ElementsError data-testid='elements-error'>Something is wrong!</ElementsError>

      <FormRedirect data-testid='redirect-form' onSubmit={event => event.preventDefault()}>
        <FormGroup>
          <label htmlFor='fixture-redirect-type'>Select a payment method</label>
          <select id='fixture-redirect-type' name='type' data-testid='redirect-select'>
            <option value=''>Select a payment method</option>
          </select>
        </FormGroup>
      </FormRedirect>
    </main>
  )
}

const ProductTagsList = () => (
  <ProductTagWrapper data-testid='product-tag'>
    <span data-testid='product-tag-name'>Spicy</span>
  </ProductTagWrapper>
)
