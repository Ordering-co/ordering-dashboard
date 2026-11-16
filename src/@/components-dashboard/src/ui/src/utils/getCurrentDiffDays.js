import moment from 'moment'

export const getCurrentDiffDays = (time) => {
  const current = moment().utc()
  const compared = moment(time)
  return compared.diff(current, 'days')
}
