import { Blob } from 'node:buffer'
// Controlled test-only metadata. This is not a production release claim.
export const sourceProduct = {
  id: 'website-marketplace',
  name: 'Website Marketplace',
  descriptionByLocale: { en: 'Controlled test marketplace source.', es: 'Código del marketplace de prueba.' },
  version: 'v2026.07.01.120000',
  publishedAt: '2026-07-01T18:00:00Z',
  timezone: 'UTC-06:00',
  sourceSha: 'b'.repeat(40),
  submodules: [{ path: 'src/@/components', sha: 'c'.repeat(40) }],
  license: { id: 'MIT', text: 'MIT License\nCopyright (c) Controlled test fixture\nPermission is hereby granted, free of charge…' },
  instructionsByLocale: { en: '## Setup\n\n1. Extract the ZIP.\n2. Install dependencies.\n\n```sh\npnpm install\n```', es: '## Instalación\n\n1. Descomprime el ZIP.\n2. Instala las dependencias.' },
  artifact: { filename: 'website-marketplace-v2026.07.01.120000.zip', sizeBytes: 4, sha256: '2481a63c85a62cf889d2b149f1a52e985a9341750173fe01eff50cc27b5941b5' }
}
export const catalogResponse = (products = [sourceProduct]) => ({ schemaVersion: 1, products })
export const jsonResponse = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
export const zipResponse = (size = 4, type = 'application/zip', contents = 'x'.repeat(size)) => ({ ok: true, status: 200, headers: new Headers({ 'Content-Type': type }), blob: async () => new Blob([contents], { type }) })
