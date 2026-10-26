# Plugin pages

How the dashboard opens a plugin's own pages (its setup and its `links`) and
how those pages talk back. This is the contract a plugin follows; the code is
in `src/@/components-dashboard/src/utils/pluginPages.js` and
`ui/src/hooks/usePluginPage.js` (opening a page), and
`src/@/components-dashboard/src/utils/pluginMessages.js` and
`ui/src/hooks/usePluginMessages.js` (the messages back).

## Which pages and where

A plugin declares its pages in its `config.json`:

- `setup_url`: the connection setup of a store (Connect → Setup, Reconnect,
  Continue setup). When it is missing, `links.setup` is used.
- `links`: its other pages (for example `general_settings`), opened from the
  integration detail.

A relative path is joined to the plugin `root`. The dashboard opens the page in
an iframe inside a modal, from the store panel, the integration detail, the
store's row in the list and Settings → Plugins; Delivery Services opens the
setup in a new tab.

## Placeholders

The URL may carry these placeholders; the dashboard replaces them before
opening it:

| Placeholder | Value |
|---|---|
| `@{project_code}` | The project's code |
| `@{business_id}` | The store the page is for |
| `@{language_code}` | The dashboard's language |
| `@{access_token}` | The session token of the user who opened the page |
| `@{dashboard_origin}` | The dashboard's origin, URL-encoded: where to send the messages below |

Example: `"setup_url": "/views/setup?project=@{project_code}&business_id=@{business_id}&origin=@{dashboard_origin}"`.

`@{access_token}` travels in the URL: it ends up in the plugin's server logs
and in its pages' `Referer`. Use it only to call the API from your server, and
never load third-party resources on a page that receives it.

## Opening pages without the token (launch)

`@{access_token}` puts the user's session in the page URL. A plugin that
declares `links.launch` gets its pages opened without it: the dashboard asks
the plugin for a one-time URL first.

```json
{
  "name": "Clover Integration",
  "key": "clover_integration",
  "version": "2.0.0",
  "after_install_hook": "/pluginhooks/after_install.php",
  "models": [
    { "model_name": "ThirdPartyIntegration", "key": "clover_integration", "name": "Clover", "type": "pos", "logo": "/assets/clover-logo.png" }
  ],
  "setup_url": "/views/setup?project_code=@{project_code}&token=@{access_token}&business_id=@{business_id}",
  "links": {
    "launch": "/@{project_code}/api/pages/launch",
    "connection_status": "/@{project_code}/api/business/@{business_id}/connection",
    "general_settings": "/views/settings?project_code=@{project_code}"
  }
}
```

- `setup_url` stays the setup **page**: the fallback for clients that do not
  know `links.launch`. It keeps `token=@{access_token}` until the dashboard
  that uses the launch is in production; then the plugin removes it.
- `links.launch`: one endpoint for every page of the plugin.

  ```http
  POST {root}/{project_code}/api/pages/launch
  Authorization: Bearer <user session>
  Content-Type: application/json

  {"page": "setup", "business_id": 61, "dashboard_origin": "https://dashboard.example.com"}
  ```

  `page` is `setup` or the key of a link. `business_id` is null outside a store
  (Settings → Plugins, Delivery Services); a delivery service also sends
  `driver_company_id`. `dashboard_origin` is not encoded here. The launch URL
  takes the same placeholders as a page. The plugin answers
  `{"error": false, "result": {"url": "/views/setup?…&code=…"}}`, a URL
  relative to its root or absolute, with a single-use, short-lived code; the
  page redeems it and cleans its URL. The dashboard loads that URL as it is:
  its placeholders are not filled, and the messages of the page are taken from
  its origin.
- `links.connection_status`: the live state of a store's connection (GET with
  the same header). Optional, for later.
- Any other key in `links` is a page of the plugin (a button). When
  `links.launch` exists, it opens through the launch.
- Reserved keys, never shown as buttons: `launch`, `connection_status`,
  `setup`.
- After changing `config.json`, refresh or reinstall the plugin in Ordering:
  the API stores `setup_url` and `links` when it installs it. New top-level
  fields would be dropped, which is why the launch lives in `links`.

Why `setup_url` itself is not the launch: in every plugin today it is a page,
and old dashboards and Delivery Services open it as one (in the iframe or a new
tab). The dashboard could not tell one kind from the other, and those clients
would break as soon as a plugin switched.

Dashboard side: one function, `openPluginPage(plugin, page, { businessId,
driverCompanyId })` from `usePluginPage()`, used by Connect (row, store panel,
integration detail), Settings → Plugins and Delivery Services. With
`links.launch` it posts and opens the returned URL; when the plugin answers an
error (its first `result` message is shown), an answer without a URL, or
nothing within 8 seconds, it shows a toast instead of an empty modal. Without
`links.launch` it opens the page as before, with the placeholders filled in.
Delivery Services opens the new tab on the click, before the plugin answers, so
the browser does not block it, and closes it if the launch fails. The
sales-call check (`isSalesCallRestricted`) does not change: `setup_url` is
still the page.

Out of scope: the token in the AI Agents link (`aiAgentsUrl`) and the billing
link (`?token=`), which are other systems.

## Reporting the result

The plugin reports the outcome of a store's setup to the API, not to the
dashboard:

```
POST /{version}/{lang}/{project}/business/{business_id}/third_party_integrations/{key}
{ "setup_status": "success" | "failed" | "pending", "setup_message": "…", "external_id": "…" }
```

That state is what the dashboard shows (the badge, Reconnect / Continue setup).

## Telling the dashboard (postMessage)

Once the result is reported, the page tells the dashboard window that opened
it:

```js
// origin: the value of @{dashboard_origin}, decoded.
const dashboardOrigin = new URLSearchParams(location.search).get('origin')

window.parent.postMessage({
  type: 'ordering:plugin',
  event: 'setup_finished',
  status: 'success',            // or 'failed'
  message: 'Clover connected.', // optional, shown to the user on failure
  business_id: 42,              // optional; a message about another store is ignored
  close: true                   // optional; close the window too
}, dashboardOrigin)
```

Events:

| `event` | What the dashboard does |
|---|---|
| `setup_finished` with `status: 'success'` | Reads the store again and says it connected |
| `setup_finished` with `status: 'failed'` | Reads the store again and shows `message`, or a generic error |
| `close` | Closes the modal, like its X, and reads the store again |
| `resize` with `height` (px) and optional `size` | Fits the modal to the page: the iframe takes that height, at least 160 px and at most 80% of the viewport (the page scrolls inside beyond it); `size` (`small`, `medium` or `large`) sets the width, once. Nothing else happens |

### How the modal opens and sizes

Every plugin modal opens at once with "Loading {plugin}…" while the launch (if
any) and the page load, and the page fades in when it has loaded. Its width is
decided before it opens and does not move:

| Plugin | Opens at | Height |
|---|---|---|
| With `links.launch` | `small` (640 px) | The last height its page reported (per plugin and page, in this browser), or 320 px; then what the page reports. With no `resize` within 1.5 s of loading, the maximum |
| Without it | `large` (80% of the viewport) | 80% of the viewport, as always; what the page reports if it sends `resize` |

Only the height animates, and the modal stays anchored near the top so it grows
downward. A page that needs another width says so in its first `resize`
(`size: 'small' | 'medium' | 'large'`, 640 px / 900 px / 80% of the viewport):
the width changes once, ideally before the page fades in; an unknown `size` is
ignored.

`resize` is optional. Send the height of the content itself (not of the
document, which is at least the iframe's height) when the page loads and
whenever what it shows changes:

```js
const report = () => window.parent.postMessage({
  type: 'ordering:plugin',
  event: 'resize',
  height: Math.ceil(document.querySelector('#content').getBoundingClientRect().height)
}, dashboardOrigin)
new ResizeObserver(report).observe(document.querySelector('#content'))
```

The window stays open after `setup_finished` unless the message also carries
`close: true`: the page decides whether it still has something to show (a
summary, its own error with a retry). A page that finishes and has nothing
else to say sends `setup_finished` with `close: true`.

The dashboard only accepts a message from the iframe it opened, from the
origin of the URL it loaded, with `type: 'ordering:plugin'`. `status` only
chooses the notice: the store's state is always read again from the API, so a
message cannot mark anything connected.

### When the setup continues in a popup

A provider that refuses to be framed (most OAuth screens) can be opened in a
popup from the plugin page. The popup is not the dashboard's window: it tells
the plugin page (`window.opener.postMessage(…)` to the plugin's own origin),
and the plugin page sends the message above to the dashboard.

## Without messages

A page that sends nothing keeps working: when the user closes the modal, the
dashboard reads the store again and shows whatever the plugin reported to the
API.
