#!/usr/bin/env node

// Makes the archive that is handed over.
//
//   npm run package
//
// `release.mjs` produces the loose files. This turns them into one archive whose
// name carries the version, so that two of them in a downloads folder are two
// distinguishable things rather than two files called the same.
//
//   release/prompt-atelier-nano-1.0.0.zip
//     prompt-atelier-nano-1.0.0/
//       prompt-atelier-nano.html
//       README.md  README.de.md  CHANGELOG.md  SECURITY.md
//       LICENSE.md  VERSION
//       doc/manual.md  doc/manual.de.md
//       doc/installation.md  doc/installation.de.md
//       doc/development.md  doc/development.de.md
//
// **The zip is written here rather than handed to a tool.** Prompt Atelier does
// the same and gives the reason: `zip` is absent on most Linux servers, and on
// Windows it is absent by default too. A packaging step that works on one of the
// two machines it has to run on is not a packaging step. Deflate comes from
// `node:zlib`, which is always there, and the format below is the 1989 one that
// every reader understands.

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve, dirname, relative, sep } from 'node:path'
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { deflateRawSync, crc32 } from 'node:zlib'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
// The working folder above the repository. Used for readable output and for
// nothing else — never ask git here. `ROOT` is the repository.
const WORKFOLDER = resolve(ROOT, '..')
const OUT = resolve(ROOT, 'release')

const say = (line = '') => console.log(line)

// --- the zip writer ---------------------------------------------------------
//
// Store or deflate, whichever is smaller. Text compresses; the HTML file
// compresses to less than a third. An entry that grew under deflate is stored
// instead, which is what the format allows and what keeps the archive from
// being larger than its contents.

const DOS_EPOCH = 1980

function dosTime (date) {
  const time = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xffff
  const day = (((date.getFullYear() - DOS_EPOCH) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff

  return { time, day }
}

function entryFor (name, content, when) {
  const packed = deflateRawSync(content, { level: 9 })
  const deflated = packed.length < content.length

  return {
    name,
    method: deflated ? 8 : 0,
    payload: deflated ? packed : content,
    size: content.length,
    crc: crc32(content),
    ...dosTime(when)
  }
}

function localHeader (entry) {
  const name = Buffer.from(entry.name, 'utf8')
  const head = Buffer.alloc(30)

  head.writeUInt32LE(0x04034b50, 0)
  head.writeUInt16LE(20, 4) // version needed: 2.0, which is what deflate asks
  // Bit 11 says the name is UTF-8. Without it a reader guesses at a code page,
  // and every name here is ASCII anyway — set because the guess is the bug.
  head.writeUInt16LE(0x0800, 6)
  head.writeUInt16LE(entry.method, 8)
  head.writeUInt16LE(entry.time, 10)
  head.writeUInt16LE(entry.day, 12)
  head.writeUInt32LE(entry.crc, 14)
  head.writeUInt32LE(entry.payload.length, 18)
  head.writeUInt32LE(entry.size, 22)
  head.writeUInt16LE(name.length, 26)
  head.writeUInt16LE(0, 28)

  return Buffer.concat([head, name])
}

function centralHeader (entry, offset) {
  const name = Buffer.from(entry.name, 'utf8')
  const head = Buffer.alloc(46)

  head.writeUInt32LE(0x02014b50, 0)
  // Made by Unix (3), specification 2.0. This is what makes a reader keep the
  // permission bits below instead of inventing its own.
  head.writeUInt16LE((3 << 8) | 20, 4)
  head.writeUInt16LE(20, 6)
  head.writeUInt16LE(0x0800, 8)
  head.writeUInt16LE(entry.method, 10)
  head.writeUInt16LE(entry.time, 12)
  head.writeUInt16LE(entry.day, 14)
  head.writeUInt32LE(entry.crc, 16)
  head.writeUInt32LE(entry.payload.length, 20)
  head.writeUInt32LE(entry.size, 24)
  head.writeUInt16LE(name.length, 28)
  head.writeUInt16LE(0, 30) // extra
  head.writeUInt16LE(0, 32) // comment
  head.writeUInt16LE(0, 34) // disk
  head.writeUInt16LE(0, 36) // internal attributes
  head.writeUInt32LE(0o644 << 16, 38) // external attributes: a plain file
  head.writeUInt32LE(offset, 42)

  return Buffer.concat([head, name])
}

function zip (entries) {
  const parts = []
  const central = []
  let offset = 0

  for (const entry of entries) {
    const head = localHeader(entry)
    central.push(centralHeader(entry, offset))
    parts.push(head, entry.payload)
    offset += head.length + entry.payload.length
  }

  const directory = Buffer.concat(central)
  const end = Buffer.alloc(22)

  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)

  return Buffer.concat([...parts, directory, end])
}

// --- what goes in -----------------------------------------------------------

const version = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).version
const manifest = JSON.parse(readFileSync(resolve(ROOT, 'sync.manifest.json'), 'utf8'))
const base = `prompt-atelier-nano-${version}`

// The release has to exist and has to be current. Rebuilt rather than trusted:
// an archive made from yesterday's build is the one mistake this whole step is
// supposed to make impossible.
if (!process.argv.includes('--keep')) {
  say('── Auslieferung erzeugen')
  const done = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', 'release'], { cwd: ROOT, stdio: 'inherit', shell: false })

  if (done.status !== 0) {
    say('\nAbgebrochen: die Auslieferung ist fehlgeschlagen. Es wurde kein Archiv geschrieben.')
    process.exit(1)
  }
}

// Everything is taken from `release/` rather than from the working tree. The
// two readmes are not identical to the ones in the repository: `release.mjs`
// takes the screenshot gallery out of them, because the pictures stay behind.
// Reading them from the source here would put the gallery back and point at
// files this archive does not carry.
const CONTENTS = [
  [resolve(OUT, 'prompt-atelier-nano.html'), 'prompt-atelier-nano.html'],
  [resolve(OUT, 'README.md'), 'README.md'],
  [resolve(OUT, 'README.de.md'), 'README.de.md'],
  [resolve(ROOT, 'CHANGELOG.md'), 'CHANGELOG.md'],
  [resolve(ROOT, 'SECURITY.md'), 'SECURITY.md'],
  [resolve(ROOT, 'LICENSE.md'), 'LICENSE.md'],
  [resolve(ROOT, 'doc/manual.md'), 'doc/manual.md'],
  [resolve(ROOT, 'doc/manual.de.md'), 'doc/manual.de.md'],
  [resolve(ROOT, 'doc/installation.md'), 'doc/installation.md'],
  [resolve(ROOT, 'doc/installation.de.md'), 'doc/installation.de.md'],
  [resolve(ROOT, 'doc/development.md'), 'doc/development.md'],
  [resolve(ROOT, 'doc/development.de.md'), 'doc/development.de.md']
]

const missing = CONTENTS.filter(([from]) => !existsSync(from)).map(([, to]) => to)
if (missing.length > 0) {
  say(`\nAbgebrochen: es fehlen ${missing.length} Datei(en): ${missing.join(', ')}`)
  process.exit(1)
}

// One moment for every entry. Two runs over an unchanged tree then produce two
function gitDescribe (directory) {
  const ask = (...args) => spawnSync('git', ['-C', directory, ...args], { encoding: 'utf8' })

  const head = ask('rev-parse', '--short', 'HEAD')
  if (head.status !== 0 || !head.stdout?.trim()) return 'unknown'

  const state = ask('status', '--porcelain')
  const dirty = state.status === 0 && state.stdout?.trim()

  return dirty ? `${head.stdout.trim()} (with uncommitted changes)` : head.stdout.trim()
}

// archives that differ only in this stamp, and a stamp that moves for no reason
// makes "did anything change" unanswerable.
const when = new Date()

// Which source produced this archive, on both sides of the seam: the commit of
// this repository, and the commit of Prompt Atelier the copied files came from.
//
// `unknown` when there is no repository, no git, or no commit yet — which is a
// real answer, not a failure. What it must never be is a guess. Prompt Atelier
// wrote `unknown` into archives whose source was committed, because its build
// asked git one directory above its own repository; asking in the right place
// is the whole fix, and `ROOT` is that place here.
//
// A build made before the first commit therefore says `unknown` truthfully. The
// order that avoids it is: commit, then build, then attach.
const commit = gitDescribe(ROOT)

const version_file = [
  `name=prompt-atelier-nano`,
  `version=${version}`,
  `built=${when.toISOString().slice(0, 10)}`,
  `commit=${commit}`,
  `source=prompt-atelier ${manifest.sourceVersion}`,
  `source_commit=${manifest.sourceCommit ?? 'unknown'}`,
  `source_taken=${(manifest.syncedAt ?? '').slice(0, 10)}`,
  ''
].join('\n')

// Said out loud rather than left in the file. `commit: unknown` in a delivered
// archive was found by opening the archive, which is the expensive way to find
// it. Not an abort: building from an unpacked source without a repository is a
// legitimate thing to do, and the line is then the truth.
if (commit === 'unknown') {
  say('')
  say('  Hinweis: commit=unknown. Dieses Verzeichnis ist kein Git-Repository,')
  say('  oder es hat noch keinen Commit. Für ein Archiv, das veröffentlicht')
  say('  werden soll, zuerst festschreiben und dann erneut bauen.')
}

const entries = [
  ...CONTENTS.map(([from, to]) =>
    entryFor(`${base}/${to}`, readFileSync(from), when)),
  entryFor(`${base}/VERSION`, Buffer.from(version_file, 'utf8'), when)
]

const archive = resolve(OUT, `${base}.zip`)
writeFileSync(archive, zip(entries))

const raw = entries.reduce((sum, entry) => sum + entry.size, 0)
const packed = statSync(archive).size

say('')
say('── Archiv')
say(`  ${relative(WORKFOLDER, archive).split(sep).join('/')}`)
say(`  ${entries.length} Dateien, ${raw.toLocaleString('de-DE')} Byte roh, ` +
    `${packed.toLocaleString('de-DE')} Byte im Archiv`)
say('')
say(`  Entpackt entsteht ein Ordner ${base}/.`)
say('  Weiterzugeben ist das Archiv, oder die HTML-Datei daraus allein.')
