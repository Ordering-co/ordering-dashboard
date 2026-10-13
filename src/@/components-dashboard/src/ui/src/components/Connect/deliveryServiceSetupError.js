/**
 * @param {'plugin_not_installed'|'driver_group_missing'|'driver_group_load_failed'} scenario
 */
export const getDeliveryServiceSetupError = (deliveryCompany, scenario, t) => {
  const serviceName = deliveryCompany?.name || t('DELIVERY_SERVICE', 'Delivery service')

  if (scenario === 'plugin_not_installed') {
    return t(
      'CONNECT_DELIVERY_PLUGIN_NOT_INSTALLED',
      'The _name_ plugin is not installed. Use Install to add it before opening configuration.'
    ).replace('_name_', serviceName)
  }

  if (scenario === 'driver_group_missing') {
    return t(
      'CONNECT_DELIVERY_DRIVER_GROUP_MISSING',
      '_name_ is installed, but no driver delivery group is linked to this delivery company. Link a driver group to this delivery company in Ordering admin or contact support to finish setup.'
    ).replace('_name_', serviceName)
  }

  if (scenario === 'driver_group_load_failed') {
    const groupId = deliveryCompany?.driver_groups?.[0]?.id
    return t(
      'CONNECT_DELIVERY_DRIVER_GROUP_LOAD_FAILED',
      'Could not load driver delivery group (ID: _id_) for _name_. The group may have been deleted or you may lack permission. Verify the driver group configuration and try again.'
    )
      .replace('_id_', groupId != null ? String(groupId) : '—')
      .replace('_name_', serviceName)
  }

  return t('DELIVERY_GROUP_NOT_FOUND_OR_INSTALLED', 'Delivery group not found or installed')
}
