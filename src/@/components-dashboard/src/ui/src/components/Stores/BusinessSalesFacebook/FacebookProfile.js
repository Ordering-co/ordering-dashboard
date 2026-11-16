import React from 'react'
import { useLanguage } from '../../../../../index'
import { GuideIntro, GuideStep, GuideSteps, StoreLink } from '../BusinessSalesChannel/GuideParts'

// redesign stores 5.15b (; G5-04, G5-10): the five steps and screenshots are main's; the link is the store's real one
// with «Copy link», and the intro (placeholder text in main) says what the button does.
export const FacebookProfile = ({ link }) => {
  const [, t] = useLanguage()

  return (
    <>
      <GuideIntro>
        {t('SALES_FACEBOOK_INTRO', 'A Facebook page can show an action button next to “Message”. Point it to this store so people can start an order in one tap.')}
      </GuideIntro>
      <GuideSteps>
        <GuideStep number={1} text={t('SALES_FACEBOOK_STEP_1', 'Copy your store\'s ordering link.')}>
          <StoreLink link={link} />
        </GuideStep>
        <GuideStep number={2} text={t('SALES_FACEBOOK_STEP_2', 'On your Facebook page, open the “…” menu on the right and choose “Edit action button”.')} />
        <GuideStep number={3} text={t('SALES_FACEBOOK_STEP_3', 'Choose “Start order” from the list of buttons.')} />
        <GuideStep number={4} text={t('SALES_FACEBOOK_STEP_4', 'In the window that opens, paste the link and select “Save”.')} />
        <GuideStep number={5} text={t('SALES_FACEBOOK_STEP_5', 'The button now shows on your Facebook page.')} />
      </GuideSteps>
    </>
  )
}
