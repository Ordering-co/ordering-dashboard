import { useTheme } from 'styled-components'
import { useApi, useLanguage } from '../../../../../index'

export const AppsUtilities = () => {
  const [, t] = useLanguage()
  const [, { configurations }] = useApi()
  const theme = useTheme()

  const getAppInfo = (app) => {
    const valuesToUse = {
      title: app?.name,
      demo_link: `https://www.${configurations?.subdomain}.com/platform-demo-and-pricing`
    }
    const apps = {
      marketplace: {
        description: t('CUSTOMER_APP_DESCRIPTION', 'Give your business owners or managers a tool to manage their whole business\'s incoming orders on the go by installing this app on any mobile device they have.'),
        images: {
          live: theme.images.myProducts.multiStoreCustomerApp,
          brand: theme.images.myProducts.singleStoreCustomerApp
        },
        live_title: t('MULTI-STORE-CUSTOMER-APP', 'Multi-store Customer App'),
        live_description: t('MULTI_STORE_CUSTOMER_APP_DESCRIPTION', 'This is a branded Orderingplus product. use it with your project, email, and password for free. features might be limited.'),
        demo_book_message: 'I would like to book a Demo for the customer app , can you assist me?',
        brand_title: t('SINGLE_STORE_CUSTOMER_APP', 'Single Store Customer App'),
        brand_description: t('SINGLE_STORE_CUSTOMER_APP_DESCRIPTION', 'This App is delivered in less than five working days, fully branded with your guidelines, removing all Orderingplus presence to give your brand more awareness.'),
        purchase_message: 'I would like to know about the customer app, can you assist me?',
        downloads: [
          { id: 1, icon: theme.images.myProducts.appStoreSmall, link: 'https://apps.apple.com/us/app/customer-app-2-0/id1607414555' },
          { id: 2, icon: theme.images.myProducts.playStoreSmall, link: 'https://play.google.com/store/apps/details?id=com.ordering.onlineorderingappv5&hl=en&gl=US' }
        ],
        purchase_link: 'https://buy.stripe.com/5kA4in4Fp86Kg9yfZN'
      },
      driver: {
        description: t('DRIVER_APP_DESCRIPTION', 'Your fleet\'s best companion gives drivers a tool to receive orders, follow optimal routes, add delivery evidence, set orders\' timing, and control their busy times.'),
        images: {
          live: theme.images.myProducts.driverAppFree,
          brand: theme.images.myProducts.driverAppBrand
        },
        live_title: t('FREE_TO_USE', 'Free to use'),
        live_description: t('DRIVER_APP_FREE_TO_USE_DESCRIPTION', 'This is a branded Orderingplus product. use it with your project, email, and password for free. features might be limited.'),
        brand_title: t('YOUR_BRANDED_APP', 'Your Branded App'),
        brand_description: t('DRIVER_APP_BRANDED_DESCRIPTION', 'This App is delivered in less than five working days, fully branded with your guidelines, removing all Orderingplus presence to give your brand more awareness.'),
        demo_book_message: 'I would like to book a Demo about the Driver app , can you assist me?',
        purchase_message: 'I would like to know about the Driver app, can you assist me?',
        downloads: [
          { id: 1, icon: theme.images.myProducts.appStoreSmall, link: 'https://apps.apple.com/us/app/driver-app-2-0/id1606257815' },
          { id: 2, icon: theme.images.myProducts.playStoreSmall, link: 'https://play.google.com/store/apps/details?id=com.ordering.deliveryv5' }
        ],
        purchase_link: 'https://buy.stripe.com/dR6g151tdcn0g9y3d3'
      },
      business: {
        description: t('STORE_APP_DESCRIPTION', 'Give your business owners or managers a tool to manage their whole business\'s incoming orders on the go by installing this app on any mobile device they have.'),
        images: {
          live: theme.images.myProducts.storeAppFree,
          brand: theme.images.myProducts.storeAppBrand
        },
        live_title: t('FREE_TO_USE', 'Free to use'),
        live_description: t('STORE_APP_FREE_TO_USE_DESCRIPTION', 'This is a branded Orderingplus product. use it with your project, email, and password for free. features might be limited.'),
        demo_book_message: 'I would like to book a Demo about the Store app , can you assist me?',
        brand_title: t('YOUR_BRANDED_APP', 'Your Branded App'),
        brand_description: t('STORE_APP_BRANDED_DESCRIPTION', 'This App is delivered in less than five working days, fully branded with your guidelines, removing all Orderingplus presence to give your brand more awareness.'),
        purchase_message: 'I would like to know about the Store app, can you assist me?',
        downloads: [
          { id: 1, icon: theme.images.myProducts.appStoreSmall, link: 'https://apps.apple.com/us/app/store-app-2-0/id1608192050' },
          { id: 2, icon: theme.images.myProducts.playStoreSmall, link: 'https://play.google.com/store/apps/details?id=com.ordering.storeappv5&pli=1' }
        ],
        purchase_link: 'https://buy.stripe.com/aEU5mr2xhgDg4qQcNC'
      }
    }

    const code = Object.keys(apps).find(key => app?.base?.code.includes(key))
    const option = apps?.[code] ?? apps.marketplace

    return { ...option, ...valuesToUse }
  }

  const settingsList = [
    { key: 'basic', name: t('BASIC_SETTINGS', 'Basic Settings') },
    { key: 'advanced', name: t('ADVANCED_SETTINGS', 'Advanced Settings') }
  ]

  return {
    getAppInfo,
    settingsList
  }
}
