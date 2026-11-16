import React from 'react'
import { FacebookProfile } from './FacebookProfile'

// redesign stores 5.15b (; G5-04, G5-10, G5-11, G5-13): the Facebook guide, drawn inside BusinessSalesChannel's
// P/SectionSplit (which owns its title, X and «‹ Back»). Only the page button guide: the «Post» tab was already commented out in
// main and stays out (decision 8: FacebookPost.js and the styles.js only it read were deleted as dead code, ).
export const BusinessSalesFacebook = ({ link }) => (
  <div className='odc-sales-guide'>
    <FacebookProfile link={link} />
  </div>
)
