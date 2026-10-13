import React, { useState, useEffect, useRef } from 'react'
import { useApi, useLanguage } from '../../../../../index'
import { SettingComponent } from './SettingComponent'
import { Button, Input } from '../../../styles'
import { ImageBox, ImageFormatContext } from './ImageBox'
import { Alert, Modal } from '../../Shared'
import { OrderType } from './OrderType'
import { FontStyleGroup } from './FontStyleGroup'
import { LayoutStyleGroup } from '../AdvancedLayouts/LayoutStyleGroup'

import {
  Container,
  BoxLayout,
  HeadingWrapper,
  ImageGroup,
  FormControl,
  ButtonWrapper,
  FaviconHint,
  FaviconPreviewRow,
  FaviconPreviewImage,
  FaviconPreviewHint
} from './styles'
import {
  hasCustomFavicon,
  resolveEffectiveFaviconPreview
} from './resolveEffectiveFaviconPreview'
import { UploadAudio } from '../UploadAudio'
import { isMawejaProject } from './isMawejaProject'
import { AdvancedSettingsUtilities } from './utils'

export const AdvancedSettings = (props) => {
  const {
    themesList,
    advancedValues,
    setAdvancedValues,
    handleUpdateSiteTheme,
    isApp,
    isFranchise,
    isKiosk,
    forcedSiteId,
    siteLogo
  } = props

  const [, t] = useLanguage()
  const [ordering] = useApi()
  const websiteImageFormat = isApp
    ? null
    : { extensionFile: 'jpg, webp', mimeTypeAccept: 'image/jpeg, image/jpg, image/webp' }
  const {
    headerList,
    businessListing,
    businessBlockList,
    businessPageList,
    businessInfoList,
    productBlockList,
    reviewsPopups,
    cartHeaderList,
    checkoutList,
    orderBlockList,
    popupAddressList,
    myAccountList,
    activeOrderBlockList,
    menuOptionList,
    thirdPartyCodeList,
    buttonList,
    homeImageFullScreen,
    navigationBarList,
    smartBannersList,
    trackingSettingsList
  } = AdvancedSettingsUtilities({ isFranchise })

  const [themeStructure, setThemeStructure] = useState({})
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const themeValuesRef = useRef({})

  const [isOpenSound, setIsOpenSound] = useState(false)

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  const updateObject = (object, newValue, path) => {
    if (!path) return
    const stack = path.split('.')
    while (stack.length > 1) {
      const key = stack.shift()
      if (!object[key] || typeof object[key] !== 'object') {
        object[key] = {}
      }
      object = object[key]
    }
    object[stack.shift()] = newValue
  }

  const handleUpdateThemeValue = (value, path) => {
    const _advancedValues = JSON.parse(JSON.stringify(themeValuesRef.current))
    updateObject(_advancedValues, value, path)
    themeValuesRef.current = _advancedValues
    setAdvancedValues(_advancedValues)
  }

  useEffect(() => {
    if (!themesList?.loading && themesList?.themes?.[0]?.structure) {
      setThemeStructure(JSON.parse(JSON.stringify(themesList?.themes?.[0]?.structure)))
    }
  }, [themesList])

  useEffect(() => {
    themeValuesRef.current = JSON.parse(JSON.stringify(advancedValues))
  }, [advancedValues])

  const appDesignLayoutList = [
    { value: 'original', name: 'Original' },
    { value: 'maweja', name: 'Maweja' }
  ]
  const showAppDesign = isApp && !isKiosk && !isFranchise && isMawejaProject(ordering?.project)
  const appDesignLayout = advancedValues?.app_design?.components?.layout?.type
    ? advancedValues.app_design.components.layout
    : { type: 'original' }

  const uploadedFavicon = advancedValues?.general?.components?.favicon?.components?.image
  const showFaviconOptionalHint = !hasCustomFavicon(uploadedFavicon)
  const faviconPreviewUrl = resolveEffectiveFaviconPreview(uploadedFavicon, siteLogo)

  return (
    <ImageFormatContext.Provider value={websiteImageFormat}>
      <Container>
        {isApp && (
          <BoxLayout>
            <h1>{isKiosk ? t('KIOSK_APP_ADVANCED_SETTINGS', 'Kiosk App  Advanced Settings') : t('CUSTOMER_APP_ADVANCED_SETTINGS', 'Customer App  Advanced Settings')}</h1>
            {showAppDesign && (
              <>
                <h2>{t('APP_DESIGN', 'App design')}</h2>
                <HeadingWrapper>
                  <LayoutStyleGroup
                    layoutList={appDesignLayoutList}
                    layouts={appDesignLayout}
                    path='app_design.components.layout'
                    handleUpdateThemeValue={handleUpdateThemeValue}
                  />
                </HeadingWrapper>
              </>
            )}
            <h2>{t('HOMEPAGE', 'Homepage')}</h2>
            <ImageBox
              title={t('HOMEPAGE_IMAGE', 'Homepage image')}
              ratio='1350 x 400 px'
              photo={advancedValues?.my_products?.components?.images?.components?.homepage_background?.components?.image}
              path='my_products.components.images.components.homepage_background.components.image'
              themeId={themesList?.themes?.[0]?.id}
              handleChangePhoto={handleUpdateThemeValue}
            />
          </BoxLayout>
        )}
        {!isKiosk && (
          <>
            {!forcedSiteId && (
              <BoxLayout>
                {!isApp && (
                  <h1>{t('WEBSITE_ADVANCED_SETTINGS', 'Website  Advanced Settings')}</h1>
                )}
                <h2>{t('BUTTONS', 'Buttons')}</h2>
                <SettingComponent
                  settingList={buttonList}
                  handleUpdateThemeValue={handleUpdateThemeValue}
                  advancedValues={advancedValues}
                  themeStructure={themeStructure}
                  themeId={themesList?.themes?.[0]?.id}
                />
                {/* <Button
              color='primary'
              outline
              borderRadius='8px'
              onClick={() => setIsOpenSound(true)}
              className='custom'
            >
              {t('CUSTOM_SOUNDS', 'Custom sounds')}
            </Button> */}
              </BoxLayout>
            )}
            <BoxLayout>
              <h2>{t('TIPOGRAPHY', 'Tipography')}</h2>
              <HeadingWrapper>
                <FontStyleGroup
                  fonts={advancedValues?.general?.components?.fonts?.primary}
                  path='general.components.fonts.primary'
                  handleUpdateThemeValue={handleUpdateThemeValue}
                />
              </HeadingWrapper>
            </BoxLayout>
            <BoxLayout>
              <h2>{t('IMAGES', 'Images')}</h2>
              {!isFranchise && (
                <ImageBox
                  title={t('BUSINESS_LOGO_DUMMY_IMAGE', 'Business Logo dummy image')}
                  ratio='512 x 512 px'
                  photo={advancedValues?.business_view?.components?.header?.components?.logo?.dummy_image}
                  path='business_view.components.header.components.logo.dummy_image'
                  themeId={themesList?.themes?.[0]?.id}
                  handleChangePhoto={handleUpdateThemeValue}
                />
              )}
              {!isFranchise && (
                <SettingComponent
                  settingList={homeImageFullScreen}
                  handleUpdateThemeValue={handleUpdateThemeValue}
                  advancedValues={advancedValues}
                  themeStructure={themeStructure}
                  themeId={themesList?.themes?.[0]?.id}
                  noLabel
                />
              )}
              <ImageGroup>
                <ImageBox
                  title={t('PRODUCT_DUMMY_IMAGE', 'Product dummy image')}
                  ratio='900 x 200 px'
                  photo={advancedValues?.business_view?.components?.products?.components?.photo?.components?.dummy_image}
                  path='business_view.components.products.components.photo.components.dummy_image'
                  themeId={themesList?.themes?.[0]?.id}
                  handleChangePhoto={handleUpdateThemeValue}
                />
              </ImageGroup>
            </BoxLayout>
            <BoxLayout>
              <h2>{t('FAVICON', 'Favicon')}</h2>
              {showFaviconOptionalHint && (
                <FaviconHint>
                  {t('FAVICON_OPTIONAL_HINT', 'Optional. If you do not upload a custom favicon, the site logo is used in the browser tab.')}
                </FaviconHint>
              )}
              <ImageBox
                title={t('FAVICON', 'Favicon')}
                ratio='512 x 512 px'
                photo={uploadedFavicon}
                path='general.components.favicon.components.image'
                themeId={themesList?.themes?.[0]?.id}
                handleChangePhoto={handleUpdateThemeValue}
              />
              {faviconPreviewUrl && (
                <FaviconPreviewRow>
                  <FaviconPreviewImage
                    src={faviconPreviewUrl}
                    alt={t('FAVICON_PREVIEW', 'Favicon preview')}
                    width={32}
                    height={32}
                  />
                  <FaviconPreviewHint>
                    {t('FAVICON_PREVIEW_HINT', 'Currently looks like this.')}
                  </FaviconPreviewHint>
                </FaviconPreviewRow>
              )}
            </BoxLayout>
            <BoxLayout>
              <h2>{t('HEADER', 'Header')}</h2>
              <SettingComponent
                settingList={headerList}
                handleUpdateThemeValue={handleUpdateThemeValue}
                advancedValues={advancedValues}
                themeStructure={themeStructure}
                themeId={themesList?.themes?.[0]?.id}
              />
            </BoxLayout>
            {!isFranchise && (
              <BoxLayout>
                <h2>{t('BUSINESS_LISTING', 'Business listing')}</h2>
                <SettingComponent
                  settingList={businessListing}
                  handleUpdateThemeValue={handleUpdateThemeValue}
                  advancedValues={advancedValues}
                  themeStructure={themeStructure}
                  themeId={themesList?.themes?.[0]?.id}
                />
              </BoxLayout>
            )}
            <BoxLayout>
              <h2>{t('BUSINESS_BLOCK', 'Business block')}</h2>
              {!isFranchise && (
                <ImageBox
                  title={t('BUSINESS_CARD_DEFAULT_HEADER', 'Default header when business has no banner')}
                  ratio='1350 x 400 px'
                  isBig
                  photo={advancedValues?.business_view?.components?.header?.components?.dummy_image}
                  path='business_view.components.header.components.dummy_image'
                  themeId={themesList?.themes?.[0]?.id}
                  handleChangePhoto={handleUpdateThemeValue}
                />
              )}
              <SettingComponent
                settingList={businessBlockList}
                handleUpdateThemeValue={handleUpdateThemeValue}
                advancedValues={advancedValues}
                themeStructure={themeStructure}
                themeId={themesList?.themes?.[0]?.id}
              />
            </BoxLayout>
            <BoxLayout>
              <h2>{t('BUSINESS_PAGE', 'Business page')}</h2>
              <SettingComponent
                settingList={businessPageList}
                handleUpdateThemeValue={handleUpdateThemeValue}
                advancedValues={advancedValues}
                themeStructure={themeStructure}
                themeId={themesList?.themes?.[0]?.id}
              />
            </BoxLayout>
            <BoxLayout>
              <h2>{t('BUSINESS_INFORMATION', 'Business Information')}</h2>
              <SettingComponent
                settingList={businessInfoList}
                handleUpdateThemeValue={handleUpdateThemeValue}
                advancedValues={advancedValues}
                themeStructure={themeStructure}
                themeId={themesList?.themes?.[0]?.id}
              />
            </BoxLayout>
            <BoxLayout>
              <h2>{t('PRODUCTS_BLOCK', 'Products block')}</h2>
              <SettingComponent
                settingList={productBlockList}
                handleUpdateThemeValue={handleUpdateThemeValue}
                advancedValues={advancedValues}
                themeStructure={themeStructure}
                themeId={themesList?.themes?.[0]?.id}
              />
            </BoxLayout>
            <BoxLayout>
              <h2>{t('REVIEWS_POPUPS', 'Reviews popups')}</h2>
              <SettingComponent
                settingList={reviewsPopups}
                handleUpdateThemeValue={handleUpdateThemeValue}
                advancedValues={advancedValues}
                themeStructure={themeStructure}
                themeId={themesList?.themes?.[0]?.id}
              />
            </BoxLayout>
            <BoxLayout>
              <h2>{t('CART_HEADER', 'Cart Header')}</h2>
              <SettingComponent
                settingList={cartHeaderList}
                handleUpdateThemeValue={handleUpdateThemeValue}
                advancedValues={advancedValues}
                themeStructure={themeStructure}
                themeId={themesList?.themes?.[0]?.id}
              />
            </BoxLayout>
            {!isFranchise && (
              <BoxLayout>
                <h2>{t('CHECKOUT', 'Checkout')}</h2>
                <SettingComponent
                  settingList={checkoutList}
                  handleUpdateThemeValue={handleUpdateThemeValue}
                  advancedValues={advancedValues}
                  themeStructure={themeStructure}
                  themeId={themesList?.themes?.[0]?.id}
                />
              </BoxLayout>
            )}
            <BoxLayout>
              <h3>{t('CONFIRMATION_PAGE', 'Confirmation page')}</h3>
              <h3>{t('ORDER_BLOCK', 'Order block')}</h3>
              <SettingComponent
                settingList={orderBlockList}
                handleUpdateThemeValue={handleUpdateThemeValue}
                advancedValues={advancedValues}
                themeStructure={themeStructure}
                themeId={themesList?.themes?.[0]?.id}
              />
            </BoxLayout>
            <BoxLayout>
              <h3>{t('POPUP_ADDRESS', 'Popup: Address')}</h3>
              <SettingComponent
                settingList={popupAddressList}
                handleUpdateThemeValue={handleUpdateThemeValue}
                advancedValues={advancedValues}
                themeStructure={themeStructure}
                themeId={themesList?.themes?.[0]?.id}
              />
            </BoxLayout>
            <BoxLayout>
              <h3>{t('MY_ACCOUNT_PAGE', 'My account page')}</h3>
              <SettingComponent
                settingList={myAccountList}
                handleUpdateThemeValue={handleUpdateThemeValue}
                advancedValues={advancedValues}
                themeStructure={themeStructure}
                themeId={themesList?.themes?.[0]?.id}
              />
            </BoxLayout>
            <BoxLayout>
              <h3>{t('MY_ORDERS', 'My orders')}</h3>
              <h3>{t('ACTIVE_ORDERS_BLOCK', 'Active Orders Block')}</h3>
              <SettingComponent
                settingList={activeOrderBlockList}
                handleUpdateThemeValue={handleUpdateThemeValue}
                advancedValues={advancedValues}
                themeStructure={themeStructure}
                themeId={themesList?.themes?.[0]?.id}
              />
            </BoxLayout>
            {!isApp && (
              <BoxLayout>
                <h2>{t('MENU_OPTIONS', 'Menu options')}</h2>
                <SettingComponent
                  settingList={menuOptionList}
                  handleUpdateThemeValue={handleUpdateThemeValue}
                  advancedValues={advancedValues}
                  themeStructure={themeStructure}
                  themeId={themesList?.themes?.[0]?.id}
                />
              </BoxLayout>
            )}
            {!isFranchise && (
              <BoxLayout>
                <h2>{t('POPUP_ORDER_TYPES', 'Popup: Order types ')}</h2>
                <FormControl>
                  <label>{t('TITLE_MENU_OPTIONS', 'Title Menu options')}</label>
                  <Input
                    placeholder={t('TITLE_MENU_OPTIONS', 'Title Menu options')}
                    defaultValue={advancedValues?.order_types?.components?.title_menu}
                    onChange={(e) => handleUpdateThemeValue(e.target.value, 'order_types.components.title_menu')}
                  />
                </FormControl>
                <h3>{t('DELIVERY', 'Delivery')}</h3>
                <OrderType
                  typeValues={advancedValues?.order_types?.components?.delivery?.components}
                  path='order_types.components.delivery.components'
                  handleUpdateThemeValue={handleUpdateThemeValue}
                  themesList={themesList}
                />
                <h3>{t('PICKUP', 'Pickup')}</h3>
                <OrderType
                  typeValues={advancedValues?.order_types?.components?.pickup?.components}
                  path='order_types.components.pickup.components'
                  handleUpdateThemeValue={handleUpdateThemeValue}
                  themesList={themesList}
                />
                <h3>{t('EAT_IN', 'Eat in')}</h3>
                <OrderType
                  typeValues={advancedValues?.order_types?.components?.eat_in?.components}
                  path='order_types.components.eat_in.components'
                  handleUpdateThemeValue={handleUpdateThemeValue}
                  themesList={themesList}
                />
                <h3>{t('CURBSIDE', 'Curbside')}</h3>
                <OrderType
                  typeValues={advancedValues?.order_types?.components?.curbside?.components}
                  path='order_types.components.curbside.components'
                  handleUpdateThemeValue={handleUpdateThemeValue}
                  themesList={themesList}
                />
                <h3>{t('DRIVE_THRU', 'Drive thru')}</h3>
                <OrderType
                  typeValues={advancedValues?.order_types?.components?.drive_thru?.components}
                  path='order_types.components.drive_thru.components'
                  handleUpdateThemeValue={handleUpdateThemeValue}
                  themesList={themesList}
                />
                <h3>{t('CATERING_DELIVERY', 'Catering delivery')}</h3>
                <OrderType
                  typeValues={advancedValues?.order_types?.components?.catering_delivery?.components}
                  path='order_types.components.catering_delivery.components'
                  handleUpdateThemeValue={handleUpdateThemeValue}
                  themesList={themesList}
                />
                <h3>{t('CATERING_PICKUP', 'CATERING_PICKUP')}</h3>
                <OrderType
                  typeValues={advancedValues?.order_types?.components?.catering_pickup?.components}
                  path='order_types.components.catering_pickup.components'
                  handleUpdateThemeValue={handleUpdateThemeValue}
                  themesList={themesList}
                />
              </BoxLayout>
            )}
            <BoxLayout>
              <h2>{t('THIRD_PARTY_CODE', 'Third-party code')}</h2>
              <SettingComponent
                settingList={thirdPartyCodeList}
                handleUpdateThemeValue={handleUpdateThemeValue}
                advancedValues={advancedValues}
                themeStructure={themeStructure}
                themeId={themesList?.themes?.[0]?.id}
              />
            </BoxLayout>
            {isApp && (
              <>
                <BoxLayout>
                  <h2>{t('NAVIGATION_BAR_MENU', 'Navigation bar menu')}</h2>
                  <SettingComponent
                    settingList={navigationBarList}
                    handleUpdateThemeValue={handleUpdateThemeValue}
                    advancedValues={advancedValues}
                    themeStructure={themeStructure}
                    themeId={themesList?.themes?.[0]?.id}
                  />
                </BoxLayout>
              </>
            )}
            {(isFranchise || !isApp) && (
              <BoxLayout>
                <h2>{t('SMART_BANNER_SETTINGS', 'Smart banners settings')}</h2>
                <SettingComponent
                  settingList={smartBannersList}
                  handleUpdateThemeValue={handleUpdateThemeValue}
                  advancedValues={advancedValues}
                  themeStructure={themeStructure}
                  themeId={themesList?.themes?.[0]?.id}
                />
              </BoxLayout>
            )}
            {!isApp && !isFranchise && (
              <BoxLayout>
                <h2>{t('TRACKING_SETTINGS', 'Order tracking')}</h2>
                <SettingComponent
                  settingList={trackingSettingsList}
                  handleUpdateThemeValue={handleUpdateThemeValue}
                  advancedValues={advancedValues}
                  themeStructure={themeStructure}
                  themeId={themesList?.themes?.[0]?.id}
                  noLabel
                />
              </BoxLayout>
            )}
          </>
        )}
        <ButtonWrapper>
          <Button
            color='primary'
            borderRadius='8px'
            onClick={() => handleUpdateSiteTheme(advancedValues)}
          >
            {t('SAVE', 'Save')}
          </Button>
        </ButtonWrapper>
      </Container>
      {isOpenSound && (
        <Modal
          width='769px'
          padding='25px'
          open={isOpenSound}
          onClose={() => setIsOpenSound(false)}
        >
          <UploadAudio
            onClose={() => setIsOpenSound(false)}
          />
        </Modal>
      )}
      <Alert
        title={t('ORDERING', 'Ordering')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => closeAlert()}
        onAccept={() => closeAlert()}
        closeOnBackdrop={false}
      />
    </ImageFormatContext.Provider>
  )
}
