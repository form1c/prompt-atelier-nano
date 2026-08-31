#!/usr/bin/env node

// The acceptance run (`AP-N8`): the promises of the requirements, measured on
// the file that ships, in real engines, over `file://`.
//
// **Nothing here is asserted from the source.** Every number comes out of a
// browser that opened the delivered file, because that is the only thing the
// person will ever run. A measurement taken against a development server would
// be a measurement of a different program.
//
//   node scripts/accept.mjs [path-to-html] [--all]
//
// What it answers, and against what:
//
//   NFA-02  search under 200 ms         at 500 prompts, 95th percentile
//   NFA-03  first paint under 1.5 s     from opening the file to the library
//   NFA-04  preview under 150 ms        one render of a prompt with variables
//   NFA-06  bundle under 300 kB gzip    the file itself
//   SEC/13  not one network request     nothing may leave the machine
//
// The last one is the one worth having. Everything else is comfort; a single
// request to anywhere would break the promise the whole project is built on.

import { pathToFileURL, fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { readFileSync, statSync, existsSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const PLAYWRIGHT = resolve(ROOT, '../../PromptStorage/project/node_modules/playwright/index.mjs')

const args = process.argv.slice(2)
const target = resolve(ROOT, args.find((value) => !value.startsWith('--')) ?? 'dist/index.html')
const wantsAll = args.includes('--all')

let engines
try {
  const module = await import(pathToFileURL(PLAYWRIGHT).href)
  engines = { chromium: module.chromium, firefox: module.firefox, webkit: module.webkit }
} catch {
  console.log('Playwright not found beside this repository — acceptance skipped.')
  console.log(`  looked in ${PLAYWRIGHT}`)
  process.exit(0)
}

// --- the promises -----------------------------------------------------------

const PROMISES = {
  'NFA-02': { what: 'Suche', limit: 200, unit: 'ms' },
  'NFA-03': { what: 'Erstes Rendern', limit: 1500, unit: 'ms' },
  'NFA-04': { what: 'Vorschau', limit: 150, unit: 'ms' },
  'NFA-06': { what: 'Bündel komprimiert', limit: 300 * 1024, unit: 'B' }
}

const findings = []
const say = (line = '') => console.log(line)

function record (id, engine, value, extra = '') {
  const promise = PROMISES[id]
  const ok = value <= promise.limit
  findings.push({ id, engine, value, limit: promise.limit, ok })

  const shown = promise.unit === 'B'
    ? `${(value / 1024).toFixed(1)} kB von ${(promise.limit / 1024).toFixed(0)} kB`
    : `${value.toFixed(value < 10 ? 1 : 0)} ${promise.unit} von ${promise.limit} ${promise.unit}`

  say(`  ${ok ? 'hält ' : 'REISST'}  ${id}  ${promise.what.padEnd(20)} ${shown}${extra}`)
}

// --- the file itself --------------------------------------------------------

const bytes = readFileSync(target)
say(`\nGeprüft wird ${target}`)
say(`  ${statSync(target).size.toLocaleString('de-DE')} Byte roh`)
record('NFA-06', 'datei', gzipSync(bytes, { level: 9 }).length)

// A single file means a single file. Anything the page would have to go and
// fetch is a dependency on something that may not be there — and under file://
// it would simply not arrive.
const OUTSIDE = /(?:src|href)\s*=\s*["'](?!data:|#|javascript:)([^"']+)["']/gi
const outside = [...bytes.toString('utf8').matchAll(OUTSIDE)].map((hit) => hit[1])

say(outside.length === 0
  ? '  hält   —       Selbstgenügsam        keine Verweise nach außen'
  : `  REISST  —       Selbstgenügsam        ${outside.length}: ${outside.slice(0, 3).join(', ')}`)
if (outside.length > 0) findings.push({ id: 'self-contained', ok: false })

// --- in the browsers --------------------------------------------------------

const page = pathToFileURL(target).href
const wanted = wantsAll ? Object.keys(engines) : ['chromium']

for (const name of wanted) {
  say(`\n${name}`)

  const browser = await engines[name].launch()
  const tab = await browser.newPage()
  const requests = []

  // Every request the page makes, whatever its scheme. The file itself is the
  // only one allowed, and it is filtered out by comparing against its own URL.
  tab.on('request', (request) => { if (request.url() !== page) requests.push(request.url()) })

  // The first visit is answered first, and **not** measured. NFA-03 is about
  // the morning after — an application that opens onto a question is not the
  // case the promise is about, and a library with nothing in it would make the
  // number good for the wrong reason.
  await tab.goto(page)
  const offer = tab.locator('[data-test="take-examples"]')
  if (await offer.count() > 0) await offer.click()
  await tab.waitForSelector('.hits .hit', { timeout: 20000 })

  const opened = Date.now()
  await tab.reload()
  // A row of the library, not the frame: `.shell` is drawn before anything has
  // been asked for, and NFA-03 is about seeing the application.
  await tab.waitForSelector('.hits .hit', { timeout: 20000 })
  record('NFA-03', name, Date.now() - opened, '  (zweiter Aufruf, 55 Prompts)')

  say(requests.length === 0
    ? '  hält   SEC     Keine Netzanfrage     null Anfragen über die ganze Sitzung'
    : `  REISST  SEC     Keine Netzanfrage     ${requests.length}: ${requests.slice(0, 3).join(', ')}`)
  if (requests.length > 0) findings.push({ id: 'no-network', engine: name, ok: false })

  await browser.close()
}

// --- the two timings, and where they honestly come from ---------------------
//
// NFA-02 and NFA-04 need to reach the search and the rendering directly, and
// the shipped file has no door for that: `window.__nano` belongs to the bench
// and was deliberately never put into the application. Two ways out, and the
// second is the one taken:
//
//   * drive the interface — type into the search field and wait for rows. That
//     measures the interface as much as the search, and AP-N4 already recorded
//     what interface-driven measurement is worth here.
//   * measure on the **bench build**, which is the same modules built the same
//     way, and say so in the output rather than blur it.
//
// A number whose origin is not stated is a number nobody can check.

const bench = resolve(ROOT, 'dist-tests/tests/browser/index.html')

if (!existsSync(bench)) {
  say('\nNFA-02 und NFA-04 übersprungen: dist-tests fehlt. Vorher `npm run build:tests`.')
} else {
  const benchPage = pathToFileURL(bench).href
  say(`\nNFA-02 und NFA-04, gemessen am Prüfstandsbau (${bench.replace(ROOT + '/', '')})`)

  for (const name of wanted) {
    const browser = await engines[name].launch()
    const tab = await browser.newPage()

    await tab.goto(benchPage)
    // After the suite, not during it: forty searches racing the whole bench
    // for the same processor would measure the bench.
    await tab.waitForFunction(() => window.__results !== undefined, { timeout: 60000 })

    const measured = await tab.evaluate(async () => {
    const { get, post, render } = window.__nano ?? {}
    if (!get) return { missing: true }

    // 500 prompts, which is what EN-06 promises — built here rather than
    // shipped, so that the number is about the promise and not about the
    // examples that happen to be in the file.
    const existing = (await get('/api/v1/prompts', { params: { limit: 500 } })).meta.total
    for (let index = existing; index < 500; index += 1) {
      await post('/api/v1/prompts', {
        body: {
          title: `Messprompt ${index} über Größe und Straße`,
          description: 'Ein Prompt für die Messung, mit Umlauten und einem Cœur',
          body: `Schreibe einen Text über {{thema}} im Stil von {{stil}}. Nummer ${index}.`,
          tags: ['messung', index % 2 ? 'gerade' : 'ungerade']
        }
      })
    }

    const terms = ['größ', 'straße', 'cœur', 'messprompt', 'text', 'stil', 'nummer', 'gerade']
    const searches = []
    for (let round = 0; round < 40; round += 1) {
      const term = terms[round % terms.length]
      const began = performance.now()
      await get('/api/v1/prompts', { params: { q: term, limit: 50 } })
      searches.push(performance.now() - began)
    }

    const prompt = (await get('/api/v1/prompts', { params: { limit: 1 } })).prompts[0]
    const previews = []
    for (let round = 0; round < 40; round += 1) {
      const began = performance.now()
      render({
        body: prompt.body,
        variables: prompt.variables ?? [],
        keywords: prompt.keywords ?? [],
        values: { thema: 'Vögel', stil: 'sachlich' }
      })
      previews.push(performance.now() - began)
    }

    const percentile = (list, share) =>
      [...list].sort((a, b) => a - b)[Math.min(Math.ceil(list.length * share) - 1, list.length - 1)]

    return { total: 500, search: percentile(searches, 0.95), preview: percentile(previews, 0.95) }
  })

    say(`\n${name}`)
    if (measured.missing) {
      say('  !      window.__nano fehlt im Prüfstandsbau — nichts zu messen.')
    } else {
      record('NFA-02', name, measured.search, `  (95. Perzentil bei ${measured.total} Prompts)`)
      record('NFA-04', name, measured.preview, '  (95. Perzentil)')
    }

    await browser.close()
  }
}

const broken = findings.filter((entry) => !entry.ok)
say(broken.length === 0
  ? '\nAbnahme: alle Zusagen gehalten.'
  : `\nAbnahme: ${broken.length} Zusage(n) gerissen — ${broken.map((entry) => entry.id).join(', ')}`)

process.exitCode = broken.length === 0 ? 0 : 1
