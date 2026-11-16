import React, { useState } from 'react'

import {
  ArrowIconsWrapper as AmountArrowIconsWrapper,
  RadioCheckWrapper as AmountRadioCheckWrapper,
  SubTitle as AmountSubTitle,
  Title as AmountTitle
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/CampaignAmountOption/styles'
import {
  ActionSelectorWrapper,
  CampaignDetailContainer,
  CampaignName,
  ContactWrapper as DetailContactWrapper,
  Tab as DetailTab
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/CampaignDetail/styles'
import {
  AudienceWrapper as GeneralAudienceWrapper,
  CheckBoxWrapper as GeneralCheckBoxWrapper,
  DynamicContentWrapper as GeneralDynamicContentWrapper,
  EndDateWrapper as GeneralEndDateWrapper,
  FixedContent as GeneralFixedContent,
  FixedStatusWrapper as GeneralFixedStatusWrapper,
  InputWrapper as GeneralInputWrapper,
  Option as GeneralOption,
  RadioCheckWrapper as GeneralRadioCheckWrapper,
  RulesWrapper as GeneralRulesWrapper,
  SelectWrapper as GeneralSelectWrapper,
  SwitchWrapper as GeneralSwitchWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/CampaignDetailGeneral/styles'
import {
  ContactWrapper as EmailContactWrapper,
  Description as EmailDescription,
  EmailPreviewContent,
  InputWrapper as EmailInputWrapper,
  WrapperEditor as EmailWrapperEditor
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/CampaignEmail/styles'
import {
  HeaderTitle,
  InfoContent as HeaderInfoContent
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/CampaignHeader/styles'
import {
  StatusWrapper as ListStatusWrapper,
  SwitchWrapper as ListSwitchWrapper,
  Table as ListTable
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/CampaignList/styles'
import {
  ContactWrapper as NotifContactWrapper,
  Description as NotifDescription,
  InputWrapper as NotifInputWrapper,
  SmsPreviewContent as NotifSmsPreviewContent
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/CampaignNotification/styles'
import {
  EmailPreviewContent as PopupEmailPreviewContent,
  HeaderWrapper as PopupHeaderWrapper,
  InputWrapper as PopupInputWrapper,
  PopupContent
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/CampaignPopup/styles'
import {
  ContactWrapper as SmsContactWrapper,
  Description as SmsDescription,
  InputWrapper as SmsInputWrapper,
  SmsPreviewContent
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/CampaignSMS/styles'
import {
  RadioCheckWrapper as SignupRadioCheckWrapper,
  Title as SignupTitle
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/CampaignSignUpOption/styles'
import {
  Table as UsersListTable,
  THead as UsersListTHead,
  Title as UsersListTitle
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/CampaignUsersList/styles'
import {
  Description as WebHookDescription,
  InputWrapper as WebHookInputWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/CampaignWebHook/styles'
import {
  InputWrapper as WhatsappInputWrapper,
  WhatsAppMessageContent
} from '../../../src/@/components-dashboard/src/ui/src/components/Marketing/CampaignWhatsapp/styles'
import { radioGroupKeyDown, radioTabIndex } from '../../../src/@/components-dashboard/src/ui/src/utils/radioGroupKeyboard'

// Presentation-only fixture: the real Marketing/Campaign styled surfaces, no
// controller, SDK, account or network. These screens send real email, SMS and
// WhatsApp messages, so nothing is mounted from any row's index.js — only the
// styled-components exported by each row's styles.js.
export const MarketingA1StylesFixture = () => {
  // Local state, as the product keeps it: Fixed audience and ASAP delivery start checked.
  const [audienceType, setAudienceType] = useState('fixed')
  const [isASAP, setIsASAP] = useState(true)
  const isAudienceTypeSet = audienceType === 'dynamic' || audienceType === 'fixed'
  return (
    <main data-testid='marketing-a1-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>
      <AmountTitle data-testid='amount-title'>Send a bonus</AmountTitle>
      <AmountRadioCheckWrapper data-testid='amount-radio-check-wrapper'>
        <button type='button' aria-pressed='true' data-testid='amount-radio-button'>
          <span data-testid='amount-radio-check'>Fixed amount</span>
        </button>
      </AmountRadioCheckWrapper>
      <AmountSubTitle data-testid='amount-sub-title'>Amount</AmountSubTitle>

      <CampaignDetailContainer data-testid='detail-campaign-detail-container'>
        <div className='info-campaign-ended'>
          <p data-testid='detail-campaign-detail'>Campaign ended 2 days ago</p>
        </div>
      </CampaignDetailContainer>
      <CampaignName data-testid='detail-campaign-name'>Summer promo</CampaignName>
      <ActionSelectorWrapper data-testid='detail-action-selector-wrapper'>
        <div>
          <div>
            <button type='button' className='dropdown-item' data-testid='detail-action-selector'>Duplicate</button>
          </div>
        </div>
      </ActionSelectorWrapper>
      {/* Mirrors CampaignDetail: the two tabs sit in a flex row (Tabs), one pressed and one not. */}
      <div style={{ display: 'flex' }}>
        <DetailTab active aria-pressed='true' data-testid='detail-tab'>General</DetailTab>
        <DetailTab aria-pressed='false' data-testid='detail-tab-inactive'>Content</DetailTab>
      </div>
      <DetailContactWrapper data-testid='detail-contact-wrapper'>
        <p data-testid='detail-contact'>Contact support to enable this campaign.</p>
      </DetailContactWrapper>

      <GeneralSelectWrapper data-testid='general-select-wrapper'>
        <label htmlFor='fixture-marketing-general-select' data-testid='general-select'>Audience</label>
        <div>
          <div data-testid='general-select-controlvalue'>All users</div>
        </div>
      </GeneralSelectWrapper>
      <GeneralOption data-testid='general-option'>All users</GeneralOption>
      <GeneralInputWrapper data-testid='general-input-wrapper'>
        <label htmlFor='fixture-marketing-general-input' data-testid='general-input'>Campaign name</label>
        <input id='fixture-marketing-general-input' />
      </GeneralInputWrapper>
      {/* Mirrors CampaignDetailGeneral: the Audience group holds the Dynamic/Fixed pair, and the
          Delivery Schedule group is nested inside it, so its radios belong to their nearest group. */}
      <GeneralAudienceWrapper role='radiogroup' aria-labelledby='fixture-marketing-general-audience' data-testid='general-audience-wrapper'>
        <h2 id='fixture-marketing-general-audience' data-testid='general-audience'>Audience</h2>
        <GeneralRadioCheckWrapper
          as='button'
          type='button'
          role='radio'
          aria-checked={audienceType === 'dynamic'}
          tabIndex={radioTabIndex(audienceType === 'dynamic', true, isAudienceTypeSet)}
          onKeyDown={radioGroupKeyDown}
          onClick={() => setAudienceType('dynamic')}
          data-testid='general-radio-dynamic'
        >
          <span>Dynamic</span>
        </GeneralRadioCheckWrapper>
        <GeneralRadioCheckWrapper
          as='button'
          type='button'
          role='radio'
          aria-checked={audienceType === 'fixed'}
          tabIndex={radioTabIndex(audienceType === 'fixed', false, isAudienceTypeSet)}
          onKeyDown={radioGroupKeyDown}
          onClick={() => setAudienceType('fixed')}
          data-testid='general-radio-fixed'
        >
          <span>Fixed</span>
        </GeneralRadioCheckWrapper>
        <h3 id='fixture-marketing-general-schedule'>Delivery Schedule</h3>
        <div role='radiogroup' aria-labelledby='fixture-marketing-general-schedule' style={{ display: 'contents' }}>
          <GeneralRadioCheckWrapper
            as='button'
            type='button'
            role='radio'
            aria-checked={isASAP}
            tabIndex={radioTabIndex(isASAP, true, true)}
            onKeyDown={radioGroupKeyDown}
            onClick={() => setIsASAP(true)}
            data-testid='general-radio-check-wrapper'
          >
            <span data-testid='general-radio-check'>Send now</span>
          </GeneralRadioCheckWrapper>
          <GeneralRadioCheckWrapper
            as='button'
            type='button'
            role='radio'
            aria-checked={!isASAP}
            tabIndex={radioTabIndex(!isASAP, false, true)}
            onKeyDown={radioGroupKeyDown}
            onClick={() => setIsASAP(false)}
            data-testid='general-radio-check-wrapper-later'
          >
            <span>Schedule for later</span>
          </GeneralRadioCheckWrapper>
        </div>
      </GeneralAudienceWrapper>
      <GeneralSwitchWrapper data-testid='general-switch-wrapper'>
        <label className='campaign-enabled' htmlFor='fixture-marketing-general-switch' data-testid='general-switch'>Enabled</label>
        <input id='fixture-marketing-general-switch' type='checkbox' />
      </GeneralSwitchWrapper>
      <GeneralDynamicContentWrapper data-testid='general-dynamic-content-wrapper'>
        <p data-testid='general-dynamic-content'>Dynamic content preview</p>
      </GeneralDynamicContentWrapper>
      <GeneralFixedContent data-testid='general-fixed-content-wrapper'>
        <p data-testid='general-fixed-content'>Fixed content preview</p>
        <h3 data-testid='general-fixed-content-sectiontitle'>Fixed rules</h3>
      </GeneralFixedContent>
      <GeneralFixedStatusWrapper data-testid='general-fixed-status-wrapper'>
        <span data-testid='general-fixed-status'>Active</span>
      </GeneralFixedStatusWrapper>
      <GeneralRulesWrapper data-testid='general-rules-wrapper'>
        <h2 data-testid='general-rules'>Rules</h2>
        <p data-testid='general-rules-secondary'>Applies to all new sign-ups</p>
      </GeneralRulesWrapper>
      <GeneralCheckBoxWrapper data-testid='general-check-box-wrapper'>
        <div>
          <button
            type='button'
            className='rule-control'
            role='checkbox'
            aria-checked='true'
            aria-label='Require email confirmation'
            data-testid='general-rule-control'
          >
            <svg data-testid='general-rule-control-icon' />
          </button>
          <p data-testid='general-check-box'>Require email confirmation</p>
        </div>
      </GeneralCheckBoxWrapper>
      <GeneralEndDateWrapper data-testid='general-end-date-wrapper'>
        <span data-testid='general-end-date'>Ends Dec 31</span>
      </GeneralEndDateWrapper>

      <EmailInputWrapper data-testid='email-input-wrapper'>
        <label data-testid='email-input'>Subject</label>
        <div className='container-title'>
          <label data-testid='email-input-control'>From name</label>
        </div>
      </EmailInputWrapper>
      <EmailDescription data-testid='email-description'>Personalize with merge tags.</EmailDescription>
      <EmailContactWrapper data-testid='email-contact-wrapper'>
        <p data-testid='email-contact'>Need help? Contact support.</p>
      </EmailContactWrapper>

      <HeaderTitle data-testid='header-header-title'>Campaigns</HeaderTitle>
      <div style={{ position: 'relative' }}>
        <HeaderInfoContent data-testid='header-info-content'>Campaigns reach every active user.</HeaderInfoContent>
      </div>

      <ListTable data-testid='list-table-wrapper'>
        <thead>
          <tr>
            <th data-testid='list-table-secondary'>Name</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td data-testid='list-table'>Summer promo</td>
          </tr>
        </tbody>
      </ListTable>
      <ListSwitchWrapper data-testid='list-switch-wrapper'>
        <label className='campaign-enabled' data-testid='list-switch'>Enabled</label>
      </ListSwitchWrapper>
      <ListStatusWrapper data-testid='list-status-wrapper'>
        <p data-testid='list-status'>Active</p>
      </ListStatusWrapper>

      <NotifInputWrapper data-testid='notif-input-wrapper'>
        <label data-testid='notif-input'>Title</label>
      </NotifInputWrapper>
      <NotifDescription data-testid='notif-description'>Push notification preview</NotifDescription>
      <NotifContactWrapper data-testid='notif-contact-wrapper'>
        <p data-testid='notif-contact'>Contact support for delivery issues.</p>
      </NotifContactWrapper>

      <PopupInputWrapper data-testid='popup-input-wrapper'>
        <label data-testid='popup-input'>Popup title</label>
      </PopupInputWrapper>

      <SmsInputWrapper data-testid='sms-input-wrapper'>
        <label data-testid='sms-input'>Message</label>
      </SmsInputWrapper>
      <SmsDescription data-testid='sms-description'>160 characters per segment.</SmsDescription>
      <SmsContactWrapper data-testid='sms-contact-wrapper'>
        <p data-testid='sms-contact'>Contact support for delivery issues.</p>
      </SmsContactWrapper>

      <SignupTitle data-testid='signup-title'>Sign-up bonus</SignupTitle>
      <SignupRadioCheckWrapper data-testid='signup-radio-check-wrapper'>
        <button type='button' aria-pressed='false' data-testid='signup-radio-button'>
          <span data-testid='signup-radio-check'>Give a discount</span>
        </button>
      </SignupRadioCheckWrapper>

      <UsersListTitle data-testid='users-title-wrapper'>
        <h1 data-testid='users-title'>Recipients <span>128</span></h1>
      </UsersListTitle>
      <UsersListTable data-testid='users-table-wrapper'>
        <UsersListTHead>
          <tr>
            <th data-testid='users-thead'>Name</th>
          </tr>
        </UsersListTHead>
        <tbody>
          <tr>
            <td data-testid='users-table'>Ada Lovelace</td>
          </tr>
        </tbody>
      </UsersListTable>

      <WebHookInputWrapper data-testid='webhook-input-wrapper'>
        <label data-testid='webhook-input'>Webhook URL</label>
      </WebHookInputWrapper>
      <WebHookDescription data-testid='webhook-description'>Sends a POST with the campaign payload.</WebHookDescription>

      <WhatsappInputWrapper data-testid='whatsapp-input-wrapper'>
        <label data-testid='whatsapp-input'>WhatsApp message</label>
      </WhatsappInputWrapper>

      {/*
        The seventeen declared preservations. Fifteen of them render here; the
        remaining two are dead CSS and by definition cannot be mounted, because
        the node their selector requires does not exist in the product markup.

        These must NOT move when a role moves. Eleven render a facsimile of the
        message the recipient receives, three size an icon glyph, and one is the
        summernote editor's own sample of a format. The preview nodes are
        mounted as siblings rather than nested, so each declaration is observed
        on its own instead of through the product's own cascade.
      */}
      <section data-testid='a1-preservations'>
        <AmountArrowIconsWrapper data-testid='amount-arrow-icons'>
          <svg data-testid='amount-arrow-icon' />
        </AmountArrowIconsWrapper>

        <ActionSelectorWrapper data-testid='detail-action-icon-wrapper'>
          <button type='button' aria-label='Campaign actions'>
            <svg data-testid='detail-action-icon' />
          </button>
        </ActionSelectorWrapper>

        <EmailPreviewContent data-testid='email-preview'>
          <h2 data-testid='email-preview-title'>Subject line of the email</h2>
        </EmailPreviewContent>
        <EmailPreviewContent data-testid='email-preview-body-host'>
          <p data-testid='email-preview-body'>Body copy of the email</p>
        </EmailPreviewContent>

        <EmailWrapperEditor data-testid='email-editor'>
          <div className='note-editor'>
            <div className='note-dropdown-menu'>
              <h1 data-testid='email-editor-specimen'>Heading 1</h1>
            </div>
          </div>
        </EmailWrapperEditor>

        <NotifSmsPreviewContent data-testid='notif-preview'>
          <h2 data-testid='notif-preview-title'>Notification title</h2>
          <p data-testid='notif-preview-body'>Notification body</p>
        </NotifSmsPreviewContent>

        <SmsPreviewContent data-testid='sms-preview'>
          <h2 data-testid='sms-preview-title'>SMS title</h2>
          <p data-testid='sms-preview-body'>SMS body</p>
        </SmsPreviewContent>

        <WhatsAppMessageContent data-testid='whatsapp-preview'>
          <h2 data-testid='whatsapp-preview-title'>WhatsApp title</h2>
          <p data-testid='whatsapp-preview-body'>WhatsApp body</p>
        </WhatsAppMessageContent>

        <PopupEmailPreviewContent data-testid='popup-email-preview'>
          <p data-testid='popup-email-preview-body'>Popup preview body</p>
        </PopupEmailPreviewContent>
        <PopupContent data-testid='popup-content'>
          <p data-testid='popup-preview-copy'>Popup copy the customer sees</p>
        </PopupContent>
        <PopupHeaderWrapper data-testid='popup-header'>
          <h1 data-testid='popup-preview-title'>Popup title</h1>
          <svg data-testid='popup-close-icon' />
        </PopupHeaderWrapper>
      </section>
    </main>
  )
}
