export const publishingItemsValues = (props) => {
  const { t } = props

  const values = [
    {
      key: 'delivery',
      value: 1,
      title: t('QR_CODE_FOR_DELIVERY', 'QR Code for Delivery'),
      enabled: true
    },
    {
      key: 'pick_up',
      value: 2,
      title: t('QR_CODE_FOR_PICKUP', 'QR Code for Pickup'),
      enabled: true
    },
    {
      key: 'eat_in',
      value: 3,
      title: t('QR_CODE_FOR_EATIN', 'QR Code for Eat in'),
      enabled: true
    },
    {
      key: 'curbside',
      value: 4,
      title: t('QR_CODE_FOR_CURBSIDE', 'QR Code for Curbside'),
      enabled: true
    },
    {
      key: 'driver_thru',
      value: 5,
      title: t('QR_CODE_FOR_DRIVE_THRU', 'QR Code for Drive Thru'),
      enabled: true
    }
  ]
  return values.filter((option) => option.enabled)
}
