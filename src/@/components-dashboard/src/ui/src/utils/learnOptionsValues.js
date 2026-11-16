export const learnOptionsValues = (key = [], t) => {
  const options = [
    {
      value: 'order_list_general_view',
      name: t('LEARN_ORDER_LIST_GENERAL_VIEW', 'Orders list | General overview'),
      url: 'https://docs.ordering.co/docs/products/dashboard/orders-overview/'
    },
    {
      value: 'order_details',
      name: t('LEARN_ORDER_DETAILS', 'Order details'),
      url: 'https://docs.ordering.co/docs/products/dashboard/orders/view-manage-order/'
    },
    {
      value: 'create_custom_order',
      name: t('LEARN_CREATE_CUSTOM_ORDER', 'Create custom order'),
      url: 'https://docs.ordering.co/docs/products/dashboard/orders/create-custom-order/'
    },
    {
      value: 'message_general_view',
      name: t('LEARN_MESSAGE_GENERAL_VIEW', 'Messages | General overview'),
      url: 'https://docs.ordering.co/docs/products/dashboard/orders/messages-overview/'
    },
    {
      value: 'open_cart_general_view',
      name: t('LEARN_OPEN_CART_GENERAL_VIEW', 'Open carts | General overview'),
      url: 'https://docs.ordering.co/docs/products/dashboard/orders/open-carts-overview/'
    },
    {
      value: 'cart_details',
      name: t('LEARN_CART_DETAILS', 'Cart details'),
      url: 'https://docs.ordering.co/docs/products/dashboard/orders/open-carts-overview/'
    },
    {
      value: 'store_general_view',
      name: t('LEARN_STORE_GENERAL_VIEW', 'Stores | General overview'),
      url: 'https://docs.ordering.co/docs/products/dashboard/stores-overview/'
    },
    {
      value: 'store_details',
      name: t('LEARN_STORE_DETAILS', 'Store details'),
      url: 'https://docs.ordering.co/docs/products/dashboard/stores/view-edit-store/'
    },
    {
      value: 'store_schedule',
      name: t('LEARN_STORE_SCHEDULE', 'Schedule'),
      url: 'https://docs.ordering.co/docs/products/dashboard/stores/view-edit-store/schedule/'
    },
    {
      value: 'store_menu',
      name: t('LEARN_STORE_MENU', 'Menu'),
      url: 'https://docs.ordering.co/docs/products/dashboard/stores/products-overview/manage-menus/'
    },
    {
      value: 'store_delivery_pickup',
      name: t('LEARN_STORE_DELIVERY_PICKUP', 'Delivery, pickup & more'),
      url: 'https://docs.ordering.co/docs/products/dashboard/stores/view-edit-store/delivery-pickup/'
    },
    {
      value: 'store_notifications',
      name: t('LEARN_STORE_NOTIFICATIONS', 'Notifications'),
      url: 'https://docs.ordering.co/docs/products/dashboard/stores/view-edit-store/notifications/'
    },
    {
      value: 'store_payment_methods',
      name: t('LEARN_STORE_PAYMENT_METHODS', 'Payment methods'),
      url: 'https://docs.ordering.co/docs/products/dashboard/stores/view-edit-store/payment-methods/'
    },
    {
      value: 'store_tax_fees',
      name: t('LEARN_STORE_TAX_FEES', 'Tax & fees'),
      url: 'https://docs.ordering.co/docs/products/dashboard/stores/view-edit-store/taxes-and-customer-fees/'
    },
    {
      value: 'store_promotions',
      name: t('LEARN_STORE_PROMOTIONS', 'Promotions'),
      url: 'https://docs.ordering.co/docs/products/dashboard/stores/view-edit-store/'
    },
    {
      value: 'store_channels',
      name: t('LEARN_STORE_CHANNELS', 'Ordering channels'),
      url: 'https://docs.ordering.co/docs/products/dashboard/stores/view-edit-store/ordering-channels/'
    },
    {
      value: 'store_qr_codes',
      name: t('LEARN_STORE_QR_CODES', 'QR codes'),
      url: 'https://docs.ordering.co/docs/products/dashboard/stores/view-edit-store/qr-codes/'
    },
    {
      value: 'store_sales_channels',
      name: t('LEARN_STORE_SALES_CHANNELS', 'Sales channels'),
      url: 'https://docs.ordering.co/docs/products/dashboard/connect/sales-channels/'
    },
    {
      value: 'store_layout',
      name: t('LEARN_STORE_LAYOUT', 'Layout'),
      url: 'https://docs.ordering.co/docs/products/dashboard/stores/view-edit-store/layout/'
    },
    {
      value: 'store_webhooks',
      name: t('LEARN_STORE_WEBHOOKS', 'Webhooks'),
      url: 'https://docs.ordering.co/docs/products/dashboard/settings/pro/developers/webhooks/'
    },
    {
      value: 'categories_products_general_view',
      name: t('LEARN_CATEGORIES_PRODUCTS_GENERAL_VIEW', 'Categories & products: general overview'),
      url: 'https://docs.ordering.co/docs/products/dashboard/stores/products-overview/'
    },
    {
      value: 'new_category',
      name: t('LEARN_NEW_CATEGORY', 'New category'),
      url: 'https://docs.ordering.co/docs/products/dashboard/stores/products-overview/create-category/'
    },
    {
      value: 'product_details_general_view',
      name: t('LEARN_PRODUCT_DETAILS_GENERAL_VIEW', 'Products details | General overview'),
      url: 'https://docs.ordering.co/docs/products/dashboard/stores/create-edit-product/'
    },
    {
      value: 'ingredients_properties',
      name: t('LEARN_INGREDIENTS_PROPERTIES', 'Ingredients/Properties'),
      url: 'https://docs.ordering.co/docs/products/dashboard/stores/create-edit-product/ingredients-properties/'
    },
    {
      value: 'product_options',
      name: t('LEARN_PRODUCT_OPTIONS', 'Product options'),
      url: 'https://docs.ordering.co/docs/products/dashboard/stores/create-edit-product/product-options/'
    },
    {
      value: 'product_images',
      name: t('LEARN_PRODUCT_IMAGES', 'Product images'),
      url: 'https://docs.ordering.co/docs/products/dashboard/stores/create-edit-product/product-images/'
    },
    {
      value: 'product_video',
      name: t('LEARN_PRODUCT_IMAGES', 'Product video'),
      url: 'https://docs.ordering.co/docs/products/dashboard/stores/create-edit-product/product-video/'
    },
    {
      value: 'importers',
      name: t('LEARN_IMPORTERS', 'Importers'),
      url: 'https://docs.ordering.co/docs/products/dashboard/connect/importers/'
    },
    {
      value: 'business_importer',
      name: t('LEARN_BUSINESS_IMPORTER', 'Business importer'),
      url: 'https://docs.ordering.co/docs/products/dashboard/connect/importers/'
    },
    {
      value: 'category_importers',
      name: t('LEARN_CATEGORY_IMPORTERS', 'Category importers'),
      url: 'https://docs.ordering.co/docs/products/dashboard/connect/importers/'
    },
    {
      value: 'products_importers',
      name: t('LEARN_PRODUCTS_IMPORTERS', 'Products importers'),
      url: 'https://docs.ordering.co/docs/products/dashboard/stores/products-overview/bulk-import-products/'
    },
    {
      value: 'users_importers',
      name: t('LEARN_USERS_IMPORTERS', 'Users importers'),
      url: 'https://docs.ordering.co/docs/products/dashboard/connect/importers/'
    },
    {
      value: 'creating_new_importer',
      name: t('LEARN_PRODUCT_IMAGES', 'Creating a new importer'),
      url: 'https://docs.ordering.co/docs/products/dashboard/connect/importers/'
    },
    {
      value: 'import_full_menu',
      name: t('LEARN_IMPORT_FULL_MENU', 'Import full menu'),
      url: 'https://docs.ordering.co/docs/products/dashboard/connect/importers/'
    },
    {
      value: 'import_orders',
      name: t('LEARN_IMPORT_ORDERS', 'Import orders'),
      url: 'https://docs.ordering.co/docs/products/dashboard/connect/importers/'
    },
    {
      value: 'customers_general_view',
      name: t('LEARN_CUSTOMERS_GENERAL_VIEW', 'Customers | General overview'),
      url: 'https://docs.ordering.co/docs/products/dashboard/users/customers-overview/'
    },
    {
      value: 'customers_details',
      name: t('LEARN_CUSTOMERS_DETAILS', 'Customers details'),
      url: 'https://docs.ordering.co/docs/products/dashboard/users/view-edit-customer/'
    },
    {
      value: 'business_owners_general_view',
      name: t('LEARN_BUSINESS_OWNERS_GENERAL_VIEW', 'Business owners | General overview'),
      url: 'https://docs.ordering.co/docs/products/dashboard/users/business-owners/'
    },
    {
      value: 'business_owner_details',
      name: t('LEARN_BUSINESS_OWNER_DETAILS', 'Business owner details'),
      url: 'https://docs.ordering.co/docs/products/dashboard/users/manage-business-owner/'
    },
    {
      value: 'managers_general_view',
      name: t('LEARN_MANAGERS_GENERAL_VIEW', 'Managers | General overview'),
      url: 'https://docs.ordering.co/docs/products/dashboard/users/admins/'
    },
    {
      value: 'manager_details',
      name: t('LEARN_MANAGER_DETAILS', 'Manager details'),
      url: 'https://docs.ordering.co/docs/products/dashboard/users/admins/'
    },
    {
      value: 'business_reports',
      name: t('LEARN_BUSINESS_REPORTS', 'Business reports | General overview'),
      url: 'https://docs.ordering.co/docs/products/dashboard/reports/business-reports/'
    },
    {
      value: 'delivery_reports',
      name: t('LEARN_DELIVERY_REPORTS', 'Delivery reports | General overview'),
      url: 'https://docs.ordering.co/docs/products/dashboard/reports/delivery-reports/'
    },
    {
      value: 'reviews_manager',
      name: t('LEARN_REVIEWS_MANAGER', 'Reviews manager | General overview'),
      url: 'https://docs.ordering.co/docs/products/dashboard/reports/review-manager/'
    },
    {
      value: 'reviews_details',
      name: t('LEARN_REVIEWS_DETAILS', 'Reviews details'),
      url: 'https://docs.ordering.co/docs/products/dashboard/reports/review-manager/'
    },
    {
      value: 'invoice_manager',
      name: t('LEARN_INVOICE_MANAGER', 'Invoice manager | Business owner'),
      url: 'https://docs.ordering.co/docs/products/dashboard/reports/invoice-manager/business-invoices/'
    },
    {
      value: 'ordering_website_general_view',
      name: t('LEARN_WEBSITE_GENERAL_VIEW', 'Ordering website | General overview'),
      url: 'https://docs.ordering.co/docs/products/dashboard/my-products/ordering-website-2/'
    },
    {
      value: 'website_basic_settings',
      name: t('LEARN_WEBSITE_BASIC_SETTINGS', 'Basic settings'),
      url: 'https://docs.ordering.co/docs/products/dashboard/my-products/ordering-website-2/settings/'
    },
    {
      value: 'website_advanced_settings',
      name: t('LEARN_WEBSITE_ADVANCED_SETTINGS', 'Advanced settings'),
      url: 'https://docs.ordering.co/docs/products/dashboard/my-products/ordering-website-2/settings/'
    },
    {
      value: 'website_widget',
      name: t('LEARN_WEBSITE_WIDGET', 'Ordering widget'),
      url: 'https://docs.ordering.co/docs/products/dashboard/my-products/ordering-website-2/widget/'
    },
    {
      value: 'ordering_app_advanced_settings',
      name: t('LEARN_ORDERING_APP_ADVANCED_SETTINGS', 'Advanced settings'),
      url: 'https://docs.ordering.co/docs/products/dashboard/my-products/marketplace-app/'
    },
    {
      value: 'ordering_app_resources',
      name: t('LEARN_ORDERING_APP_RESOURCES', 'App resources'),
      url: 'https://docs.ordering.co/docs/products/dashboard/my-products/marketplace-app/app-resources/'
    },
    {
      value: 'settings_standard',
      name: t('LEARN_SETTINGS_STANDARD', 'Standard settings'),
      url: 'https://docs.ordering.co/docs/products/dashboard/settings-overview/'
    },
    {
      value: 'settings_cms',
      name: t('LEARN_ORDERING_CMS', 'CMS'),
      url: 'https://docs.ordering.co/docs/products/dashboard/settings/cms/'
    },
    {
      value: 'settings_pro',
      name: t('LEARN_ORDERING_PRO', 'Pro settings'),
      url: 'https://docs.ordering.co/docs/products/dashboard/settings/pro/'
    },
    {
      value: 'delivery_dashboard',
      name: t('LEARN_DELIVERY_DASHBOARD', 'Delivery dashboard'),
      url: 'https://docs.ordering.co/docs/products/dashboard/delivery/deliveries-dashboard/'
    },
    {
      value: 'drivers_dashboard',
      name: t('LEARN_DELIVERY_DASHBOARD', 'Drivers dashboard'),
      url: 'https://docs.ordering.co/docs/products/dashboard/delivery/drivers-dashboard/'
    },
    {
      value: 'drivers_manager',
      name: t('LEARN_DELIVERY_MANAGER', 'Drivers manager'),
      url: 'https://docs.ordering.co/docs/products/dashboard/delivery/driver-managers/'
    },
    {
      value: 'drivers_delivery_groups',
      name: t('LEARN_DELIVERY_GROUPS', 'Delivery groups'),
      url: 'https://docs.ordering.co/docs/products/dashboard/delivery/delivery-groups/'
    },
    {
      value: 'advance_logistics',
      name: t('LEARN_ADVANCED_LOGISTICS', 'Advanced logistics'),
      url: 'https://docs.ordering.co/docs/products/dashboard/delivery/manage-delivery-group/'
    },
    {
      value: 'drivers_time_display',
      name: t('LEARN_DRIVERS_TIME_DISPLAY', 'Drivers time display'),
      url: 'https://docs.ordering.co/docs/products/dashboard/delivery/drivers-time-display/'
    },
    {
      value: 'all_in_one',
      name: t('LEARN_ALL_IN_ONE', 'All in one'),
      url: 'https://docs.ordering.co/docs/products/dashboard/delivery/all-in-one/'
    },
    {
      value: 'drivers',
      name: t('LEARN_DRIVERS', 'Drivers'),
      url: 'https://docs.ordering.co/docs/products/dashboard/delivery/drivers-list/'
    },
    {
      value: 'driver_details',
      name: t('LEARN_DRIVER_DETAILS', 'Driver details'),
      url: 'https://docs.ordering.co/docs/products/dashboard/delivery/create-edit-driver/'
    },
    {
      value: 'advanced_offers',
      name: t('LEARN_ADVANCED_OFFERS', 'Advanced offers'),
      url: 'https://docs.ordering.co/docs/products/dashboard/marketing/advanced-offers/'
    },
    {
      value: 'ad_banners',
      name: t('LEARN_AD_BANNERS', 'Ad banners'),
      url: 'https://docs.ordering.co/docs/products/dashboard/marketing/ad-banners/'
    },
    {
      value: 'cart_recovery',
      name: t('LEARN_CART_RECOVERY', 'Cart recovery'),
      url: 'https://docs.ordering.co/docs/products/dashboard/marketing/cart-recovery-rules/'
    },
    {
      value: 'business_app_resources',
      name: t('LEARN_BUSINESS_APP_RESOURCES', 'Business app resources'),
      url: 'https://docs.ordering.co/docs/products/dashboard/my-products/business-app/'
    },
    {
      value: 'driver_app_resources',
      name: t('LEARN_DRIVER_APP_RESOURCES', 'Driver app resources'),
      url: 'https://docs.ordering.co/docs/products/dashboard/my-products/driver-app/'
    },
    {
      value: 'points_wallets_and_levels',
      name: t('LEARN_POINT_WALLET_AND_LEVELS', 'Points wallet and levels'),
      url: 'https://docs.ordering.co/docs/products/dashboard/addons/points-wallet-levels/'
    },
    {
      value: 'cash_wallets_and_refunds',
      name: t('LEARN_CASH_WALLETS_AND_REFUNDS', 'Cash wallets and refunds'),
      url: 'https://docs.ordering.co/docs/products/dashboard/addons/cash-wallet-refunds/'
    },
    {
      value: 'gift_card_settings',
      name: t('LEARN_GIFT_CARD_SETTINGS', 'Gift card settings'),
      url: 'https://docs.ordering.co/docs/products/dashboard/addons/gift-cards-settings/'
    },
    {
      value: 'catering_settings',
      name: t('LEARN_CATERING_SETTINGS', 'Catering settings'),
      url: 'https://docs.ordering.co/docs/products/dashboard/addons/catering/'
    },
    {
      value: 'stripe_connect_settings',
      name: t('LEARN_STRIPE_CONNECT_SETTINGS', 'Stripe connect settings'),
      url: 'https://docs.ordering.co/docs/products/dashboard/addons/stripe-connect/'
    },
    {
      value: 'multi_business_settings',
      name: t('LEARN_MULTI_BUSINESS_SETTINGS', 'Multi business settings'),
      url: 'https://docs.ordering.co/docs/products/dashboard/addons/multi-business-checkout/'
    }
  ]
  return options.filter((option) => (key.includes(option.value)))
}
