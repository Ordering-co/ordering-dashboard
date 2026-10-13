import { useLanguage } from '~components'

export const snoozeUtils = () => {
  const [, t] = useLanguage()

  const dateOptions = ['or', 'until_date']

  const snoozeOptions = [
    {
      value: 'off',
      content: t('SNOOZE_OFF', 'Off')
    },
    {
      value: '1',
      content: t('SNOOZE_ONE_HOUR', '1H')
    },
    {
      value: '2',
      content: t('SNOOZE_TWO_HOUR', '2H')
    },
    {
      value: '4',
      content: t('SNOOZE_FOUR_HOUR', '4H')
    },
    {
      value: '6',
      content: t('SNOOZE_SIX_HOUR', '6H')
    },
    {
      value: '12',
      content: t('SNOOZE_TWELVE_HOUR', '12H')
    },
    {
      value: 'or',
      content: t('SNOOZE_OR', 'or')
    },
    {
      value: 'until_date'
    }
  ]
  return {
    snoozeOptions,
    dateOptions
  }
}
