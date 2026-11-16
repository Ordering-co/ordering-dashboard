import moment from 'moment'

// (tanda Y): one set of cases for the delivery cards (OrdersCards) and the orders table (OrdersTable), so both decide «On time»
// the same way (on the cards, tanda Y on the table) and a closed order shows no count-down timer (X-R6). Each test file renders
// its own component with these orders and checks these expectations.
const stamp = minutes => moment().add(minutes, 'minutes').format('YYYY-MM-DD HH:mm:ss')

export const slaParityCases = () => [
  { name: 'open, ETA passed', status: 7, minutes: -30, onTime: false, timer: true },
  { name: 'open, ETA ahead', status: 7, minutes: 30, onTime: true, timer: true },
  { name: 'done, ETA passed', status: 11, minutes: -30, onTime: true, timer: false },
  { name: 'cancelled, ETA passed', status: 2, minutes: -30, onTime: true, timer: false }
].map((item, index) => ({
  ...item,
  order: {
    id: 970001 + index,
    status: item.status,
    delivery_type: 1,
    time_status: 'in_time',
    eta_time: 0,
    delivery_datetime: stamp(item.minutes),
    delivery_datetime_utc: stamp(item.minutes)
  }
}))
