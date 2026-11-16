// redesign (owner decision 32 A, 2026-10-21; , T10 rubric B): the names of the settings the API's
// config_categories send in Title Case and jargon, as the dashboard shows them: sentence case, no internal numbers, and a
// «Disable X» named «X». Presentation only: no key and no value sent to the API changes, and a setting that is not here
// keeps the API name. The hub search finds a setting by this name and by the API one (settingsIa getFieldLabels).
// Each labelKey is seeded literally in settingsI18nSeed.js and filled in every locale (settingsConfigNames.test.js).
// (Z F3): each setting also has a description of its own (`help`, seeded and filled the same way), which the hub shows
// instead of the API's English one; where SETTINGS_CONFIG_EFFECT already explains a setting, that help stays.
// The location checks and the multi checkout carts are named by their custom block (getSettingsBlockFieldName).

export const SETTINGS_CONFIG_NAMES = {
  default_order_type: {
    labelKey: 'SETTINGS_NAME_DEFAULT_ORDER_TYPE',
    label: 'Default order type',
    helpKey: 'SETTINGS_NAME_DEFAULT_ORDER_TYPE_HELP',
    help: 'The order type customers start with when they place an order.'
  },
  driver_tip_allowed_at_pickup: {
    labelKey: 'SETTINGS_NAME_DRIVER_TIP_ALLOWED_AT_PICKUP',
    label: 'Set tips for pickup orders',
    helpKey: 'SETTINGS_NAME_DRIVER_TIP_ALLOWED_AT_PICKUP_HELP',
    help: 'Lets customers add a tip to pickup orders.'
  },
  max_distance_pickup: {
    labelKey: 'SETTINGS_NAME_MAX_DISTANCE_PICKUP',
    label: 'Maximum pickup distance',
    helpKey: 'SETTINGS_NAME_MAX_DISTANCE_PICKUP_HELP',
    help: 'Stores farther than this distance do not offer pickup.'
  },
  meters_to_change_address: {
    labelKey: 'SETTINGS_NAME_METERS_TO_CHANGE_ADDRESS',
    label: 'Address adjustment limit',
    helpKey: 'SETTINGS_NAME_METERS_TO_CHANGE_ADDRESS_HELP',
    help: 'How far customers can move the map pin to fine-tune their delivery address.'
  },
  order_types_allowed: {
    labelKey: 'SETTINGS_NAME_ORDER_TYPES_ALLOWED',
    label: 'Configure order types',
    helpKey: 'SETTINGS_NAME_ORDER_TYPES_ALLOWED_HELP',
    help: 'The order types customers can choose on your platform.'
  },
  unaddressed_order_types_allowed: {
    labelKey: 'SETTINGS_NAME_UNADDRESSED_ORDER_TYPES_ALLOWED',
    label: 'Set no-address order types',
    helpKey: 'SETTINGS_NAME_UNADDRESSED_ORDER_TYPES_ALLOWED_HELP',
    help: 'The order types customers can place without giving an address.'
  },
  preorder_status_enabled: {
    labelKey: 'SETTINGS_NAME_PREORDER_STATUS_ENABLED',
    label: 'Enable preorder feature',
    helpKey: 'SETTINGS_NAME_PREORDER_STATUS_ENABLED_HELP',
    help: 'Lets customers schedule orders in advance.'
  },
  guest_checkout_enabled: {
    labelKey: 'SETTINGS_NAME_GUEST_CHECKOUT_ENABLED',
    label: 'Allow guest checkout',
    helpKey: 'SETTINGS_NAME_GUEST_CHECKOUT_ENABLED_HELP',
    help: 'Lets customers order without creating an account.'
  },
  allowed_order_types_guest_checkout: {
    labelKey: 'SETTINGS_NAME_ALLOWED_ORDER_TYPES_GUEST_CHECKOUT',
    label: 'Set guest checkout order types',
    helpKey: 'SETTINGS_NAME_ALLOWED_ORDER_TYPES_GUEST_CHECKOUT_HELP',
    help: 'The order types guests can place, such as delivery or pickup.'
  },
  preorder_lead_time: {
    labelKey: 'SETTINGS_NAME_PREORDER_LEAD_TIME',
    label: 'Define order lead time',
    helpKey: 'SETTINGS_NAME_PREORDER_LEAD_TIME_HELP',
    help: 'Extra time added to prepare an order.'
  },
  preorder_minimum_days: {
    labelKey: 'SETTINGS_NAME_PREORDER_MINIMUM_DAYS',
    label: 'Set minimum preorder days',
    helpKey: 'SETTINGS_NAME_PREORDER_MINIMUM_DAYS_HELP',
    help: 'How many days in advance customers must schedule an order.'
  },
  preorder_slot_interval: {
    labelKey: 'SETTINGS_NAME_PREORDER_SLOT_INTERVAL',
    label: 'Define time slot interval',
    helpKey: 'SETTINGS_NAME_PREORDER_SLOT_INTERVAL_HELP',
    help: 'The time between the start of one time slot and the next, for example 15 minutes (10:00, 10:15, 10:30).'
  },
  preorder_time_range: {
    labelKey: 'SETTINGS_NAME_PREORDER_TIME_RANGE',
    label: 'Set time slot range',
    helpKey: 'SETTINGS_NAME_PREORDER_TIME_RANGE_HELP',
    help: 'How long each time slot lasts, for example 30 minutes (10:00–10:30, 10:15–10:45).'
  },
  checkout_multi_business_enabled: {
    labelKey: 'SETTINGS_NAME_CHECKOUT_MULTI_BUSINESS_ENABLED',
    label: 'Enable multi-business checkout',
    helpKey: 'SETTINGS_NAME_CHECKOUT_MULTI_BUSINESS_ENABLED_HELP',
    help: 'Lets customers pay for orders from several stores in one checkout.'
  },
  delivery_fee_free_multi_checkout: {
    labelKey: 'SETTINGS_NAME_DELIVERY_FEE_FREE_MULTI_CHECKOUT',
    label: 'Delivery fee free for multi checkout',
    helpKey: 'SETTINGS_NAME_DELIVERY_FEE_FREE_MULTI_CHECKOUT_HELP',
    help: 'The minimum purchase that makes delivery free in a multi-business checkout. Set it to 0 to turn it off.'
  },
  multi_business_checkout_coupon_input_style: {
    labelKey: 'SETTINGS_NAME_MULTI_BUSINESS_CHECKOUT_COUPON_INPUT_STYLE',
    label: 'Select coupon input style',
    helpKey: 'SETTINGS_NAME_MULTI_BUSINESS_CHECKOUT_COUPON_INPUT_STYLE_HELP',
    help: 'The design of the coupon field in a multi-business checkout.'
  },
  multi_business_checkout_progress_bar_style: {
    labelKey: 'SETTINGS_NAME_MULTI_BUSINESS_CHECKOUT_PROGRESS_BAR_STYLE',
    label: 'Select progress bar style',
    helpKey: 'SETTINGS_NAME_MULTI_BUSINESS_CHECKOUT_PROGRESS_BAR_STYLE_HELP',
    help: 'The design of the progress bar in a multi-business checkout.'
  },
  multi_business_checkout_remove_individual_buttons: {
    labelKey: 'SETTINGS_NAME_MULTI_BUSINESS_CHECKOUT_REMOVE_INDIVIDUAL_BUTTONS',
    label: 'Individual order buttons',
    helpKey: 'SETTINGS_NAME_MULTI_BUSINESS_CHECKOUT_REMOVE_INDIVIDUAL_BUTTONS_HELP',
    help: 'Show the action buttons of each order.'
  },
  multi_business_checkout_show_combined_delivery_fee: {
    labelKey: 'SETTINGS_NAME_MULTI_BUSINESS_CHECKOUT_SHOW_COMBINED_DELIVERY_FEE',
    label: 'Display combined delivery fees',
    helpKey: 'SETTINGS_NAME_MULTI_BUSINESS_CHECKOUT_SHOW_COMBINED_DELIVERY_FEE_HELP',
    help: 'Shows one total delivery fee for all the stores in a multi-business checkout.'
  },
  multi_business_checkout_show_combined_driver_tip: {
    labelKey: 'SETTINGS_NAME_MULTI_BUSINESS_CHECKOUT_SHOW_COMBINED_DRIVER_TIP',
    label: 'Display combined driver tips',
    helpKey: 'SETTINGS_NAME_MULTI_BUSINESS_CHECKOUT_SHOW_COMBINED_DRIVER_TIP_HELP',
    help: 'Shows one total driver tip in a multi-business checkout.'
  },
  professional_signup_allow: {
    labelKey: 'SETTINGS_NAME_PROFESSIONAL_SIGNUP_ALLOW',
    label: 'Enable professional signup',
    helpKey: 'SETTINGS_NAME_PROFESSIONAL_SIGNUP_ALLOW_HELP',
    help: 'Lets professionals sign up on your platform.'
  },
  professional_signup_enabled_default: {
    labelKey: 'SETTINGS_NAME_PROFESSIONAL_SIGNUP_ENABLED_DEFAULT',
    label: 'Professional signup approval required',
    helpKey: 'SETTINGS_NAME_PROFESSIONAL_SIGNUP_ENABLED_DEFAULT_HELP',
    help: 'New professional accounts need your approval before they can sign in.'
  },
  reservation_enabled: {
    labelKey: 'SETTINGS_NAME_RESERVATION_ENABLED',
    label: 'Reservation enabled',
    helpKey: 'SETTINGS_NAME_RESERVATION_ENABLED_HELP',
    help: 'Lets customers make reservations.'
  },
  add_product_with_one_click: {
    labelKey: 'SETTINGS_NAME_ADD_PRODUCT_WITH_ONE_CLICK',
    label: 'Quick add product',
    helpKey: 'SETTINGS_NAME_ADD_PRODUCT_WITH_ONE_CLICK_HELP',
    help: 'Products without options go into the cart with one click.'
  },
  show_reviews_popups_enabled: {
    labelKey: 'SETTINGS_NAME_SHOW_REVIEWS_POPUPS_ENABLED',
    label: 'Order review reminder',
    helpKey: 'SETTINGS_NAME_SHOW_REVIEWS_POPUPS_ENABLED_HELP',
    help: 'Reminds customers to review their orders when they come back.'
  },
  change_order_id: {
    labelKey: 'SETTINGS_NAME_CHANGE_ORDER_ID',
    label: 'Display external order ID',
    helpKey: 'SETTINGS_NAME_CHANGE_ORDER_ID_HELP',
    help: 'Shows an external ID instead of the order number, for integrations.'
  },
  combine_pending_and_progress_orders: {
    labelKey: 'SETTINGS_NAME_COMBINE_PENDING_AND_PROGRESS_ORDERS',
    label: 'Combine pending and in-progress orders',
    helpKey: 'SETTINGS_NAME_COMBINE_PENDING_AND_PROGRESS_ORDERS_HELP',
    help: 'Shows pending and in-progress orders in one section.'
  },
  filter_order_options: {
    labelKey: 'SETTINGS_NAME_FILTER_ORDER_OPTIONS',
    label: 'Customize order filters',
    helpKey: 'SETTINGS_NAME_FILTER_ORDER_OPTIONS_HELP',
    help: 'The filters people can use to sort and find orders.'
  },
  manual_driver_assignment_comment_enabled: {
    labelKey: 'SETTINGS_NAME_MANUAL_DRIVER_ASSIGNMENT_COMMENT_ENABLED',
    label: 'Enable manual driver assignment notes',
    helpKey: 'SETTINGS_NAME_MANUAL_DRIVER_ASSIGNMENT_COMMENT_ENABLED_HELP',
    help: 'Lets staff add a note when they assign a driver by hand.'
  },
  optimize_order_data: {
    labelKey: 'SETTINGS_NAME_OPTIMIZE_ORDER_DATA',
    label: 'Optimize large order data',
    helpKey: 'SETTINGS_NAME_OPTIMIZE_ORDER_DATA_HELP',
    help: 'Speeds up loading when there are many orders.'
  },
  order_logbook_enabled: {
    labelKey: 'SETTINGS_NAME_ORDER_LOGBOOK_ENABLED',
    label: 'Show order logbook in chat',
    helpKey: 'SETTINGS_NAME_ORDER_LOGBOOK_ENABLED_HELP',
    help: 'Shows the order history in the order chat.'
  },
  order_messages_export_in_csv: {
    labelKey: 'SETTINGS_NAME_ORDER_MESSAGES_EXPORT_IN_CSV',
    label: 'Export order messages in reports',
    helpKey: 'SETTINGS_NAME_ORDER_MESSAGES_EXPORT_IN_CSV_HELP',
    help: 'Adds order messages to the orders report export.'
  },
  order_messages_send_to_push_notification: {
    labelKey: 'SETTINGS_NAME_ORDER_MESSAGES_SEND_TO_PUSH_NOTIFICATION',
    label: 'Push notifications for order messages',
    helpKey: 'SETTINGS_NAME_ORDER_MESSAGES_SEND_TO_PUSH_NOTIFICATION_HELP',
    help: 'The roles that get a push notification when a new message arrives on an order.'
  },
  order_status_regression_validation_enabled: {
    labelKey: 'SETTINGS_NAME_ORDER_STATUS_REGRESSION_VALIDATION_ENABLED',
    label: 'Block order status regression',
    helpKey: 'SETTINGS_NAME_ORDER_STATUS_REGRESSION_VALIDATION_ENABLED_HELP',
    help: 'Stops an order from going back to an earlier status. A reason can still force the change.'
  },
  search_box_enabled: {
    labelKey: 'SETTINGS_NAME_SEARCH_BOX_ENABLED',
    label: 'Display search box on orders page',
    helpKey: 'SETTINGS_NAME_SEARCH_BOX_ENABLED_HELP',
    help: 'Shows a search box on the orders page to find orders quickly.'
  },
  order_deadlines_delayed_time: {
    labelKey: 'SETTINGS_NAME_ORDER_DEADLINES_DELAYED_TIME',
    label: 'Set order deadline time',
    helpKey: 'SETTINGS_NAME_ORDER_DEADLINES_DELAYED_TIME_HELP',
    help: 'The time limit to fulfill an order, in seconds.'
  },
  order_deadlines_enabled: {
    labelKey: 'SETTINGS_NAME_ORDER_DEADLINES_ENABLED',
    label: 'Enable order deadline enforcement',
    helpKey: 'SETTINGS_NAME_ORDER_DEADLINES_ENABLED_HELP',
    help: 'Applies a time limit to fulfill each order.'
  },
  row_in_color_enabled: {
    labelKey: 'SETTINGS_NAME_ROW_IN_COLOR_ENABLED',
    label: 'Highlight delay risk orders',
    helpKey: 'SETTINGS_NAME_ROW_IN_COLOR_ENABLED_HELP',
    help: 'Colors orders in the manager view by their risk of delay.'
  },
  alternative_confirmation_page: {
    labelKey: 'SETTINGS_NAME_ALTERNATIVE_CONFIRMATION_PAGE',
    label: 'Enable new design on confirmation page',
    helpKey: 'SETTINGS_NAME_ALTERNATIVE_CONFIRMATION_PAGE_HELP',
    help: 'Uses the new layout on the order confirmation page.'
  },
  cart_change_business_validation: {
    labelKey: 'SETTINGS_NAME_CART_CHANGE_BUSINESS_VALIDATION',
    label: 'Enable store switching from cart',
    helpKey: 'SETTINGS_NAME_CART_CHANGE_BUSINESS_VALIDATION_HELP',
    help: 'Lets customers switch to another store from their cart, for example when they are ordering in the wrong area.'
  },
  guest_uuid_access: {
    labelKey: 'SETTINGS_NAME_GUEST_UUID_ACCESS',
    label: 'Enable sharing of order details',
    helpKey: 'SETTINGS_NAME_GUEST_UUID_ACCESS_HELP',
    help: 'Lets customers share the page with their order details.'
  },
  guest_uuid_max_days: {
    labelKey: 'SETTINGS_NAME_GUEST_UUID_MAX_DAYS',
    label: 'Set expiry for shared order details',
    helpKey: 'SETTINGS_NAME_GUEST_UUID_MAX_DAYS_HELP',
    help: 'How many days a shared order details link works.'
  },
  tracking_link_mapbox_enabled: {
    labelKey: 'SETTINGS_NAME_TRACKING_LINK_MAPBOX_ENABLED',
    label: 'Use Mapbox for order tracking map',
    helpKey: 'SETTINGS_NAME_TRACKING_LINK_MAPBOX_ENABLED_HELP',
    help: 'Shows the order tracking map with Mapbox. When off, Google Maps is used.'
  },
  upselling_type: {
    labelKey: 'SETTINGS_NAME_UPSELLING_TYPE',
    label: 'Upselling type',
    helpKey: 'SETTINGS_NAME_UPSELLING_TYPE_HELP',
    help: 'Suggests products from the customer\'s past orders or from a list the store sets.'
  },
  validation_phone_number_lib: {
    labelKey: 'SETTINGS_NAME_VALIDATION_PHONE_NUMBER_LIB',
    label: 'International phone validation',
    helpKey: 'SETTINGS_NAME_VALIDATION_PHONE_NUMBER_LIB_HELP',
    help: 'When enabled, international phone numbers must be valid. Disable it to allow non-local formats.'
  },
  currency_position: {
    labelKey: 'SETTINGS_NAME_CURRENCY_POSITION',
    label: 'Currency symbol position in prices',
    helpKey: 'SETTINGS_NAME_CURRENCY_POSITION_HELP',
    help: 'Shows the currency symbol before or after the price.'
  },
  format_number_currency: {
    labelKey: 'SETTINGS_NAME_FORMAT_NUMBER_CURRENCY',
    label: 'Currency symbol for prices',
    helpKey: 'SETTINGS_NAME_FORMAT_NUMBER_CURRENCY_HELP',
    help: 'The currency symbol your platform shows, for example $, € or £.'
  },
  format_number_decimal_length: {
    labelKey: 'SETTINGS_NAME_FORMAT_NUMBER_DECIMAL_LENGTH',
    label: 'Decimal places for prices',
    helpKey: 'SETTINGS_NAME_FORMAT_NUMBER_DECIMAL_LENGTH_HELP',
    help: 'How many decimals prices show, usually 2 (10.50).'
  },
  format_number_decimal_separator: {
    labelKey: 'SETTINGS_NAME_FORMAT_NUMBER_DECIMAL_SEPARATOR',
    label: 'Decimal separator for prices',
    helpKey: 'SETTINGS_NAME_FORMAT_NUMBER_DECIMAL_SEPARATOR_HELP',
    help: 'The decimal separator of prices: point (10.50) or comma (10,50).'
  },
  format_number_thousand_separator: {
    labelKey: 'SETTINGS_NAME_FORMAT_NUMBER_THOUSAND_SEPARATOR',
    label: 'Thousands separator for prices',
    helpKey: 'SETTINGS_NAME_FORMAT_NUMBER_THOUSAND_SEPARATOR_HELP',
    help: 'The thousands separator of prices: comma (1,000) or point (1.000).'
  },
  distance_unit: {
    labelKey: 'SETTINGS_NAME_DISTANCE_UNIT',
    label: 'Distance measurement unit',
    helpKey: 'SETTINGS_NAME_DISTANCE_UNIT_HELP',
    help: 'Shows distances in kilometers or miles.'
  },
  // the API's «Driver Tip Configuration»; SETTINGS_CONFIG_EFFECT already explains it, so no help of its own
  driver_tip_options: {
    labelKey: 'SETTINGS_NAME_DRIVER_TIP_OPTIONS',
    label: 'Driver tip options'
  },
  driver_tip_type: {
    labelKey: 'SETTINGS_NAME_DRIVER_TIP_TYPE',
    label: 'Driver tip format',
    helpKey: 'SETTINGS_NAME_DRIVER_TIP_TYPE_HELP',
    help: 'Shows driver tips as a percentage of the total or as a fixed amount.'
  },
  driver_tip_use_custom: {
    labelKey: 'SETTINGS_NAME_DRIVER_TIP_USE_CUSTOM',
    label: 'Custom driver tip amount',
    helpKey: 'SETTINGS_NAME_DRIVER_TIP_USE_CUSTOM_HELP',
    help: 'Lets customers enter their own tip amount.'
  },
  platform_fee_fixed: {
    labelKey: 'SETTINGS_NAME_PLATFORM_FEE_FIXED',
    label: 'Fixed platform fee',
    helpKey: 'SETTINGS_NAME_PLATFORM_FEE_FIXED_HELP',
    help: 'A fixed service fee added to every order.'
  },
  platform_fee_percentage: {
    labelKey: 'SETTINGS_NAME_PLATFORM_FEE_PERCENTAGE',
    label: 'Percentage platform fee',
    helpKey: 'SETTINGS_NAME_PLATFORM_FEE_PERCENTAGE_HELP',
    help: 'A percentage of the subtotal added to every order as a fee.'
  },
  default_country_code: {
    labelKey: 'SETTINGS_NAME_DEFAULT_COUNTRY_CODE',
    label: 'Set default country code',
    helpKey: 'SETTINGS_NAME_DEFAULT_COUNTRY_CODE_HELP',
    help: 'The country selected by default in phone number fields. Enter its two-letter code in capital letters, like US, CA or MX, not the dialing prefix (+1).'
  },
  disabled_rewards: {
    labelKey: 'SETTINGS_NAME_DISABLED_REWARDS',
    label: 'Rewards',
    helpKey: 'SETTINGS_NAME_DISABLED_REWARDS_HELP',
    help: 'Use rewards.'
  },
  filter_search_options: {
    labelKey: 'SETTINGS_NAME_FILTER_SEARCH_OPTIONS',
    label: 'Set search filters',
    helpKey: 'SETTINGS_NAME_FILTER_SEARCH_OPTIONS_HELP',
    help: 'The filters customers can use on the search page.'
  },
  business_signup_allow: {
    labelKey: 'SETTINGS_NAME_BUSINESS_SIGNUP_ALLOW',
    label: 'Business registration settings',
    helpKey: 'SETTINGS_NAME_BUSINESS_SIGNUP_ALLOW_HELP',
    help: 'Lets businesses sign up on your platform.'
  },
  business_signup_enabled_default: {
    labelKey: 'SETTINGS_NAME_BUSINESS_SIGNUP_ENABLED_DEFAULT',
    label: 'Business signup approval settings',
    helpKey: 'SETTINGS_NAME_BUSINESS_SIGNUP_ENABLED_DEFAULT_HELP',
    help: 'New business accounts need an administrator\'s approval before they can sign in.'
  },
  cookie_consent_enabled: {
    labelKey: 'SETTINGS_NAME_COOKIE_CONSENT_ENABLED',
    label: 'Cookie consent enabled',
    helpKey: 'SETTINGS_NAME_COOKIE_CONSENT_ENABLED_HELP',
    help: 'Shows a cookie consent banner to visitors.'
  },
  driver_signup_allow: {
    labelKey: 'SETTINGS_NAME_DRIVER_SIGNUP_ALLOW',
    label: 'Driver registration',
    helpKey: 'SETTINGS_NAME_DRIVER_SIGNUP_ALLOW_HELP',
    help: 'Lets drivers sign up on your platform.'
  },
  driver_signup_enabled_default: {
    labelKey: 'SETTINGS_NAME_DRIVER_SIGNUP_ENABLED_DEFAULT',
    label: 'Driver signup approval',
    helpKey: 'SETTINGS_NAME_DRIVER_SIGNUP_ENABLED_DEFAULT_HELP',
    help: 'New drivers need approval before they can sign in.'
  },
  terms_and_conditions: {
    labelKey: 'SETTINGS_NAME_TERMS_AND_CONDITIONS',
    label: 'Agree to terms at signup',
    helpKey: 'SETTINGS_NAME_TERMS_AND_CONDITIONS_HELP',
    help: 'Customers must accept your terms and conditions to sign up.'
  },
  terms_and_conditions_url: {
    labelKey: 'SETTINGS_NAME_TERMS_AND_CONDITIONS_URL',
    label: 'Terms & conditions link',
    helpKey: 'SETTINGS_NAME_TERMS_AND_CONDITIONS_URL_HELP',
    help: 'The link to your terms and conditions.'
  },
  autoassign_attempt_to_defer: {
    labelKey: 'SETTINGS_NAME_AUTOASSIGN_ATTEMPT_TO_DEFER',
    label: 'Set penalty for missed assignments',
    helpKey: 'SETTINGS_NAME_AUTOASSIGN_ATTEMPT_TO_DEFER_HELP',
    help: 'How many missed assignments send an order to the end of the queue.'
  },
  autoassign_time_to_attempt_again: { labelKey: 'SETTINGS_NAME_AUTOASSIGN_TIME_TO_ATTEMPT_AGAIN', label: 'Set penalty duration' },
  allow_driver_manager_update_driver_schedule: {
    labelKey: 'SETTINGS_NAME_ALLOW_DRIVER_MANAGER_UPDATE_DRIVER_SCHEDULE',
    label: 'Allow managers to update schedules',
    helpKey: 'SETTINGS_NAME_ALLOW_DRIVER_MANAGER_UPDATE_DRIVER_SCHEDULE_HELP',
    help: 'Lets driver managers change driver schedules.'
  },
  assign_driver_enabled: { labelKey: 'SETTINGS_NAME_ASSIGN_DRIVER_ENABLED', label: 'Enable admin to assign drivers' },
  autoassign_reasign_on_pause: {
    labelKey: 'SETTINGS_NAME_AUTOASSIGN_REASIGN_ON_PAUSE',
    label: 'Reassign order to driver',
    helpKey: 'SETTINGS_NAME_AUTOASSIGN_REASIGN_ON_PAUSE_HELP',
    help: 'A paused order can be assigned again to the same driver.'
  },
  automate_driver_availability_by_schedule: {
    labelKey: 'SETTINGS_NAME_AUTOMATE_DRIVER_AVAILABILITY_BY_SCHEDULE',
    label: 'Automate driver schedule availability',
    helpKey: 'SETTINGS_NAME_AUTOMATE_DRIVER_AVAILABILITY_BY_SCHEDULE_HELP',
    help: 'Changes driver availability automatically with their schedule: only to available, only to unavailable, both or neither.'
  },
  automate_driver_availability_strategy: {
    labelKey: 'SETTINGS_NAME_AUTOMATE_DRIVER_AVAILABILITY_STRATEGY',
    label: 'Set driver availability strategy',
    helpKey: 'SETTINGS_NAME_AUTOMATE_DRIVER_AVAILABILITY_STRATEGY_HELP',
    help: 'Manages driver availability with schedules or with delivery blocks.'
  },
  driver_login_available: {
    labelKey: 'SETTINGS_NAME_DRIVER_LOGIN_AVAILABLE',
    label: 'Enable schedule-based driver login',
    helpKey: 'SETTINGS_NAME_DRIVER_LOGIN_AVAILABLE_HELP',
    help: 'Drivers become active when they sign in within their scheduled hours.'
  },
  driver_login_validation: {
    labelKey: 'SETTINGS_NAME_DRIVER_LOGIN_VALIDATION',
    label: 'Scheduled driver login',
    helpKey: 'SETTINGS_NAME_DRIVER_LOGIN_VALIDATION_HELP',
    help: 'Drivers can only sign in during their scheduled hours.'
  },
  store_app_manual_driver_assignment_enabled: {
    labelKey: 'SETTINGS_NAME_STORE_APP_MANUAL_DRIVER_ASSIGNMENT_ENABLED',
    label: 'Store app manual driver assignment',
    helpKey: 'SETTINGS_NAME_STORE_APP_MANUAL_DRIVER_ASSIGNMENT_ENABLED_HELP',
    help: 'Shows the assign driver and driver company options in the store app. When off, the store only confirms the order and a driver is assigned automatically.'
  },
  allow_driver_update_data: {
    labelKey: 'SETTINGS_NAME_ALLOW_DRIVER_UPDATE_DATA',
    label: 'Allow driver profile updates',
    helpKey: 'SETTINGS_NAME_ALLOW_DRIVER_UPDATE_DATA_HELP',
    help: 'Lets drivers edit their profile.'
  },
  allow_mock_location: {
    labelKey: 'SETTINGS_NAME_ALLOW_MOCK_LOCATION',
    label: 'Allow GPS mock locations',
    helpKey: 'SETTINGS_NAME_ALLOW_MOCK_LOCATION_HELP',
    help: 'Lets drivers use simulated GPS locations.'
  },
  delivery_time_setting: {
    labelKey: 'SETTINGS_NAME_DELIVERY_TIME_SETTING',
    label: 'Specify delivery time',
    helpKey: 'SETTINGS_NAME_DELIVERY_TIME_SETTING_HELP',
    help: 'Drivers must enter the expected delivery time, in minutes.'
  },
  disable_delivery_priority: {
    labelKey: 'SETTINGS_NAME_DISABLE_DELIVERY_PRIORITY',
    label: 'Delivery priority',
    helpKey: 'SETTINGS_NAME_DISABLE_DELIVERY_PRIORITY_HELP',
    help: 'Use delivery priority.'
  },
  failed_pickup_by_driver_enabled: {
    labelKey: 'SETTINGS_NAME_FAILED_PICKUP_BY_DRIVER_ENABLED',
    label: 'Enable failed pickup status',
    helpKey: 'SETTINGS_NAME_FAILED_PICKUP_BY_DRIVER_ENABLED_HELP',
    help: 'Lets drivers mark an order as a failed pickup.'
  },
  hidden_driver_eta_time: {
    labelKey: 'SETTINGS_NAME_HIDDEN_DRIVER_ETA_TIME',
    label: 'Hide driver ETA',
    helpKey: 'SETTINGS_NAME_HIDDEN_DRIVER_ETA_TIME_HELP',
    help: 'Hides the driver\'s estimated time of arrival in the app.'
  },
  order_not_ready_enabled: {
    labelKey: 'SETTINGS_NAME_ORDER_NOT_READY_ENABLED',
    label: 'Enable order not ready status',
    helpKey: 'SETTINGS_NAME_ORDER_NOT_READY_ENABLED_HELP',
    help: 'Lets drivers mark an order as not ready.'
  },
  states_requiring_image_driver: {
    labelKey: 'SETTINGS_NAME_STATES_REQUIRING_IMAGE_DRIVER',
    label: 'States requiring image',
    helpKey: 'SETTINGS_NAME_STATES_REQUIRING_IMAGE_DRIVER_HELP',
    help: 'The order statuses in which the driver must add a photo.'
  },
  allow_save_changes_offline: {
    labelKey: 'SETTINGS_NAME_ALLOW_SAVE_CHANGES_OFFLINE',
    label: 'Enable offline changes',
    helpKey: 'SETTINGS_NAME_ALLOW_SAVE_CHANGES_OFFLINE_HELP',
    help: 'Lets drivers save changes while they are offline.'
  },
  min_distance_driver_radio: {
    labelKey: 'SETTINGS_NAME_MIN_DISTANCE_DRIVER_RADIO',
    label: 'Minimum radius for status update',
    helpKey: 'SETTINGS_NAME_MIN_DISTANCE_DRIVER_RADIO_HELP',
    help: 'How close drivers must be to the pickup or delivery point to update the order status.'
  },
  order_update_location_business: {
    labelKey: 'SETTINGS_NAME_ORDER_UPDATE_LOCATION_BUSINESS',
    label: 'Enable auto-update of order status for businesses',
    helpKey: 'SETTINGS_NAME_ORDER_UPDATE_LOCATION_BUSINESS_HELP',
    help: 'Updates the order status automatically when the driver gets near the store.'
  },
  order_update_location_business_distance: {
    labelKey: 'SETTINGS_NAME_ORDER_UPDATE_LOCATION_BUSINESS_DISTANCE',
    label: 'Set business proximity for auto-updates',
    helpKey: 'SETTINGS_NAME_ORDER_UPDATE_LOCATION_BUSINESS_DISTANCE_HELP',
    help: 'How close to the store the driver must be for the automatic status update.'
  },
  order_update_location_customer: {
    labelKey: 'SETTINGS_NAME_ORDER_UPDATE_LOCATION_CUSTOMER',
    label: 'Enable auto-update of order status for customers',
    helpKey: 'SETTINGS_NAME_ORDER_UPDATE_LOCATION_CUSTOMER_HELP',
    help: 'Updates the order status automatically when the driver gets near the customer.'
  },
  order_update_location_customer_distance: {
    labelKey: 'SETTINGS_NAME_ORDER_UPDATE_LOCATION_CUSTOMER_DISTANCE',
    label: 'Set customer proximity for auto-updates',
    helpKey: 'SETTINGS_NAME_ORDER_UPDATE_LOCATION_CUSTOMER_DISTANCE_HELP',
    help: 'How close to the customer the driver must be for the automatic status update.'
  },
  use_distance_driver_radio: {
    labelKey: 'SETTINGS_NAME_USE_DISTANCE_DRIVER_RADIO',
    label: 'Driver radius requirement',
    helpKey: 'SETTINGS_NAME_USE_DISTANCE_DRIVER_RADIO_HELP',
    help: 'Drivers must be within a set distance to update the status of an order.'
  },
  disable_companies_order_details: {
    labelKey: 'SETTINGS_NAME_DISABLE_COMPANIES_ORDER_DETAILS',
    label: 'Driver companies feature',
    helpKey: 'SETTINGS_NAME_DISABLE_COMPANIES_ORDER_DETAILS_HELP',
    help: 'Show driver companies in the order details.'
  },
  refund_cash_wallet_allow_when_order_cancelled: {
    labelKey: 'SETTINGS_NAME_REFUND_CASH_WALLET_ALLOW_WHEN_ORDER_CANCELLED',
    label: 'Enable cash wallet refunds',
    helpKey: 'SETTINGS_NAME_REFUND_CASH_WALLET_ALLOW_WHEN_ORDER_CANCELLED_HELP',
    help: 'Allows refunds to the cash wallet when an order is cancelled.'
  },
  refund_other_allow_when_order_cancelled: {
    labelKey: 'SETTINGS_NAME_REFUND_OTHER_ALLOW_WHEN_ORDER_CANCELLED',
    label: 'Enable other payment method refunds',
    helpKey: 'SETTINGS_NAME_REFUND_OTHER_ALLOW_WHEN_ORDER_CANCELLED_HELP',
    help: 'Allows refunds to the cash wallet when an order paid with another method is cancelled.'
  },
  refund_stripe_allow_when_order_cancelled: {
    labelKey: 'SETTINGS_NAME_REFUND_STRIPE_ALLOW_WHEN_ORDER_CANCELLED',
    label: 'Enable Stripe refunds',
    helpKey: 'SETTINGS_NAME_REFUND_STRIPE_ALLOW_WHEN_ORDER_CANCELLED_HELP',
    help: 'Allows Stripe refunds when an order is cancelled.'
  },
  wallet_cash_enabled: {
    labelKey: 'SETTINGS_NAME_WALLET_CASH_ENABLED',
    label: 'Enable cash wallet',
    helpKey: 'SETTINGS_NAME_WALLET_CASH_ENABLED_HELP',
    help: 'Lets customers use the cash wallet.'
  },
  refund_credit_point_allow_when_order_cancelled: {
    labelKey: 'SETTINGS_NAME_REFUND_CREDIT_POINT_ALLOW_WHEN_ORDER_CANCELLED',
    label: 'Enable loyalty points refunds',
    helpKey: 'SETTINGS_NAME_REFUND_CREDIT_POINT_ALLOW_WHEN_ORDER_CANCELLED_HELP',
    help: 'Gives loyalty points back when an order is cancelled.'
  },
  wallet_credit_point_enabled: {
    labelKey: 'SETTINGS_NAME_WALLET_CREDIT_POINT_ENABLED',
    label: 'Enable loyalty points',
    helpKey: 'SETTINGS_NAME_WALLET_CREDIT_POINT_ENABLED_HELP',
    help: 'Lets customers use loyalty points.'
  },
  platform_store_enabled: {
    labelKey: 'SETTINGS_NAME_PLATFORM_STORE_ENABLED',
    label: 'Activate platform store',
    helpKey: 'SETTINGS_NAME_PLATFORM_STORE_ENABLED_HELP',
    help: 'Turns on the platform store.'
  },
  platform_store_giftcard_enabled: {
    labelKey: 'SETTINGS_NAME_PLATFORM_STORE_GIFTCARD_ENABLED',
    label: 'Enable gift card feature',
    helpKey: 'SETTINGS_NAME_PLATFORM_STORE_GIFTCARD_ENABLED_HELP',
    help: 'Turns on gift cards.'
  },
  platform_store_header: {
    labelKey: 'SETTINGS_NAME_PLATFORM_STORE_HEADER',
    label: 'Set platform header',
    helpKey: 'SETTINGS_NAME_PLATFORM_STORE_HEADER_HELP',
    help: 'The header of your platform store.'
  },
  platform_store_logo: {
    labelKey: 'SETTINGS_NAME_PLATFORM_STORE_LOGO',
    label: 'Upload platform logo',
    helpKey: 'SETTINGS_NAME_PLATFORM_STORE_LOGO_HELP',
    help: 'The logo of your platform store.'
  },
  platform_store_name: {
    labelKey: 'SETTINGS_NAME_PLATFORM_STORE_NAME',
    label: 'Define platform name',
    helpKey: 'SETTINGS_NAME_PLATFORM_STORE_NAME_HELP',
    help: 'The name of your platform store.'
  },
  stripe_connect_client_id: {
    labelKey: 'SETTINGS_NAME_STRIPE_CONNECT_CLIENT_ID',
    label: 'Enter Stripe Connect client ID',
    helpKey: 'SETTINGS_NAME_STRIPE_CONNECT_CLIENT_ID_HELP',
    help: 'The client ID of your Stripe Connect account.'
  },
  stripe_connect_client_id_sandbox: {
    labelKey: 'SETTINGS_NAME_STRIPE_CONNECT_CLIENT_ID_SANDBOX',
    label: 'Enter Stripe Connect test client ID',
    helpKey: 'SETTINGS_NAME_STRIPE_CONNECT_CLIENT_ID_SANDBOX_HELP',
    help: 'The test client ID of your Stripe Connect account.'
  },
  stripe_connect_sandbox: {
    labelKey: 'SETTINGS_NAME_STRIPE_CONNECT_SANDBOX',
    label: 'Enable Stripe Connect testing mode',
    helpKey: 'SETTINGS_NAME_STRIPE_CONNECT_SANDBOX_HELP',
    help: 'Uses Stripe Connect in test mode.'
  }
}

// «Disable X» settings with exact Yes/No options, named «X» above: their stored Yes means X is off. The hub shows them
// the right way round (the switch is on for the stored No, and a select reads «No» for the stored Yes); what is stored
// does not change (settingsSelectOptions.js).
export const SETTINGS_POSITIVE_LABEL_KEYS = [
  'multi_business_checkout_remove_individual_buttons',
  'disabled_rewards',
  'disable_delivery_priority',
  'disable_companies_order_details'
]
