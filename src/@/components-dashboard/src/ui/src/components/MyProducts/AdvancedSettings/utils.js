import { useLanguage } from '../../../../../index'

export const AdvancedSettingsUtilities = ({ isFranchise }) => {
  const [, t] = useLanguage()

  const headerList = [
    { name: t('BACKGROUND_COLOR', 'Background color'), type: 'color', path: 'header.components.style.backgroundColor' },
    { name: t('LOGO_POSITION', 'Logo Position'), type: 'position', path: 'header.components.logo.components.layout.position' },
    { name: t('LANGUAGE_SELECTOR', 'Language selector'), type: 'hidden', path: 'header.components.language_selector.hidden' }
  ]

  const businessListing = [
    { name: '', type: 'hidden', path: 'business_listing_view.hidden' },
    { name: t('BUSINESS_LISTING_IMAGE', 'Business listing image'), type: 'image', path: 'business_listing_view.components.business_hero.components.image' },
    { name: t('TOP_SPONSORED_BUSINESS_BLOCK', 'Top / Sponsored business block'), type: 'hidden', path: 'business_listing_view.components.highest_rated_business_block.hidden' },
    { name: t('CATEGORIES_BLOCK', 'Categories block'), type: 'hidden', path: 'business_listing_view.components.categories.hidden' },
    { name: t('AMOUNT_OF_BUSINESSES_TO_DISPLAY_PER_ROW', 'Amount of businesses to display per row:'), type: 'position', path: 'business_listing_view.components.layout.rows' },
    { name: t('CITIES_DROPDOWN', 'Cities dropdown'), type: 'hidden', path: 'business_listing_view.components.cities.hidden' }
  ]

  const businessBlockList = [
    { name: t('LOGO', 'Logo'), type: 'hidden', path: 'business_listing_view.components.business.components.logo.hidden', disabled: isFranchise },
    { name: t('HEADER', 'Header'), type: 'hidden', path: 'business_listing_view.components.business.components.header.hidden', disabled: isFranchise },
    { name: t('DELIVERY_FEE', 'Delivery Fee'), type: 'hidden', path: 'business_listing_view.components.business.components.fee.hidden' },
    { name: t('TIME', 'Time'), type: 'hidden', path: 'business_listing_view.components.business.components.time.hidden' },
    { name: t('DISTANCE', 'Distance'), type: 'hidden', path: 'business_listing_view.components.business.components.distance.hidden' },
    { name: t('REVIEWS', 'Reviews'), type: 'hidden', path: 'business_listing_view.components.business.components.reviews.hidden', disabled: isFranchise },
    { name: t('FAVORITE_BUTTON', 'Favorite button'), type: 'hidden', path: 'business_listing_view.components.business.components.favorite.hidden' },
    { name: t('OFFER_BADGE', 'Offer badge'), type: 'hidden', path: 'business_listing_view.components.business.components.offer.hidden', disabled: isFranchise },
    // { name: t('OFFER_BADGE_POSITION', 'Offer badge position'), type: 'position', path: 'business_listing_view.components.business.components.offer.position' },
    { name: t('FEATURED_BADGE', 'Featured badge'), type: 'hidden', path: 'business_listing_view.components.business.components.featured_badge.hidden' }
  ]

  const businessPageList = [
    // { name: t('DEFAULT_BACKGROUND_COLOR', 'Default Background color'), type: 'color', path: 'business_view.components.style.backgroundColor' },
    { name: t('PRODUCTS_FROM_PREVIOUS_ORDERS_BLOCK', 'Products from previous orders block'), type: 'hidden', path: 'business_view.components.products_ordered.hidden' },
    { name: t('NEAR_BUSINESS_BLOCK', 'Near business block'), type: 'hidden', path: 'business_view.components.near_business.hidden' },
    { name: t('REVIEWS', 'Reviews'), type: 'hidden', path: 'business_view.components.reviews.hidden' },
    { name: t('CUSTOMER_COMMENTS', 'Customer comments'), type: 'hidden', path: 'business_view.components.reviews.components.customer_comments.hidden' },
    { name: t('RANKING', 'Ranking'), type: 'hidden', path: 'business_view.components.reviews.components.ranking.hidden' },
    { name: t('REVIEWS_DATE', 'Reviews date'), type: 'hidden', path: 'business_view.components.reviews.components.review_date.hidden' },
    { name: t('SEARCH', 'Search'), type: 'hidden', path: 'business_view.components.reviews.components.search.hidden' },
    { name: t('BUSINESS_LOGO', 'Business logo'), type: 'hidden', path: 'business_view.components.header.components.logo.hidden' },
    { name: t('BUSINESS_INFO_ICON', 'Business info icon'), type: 'hidden', path: 'business_view.components.header.components.business_info.hidden' },
    { name: t('BUSINESS_HEADER', 'Business header'), type: 'hidden', path: 'business_view.components.header.hidden' },
    { name: t('BUSINESS_HEADER_REVIEWS', 'Business header reviews'), type: 'hidden', path: 'business_view.components.header.components.business.components.reviews.hidden' },
    { name: t('BUSINESS_POPUP_REVIEWS', 'Business popup reviews'), type: 'hidden', path: 'business_view.components.header.components.reviews.hidden' },
    { name: t('SHOW_FIRST_CATEGORIES', 'Show first categories'), type: 'hidden', path: 'business_view.components.categories.components.show_first_categories.hidden', disabled: !isFranchise }

  ]

  const businessInfoList = [
    { name: t('ABOUT', 'About'), type: 'hidden', path: 'business_view.components.information.components.about.hidden' },
    { name: t('DESCRIPTION', 'Description'), type: 'hidden', path: 'business_view.components.information.components.description.hidden' },
    { name: t('SCHEDULE', 'Schedule'), type: 'hidden', path: 'business_view.components.information.components.schedule.hidden' },
    { name: t('LOCATION', 'Location'), type: 'hidden', path: 'business_view.components.information.components.location.hidden' },
    { name: t('VIDEOS', 'Videos'), type: 'hidden', path: 'business_view.components.information.components.videos.hidden', disabled: isFranchise },
    { name: t('MENU_LIST_DELIVERY_TIME', 'Delivery time'), type: 'hidden', path: 'business_view.components.information.components.delivery_time.hidden' },
    { name: t('PICKUP_TIME', 'Pickup time'), type: 'hidden', path: 'business_view.components.information.components.pickup_time.hidden' },
    { name: t('IMAGES', 'Images'), type: 'hidden', path: 'business_view.components.information.components.images.hidden', disabled: isFranchise },
    { name: t('ADDRESS', 'Address'), type: 'hidden', path: 'business_view.components.information.components.address.hidden' }
  ]

  const productBlockList = [
    { name: t('DUMMY_IMAGE_WHEN_NO_IMAGE', 'Dummy image when no image'), type: 'hidden', path: 'business_view.components.products.components.product.components.dummy.hidden' },
    { name: t('DESCRIPTION', 'Description'), type: 'hidden', path: 'business_view.components.products.components.product.components.description.hidden' },
    { name: t('IMAGE', 'Image'), type: 'hidden', path: 'business_view.components.products.components.product.components.image.hidden' },
    { name: t('POSITION', 'Position'), type: 'position', path: 'business_view.components.products.components.product.components.image.position' },
    { name: t('ADD_TO_CART_BUTTON', 'Add to cart button'), type: 'hidden', path: 'business_view.components.products.components.add_to_cart_button.hidden' },
    { name: t('FAVORITE', 'Favorite'), type: 'hidden', path: 'business_view.components.products.components.product.components.favorite.hidden' }
  ]

  const reviewsPopups = [
    { name: t('REVIEW_DATE', 'Review date'), type: 'hidden', path: 'business_view.components.reviews.components.review_date.hidden' }
  ]

  const cartHeaderList = [
    { name: t('BUSINESS_LOGO', 'Business logo'), type: 'hidden', path: 'header.components.cart.components.business.components.logo.hidden' },
    { name: t('PRODUCT_IMAGE', 'Product image'), type: 'hidden', path: 'header.components.cart.components.products.components.image.hidden' },
    { name: t('DISCOUNT_COUPON', 'Discount coupon'), type: 'hidden', path: 'header.components.cart.components.discount_coupon.hidden', disabled: isFranchise },
    { name: t('COMMENTS', 'Comments'), type: 'hidden', path: 'header.components.cart.components.comments.hidden', disabled: isFranchise },
    { name: t('OPEN_STRATEGY', 'Open strategy'), type: 'position', path: 'header.components.cart.components.open_strategy.type', disabled: isFranchise },
    { name: t('OPEN_STRATEGY_POSITION', 'Open strategy position'), type: 'position', path: 'header.components.cart.components.open_strategy.position', disabled: isFranchise }
  ]

  const checkoutList = [
    { name: t('BUSINESS_ADDRESS', 'Business address'), type: 'hidden', path: 'checkout.components.business.components.address.hidden' },
    { name: t('MAP', 'Map'), type: 'hidden', path: 'checkout.components.map.hidden' }
  ]

  const orderBlockList = [
    { name: t('DATE', 'Date'), type: 'hidden', path: 'confirmation.components.order.components.date.hidden' },
    { name: t('PROGRESS_BAR', 'Progress bar'), type: 'hidden', path: 'confirmation.components.order.components.progress.hidden' }
  ]

  const popupAddressList = [
    { name: t('MAP', 'Map'), type: 'hidden', path: 'address.components.map.hidden' },
    { name: t('INTERNAL_NUMBER', 'Internal number'), type: 'hidden', path: 'address.components.internal_number.hidden' },
    { name: t('ADDRESS_NOTES', 'Address notes'), type: 'hidden', path: 'address.components.address_notes.hidden' },
    { name: t('ICONS', 'Icons'), type: 'hidden', path: 'address.components.icons.hidden' }
  ]

  const myAccountList = [
    { name: t('USER_IMAGE', 'User image'), type: 'hidden', path: 'profile.components.picture.hidden' },
    { name: t('EXPORT_BIRTHDAY', 'Birthday'), type: 'hidden', path: 'profile.components.birthday.hidden', disabled: isFranchise },
    { name: t('LANGUAGES', 'Languages'), type: 'hidden', path: 'profile.components.languages.hidden' },
    { name: t('ADDRESS_LIST', 'Address list'), type: 'hidden', path: 'profile.components.address_list.hidden' }
  ]

  const activeOrderBlockList = [
    { name: t('BUSINESS_LOGO', 'Business logo'), type: 'hidden', path: 'orders.components.business_logo.hidden' },
    { name: t('EXPORT_BUSINESS_NAME', 'Business name'), type: 'hidden', path: 'orders.components.business_name.hidden' },
    { name: t('ORDER_NUMBER', 'Order number'), type: 'hidden', path: 'orders.components.order_number.hidden' },
    { name: t('ORDER_DATE', 'Order date'), type: 'hidden', path: 'orders.components.date.hidden' },
    { name: t('EXPORT_REVIEW_ORDER_BUTTON', 'Review order button'), type: 'hidden', path: 'orders.components.review_order_button.hidden' },
    { name: t('EXPORT_REORDER_BUTTON', 'Reorder button'), type: 'hidden', path: 'orders.components.reorder_button.hidden' },
    { name: t('FAVORITE_BUTTON', 'Favorite button'), type: 'hidden', path: 'orders.components.favorite.hidden' },
    { name: t('ORDER_STATUS', 'Order status'), type: 'hidden', path: 'orders.components.order_status.hidden' },
    { name: t('EXPORT_PREVIOUS_ORDER_BLOCK', 'Previous order block'), type: 'hidden', path: 'orders.components.past_orders.hidden' },
    { name: t('EXPORT_BUSINESS_TAB', 'Business tab'), type: 'hidden', path: 'orders.components.business_tab.hidden' },
    { name: t('EXPORT_PRODUCTS_TAB', 'Products tab'), type: 'hidden', path: 'orders.components.products_tab.hidden' }
  ]

  const menuOptionList = [
    { name: t('EXPORT_BROWSE_AND_SEARCH', 'Browse and search'), type: 'hidden', path: 'bar_menu.components.browse.hidden', disabled: isFranchise },
    { name: t('WALLETS', 'Wallets'), type: 'hidden', path: 'bar_menu.components.wallet.hidden' },
    { name: t('PROMOTIONS', 'Promotions'), type: 'hidden', path: 'bar_menu.components.promotions.hidden' },
    { name: t('MESSAGES', 'Messages'), type: 'hidden', path: 'bar_menu.components.messages.hidden' },
    { name: t('HELP', 'Help'), type: 'hidden', path: 'bar_menu.components.help.hidden' },
    { name: t('EXPORT_SECURITY', 'Security'), type: 'hidden', path: 'bar_menu.components.sessions.hidden' },
    { name: t('EXPORT_MY_FAVORITES', 'My favorites'), type: 'hidden', path: 'bar_menu.components.favorites.hidden' }
  ]

  const thirdPartyCodeList = [
    { name: t('EXPORT_HEAD', 'Head'), type: 'input', path: 'third_party_code.head' },
    { name: t('EXPORT_BODY', 'Body'), type: 'input', path: 'third_party_code.body' }
  ]

  const buttonList = [
    { name: t('BUTTON_COLOR', 'Button color'), type: 'color', path: 'general.components.buttons.color' },
    { name: t('BORDER_RADIUS', 'Border radius'), type: 'input', path: 'general.components.buttons.borderRadius' },
    { name: t('BUTTON_TEXT_COLOR', 'Button text color'), type: 'color', path: 'general.components.buttons.buttonTextColor' }
  ]

  const homeImageFullScreen = [
    { name: t('HOMEPAGE_IMAGE_FULLSCREEN', 'Homepage image fullscreen'), type: 'hidden', path: 'my_products.components.images.components.homepage_image_fullscreen' }
  ]

  const navigationBarList = [
    { name: t('BROWSE', 'Browse'), type: 'hidden', path: 'bar_menu.components.browse.hidden' },
    { name: t('ORDERS', 'Orders'), type: 'hidden', path: 'bar_menu.components.orders.hidden' },
    { name: t('MY_CARTS', 'My carts'), type: 'hidden', path: 'bar_menu.components.my_carts.hidden' },
    { name: t('WALLET', 'Wallet'), type: 'hidden', path: 'bar_menu.components.wallet.hidden' },
    { name: t('PROFILE', 'Profile'), type: 'hidden', path: 'bar_menu.components.profile.hidden' }
  ]

  const smartBannersList = [
    { name: t('ANDROID_ID', 'Android id'), type: 'input', path: 'smart_banner_settings.android_id' },
    { name: t('APPLE_ID', 'Apple id'), type: 'input', path: 'smart_banner_settings.apple_id' }
  ]

  const trackingSettingsList = [
    { name: t('TRACKING_ONLY_SITE', 'Tracking-only site: show only the order tracking page (no menu, cart, login or store pages)'), type: 'hidden', path: 'tracking_settings.tracking_only' }
  ]

  return {
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
  }
}
