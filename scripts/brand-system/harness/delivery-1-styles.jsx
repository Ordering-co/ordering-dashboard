import React, { useState } from 'react'

import {
  CheckboxWrapper,
  DriverGroupItem,
  DriverGroupListContainer
} from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/DriverGroupSetting/styles'
import {
  DateTimeWrapper,
  EventTypeContainer,
  NoData,
  Table as LogsTable,
  TableWrapper as LogsTableWrapper
} from '../../../src/@/components-dashboard/src/ui/src/components/Delivery/DriversAdvancedLogs/styles'

export const Delivery1StylesFixture = () => {
  const [groupSelected, setGroupSelected] = useState(true)

  return (
    <main data-testid='delivery-1-styles' style={{ display: 'grid', gap: 24, maxWidth: 760, minWidth: 0, padding: 24 }}>
      <section data-testid='groups-family' aria-label='Driver groups'>
        <DriverGroupListContainer>
          <DriverGroupItem type='button' aria-pressed={groupSelected} onClick={() => setGroupSelected(value => !value)}>
            <CheckboxWrapper aria-hidden='true'>✓</CheckboxWrapper><span>Weekend delivery group</span>
          </DriverGroupItem>
        </DriverGroupListContainer>
      </section>

      <section data-testid='logs-family' aria-label='Advanced logs'>
        <LogsTableWrapper data-testid='logs-table-scroll'>
          <LogsTable aria-label='Advanced logs'>
            <thead><tr><th>Event type</th><th>Details</th><th>Date</th></tr></thead>
            <tbody><tr><th scope='row'><EventTypeContainer>driver_update</EventTypeContainer></th><td data-testid='log-content'>Availability changed from offline to online</td><td><DateTimeWrapper data-testid='log-time'>2026-09-15 15:30:42</DateTimeWrapper></td></tr></tbody>
          </LogsTable>
        </LogsTableWrapper>
        <NoData data-testid='logs-empty'>No additional logs</NoData>
      </section>
    </main>
  )
}
