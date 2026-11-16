import React from 'react'

import { useLanguage } from '../../../../../contexts/LanguageContext'
import { Button } from '../../Shared/Product/Button'
import { Check } from '../../Shared/Icon'
import { useFilterValues } from '../../../contexts/FilterValuesContext'
import './delivery-board.css'

// redesign deliveries F2-B3 (decision 2, E2-A): the two dispatch filters of /deliveries as toggle buttons, in the list column. They write
// the filters that already exist, so the chips, «Clear filters» and the filters notice of the shared bar show them with no extra code:
//   «Unassigned» → filterValues.assigned === 1 (Filters › Driver status › Unassigned)
//   «Late»       → filterValues.timeStatus === 'delayed' (the SLA pill's «Delayed»); the same state, so if the pill picks another
//                  value «Late» lets go on its own. It also tells the controller (setTimeStatus), as the pill does.
// They combine. The pressed state is read from filterValues on every render; nothing is kept here.
export const DispatchToggles = ({ filterValues: controllerValues, handleChangeFilterValues, setTimeStatus }) => {
  const [, t] = useLanguage()
  // redesign deliveries R1 fix (Q-01): the shared bar (chips, «Clear filters», notice, SLA pill) reads the FilterValues context, so the
  // toggles read and write it too, and tell the controller, exactly as the bar's own removeFilter does (OrdersFilterBar).
  const [contextValues, { handleFilterValues } = {}] = useFilterValues()
  // without the provider (tests, an embed) the hook hands back an empty object and no writer: then the controller's values rule
  const filterValues = handleFilterValues ? contextValues : controllerValues
  const unassignedPressed = filterValues?.assigned === 1
  const latePressed = filterValues?.timeStatus === 'delayed'

  const write = (patch) => {
    const next = { ...filterValues, ...patch }
    handleFilterValues?.(next)
    handleChangeFilterValues?.(next)
  }

  const toggleUnassigned = () => {
    write({ assigned: unassignedPressed ? null : 1 })
  }

  const toggleLate = () => {
    const timeStatus = latePressed ? null : 'delayed'
    write({ timeStatus })
    setTimeStatus?.(timeStatus)
  }

  return (
    <div className='odb-toggles'>
      <Button
        size='sm'
        className='odb-toggle'
        aria-pressed={unassignedPressed}
        icon={unassignedPressed ? Check : undefined}
        onClick={toggleUnassigned}
      >
        {t('UNASSIGNED', 'Unassigned')}
      </Button>
      <Button
        size='sm'
        className='odb-toggle'
        aria-pressed={latePressed}
        icon={latePressed ? Check : undefined}
        onClick={toggleLate}
      >
        {t('SLA_LATE', 'Late')}
      </Button>
    </div>
  )
}
