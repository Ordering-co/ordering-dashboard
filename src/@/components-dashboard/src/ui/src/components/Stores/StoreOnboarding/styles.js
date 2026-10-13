import styled, { createGlobalStyle } from 'styled-components'
import { Button as DashboardButton, Input as DashboardInput } from '../../../styles'
import dashboardTheme from '~/theme.json'

export const PreviewLogo = styled.div`
  width: 88px; height: 88px; margin: 24px 0; display: grid; place-items: center;
  border: 1px solid var(--border); border-radius: 10px; background: var(--page); color: var(--action);
  svg { width: 32px; height: 32px; }
  img { width: 80px; height: 80px; object-fit: contain; }
`

export const Shell = styled.div`
  ${({ theme }) => {
    const c = { ...dashboardTheme.colors, ...theme.colors }
    return `--action:${c.primary};--contrast:${c.primaryContrast};--page:${c.backgroundPage};--text:${c.headingColor};--muted:${c.secundaryContrast};--subtle:${c.secundary};--border:${c.borderColor};--selected:${c.lightPrimary};--danger:${c.danger};--danger-bg:${c.danger100};--success:${c.green};--success-bg:${c.lightGreen};font-family:'${theme.fonts?.primary?.name || dashboardTheme.fonts.primary.name}',sans-serif;`
  }}
  display:flex;height:100vh;height:100dvh;min-height:0;overflow:hidden;background:var(--page);color:var(--text);font-size:14px;line-height:1.5;
  &, * {box-sizing:border-box;} h1,h2,h3,p{margin:0;} h1{font-size:24px;font-weight:600;line-height:1.4;}h1:focus{outline:none;}h2{font-size:16px;font-weight:600;}h3{font-size:14px;font-weight:600;}
  button,input,select{font:inherit;}button,a{min-height:44px;}button:disabled{cursor:default;opacity:.5;} :focus-visible{outline:2px solid var(--action);outline-offset:3px;}
  input,select{min-width:0;width:100%;min-height:44px;border:1px solid var(--border);border-radius:8px;padding:10px 15px;background:var(--page);color:var(--text);}
  input::placeholder{color:var(--muted);} input:disabled{background:var(--subtle);}input[type=checkbox]{width:18px;height:18px;min-height:18px;accent-color:var(--action);flex-shrink:0;}input[aria-invalid=true]{border-color:var(--danger);}
  summary{cursor:pointer;min-height:44px;padding:10px 0;}details[open]>summary{margin-bottom:12px;}ol{padding-inline-start:22px;margin:0;}li+li{margin-top:12px;}fieldset{border:0;padding:0;margin:0;min-width:0;}@media(max-width:760px){flex-direction:column;h1{font-size:20px;}}
`
export const Input = styled(DashboardInput)`width:100%;min-height:44px;`
export const Aside = styled.aside`
  width:248px;flex-shrink:0;overflow:auto;border-inline-end:1px solid var(--border);background:var(--subtle);padding:32px 22px;display:flex;flex-direction:column;gap:28px;
  img{width:154px;height:40px;object-fit:contain;object-position:left;}nav ol{list-style:none;padding:0;margin:12px 0 0;display:grid;gap:8px;}nav li{display:flex;align-items:center;gap:12px;padding:12px;border-radius:8px;color:var(--muted);}nav li[aria-current=step]{background:var(--selected);color:var(--action);}nav li span{border:1px solid var(--border);border-radius:50%;width:24px;height:24px;display:grid;place-items:center;flex-shrink:0;font-size:12px;}nav li[aria-current=step] span{border-color:var(--action);background:var(--action);color:var(--contrast);}>p:last-child{margin-top:auto;color:var(--muted);font-size:12px;}
  @media(max-width:760px){width:100%;padding:16px 20px;border-inline-end:0;border-bottom:1px solid var(--border);gap:12px;nav ol{display:flex;gap:6px;margin:0;}nav li{padding:4px;background:transparent!important;}nav li b{display:none;}nav>small,>p:last-child,.project{display:none;}img{width:130px;height:30px;}}
`
export const Main = styled.main`flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;`
export const Header = styled.header`flex-shrink:0;border-bottom:1px solid var(--border);padding:18px 40px;min-height:64px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;color:var(--muted);@media(max-width:760px){padding:10px 20px;padding-left:88px;font-size:12px;}`
export const Content = styled.div`width:100%;max-width:940px;margin:0 auto;padding:32px 32px 28px;flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable;overscroll-behavior:contain;>p{color:var(--muted);margin-top:12px;}@media(max-width:760px){padding:28px 20px 32px;}`
export const Reassurance = styled.p`display:flex;align-items:center;gap:8px;font-size:13px;margin:14px 0 28px!important;color:var(--muted);`
export const Grid = styled.div`display:grid;grid-template-columns:${p => p.$equal ? 'repeat(2,minmax(0,1fr))' : 'minmax(0,1.6fr) minmax(200px,1fr)'};gap:24px;@media(max-width:980px){grid-template-columns:1fr;}`
export const Card = styled.section`>h2{margin-bottom:${p => p.$spacedTitle ? '20px' : '0'};}padding:24px;border:1px solid var(--border);border-radius:8px;background:${p => p.$muted ? 'var(--subtle)' : 'var(--page)'};min-width:0;>p{margin-top:12px;color:var(--muted);}&.menu-choice{display:flex;flex-direction:column;align-items:flex-start;gap:16px;>p{margin:0;flex:1;}button{margin-top:8px;}}@media(max-width:760px){padding:18px;}`
export const Fields = styled.div`display:grid;gap:24px;`
export const Field = styled.label`display:grid;gap:8px;font-weight:400;margin:0;small{font-weight:400;color:var(--muted);}`
export const Row = styled.div`display:flex;gap:12px;align-items:center;flex-wrap:wrap;>*{flex:1;min-width:100px;}`
export const Button = styled(DashboardButton).attrs(p => ({ color: 'primary', outline: !p.$primary, borderRadius: '8px' }))`display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:6px 18px;min-height:44px;line-height:24px;white-space:normal;overflow:visible;`
export const TextButton = styled(Button).attrs({ bgtransparent: true })`border:0;color:var(--action);padding:8px;&:hover:not(:disabled){color:var(--action);background:var(--selected)!important;}`
export const Footer = styled.footer`flex-shrink:0;background:var(--page);border-top:1px solid var(--border);padding:18px 40px;display:flex;justify-content:space-between;align-items:center;gap:14px;z-index:2;>button{min-width:0;}@media(max-width:760px){padding:14px 20px;}`
export const Choice = styled.label`display:flex;align-items:center;gap:14px;padding:18px;border:1px solid ${p => p.$checked ? 'var(--action)' : 'var(--border)'};border-radius:8px;background:${p => p.$checked ? 'var(--selected)' : 'var(--page)'};cursor:pointer;min-height:64px;margin:0;`
export const ErrorBox = styled.div`border:1px solid var(--danger);background:var(--danger-bg);color:var(--text);border-radius:8px;padding:14px;margin:20px 0;`
export const MapCanvas = styled.div`height:260px;width:100%;background:var(--subtle);border:1px solid var(--border);border-radius:8px;margin:12px 0;`
export const Success = styled.div`text-align:center;max-width:600px;margin:24px auto;.check{display:grid;place-items:center;background:var(--success-bg);color:var(--success);border-radius:50%;font-size:36px;width:72px;height:72px;margin:0 auto 24px;}h1{margin-bottom:16px;}p{color:var(--muted);margin-bottom:24px;}a{display:inline-flex;align-items:center;justify-content:center;background:var(--action);color:var(--contrast);border-radius:8px;padding:12px 24px;text-decoration:none;margin-bottom:20px;}a.secondary-link{background:transparent;color:var(--action);padding:0;text-decoration:underline;}`
export const ScheduleFrame = styled.fieldset`
  >div{min-width:0;} .day-title{min-width:0!important;min-height:44px;cursor:pointer;}.day-selector{gap:12px;flex-wrap:wrap;}.day-selector .days{min-width:0;}.day-selector .days>div{flex-wrap:wrap;gap:4px;}.select{border-radius:8px;min-height:44px;}.icons{margin:0!important;}svg[data-onboarding-action]{box-sizing:border-box;width:44px;height:44px;padding:12px;flex-shrink:0;}.icons>div>div[data-onboarding-action]{min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;} &[aria-disabled=true]{pointer-events:none;}
  @media(min-width:920px){>div>div{flex-direction:row;align-items:center;gap:16px;}.day-title{flex:0 0 110px;padding:0!important;}.day-selector{flex:1;padding:0!important;}}
  [data-onboarding-hidden=true]{display:none!important;}
  .list .option{min-height:44px;}
  .list[data-onboarding-popover]{position:fixed!important;transform:none!important;top:var(--onboarding-popover-top)!important;left:var(--onboarding-popover-left)!important;bottom:auto!important;max-height:var(--onboarding-popover-height)!important;width:var(--onboarding-popover-width)!important;overflow-y:auto!important;}
  @media(max-width:430px){
    >div>div{position:relative;}
    && .day-title{width:calc(100% - 100px);}
    && .day-selector{align-items:flex-start;}
    && .day-selector .icons{position:absolute;top:12px;inset-inline-end:0;}
    && .day-selector .days{width:100%;}
    && .day-selector .days>div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));justify-content:start;width:100%;gap:8px;}
    && .day-selector .days>div>div{width:auto;min-width:0;margin:0;}
    && .day-selector .days>div>div:nth-child(3){display:none;}
    && .day-selector .days>div>div:nth-child(6){grid-column:1/-1;justify-content:flex-end;}
  }

`

export const BusinessAddressFrame = styled.fieldset`
  border:0;padding:0;margin:0;min-width:0;
  >div>div{margin-top:0;}
  #map{width:100%!important;height:100%!important;}
`

export const ZoneMapFrame = styled.div`
  height:360px;width:100%;position:relative;margin:16px 0;border:1px solid var(--border);border-radius:8px;overflow:hidden;
  #map{width:100%!important;height:100%!important;}
  .gm-style button,.gm-style a{min-height:0;}
  &[aria-disabled=true]{pointer-events:none;}
`

export const PaymentHint = styled.p`font-size:12px;line-height:1.5;margin-top:12px;color:var(--muted);`

export const MenuItem = styled.div`display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap;>img{width:56px;height:56px;border-radius:8px;object-fit:cover;} >div{flex:1;min-width:100px;overflow-wrap:anywhere;}p{color:var(--muted);}&.product-row{border-top:1px solid var(--border);padding-top:12px;margin-bottom:0;margin-top:12px;}`
export const MenuFormFrame = styled.fieldset`min-width:0;border:0;padding:0;margin:20px 0;>div:first-child{padding:0;}input,textarea{max-width:100%;}textarea{font:inherit;}`

export const MenuToolbar = styled.div`display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;`
export const MenuCategoryHeader = styled.div`display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;>div:first-child{flex:1;min-width:160px;margin-bottom:0;}`
export const MenuActions = styled.div`display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex-shrink:0;@media(max-width:430px){flex-shrink:1;}`
export const MenuOptionButton = styled(TextButton)`justify-self:start;`

export const WebsiteColorRow = styled.div`display:flex;align-items:center;gap:12px;min-width:0;input[type=color]{width:56px;flex:0 0 56px;padding:4px;}input:last-child{min-width:0;flex:1;}`
export const WebsitePreviewFrame = styled.div`color:${p => p.theme.colors.headingColor};background:${p => p.theme.colors.backgroundPage};font-size:14px;line-height:1.5;button:focus-visible{outline:2px solid ${p => p.theme.colors.primary};outline-offset:3px;}.preview-note{color:${p => p.theme.colors.secundaryContrast};font-size:12px;}.preview-devices{display:flex;gap:8px;margin:16px 0;button{min-height:44px;display:flex;align-items:center;gap:8px;}}h3{font-size:18px;margin:0 0 12px;}p{overflow-wrap:anywhere;}`

export const WebsitePreviewHeader = styled.div`display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;h2{font-size:20px;margin:0;}button{min-height:44px;}@media(max-width:430px){h2{font-size:18px;}}`

export const OnboardingSupportOffset = createGlobalStyle`
  ${p => p.$hide ? '.intercom-lightweight-app-launcher,iframe.intercom-launcher-frame{visibility:hidden!important;pointer-events:none!important;}' : ''}
  @media(max-width:760px){
    .intercom-lightweight-app-launcher, iframe.intercom-launcher-frame { top:${p => p.$top}px!important;bottom:auto!important; }
  }
`
