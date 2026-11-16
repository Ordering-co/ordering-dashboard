import React from 'react'
import { useLanguage } from '../../../../../index'
import { GuideIntro, GuideStep, GuideSteps, StoreLink } from '../BusinessSalesChannel/GuideParts'

// redesign stores 5.15b (; G5-04, G5-10, G5-14): main's five steps and screenshots, as plain text (main injected the
// translation as HTML, and its default left a strong tag open); the button names Instagram shows go in quotes.
export const GeneralInstagram = ({ link }) => {
  const [, t] = useLanguage()

  return (
    <>
      <GuideIntro>
        {t('SALES_INSTAGRAM_GENERAL_INTRO', 'Add the link to your Instagram profile so anyone who visits it can order.')}
      </GuideIntro>
      <GuideSteps>
        <GuideStep number={1} text={t('SALES_INSTAGRAM_STEP_EDIT_PROFILE', 'Open your Instagram profile and tap “Edit profile”.')} />
        <GuideStep number={2} text={t('SALES_INSTAGRAM_GENERAL_STEP_2', 'Tap “Links”.')} />
        <GuideStep number={3} text={t('SALES_INSTAGRAM_GENERAL_STEP_3', 'Tap “Add external link”, or edit the link you already have.')} />
        <GuideStep number={4} text={t('SALES_INSTAGRAM_GENERAL_STEP_4', 'Paste this link in the URL field and save.')}>
          <StoreLink link={link} />
        </GuideStep>
        <GuideStep number={5} text={t('SALES_INSTAGRAM_GENERAL_STEP_5', 'Done: the link shows on your Instagram profile.')} />
      </GuideSteps>
    </>
  )
}
