// A separate owned port lets tests coexist with a manual review session.
const value = process.env.BRAND_HARNESS_PORT ?? '3017'
if (!/^\d+$/.test(value) || Number(value) < 1024 || Number(value) > 65535) {
  throw new Error('BRAND_HARNESS_PORT must be an integer from 1024 to 65535')
}
exports.harnessPort = Number(value)
exports.harnessOrigin = `http://127.0.0.1:${exports.harnessPort}`
exports.harnessSocketOrigin = `ws://127.0.0.1:${exports.harnessPort}/`
