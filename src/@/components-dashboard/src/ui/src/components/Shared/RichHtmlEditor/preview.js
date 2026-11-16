// The storefront injects these fields with innerHTML, so the preview is a document of its own: a sandboxed iframe with no scripts.
// The base target makes link clicks do nothing instead of navigating the frame.
const BASE_STYLE = `body { margin: 16px; font: 14px/1.5 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #212529; background: #fff; }
img, iframe, video { max-width: 100%; }`

export const previewDocument = (html) => `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base target="_blank">
<style>${BASE_STYLE}</style>
</head>
<body>
${html ?? ''}
</body>
</html>`
