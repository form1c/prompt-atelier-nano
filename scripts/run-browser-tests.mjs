#!/usr/bin/env node

// Runs the browser bench in real engines over file://, and reports what it
// found. Playwright comes from the Prompt Atelier checkout beside this one —
// the same read-only borrowing the sync does, and the reason it is not a
// dependency here: this repository must stay installable without it.

import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const PLAYWRIGHT = resolve(ROOT, '../../PromptStorage/project/node_modules/playwright/index.mjs')

let engines
try {
  const module = await import(pathToFileURL(PLAYWRIGHT).href)
  engines = { chromium: module.chromium, firefox: module.firefox, webkit: module.webkit }
} catch {
  console.log('Playwright not found beside this repository — browser bench skipped.')
  console.log(`  looked in ${PLAYWRIGHT}`)
  process.exit(0)
}

const page = pathToFileURL(resolve(ROOT, 'dist-tests/tests/browser/index.html')).href
const wanted = process.argv.includes('--all') ? Object.keys(engines) : ['chromium']
let failures = 0

for (const name of wanted) {
  const browser = await engines[name].launch()
  const tab = await (await browser.newContext({ locale: 'de-DE' })).newPage()
  const noise = []
  tab.on('pageerror', (error) => noise.push(`pageerror: ${error.message}`))

  await tab.goto(page)
  await tab.waitForFunction(() => window.__results !== undefined, { timeout: 60000 })
    .catch(() => noise.push('the bench never finished'))

  const outcome = await tab.evaluate(() => window.__results ?? { total: 0, failed: 1, results: [] })
  console.log(`\n${name}  ${outcome.total - outcome.failed}/${outcome.total}`)
  for (const entry of outcome.results) {
    // A case may answer with a measurement rather than only a verdict. Printing
    // it is the whole point of having taken it — a number that only a green
    // tick stands for is a number nobody can quote.
    if (entry.ok) console.log(`  ok    ${entry.name}${entry.note ? `\n        ${entry.note}` : ''}`)
    else console.log(`  FAIL  ${entry.name}\n        ${entry.detail}`)
  }
  for (const line of noise) console.log(`  !     ${line}`)

  failures += outcome.failed + noise.length
  await browser.close()
}

console.log(failures === 0 ? '\nbench green' : `\n${failures} failure(s)`)
process.exitCode = failures === 0 ? 0 : 1
