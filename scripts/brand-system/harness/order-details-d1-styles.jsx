import React from 'react'
import { Circle, RecordCircleFill, ThreeDots } from 'react-bootstrap-icons'

import { IconButton } from '../../../src/@/components-dashboard/src/ui/src/styles'
import { CloneOption, Title as CloneTitle } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/CloneOrder/styles'
import {
  AdvancedLogistic,
  OrderProducts,
  OrderStatus,
  RejectReasonWrapper,
  StatusBar
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrderDetails/styles'
import {
  ActionSelectorWrapper,
  OrderDetailsHeaderContainer,
  PrinterSelect
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrderDetailsHeader/styles'
import { RegressionContainer, StatusTransition } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrderStatusRegressionModal/styles'
import { ErrorText, TrackingModalContent } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrderTrackingLink/styles'

export const OrderDetailsD1StylesFixture = () => (
  <main data-testid='order-details-d1-styles' style={{ maxWidth: 680, minWidth: 0, padding: 24 }}>
    <OrderDetailsHeaderContainer data-testid='details-header'>
      <div><h1>Order No. <span className='order-identifier'>910001</span></h1></div>
      <p>Card payment · Delivery</p>
    </OrderDetailsHeaderContainer>
    <section data-testid='open-actions' style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <ActionSelectorWrapper>
        <div><button type='button' aria-label='Options'><ThreeDots /></button></div>
      </ActionSelectorWrapper>
      <PrinterSelect style={{ position: 'relative', insetInlineEnd: 'auto' }}>
        <IconButton type='button' color='black'>Normal</IconButton>
        <IconButton type='button' color='black'>Ticket</IconButton>
      </PrinterSelect>
    </section>
    <OrderStatus data-testid='order-status'>
      <h2>Order status</h2><p>2026-09-15 10:30</p>
    </OrderStatus>
    <div style={{ width: '100%' }}><StatusBar data-testid='status-bar' percentage={40} /></div>
    <AdvancedLogistic><div><p>Logistic</p><p>In queue</p></div><div><p>Priority</p><p>Normal</p></div></AdvancedLogistic>
    <OrderProducts><h2>Products</h2></OrderProducts>
    <RejectReasonWrapper>Customer unavailable</RejectReasonWrapper>
    <section data-testid='clone-surface'>
      <CloneTitle>Clone order</CloneTitle>
      <CloneOption type='button' active aria-pressed='true'><RecordCircleFill /><span>Clone full order</span></CloneOption>
      <CloneOption type='button' aria-pressed='false'><Circle /><span>Clone without products</span></CloneOption>
    </section>
    <RegressionContainer data-testid='regression-surface'>
      <h2>Status change reason</h2><p>Explain this regression.</p>
      <StatusTransition>Pending <span>→ Completed</span></StatusTransition>
    </RegressionContainer>
    <TrackingModalContent data-testid='tracking-surface'>
      <p>Enter the tracking domain used for customer order links.</p>
      <input aria-label='Tracking domain' defaultValue='tracking.example.com' />
      <ErrorText role='alert'>Please enter a valid domain</ErrorText>
    </TrackingModalContent>
  </main>
)
