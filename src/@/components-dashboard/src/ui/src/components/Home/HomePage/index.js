import React, { useState, useEffect } from 'react'
import moment from 'moment'
import { useTheme } from 'styled-components'
import { Line } from 'react-chartjs-2'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import HubspotForm from 'react-hubspot-form'
import {
  List as MenuIcon,
  Basket as OrdersIcon,
  Cash as SalesIcon,
  FileEarmarkCode,
  Gear
} from 'react-bootstrap-icons'

import { useLanguage, useUtils, useEvent, useSession, useApi, useSite, Home as HomeController, useConfig } from '../../../../../index'
import { useSourceCodeTranslator } from '../../../../../components/SourceCodeDownloads/useSourceCodeTranslator'
import { IconButton, Button, ButtonLink } from '../../../styles/Buttons'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { useProjectState } from '../../../contexts/ProjectContext'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { getCurrentDiffDays } from '../../../utils'
import { getPreferredSiteUrl } from '../../../utils/getPreferredSiteUrl'
import { getIntercomHash, setIntercomSettings } from '~/components/Utils'
import { Modal } from '../../Shared'
import { TrialExtensionHomeCard } from '../../TrialExtension'
import { ProjectStatusBadge } from '../ProjectStatusBadge'
import {
  HomeContainer,
  Breadcrumb,
  HeaderContainer,
  WelcomeMsg,
  GuideMsg,
  Reports,
  SalesGraphContainer,
  ChartHeaderContainer,
  OrdersAndSalesWrapper,
  OrdersOrSalesContainer,
  DetailsContent,
  BoxIconContainer,
  ParagraphHeaders,
  AssistanceWidgets,
  AssistanceTitle,
  AssistanceBody,
  WidgeBlock,
  ProjectStatusContainer,
  ProjectInfoWrapper,
  GreetingText,
  ProjectStatusDescription,
  ProjectStatusWrapper,
  CloseButtonWrapper,
  HubspotFormWrapper,
  OnboardingLessonsContainer,
  MoreServicesSection,
  MoreServicesTitle,
  MoreServicesGrid,
  MoreServiceCard,
  MoreServiceCardBody,
  MoreServiceTextContent,
  MoreServiceIconBox,
  MoreServiceCardHeading,
  MoreServiceCardDescription,
  MoreServiceCardFooter
} from './styles'

const PLATFORM_DEMO_PRICING_URL = 'https://www.ordering.co/platform-demo-and-pricing'

const HomeUI = (props) => {
  const {
    ordersList,
    todaySalelsList,
    monthSalesList,
    getCurrentDateRange,
    disableSupportModule
  } = props

  const theme = useTheme()
  const [languageState, apiTranslator] = useLanguage()
  const t = useSourceCodeTranslator(apiTranslator, languageState.language)
  const [{ configs, loading: loadingConfigs }] = useConfig()
  const [{ sites }] = useSite()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [timeAxes, setTimeAxes] = useState([])
  const [events] = useEvent()
  const [projectStatus] = useProjectState()
  const { width } = useWindowSize()
  const [{ parsePrice }] = useUtils()
  const [sessionState] = useSession()
  const [ordering, { configurations }] = useApi()

  const [showForm, setShowForm] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const isEnabledWhiteLabelModule = configs?.white_label_module?.value

  const project = {
    active: {
      description: t('ORDERING_GUIDE_MSG', 'Our guide helps you to configure your Ordering products.'),
      status: t('PROJECT_ACTIVE', 'Project Active'),
      image: theme.images.project.active
    },
    past_due: {
      description: t('PROJECT_PAST_DUE_PAYMENT', 'Your account will be suspended in the next _days_ days due to your billing status, please check it to avoid any issues.'),
      status: t('PROJECT_PAST_DUE_PAYMENT', 'Project Past Due Payment'),
      image: theme.images.project.pastDuePayment
    }
  }

  const goToLink = (location) => {
    if (location === 'sales') {
      window.open(`https://www.${configurations?.subdomain}.com/contact-ordering`, '_blank')
    }
    if (location === 'tech') {
      window.open(`https://support.${configurations?.subdomain}.com`, '_blank')
    }
    if (location === 'onboarding') {
      window.open(`https://calendly.com/luisana/group-onboarding-conference?month=${moment().format('YYYY-MM')}`, '_blank')
    }
  }

  const generateData = () => {
    const values = []
    timeAxes.forEach(function (axe) {
      const index = monthSalesList?.sales?.findIndex(history => {
        return axe === history?.time
      })
      if (index !== -1) {
        values.push({ x: monthSalesList?.sales[index]?.time, y: monthSalesList?.sales[index]?.sales })
      } else {
        values.push({ x: axe, y: 0 })
      }
    })
    return values
  }

  const handleGoToPage = (e, data) => {
    e.preventDefault()
    events.emit('go_to_page', data)
  }

  const updateTimeAxes = () => {
    const unitdate = getTimeAxes(getCurrentDateRange()).time.unit
    const maxdate = moment(getTimeAxes(getCurrentDateRange()).time.max).endOf(unitdate)
    const mindate = moment(getTimeAxes(getCurrentDateRange()).time.min).startOf(unitdate)
    let curDate = mindate
    const newTimeAxes = []
    let adder = 'd'
    switch (unitdate) {
      case 'day': adder = 'd'
        break
      case 'month': adder = 'M'
        break
      case 'year': adder = 'y'
        break
      case 'hour': adder = 'h'
        break
      default: break
    }
    do {
      newTimeAxes.push(moment(curDate._d.getTime()).format('YYYY-MM-DD HH:mm:ss'))
      curDate = curDate.clone().add(1, adder)
    }
    while (curDate <= maxdate)
    setTimeAxes(newTimeAxes)
  }

  const getTimeAxes = (lapse) => {
    const xAxes = {
      type: 'time',
      grid: {
        display: false
      },
      time: {
        stepSize: 1,
        displayFormats: {
          hour: 'LT'
        }
      },
      ticks: {
        fontSize: 12,
        fontColor: '#CED4DA'
      }
    }

    xAxes.time.unit = 'day'
    xAxes.time.min = moment().subtract(30, 'days').format('YYYY-MM-DD')
    xAxes.time.max = moment().format('YYYY-MM-DD')
    return xAxes
  }

  const defaultData = {
    datasets: [
      {
        data: generateData(),
        fill: false,
        backgroundColor: 'rgba(75,192,192,0.2)',
        borderColor: '#2C7BE5',
        tension: 0.4,
        borderWidth: 3
      }
    ]
  }

  const options = {
    scales: {
      x: getTimeAxes(),
      y: {
        beginAtZero: true,
        grid: {
          drawBorder: false
        },
        ticks: {
          font: {
            size: 11,
            color: '#CED4DA'
          }
        }
      }
    },
    plugins: {
      legend: {
        display: false
      }
    },
    pointRadius: 0
  }

  const getTotalSales = () => {
    let data = 0
    for (const sale of monthSalesList?.sales) {
      data += sale.sales
    }

    return parsePrice(data, { separator: '.' })
  }

  useEffect(() => {
    updateTimeAxes()
  }, [])

  const FormLoading = () => {
    return (
      <div>
        {[...Array(4).keys()].map(key => (
          <React.Fragment key={key}>
            <Skeleton height={15} width={300} style={{ marginBottom: 10 }} />
            <Skeleton height={35} style={{ marginBottom: 30 }} />
          </React.Fragment>
        ))}
      </div>
    )
  }

  useEffect(() => {
    if (monthSalesList?.loading || loadingConfigs || projectStatus?.loading) return
    const values = {
      project_code: projectStatus?.project?.code,
      ...(sessionState?.user?.user_system_id ? { project_owner_id: sessionState?.user?.user_system_id } : {}),
      project_current_status: projectStatus?.project?.current_status,
      project_current_status_until: projectStatus?.project?.project_current_status_until,
      ...(projectStatus?.plan?.id ? { project_plan: projectStatus?.plan?.id } : {}),
      project_sales_last_30_days: monthSalesList?.sales ?? [],
      project_addons: Object.keys(configs).filter(config => config.includes('addon_')).map(c => configs[c])
    }
    const setIntercom = async () => {
      const userIntercomHash = await getIntercomHash({ userId: sessionState?.user?.email, token: sessionState?.token })
      if (userIntercomHash) {
        setIntercomSettings({
          ...values,
          user_hash: userIntercomHash,
          company: {
            id: projectStatus?.project?.id,
            name: projectStatus?.project?.code
          }
        }, sessionState?.user)
      }
    }
    setIntercom()
  }, [monthSalesList?.loading, projectStatus?.loading, loadingConfigs])

  return (
    <>
      <HomeContainer>
        <Breadcrumb>
          {isCollapse && (
            <IconButton
              color='black'
              onClick={() => handleMenuCollapse(false)}
            >
              <MenuIcon />
            </IconButton>
          )}
          <h1>{t('HOME', 'Home')}</h1>
        </Breadcrumb>

        {projectStatus?.loading && (
          <HeaderContainer>
            <Skeleton height={150} />
          </HeaderContainer>
        )}

        {!projectStatus?.loading && (
          <>
            {!projectStatus?.project?.current_status
              ? (
                <HeaderContainer>
                  <WelcomeMsg>{t('WELCOME_TO_ORDERING', 'Welcome to Ordering')}!</WelcomeMsg>
                  <GuideMsg>{t('ORDERING_GUIDE_MSG', 'Our guide helps you to configure your Ordering products.')}</GuideMsg>
                </HeaderContainer>
                )
              : (
                <ProjectStatusContainer>
                  <ProjectInfoWrapper>
                    <GreetingText>{t('WELCOME', 'Welcome')} {sessionState?.user?.name}!</GreetingText>
                    <ProjectStatusDescription>
                      {
                        (projectStatus.project?.current_status_until && projectStatus.project?.current_status === 'past_due')
                          ? project[projectStatus.project?.current_status]?.description.replace('_days_', getCurrentDiffDays(projectStatus.project?.current_status_until))
                          : project[projectStatus.project?.current_status]?.description
                      }
                    </ProjectStatusDescription>
                    <ProjectStatusWrapper>
                      <ProjectStatusBadge
                        currentStatus={projectStatus.project?.current_status}
                        trialSubscription={projectStatus?.trialSubscription}
                        statusLabel={project[projectStatus.project?.current_status]?.status}
                      />
                      {sessionState?.user?.level !== 2 && (
                        <Button
                          color='primary'
                          borderRadius='8px'
                          disabled={!projectStatus?.websiteProduct}
                          onClick={() => {
                            const websiteUrl = getPreferredSiteUrl({
                              sites,
                              configurations,
                              configs,
                              ordering,
                              websiteProduct: projectStatus?.websiteProduct
                            })
                            if (websiteUrl) window.open(websiteUrl, '_blank')
                          }}
                        >
                          {t('VISIT_MY_WEBSITE', 'Visit my Website')}
                        </Button>
                      )}
                    </ProjectStatusWrapper>
                  </ProjectInfoWrapper>
                  <img src={project[projectStatus.project?.current_status]?.image} alt='' />
                </ProjectStatusContainer>
                )}
          </>
        )}
        <TrialExtensionHomeCard />
        <ParagraphHeaders>
          <p>{t('REPORTS', 'Reports')}</p>
          <ButtonLink
            color='lightPrimary'
            onClick={(e) => handleGoToPage(e, { page: 'business_analytics' })}
            href='/intelligence/business'
            role='link'
          >
            {t('SEE_MORE_REPORTS', 'See more reports')}
          </ButtonLink>
        </ParagraphHeaders>
        <Reports>
          <SalesGraphContainer>
            <ChartHeaderContainer>
              <p>{t('THIS_MONTH_SALES', 'This month sales')}</p>
              {
                monthSalesList?.loading ? <Skeleton width={70} height={30} /> : <h3>{getTotalSales()}</h3>
              }
            </ChartHeaderContainer>
            {
              monthSalesList?.loading ? <Skeleton height={150} /> : <Line data={defaultData} options={options} height={width > 1400 ? '106px' : ''} />
            }
          </SalesGraphContainer>
          <OrdersAndSalesWrapper>
            <OrdersOrSalesContainer>
              <DetailsContent>
                <p>{t('TODAY_ORDERS', 'Today Orders')}</p>
                {
                  ordersList?.loading ? <Skeleton width={70} height={30} /> : <h2>{ordersList?.orders}</h2>
                }
              </DetailsContent>
              <BoxIconContainer>
                <OrdersIcon />
              </BoxIconContainer>
            </OrdersOrSalesContainer>
            <OrdersOrSalesContainer>
              <DetailsContent>
                <p>{t('TODAY_SALES', 'Today Sales')}</p>
                {
                  todaySalelsList?.loading ? <Skeleton width={70} height={30} /> : <h2>{parsePrice(todaySalelsList?.sales, { separator: '.' })}</h2>
                }
              </DetailsContent>
              <BoxIconContainer isSales>
                <SalesIcon />
              </BoxIconContainer>
            </OrdersOrSalesContainer>
          </OrdersAndSalesWrapper>
        </Reports>
        {sessionState?.user?.level === 0 && (
          <MoreServicesSection aria-labelledby='more-services-heading'>
            <MoreServicesTitle id='more-services-heading'>
              {t('MORE_SERVICES', 'More Services')}
            </MoreServicesTitle>
            <MoreServicesGrid>
              <MoreServiceCard>
                <MoreServiceCardBody>
                  <MoreServiceIconBox>
                    <FileEarmarkCode aria-hidden />
                  </MoreServiceIconBox>
                  <MoreServiceTextContent>
                    <MoreServiceCardHeading>
                      {t('SOURCE_CODE_HOME_TITLE', 'Website Marketplace source code')}
                    </MoreServiceCardHeading>
                    <MoreServiceCardDescription>
                      {t('SOURCE_CODE_HOME_DESCRIPTION', 'Find the available Website Marketplace version, installation instructions, and license.')}
                    </MoreServiceCardDescription>
                  </MoreServiceTextContent>
                </MoreServiceCardBody>
                <MoreServiceCardFooter>
                  <ButtonLink
                    color='black'
                    borderRadius='8px'
                    href='/open-source-code'
                  >
                    {t('SOURCE_CODE_HOME_CTA', 'View source code')}
                  </ButtonLink>
                </MoreServiceCardFooter>
              </MoreServiceCard>
              <MoreServiceCard>
                <MoreServiceCardBody>
                  <MoreServiceIconBox $variant='custom'>
                    <Gear aria-hidden />
                  </MoreServiceIconBox>
                  <MoreServiceTextContent>
                    <MoreServiceCardHeading>
                      {t('CUSTOM_WORK_AND_TEMPLATES', 'CUSTOM WORK & TEMPLATES')}
                    </MoreServiceCardHeading>
                    <MoreServiceCardDescription>
                      {t('CUSTOM_WORK_DESCRIPTION', 'Tailored integrations, specific features, and unique UI design templates.')}
                    </MoreServiceCardDescription>
                  </MoreServiceTextContent>
                </MoreServiceCardBody>
                <MoreServiceCardFooter>
                  <ButtonLink
                    color='black'
                    borderRadius='8px'
                    href={PLATFORM_DEMO_PRICING_URL}
                    target='_blank'
                    rel='noopener noreferrer'
                    aria-label={t('CONTACT_US_CUSTOM_WORK_ARIA', 'Contact us about custom work and templates — opens Ordering demo and pricing in a new tab')}
                  >
                    {t('CONTACT_US', 'Contact Us')}
                  </ButtonLink>
                </MoreServiceCardFooter>
              </MoreServiceCard>
            </MoreServicesGrid>
          </MoreServicesSection>
        )}
        {sessionState?.user?.level !== 2 && !disableSupportModule && (
          <>
            <ParagraphHeaders>
              <p>{t('SUPPORT', 'Support')}</p>
            </ParagraphHeaders>
            <AssistanceWidgets>
              <AssistanceTitle>
                <h1>{t('SUPPORT_TITLE_START', 'Which kind of')}{' '}
                  <span>{t('SUPPORT_TITLE_END', 'assistance do you need?')}</span>
                </h1>
                <p>{t('ASSIST_SUB_TITILE', 'Choose the asistance you are looking for in the buttons below.')}</p>
              </AssistanceTitle>
              <AssistanceBody>
                <WidgeBlock>
                  <h3>{t('CONTACT_SALES_TEAM', 'Contact our Sales Team')}</h3>
                  <p>{t('CONTACT_SALES_SUB_TITLE', 'Ask about pricing, custom work, budget and more money talk')}</p>
                  <Button outline color='primary' onClick={() => goToLink('sales')}>{t('SALES_CONTACT', 'Sales Contact')}</Button>
                </WidgeBlock>
                <WidgeBlock>
                  <h3>{t('CONTACT_SUPPORT_TEAM', 'Contact our Support Team')}</h3>
                  <p>{t('CONTACT_SUPPORT_SUB_TITLE', 'Ask about your ordering installation, products and features')}</p>
                  <Button outline color='primary' onClick={() => goToLink('tech')}>{t('TECH_SUPPORT', 'Tech Support')}</Button>
                </WidgeBlock>
              </AssistanceBody>
            </AssistanceWidgets>
            {!isEnabledWhiteLabelModule && (
              <OnboardingLessonsContainer>
                <h1>{t('ONBOARDING_LESSONS', 'On-boarding Lessons')}</h1>
                <p>{t('BOOK_TRAINING_TOTDAY', 'Book your training today')}</p>
                <Button outline color='primary' onClick={() => goToLink('onboarding')}>{t('SCHEDULE_TODAY', 'Schedule Today')}</Button>
              </OnboardingLessonsContainer>
            )}
          </>
        )}
      </HomeContainer>
      {showForm && (
        <Modal
          width='769px'
          padding='30px'
          title={t('ORDERING', 'Ordering')}
          open={showForm}
          onClose={() => {
            setIsSubmitted(false)
            setShowForm(false)
          }}
        >
          <HubspotFormWrapper>
            <HubspotForm
              region='na1'
              portalId='6130635'
              formId='a307934c-a5da-4b85-845e-f6d616351814'
              onFormSubmitted={() => setIsSubmitted(true)}
              loading={<FormLoading />}
            />
            {isSubmitted && (
              <CloseButtonWrapper>
                <Button
                  color='primary'
                  onClick={() => {
                    setIsSubmitted(false)
                    setShowForm(false)
                  }}
                >
                  {t('CLOSE', 'Close')}
                </Button>
              </CloseButtonWrapper>
            )}
          </HubspotFormWrapper>
        </Modal>
      )}
    </>
  )
}

export const HomePage = (props) => {
  const homeProps = {
    ...props,
    UIComponent: HomeUI
  }

  return <HomeController {...homeProps} />
}
