// The Ordering.co sales page: where a link built on the project's subdomain goes when the project has none.
// used it for «Contact us» in Ordering products; tanda O for every `www.<subdomain>.com` link,
// which main opened as www.undefined.com.
export const ORDERING_SALES_URL = 'https://www.ordering.co/platform-demo-and-pricing'

const present = (value) => (typeof value === 'string' ? value.trim() : '')

// `https://www.<subdomain>.com<path>` when the project has a subdomain, the sales page otherwise
export const subdomainUrl = (subdomain, path = '') => {
  const name = present(subdomain)
  return name ? `https://www.${name}.com${path}` : ORDERING_SALES_URL
}
