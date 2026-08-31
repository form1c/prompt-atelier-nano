#!/usr/bin/env node

// What the shipped screens actually say, printed for a person to read.
//
// **This is not a test and must not become one.** AP-N4 spent three attempts
// hitting a button by its label before concluding that the interface is the
// wrong instrument for proving an endpoint layer, and the browser bench came
// out of that. What the bench cannot show is whether a *screen* renders at all
// — the two shadows of AP-N7 exist for their wording, and wording has to be
// looked at. So this reads text and never clicks anything, and it reports
// rather than judges.
//
// The application exposes no door for it — `window.__nano` belongs to the
// bench — so the collection is arranged through the storage itself, which is
// what the application reads at start-up anyway. Nothing here evaluates a
// string in the page: the meta CSP of the shipped file forbids it, correctly,
// and finding that out here was worth the detour.
//
//   npm run screens
import { pathToFileURL, fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

// Playwright is borrowed from the Prompt Atelier checkout beside this one, the
// same read-only borrowing the sync does and for the same reason: this
// repository has to stay installable without it. Resolved relative to this
// file, never by absolute path — one of those was in here, it worked on
// exactly one machine, and nothing said so.
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const PLAYWRIGHT = resolve(ROOT, '../../PromptStorage/project/node_modules/playwright/index.mjs')

let chromium
try {
  ;({ chromium } = await import(pathToFileURL(PLAYWRIGHT).href))
} catch {
  console.log('Playwright not found beside this repository — nothing read.')
  console.log(`  looked in ${PLAYWRIGHT}`)
  process.exit(0)
}

const page = pathToFileURL(resolve(process.argv[2])).href
const browser = await chromium.launch()
const tab = await browser.newPage()
const noise = []

tab.on('console', (message) => { if (message.type() === 'error') noise.push(message.text()) })
tab.on('pageerror', (error) => noise.push(`pageerror: ${error.message}`))

const show = (label, text) => console.log(`\n--- ${label} ---\n${String(text).trim()}`)

await tab.goto(page)
await tab.waitForSelector('.shell', { timeout: 20000 })

// The first thing anybody sees, and the only question this application asks by
// itself (AP-N8). Answered with yes, because everything below wants prompts.
show('first run', await tab.locator('.firstrun__box').innerText())
await tab.locator('[data-test="take-examples"]').click()
await tab.waitForSelector('.hits .hit', { timeout: 20000 })

show('header', await tab.locator('.shell__brand').innerText())
show('storage line', await tab.locator('.shell__storage').innerText())
show('sidebar', await tab.locator('.shell__sidebar').innerText())
show('sidebar foot', await tab.locator('.shell__version').innerText())
console.log('and on hover:', await tab.locator('.shell__version').getAttribute('title'))
console.log('picker offered:', await tab.locator('[data-test="file-choose"]').count())

// Three prompts into the bin: 25 days old, fresh, and 40 days overdue.
const binned = await tab.evaluate(async () => {
  const KEY = 'promptatelier.nano.record'
  const db = await new Promise((done) => {
    const request = indexedDB.open('promptatelier-nano', 1)
    request.onsuccess = () => done(request.result)
  })
  const read = () => new Promise((done) => {
    const ask = db.transaction('state', 'readonly').objectStore('state').get(KEY)
    ask.onsuccess = () => done(ask.result)
  })
  const write = (text) => new Promise((done) => {
    const put = db.transaction('state', 'readwrite').objectStore('state').put(text, KEY)
    put.onsuccess = () => done()
  })

  const day = 24 * 60 * 60 * 1000
  const record = JSON.parse(await read())
  const [one, two, three] = record.prompts

  one.deleted_at = new Date(Date.now() - (25 * day)).toISOString()
  two.deleted_at = new Date().toISOString()
  three.deleted_at = new Date(Date.now() - (40 * day)).toISOString()

  await write(JSON.stringify(record))

  return { overdue: three.title, alive: record.prompts.find((prompt) => !prompt.deleted_at).id }
})
console.log('the 40-day-old one:', binned.overdue)

// A reload, not a hash change: the collection was arranged in the storage and
// the running application still holds the one it read at start-up.
await tab.goto(`${page}#/trash`)
await tab.reload()
await tab.waitForSelector('.entries .entry', { timeout: 20000 })
show('trash', await tab.locator('.entries').innerText())
show('notice', await tab.locator('[role="status"], .notice').first().innerText().catch(() => '(none)'))
console.log('the overdue one is still listed:',
  (await tab.locator('.entries').innerText()).includes(binned.overdue))

await tab.goto(`${page}#/prompt/${binned.alive}/duplicate`)
await tab.waitForSelector('.transfer', { timeout: 20000 })
const duplicate = await tab.locator('.transfer').innerText()
show('duplicate', duplicate)
console.log('mentions Workspace:', duplicate.includes('Workspace'))

console.log('\nconsole errors:', noise.length ? noise : 'none')
await browser.close()
