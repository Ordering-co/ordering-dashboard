import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  List as MenuIcon,
  Image as DumyPhoto,
  CheckSquareFill as CheckedIcon,
  Square as UnCheckedIcon,
  InfoCircle,
  RecordCircleFill,
  Circle,
  InfoCircleFill
} from 'react-bootstrap-icons'
import { useTheme } from 'styled-components'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { useLanguage, ExamineClick, DragAndDrop, useConfig, useApi, OrderingWebsite as OrderingWebsiteController, useSite } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { useProjectState } from '../../../contexts/ProjectContext'

import { Alert, Confirm, Modal, ImageCrop, ColorPicker, LearnDropDown } from '../../Shared'
import { ContentForm } from '../ContentForm'
import { AdvancedSettings } from '../AdvancedSettings'
import { CustomDomain } from '../CustomDomain'
import { WhiteLabelCustomDomain } from '../WhiteLabelCustomDomain'
import { WhiteLabelCustomDomainBlock } from '../WhiteLabelCustomDomain/WhiteLabelCustomDomainBlock'
import { bytesConverter, learnOptionsValues } from '../../../utils'
import { getDefaultTemporalSiteUrl, getPreferredSiteUrl } from '../../../utils/getPreferredSiteUrl'
import { SelectBusiness } from './SelectBusiness'
import { OrderingWidgets } from '../OrderingWidgets'
import { FilterSettings } from '../../Settings'

import { Button, IconButton, Input, TextArea, DefaultSelect as Select } from '../../../styles'

import {
  Container,
  HeaderTitleContainer,
  WebsiteWrapper,
  InfoWrapper,
  MoreSettingsHeader,
  FormWrapper,
  InputFormWrapper,
  FormGroup,
  InnerBlock,
  TemporalDomail,
  ImageFormGroup,
  LogoImage,
  UploadImageIconContainer,
  UploadImageIcon,
  ImgInfoWrapper,
  BackgroundImage,
  CheckBoxWrapper,
  ColorPickerWrapper,
  ContentWrapper,
  WebsiteButtonWrapper,
  TabWrapper,
  Tabs,
  Tab,
  HeaderInfoWrapper,
  InfoContent,
  RadioItem,
  CustomeDomainDesc,
  TitleWrapper,
  CustomDomainInfo,
  CustomDomainInfoContent,
  WebsiteThemeBlock,
  WebsitePriviewImageWrapper,
  TitleContainer,
  SelectContainer,
  DangerOutlineButton
} from './styles'
import { ImageBoxContainer } from '../AdvancedSettings/styles'
import { CLOUDFLARE_DEPLOYMENT_PROVIDER } from '../../../../../components/OrderingWebsite/constants'

const updateObject = (object, newValue, path) => {
  const stack = path.split('.')
  while (stack.length > 1) {
    object = object[stack.shift()]
  }
  object[stack.shift()] = newValue
}

export const OrderingWebsiteUI = (props) => {
  const {
    themeValues,
    orderingTheme,
    setThemeValues,
    handleUpdateSiteTheme,
    advancedValues,
    setAdvancedValues,
    themesList,
    site,
    setSite,
    businessesList,
    franchisesList,
    handleChangeInput,
    formState,
    handleUpdateSite,
    isDashboard,
    isFranchise,
    setAppIdState,
    forcedSiteId,
    business
  } = props

  const [, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [{ sites }] = useSite()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const theme = useTheme()
  const [ordering, { configurations }] = useApi()
  const location = useLocation()
  const [projectStatus] = useProjectState()
  const temporalIsFranchise = isFranchise || (
    !isDashboard &&
    !forcedSiteId &&
    projectStatus?.websiteProduct === 'web_franchises_x'
  )

  const logoRef = useRef(null)
  const headerRef = useRef(null)
  const headerMobileRef = useRef(null)
  const imageRef = useRef(null)
  const backgroundRef = useRef(null)
  const mobileBackgroundRef = useRef(null)

  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [cropState, setCropState] = useState({ name: null, data: null, open: false })
  const [homePageContent, setHomePageContent] = useState(false)
  const [footerContent, setFooterContent] = useState(false)
  const [selectedSetting, setSelectedSetting] = useState('basic')
  const [isCustomDomain, setIsCustomDomain] = useState(false)
  const [removeDomainConfirm, setRemoveDomainConfirm] = useState({ open: false })
  const [franchiseSelected, setFranchiseSelected] = useState(null)

  const canRemoveCustomDomain = site?.domain && site?.deployment_provider === CLOUDFLARE_DEPLOYMENT_PROVIDER

  const franchiseSites = useMemo(() => sites?.filter(site => site?.type === 'franchiseweb') ?? [], [sites])
  const learnOptions = useMemo(() => learnOptionsValues(
    [
      'ordering_website_general_view',
      'website_basic_settings',
      'website_advanced_settings',
      'website_widget'
    ],
    t
  ), [t])

  const previewImages = useMemo(() => ({
    marketplace: theme.images.preview.marketplace,
    franchise: theme.images.preview.franchise,
    single_store: theme.images.preview.singleStore
  }), [theme.images.preview])

  const settingsList = useMemo(() => [
    { key: 'basic', name: t('BASIC_SETTINGS', 'Basic Settings'), enabled: true },
    { key: 'advanced', name: t('ADVANCED_SETTINGS', 'Advanced Settings'), enabled: !isDashboard },
    { key: 'advanced_layouts', name: t('ADVANCED_LAYOUTS', 'Advanced Layouts'), enabled: false },
    { key: 'ordering_widgets', name: t('ORDERING_WIDGETS', 'Ordering Widgets'), enabled: !isDashboard && !isFranchise && !forcedSiteId }
  ], [t, isDashboard, forcedSiteId])

  const settingsFilterProps = {
    ...props,
    settingsType: 'dashboard_theme',
    allowOptions: [],
    isShowOnlyDetails: true,
    hasNotParentId: true
  }

  const handleClickImage = (type) => {
    if (type === 'logo') {
      logoRef.current.click()
    }

    if (type === 'header') {
      headerRef.current.click()
    }

    if (type === 'logo_mobile') {
      headerMobileRef.current.click()
    }

    if (type === 'image') {
      imageRef.current.click()
    }

    if (type === 'homepage_background') {
      backgroundRef.current.click()
    }

    if (type === 'homepage_mobile_background') {
      mobileBackgroundRef.current.click()
    }
  }

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  const handleChangePhoto = (croppedImg) => {
    if (cropState?.name === 'logo' || cropState?.name === 'image') {
      handleChangeSiteSettings({ target: { name: cropState?.name, value: croppedImg } })
    } else {
      handleChangeValue(croppedImg, 'images', `${cropState?.name === 'header' ? 'logo' : cropState?.name}.components.image`)
    }
    setCropState({ name: null, data: null, open: false })
  }

  const handleFiles = (files, name) => {
    if (files.length === 1) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/webp']
      if (!allowedTypes.includes(files[0].type)) {
        setAlertState({
          open: true,
          content: [t('ERROR_ONLY_JPG_WEBP_IMAGES', 'Only JPG and WEBP images can be accepted')]
        })
        return
      }

      const maxSize = 3072
      const fileSizeKB = bytesConverter(files[0]?.size)
      if (fileSizeKB > maxSize) {
        const sizeLabel = maxSize >= 1024 ? `${maxSize / 1024} MB` : `${maxSize} KB`
        setAlertState({
          open: true,
          content: [t('ERROR_IMAGE_MAXIMUM_SIZE', 'The maximum image size is :size:').replace(':size:', sizeLabel)]
        })
        return
      }
      const reader = new window.FileReader()
      reader.readAsDataURL(files[0])
      reader.onload = () => {
        setCropState({ name, data: reader.result, open: true })
      }
      if (logoRef?.current) logoRef.current.value = null
      if (headerRef?.current) headerRef.current.value = null
      if (headerMobileRef?.current) headerMobileRef.current.value = null
      if (imageRef?.current) imageRef.current.value = null
      if (backgroundRef?.current) backgroundRef.current.value = null
      if (mobileBackgroundRef?.current) mobileBackgroundRef.current.value = null
    }
  }

  const handleChangeValue = (value, section, block) => {
    const _themeValues = JSON.parse(JSON.stringify(themeValues))
    const path = [section, 'components', block].join('.')
    updateObject(_themeValues, value, path)
    setThemeValues(_themeValues)
  }

  const handleChangeSiteSettings = (e) => {
    !isDashboard && handleChangeValue(e.target.value, 'website_settings', `values.${e.target.name}`)
    handleChangeInput(e)
  }

  const handleChangeContent = (type, content) => {
    handleChangeValue(content, 'theme_settings', `values.${type}`)
  }

  const handleChangeTab = (key) => {
    setSelectedSetting(key)
  }

  useEffect(() => {
    if (franchisesList?.loading || !franchisesList?.franchises || isDashboard) return
    if (themeValues?.website_theme?.components?.type === 'franchise') {
      setFranchiseSelected(franchisesList.franchises.find(franchise => franchise?.id === themeValues?.website_theme?.components?.franchise_slug))
    }
  }, [themeValues?.website_theme?.components?.franchise_slug, themeValues?.website_theme?.components?.type, franchisesList])

  useEffect(() => {
    if (!forcedSiteId || !business?.slug || !themeValues?.website_theme?.components) return
    const currentType = themeValues?.website_theme?.components?.type
    const currentSlug = themeValues?.website_theme?.components?.business_slug
    const needsType = currentType !== 'single_store'
    const needsSlug = currentSlug !== business.slug
    if (!needsType && !needsSlug) return
    const _themeValues = JSON.parse(JSON.stringify(themeValues))
    if (needsType) updateObject(_themeValues, 'single_store', 'website_theme.components.type')
    if (needsSlug) updateObject(_themeValues, business.slug, 'website_theme.components.business_slug')
    setThemeValues(_themeValues)
  }, [forcedSiteId, business?.slug, themeValues?.website_theme?.components?.type, themeValues?.website_theme?.components?.business_slug])

  return (
    <>
      <Container>
        {!forcedSiteId && (
          <HeaderTitleContainer>
            {isCollapse && (
              <IconButton
                color='black'
                onClick={() => handleMenuCollapse(false)}
              >
                <MenuIcon />
              </IconButton>
            )}
            <h1>{t('MY_PRODUCTS', 'My products')}</h1>
            {(location.pathname === '/my-products/ordering-website' || location.pathname === '/my-products/customer-app') && (
              <HeaderInfoWrapper>
                <IconButton
                  color='primary'
                >
                  <InfoCircle />
                </IconButton>
                <InfoContent>
                  {t('MY_PRODUCTS_INFO', 'Use the advanced configurations below to customize your products changing the images, colors, available options and others with a few clicks. If you have doubts, please contact our team here:')}
                  <a href={`https://www.${configurations?.subdomain}/support`} rel='noopener noreferrer' target='_blank'>https://www.{configurations?.subdomain}/support</a>
                </InfoContent>
              </HeaderInfoWrapper>
            )}
          </HeaderTitleContainer>
        )}
        {(!isDashboard && !isFranchise && !forcedSiteId && location.pathname !== '/my-products/ordering-website-2') && (
          <WebsiteWrapper>
            <InfoWrapper>
              <TitleContainer>
                <h1>{t('ORDERING_WEBSITE', 'Ordering website')}</h1>
                <LearnDropDown
                  learnOptions={learnOptions}
                />
              </TitleContainer>
              <p>{t('ORDERING_WEBSITE_DESC', 'This product is included in your project by default.')}</p>
              <WebsiteButtonWrapper>
                <Button
                  color='primary'
                  borderRadius='8px'
                  disabled={!projectStatus?.websiteProduct}
                  onClick={() => {
                    const websiteUrl = getPreferredSiteUrl({
                      sites,
                      configurations,
                      configs,
                      ordering,
                      websiteProduct: projectStatus?.websiteProduct
                    })
                    if (websiteUrl) window.open(websiteUrl, '_blank')
                  }}
                >
                  {t('VISIT_MY_WEBSITE', 'Visit My Website')}
                </Button>
              </WebsiteButtonWrapper>
            </InfoWrapper>
            <img src={theme.images.myProducts.orderingWebsite} alt='ordering-website' />
          </WebsiteWrapper>
        )}
        {isFranchise && franchiseSites?.length > 1 && (
          <SelectContainer>
            <Select
              placeholder={t('SELECT_SITE', 'Select site')}
              options={franchiseSites.map(site => ({
                value: site?.code,
                content: site?.name
              }))}
              defaultValue={'web_franchises_x'}
              onChange={(value) => {
                setAppIdState(value)
              }}
              notAsync
            />
          </SelectContainer>
        )}
        <MoreSettingsHeader isDashboard={isDashboard} compact={!!forcedSiteId}>
          {!isDashboard && !forcedSiteId && (
            <>
              <h2>{t('MORE_SETTINGS_FOR_YOUR', 'More settings for your')} <span>{isFranchise ? t('FRANCHISE_WEBSITE', 'Franchise website') : t('WEBSITE_ORIGINAL', 'website')}</span></h2>
              <p>{t('MORE_SETTINGS_YOUR_WEBSITE_DESC', 'Change background, colors, fonts, style, branding and all the essentials of your brand.')}</p>
            </>
          )}
          {settingsList.filter((setting) => setting.enabled).length > 1 && (
            <TabWrapper>
              <Tabs>
                {settingsList.map(setting => (
                  setting.enabled && (
                    <Tab
                      key={setting.key}
                      active={selectedSetting === setting.key}
                      onClick={() => !orderingTheme?.loading && handleChangeTab(setting.key)}
                    >
                      {setting.name}
                    </Tab>
                  )
                ))}
              </Tabs>
            </TabWrapper>
          )}
        </MoreSettingsHeader>
        {selectedSetting === 'basic' && (
          <FormWrapper>
            <InputFormWrapper>
              <InnerBlock isDashboard={isDashboard}>
                <TitleWrapper>
                  <h4>{
                    isDashboard
                      ? t('SETTINGS_DASHBOARD', 'Dashboard settings')
                      : isFranchise
                        ? t('SETTINGS_FRANCHISE_WEBSITE', 'Settings franchise website')
                        : t('WEBSITE_SETTINGS', 'Website settings')}</h4>
                  <CustomDomainInfo>
                    <IconButton
                      color='primary'
                    >
                      <InfoCircleFill />
                    </IconButton>
                    <CustomDomainInfoContent>
                      <span>{t('CUSTOM_DOMAIN_INFO_DESC_1', 'When creating a custom domain, add your domain or subdomain without http protocol or slashes.')}</span>
                      <span>{t('EXAMPLE', 'Example')}: www.customerwebsite.{configurations?.subdomain}.com</span>
                      <span>{t('CUSTOM_DOMAIN_INFO_DESC_2', 'If you have problems with the set-up, please contact our')}<a href={`https://www.${configurations?.subdomain}.com/contact-us`} rel='noopener noreferrer' target='_blank'>{t('CUSTOMER_SUPPORT_TEAM', 'customer support team')}</a></span>
                    </CustomDomainInfoContent>
                  </CustomDomainInfo>
                </TitleWrapper>
                <FormGroup>
                  <label>
                    {orderingTheme?.loading
                      ? (
                        <Skeleton height={20} width={150} />
                        )
                      : (
                        <>
                          {t('NAME', 'Name')}
                        </>
                        )}
                  </label>
                  {orderingTheme?.loading
                    ? (
                      <Skeleton height={40} style={{ width: '100%' }} />
                      )
                    : (
                      <Input
                        name='name'
                        placeholder={
                          isDashboard
                            ? t('SOURCE_DEMO_DASHBOARD', 'Source demo dashboard')
                              ? isFranchise
                              : t('SOURCE_DEMO_FRANCHISE_WEBSITE', 'Source demo franchise website')
                            : t('SOURCE_DEMO_WEBSITE', 'Source demo website')}
                        value={site?.name || ''}
                        onChange={handleChangeSiteSettings}
                      />
                      )}
                </FormGroup>
                <FormGroup>
                  <label>
                    {orderingTheme?.loading
                      ? (
                        <Skeleton height={20} width={150} />
                        )
                      : (
                        <>
                          {t('DESCRIPTION', 'Decription')}
                        </>
                        )}
                  </label>
                  {orderingTheme?.loading
                    ? (
                      <Skeleton height={65} style={{ width: '100%' }} />
                      )
                    : (
                      <TextArea
                        name='description'
                        placeholder={t('DESCRIPTION', 'Decription')}
                        value={site?.description || ''}
                        onChange={handleChangeSiteSettings}
                      />
                      )}
                </FormGroup>
                <FormGroup>
                  <label>
                    {orderingTheme?.loading
                      ? (
                        <Skeleton height={20} width={150} />
                        )
                      : (
                        <>
                          {isDashboard || isFranchise ? t('DEFAULT_DOMAIN', 'Default domain') : t('TEMPORAL_DOMAIN', 'Temporal domain')}
                        </>
                        )}
                  </label>
                  {orderingTheme?.loading
                    ? (
                      <Skeleton height={20} style={{ width: '100%' }} />
                      )
                    : (
                      <TemporalDomail>
                        {(() => {
                          if (!isDashboard && !isFranchise && !forcedSiteId && !projectStatus?.websiteProduct) return null
                          const temporalDomainUrl = getDefaultTemporalSiteUrl({
                            site: forcedSiteId ? site : { type: site?.type, code: site?.code },
                            ordering,
                            configurations,
                            isDashboard,
                            isFranchise: temporalIsFranchise,
                            preserveExplicitSite: !!forcedSiteId
                          })
                          if (!temporalDomainUrl) return null
                          return (
                            <>
                              {t('VISIT', 'Visit')}: <a
                                href={temporalDomainUrl}
                                rel='noopener noreferrer'
                                target='_blank'
                              >
                                {temporalDomainUrl}
                              </a>
                            </>
                          )
                        })()}
                      </TemporalDomail>
                      )}
                </FormGroup>
                <FormGroup>
                  <label>
                    {orderingTheme?.loading
                      ? (
                        <Skeleton height={20} width={150} />
                        )
                      : (
                        <>
                          {t('CUSTOM_DOMAIN', 'Custom domain')}
                        </>
                        )}
                  </label>
                  {orderingTheme?.loading
                    ? (
                      <Skeleton height={40} style={{ width: '100%' }} />
                      )
                    : (
                      <>
                        {forcedSiteId
                          ? (
                            <WhiteLabelCustomDomainBlock
                              site={site}
                              setSite={setSite}
                              onRequestEdit={() => setIsCustomDomain(true)}
                            />
                            )
                          : (
                        <>
                        {site?.domain && site?.ssl_status !== 'error' && (
                          <TemporalDomail marginBottom>
                            {t('VISIT', 'Visit')}: <a href={`https://${site?.domain}`} rel='noopener noreferrer' target='_blank'>https://{site?.domain}</a>
                          </TemporalDomail>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', margin: '10px 0' }}>
                          <Button
                            color='primary'
                            outline
                            borderRadius='8px'
                            onClick={() => setIsCustomDomain(true)}
                          >
                            {site?.domain ? t('CHANGE_CUSTOM_DOMAIN', 'Change custom domain') : t('REQUEST_CUSTOM_DOMAIN', 'Request custom domain')}
                          </Button>
                          {canRemoveCustomDomain && (
                            <DangerOutlineButton
                              outline
                              borderRadius='8px'
                              disabled={formState?.loading}
                              onClick={() => setRemoveDomainConfirm({ open: true })}
                            >
                              {t('REMOVE_CUSTOM_DOMAIN', 'Remove custom domain')}
                            </DangerOutlineButton>
                          )}
                        </div>
                        {site?.domain && (
                          <>
                            {site?.ssl_status === 'issued' && site?.ssl_process_status !== 'pending' && (
                              <CustomeDomainDesc>{t('CUSTOM_DOMAIN_STATUS_ISSUED', 'Your domain is now added , please verify the custom domain link above.')}</CustomeDomainDesc>
                            )}
                            {site?.ssl_status === 'pre-issued' && (
                              <CustomeDomainDesc>{t('CUSTOM_DOMAIN_STATUS_PRE_ISSUED', 'Process almost finish, please wait')}</CustomeDomainDesc>
                            )}
                            {site?.ssl_status === 'error' && (
                              <CustomeDomainDesc>{t('CUSTOM_DOMAIN_STATUS_ERROR', 'Custom domain can\'t be created, please try again with valid data')}</CustomeDomainDesc>
                            )}
                            {((site?.ssl_status === 'pending_validation') || (site?.ssl_status === 'void' && site?.ssl_process_status === 'pending')) && (
                              <CustomeDomainDesc>{t('CUSTOM_DOMAIN_STATUS_PENDING_VALIDATION', 'A custom domain is being created, please wait')}</CustomeDomainDesc>
                            )}
                            {site?.ssl_status === 'revoked' && (
                              <CustomeDomainDesc>{t('CUSTOM_DOMAIN_STATUS_REVOKED', 'Warning: Custom domain is revoked')}</CustomeDomainDesc>
                            )}
                            {site?.ssl_status === 'cancelled' && (
                              <CustomeDomainDesc>{t('CUSTOM_DOMAIN_STATUS_CANCELLED', 'Custom domain is cancelled')}</CustomeDomainDesc>
                            )}
                            {site?.ssl_status === 'expired' && (
                              <CustomeDomainDesc>{t('CUSTOM_DOMAIN_STATUS_EXPIRED', 'Custom domain is expired')}</CustomeDomainDesc>
                            )}
                          </>
                        )}
                            </>
                            )}
                        {forcedSiteId && canRemoveCustomDomain && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', margin: '10px 0' }}>
                            <DangerOutlineButton
                              outline
                              borderRadius='8px'
                              disabled={formState?.loading}
                              onClick={() => setRemoveDomainConfirm({ open: true })}
                            >
                              {t('REMOVE_CUSTOM_DOMAIN', 'Remove custom domain')}
                            </DangerOutlineButton>
                          </div>
                        )}
                      </>
                      )}
                </FormGroup>
              </InnerBlock>
              {isDashboard && !!formState?.changes && Object.keys(formState?.changes).length > 0 && (
                <Button
                  className='save-site-settings'
                  color='primary'
                  borderRadius='8px'
                  onClick={() => handleUpdateSite()}
                  disabled={orderingTheme?.loading}
                >
                  {t('SAVE', 'Save')}
                </Button>
              )}
            </InputFormWrapper>
            {isDashboard && (
              <InputFormWrapper>
                <FilterSettings {...settingsFilterProps} />
              </InputFormWrapper>
            )}
            {!isDashboard && (
              <>
                {!isFranchise && !forcedSiteId && (
                  <InputFormWrapper>
                    <InnerBlock>
                      <h4>{t('WEBSITE_THEME', 'Website Theme')}</h4>
                      {orderingTheme?.loading
                        ? (
                          <Skeleton height={20} width={150} />
                          )
                        : (
                          <WebsiteThemeBlock>
                            <div>
                              <RadioItem
                                onClick={() => handleChangeValue('marketplace', 'website_theme', 'type')}
                              >
                                {themeValues?.website_theme?.components?.type === 'marketplace' ? <RecordCircleFill className='active' /> : <Circle />}
                                <span>{t('MARKETPLACE', 'Marketplace')}</span>
                              </RadioItem>
                              <RadioItem
                                onClick={() => handleChangeValue('single_store', 'website_theme', 'type')}
                              >
                                {themeValues?.website_theme?.components?.type === 'single_store' ? <RecordCircleFill className='active' /> : <Circle />}
                                <span>{t('SINGLE_STORE', 'Single Store')}</span>
                              </RadioItem>
                              {themeValues?.website_theme?.components?.type === 'single_store' && (
                                <SelectBusiness
                                  defaultValue={themeValues?.website_theme?.components?.business_slug}
                                  businessesList={businessesList}
                                  onChange={value => handleChangeValue(value, 'website_theme', 'business_slug')}
                                />
                              )}
                            </div>
                            {themeValues?.website_theme?.components?.type && (
                              <WebsitePriviewImageWrapper>
                                <img src={franchiseSelected?.header || previewImages?.[themeValues?.website_theme?.components?.type]} />
                              </WebsitePriviewImageWrapper>
                            )}
                          </WebsiteThemeBlock>
                          )}
                    </InnerBlock>
                  </InputFormWrapper>
                )}
                <InputFormWrapper>
                  <h4>{t('IMAGES', 'Images')}</h4>
                  <InnerBlock>
                    {orderingTheme?.loading
                      ? (
                        <>
                          <Skeleton height={100} width={100} style={{ marginBottom: '15px' }} />
                          <Skeleton height={15} count={3} width={150} style={{ display: 'block', marginBottom: '7px' }} />
                        </>
                        )
                      : (
                        <ImageFormGroup>
                          <ImageBoxContainer
                            onClick={() => handleClickImage('logo')}
                          >
                            <ExamineClick
                              onFiles={files => handleFiles(files, 'logo')}
                              childRef={(e) => { logoRef.current = e }}
                              accept='image/jpeg, image/jpg, image/webp'
                            >
                              <DragAndDrop
                                onDrop={dataTransfer => handleFiles(dataTransfer.files, 'logo')}
                                accept='image/jpeg, image/jpg, image/webp'
                                disabled={orderingTheme.loading}
                              >
                                {site?.logo && <img src={site?.logo} alt='logo image' loading='lazy' />}
                                <UploadImageIconContainer bgimage={site?.logo || ''}>
                                  <UploadImageIcon>
                                    <DumyPhoto />
                                    <span>{t('DRAG_AND_DROP', 'Drag and drop')}</span>
                                  </UploadImageIcon>
                                </UploadImageIconContainer>
                              </DragAndDrop>
                            </ExamineClick>
                          </ImageBoxContainer>
                          <ImgInfoWrapper>
                            <h4>{t('SITE_LOGO', 'Site logo')}</h4>
                            <p>512 x 512 px</p>
                            <p>{t('FORMAT', 'Format')}: JPG, WEBP</p>
                          </ImgInfoWrapper>
                        </ImageFormGroup>
                        )}
                    {orderingTheme?.loading
                      ? (
                        <>
                          <Skeleton height={100} width={100} style={{ marginBottom: '15px' }} />
                          <Skeleton height={15} count={3} width={150} style={{ display: 'block', marginBottom: '7px' }} />
                        </>
                        )
                      : (
                        <ImageFormGroup>
                          <LogoImage
                            onClick={() => handleClickImage('header')}
                          >
                            <ExamineClick
                              onFiles={files => handleFiles(files, 'header')}
                              childRef={(e) => { headerRef.current = e }}
                              accept='image/jpeg, image/jpg, image/webp'
                            >
                              <DragAndDrop
                                onDrop={dataTransfer => handleFiles(dataTransfer.files, 'header')}
                                accept='image/jpeg, image/jpg, image/webp'
                                disabled={orderingTheme.loading}
                              >
                                {themeValues?.images?.components?.logo?.components?.image && <img src={themeValues?.images?.components?.logo?.components?.image} alt='header image' loading='lazy' />}
                                <UploadImageIconContainer bgimage={themeValues?.images?.components?.logo?.components?.image}>
                                  <UploadImageIcon>
                                    <DumyPhoto />
                                    <span>{t('DRAG_AND_DROP', 'Drag and drop')}</span>
                                  </UploadImageIcon>
                                </UploadImageIconContainer>
                              </DragAndDrop>
                            </ExamineClick>
                          </LogoImage>
                          <ImgInfoWrapper>
                            <h4>{t('HEADER_LOGO', 'Header logo')}</h4>
                            <p>900 x 200 px</p>
                            <p>{t('FORMAT', 'Format')}: JPG, WEBP</p>
                          </ImgInfoWrapper>
                        </ImageFormGroup>
                        )}
                    {orderingTheme?.loading
                      ? (
                        <>
                          <Skeleton height={100} width={100} style={{ marginBottom: '15px' }} />
                          <Skeleton height={15} count={3} width={150} style={{ display: 'block', marginBottom: '7px' }} />
                        </>
                        )
                      : (
                        <ImageFormGroup>
                          <ImageBoxContainer
                            onClick={() => handleClickImage('logo_mobile')}
                          >
                            <ExamineClick
                              onFiles={files => handleFiles(files, 'logo_mobile')}
                              childRef={(e) => { headerMobileRef.current = e }}
                              accept='image/jpeg, image/jpg, image/webp'
                            >
                              <DragAndDrop
                                onDrop={dataTransfer => handleFiles(dataTransfer.files, 'logo_mobile')}
                                accept='image/jpeg, image/jpg, image/webp'
                                disabled={orderingTheme.loading}
                              >
                                {themeValues?.images?.components?.logo_mobile?.components?.image && <img src={themeValues?.images?.components?.logo_mobile?.components?.image} alt='header mobile image' loading='lazy' />}
                                <UploadImageIconContainer bgimage={themeValues?.images?.components?.logo_mobile?.components?.image}>
                                  <UploadImageIcon>
                                    <DumyPhoto />
                                    <span>{t('DRAG_AND_DROP', 'Drag and drop')}</span>
                                  </UploadImageIcon>
                                </UploadImageIconContainer>
                              </DragAndDrop>
                            </ExamineClick>
                          </ImageBoxContainer>
                          <ImgInfoWrapper>
                            <h4>{t('HEADER_MOBILE_LOGO', 'Header mobile logo')}</h4>
                            <p>512 x 512 px</p>
                            <p>{t('FORMAT', 'Format')}: JPG, WEBP</p>
                          </ImgInfoWrapper>
                        </ImageFormGroup>
                        )}
                    {!isFranchise && (
                      <>
                        {orderingTheme?.loading
                          ? (
                            <>
                              <Skeleton height={100} style={{ marginBottom: '15px', width: '100%' }} />
                              <Skeleton height={15} count={3} width={150} style={{ display: 'block', marginBottom: '7px' }} />
                            </>
                            )
                          : (
                            <ImageFormGroup>
                              <BackgroundImage
                                onClick={() => handleClickImage('image')}
                              >
                                <ExamineClick
                                  onFiles={files => handleFiles(files, 'image')}
                                  childRef={(e) => { imageRef.current = e }}
                                  accept='image/jpeg, image/jpg, image/webp'
                                >
                                  <DragAndDrop
                                    onDrop={dataTransfer => handleFiles(dataTransfer.files, 'image')}
                                    accept='image/jpeg, image/jpg, image/webp'
                                    disabled={orderingTheme.loading}
                                  >
                                    {site?.image && <img src={site?.image} alt='logo image' loading='lazy' />}
                                    <UploadImageIconContainer bgimage={site?.image}>
                                      <UploadImageIcon>
                                        <DumyPhoto />
                                        <span>{t('DRAG_AND_DROP', 'Drag and drop')}</span>
                                      </UploadImageIcon>
                                    </UploadImageIconContainer>
                                  </DragAndDrop>
                                </ExamineClick>
                              </BackgroundImage>
                              <ImgInfoWrapper>
                                <h4>{t('SITE_IMAGE', 'Site image')}</h4>
                                <p>1920 x 1280 px</p>
                                <p>{t('FORMAT', 'Format')}: JPG, WEBP</p>
                              </ImgInfoWrapper>
                            </ImageFormGroup>
                            )}
                      </>
                    )}
                    {orderingTheme?.loading
                      ? (
                        <>
                          <Skeleton height={100} style={{ marginBottom: '15px', width: '100%' }} />
                          <Skeleton height={15} count={3} width={150} style={{ display: 'block', marginBottom: '7px' }} />
                        </>
                        )
                      : (
                        <ImageFormGroup>
                          <BackgroundImage
                            onClick={() => handleClickImage('homepage_background')}
                          >
                            <ExamineClick
                              onFiles={files => handleFiles(files, 'homepage_background')}
                              childRef={(e) => { backgroundRef.current = e }}
                              accept='image/jpeg, image/jpg, image/webp'
                            >
                              <DragAndDrop
                                onDrop={dataTransfer => handleFiles(dataTransfer.files, 'homepage_background')}
                                accept='image/jpeg, image/jpg, image/webp'
                                disabled={orderingTheme.loading}
                              >
                                {themeValues?.images?.components?.homepage_background?.components?.image && <img src={themeValues?.images?.components?.homepage_background?.components?.image} alt='backgrond image' loading='lazy' />}
                                <UploadImageIconContainer bgimage={!!themeValues?.images?.components?.homepage_background?.components?.image}>
                                  <UploadImageIcon>
                                    <DumyPhoto />
                                    <span>{t('DRAG_AND_DROP', 'Drag and drop')}</span>
                                  </UploadImageIcon>
                                </UploadImageIconContainer>
                              </DragAndDrop>
                            </ExamineClick>
                          </BackgroundImage>
                          <ImgInfoWrapper>
                            <h4>{t('HOMEPAGE_BACKGROUND', 'Homepage background')}</h4>
                            <p>1920 x 1280 px</p>
                            <p>{t('FORMAT', 'Format')}: JPG, WEBP</p>
                          </ImgInfoWrapper>
                        </ImageFormGroup>
                        )}
                    {orderingTheme?.loading
                      ? (
                        <>
                          <Skeleton height={100} style={{ marginBottom: '15px', width: '100%' }} />
                          <Skeleton height={15} count={3} width={150} style={{ display: 'block', marginBottom: '7px' }} />
                        </>
                        )
                      : (
                        <ImageFormGroup>
                          <BackgroundImage
                            onClick={() => handleClickImage('homepage_mobile_background')}
                          >
                            <ExamineClick
                              onFiles={files => handleFiles(files, 'homepage_mobile_background')}
                              childRef={(e) => { mobileBackgroundRef.current = e }}
                              accept='image/jpeg, image/jpg, image/webp'
                            >
                              <DragAndDrop
                                onDrop={dataTransfer => handleFiles(dataTransfer.files, 'homepage_mobile_background')}
                                accept='image/jpeg, image/jpg, image/webp'
                                disabled={orderingTheme.loading}
                              >
                                {themeValues?.images?.components?.homepage_mobile_background?.components?.image && <img src={themeValues?.images?.components?.homepage_mobile_background?.components?.image} alt='backgrond image' loading='lazy' />}
                                <UploadImageIconContainer bgimage={!!themeValues?.images?.components?.homepage_mobile_background?.components?.image}>
                                  <UploadImageIcon>
                                    <DumyPhoto />
                                    <span>{t('DRAG_AND_DROP', 'Drag and drop')}</span>
                                  </UploadImageIcon>
                                </UploadImageIconContainer>
                              </DragAndDrop>
                            </ExamineClick>
                          </BackgroundImage>
                          <ImgInfoWrapper>
                            <h4>{t('HOMEPAGE_MOBILE_BACKGROUND', 'Homepage mobile background')}</h4>
                            <p>1440 x 770 px</p>
                            <p>{t('FORMAT', 'Format')}: JPG, WEBP</p>
                          </ImgInfoWrapper>
                        </ImageFormGroup>
                        )}
                    {orderingTheme?.loading
                      ? (
                        <Skeleton width={200} height={20} />
                        )
                      : (
                        <CheckBoxWrapper
                          onClick={() => handleChangeValue(!themeValues?.images?.components?.homepage_image_fullscreen, 'images', 'homepage_image_fullscreen')}
                        >
                          {themeValues?.images?.components?.homepage_image_fullscreen
                            ? (
                              <CheckedIcon className='active' />
                              )
                            : (
                              <UnCheckedIcon />
                              )}
                          <span>{t('HOMEPAGE_IMAGE_FULLSCREEN', 'Homepage  image fullscreen')}</span>
                        </CheckBoxWrapper>
                        )}
                  </InnerBlock>
                </InputFormWrapper>
                {!orderingTheme?.loading && (
                  <InputFormWrapper>
                    <h4>{t('THEME_SETTINGS', 'Theme Settings')}</h4>
                    <InnerBlock>
                      <ContentWrapper>
                        <ColorPickerWrapper>
                          <div>
                            <p>{t('BACKGROUND_COLOR', 'Background color')}</p>
                            <ColorPicker
                              defaultColor={themeValues?.theme_settings?.components?.style?.background_page ?? '#FFFFFF'}
                              onChangeColor={(color) => handleChangeValue(color, 'theme_settings', 'style.background_page')}
                            />
                          </div>
                        </ColorPickerWrapper>
                        <ColorPickerWrapper>
                          <div>
                            <p>{t('PRIMARY_COLOR_BUTTONS', 'Primary Color for Buttons')}</p>
                            <ColorPicker
                              defaultColor={themeValues?.theme_settings?.components?.style?.primary_btn_color}
                              onChangeColor={(color) => handleChangeValue(color, 'theme_settings', 'style.primary_btn_color')}
                            />
                          </div>
                        </ColorPickerWrapper>
                      </ContentWrapper>
                      <ContentWrapper>
                        <div>
                          <p>{t('HOMEPAGE_CONTENT', 'Homepage Content')}</p>
                          <Button
                            color='primary'
                            borderRadius='8px'
                            outline
                            onClick={() => setHomePageContent(true)}
                          >
                            {t('HOMEPAGE_CONTENT', 'Homepage content')}
                          </Button>
                        </div>
                        <div>
                          <p>{t('FOOTER_CONTENT', 'Footer Content')}</p>
                          <Button
                            color='primary'
                            borderRadius='8px'
                            outline
                            onClick={() => setFooterContent(true)}
                          >
                            {t('FOOTER_CONTENT', 'Footer content')}
                          </Button>
                        </div>
                      </ContentWrapper>
                    </InnerBlock>
                  </InputFormWrapper>
                )}

                <Button
                  color='primary'
                  borderRadius='8px'
                  onClick={() => handleUpdateSiteTheme()}
                  disabled={orderingTheme?.loading}
                >
                  {t('SAVE', 'Save')}
                </Button>
              </>
            )}
          </FormWrapper>
        )}
        {selectedSetting === 'advanced' && (
          <>
            {!orderingTheme?.loading && (
              <AdvancedSettings
                themesList={themesList}
                advancedValues={advancedValues}
                setAdvancedValues={setAdvancedValues}
                handleUpdateSiteTheme={handleUpdateSiteTheme}
                isFranchise={isFranchise}
                forcedSiteId={forcedSiteId}
                siteLogo={site?.logo}
              />
            )}
          </>
        )}
        {selectedSetting === 'ordering_widgets' && (
          <OrderingWidgets hideSideBar />
        )}
      </Container>
      <Alert
        title={t('ORDERING', 'Ordering')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => closeAlert()}
        onAccept={() => closeAlert()}
        closeOnBackdrop={false}
      />
      {cropState?.open && (
        <Modal
          width='700px'
          height='80vh'
          padding='30px'
          title={t('IMAGE_CROP', 'Image crop')}
          open={cropState?.open}
          onRemove={() => setCropState({ ...cropState, open: false })}
        >
          <ImageCrop
            themeId={orderingTheme?.themes?.[0]?.theme_id}
            aspectRatio={cropState?.name === 'logo' || cropState?.name === 'logo_mobile' ? 1 : null}
            useCloudinaryUrl
            photo={cropState?.data}
            handleChangePhoto={handleChangePhoto}
          />
        </Modal>
      )}
      {homePageContent && (
        <Modal
          width='70%'
          open={homePageContent}
          onClose={() => setHomePageContent(false)}
        >
          <ContentForm
            title={t('HOME_PAGE_CONTENT', 'Home Page Content')}
            content={themeValues?.theme_settings?.components?.values?.homepage_content}
            onClose={() => setHomePageContent(false)}
            handleChangeContent={handleChangeContent}
            type='homepage_content'
          />
        </Modal>
      )}
      {footerContent && (
        <Modal
          width='70%'
          open={footerContent}
          onClose={() => setFooterContent(false)}
        >
          <ContentForm
            title={t('FOOTER', 'Footer')}
            content={themeValues?.theme_settings?.components?.values?.footer_content}
            onClose={() => setFooterContent(false)}
            handleChangeContent={handleChangeContent}
            type='footer_content'
          />
        </Modal>
      )}
      <Confirm
        title={t('ORDERING', 'Ordering')}
        content={t('CONFIRM_REMOVE_CUSTOM_DOMAIN', 'Are you sure you want to remove this custom domain?')}
        acceptText={t('REMOVE', 'Remove')}
        cancelText={t('CANCEL', 'Cancel')}
        open={removeDomainConfirm.open}
        onClose={() => setRemoveDomainConfirm({ open: false })}
        onCancel={() => setRemoveDomainConfirm({ open: false })}
        onAccept={() => {
          setRemoveDomainConfirm({ open: false })
          handleUpdateSite({ domain: null })
        }}
        closeOnBackdrop={false}
      />
      {isCustomDomain && (
        <Modal
          width='70%'
          open={isCustomDomain}
          onClose={() => setIsCustomDomain(false)}
        >
          {forcedSiteId
            ? (
              <WhiteLabelCustomDomain
                site={site}
                setSite={setSite}
                onClose={() => setIsCustomDomain(false)}
              />
              )
            : (
              <CustomDomain
                site={site}
                onClose={() => setIsCustomDomain(false)}
                setSite={setSite}
                disableDescriptionInfo
                isFranchise={isFranchise}
              />
              )}
        </Modal>
      )}
    </>
  )
}

export const OrderingWebsite = (props) => {
  const orderingWebsiteProps = {
    ...props,
    UIComponent: OrderingWebsiteUI
  }
  return <OrderingWebsiteController {...orderingWebsiteProps} />
}
