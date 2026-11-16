// redesign BO-B2 (promotion): the pure side of the filter bar moved to Users/UsersFilterBar/userFilters.js, which the business owners
// page shares. The customers list keeps importing it from here; nothing of it changes for customers.
export * from '../UsersFilterBar/userFilters'
