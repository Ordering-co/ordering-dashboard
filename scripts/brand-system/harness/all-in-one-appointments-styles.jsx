import React, { useState } from 'react'
// the Product pieces read the --od-x-* candidate tokens, which the app loads in src/index.js
import '../../../src/brand/candidates.css'

// redesign all-in-one B3 (moved the page layout to AllInOne/all-in-one-board.css): AllInOne/styles.js no longer exports TopContent,
// DriversContainer, OrdersContainer or WrapperDriversLocation, and AllInOne/DriversManager/styles.js is gone, so the fixture no longer
// draws the old top/drivers/orders containers nor the drivers list. It keeps what the page still paints with styled pieces
// (OrdersListContainer, OrderSubFilterControls, OrderStatusSubFilterWrapper, WrapperIndicator), now inside the new .aio-board frame.
import '../../../src/@/components-dashboard/src/ui/src/components/Orders/AllInOne/all-in-one-board.css'
import {
  OrderStatusSubFilterWrapper,
  OrderSubFilterControls,
  OrdersListContainer,
  WrapperIndicator
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/AllInOne/styles'
// redesign C1a (W1-PC1-07): Adapted 2026-10-08 (W1 tramo C r1). The page no longer draws the legacy Header, HeaderTitleContainer, BusinessName or
// BusinessSelectorWrapper (P/PageHeader replaced them in W1-7; their dead exports and pins are retired) nor the legacy IconButton in its toolbar
// (P/IconButton did); the fixture now draws what the page draws: PageHeader (the opener in `leading`) with the business Button as its action, the
// toolbar on P/IconButton, and the month view's measuring event next to a real one.
import {
  BusinessPicker,
  CalendarHeaderContainer,
  CalendarLabelContainer,
  CalendarWrapper,
  Container,
  EventContainer,
  EventProfessionalPhoto,
  SpinnerLoaderWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Orders/Appointments/styles'
import { Button, IconButton as ProductIconButton, PageHeader } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Product'
import { Calendar as CalendarIcon, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Columns3, Menu as MenuIcon, Store, User as PersonIcon } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Icon'

// Only the batch allowlist is exercised here. The calendar library keeps its
// own class contract, so the fixture reproduces the real `rbc-*` markup instead
// of replacing react-big-calendar with a substitute.
export const AllInOneAppointmentsStylesFixture = () => {
  const [view, setView] = useState('month')
  const [businessOpen, setBusinessOpen] = useState(false)

  return (
    <main data-testid='all-in-one-appointments-styles' style={{ display: 'grid', gap: 24, minWidth: 0 }}>
      <section data-testid='all-in-one-surface' aria-label='All in one fixture' style={{ minWidth: 0 }}>
        <OrdersListContainer data-testid='orders-list-container' style={{ height: 'auto' }}>
          {/* redesign W1-5 (T1-5-4): AllInOne/styles.js no longer exports HeaderTitleContainer (dead since the head is OrdersContentHeader); its fixture is gone. */}
          {/* redesign all-in-one B3: the sub-bar sits in the head of the new board frame (.aio-board > .aio-orders > .aio-orders-head) */}
          <div className='aio-board'>
            <div className='aio-orders'>
              <div className='aio-orders-head'>
                <OrderSubFilterControls data-testid='sub-filter-controls'>
                  <OrderStatusSubFilterWrapper data-testid='sub-filter-wrapper'>
                    <span>Pending</span>
                  </OrderStatusSubFilterWrapper>
                </OrderSubFilterControls>
              </div>
            </div>
          </div>
        </OrdersListContainer>
        <WrapperIndicator data-testid='selection-indicator' role='status' aria-live='polite' style={{ position: 'static' }}>3/10</WrapperIndicator>
      </section>

      <section data-testid='appointments-surface' aria-label='Appointments fixture' style={{ minWidth: 0 }}>
        <Container className='odc-root' data-testid='appointments-container' style={{ maxHeight: 'none' }}>
          <SpinnerLoaderWrapper data-testid='appointments-loader' role='status' aria-live='polite' aria-label='Loading' style={{ position: 'static', height: 'auto' }} />
          {/* the page's opener is PageHeader's `leading`, as on /appointments */}
          <PageHeader
            data-testid='appointments-header'
            leading={<ProductIconButton icon={MenuIcon} label='Open menu' />}
            title='Appointment'
            description='Calendar'
            actions={(
              <BusinessPicker data-testid='business-picker'>
                <Button
                  icon={Store}
                  iconEnd={ChevronDown}
                  aria-haspopup='true'
                  aria-expanded={businessOpen}
                  title='Ordering.co demonstration store'
                  onClick={() => setBusinessOpen(value => !value)}
                >
                  <span className='business-name'>Ordering.co demonstration store</span>
                </Button>
              </BusinessPicker>
            )}
          />

          <CalendarWrapper data-testid='calendar-wrapper'>
            <CalendarHeaderContainer data-testid='calendar-toolbar'>
              <CalendarLabelContainer>
                <ProductIconButton icon={ChevronLeft} flipInRtl label='Previous' />
                <span className='label' data-testid='calendar-label' aria-live='polite'>September 2026</span>
                <ProductIconButton icon={ChevronRight} flipInRtl label='Next' />
              </CalendarLabelContainer>
              <div data-testid='calendar-views' style={{ display: 'flex', alignItems: 'center', gap: 'var(--od-space-3)' }}>
                {[['month', 'Month', CalendarDays], ['week', 'Week', Columns3], ['day', 'Day', CalendarIcon]].map(([name, label, icon]) => (
                  <ProductIconButton
                    key={name}
                    icon={icon}
                    label={label}
                    aria-pressed={view === name}
                    onClick={() => setView(name)}
                  />
                ))}
              </div>
            </CalendarHeaderContainer>
            <div className='rbc-calendar'>
              <div className='rbc-header'><span data-testid='calendar-day-heading'>Monday</span></div>
              {/* redesign C1a (W1-QC1-01): rbc counts the events that fit by measuring a dummy event (a bare &nbsp;) and then draws the
                  real ones; both must measure the same, so «+N more» stays inside its row */}
              <div className='rbc-month-view' data-testid='month-view'>
                <div className='rbc-month-row'>
                  <div className='rbc-row-content'>
                    <div className='rbc-row'>
                      <div className='rbc-row-segment'>
                        <div className='rbc-event' data-testid='month-event-measure'><div className='rbc-event-content'>&nbsp;</div></div>
                      </div>
                    </div>
                    <div className='rbc-row'>
                      <div className='rbc-row-segment'>
                        <div className='rbc-event' data-testid='month-event'>
                          <div className='rbc-event-content'>
                            <EventContainer role='button' tabIndex={0} aria-label='Grace Hopper, 09:00 - 09:30' data-testid='month-event-button'>
                              <EventProfessionalPhoto aria-hidden='true'><PersonIcon aria-hidden='true' /></EventProfessionalPhoto>
                              <div className='info'>
                                <p className='name'><bdi>Grace Hopper</bdi></p>
                                <p className='date'><bdi dir='ltr'>09:00</bdi> - <bdi dir='ltr'>09:30</bdi></p>
                              </div>
                            </EventContainer>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className='rbc-time-view'>
                <div className='rbc-time-content'>
                  <div className='rbc-time-gutter'><span className='rbc-label' data-testid='gutter-label'>09:00 AM</span></div>
                  <div className='rbc-timeslot-group'>
                    <div className='rbc-event' data-testid='calendar-event' tabIndex={0}>
                      <EventContainer>
                        <EventProfessionalPhoto aria-hidden='true'>
                          <svg viewBox='0 0 16 16' width='16' height='16'><circle cx='8' cy='6' r='3' /></svg>
                        </EventProfessionalPhoto>
                        <div className='info'>
                          <p className='name' data-testid='event-name'><bdi>Grace Hopper</bdi></p>
                          <p className='date' data-testid='event-time'><bdi dir='ltr'>09:00</bdi> - <bdi dir='ltr'>09:30</bdi></p>
                        </div>
                      </EventContainer>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CalendarWrapper>

        </Container>
      </section>
    </main>
  )
}
