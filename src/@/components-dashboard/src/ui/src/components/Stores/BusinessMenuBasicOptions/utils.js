export const orderTypesValues = (props) => {
  const { t } = props
  const orderTypes = [
    { value: 1, key: 'delivery', content: t('DELIVERY', 'Delivery'), enabled: true },
    { value: 2, key: 'pickup', content: t('PICKUP', 'Pickup'), enabled: true },
    { value: 3, key: 'eatin', content: t('EAT_IN', 'Eat in'), enabled: true },
    { value: 4, key: 'curbside', content: t('CURBSIDE', 'Curbside'), enabled: true },
    { value: 5, key: 'driver_thru', content: t('DRIVE_THRU', 'Drive thru'), enabled: true },
    { value: 7, key: 'catering_delivery', content: t('CATERING_DELIVERY', 'Catering delivery'), enabled: true },
    { value: 8, key: 'catering_pickup', content: t('CATERING_PICKUP', 'Catering pickup'), enabled: true },
    { value: 9, key: 'reservation', content: t('RESERVATION', 'reservation'), enabled: true }
  ]
  return orderTypes.filter((type) => (type.enabled))
}
