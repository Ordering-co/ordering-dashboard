// redesign UC-B2 (decisions 5, 7): what the customers table, its cards and the dialogs read out of a user.
// No React, no network: plain functions over the user the list controller already gives (`wallets`, `orders_count`, …).

import { phoneOf, userFullName } from '../../../../../utils/userContact'

// redesign BO-B2 (a): the name and phone readers moved to `C/utils/userContact` (the business owners list shares them);
// the customers keep their import path and their «No name» fallback here.
export { phoneOf }

// «Name Lastname»; with both empty, the translated «No name» (a row never paints an empty title)
export const customerName = (user, t) => userFullName(user) || t('CUSTOMERS_NO_NAME', 'No name')

// `type` is 'cash' or 'credit_point'; the wallet object, or null
export const walletOf = (user, type) => (Array.isArray(user?.wallets) ? user.wallets.find(wallet => wallet?.type === type) : null) ?? null

// main (): the cash and points wallets stay on in every project, whatever its add-ons, as CustomerDetails
// does (`enabled: true`; docs/SETTINGS.md › Addon sections are universal). The callers keep passing `configs`.
export const isCashWalletOn = () => true
export const isPointsWalletOn = () => true
