import React, { useId, useState } from 'react'
import moment from 'moment'
import HubspotForm from 'react-hubspot-form'

import { useLanguage, useConfig } from '../../../../../index'
import { useSourceCodeTranslator } from '../../../../../components/SourceCodeDownloads/useSourceCodeTranslator'
import { Button, CatalogCard, Dialog, Skeleton } from '../../Shared/Product'
import './blocks.css'

/**
 * Support and onboarding (redesign home C2, D6, D7): moved out of the old page without changing what they do or say. Level 2
 * has none of this; the support module and the onboarding lessons keep their rules (`level !== 2 && !disableSupportModule`,
 * onboarding hidden with the white label module). main removed the More Services cards (source code, custom work).
 */
export const MoreServices = ({ level, disableSupportModule }) => {
  const [languageState, apiTranslator] = useLanguage()
  const t = useSourceCodeTranslator(apiTranslator, languageState?.language)
  const [{ configs }] = useConfig()
  const supportId = useId()
  const onboardingId = useId()

  // redesign home C2 (HM-03, P4): the HubSpot form stays as unreachable as in `main`; nothing sets `showForm` to true and no trigger is added
  const [showForm, setShowForm] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const isEnabledWhiteLabelModule = configs?.white_label_module?.value
  const showSupport = Number(level) !== 2 && !disableSupportModule

  const goToLink = (location) => {
    if (location === 'sales') {
      window.open('https://www.ordering.co/contact/', '_blank', 'noopener,noreferrer')
    }
    if (location === 'tech') {
      window.open('https://docs.ordering.co/', '_blank', 'noopener,noreferrer')
    }
    if (location === 'onboarding') {
      window.open(`https://calendly.com/luisana/group-onboarding-conference?month=${moment().format('YYYY-MM')}`, '_blank', 'noopener,noreferrer')
    }
  }

  const closeForm = () => {
    setIsSubmitted(false)
    setShowForm(false)
  }

  return (
    <>
      {showSupport && (
        <>
          <section className='odc-home-more' data-slot='home-support' aria-labelledby={supportId}>
            <h2 className='odc-home-section-title' id={supportId}>{t('SUPPORT', 'Support')}</h2>
            <div className='odc-home-support-lead'>
              <p className='odc-home-support-title'>
                {t('SUPPORT_TITLE_START', 'Which kind of')}{' '}
                <span>{t('SUPPORT_TITLE_END', 'assistance do you need?')}</span>
              </p>
              <p className='odc-home-more-description'>{t('ASSIST_SUB_TITILE', 'Choose the assistance you are looking for in the buttons below.')}</p>
            </div>
            <div className='odc-home-more-grid'>
              <CatalogCard
                as='article'
                titleAs='h3'
                layout='inline'
                title={t('CONTACT_SALES_TEAM', 'Contact our Sales Team')}
                description={t('CONTACT_SALES_SUB_TITLE', 'Ask about pricing, custom work, budgets and more.')}
                footer={<Button onClick={() => goToLink('sales')}>{t('SALES_CONTACT', 'Sales Contact')}</Button>}
              />
              <CatalogCard
                as='article'
                titleAs='h3'
                layout='inline'
                title={t('CONTACT_SUPPORT_TEAM', 'Contact our Support Team')}
                description={t('CONTACT_SUPPORT_SUB_TITLE', 'Ask about your Ordering.co installation, products and features.')}
                footer={<Button onClick={() => goToLink('tech')}>{t('TECH_SUPPORT', 'Tech Support')}</Button>}
              />
            </div>
          </section>
          {!isEnabledWhiteLabelModule && (
            <section className='odc-home-block odc-home-onboarding' data-slot='home-onboarding' aria-labelledby={onboardingId}>
              <div className='odc-home-more-text'>
                <h2 className='odc-home-more-heading' id={onboardingId}>{t('ONBOARDING_LESSONS', 'On-boarding Lessons')}</h2>
                <p className='odc-home-more-description'>{t('BOOK_TRAINING_TOTDAY', 'Book your training today')}</p>
              </div>
              <Button onClick={() => goToLink('onboarding')}>{t('SCHEDULE_TODAY', 'Schedule Today')}</Button>
            </section>
          )}
        </>
      )}
      {showForm && (
        <Dialog
          open={showForm}
          onOpenChange={(next) => { if (!next) closeForm() }}
          title={t('ORDERING', 'Ordering.co')}
          closeLabel={t('CLOSE', 'Close')}
          size='lg'
        >
          <div className='odc-home-hubspot'>
            <HubspotForm
              region='na1'
              portalId='6130635'
              formId='a307934c-a5da-4b85-845e-f6d616351814'
              onFormSubmitted={() => setIsSubmitted(true)}
              loading={(
                <div className='odc-home-hubspot-loading'>
                  {[...Array(4).keys()].map(key => (
                    <React.Fragment key={key}>
                      <Skeleton size='40%' />
                      <Skeleton size='100%' block='var(--od-x-control-height)' />
                    </React.Fragment>
                  ))}
                </div>
              )}
            />
            {isSubmitted && (
              <div className='odc-home-hubspot-close'>
                <Button variant='primary' onClick={closeForm}>{t('CLOSE', 'Close')}</Button>
              </div>
            )}
          </div>
        </Dialog>
      )}
    </>
  )
}
