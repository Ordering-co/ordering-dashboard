import React from 'react'
import { SquareCheck } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Icon'
import { DriverName, DriverText } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/AdminsSelector/styles'
import { OptionCategory, OptionName } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/BusinessesSelector/styles'
import { Option as SLAOption } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrdersDashboardSLAControls/styles'
import { CheckBoxWrapper, ModalContainer, ToastWrapper } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrderNotification/styles'
import { Tab as StatusTab } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrderStatusFilterBar/styles'
import { SubFilterContainer } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrderStatusSubFilter/styles'
import { Option as StatusTypeOption } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrderStatusTypeSelector/styles'
import { HeaderTitle as ContentHeaderTitle } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrdersContentHeader/styles'
import { ExportCSVResult, Item as ExportItem, PopoverContainer } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrdersExportCSV/styles'
import {
  CheckBox,
  OrderTbody,
  OrdersCountWrapper,
  Table,
  Timer
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrdersTable/styles'
import { AddMetaFiled, WarningMessage } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrdersFilterGroup/styles'
import { InfoMessage } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrdersListing/styles'
import { WrapperIndicator } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrdersManager/styles'
import { HelperContent } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/WizardOrders/styles'
import { Option as HeaderFilterOption } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrdersHeaderFilterGroup/styles'
import {
  OrderCard,
  OrderHeader,
  ViewDetails
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrdersCards/styles'
import {
  CommentButton,
  CustomerName,
  ReviewContainer,
  ReviewsProgressBar,
  ReviewsProgressContent
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/ReviewCustomer/styles'
import { DateWrapper, StatusItemWrapper, WebsocketStatusDot } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/WebsocketStatus/styles'

export const OrdersListStylesFixture = () => (
  <main data-testid='orders-list-styles' style={{ maxWidth: 760, minWidth: 0, padding: 24 }}>
    <ContentHeaderTitle data-testid='family-content-header'>Orders</ContentHeaderTitle>
    <section>
      <StatusTab active aria-pressed='true'>Pending (2)</StatusTab>
      <StatusTab aria-pressed='false'>Completed (12)</StatusTab>
      <SubFilterContainer data-testid='family-subfilter'><button type='button'>Pickup</button></SubFilterContainer>
    </section>
    <div style={{ overflowX: 'auto' }}>
      <Table>
        <thead><tr><th>Order</th><th>Store</th><th>Timer</th></tr></thead>
        <OrderTbody>
          <tr data-status='at_risk'>
            <td><CheckBox aria-label='Order 910001' aria-pressed='true' isChecked><SquareCheck /></CheckBox><strong>910001</strong></td>
            <td><div className='info'><p>Synthetic Store with a long operational name</p><p className='bold'>Fixture customer</p></div></td>
            <td><Timer><p className='bold'>Timer</p><p className='at_risk'>- 00:04</p></Timer></td>
          </tr>
        </OrderTbody>
      </Table>
    </div>
    <div style={{ position: 'relative', minHeight: 70 }}>
      <InfoMessage><span>Two records require attention.</span><a>View details</a></InfoMessage>
    </div>
    <div style={{ position: 'relative', minHeight: 100 }}>
      <WarningMessage style={{ bottom: 24 }}><span>Filters applied. You may miss new orders.</span><a>Clear filters</a></WarningMessage>
    </div>
    <ReviewContainer>
      <h1>Customer review</h1>
      <CustomerName>Alexandria Long Customer Name</CustomerName>
      <ReviewsProgressContent><ReviewsProgressBar style={{ width: '75%' }} /></ReviewsProgressContent>
      <CommentButton active>Selected comment</CommentButton>
      <CommentButton>Unselected comment</CommentButton>
    </ReviewContainer>
    <OrderCard data-testid='family-card'>
      <OrderHeader>
        <h2>Order No. 910001</h2>
        <p>Pending</p>
        <div><p>2026-09-15 08:30:00</p><ViewDetails className='view-details'>View details</ViewDetails></div>
      </OrderHeader>
    </OrderCard>
    <section data-testid='family-selectors'>
      <DriverName>Driver Alpha</DriverName><DriverText>Available now</DriverText>
      <OptionName>Business Alpha</OptionName><OptionCategory>Restaurant</OptionCategory>
      <SLAOption>At risk</SLAOption><StatusTypeOption>Delivery</StatusTypeOption><HeaderFilterOption>Today</HeaderFilterOption>
    </section>
    <ModalContainer data-testid='family-notification'>
      <h1>New order</h1><p><span>Order 910001</span> requires attention.</p>
      <ToastWrapper><div><span>Synthetic Store Alpha</span><span>Pickup order</span></div></ToastWrapper>
      <CheckBoxWrapper aria-pressed='true' isChecked><SquareCheck /><span>Keep sound enabled</span></CheckBoxWrapper>
    </ModalContainer>
    <section data-testid='family-export' style={{ position: 'relative', minHeight: 150 }}>
      <PopoverContainer style={{ position: 'relative', insetInlineEnd: 'auto' }}><ExportItem>Export visible orders</ExportItem></PopoverContainer>
      <ExportCSVResult><h1>Export ready</h1></ExportCSVResult>
    </section>
    <section data-testid='family-lateral'>
      <WrapperIndicator style={{ position: 'relative', bottom: 'auto', insetInlineEnd: 'auto', margin: '8px 0' }}>12</WrapperIndicator>
      <HelperContent><span>1</span><p><span>Review</span> the current order.</p></HelperContent>
      <AddMetaFiled>Add filter</AddMetaFiled>
    </section>
    <section>
      <WebsocketStatusDot status={1} />
      <DateWrapper data-testid='websocket-date'>2026-09-15 08:30:00</DateWrapper>
      <StatusItemWrapper isActive><div><span>Connected</span><span>Live</span></div><p>Receiving operational updates.</p></StatusItemWrapper>
      <div style={{ position: 'relative', width: 50, height: 30 }}><OrdersCountWrapper>12</OrdersCountWrapper></div>
    </section>
  </main>
)
