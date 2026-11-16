export const getOrderingSubdomains = () => {
  const orderingSubdomains = ['tryordering.com', 'ordering.co', 'orderingplus.com']
  return orderingSubdomains.some(subdomain => window.location.hostname.includes(subdomain))
}
