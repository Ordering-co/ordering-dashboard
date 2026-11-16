// redesign tramo A r5 (W0-QA3-02): the `parseDate` of UtilsContext for the tests that mock `index`: the project's date format
// (`dates_general_format`) or the visible default `DD MMM YYYY`, day part only (dayjs, English names).
import dayjs from 'dayjs'
import { getDateTimeFormats } from '../../../../../../utils/settingsCustomSections'

export const mockParseDate = (configs = {}) => (date, options = {}) => {
  const raw = configs.dates_general_format?.value
  const formats = getDateTimeFormats(typeof raw === 'string' && raw.trim() ? raw : 'DD MMM YYYY HH:mm')
  return dayjs(String(date).slice(0, 10)).format(options.dateOnly ? formats.dateFormat : `${formats.dateFormat} ${formats.timeFormat}`)
}
