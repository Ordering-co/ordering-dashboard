import { createContext, useContext } from 'react'

// redesign settings S0: the Settings hub opts its forms into the Product rendering (fields, save bar,
// discard guard) through this context. Outside the hub the value is null and every consumer of SettingsList,
// EmailSetting, NotificationSetting and SettingsCustomBlocks renders exactly as before (Stores, Connect, Campaigns,
// My Products, SettingsDetail).
//
// Value given by the hub:
//   product: true
//   report(sectionKey, state): a form inside the hub tells the hub its state; `state` is
//     { dirty: boolean, saving: boolean } or null when it unmounts. The hub blocks leaving the section while any
//     reported form is dirty or saving (owner decision 17).
export const SettingsHubFormContext = createContext(null)

export const useSettingsHubForm = () => useContext(SettingsHubFormContext)
