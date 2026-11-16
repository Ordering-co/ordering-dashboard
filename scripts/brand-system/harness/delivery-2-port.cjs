// Pins this batch's harness port before runtime.cjs reads the environment, so
// the Delivery-2 harness can never fall back to the shared 3017 preview port.
process.env.BRAND_HARNESS_PORT ??= '3032'
