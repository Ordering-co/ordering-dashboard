// Controlled representative of the producer's tilde-fenced guide format.
// No runtime /tmp dependency, private URLs, or production release claims.
export const producerCommands = 'corepack enable\npnpm install --frozen-lockfile\npnpm dev'
export const producerGuides = {
  es: `## Instalación\n\nEjecuta los comandos del paquete:\n\n~~~sh\n${producerCommands}\n~~~\n`,
  ar: `## التثبيت\n\nشغّل أوامر الحزمة:\n\n~~~sh\n${producerCommands}\n~~~\n`
}

// Exact command counterexample from D's independent review; test-only.
export const heredocCommands = "cat <<'EOF'\n```\nEOF\npnpm dev"
export const mixedFenceGuide = '~~~sh\n' + heredocCommands + '\n~~~\n'
