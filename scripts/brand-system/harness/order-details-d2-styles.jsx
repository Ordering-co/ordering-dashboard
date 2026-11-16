import React from 'react'
import { ChevronDown, Image as ImageIcon, InfoCircle, Plus, Telephone, Trash } from 'react-bootstrap-icons'
// Adapted 2026-10-08 (W1-6a, T1-6-4a): «Send» is the Product primary Button with the Lucide glyph, as in the chat; its type and targets are P/'s
import { Button as ProductButton } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Product'
import { Send as SendIcon } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Icon'
import '../../../src/brand/candidates.css'
import fixtureAttachment from '../../../src/assets/images/call-center-app.png'

import {
  BubbleBusines,
  BubbleCustomer,
  ChatContactInfoContainer,
  ChatImage,
  InfoBlock,
  MessageBusiness,
  MessageCustomer,
  MessagesSearch,
  OrderDetailIconButton,
  OrderNumber,
  QuickMessageWrapper,
  SendForm,
  SendImage,
  TabItem,
  TimeofSent,
  WrapperHitoryHeader,
  WrapperSendMessageButton
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/Messages/styles'
import {
  ActionIconWrapper,
  BusinessInfo,
  CustomerEditWrapper,
  CustomerInfoTable,
  InfoContent,
  PhotoWrapper,
  ReviewButton,
  ToggleItemWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrderContactInformation/styles'
import {
  BubbleConsole as LogisticBubble,
  UppercaseText,
  WraaperLogs
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrderLogisticInformation/styles'
import {
  MetaAddContainer,
  MetaAddForm,
  MetaContainer,
  MetaTitle,
  IdentifierBorder,
  RoundBorder,
  WrapMetaFields
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/OrderMetaFields/styles'
import { Button, IconButton } from '../../../src/@/components-dashboard/src/ui/src/styles'

export const OrderDetailsD2StylesFixture = () => (
  <main data-testid='order-details-d2-styles' style={{ display: 'grid', gap: 24, maxWidth: 720, minWidth: 0, padding: 24 }}>
    <section data-testid='messages-open' aria-label='Messages open state'>
      <OrderNumber>{document.documentElement.dir === 'rtl' ? 'رقم الطلب' : 'Order'} <span className='order-identifier'>910001</span></OrderNumber>
      <WrapperHitoryHeader>
        <TabItem active aria-pressed='true'>Order History</TabItem>
        <TabItem aria-pressed='false'>Logistics</TabItem>
        <TabItem aria-pressed='false'>Logistics information</TabItem>
      </WrapperHitoryHeader>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <MessagesSearch><span aria-hidden='true'>⌕</span><input aria-label='Search' defaultValue='910001' /></MessagesSearch>
        <OrderDetailIconButton type='button' aria-label='Order details'><InfoCircle /></OrderDetailIconButton>
      </div>
      <MessageBusiness>
        <BubbleBusines>Restaurant confirmed the long preparation note for the driver.</BubbleBusines>
        <TimeofSent>10:32 AM</TimeofSent>
      </MessageBusiness>
      <MessageCustomer>
        <BubbleCustomer>
          Customer message with a very long delivery instruction that must reflow without clipping.
          <ChatImage aria-label='Expand message image'><img src={fixtureAttachment} alt='Message attachment' /></ChatImage>
        </BubbleCustomer>
        <TimeofSent>10:34 AM</TimeofSent>
      </MessageCustomer>
      <SendForm>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <ChatContactInfoContainer selected aria-pressed='true'>
            <InfoBlock><p>Synthetic Store Alpha</p><p>Business</p></InfoBlock>
          </ChatContactInfoContainer>
          <ChatContactInfoContainer aria-pressed='false'>
            <InfoBlock><p>Customer with a long operational name</p><p>Customer</p></InfoBlock>
          </ChatContactInfoContainer>
        </div>
        <QuickMessageWrapper><Button type='button'>Ready for pickup</Button><Button type='button'>Driver assigned</Button></QuickMessageWrapper>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input aria-label='Message' defaultValue='Operational update' style={{ width: '100%', minHeight: 44, paddingInlineEnd: 52 }} />
            <SendImage><input type='file' aria-label='Insert image' /><ImageIcon /></SendImage>
          </div>
          <WrapperSendMessageButton><ProductButton variant='primary' type='button' icon={() => <SendIcon className='odc-icon odc-icon-flip' />} aria-label='Send'><span>Send</span></ProductButton></WrapperSendMessageButton>
        </div>
      </SendForm>
    </section>

    <section data-testid='contact-open' aria-label='Contact information open state'>
      <ToggleItemWrapper active>
        <button type='button' className='disclosure-button' aria-expanded='true'>
          <BusinessInfo>
            <PhotoWrapper aria-hidden='true'>OS</PhotoWrapper>
            <InfoContent><div><p>Synthetic Store Alpha with a long name</p></div><p>+1 555 0100</p></InfoContent>
          </BusinessInfo>
          <ChevronDown className='down-arrow' />
        </button>
        <ActionIconWrapper><IconButton type='button' aria-label='Call Synthetic Store Alpha'><Telephone /></IconButton></ActionIconWrapper>
      </ToggleItemWrapper>
      <CustomerInfoTable>
        <tbody>
          <tr><td>Email</td><td><a href='mailto:operations-contact-with-a-very-long-name@example.test'>operations-contact-with-a-very-long-name@example.test</a></td></tr>
          <tr><td>Full address</td><td>100 Very Long Operations Avenue, Suite 12345</td></tr>
        </tbody>
      </CustomerInfoTable>
      <ReviewButton type='button'>Review</ReviewButton>
      <CustomerEditWrapper><input aria-label='Customer email' defaultValue='customer@example.test' /><Button type='button'>Save</Button></CustomerEditWrapper>
    </section>

    <section data-testid='logistics-open' aria-label='Logistics information open state'>
      <WraaperLogs>
        <UppercaseText title>Logistics information</UppercaseText>
        <LogisticBubble>Distance from business: 1.6 km</LogisticBubble>
        <Button type='button'>Reload</Button>
      </WraaperLogs>
    </section>

    <section data-testid='meta-open' aria-label='Custom fields open state'>
      <WrapMetaFields>
        <MetaTitle>Custom fields</MetaTitle>
        <MetaContainer data-testid='meta-existing'>
          <div className='meta_type'>text</div>
          <div className='meta_key'><IdentifierBorder>dispatch_note</IdentifierBorder></div>
          <div className='meta_value'><RoundBorder>استخدم مدخل الخدمة بعد الساعة العاشرة مساءً</RoundBorder><IconButton type='button' aria-label='Delete dispatch_note'><Trash /></IconButton></div>
        </MetaContainer>
        <MetaAddForm>
          <MetaAddContainer data-testid='meta-add'>
            <div className='meta_type'>text</div><div className='meta_key'><input aria-label='Key' defaultValue='priority' /></div><div className='meta_value'><input aria-label='Value' defaultValue='high' /><IconButton type='button' aria-label='Add'><Plus /></IconButton></div>
          </MetaAddContainer>
        </MetaAddForm>
      </WrapMetaFields>
    </section>
  </main>
)
