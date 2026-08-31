#!/usr/bin/env node

// Makes the thing that is handed over (`AP-N8`).
//
//   npm run release
//
// `npm run build` produces `dist/index.html`. That is a build output, and
// `index.html` is not a name anybody would send to a friend — it says nothing
// about what it is, and three of them in a downloads folder are three files
// called the same thing. This script turns the build into a delivery:
//
//   release/prompt-atelier-nano.html   the application, one file
//   release/Anleitung.md               the guide, beside it
//   release/ABNAHME.txt                what was measured, and when
//
// It refuses to write anything if the acceptance run does not hold. A release
// whose measurements failed is not a release, and a folder that contains one
// anyway is a folder somebody will send on.

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, rmSync, statSync, existsSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
// The working folder above the repository, for readable output only.
const WORKFOLDER = resolve(ROOT, '..')
const OUT = resolve(ROOT, 'release')
const NAME = 'prompt-atelier-nano.html'

const say = (line = '') => console.log(line)

function run (what, command, args) {
  say(`\n── ${what}`)
  const done = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', shell: false })

  if (done.status !== 0) {
    say(`\nAbgebrochen: „${what}“ ist fehlgeschlagen. Es wurde nichts nach release/ geschrieben.`)
    process.exit(1)
  }
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

// The build runs the sync and the import audit as its own precondition, so a
// release over a stale vendor/ is not possible. Said here rather than relied on
// silently, because it is the reason this script does not repeat them.
run('Bauen (Abgleich und Prüfung der Kopierliste laufen mit)', npm, ['run', 'build'])
run('Prüfstand bauen', npm, ['run', 'build:tests'])
run('Knotentests', npm, ['test'])
run('Prüfstand in drei Engines', 'node', ['scripts/run-browser-tests.mjs', '--all'])
run('Abnahme in drei Engines', 'node', ['scripts/accept.mjs', 'dist/index.html', '--all'])

// --- only now is there something to hand over -------------------------------

const built = resolve(ROOT, 'dist/index.html')
const bytes = readFileSync(built)
const raw = statSync(built).size
const packed = gzipSync(bytes, { level: 9 }).length

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
copyFileSync(built, resolve(OUT, NAME))

// The manuals travel with the file. `package.mjs` puts the same set into the
// archive; here they lie loose beside it, for whoever only wants to read one.
const DOCUMENTS = [
  ['README.md', 'README.md'],
  ['README.de.md', 'README.de.md'],
  ['CHANGELOG.md', 'CHANGELOG.md'],
  ['SECURITY.md', 'SECURITY.md'],
  ['doc/manual.md', 'doc/manual.md'],
  ['doc/manual.de.md', 'doc/manual.de.md'],
  ['doc/installation.md', 'doc/installation.md'],
  ['doc/installation.de.md', 'doc/installation.de.md'],
  ['doc/development.md', 'doc/development.md'],
  ['doc/development.de.md', 'doc/development.de.md']
]

// **The screenshots stay behind, and the section that shows them goes with
// them.** They are 1.36 MB against an application of 441 kB, so carrying them
// would make the archive 8.8 times larger and 72 percent pictures. Their reader
// is somebody on the project page deciding whether to download. Whoever has the
// archive already has the application and can open it.
//
// What must not happen is shipping a document that points at files that are not
// there. So the section is removed rather than left to break, a line takes its
// place, and the check below refuses to write anything if a reference survives.
const GALLERY = /^## (Screenshots|Bildschirmfotos)\n[\s\S]*?\n---\n\n(?=## )/m

const INSTEAD = {
  'README.md': 'Screenshots are on the project page.\n\n---\n\n',
  'README.de.md': 'Bildschirmfotos finden Sie auf der Projektseite.\n\n---\n\n'
}

for (const [from, to] of DOCUMENTS) {
  const source = resolve(ROOT, from)
  if (!existsSync(source)) { say(`\n!  ${from} fehlt und liegt nicht bei.`); continue }

  mkdirSync(dirname(resolve(OUT, to)), { recursive: true })

  if (!(to in INSTEAD)) { copyFileSync(source, resolve(OUT, to)); continue }

  const text = readFileSync(source, 'utf8').replace(GALLERY, INSTEAD[to])

  // A reference that survived means the section markers moved. Louder than a
  // silently broken picture in a document somebody unpacked.
  const left = [...text.matchAll(/!\[[^\]]*\]\((img\/[^)]+)\)/g)].map((hit) => hit[1])
  if (left.length > 0) {
    say(`\nAbgebrochen: ${to} verweist noch auf ${left.length} Bild(er): ${left.join(', ')}`)
    say('Die Abschnittsmarken in scripts/release.mjs passen nicht mehr.')
    process.exit(1)
  }

  writeFileSync(resolve(OUT, to), text)
}

copyFileSync(resolve(ROOT, 'LICENSE.md'), resolve(OUT, 'LICENSE.md'))

const stamp = new Date()
const build = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'))
const manifest = JSON.parse(readFileSync(resolve(ROOT, 'sync.manifest.json'), 'utf8'))

const report = [
  'Prompt Atelier Nano — Abnahme',
  '',
  `Erzeugt   ${stamp.toISOString()}`,
  `Fassung   ${build.version}`,
  `Quelle    Prompt Atelier ${manifest.sourceVersion}, übernommen ${(manifest.syncedAt ?? '').slice(0, 10)}`,
  `Datei     ${NAME}`,
  `Größe     ${raw.toLocaleString('de-DE')} Byte, komprimiert ${(packed / 1024).toFixed(1)} kB`,
  '',
  'Belegt durch die Läufe, die diesem Bau vorausgingen:',
  '',
  '  Knotentests             Abgleich, Kopierliste, Schattenbuchführung',
  '  Prüfstand               Chromium, Firefox und WebKit, über file://',
  '  Abnahme                 NFA-02, NFA-03, NFA-04, NFA-06 und keine Netzanfrage',
  '',
  'Ohne einen dieser Läufe wäre diese Datei nicht entstanden: das Skript bricht ab,',
  'bevor es nach release/ schreibt.',
  '',
  'Weiterzugeben ist die HTML-Datei allein. Sie braucht nichts weiter — kein Ruby,',
  'keine Installation, keinen Server, keine Netzverbindung.',
  ''
].join('\n')

writeFileSync(resolve(OUT, 'ABNAHME.txt'), report)

say('')
say('── Ausgeliefert')
say(`  ${resolve(OUT, NAME).replace(WORKFOLDER + '/', '')}`)
say(`  ${raw.toLocaleString('de-DE')} Byte, komprimiert ${(packed / 1024).toFixed(1)} kB`)
say('  daneben: README, drei Handbücher in zwei Sprachen, LICENSE.md, ABNAHME.txt')
say('')
say('  Weiterzugeben ist die HTML-Datei. Sonst nichts.')
