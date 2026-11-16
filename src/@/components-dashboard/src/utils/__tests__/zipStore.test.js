import { describe, expect, it } from 'vitest'
import { crc32, zipStore } from '../zipStore'

// the .zip of the invoices of a batch. Stored (no compression: a PDF is already compressed); read back here by hand.

const readZip = (bytes) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = bytes.byteLength - 22
  expect(view.getUint32(end, true)).toBe(0x06054b50)
  const count = view.getUint16(end + 10, true)
  let at = view.getUint32(end + 16, true)
  const files = []
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50)
    const crc = view.getUint32(at + 16, true)
    const size = view.getUint32(at + 20, true)
    const nameLength = view.getUint16(at + 28, true)
    const local = view.getUint32(at + 42, true)
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength))
    expect(view.getUint32(local, true)).toBe(0x04034b50)
    const localName = view.getUint16(local + 26, true)
    const localExtra = view.getUint16(local + 28, true)
    const start = local + 30 + localName + localExtra
    files.push({ name, crc, data: new TextDecoder().decode(bytes.subarray(start, start + size)) })
    at += 46 + nameLength
  }
  return files
}

describe('zipStore', () => {
  it('crc32 is the standard one', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })

  it('writes every file with its name, its bytes and its crc', async () => {
    const blob = await zipStore([
      { name: 'invoice-pizza-palace.pdf', blob: new Blob(['%PDF one']) },
      { name: 'factura-josé.pdf', blob: new Blob(['%PDF two']) }
    ])
    expect(blob.type).toBe('application/zip')
    const buffer = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.readAsArrayBuffer(blob)
    })
    const files = readZip(new Uint8Array(buffer))
    expect(files.map(file => [file.name, file.data])).toEqual([
      ['invoice-pizza-palace.pdf', '%PDF one'],
      ['factura-josé.pdf', '%PDF two']
    ])
    expect(files[0].crc).toBe(crc32(new TextEncoder().encode('%PDF one')))
  })
})
