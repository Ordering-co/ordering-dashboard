import React from 'react'
import { useLanguage } from '../../../../../index'
import { GuideExternalLink, GuideIntro, GuideStep, GuideSteps, StoreLink } from '../BusinessSalesChannel/GuideParts'

// redesign stores 5.15b (; G5-04, G5-10, G5-11, G5-13): the Google Business Profile guide, drawn inside
// BusinessSalesChannel's P/SectionSplit (which owns its title, X and «‹ Back»). The three steps and screenshots are main's; the
// sign-up link no longer forces the Spanish page (main: /intl/es/business/sign-up).
export const BusinessSalesGoogle = ({ link }) => {
  const [, t] = useLanguage()

  return (
    <div className='odc-sales-guide'>
      <GuideIntro>
        {t('SALES_GOOGLE_INTRO', 'Your Business Profile is what people see for your business on Google Search and Maps. If you don\'t have one yet, create it first.')}
      </GuideIntro>
      <GuideExternalLink href='https://www.google.com/business/'>
        {t('SALES_GOOGLE_OPEN', 'Open Google Business Profile')}
      </GuideExternalLink>
      <GuideSteps>
        <GuideStep number={1} text={t('SALES_GOOGLE_STEP_1', 'Sign in to Google Business Profile and open your business\'s location.')} />
        <GuideStep number={2} text={t('SALES_GOOGLE_STEP_2', 'Open the Info section of that location.')} />
        <GuideStep number={3} text={t('SALES_GOOGLE_STEP_3', 'Scroll down to the “Order ahead links” and “Menu link” fields and paste this link in them.')}>
          <StoreLink link={link} />
        </GuideStep>
      </GuideSteps>
    </div>
  )
}
