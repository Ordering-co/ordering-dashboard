import React from 'react'
import { useLanguage } from '../../../../../index'
import { GuideIntro, GuideStep, GuideSteps, StoreLink } from '../BusinessSalesChannel/GuideParts'

// redesign stores 5.15b (; G5-04, G5-12, G5-14): main's three steps and screenshots, as plain text, now with the store's
// own link (main rendered this tab without it, so it always showed a placeholder address).
export const AdvancedInstagram = ({ link }) => {
  const [, t] = useLanguage()

  return (
    <>
      <GuideIntro>
        {t('SALES_INSTAGRAM_ADVANCED_INTRO', 'Some business accounts can add an action button, such as “Order food”, to their profile. Use this guide if “Action buttons” shows on your “Edit profile” screen.')}
      </GuideIntro>
      <GuideSteps>
        <GuideStep number={1} text={t('SALES_INSTAGRAM_STEP_EDIT_PROFILE', 'Open your Instagram profile and tap “Edit profile”.')} />
        <GuideStep number={2} text={t('SALES_INSTAGRAM_ADVANCED_STEP_2', 'Tap “Action buttons” and choose the button you want.')} />
        <GuideStep number={3} text={t('SALES_INSTAGRAM_ADVANCED_STEP_3', 'Choose “Your business”, paste this link and tap “Done”.')}>
          <StoreLink link={link} />
        </GuideStep>
      </GuideSteps>
    </>
  )
}
