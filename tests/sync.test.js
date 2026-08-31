// The sync is only worth what its evidence is worth (AP-N0, RN-09).
//
// `npm test` runs the sync first (`pretest`), so by the time these cases run,
// vendor/ has just been written. What they check is therefore not "did the
// copy work" but the two claims the project actually rests on: that vendor/
// holds exactly the copy list and nothing else, and that the checksums in the
// manifest describe the files that are there.
//
// Without this, "we are in sync" is a sentence somebody says. With it, it is a
// test that goes red.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const VENDOR = join(ROOT, 'vendor')

const manifest = JSON.parse(await readFile(join(ROOT, 'sync.manifest.json'), 'utf8'))
const targetOf = (entry) => resolve(VENDOR, entry.to)

async function walk (directory) {
  const found = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    found.push(...(entry.isDirectory() ? await walk(path) : [path]))
  }
  return found
}

test('the sync has run and recorded which version it took', () => {
  assert.notEqual(manifest.syncedAt, null, 'syncedAt is unset — run `npm run sync`')
  assert.notEqual(manifest.sourceVersion, null, 'sourceVersion is unset — backend/version.rb unreadable?')
})

test('the manifest records which commit of the source it took', () => {
  // The version number names a release, the commit names one state of the
  // source, and between two releases those are not the same thing. Without this
  // field "taken from 1.0.0" covers every commit that ever carried that number.
  //
  // Conditional on the source being a repository, because it was not one until
  // 2026-08-28 and a checkout from an archive is still a legitimate way to work.
  // What is not acceptable is a value that looks like a commit and is not one,
  // which is why the shape is asserted rather than only the presence.
  //
  // The failure this really guards against: asking git one directory above the
  // source, in the working folder that is deliberately not a repository. Prompt
  // Atelier's build did exactly that and stamped `commit: unknown` into every
  // archive it made. Mutating this file to ask there turns the case red.
  //
  // What it cannot see: a `sourceCommit` that was written by an earlier run and
  // never refreshed. `pretest` syncs before these cases run, so a stale value
  // survives only while it is still correct, and then it is not a fault.
  const source = resolve(ROOT, manifest.source)
  const head = spawnSync('git', ['-C', source, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' })

  if (head.status !== 0 || !head.stdout?.trim()) {
    assert.equal(manifest.sourceCommit, null,
      'the source is not a repository, so no commit may be claimed')
    return
  }

  assert.match(manifest.sourceCommit ?? '', /^[0-9a-f]{7,40}( \(with uncommitted changes\))?$/,
    `sourceCommit is ${JSON.stringify(manifest.sourceCommit)} — run \`npm run sync\``)
  assert.equal(manifest.sourceCommit.split(' ')[0], head.stdout.trim(),
    'sourceCommit disagrees with the source — run `npm run sync`')
})

test('every file on the copy list is present with the recorded checksum', async () => {
  const wrong = []

  for (const entry of manifest.files) {
    const path = targetOf(entry)
    const content = await readFile(path).catch(() => null)

    if (content === null) { wrong.push(`${entry.to} — missing`); continue }

    const digest = createHash('sha256').update(content).digest('hex')
    if (digest !== entry.sha256) wrong.push(`${entry.to} — changed here`)
  }

  assert.deepEqual(wrong, [], `vendor/ does not match the manifest:\n  ${wrong.join('\n  ')}`)
})

test('vendor holds nothing beyond the copy list', async () => {
  const wanted = new Set(manifest.files.map((entry) => targetOf(entry)))
  const orphans = (await walk(VENDOR))
    .filter((path) => !wanted.has(resolve(path)))
    .map((path) => relative(ROOT, path))

  assert.deepEqual(orphans, [], `unlisted files in vendor/:\n  ${orphans.join('\n  ')}`)
})

test('copied files are read-only', async () => {
  const writable = []

  for (const entry of manifest.files) {
    const mode = (await stat(targetOf(entry))).mode & 0o222
    if (mode !== 0) writable.push(entry.to)
  }

  assert.deepEqual(writable, [], `writable copies invite the edit that RN-09 is about:\n  ${writable.join('\n  ')}`)
})

// The one file whose sameness the whole exchange promise hangs on (AN-03).
// Named on its own so a failure says which promise broke, rather than "one of
// 49 files differs".
test('the rendering pipeline arrived intact', async () => {
  const entry = manifest.files.find((item) => item.to === 'util/rendering.js')
  assert.ok(entry, 'util/rendering.js is not on the copy list')

  const source = await readFile(targetOf(entry), 'utf8')
  assert.match(source, /export function renderMarked/, 'not the pipeline this project expects')
})

// Read by both test suites from one file, which is what keeps the two
// implementations from drifting apart unnoticed.
test('the rendering vectors arrived and parse', async () => {
  const entry = manifest.files.find((item) => item.to === 'vectors/rendering.json')
  assert.ok(entry, 'the vector file is not on the copy list')

  const vectors = JSON.parse(await readFile(targetOf(entry), 'utf8'))
  const cases = Array.isArray(vectors) ? vectors : vectors.cases ?? vectors.vectors
  assert.ok(Array.isArray(cases) && cases.length > 0, 'no vectors in the file')
})

test('every shadow names a reason', () => {
  const silent = manifest.files
    .filter((entry) => 'shadow' in entry && !String(entry.shadow ?? '').trim())
    .map((entry) => entry.to)

  assert.deepEqual(silent, [], `a shadow without a reason is a fork nobody can judge:\n  ${silent.join('\n  ')}`)
})

// The manifest claims which files are shadowed. src/ is where shadows actually
// live. Nothing kept the two in step, and within one work package they had
// already come apart: `i18n/index.js` was marked as a shadow that was never
// written, while `main.js` and `App.vue` were shadowed without being marked.
//
// The consequence is not cosmetic. The drift check of RN-10 only watches files
// the manifest calls shadows, so a shadow nobody marked is a fork that nobody
// is told about — which is the exact failure the mechanism exists to prevent.
test('every shadow in src is marked in the manifest, and the other way round', async () => {
  const marked = manifest.files.filter((entry) => 'shadow' in entry).map((entry) => entry.to).sort()

  const listed = new Set(manifest.files.map((entry) => entry.to))
  const present = (await walk(join(ROOT, 'src')))
    .map((path) => relative(join(ROOT, 'src'), path).split(sep).join('/'))
    // A file in src/ without a counterpart on the copy list is not a shadow but
    // a module of Nano's own — state/session.js is the first of them. It has
    // nothing to drift from and must not be demanded here.
    .filter((name) => listed.has(name))
    .sort()

  assert.deepEqual(present, marked,
    `src/ and the manifest disagree about which files are shadowed.\n` +
    `  in src/:       ${present.join(', ') || '(none)'}\n` +
    `  in manifest:   ${marked.join(', ') || '(none)'}`)
})

// The number RN-10 asks to be watched. Not a rule with a reason of its own —
// a threshold that turns "keep it small" into something a test can say.
test('the number of shadows stays small', () => {
  const shadows = manifest.files.filter((entry) => 'shadow' in entry)
  assert.ok(shadows.length <= 10,
    `${shadows.length} shadows. Above ten the seam is in the wrong place — see Architekturentwurf.md, section 1.`)
})

// --- what the published documents promise ------------------------------------

// A README that points at a picture which is not there shows a broken image on
// the project page. The screenshots are added by hand, and this is what turns
// "do not forget them" into something that goes red instead of something
// somebody has to remember.
test('every image referenced from a document is actually there', async () => {
  const documents = [
    'README.md', 'README.de.md',
    'doc/manual.md', 'doc/manual.de.md',
    'doc/installation.md', 'doc/installation.de.md',
    'doc/development.md', 'doc/development.de.md'
  ]

  const missing = []
  for (const name of documents) {
    const text = await readFile(join(ROOT, name), 'utf8')
    for (const [, target] of text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
      if (/^https?:/.test(target)) continue

      const path = resolve(join(ROOT, name), '..', target)
      const there = await stat(path).then(() => true, () => false)
      if (!there) missing.push(`${name} -> ${target}`)
    }
  }

  assert.deepEqual(missing, [], `documents reference images that do not exist:\n  ${missing.join('\n  ')}`)
})

// The version is stated in `package.json` and repeated in the documents. A
// raised version that leaves one of them behind is the kind of mistake nobody
// notices until a reader compares the two, so it is checked rather than
// remembered.
//
// `CHANGELOG.md` is exempt: its whole subject is versions other than the
// current one. A range such as `1.0.x` in `SECURITY.md` is not a repetition
// either and does not match the pattern below.
test('every version stated in a document is the current one', async () => {
  const version = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')).version

  const documents = [
    'README.md', 'README.de.md', 'CONTRIBUTING.md', 'SECURITY.md',
    'doc/manual.md', 'doc/manual.de.md',
    'doc/installation.md', 'doc/installation.de.md',
    'doc/development.md', 'doc/development.de.md'
  ]

  const stale = []
  for (const name of documents) {
    const text = await readFile(join(ROOT, name), 'utf8')
    for (const [whole, found] of text.matchAll(/\bVersion (\d+\.\d+\.\d+)/gi)) {
      if (found !== version) stale.push(`${name}: "${whole}" but package.json says ${version}`)
    }
  }

  assert.deepEqual(stale, [], `documents state a version that is not the current one:\n  ${stale.join('\n  ')}`)
})
