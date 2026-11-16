import React from 'react'

import { OrderingWidgets } from '../../OrderingWidgets'

// redesign ordering-website B4 (D1): Integrations › Widgets. The same content as the Widgets tab of the legacy editor
// (the popup, chat and inline snippets with the website's URL), without the title row that component paints for its own route
// (`/ordering-widgets`): the frame of the editor draws the h2 and there is one h1 on the page.
export const WidgetsSection = () => <OrderingWidgets hideSideBar hideTitle />
