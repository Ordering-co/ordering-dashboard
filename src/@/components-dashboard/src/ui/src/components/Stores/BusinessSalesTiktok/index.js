import React from 'react'
import { useLanguage } from '../../../../../index'
import { GuideExternalLink, GuideIntro, GuideStep, GuideSteps } from '../BusinessSalesChannel/GuideParts'

// redesign stores 5.15b (; G5-10, G5-13): the TikTok catalog guide, drawn inside BusinessSalesChannel's P/SectionSplit.
// Ten steps and a link to TikTok Ads Manager; like main, it has no step with the store's link.
export const BusinessSalesTiktok = () => {
  const [, t] = useLanguage()

  const steps = [
    t('SALES_TIKTOK_STEP_1', 'Enter a name for the catalog.'),
    t('SALES_TIKTOK_STEP_2', 'Open “Business Center”. Select yours if you already have one, or select “Create”.'),
    t('SALES_TIKTOK_STEP_3', 'Enter a name for the Business Center, choose its time zone and select “Create”.'),
    t('SALES_TIKTOK_STEP_4', 'Open “Business Center” again and select the one you just created.'),
    t('SALES_TIKTOK_STEP_5', 'In “Industry”, choose “E-commerce”.'),
    t('SALES_TIKTOK_STEP_6', 'Choose the default location and currency, then select “Create”.'),
    t('SALES_TIKTOK_STEP_7', 'TikTok shows a short tour of the catalog dashboard.'),
    t('SALES_TIKTOK_STEP_8', 'Now add your products: select “Products” in the side menu, then “Add products”.'),
    t('SALES_TIKTOK_STEP_9', 'Choose how you want to upload your products and select “Next”.'),
    t('SALES_TIKTOK_STEP_10', 'Fill in the requested fields and select “Import”.')
  ]

  return (
    <div className='odc-sales-guide'>
      <GuideIntro>
        {t('SALES_TIKTOK_INTRO', 'In TikTok Ads Manager, a catalog holds the products you can show on TikTok. Open “Catalogs”, select “Add catalog” and fill in the window that opens.')}
      </GuideIntro>
      <GuideExternalLink href='https://ads.tiktok.com/i18n/home'>
        {t('SALES_TIKTOK_OPEN', 'Open TikTok Ads Manager')}
      </GuideExternalLink>
      <GuideSteps>
        {steps.map((text, index) => (
          <GuideStep key={index} number={index + 1} text={text} />
        ))}
      </GuideSteps>
    </div>
  )
}
