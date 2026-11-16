import React from 'react'

import { AppsController } from '../../../../../index'
import { AppEditor } from '../AppEditor'

// redesign my-products B2 (D1/D4): the editor of an app is `AppEditor` (header, navigation by sections, one section at a
// time kept mounted), in place of `AppLayout` + the Basic / Advanced Settings tabs. This file keeps the wiring: `AppsController` is
// mounted once here and gives `AppEditor` its props; `appId` is the app's code (`base.code`), which the controller uses to find the
// app's site and `AppEditor` to decide which sections the app has. The conditions of each section (the six codes with a theme
// among them) live in AppEditor/sections.js. `AppEditor` is the controller's UIComponent itself (no wrapper that spreads the props
// again: the l6-c3 ruleset pins the one spread of this file).
export const AppUI = (props) => {
  const appProps = {
    ...props,
    appId: props?.app?.base?.code,
    UIComponent: AppEditor
  }
  return <AppsController {...appProps} />
}
