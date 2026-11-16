// redesign SL-F3 (C): every text of the Product ScheduleEditor, from keys that already exist (the new ones: SCHEDULE_ADD_HOURS, SCHEDULE_COPY_HOURS_TO).
// redesign DL-B3 (decision 6 | M-DL4): promoted out of Stores/BusinessSchedule, unchanged, so the driver panel's Schedule says the same words.
export const getScheduleLabels = (t) => ({
  days: [t('SUNDAY', 'Sunday'), t('MONDAY', 'Monday'), t('TUESDAY', 'Tuesday'), t('WEDNESDAY', 'Wednesday'), t('THURSDAY', 'Thursday'), t('FRIDAY', 'Friday'), t('SATURDAY', 'Saturday')],
  copyDays: [t('DAY7', 'Sunday'), t('DAY1', 'Monday'), t('DAY2', 'Tuesday'), t('DAY3', 'Wednesday'), t('DAY4', 'Thursday'), t('DAY5', 'Friday'), t('DAY6', 'Saturday')],
  schedule: t('SCHEDULE', 'Schedule'),
  open: t('OPEN', 'Open'),
  close: t('CLOSE', 'Close'),
  hour: t('HOUR', 'Hour'),
  minute: t('MINUTE', 'Minute'),
  am: t('AM', 'AM'),
  pm: t('PM', 'PM'),
  unavailable: t('UNAVAILABLE', 'Unavailable'),
  addHours: t('SCHEDULE_ADD_HOURS', 'Add hours'),
  copyHours: t('SCHEDULE_COPY_HOURS_TO', 'Copy hours to…'),
  copyTitle: t('COPY_TIMES_TO', 'Copy times to'),
  apply: t('APPLY', 'Apply'),
  cancel: t('CANCEL', 'Cancel'),
  delete: t('DELETE', 'Delete'),
  deleteQuestion: t('QUESTION_DELETE_ITEM', 'Are you sure to delete this _item_?').replace('_item_', t('SCHEDULE', 'Schedule')),
  accept: t('ACCEPT', 'Accept'),
  conflict: t('SCHEDULE_CONFLICT', 'There is an schedule conflict'),
  endTimeLater: t('END_TIME_LATER', 'Choose an end time later than the start time.')
})
