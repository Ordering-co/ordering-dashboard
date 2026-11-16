import { createContext, useContext } from 'react'

// redesign deliveries F2 (decision 3): what the dispatch board hands to its cards without going through the shared
// OrdersDashboardList / OrdersListing props. Outside the board (any other list) the context is empty and the card
// shows no «Assign».
//   canAssign(order) → boolean: the same rule as the order panel (OrderContactInformation: no driver company,
//                     not a read-only business owner), plus «the order has no driver».
//   requestAssign(order): selects the order on the board (the map focuses it) and moves the focus to its candidates.
//   driversById: Map of driver id → the driver as the board loaded it (location, last_location_at, busy…).
export const DeliveryBoardContext = createContext({})

export const useDeliveryBoard = () => useContext(DeliveryBoardContext)
