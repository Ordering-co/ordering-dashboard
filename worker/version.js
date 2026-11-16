const COMMIT_SHA_RE = /^[0-9a-f]{40}$/

/**
 * Build the `/version` payload from the build-time Workers Builds commit SHA.
 * Called by `vite.config.js` during `pnpm build`, which writes it to `dist/version.json`.
 */
export const buildVersionPayload = (env = process.env, now = new Date()) => ({
  commit: COMMIT_SHA_RE.test(env.WORKERS_CI_COMMIT_SHA || '') ? env.WORKERS_CI_COMMIT_SHA : null,
  built_at: now.toISOString().replace(/\.\d{3}Z$/, 'Z')
})

const UNKNOWN = { commit: null, built_at: null }

// GET /version: the dist/version.json of this deploy, never cached; unknown when the build wrote none.
export const serveVersion = async (url, env) => {
  const asset = await env.ASSETS.fetch(new Request(new URL('/version.json', url))).catch(() => null)
  const body = asset?.ok ? await asset.json().catch(() => UNKNOWN) : UNKNOWN
  return new Response(JSON.stringify({ commit: body.commit ?? null, built_at: body.built_at ?? null }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  })
}
