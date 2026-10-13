import { useLanguage } from '../../../../../index'

export const getOptions = () => {
  const [, t] = useLanguage()
  const options = [
    {
      name: t('DELIVERY_SERVICES', 'Delivery Services'),
      description: t('DELIVERY_SERVICES_DESCRIPTION', 'These are platforms that facilitate the management and coordination of deliveries, connecting businesses with customers in the most efficient way. In this section, you can easily connect different delivery services, optimizing your operations and ensuring that your products arrive on time and in perfect condition.'),
      video: 'https://www.youtube.com/watch?v=Cvn23AOdP_M',
      enabled: true
    },
    {
      name: t('SALES_CHANNELS_ORDERS_CONSOLIDATION', 'Sales Channels & Orders Consolidation'),
      description: t('SALES_CHANNELS_ORDERS_CONSOLIDATION_DESCRIPTION', 'In this section, you can integrate multiple sales platforms like marketplaces, social media, and your own website to reach more customers. Plus, easily merge and manage orders from different stores or locations, streamlining both your sales process and delivery or pickup logistics for a smoother experience.'),
      video: '',
      enabled: true
    },
    {
      name: t('POS_MENU_SYNC', 'POS & Menu Sync'),
      description: t('POS_MENU_SYNC_DESCRIPTION', 'This feature allows you to merge multiple customer orders into a single, efficient delivery or pickup process. In this section, you can easily manage and group orders from different stores or locations, optimizing logistics and ensuring a seamless experience for both your business and your customers.'),
      video: '',
      enabled: true
    }
  ]
  return options.filter(option => option.enabled)
}
