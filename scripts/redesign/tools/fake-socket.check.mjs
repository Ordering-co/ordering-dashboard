// redesign W0-9c (T0-38)
// Browser check of scripts/redesign/tools/fake-socket.mjs: the dashboard's own Socket class (WebsocketContext/socket.js,
// bundled with the real socket.io-client) connects to the fake server, joins rooms, hears emits, keeps its
// connection alive through pings, and replays its rooms after a drop. Exits 1 on the first failed expectation.
//
//   node scripts/redesign/tools/fake-socket.check.mjs
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { fakeMessage, fakeOrder, fakeOrderUpdate, installFakeSocket } from './fake-socket.mjs'

const root = process.cwd()
const requireFromRoot = createRequire(`${root}/`)
// esbuild is vite's dependency, not ours: resolve it from vite so nothing new is installed.
const esbuild = createRequire(requireFromRoot.resolve('vite/package.json'))('esbuild')
const bundle = await esbuild.build({
  entryPoints: [resolve(root, 'src/@/components-dashboard/src/contexts/WebsocketContext/socket.js')],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'AppSocket',
  platform: 'browser',
  logLevel: 'silent'
})
const script = bundle.outputFiles[0].text

const failures = []
const expect = (label, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok || !detail ? '' : ` -> ${detail}`}`)
  if (!ok) failures.push(label)
}
const show = value => JSON.stringify(value)

const browser = await chromium.launch()
try {
  const context = await browser.newContext()
  // Same order as the live session: a catch-all that closes every WebSocket first, the fake after it (newest wins).
  await context.routeWebSocket(/.*/, socket => socket.close({ code: 1000 }))
  const { url, fakeSocket } = await installFakeSocket(context, { pingInterval: 300, pingTimeout: 300 })
  await context.route('http://app.test/', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>check</title>' }))
  const page = await context.newPage()
  await page.goto('http://app.test/')
  await page.addScriptTag({ content: script })
  await page.evaluate(({ url }) => {
    window.__heard = []
    window.__disconnects = 0
    window.__app = new window.AppSocket.Socket({ url, project: 'fakeproject', accessToken: 'fake-token' })
    window.__app.connect()
    window.__app.socket.on('disconnect', () => { window.__disconnects += 1 })
  }, { url })

  // 1. handshake
  await fakeSocket.waitFor(c => c.connected(), 5000).catch(() => {})
  expect('server sees the client connected to the default namespace', fakeSocket.connected())
  const clientState = await page.evaluate(() => ({ connected: window.__app.socket.connected, id: window.__app.getId() }))
  expect('client socket.io is connected and has an id', clientState.connected === true && !!clientState.id, show(clientState))
  const [connection] = fakeSocket.connections()
  expect('the token and project reach the server in the query string', connection?.query?.token === 'fake-token' && connection?.query?.project === 'fakeproject', show(connection?.query))

  // 2. rooms, with the same calls the controllers make
  await page.evaluate(() => {
    const app = window.__app
    for (const event of ['update_order', 'orders_register', 'message', 'drivers_update']) app.on(event, payload => window.__heard.push({ event, payload }))
    app.join({ room: 'orders', user_id: 4, role: 'manager' })
    app.join('orders_4')
  })
  await fakeSocket.waitFor(c => c.rooms().length === 2, 5000).catch(() => {})
  expect('both rooms reach the server as the app names them', show(fakeSocket.rooms()) === show([
    { room: 'orders', user_id: 4, role: 'manager', project: 'fakeproject' }, 'fakeproject_orders_4'
  ]), show(fakeSocket.rooms()))
  expect('the joins are in received()', fakeSocket.received().filter(e => e.event === 'join').length === 2, show(fakeSocket.received()))

  // 3. emit reaches the listeners with the payload intact
  const order = fakeOrder({ id: 960777, status: 0 })
  const delivered = fakeSocket.emit('orders_register', order)
  fakeSocket.emit('update_order', fakeOrderUpdate({ id: 960777, from: 0, to: 7 }))
  fakeSocket.emit('message', fakeMessage({ orderId: 960777 }))
  await page.waitForFunction(() => window.__heard.length >= 3, null, { timeout: 5000 }).catch(() => {})
  const heard = await page.evaluate(() => window.__heard)
  expect('emit reports one connection reached', delivered === 1, String(delivered))
  expect('the client heard the three events in order', show(heard.map(h => h.event)) === show(['orders_register', 'update_order', 'message']), show(heard.map(h => h.event)))
  expect('the order arrives whole', show(heard[0]?.payload) === show(order))
  expect('the status change arrives as history[].data', heard[1]?.payload?.status === 7 && heard[1]?.payload?.history?.[0]?.data?.[0]?.new === 7)

  // 4. room-targeted emit
  const before = (await page.evaluate(() => window.__heard.length))
  expect('an emit to a room nobody joined reaches no one', fakeSocket.emit('drivers_update', { id: 1 }, { room: 'drivers' }) === 0)
  expect('an emit to a joined room (by name) reaches the client', fakeSocket.emit('drivers_update', { id: 1 }, { room: 'orders' }) === 1)
  await page.waitForFunction(n => window.__heard.length > n, before, { timeout: 5000 }).catch(() => {})
  expect('...and only that one arrived', (await page.evaluate(() => window.__heard.length)) === before + 1)

  // 5. leave
  await page.evaluate(() => window.__app.leave('orders_4'))
  await fakeSocket.waitFor(c => c.rooms().length === 1, 5000).catch(() => {})
  expect('leave removes the room on the server', show(fakeSocket.rooms()) === show([{ room: 'orders', user_id: 4, role: 'manager', project: 'fakeproject' }]), show(fakeSocket.rooms()))

  // 6. pings keep the connection alive: with 300+300 ms and no ping the client would give up in 600 ms
  await page.waitForTimeout(1500)
  expect('the connection survives 1.5 s with a 300+300 ms ping budget (the server pings)', (await page.evaluate(() => window.__disconnects)) === 0)

  // 7. a drop is repaired by the client, which replays its rooms (reconnectionDelay is 1 s)
  const dropped = fakeSocket.dropAll()
  expect('dropAll closes the connection', dropped === 1 && !fakeSocket.connected(), `${dropped}`)
  await fakeSocket.waitFor(c => c.connected() && c.rooms().length === 1, 8000).catch(() => {})
  expect('the client reconnects and replays the room it still uses', fakeSocket.connected() && show(fakeSocket.rooms()) === show([{ room: 'orders', user_id: 4, role: 'manager', project: 'fakeproject' }]), show(fakeSocket.rooms()))
  const afterDrop = await page.evaluate(() => window.__heard.length)
  fakeSocket.emit('update_order', fakeOrderUpdate({ id: 960777, from: 7, to: 8 }))
  await page.waitForFunction(n => window.__heard.length > n, afterDrop, { timeout: 5000 }).catch(() => {})
  expect('events flow again after the reconnection', (await page.evaluate(() => window.__heard.length)) === afterDrop + 1)
} catch (error) {
  console.log(`FAIL check crashed -> ${error?.stack || error}`)
  failures.push('crash')
} finally {
  await browser.close()
}

if (failures.length) {
  console.log(`\n${failures.length} failed: ${failures.join(' | ')}`)
  process.exit(1)
}
console.log('\nall fake-socket checks passed')
