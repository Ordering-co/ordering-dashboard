import React from 'react'

import {
  AppInfoContainer as APLAppInfoContainer,
  ContentWrapper as APLContentWrapper,
  DownLoadWrapper as APLDownLoadWrapper,
  DownloadBadge as APLDownloadBadge,
  HeaderTitleContainer as APLHeaderTitleContainer,
  InfoContent as APLInfoContent
} from '../../../src/@/components-dashboard/src/ui/src/components/MyProducts/AppLayout/styles'
import {
  CheckBoxWrapper as CDOCheckBoxWrapper,
  CnameNotifyRow as CDOCnameNotifyRow,
  Container as CDOContainer,
  CustomDomainInfoContent as CDOCustomDomainInfoContent,
  FormControl as CDOFormControl,
  TitleWrapper as CDOTitleWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/MyProducts/CustomDomain/styles'
import {
  HeaderTitleContainer as CPRHeaderTitleContainer,
  TextWrapper as CPRTextWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/MyProducts/CustomProject/styles'
import {
  CheckBoxWrapper as OWECheckBoxWrapper,
  ColorPickerWrapper as OWEColorPickerWrapper,
  ContentWrapper as OWEContentWrapper,
  CustomDomainInfoContent as OWECustomDomainInfoContent,
  CustomeDomainDesc as OWECustomeDomainDesc,
  FormGroup as OWEFormGroup,
  HeaderTitleContainer as OWEHeaderTitleContainer,
  ImgInfoWrapper as OWEImgInfoWrapper,
  InfoContent as OWEInfoContent,
  InfoWrapper as OWEInfoWrapper,
  InputFormWrapper as OWEInputFormWrapper,
  MoreSettingsHeader as OWEMoreSettingsHeader,
  Option as OWEOption,
  RadioItem as OWERadioItem,
  SelectWrapper as OWESelectWrapper,
  Tab as OWETab,
  TemporalDomail as OWETemporalDomail,
  UploadImageIcon as OWEUploadImageIcon
} from '../../../src/@/components-dashboard/src/ui/src/components/MyProducts/OrderingWebsite/styles'
import {
  FormGroup as OWIFormGroup,
  HeaderTitleContainer as OWIHeaderTitleContainer,
  InlineContainer as OWIInlineContainer,
  PopupContainer as OWIPopupContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/MyProducts/OrderingWidgets/styles'
import {
  Container as UAUContainer,
  FormControl as UAUFormControl,
  Or as UAUOr,
  PdfIconBox as UAUPdfIconBox,
  UploadIconBox as UAUUploadIconBox
} from '../../../src/@/components-dashboard/src/ui/src/components/MyProducts/UploadAudio/styles'

const APL_BADGE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='135' height='40'><rect width='135' height='40' rx='6' fill='%23222'/></svg>"

const Glyph = ({ testid }) => (
  <svg data-testid={testid} viewBox='0 0 16 16' width='1em' height='1em'><circle cx='8' cy='8' r='7' /></svg>
)

export const LayoutsC4StylesFixture = () => (
  <div data-testid='layouts-c4-styles' style={{ padding: 24, display: 'grid', gap: 12 }}>

    {/* MyProducts/AppLayout */}
    <APLHeaderTitleContainer data-testid='apl-header-title-container-wrap'>
      <h1 data-testid='apl-header-title-container-h1'>My products</h1>
    </APLHeaderTitleContainer>
    <APLInfoContent data-testid='apl-info-content-root'>Ordering website</APLInfoContent>
    {/* 1.4-B5: store badges, as AppLayout renders them (LeftContent > DownLoadWrapper). */}
    <APLDownLoadWrapper data-testid='apl-download-wrapper'>
      <APLDownloadBadge data-testid='apl-download-badge-0' onClick={() => {}}>
        <img src={APL_BADGE} alt='App Store' />
      </APLDownloadBadge>
      <APLDownloadBadge data-testid='apl-download-badge-1' onClick={() => {}}>
        <img src={APL_BADGE} alt='Google Play' />
      </APLDownloadBadge>
    </APLDownLoadWrapper>
    <APLContentWrapper data-testid='apl-content-wrapper-wrap'>
      <h1 data-testid='apl-content-wrapper-h1'>My products</h1>
      <p data-testid='apl-content-wrapper-p'>Build your own website</p>
    </APLContentWrapper>
    <APLAppInfoContainer data-testid='apl-app-info-container-wrap'>
      <h2 data-testid='apl-app-info-container-h2'>More settings</h2>
      <p data-testid='apl-app-info-container-p'>Build your own website</p>
    </APLAppInfoContainer>

    {/* MyProducts/CustomDomain */}
    <CDOContainer data-testid='cdo-container-wrap'>
      <h1 data-testid='cdo-container-h1'>My products</h1>
    </CDOContainer>
    <CDOFormControl data-testid='cdo-form-control-wrap'>
      <label data-testid='cdo-form-control-label'>Domain</label>
      <span data-testid='cdo-form-control-span'>Please make sure your DNS CNAME is pointing</span>
    </CDOFormControl>
    <CDOCnameNotifyRow data-testid='cdo-cname-notify-row-root'>Ordering website</CDOCnameNotifyRow>
    <CDOTitleWrapper data-testid='cdo-title-wrapper-wrap'>
      <label data-testid='cdo-title-wrapper-label'>Domain</label>
    </CDOTitleWrapper>
    <CDOCheckBoxWrapper data-testid='cdo-check-box-wrapper-root'>
      <span data-testid='cdo-check-box-wrapper-span'>Homepage image fullscreen</span>
      <Glyph testid='cdo-check-box-wrapper-svg' />
    </CDOCheckBoxWrapper>
    <CDOCustomDomainInfoContent data-testid='cdo-custom-domain-info-content-root'>Ordering website</CDOCustomDomainInfoContent>

    {/* MyProducts/CustomProject */}
    <CPRHeaderTitleContainer data-testid='cpr-header-title-container-wrap'>
      <h1 data-testid='cpr-header-title-container-h1'>My products</h1>
    </CPRHeaderTitleContainer>
    <CPRTextWrapper data-testid='cpr-text-wrapper-wrap'>
      <h4 data-testid='cpr-text-wrapper-h4'>Create the tailor-made solution</h4>
      <p data-testid='cpr-text-wrapper-p'>Build your own website</p>
      <h2 data-testid='cpr-text-wrapper-h2'>Upload your custom sounds</h2>
    </CPRTextWrapper>

    {/* MyProducts/OrderingWebsite */}
    <OWEHeaderTitleContainer data-testid='owe-header-title-container-wrap'>
      <h1 data-testid='owe-header-title-container-h1'>My products</h1>
    </OWEHeaderTitleContainer>
    <OWEInfoWrapper data-testid='owe-info-wrapper-wrap'>
      <p data-testid='owe-info-wrapper-p'>Build your own website</p>
      <h1 data-testid='owe-info-wrapper-h1'>Ordering website</h1>
    </OWEInfoWrapper>
    <OWEMoreSettingsHeader data-testid='owe-more-settings-header-wrap'>
      <h2 data-testid='owe-more-settings-header-h2'>More settings</h2>
      <p data-testid='owe-more-settings-header-p'>Build your own website</p>
    </OWEMoreSettingsHeader>
    <OWEInputFormWrapper data-testid='owe-input-form-wrapper-wrap'>
      <h4 data-testid='owe-input-form-wrapper-h4'>Site settings</h4>
    </OWEInputFormWrapper>
    <OWEFormGroup data-testid='owe-form-group-wrap'>
      <label data-testid='owe-form-group-label'>Domain</label>
    </OWEFormGroup>
    <OWETemporalDomail data-testid='owe-temporal-domail-root'>Ordering website</OWETemporalDomail>
    <OWEUploadImageIcon data-testid='owe-upload-image-icon-wrap'>
      <span data-testid='owe-upload-image-icon-span'>Homepage image fullscreen</span>
    </OWEUploadImageIcon>
    <OWEImgInfoWrapper data-testid='owe-img-info-wrapper-wrap'>
      <h4 data-testid='owe-img-info-wrapper-h4'>Site settings</h4>
      <p data-testid='owe-img-info-wrapper-p'>Build your own website</p>
    </OWEImgInfoWrapper>
    <OWECheckBoxWrapper data-testid='owe-check-box-wrapper-root'>
      <span data-testid='owe-check-box-wrapper-span'>Homepage image fullscreen</span>
      <Glyph testid='owe-check-box-wrapper-svg' />
    </OWECheckBoxWrapper>
    <OWEColorPickerWrapper data-testid='owe-color-picker-wrapper-wrap'>
      <div><p data-testid='owe-color-picker-wrapper-divp'>Background color</p></div>
    </OWEColorPickerWrapper>
    <OWEContentWrapper data-testid='owe-content-wrapper-wrap'>
      <div><p data-testid='owe-content-wrapper-divp'>Background color</p></div>
    </OWEContentWrapper>
    <OWETab data-testid='owe-tab-root-12px'>Ordering website</OWETab>
    <OWETab data-testid='owe-tab-root-14px' active>Ordering website</OWETab>
    <OWEInfoContent data-testid='owe-info-content-root'>Ordering website</OWEInfoContent>
    <OWERadioItem data-testid='owe-radio-item-root'>
      <span data-testid='owe-radio-item-span'>Homepage image fullscreen</span>
      <Glyph testid='owe-radio-item-svg' />
    </OWERadioItem>
    <OWECustomeDomainDesc data-testid='owe-custome-domain-desc-root'>Ordering website</OWECustomeDomainDesc>
    <OWECustomDomainInfoContent data-testid='owe-custom-domain-info-content-root'>Ordering website</OWECustomDomainInfoContent>
    <OWEOption data-testid='owe-option-wrap'>
      <span data-testid='owe-option-span'>Please make sure your DNS CNAME is pointing</span>
    </OWEOption>
    <OWESelectWrapper data-testid='owe-select-wrapper-wrap'>
      <div className='select' data-testid='owe-select-wrapper-select'>Acme Store</div>
    </OWESelectWrapper>

    {/* MyProducts/OrderingWidgets */}
    <OWIHeaderTitleContainer data-testid='owi-header-title-container-wrap'>
      <h1 data-testid='owi-header-title-container-h1'>My products</h1>
    </OWIHeaderTitleContainer>
    <OWIFormGroup data-testid='owi-form-group-wrap'>
      <label data-testid='owi-form-group-label'>Domain</label>
    </OWIFormGroup>
    <OWIPopupContainer data-testid='owi-popup-container-wrap'>
      <h2 data-testid='owi-popup-container-h2'>More settings</h2>
      <h3 data-testid='owi-popup-container-h3'>Chat style integration</h3>
    </OWIPopupContainer>
    <OWIInlineContainer data-testid='owi-inline-container-wrap'>
      <h2 data-testid='owi-inline-container-h2'>More settings</h2>
    </OWIInlineContainer>

    {/* MyProducts/UploadAudio */}
    <UAUContainer data-testid='uau-container-wrap'>
      <h2 data-testid='uau-container-h2'>Upload your custom sounds</h2>
      <p data-testid='uau-container-p'>Build your own website</p>
    </UAUContainer>
    <UAUUploadIconBox data-testid='uau-upload-icon-box-wrap'>
      <div><p data-testid='uau-upload-icon-box-divp'>Drag and drop</p></div>
      <div><Glyph testid='uau-upload-icon-box-divsvg' /></div>
    </UAUUploadIconBox>
    <UAUOr data-testid='uau-or-root'>Ordering website</UAUOr>
    <UAUFormControl data-testid='uau-form-control-wrap'>
      <label data-testid='uau-form-control-label'>Domain</label>
    </UAUFormControl>
    <UAUPdfIconBox data-testid='uau-pdf-icon-box-wrap'>
      <Glyph testid='uau-pdf-icon-box-svg' />
    </UAUPdfIconBox>
  </div>
)
